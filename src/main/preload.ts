import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import type { SkillSource, SkillMeta, AppConfig, FeaturedSkill } from '../types'

export type ElectronAPI = {
  discoverSources: () => Promise<SkillSource[]>
  scanAllSkills: () => Promise<SkillMeta[]>
  copySkill: (slug: string, sourceDirPath: string, targetSourceId: string) => Promise<{ success: boolean; error?: string; alreadyExists: boolean; mode: 'symlink' | 'copy' }>
  deleteSkill: (dirPath: string, sourceId: string) => Promise<{ success: boolean; error?: string }>
  openInFinder: (dirPath: string) => void
  getConfig: () => Promise<AppConfig>
  setConfig: (patch: Partial<AppConfig>) => Promise<void>
  onSourcesUpdated: (cb: (event: IpcRendererEvent, sources: SkillSource[]) => void) => () => void
  readSkillMd: (dirPath: string) => Promise<string | null>
  renameSource: (sourceId: string, newLabel: string) => Promise<void>
  installSkill: (sourceUrl: string, skillSlug?: string) => Promise<{ success: boolean; error?: string }>
  onInstallProgress: (cb: (event: IpcRendererEvent, line: string) => void) => () => void
  fetchFeaturedSkills: () => Promise<FeaturedSkill[]>
  getTheme: () => Promise<'dark' | 'light'>
  onThemeChange: (cb: (event: IpcRendererEvent, theme: 'dark' | 'light') => void) => () => void
}

const api: ElectronAPI = {
  discoverSources: () => ipcRenderer.invoke('skills:discover'),
  scanAllSkills: () => ipcRenderer.invoke('skills:scanAll'),
  copySkill: (slug, sourceDirPath, targetSourceId) =>
    ipcRenderer.invoke('skills:copy', slug, sourceDirPath, targetSourceId),
  deleteSkill: (dirPath, sourceId) =>
    ipcRenderer.invoke('skills:delete', dirPath, sourceId),
  openInFinder: (dirPath) => ipcRenderer.send('shell:openInFinder', dirPath),
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (patch) => ipcRenderer.invoke('config:set', patch),
  onSourcesUpdated: (cb) => {
    ipcRenderer.on('sources:updated', cb)
    return () => ipcRenderer.removeListener('sources:updated', cb)
  },
  readSkillMd: (dirPath) => ipcRenderer.invoke('skills:readMd', dirPath),
  renameSource: (sourceId, newLabel) => ipcRenderer.invoke('sources:rename', sourceId, newLabel),
  installSkill: (sourceUrl, skillSlug) => ipcRenderer.invoke('skills:install', sourceUrl, skillSlug),
  onInstallProgress: (cb) => {
    ipcRenderer.on('install:progress', cb)
    return () => ipcRenderer.removeListener('install:progress', cb)
  },
  fetchFeaturedSkills: () => ipcRenderer.invoke('hub:fetchFeatured'),
  getTheme: () => ipcRenderer.invoke('theme:get'),
  onThemeChange: (cb) => {
    ipcRenderer.on('theme:changed', cb)
    return () => ipcRenderer.removeListener('theme:changed', cb)
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)
