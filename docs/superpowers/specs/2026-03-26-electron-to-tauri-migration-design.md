# Skills Manager：Electron → Tauri v2 迁移设计

**日期：** 2026-03-26
**状态：** 待实施
**范围：** 将现有 Electron 31 应用整体迁移至 Tauri v2，保持功能完全一致，支持 macOS / Windows / Linux 三平台

---

## 背景与目标

现有应用基于 Electron 31，打包后 macOS `.app` 约 150MB，启动较慢。迁移至 Tauri v2 后预期包体积缩至 8-12MB，启动速度显著提升。

**不变的内容：** 所有功能特性、UI 布局、React 组件、Tailwind 样式
**变化的内容：** 主进程层（Node.js → Rust）、IPC 通信方式、打包工具链

---

## 技术选型

| 层 | 现在 | 迁移后 |
|---|---|---|
| 框架 | Electron 31 | Tauri v2 |
| 前端 | React 18 + TypeScript 5 + Tailwind CSS 3 | 不变 |
| 构建 | Vite 5 + vite-plugin-electron | Vite 5（标准，无 electron 插件） |
| 后端核心逻辑 | Node.js (fs / child_process) | Rust (std::fs / std::process) |
| 文件读取（简单） | Node.js fs | tauri-plugin-fs |
| 配置持久化 | electron-store | tauri-plugin-store |
| 子进程 | Node.js child_process | tauri-plugin-shell |
| 权限提升 | osascript（主流程） | Tauri Capabilities 声明为主，osascript 兜底 |

---

## 项目结构

```
skills-manager/
├── src/                          # Rust 后端
│   ├── lib.rs                    # 注册所有 Tauri commands
│   └── commands/
│       ├── mod.rs
│       ├── discovery.rs          # 替代 src/main/discovery.ts
│       ├── copier.rs             # 替代 src/main/copier.ts
│       ├── install.rs            # 替代 install IPC handler
│       ├── scanner.rs            # scan_all_skills（调用 JS 层 or Rust 读文件）
│       └── store.rs              # 配置读写（包装 tauri-plugin-store）
├── src-frontend/                 # React 前端（从 src/renderer/ 整体搬入）
│   ├── main.tsx
│   ├── App.tsx
│   ├── api.ts                    # 新建：统一封装 invoke / listen
│   ├── components/               # 全部不动
│   ├── context/
│   │   └── AppContext.tsx        # 仅替换 window.electronAPI → api
│   └── index.css
├── capabilities/
│   └── default.json              # 权限声明
├── tauri.conf.json
├── Cargo.toml
└── package.json
```

**删除的文件：**
- `src/main/index.ts`（主进程入口）
- `src/main/preload.ts`（contextBridge）
- `vite-plugin-electron` 相关配置

---

## 混合分工

| 模块 | 迁移后实现 | 理由 |
|------|-----------|------|
| 目录扫描 discovery | **Rust command** | 递归扫描数千目录，性能敏感 |
| Skill 元数据扫描 scanner | **Rust command** | 与 discovery 同层，用 serde_yaml 解析 frontmatter，API 层统一 invoke 模式 |
| Skill 同步 copier | **Rust command** | symlink 只能在 native 层创建 |
| 在线安装 install | **Rust command** | 需要 spawn + 流式事件推送 |
| Skill 删除 delete | **Rust command** | 和权限检查逻辑绑定 |
| 读取原始 SKILL.md（详情面板）| **Rust command** | std::fs::read_to_string，用于展示原始内容 |
| 配置持久化 | **tauri-plugin-store** | 直接替换 electron-store |
| Hub 热榜请求 | **渲染层 fetch()** | 浏览器可直接请求，无需主进程转发 |
| 系统主题 | **CSS prefers-color-scheme** | 零成本，删除所有主题 IPC |
| 权限提升 | **Capabilities + Rust osascript 兜底** | 见下文 |

---

## Rust Commands 设计

### discovery.rs

```rust
#[tauri::command]
fn discover_sources(config: AppConfig) -> Vec<SkillSource>
```

- 从 `dirs::home_dir()` 开始递归扫描，深度上限 4 层
- 跳过 `SKIP_DIRS`（node_modules / .git / Library 等），逻辑与 `discovery.ts` 完全等价
- `KNOWN_TOOLS` 映射翻译为 Rust `HashMap<&str, ToolInfo>`
- Source ID 用 `sha2` crate 对 resolved path 做 SHA-256 取前 32 字符
- 结果按 skillCount 降序排列，已知工具优先

