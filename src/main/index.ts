import { app, BrowserWindow, ipcMain, shell, nativeTheme } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import https from 'node:https'
import { spawn } from 'node:child_process'
import { discoverSources } from './discovery'
import { scanAllSources } from './scanner'
import { copySkill } from './copier'
import { getConfig, setConfig } from './store'
import { isWritable, requestWritePermission } from './elevate'

// electron-store 需要在 app ready 后才能用
process.env.APP_ROOT = path.join(__dirname, '../..')

let win: BrowserWindow | null = null
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f0f10',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      sandbox: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../../dist/index.html'))
  }
}

function refreshCachedSources() {
  const config = getConfig()
  cachedSources = discoverSources(config.customSources, config.sourceLabels ?? {})
  return cachedSources
}

let cachedSources: ReturnType<typeof discoverSources> = []

app.whenReady().then(() => {
  refreshCachedSources()
  createWindow()

  // 监听系统主题变化
  nativeTheme.on('updated', () => {
    win?.webContents.send('theme:changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
  win = null
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ===== IPC Handlers =====

ipcMain.handle('skills:discover', () => refreshCachedSources())

ipcMain.handle('skills:scanAll', () => {
  refreshCachedSources()
  return scanAllSources(cachedSources)
})

ipcMain.handle('skills:copy', async (_event, slug: string, sourceDirPath: string, targetSourceId: string) => {
  const target = cachedSources.find(s => s.id === targetSourceId)
  if (!target) return { success: false, error: '目标来源不存在', alreadyExists: false, mode: 'copy' }

  if (!isWritable(target.path)) {
    try {
      await requestWritePermission(target.path)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: `权限申请失败: ${msg}`, alreadyExists: false, mode: 'copy' }
    }
  }

  const result = copySkill(sourceDirPath, target.path, slug)

  if (result.success) {
    refreshCachedSources()
    win?.webContents.send('sources:updated', cachedSources)
  }
  return result
})

ipcMain.on('shell:openInFinder', (_event, dirPath: string) => {
  shell.showItemInFolder(dirPath)
})

ipcMain.handle('skills:delete', async (_event, dirPath: string, sourceId: string) => {
  const source = cachedSources.find(s => s.id === sourceId)
  if (!source) return { success: false, error: '来源不存在' }

  if (!isWritable(source.path)) {
    try {
      await requestWritePermission(source.path)
    } catch (err) {
      return { success: false, error: `权限申请失败: ${err instanceof Error ? err.message : String(err)}` }
    }
  }

  try {
    fs.rmSync(dirPath, { recursive: true, force: true })
    refreshCachedSources()
    win?.webContents.send('sources:updated', cachedSources)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('config:get', () => getConfig())

ipcMain.handle('config:set', (_event, patch: Parameters<typeof setConfig>[0]) => {
  setConfig(patch)
  if (patch.customSources !== undefined) {
    refreshCachedSources()
    win?.webContents.send('sources:updated', cachedSources)
  }
})

// ===== 新增：读取 SKILL.md 内容 =====
ipcMain.handle('skills:readMd', (_event, dirPath: string) => {
  const mdPath = path.join(dirPath, 'SKILL.md')
  try {
    return fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf-8') : null
  } catch {
    return null
  }
})

// ===== 新增：重命名来源标签 =====
ipcMain.handle('sources:rename', (_event, sourceId: string, newLabel: string) => {
  const config = getConfig()
  const labels = { ...(config.sourceLabels ?? {}), [sourceId]: newLabel }
  setConfig({ sourceLabels: labels })
  refreshCachedSources()
  win?.webContents.send('sources:updated', cachedSources)
})

// 从用户 login shell 获取真实 PATH（兼容 nvm/volta/fnm）
function getUserPath(): Promise<string> {
  return new Promise((resolve) => {
    const shell = process.env.SHELL || '/bin/zsh'
    const proc = spawn(shell, ['-l', '-c', 'echo $PATH'], { env: process.env })
    let out = ''
    proc.stdout.on('data', (d: Buffer) => { out += d.toString() })
    proc.on('close', () => resolve(out.trim() || process.env.PATH || ''))
    proc.on('error', () => resolve(process.env.PATH || ''))
  })
}

// ===== 新增：在线安装 Skill =====
ipcMain.handle('skills:install', async (_event, sourceUrl: string, skillSlug?: string) => {
  const args = ['skills', 'add', sourceUrl, '-g', '-y']
  if (skillSlug) args.push('--skill', skillSlug)

  // 安装前快照，用于 diff 出新 skill
  const beforeSkills = new Set(scanAllSources(cachedSources).map(s => s.dirPath))

  // 打包后 macOS .app 的 PATH 缺少 Node.js 路径，从 login shell 获取完整 PATH
  const resolvedPath = await getUserPath()

  return new Promise<{ success: boolean; error?: string }>((resolve) => {
    const proc = spawn('npx', args, {
      env: { ...process.env, PATH: resolvedPath, FORCE_COLOR: '0' },
      shell: true,
    })

    proc.stdout.on('data', (data: Buffer) => {
      win?.webContents.send('install:progress', data.toString())
    })
    proc.stderr.on('data', (data: Buffer) => {
      win?.webContents.send('install:progress', data.toString())
    })
    proc.on('close', (code) => {
      refreshCachedSources()

      // 写入 recentInstalls：
      // - 有 slug：直接按 slug 匹配（不管新旧，重装也记录）
      // - 无 slug：用 diff；diff 为空时按 mtime 兜底（60s 内修改过的）
      if (code === 0) {
        const installTime = Date.now()
        const afterSkills = scanAllSources(cachedSources)
        let targetPaths: string[]
        if (skillSlug) {
          targetPaths = afterSkills.filter(s => s.slug === skillSlug).map(s => s.dirPath)
        } else {
          targetPaths = afterSkills.map(s => s.dirPath).filter(p => !beforeSkills.has(p))
          // diff 为空：按 mtime 兜底（安装/更新导致目录变动）
          if (targetPaths.length === 0) {
            targetPaths = afterSkills
              .filter(s => { try { return installTime - fs.statSync(s.dirPath).mtimeMs < 60000 } catch { return false } })
              .map(s => s.dirPath)
          }
        }
        if (targetPaths.length > 0) {
          const config = getConfig()
          const existing = config.recentInstalls ?? []
          const merged = [...targetPaths, ...existing.filter(p => !targetPaths.includes(p))].slice(0, 10)
          setConfig({ recentInstalls: merged })
        }
      }

      win?.webContents.send('sources:updated', cachedSources)
      if (code === 0) {
        resolve({ success: true })
      } else {
        resolve({ success: false, error: `进程退出码: ${code}` })
      }
    })
    proc.on('error', (err) => {
      resolve({ success: false, error: err.message })
    })
  })
})

// ===== 新增：获取热榜 Skills =====
let hubCache: { data: unknown; ts: number } | null = null
const HUB_CACHE_TTL = 5 * 60 * 1000 // 5 分钟

ipcMain.handle('hub:fetchFeatured', () => {
  return new Promise((resolve) => {
    if (hubCache && Date.now() - hubCache.ts < HUB_CACHE_TTL) {
      return resolve(hubCache.data)
    }
    const url = 'https://raw.githubusercontent.com/qufei1993/skills-hub/main/featured-skills.json'
    const req = https.get(url, { timeout: 30000 }, (res) => {
      let raw = ''
      res.on('data', (chunk: Buffer) => { raw += chunk.toString() })
      res.on('end', () => {
        try {
          const json = JSON.parse(raw)
          hubCache = { data: json.skills ?? [], ts: Date.now() }
          resolve(hubCache.data)
        } catch (e) {
          resolve([])
        }
      })
    })
    req.on('error', () => resolve([]))
    req.on('timeout', () => { req.destroy(); resolve([]) })
  })
})

// ===== 新增：获取当前系统主题 =====
ipcMain.handle('theme:get', () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
