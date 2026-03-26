import { useEffect } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { Sidebar } from './components/Sidebar'
import { Toolbar } from './components/Toolbar'
import { SkillGrid } from './components/SkillGrid'
import { BottomBar } from './components/BottomBar'
import { SettingsDrawer } from './components/SettingsDrawer'
import { ResizableSidebar } from './components/ResizableSidebar'
import { SkillDetailPanel } from './components/SkillDetailPanel'
import { InstallModal } from './components/InstallModal'
import { HubPanel } from './components/HubPanel'

function AppContent() {
  const { state, dispatch, refresh } = useApp()

  useEffect(() => {
    // 初始化主题
    window.electronAPI.getTheme().then(theme => {
      dispatch({ type: 'SET_THEME', theme })
      document.documentElement.classList.toggle('dark', theme === 'dark')
    })

    // 监听系统主题变化
    const offTheme = window.electronAPI.onThemeChange((_event, theme) => {
      dispatch({ type: 'SET_THEME', theme })
      document.documentElement.classList.toggle('dark', theme === 'dark')
    })

    refresh()

    // 监听来源更新（复制后主进程推送）
    const off = window.electronAPI.onSourcesUpdated((_event, sources) => {
      dispatch({ type: 'SET_SOURCES', sources })
    })

    return () => { off(); offTheme() }
  }, [refresh, dispatch])

  return (
    <div className="flex flex-col h-screen bg-surface overflow-hidden">
      {/* 标题栏 */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-panel border-b border-border flex-shrink-0 drag-region" style={{ paddingLeft: '80px' }}>
        <div className="flex items-center gap-2 no-drag">
          <span className="text-lg">🧩</span>
          <span className="text-sm font-semibold text-gray-200">Skills Manager</span>
          {state.skills.length > 0 && (
            <span className="text-xs text-gray-600 ml-1">{state.skills.length} skills</span>
          )}
        </div>
        <button
          onClick={() => dispatch({ type: 'SHOW_SETTINGS', show: true })}
          className="no-drag flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-border transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          设置
        </button>
      </header>

      {/* 主体 */}
      <div className="flex flex-1 min-h-0">
        <ResizableSidebar>
          <Sidebar />
        </ResizableSidebar>
        <div className="flex flex-col flex-1 min-w-0">
          <Toolbar />
          {state.activeTab === 'local' ? (
            <>
              <SkillGrid />
              <BottomBar />
            </>
          ) : (
            <HubPanel />
          )}
        </div>
      </div>

      <SettingsDrawer />

      {/* 安装弹窗 */}
      {state.showInstall && (
        <InstallModal onClose={() => dispatch({ type: 'SHOW_INSTALL', show: false })} />
      )}

      {/* Skill 详情面板 */}
      {state.selectedSkill && (
        <SkillDetailPanel skill={state.selectedSkill} />
      )}
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
