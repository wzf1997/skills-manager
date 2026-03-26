# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**Skills Manager** 是一个 macOS 原生 Electron 应用，用于发现、管理和上传 AI Skills（技能包）。采用 Electron + React + TypeScript + Vite 架构。

## 常用命令

```bash
npm start          # 启动开发环境（Vite + Electron）
npm run build      # 编译主进程 + 渲染进程
npm run pack       # 构建并打包为目录模式（不生成 DMG）
npm run dist       # 构建并生成 macOS DMG 安装包（含 post-build 脚本）
```

无测试框架，无 lint 脚本配置。

## 架构概览

### 进程模型

**主进程** (`src/main/`): 处理文件系统、IPC 事件、权限管理
**渲染进程** (`src/renderer/`): React UI，通过 `window.electronAPI` 调用主进程
**预加载脚本** (`src/main/preload.ts`): 通过 `contextBridge` 安全暴露 API，保持上下文隔离

### 主进程核心模块

| 文件 | 职责 |
|------|------|
| `index.ts` | 主进程入口，注册所有 IPC 处理器，管理 BrowserWindow |
| `discovery.ts` | 递归扫描 `$HOME` 发现 skills 目录，自动识别 `.claude`、`.dewuclaw`、`.openclaw` 等工具 |
| `scanner.ts` | 读取 Skill 目录的 `SKILL.md`，用 `gray-matter` 解析 YAML 前置元数据 |
| `copier.ts` | 优先创建软链接，失败时回落到 `fs.cpSync` 物理复制 |
| `packer.ts` | 使用 `archiver` 将 Skill 目录流式压缩成 ZIP Buffer |
| `uploader.ts` | 上传到 `https://aicoding.dewu-inc.com/v1/skills/upload`，支持 Token 认证 |
| `elevate.ts` | 通过 AppleScript 弹出系统授权弹窗，执行 `chown -R` 提升目录权限 |
| `store.ts` | 用 `electron-store` 持久化用户配置（上传 Token 等） |

### IPC 接口

主进程暴露以下 IPC 频道（在 `preload.ts` 中定义类型）：

- `skills:discover` — 扫描所有 Skills 源
- `skills:scanAll` — 读取所有 Skills 元数据
- `skills:copy` — 复制/链接 Skill 到目标源
- `skills:upload` — 打包并上传 Skill
- `config:get` / `config:set` — 读写持久化配置
- `shell:openInFinder` — 在 Finder 中打开目录

### 渲染进程状态管理

`AppContext.tsx` 使用 `useReducer` 管理全局状态，关键状态字段：
- `sources` — 发现的 Skills 源列表
- `skills` — 扫描得到的所有 Skill 元数据
- `selectedSlugsWithSource` — 当前选中的 Skills
- `uploadTasks` — 上传进度追踪（并发上限 3）

### 共享类型

`src/types.ts` 定义了主进程和渲染进程共用的类型：`SkillSource`、`SkillMeta`、`UploadConfig` 等。

### 构建产物路径

- 渲染进程 → `dist/`
- 主进程 → `dist-electron/main/`
- Preload → `dist-electron/preload/`
- 打包应用 → `release/`（由 electron-builder 生成）

## 关键约定

- **Skill 元数据**来自技能目录下的 `SKILL.md` 文件，YAML 前置元数据由 `gray-matter` 解析
- **软链接优先**：`copier.ts` 优先创建软链接（symlink），跨卷时回落到复制
- **路径别名**：`@/` 映射到 `./src/`（在 `tsconfig.json` 和 `vite.config.ts` 中配置）
- **仅支持 macOS**：打包配置仅针对 macOS（ARM64 + x64 通用二进制），App ID: `com.dewu.skills-manager`