### copier.rs

```rust
#[tauri::command]
fn copy_skill(source_dir_path: String, target_source_path: String, slug: String) -> CopyResult
```

- 优先 `std::os::unix::fs::symlink`（macOS/Linux）或 Windows junction
- 失败后 fallback `std::fs::copy` 递归复制
- 写权限检查：`fs::metadata` + 权限位检测，不可写时调权限提升

### install.rs

```rust
#[tauri::command]
async fn install_skill(
    app: AppHandle,
    source_url: String,
    skill_slug: Option<String>
) -> InstallResult
```

- 用 `tauri-plugin-shell` 的 `Command` spawn `npx skills add <url> -g -y`
- stdout/stderr 逐行通过 `app.emit("install:progress", line)` 推送给渲染层
- 权限错误（EACCES/EPERM）检测 + 自动提权重试，逻辑与现版本一致
- 安装成功后写入 `recentInstalls`（最近 10 条）

### 权限提升（跨平台）

```rust
#[cfg(target_os = "macos")]
fn request_write_permission(path: &str) -> Result<()> {
    std::process::Command::new("osascript")
        .arg("-e")
        .arg(format!(
            "do shell script \"chown -R $USER '{}'\" with administrator privileges",
            path
        ))
        .output()?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn request_write_permission(path: &str) -> Result<()> {
    // ShellExecute runas 触发 UAC 弹窗
}

#[cfg(target_os = "linux")]
fn request_write_permission(path: &str) -> Result<()> {
    std::process::Command::new("pkexec")
        .args(["chown", "-R", &whoami(), path])
        .output()?;
    Ok(())
}
```

大多数 skills 目录（`~/.claude/skills/` 等）为用户自有，通过 Capabilities 声明即可读写，权限提升仅作为边缘 case 兜底。

---

## 前端改造

### 新建 `src-frontend/api.ts`

删除 `preload.ts` + `window.electronAPI`，统一替换为薄封装层：

```typescript
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { SkillSource, SkillMeta, AppConfig, CopyResult } from './types'

export const api = {
  discoverSources: () =>
    invoke<SkillSource[]>('discover_sources'),
  scanAllSkills: () =>
    invoke<SkillMeta[]>('scan_all_skills'),
  copySkill: (slug: string, sourceDirPath: string, targetSourceId: string) =>
    invoke<CopyResult>('copy_skill', { slug, sourceDirPath, targetSourceId }),
  deleteSkill: (dirPath: string, sourceId: string) =>
    invoke<{ success: boolean; error?: string }>('delete_skill', { dirPath, sourceId }),
  installSkill: (sourceUrl: string, skillSlug?: string) =>
    invoke<{ success: boolean; error?: string }>('install_skill', { sourceUrl, skillSlug }),
  readSkillMd: (dirPath: string) =>
    invoke<string | null>('read_skill_md', { dirPath }),
  getConfig: () =>
    invoke<AppConfig>('get_config'),
  setConfig: (patch: Partial<AppConfig>) =>
    invoke<void>('set_config', { patch }),
  renameSource: (sourceId: string, newLabel: string) =>
    invoke<void>('rename_source', { sourceId, newLabel }),
  openInFinder: (dirPath: string) =>
    invoke<void>('open_in_finder', { dirPath }),

  // 事件订阅（返回 unlisten 函数）
  onSourcesUpdated: (cb: (sources: SkillSource[]) => void) =>
    listen<SkillSource[]>('sources:updated', e => cb(e.payload)),
  onInstallProgress: (cb: (line: string) => void) =>
    listen<string>('install:progress', e => cb(e.payload)),
}
```

### AppContext.tsx 改动

仅替换 `window.electronAPI.xxx` → `api.xxx`（约 15 处），reducer / state / hooks / `useFilteredSkills` 完全不动。

### 两处简化

**Hub 热榜** — `HubPanel.tsx` 直接 `fetch()` GitHub raw URL，删除 `hub:fetchFeatured` IPC 及主进程缓存逻辑。

**系统主题** — `App.tsx` 删除主题 IPC，改用 `window.matchMedia`：
```typescript
const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  document.documentElement.classList.toggle('dark', e.matches)
})
```

### 改动范围汇总

