import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import type { SkillSource } from '../types'

// 已知工具目录名 → 显示名 + 颜色
const KNOWN_TOOLS: Record<string, { label: string; color: string }> = {
  // ── 现有 ──
  '.claude':      { label: 'Claude Code',    color: '#f97316' },
  '.flyclaw':     { label: 'FlyClaw',        color: '#ec4899' },
  '.openclaw':    { label: 'OpenClaw',       color: '#8b5cf6' },
  '.agents':      { label: 'Agents',         color: '#10b981' },
  '.comate':      { label: 'Comate',         color: '#3b82f6' },
  '.codex':       { label: 'Codex',          color: '#6366f1' },
  '.codeium':     { label: 'Codeium',        color: '#0ea5e9' },
  '.continue':    { label: 'Continue',       color: '#14b8a6' },
  '.aider':       { label: 'Aider',          color: '#a855f7' },
  // ── 新增：顶级目录 ──
  '.cursor':      { label: 'Cursor',         color: '#00b4d8' },
  '.augment':     { label: 'Augment',        color: '#4ade80' },
  '.cline':       { label: 'Cline',          color: '#ef4444' },
  '.codebuddy':   { label: 'CodeBuddy',      color: '#fb7185' },
  '.commandcode': { label: 'Command Code',   color: '#c084fc' },
  '.copilot':     { label: 'GitHub Copilot', color: '#24292f' },
  '.clawdbot':    { label: 'Clawdbot',       color: '#06b6d4' },
  '.factory':     { label: 'Droid',          color: '#d1d5db' },
  '.gemini':      { label: 'Gemini CLI',     color: '#4285f4' },
  '.iflow':       { label: 'iFlow CLI',      color: '#67e8f9' },
  '.junie':       { label: 'Junie',          color: '#fcd34d' },
  '.kilocode':    { label: 'Kilo Code',      color: '#34d399' },
  '.kiro':        { label: 'Kiro CLI',       color: '#5eead4' },
  '.kode':        { label: 'Kode',           color: '#a3e635' },
  '.mcpjam':      { label: 'MCPJam',         color: '#fb923c' },
  '.moltbot':     { label: 'MoltBot',        color: '#fef08a' },
  '.mux':         { label: 'Mux',            color: '#2dd4bf' },
  '.neovate':     { label: 'Neovate',        color: '#e2e8f0' },
  '.openclaude':  { label: 'OpenClaude',     color: '#f59e0b' },
  '.openhands':   { label: 'OpenHands',      color: '#7c3aed' },
  '.pi':          { label: 'Pi',             color: '#f472b6' },
  '.pochi':       { label: 'Pochi',          color: '#fda4af' },
  '.qoder':       { label: 'Qoder',          color: '#38bdf8' },
  '.qwen':        { label: 'Qwen Code',      color: '#86efac' },
  '.roo':         { label: 'Roo Code',       color: '#fbbf24' },
  '.trae':        { label: 'Trae',           color: '#e879f9' },
  '.trae-cn':     { label: 'Trae CN',        color: '#f0abfc' },
  '.vibe':        { label: 'Mistral Vibe',   color: '#818cf8' },
  '.zencoder':    { label: 'Zencoder',       color: '#60a5fa' },
  '.adal':        { label: 'AdaL',           color: '#c4b5fd' },
  // ── 新增：嵌套路径父级目录（.config/* / .gemini/* / .codeium/* / .pi/*）──
  'opencode':     { label: 'OpenCode',       color: '#a78bfa' },
  'antigravity':  { label: 'Antigravity',    color: '#f87171' },
  'agents':       { label: 'Agents',         color: '#10b981' },
  'crush':        { label: 'Crush',          color: '#fb923c' },
  'goose':        { label: 'Goose',          color: '#86efac' },
  'windsurf':     { label: 'Windsurf',       color: '#38bdf8' },
  'agent':        { label: 'Pi',             color: '#f472b6' },
}

// 目录名中含有这些词就视为 skills 目录
const SKILLS_DIR_KEYWORDS = ['skills', 'skill', 'Skills', 'Skill', 'global_skills', 'rules']

// 递归搜索时跳过的目录（避免扫进 node_modules / .git 等大目录浪费时间）
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg',
  'Library', 'Applications', 'System', 'Volumes',
  'dist', 'build', 'out', '.cache', '.npm', '.yarn',
  '__pycache__', '.venv', 'venv', '.tox',
  'Pictures', 'Movies', 'Music', 'Downloads',
])

// 统计目录下有效 skill 数量（子目录含 SKILL.md）
function countSkills(dirPath: string): number {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true }).filter(e => {
      if (!e.isDirectory()) return false
      return fs.existsSync(path.join(dirPath, e.name, 'SKILL.md'))
    }).length
  } catch {
    return 0
  }
}

// 判断目录是否是有效 skills 目录（至少一个子目录含 SKILL.md）
function isValidSkillsDir(dirPath: string): boolean {
  return countSkills(dirPath) > 0
}

