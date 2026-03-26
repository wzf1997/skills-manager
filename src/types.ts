// 共享类型定义（主进程和渲染进程通用）
export interface SkillSource {
  id: string
  label: string
  path: string
  color: string
  skillCount: number
}

export interface SkillMeta {
  slug: string
  name: string
  description: string
  tags: string[]
  source: SkillSource
  dirPath: string
  existsInSources: string[] // 已存在于哪些来源的 id
  fileSizeKB: number
}

export interface AppConfig {
  customSources: Array<{ path: string }>
  sourceLabels?: Record<string, string> // sourceId → custom label
  recentInstalls?: string[]             // 最近安装的 skill dirPath 列表（最新在前）
}

export interface FeaturedSkill {
  slug: string
  name: string
  summary: string
  downloads: number
  stars: number
  category: string
  tags: string[]
  source_url: string
  updated_at: string
}
