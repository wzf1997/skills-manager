import { useState, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { api } from '../api'
import type { SkillSource } from '../types'

function SourceItem({
  source,
  count,
  isActive,
  onClick,
  onRename,
}: {
  source: SkillSource
  count: number
  isActive: boolean
  onClick: () => void
  onRename: (newLabel: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draftLabel, setDraftLabel] = useState(source.label)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setDraftLabel(source.label)
      setTimeout(() => inputRef.current?.select(), 0)
    }
  }, [editing, source.label])

  const commit = () => {
    const trimmed = draftLabel.trim()
    if (trimmed && trimmed !== source.label) {
      onRename(trimmed)
    }
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') setEditing(false)
  }

  return (
    <div
      onDoubleClick={() => setEditing(true)}
      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-sm transition-colors cursor-pointer ${
        isActive
          ? 'bg-accent/20 text-accent font-medium'
          : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
      }`}
      onClick={() => { if (!editing) onClick() }}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: source.color }}
        />
        {editing ? (
          <input
            ref={inputRef}
            value={draftLabel}
            onChange={e => setDraftLabel(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            onClick={e => e.stopPropagation()}
            className="flex-1 min-w-0 bg-white/10 text-gray-100 text-sm rounded px-1 py-0 border border-accent/50 outline-none"
          />
        ) : (
          <span className="truncate" title={`双击重命名: ${source.label}`}>{source.label}</span>
        )}
      </div>
      {!editing && <span className="text-xs opacity-60 flex-shrink-0 ml-1">{count}</span>}
    </div>
  )
}

export function Sidebar() {
  const { state, dispatch } = useApp()
  const { sources, skills, activeSourceId, config } = state

  const totalCount = skills.length
  const recentDirPaths = config?.recentInstalls ?? []
  const recentCount = skills.filter(s => recentDirPaths.includes(s.dirPath)).length

  const handleRename = async (sourceId: string, newLabel: string) => {
    await api.renameSource(sourceId, newLabel)
    // sources:updated 事件会自动刷新
  }

  return (
    <aside className="flex-1 h-full bg-panel flex flex-col overflow-hidden">
      <div className="px-3 pt-10 pb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 mb-1">来源</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
        {/* 全部 */}
        <button
          onClick={() => {
              dispatch({ type: 'SET_ACTIVE_SOURCE', id: null })
              dispatch({ type: 'SET_TAB', tab: 'local' })
            }}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-sm transition-colors ${
            activeSourceId === null
              ? 'bg-accent/20 text-accent font-medium'
              : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gray-500 flex-shrink-0" />
            <span>全部</span>
          </div>
          <span className="text-xs opacity-60">{totalCount}</span>
        </button>

        <div className="my-1 border-t border-border/50" />

        {/* 最近安装 */}
        {recentCount > 0 && (
          <button
            onClick={() => {
              dispatch({ type: 'SET_ACTIVE_SOURCE', id: 'recent' })
              dispatch({ type: 'SET_TAB', tab: 'local' })
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-sm transition-colors ${
              activeSourceId === 'recent'
                ? 'bg-accent/20 text-accent font-medium'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
              <span>最近安装</span>
            </div>
            <span className="text-xs opacity-60">{recentCount}</span>
          </button>
        )}

        <div className="my-1 border-t border-border/50" />

        {sources.map(source => {
          const count = skills.filter(s => s.source.path === source.path).length
          return (
            <SourceItem
              key={source.id}
              source={source}
              count={count}
              isActive={activeSourceId === source.id}
              onClick={() => {
              dispatch({ type: 'SET_ACTIVE_SOURCE', id: source.id })
              dispatch({ type: 'SET_TAB', tab: 'local' })
            }}
              onRename={(newLabel) => handleRename(source.id, newLabel)}
            />
          )
        })}
      </nav>
    </aside>
  )
}
