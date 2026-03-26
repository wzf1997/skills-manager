import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { SkillSource, SkillMeta, AppConfig } from './types'

export interface CopyResult {
  success: boolean
  error?: string
  alreadyExists: boolean
  mode: 'symlink' | 'copy'
}

export const api = {
  discoverSources: (): Promise<SkillSource[]> =>
    invoke('discover_sources'),

  scanAllSkills: (): Promise<SkillMeta[]> =>
    invoke('scan_all_skills'),

  copySkill: (slug: string, sourceDirPath: string, targetSourceId: string): Promise<CopyResult> =>
    invoke('copy_skill', { slug, sourceDirPath, targetSourceId }),

  deleteSkill: (dirPath: string, sourceId: string): Promise<{ success: boolean; error?: string }> =>
    invoke('delete_skill', { dirPath, sourceId }),

  readSkillMd: (dirPath: string): Promise<string | null> =>
    invoke('read_skill_md', { dirPath }),

  openInFinder: (dirPath: string): void => {
    invoke('open_in_finder', { dirPath })
  },

  getConfig: (): Promise<AppConfig> =>
    invoke('get_config'),

  setConfig: (patch: Partial<AppConfig>): Promise<void> =>
    invoke('set_config', { patch }),

  renameSource: (sourceId: string, newLabel: string): Promise<void> =>
    invoke('rename_source', { sourceId, newLabel }),

  installSkill: (sourceUrl: string, skillSlug?: string): Promise<{ success: boolean; error?: string }> =>
    invoke('install_skill', { sourceUrl, skillSlug }),

  onSourcesUpdated: (cb: (sources: SkillSource[]) => void) =>
    listen<SkillSource[]>('sources:updated', e => cb(e.payload)),

  onInstallProgress: (cb: (line: string) => void) =>
    listen<string>('install:progress', e => cb(e.payload)),
}