// 从路径推断 label
function inferLabel(skillsDir: string): string {
  const parts = skillsDir.split(path.sep)
  // 找到 skills 类目录所在索引（从后往前，兼容 ES2019）
  let skillsIdx = -1
  for (let i = parts.length - 1; i >= 0; i--) {
    if (SKILLS_DIR_KEYWORDS.some(k => parts[i].toLowerCase() === k.toLowerCase())) {
      skillsIdx = i
      break
    }
  }

  // 父目录名（如 .claude、mycustomtool 等）
  const parentName = skillsIdx > 0 ? parts[skillsIdx - 1] : parts[parts.length - 2]
  // 子目录名（如 extensions/feishu/skills 中的 feishu）
  const grandParent = skillsIdx > 1 ? parts[skillsIdx - 2] : null

  // 已知工具名优先
  const known = KNOWN_TOOLS[parentName]
  if (known) {
    // 如果是扩展目录（extensions/feishu/skills），加子标签
    const isExtension = grandParent === 'extensions'
    return isExtension ? `${known.label} · ${parentName}` : known.label
  }

  // 处理路径段，去掉前导点，首字母大写
  const clean = (s: string) => s.replace(/^\./, '').replace(/[-_]/g, ' ')
    .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

  if (grandParent && grandParent !== 'extensions' && grandParent !== '.') {
    return `${clean(grandParent)} · ${clean(parentName)}`
  }
  return clean(parentName)
}

// 根据路径推断颜色（对已知工具返回品牌色，未知按哈希分配）
const PALETTE = [
  '#f97316','#ec4899','#8b5cf6','#10b981',
  '#3b82f6','#f59e0b','#06b6d4','#a855f7',
  '#14b8a6','#6366f1','#84cc16','#e11d48',
]
function inferColor(skillsDir: string): string {
  for (const [dirName, info] of Object.entries(KNOWN_TOOLS)) {
    if (skillsDir.includes(path.sep + dirName + path.sep)) return info.color
  }
  // 用路径字符串做简单哈希
  let h = 0
  for (const c of skillsDir) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}

function pathToId(p: string): string {
  return crypto.createHash('sha256').update(p, 'utf8').digest('hex').slice(0, 32)
}

/**
 * 核心：递归扫描目录树，找出所有含有 SKILL.md 的"父目录集合"
 * 策略：当目录名匹配 skills 关键词时直接检验；否则继续递归（限深度）
 */
function findSkillsDirs(
  rootDir: string,
  maxDepth: number,
  found: Set<string>,
  depth = 0
): void {
  if (depth > maxDepth) return

  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (SKIP_DIRS.has(entry.name)) continue

    const fullPath = path.join(rootDir, entry.name)

    // 如果目录名本身是 skills/skill 关键词，直接验证
    const isSkillsNamed = SKILLS_DIR_KEYWORDS.some(
      k => entry.name.toLowerCase() === k.toLowerCase()
    )
    if (isSkillsNamed) {
      if (isValidSkillsDir(fullPath)) {
        found.add(fullPath)
      }
      // skills 目录不再往下递归（子目录是单个 skill，不是 skills 集合）
      continue
    }

    // 否则继续递归（找更深层的 skills 目录）
    findSkillsDirs(fullPath, maxDepth, found, depth + 1)
  }
}

export function discoverSources(
  customPaths: Array<{ path: string }> = [],
  sourceLabels: Record<string, string> = {}
): SkillSource[] {
  const homeDir = os.homedir()
  const foundPaths = new Set<string>()

  // ── 第一阶段：快速扫描 home 目录（深度 4，覆盖大多数工具）──
  findSkillsDirs(homeDir, 4, foundPaths)

  // ── 第二阶段：如果第一阶段结果很少，扩大搜索到 ~/Documents ~/Projects 等 ──
  if (foundPaths.size < 2) {
    const extraRoots = ['Documents', 'Projects', 'Workspace', 'workspace', 'dev', 'code', 'repos']
    for (const extra of extraRoots) {
      const p = path.join(homeDir, extra)
      if (fs.existsSync(p)) findSkillsDirs(p, 4, foundPaths)
    }
  }

  // ── 第三阶段：用户手动添加的路径 ──
  const sources: SkillSource[] = []
  const seenResolved = new Set<string>()

  const addSource = (skillsPath: string, labelOverride?: string) => {
    let resolved: string
    try { resolved = fs.realpathSync(skillsPath) } catch { resolved = path.resolve(skillsPath) }

    if (seenResolved.has(resolved)) return
    if (!isValidSkillsDir(resolved)) return
    seenResolved.add(resolved)

    const id = pathToId(resolved)
    sources.push({
      id,
      label: sourceLabels[id] ?? (labelOverride || inferLabel(resolved)),
      path: resolved,
      color: inferColor(resolved),
      skillCount: countSkills(resolved),
    })
  }

  for (const p of foundPaths) addSource(p)

  for (const custom of customPaths) {
    const resolved = path.resolve(custom.path.replace(/^~/, homeDir))
    addSource(resolved)
  }

  // 对重复 label 追加路径区分后缀
  const labelGroups = new Map<string, SkillSource[]>()
  for (const s of sources) {
    if (!labelGroups.has(s.label)) labelGroups.set(s.label, [])
    labelGroups.get(s.label)!.push(s)
  }
  const homeDirName = homeDir.split(path.sep).pop() ?? ''
  for (const group of labelGroups.values()) {
    if (group.length <= 1) continue
    for (const s of group) {
      const parts = s.path.split(path.sep)
      // parts[-1]=skills, parts[-2]=工具目录(.claude), parts[-3]=上下文目录
      const contextDir = parts.length >= 3 ? parts[parts.length - 3] : null
      const suffix = contextDir && contextDir !== homeDirName ? contextDir : '~'
      s.label = `${s.label} · ${suffix}`
    }
  }

  // 按 skillCount 降序，已知工具排前面
  return sources.sort((a, b) => {
    const aKnown = Object.values(KNOWN_TOOLS).some(t => a.label.startsWith(t.label)) ? 1 : 0
    const bKnown = Object.values(KNOWN_TOOLS).some(t => b.label.startsWith(t.label)) ? 1 : 0
    if (aKnown !== bKnown) return bKnown - aKnown
    return b.skillCount - a.skillCount
  })
}
