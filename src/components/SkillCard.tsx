import { useState, useRef, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { api } from '../api'
import type { SkillMeta } from '../types'

interface ContextMenuState {
  x: number
  y: number
  skill: SkillMeta
}

interface Props {
  skill: SkillMeta
  isSelected: boolean
  onToggleSelect: () => void
}

export function SkillCard({ skill, isSelected, onToggleSelect }: Props) {
  const { state, dispatch, refresh } = useApp()

  const handleCardClick = (e: React.MouseEvent) => {
    // 如果点击的是选择框区域（右上角），则不触发详情
    const target = e.target as HTMLElement
    if (target.closest('[data-select-btn]')) return
    dispatch({ type: 'SET_SELECTED_SKILL', skill })
  }
  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  const [copying, setCopying] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copyToast, setCopyToast] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // 关闭菜单
  useEffect(() => {
    if (!menu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menu])

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY, skill })
  }

  const handleCopyTo = useCallback(async (targetSourceId: string) => {
    setMenu(null)
    setCopying(true)
    try {
      const result = await api.copySkill(skill.slug, skill.dirPath, targetSourceId)
      if (result.success) {
        const label = result.mode === 'symlink' ? '🔗 软链接成功' : '📋 复制成功'
        setCopyToast(label)
        setTimeout(() => setCopyToast(null), 2000)
        await refresh()
      } else {
        alert(`复制失败: ${result.error}`)
      }
    } finally {
      setCopying(false)
    }
  }, [skill, refresh])

  const handleDelete = useCallback(async () => {
    setMenu(null)
    if (!window.confirm(`确认删除 Skill「${skill.slug}」？此操作不可撤销。`)) return
    setDeleting(true)
    try {
      const result = await api.deleteSkill(skill.dirPath, skill.source.id)
      if (result.success) {
        await refresh()
      } else {
        alert(`删除失败: ${result.error}`)
      }
    } finally {
      setDeleting(false)
    }
  }, [skill, refresh])

  const otherSources = state.sources.filter(s => s.id !== skill.source.id)

  const descShort = skill.description.length > 100
    ? skill.description.slice(0, 100) + '…'
    : skill.description

  return (
    <>
      <div
        onContextMenu={handleContextMenu}
        onClick={handleCardClick}
        className={`relative flex flex-col bg-card border rounded-xl p-3.5 cursor-pointer select-none transition-all duration-150 group
          ${isSelected
            ? 'border-accent ring-1 ring-accent/30 bg-accent/5'
            : 'border-border hover:border-gray-600 hover:bg-white/[0.03]'
          }
          ${copying || deleting ? 'opacity-60 pointer-events-none' : ''}
        `}
      >
        {/* 选中勾 */}
        <div
          data-select-btn="true"
          onClick={(e) => { e.stopPropagation(); onToggleSelect() }}
          className={`absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center transition-all z-10
          ${isSelected ? 'bg-accent' : 'bg-transparent border border-border group-hover:border-gray-500'}`}
        >
          {isSelected && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>

        {/* slug 名称 */}
        <div className="pr-7 mb-1">
          <h3 className="text-sm font-semibold text-gray-100 truncate">{skill.slug}</h3>
          {skill.name !== skill.slug && (
            <p className="text-xs text-gray-500 truncate">{skill.name}</p>
          )}
        </div>

        {/* 描述 */}
        {descShort && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 flex-1 mb-2">{descShort}</p>
        )}

        {/* tags */}
        {skill.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {skill.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-white/5 text-gray-500 rounded-md border border-border/50">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* 底部：来源 + 大小 */}
        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: skill.source.color }} />
            <span className="text-[10px] text-gray-600">{skill.source.label}</span>
            {/* 存在于其他来源的标记 */}
            {skill.existsInSources.length > 0 && (
              <span className="text-[10px] text-green-600/70 ml-1" title={`也存在于: ${skill.existsInSources.join(', ')}`}>
                +{skill.existsInSources.length}
              </span>
            )}
          </div>
          <span className="text-[10px] text-gray-700">{skill.fileSizeKB}KB</span>
        </div>

        {copying && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
            <span className="text-xs text-gray-300 animate-pulse">复制中...</span>
          </div>
        )}
        {deleting && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
            <span className="text-xs text-red-400 animate-pulse">删除中...</span>
          </div>
        )}
        {copyToast && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60">
            <span className="text-xs text-green-400 font-medium">{copyToast}</span>
          </div>
        )}
      </div>

      {/* 右键菜单 */}
      {menu && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', left: menu.x, top: menu.y, zIndex: 1000 }}
          className="bg-[#2a2a32] border border-border rounded-xl shadow-2xl py-1 min-w-[180px] overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {otherSources.length > 0 && (
            <>
              <div className="px-3 py-1.5">
                <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">复制到</p>
              </div>
              {otherSources.map(src => {
                const alreadyThere = skill.existsInSources.includes(src.id)
                return (
                  <button
                    key={src.id}
                    onClick={() => handleCopyTo(src.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: src.color }} />
                    <span className="flex-1 text-left">{src.label}</span>
                    {alreadyThere && <span className="text-[10px] text-green-500">已有</span>}
                  </button>
                )
              })}
              <div className="my-1 border-t border-border/50" />
            </>
          )}

          <button
            onClick={() => { api.openInFinder(skill.dirPath); setMenu(null) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            在 Finder 中显示
          </button>

          <div className="my-1 border-t border-border/50" />

          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            删除
          </button>
        </div>
      )}
    </>
  )
}
