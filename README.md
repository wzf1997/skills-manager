<div align="center">

<img src="docs/icon.jpeg" width="80" alt="Skills Manager" />

# Skills Manager

**统一管理你所有 AI 工具的 Skills 技能包**

一款跨平台桌面应用，自动发现本机 50+ 种 AI 编程工具的 Skills 目录，
让你轻松浏览、跨工具同步、在线安装 AI 技能包。

[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey?style=flat&logo=apple&logoColor=white)](https://github.com)
[![Tauri](https://img.shields.io/badge/Tauri-2-FFC131?style=flat&logo=tauri&logoColor=white)](https://tauri.app)
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
- 🎨 **原生体验** — 原生标题栏，可拖拽侧边栏，自动跟随系统深色/浅色模式

---

## 📸 功能截图

![Features](docs/screenshot-features.png)

---

## 📥 安装

前往 [Releases](../../releases) 页面，根据你的系统下载对应安装包：

| 系统 | 安装包 |
|---|---|
| macOS Apple Silicon | `Skills.Manager_x.x.x_aarch64.dmg` |
| macOS Intel | `Skills.Manager_x.x.x_x64.dmg` |
| Windows x64 | `Skills.Manager_x.x.x_x64-setup.exe` |
| Linux x64 | `skills-manager_x.x.x_amd64.AppImage` |

### macOS 提示「已损坏，无法打开」

macOS Gatekeeper 对非 App Store 应用有限制，在终端执行以下命令解除：

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
| 框架 | Tauri 2 + React 18 + TypeScript 5 |
| 构建 | Vite 5 + Rust |
| 样式 | Tailwind CSS 3 |
| 后端 | Rust（文件系统、IPC、权限提升） |
| Markdown | gray-matter + marked |

---

## 💻 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发环境（Vite + Tauri 热重载）
pnpm tauri dev

# 构建生产包
pnpm tauri build
```

**系统要求**：Node.js 18+，Rust stable，各平台系统依赖见 [Tauri 文档](https://tauri.app/start/prerequisites/)

---

## 📋 已知局限

- 在线安装需要本机安装 Node.js（`npx`）
- Hub 热榜依赖 GitHub 网络连通性

---

## 💬 交流群

遇到问题或想交流 AI Skills 玩法，欢迎加入微信群：

<div align="center">

<img src="docs/qrcoder.jpg" width="200" alt="微信交流群" />

</div>

---

<div align="center">

Made with ♥ for AI power users

</div>
