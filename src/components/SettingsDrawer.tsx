import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { api } from '../api'
import type { AppConfig } from '../types'

export function SettingsDrawer() {
  const { state, dispatch, refresh } = useApp()
  const { showSettings, config } = state

  const [customPath, setCustomPath] = useState('')

  const addCustomSource = async () => {
    if (!customPath.trim()) return
    const existing = config?.customSources || []
    const next = [...existing, { path: customPath.trim() }]
    await api.setConfig({ customSources: next })
    setCustomPath('')
    await refresh()
  }

  const removeCustomSource = async (idx: number) => {
    const existing = config?.customSources || []
    const next = existing.filter((_, i) => i !== idx)
    await api.setConfig({ customSources: next })
    await refresh()
  }

  if (!showSettings) return null

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={() => dispatch({ type: 'SHOW_SETTINGS', show: false })}
      />

      {/* 抽屉 */}
      <div className="fixed right-0 top-0 bottom-0 w-96 bg-panel border-l border-border z-50 flex flex-col shadow-2xl">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border drag-region">
          <h2 className="text-base font-semibold text-gray-100">⚙ 设置</h2>
          <button
            onClick={() => dispatch({ type: 'SHOW_SETTINGS', show: false })}
            className="no-drag text-gray-500 hover:text-gray-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 no-drag">
          {/* 来源目录 */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">自定义 Skills 来源</h3>

            {/* 已发现的来源（只读展示） */}
            <div className="space-y-1.5 mb-3">
              {state.sources.map(src => (
                <div key={src.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-surface/50">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: src.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-300">{src.label}</p>
                    <p className="text-[10px] text-gray-600 truncate">{src.path}</p>
                  </div>
                  <span className="text-[10px] text-gray-600">{src.skillCount}</span>
                </div>
              ))}
            </div>

            {/* 手动添加 */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customPath}
                onChange={e => setCustomPath(e.target.value)}
                placeholder="/path/to/your/skills"
                className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent/50"
              />
              <button
                onClick={addCustomSource}
                disabled={!customPath.trim()}
                className="px-3 py-2 text-sm rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-40 transition-colors border border-border"
              >
                添加
              </button>
            </div>

            {/* 自定义来源列表 */}
            {(config?.customSources || []).length > 0 && (
              <div className="mt-2 space-y-1">
                {(config?.customSources || []).map((src, idx) => (
                  <div key={idx} className="flex items-center gap-2 py-1 px-2 rounded-lg bg-surface/30">
                    <span className="text-xs text-gray-400 flex-1 truncate">{src.path}</span>
                    <button
                      onClick={() => removeCustomSource(idx)}
                      className="text-gray-600 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  )
}
