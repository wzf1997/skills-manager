# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# 安装依赖（项目使用 pnpm，但 npm 脚本也可用）
npm install

# 开发模式（Vite + Electron 热重载）
npm start

# 构建生产包（输出到 dist/ 和 dist-electron/）
npm run build

# 打包为 macOS .app（不含 DMG）
npm run pack

# 打包为 macOS DMG + Linux AppImage（输出到 release/）
npm run dist
```

> 无测试框架，项目目前不包含测试命令。

## Architecture

### 进程模型

项目是标准 Electron 双进程架构，通过 IPC 通信：

- **主进程** (`src/main/`) — Node.js 环境，负责文件系统操作、skill 扫描、安装、配置持久化
- **渲染进程** (`src/renderer/`) — React 18 + Tailwind CSS，纯展示与交互逻辑
- **Preload** (`src/main/preload.ts`) — 安全桥梁，通过 `contextBridge` 将 `window.electronAPI` 暴露给渲染进程
- **共享类型** (`src/types.ts`) — `SkillSource`、`SkillMeta`、`AppConfig`、`FeaturedSkill` 等核心类型，两端通用

### 主进程模块

| 文件 | 职责 |
|------|------|
| `src/main/index.ts` | 入口，窗口创建，所有 IPC handler 注册，来源缓存（`cachedSources`）管理 |
| `src/main/discovery.ts` | 递归扫描 `$HOME`，识别含 `SKILL.md` 的 skills 目录，推断来源 label/color |
| `src/main/scanner.ts` | 读取 `SKILL.md` frontmatter（gray-matter），构建 `SkillMeta` 列表 |
| `src/main/copier.ts` | 跨工具 skill 同步：优先软链接，失败时 fallback 物理复制 |
| `src/main/store.ts` | 配置持久化（`electron-store`），存储自定义来源路径、来源标签别名、最近安装记录 |
| `src/main/elevate.ts` | macOS 权限提升，EACCES 时弹系统授权弹窗 |

### 渲染进程状态管理

全局状态通过 `AppContext`（`src/renderer/context/AppContext.tsx`）管理，使用 `useReducer` 模式：

- `state.sources` — 已发现的 `SkillSource[]`
- `state.skills` — 全量 `SkillMeta[]`（所有来源合并）
- `state.activeSourceId` — 当前选中的来源（`null` = 全部，`'recent'` = 最近安装）
- `refresh()` — 重新调用 `discoverSources` + `scanAllSkills` 刷新全量数据
- `useFilteredSkills()` — 导出的 hook，按 `activeSourceId` + `searchQuery` 过滤

### Skill 文件结构约定

一个合法的 skill 目录结构：
```
<skills-dir>/
  <slug>/
    SKILL.md      ← 必须存在，frontmatter 包含 name/description/tags
    ...其他文件
```

`SKILL.md` frontmatter 示例：
```yaml
---
name: My Skill
description: 功能描述
tags: [tag1, tag2]
---
```

### IPC 频道约定

| 频道 | 方向 | 说明 |
|------|------|------|
| `skills:discover` | invoke | 返回 `SkillSource[]` |
| `skills:scanAll` | invoke | 返回 `SkillMeta[]` |
| `skills:copy` | invoke | 复制/软链接 skill 到目标来源 |
| `skills:delete` | invoke | 删除 skill 目录 |
| `skills:install` | invoke | 调用 `npx skills add` 在线安装 |
| `skills:readMd` | invoke | 读取 `SKILL.md` 原始内容 |
| `sources:updated` | main→renderer push | 来源变更后主进程主动推送 |
| `install:progress` | main→renderer push | 安装日志实时流式输出 |
| `hub:fetchFeatured` | invoke | 从 GitHub 拉取社区热榜 JSON |
| `theme:get` / `theme:changed` | invoke / push | 系统深色/浅色模式 |

### 构建输出

- `dist/` — 渲染进程静态资源（Vite 输出）
- `dist-electron/main/` — 主进程编译产物
- `dist-electron/preload/` — Preload 编译产物
- `release/` — electron-builder 打包产物（.app / .dmg / .AppImage）

`vite-plugin-electron` 在开发时同时启动 Vite dev server 和 Electron，热重载自动生效。
