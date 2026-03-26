import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import type { SkillMeta, SkillSource } from '../types'

function getDirSizeKB(dirPath: string): number {
  try {
    let total = 0
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        total += getDirSizeKB(full)
      } else {
        total += fs.statSync(full).size
      }
    }
    return Math.round(total / 1024)
  } catch {
    return 0
  }
}

function parseTags(raw: unknown): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(String)
  if (typeof raw === 'string') {
    // "tag1, tag2" or "[tag1, tag2]"
    return raw.replace(/[\[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean)
  }
  return []
}

export function scanSource(source: SkillSource, allSources: SkillSource[]): SkillMeta[] {
  const skills: SkillMeta[] = []

  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(source.path, { withFileTypes: true })
  } catch {
    return skills
  }

  for (const entry of entries) {
    // isDirectory() 对软链接返回 false，需要额外判断
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue
    const slug = entry.name
    const dirPath = path.join(source.path, slug)
    const skillMdPath = path.join(dirPath, 'SKILL.md')

    if (!fs.existsSync(skillMdPath)) continue

    let name = slug
    let description = ''
    let tags: string[] = []

    try {
      const content = fs.readFileSync(skillMdPath, 'utf-8')
      const parsed = matter(content)
      name = parsed.data.name || slug
      description = (parsed.data.description || '').toString().trim()
      tags = parseTags(parsed.data.tags)
    } catch { /* keep defaults */ }

    // 检查该 slug 在哪些其他来源中也存在
    const existsInSources = allSources
      .filter(s => s.id !== source.id && fs.existsSync(path.join(s.path, slug, 'SKILL.md')))
      .map(s => s.id)

    skills.push({
      slug,
      name,
      description: description.slice(0, 300),
      tags,
      source,
      dirPath,
      existsInSources,
      fileSizeKB: getDirSizeKB(dirPath)
    })
  }

  return skills.sort((a, b) => a.slug.localeCompare(b.slug))
}

export function scanAllSources(sources: SkillSource[]): SkillMeta[] {
  const all: SkillMeta[] = []
  for (const source of sources) {
    all.push(...scanSource(source, sources))
  }
  return all
}
