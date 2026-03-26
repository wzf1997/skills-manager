import Store from 'electron-store'
import type { AppConfig } from '../types'

const DEFAULT_CONFIG: AppConfig = {
  customSources: [],
  sourceLabels: {},
}

let _store: Store<AppConfig> | null = null

function getStore(): Store<AppConfig> {
  if (!_store) {
    _store = new Store<AppConfig>({
      name: 'skills-manager-config',
      defaults: DEFAULT_CONFIG,
    })
  }
  return _store
}

export function getConfig(): AppConfig {
  return getStore().store
}

export function setConfig(patch: Partial<AppConfig>): void {
  const store = getStore()
  if (patch.customSources !== undefined) {
    store.set('customSources', patch.customSources)
  }
  if (patch.sourceLabels !== undefined) {
    store.set('sourceLabels', patch.sourceLabels)
  }
  if (patch.recentInstalls !== undefined) {
    store.set('recentInstalls', patch.recentInstalls)
  }
}
