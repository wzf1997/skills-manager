import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react'
import type { SkillSource, SkillMeta, AppConfig } from '../types'
import { api } from '../api'

interface State {
  sources: SkillSource[]
  skills: SkillMeta[]
  loading: boolean
  selectedSlugsWithSource: Map<string, string>
  activeSourceId: string | null
  searchQuery: string
  showSettings: boolean
  config: AppConfig | null
  selectedSkill: SkillMeta | null
  showInstall: boolean
  activeTab: 'local' | 'hub'
  theme: 'dark' | 'light'
}

type Action =
  | { type: 'SET_SOURCES'; sources: SkillSource[] }
  | { type: 'SET_SKILLS'; skills: SkillMeta[] }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'TOGGLE_SELECT'; key: string }
  | { type: 'SELECT_ALL'; keys: string[] }
  | { type: 'CLEAR_SELECT' }
  | { type: 'SET_ACTIVE_SOURCE'; id: string | null }
  | { type: 'SET_SEARCH'; query: string }
  | { type: 'SHOW_SETTINGS'; show: boolean }
  | { type: 'SET_CONFIG'; config: AppConfig }
  | { type: 'SET_SELECTED_SKILL'; skill: SkillMeta | null }
  | { type: 'SHOW_INSTALL'; show: boolean }
  | { type: 'SET_TAB'; tab: 'local' | 'hub' }
  | { type: 'SET_THEME'; theme: 'dark' | 'light' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_SOURCES': return { ...state, sources: action.sources }
    case 'SET_SKILLS': return { ...state, skills: action.skills }
    case 'SET_LOADING': return { ...state, loading: action.loading }
    case 'TOGGLE_SELECT': {
      const next = new Map(state.selectedSlugsWithSource)
      if (next.has(action.key)) next.delete(action.key)
      else next.set(action.key, action.key)
      return { ...state, selectedSlugsWithSource: next }
    }
    case 'SELECT_ALL': {
      const next = new Map(state.selectedSlugsWithSource)
      action.keys.forEach(k => next.set(k, k))
      return { ...state, selectedSlugsWithSource: next }
    }
    case 'CLEAR_SELECT': return { ...state, selectedSlugsWithSource: new Map() }
    case 'SET_ACTIVE_SOURCE': return { ...state, activeSourceId: action.id, selectedSlugsWithSource: new Map() }
    case 'SET_SEARCH': return { ...state, searchQuery: action.query }
    case 'SHOW_SETTINGS': return { ...state, showSettings: action.show }
    case 'SET_CONFIG': return { ...state, config: action.config }
    case 'SET_SELECTED_SKILL': return { ...state, selectedSkill: action.skill }
    case 'SHOW_INSTALL': return { ...state, showInstall: action.show }
    case 'SET_TAB': return { ...state, activeTab: action.tab }
    case 'SET_THEME': return { ...state, theme: action.theme }
    default: return state
  }
}

const initialState: State = {
  sources: [],
  skills: [],
  loading: false,
  selectedSlugsWithSource: new Map(),
  activeSourceId: null,
  searchQuery: '',
  showSettings: false,
  config: null,
  selectedSkill: null,
  showInstall: false,
  activeTab: 'local',
  theme: 'dark',
}

const AppContext = createContext<{ state: State; dispatch: React.Dispatch<Action>; refresh: () => void } | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const refresh = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', loading: true })
    try {
      const [config, sources, skills] = await Promise.all([
        api.getConfig(),
        api.discoverSources(),
        api.scanAllSkills(),
      ])
      dispatch({ type: 'SET_SOURCES', sources })
      dispatch({ type: 'SET_SKILLS', skills })
      dispatch({ type: 'SET_CONFIG', config })
    } finally {
      dispatch({ type: 'SET_LOADING', loading: false })
    }
  }, [])

  return (
    <AppContext.Provider value={{ state, dispatch, refresh }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

export function useFilteredSkills() {
  const { state } = useApp()
  const { skills, sources, activeSourceId, searchQuery, config } = state
  const recents = config?.recentInstalls ?? []

  return skills.filter(s => {
    if (activeSourceId === 'recent') {
      // recentInstalls 为空时不过滤（显示全部），避免空列表
      if (recents.length > 0 && !recents.includes(s.dirPath)) return false
    } else {
      const activeSource = sources.find(src => src.id === activeSourceId)
      if (activeSource && s.source.path !== activeSource.path) return false
    }
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return s.slug.includes(q) || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.tags.some(t => t.toLowerCase().includes(q))
  })
}