| 文件 | 改动类型 |
|------|---------|
| `src/main/preload.ts` | 删除 |
| `src/main/index.ts` | 删除 |
| `src-frontend/api.ts` | 新建（~40 行） |
| `AppContext.tsx` | 替换 API 调用（约 15 处，逻辑不变） |
| `App.tsx` | 删除主题 IPC，改 matchMedia |
| `HubPanel.tsx` | 改为直接 fetch() |
| 其余所有组件 | 不动 |

---

## 构建 & 打包

### tauri.conf.json 关键配置

```json
{
  "productName": "Skills Manager",
  "identifier": "com.fly.skills-manager",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420"
  },
  "app": {
    "windows": [{
      "title": "Skills Manager",
      "width": 1200,
      "height": 780,
      "minWidth": 900,
      "minHeight": 600,
      "titleBarStyle": "Overlay",
      "hiddenTitle": true
    }]
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "macOS": { "minimumSystemVersion": "12.0" },
    "windows": { "wix": {}, "nsis": {} },
    "linux": { "deb": {}, "appimage": {} }
  }
}
```

**标题栏说明：**
- macOS：`titleBarStyle: "Overlay"` + `hiddenTitle: true`，保留原生红绿灯，`drag-region` CSS 继续有效
- Windows/Linux：使用原生标题栏（`decorations: true`），无需自定义窗口控件

### capabilities/default.json

```json
{
  "identifier": "default",
  "platforms": ["macOS", "windows", "linux"],
  "permissions": [
    "core:default",
    "shell:allow-execute",
    "store:default"
  ]
}
```

> Rust 命令通过 `std::fs` 直接访问文件系统，无需声明 `fs:*` 能力。`shell:allow-execute` 用于 `tauri-plugin-shell` 执行 `npx`。

### Cargo.toml 依赖

```toml
[dependencies]
tauri              = { version = "2", features = ["macos-private-api"] }
tauri-plugin-store = "2"
tauri-plugin-shell = "2"
serde              = { version = "1", features = ["derive"] }
serde_json         = "1"
serde_yaml         = "0.9"  # 解析 SKILL.md frontmatter（替代 gray-matter）
sha2               = "0.10" # 替代 crypto.createHash
dirs               = "5"    # 替代 os.homedir()
```

> `tauri-plugin-fs` 不再需要：所有文件操作均在 Rust 命令中通过 `std::fs` 完成，无需 JS 侧 fs API。

### 开发命令

| 命令 | 说明 |
|------|------|
| `npm run tauri dev` | 当前平台热重载开发 |
| `npm run tauri build` | 当前平台生产构建 |
| GitHub Actions matrix | 三平台 CI 并行构建 |

### GitHub Actions 矩阵构建

Tauri 不支持交叉编译，三平台产物需要分别在对应 OS 上构建：

```yaml
strategy:
  matrix:
    os: [macos-latest, windows-latest, ubuntu-latest]
runs-on: ${{ matrix.os }}
steps:
  - uses: tauri-apps/tauri-action@v0
```

### 包体积预期

| 平台 | Electron | Tauri v2 |
|------|----------|----------|
| macOS .app | ~150MB | ~8-12MB |
| Windows .exe | ~200MB | ~5-8MB |
| Linux .AppImage | ~180MB | ~10-15MB |

---

## 事件推送对照

| 原 Electron | 新 Tauri |
|------------|---------|
| `win.webContents.send('sources:updated', data)` | `app.emit("sources:updated", data)` |
| `win.webContents.send('install:progress', text)` | `app.emit("install:progress", text)` |
| `nativeTheme.on('updated', ...)` | 删除，改 CSS `prefers-color-scheme` |
| `ipcRenderer.on('sources:updated', cb)` | `listen('sources:updated', cb)` |
| `ipcRenderer.invoke('xxx', ...)` | `invoke('xxx', {...})` |

---

## 迁移中的注意点

1. **serde_yaml 替代 gray-matter** — scanner 逻辑移至 Rust，用 `serde_yaml` 解析 SKILL.md frontmatter（name/description/tags），API 层统一 `invoke()` 模式，前端不再依赖 gray-matter
2. **symlink 在 Windows** — Windows 需要 Developer Mode 或管理员权限才能创建 symlink，fallback 物理复制为默认行为
3. **npx PATH 问题** — macOS .app 缺少 Node.js PATH 的问题在 Tauri 中同样存在，`install.rs` 需复用现有的 login shell 探测逻辑（spawn `$SHELL -l -c 'echo $PATH'`）
4. **`openInFinder`** — macOS 用 `open -R`，Windows 用 `explorer /select,`，Linux 用 `xdg-open`，在 Rust 按平台实现
