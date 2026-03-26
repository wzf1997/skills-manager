<div align="center">

<img src="build/icon.png" width="80" alt="Skills Manager" />

# Skills Manager

**统一管理你所有 AI 工具的 Skills 技能包**

一款 macOS 原生应用，自动发现本机 50+ 种 AI 编程工具的 Skills 目录，
让你轻松浏览、跨工具同步、在线安装 AI 技能包。

[![Platform](https://img.shields.io/badge/platform-macOS-000000?style=flat&logo=apple&logoColor=white)](https://github.com)
[![Electron](https://img.shields.io/badge/Electron-31-47848F?style=flat&logo=electron&logoColor=white)](https://electronjs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org)

</div>

---

![Skills Manager Hero](docs/screenshot-hero.png)

---

## ✨ 功能亮点

- 🔍 **自动发现来源** — 递归扫描 `$HOME`，自动识别 Claude Code、Cursor、Windsurf、Gemini CLI 等 50+ 工具的 Skills 目录，零配置开箱即用
- 🔗 **跨工具一键同步** — 右键将 Skill 软链接或复制到其他工具，软链接优先，改一处处处更新
- 📦 **在线安装** — 输入 GitHub shorthand 即可安装，实时日志输出，权限不足时自动弹系统授权弹窗并重试
- 🔥 **热榜 Hub** — 内置社区精选 Skill 热榜，分类浏览，一键安装
- ✏️ **来源管理** — 双击来源名称内联重命名，支持手动添加自定义目录
- 🎨 **原生体验** — hiddenInset 标题栏，可拖拽侧边栏，自动跟随系统深色/浅色模式

---

## 📸 功能截图

![Features](docs/screenshot-features.png)

---

## 📥 安装

### 下载 DMG

前往 [Releases](../../releases) 页面下载最新版 `Skills Manager-x.x.x-arm64.dmg`，拖入应用程序文件夹即可。

### 如果提示「已损坏，无法打开」

macOS Gatekeeper 对非 App Store 应用有限制，运行以下命令解除：

```bash
xattr -cr "/Applications/Skills Manager.app"
```

---

## 🛠 支持工具

| | 工具 | 识别路径 |
|---|---|---|
| 🟠 | Claude Code | `.claude` |
| 🔵 | Cursor | `.cursor` |
| 🟣 | Windsurf | `.windsurf` |
| 🔵 | GitHub Copilot | `.copilot` |
| 🟢 | Cline | `.cline` |
| 🩵 | Gemini CLI | `.gemini` |
| 🟠 | Roo Code | `.roo` |
| 🟤 | Augment | `.augment` |
| 🟡 | Aider | `.aider` |
| 🟣 | OpenClaw | `.openclaw` |
| 🟢 | FlyClaw | `.flyclaw` |
| ⚪ | 更多 40+ 种 | 自动识别 |

---

## 🏗 Tech Stack

| 层 | 技术 |
|---|---|
| 框架 | Electron 31 + React 18 + TypeScript 5 |
| 构建 | Vite 5 + vite-plugin-electron |
| 样式 | Tailwind CSS 3 |
| 主进程 | Node.js fs / archiver / electron-store |
| Markdown | gray-matter + marked |

---

## 💻 本地开发

```bash
# 安装依赖
npm install

# 启动开发环境（Vite + Electron 热重载）
npm start

# 构建生产包
npm run build

# 生成 macOS DMG
npm run dist
```

**系统要求**：macOS 12+，Node.js 18+，Apple Silicon 或 Intel Mac

---

## 📋 已知局限

- 仅支持 macOS，暂无 Windows / Linux 版本
- 在线安装需要本机安装 Node.js（`npx`）
- Hub 热榜依赖 GitHub 网络连通性

---

<div align="center">

Made with ♥ for AI power users

</div>
