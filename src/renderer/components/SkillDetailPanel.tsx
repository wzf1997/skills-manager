import { useEffect, useState, useRef } from 'react'
import { marked } from 'marked'
import { useApp } from '../context/AppContext'
import type { SkillMeta } from '../../types'

// 配置 marked 安全选项
marked.setOptions({ async: false })

function renderMd(md: string): string {
  const result = marked.parse(md)
  return typeof result === 'string' ? result : ''
}

interface Props {
  skill: SkillMeta
}

export function SkillDetailPanel({ skill }: Props) {
  const { state, dispatch } = useApp()
  const [mdContent, setMdContent] = useState<string | null>(null)
  const [mdLoading, setMdLoading] = useState(false)
  const [copyState, setCopyState] = useState<Record<string, 'idle' | 'loading' | 'done'>>({})
  const panelRef = useRef<HTMLDivElement>(null)

  // 加载 SKILL.md
  useEffect(() => {
    setMdLoading(true)
    setMdContent(null)
    window.electronAPI.readSkillMd(skill.dirPath).then(content => {
      setMdContent(content)
      setMdLoading(false)
    })
  }, [skill.dirPath])

  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch({ type: 'SET_SELECTED_SKILL', skill: null })
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [dispatch])

  const close = () => dispatch({ type: 'SET_SELECTED_SKILL', skill: null })

  const handleCopy = async (targetSourceId: string) => {
    setCopyState(prev => ({ ...prev, [targetSourceId]: 'loading' }))
    const result = await window.electronAPI.copySkill(skill.slug, skill.dirPath, targetSourceId)
    setCopyState(prev => ({ ...prev, [targetSourceId]: result.success ? 'done' : 'idle' }))
    if (result.success) {
      setTimeout(() => setCopyState(prev => ({ ...prev, [targetSourceId]: 'idle' })), 2000)
    }
  }

  const otherSources = state.sources.filter(s => s.id !== skill.source.id)

  return (
    <>
      {/* 蒙层 */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={close}
      />

      {/* 面板 */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 bottom-0 w-[460px] bg-panel border-l border-border z-50 flex flex-col shadow-2xl"
        style={{ animation: 'slideInRight 0.2s ease-out' }}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: skill.source.color }}
            />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-100 truncate">{skill.name || skill.slug}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{skill.source.label}</p>
            </div>
          </div>
          <button
            onClick={close}
            className="flex-shrink-0 p-1.5 rounded-md text-gray-500 hover:text-gray-200 hover:bg-white/5 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tags + 大小 */}
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-border/50 flex-shrink-0 flex-wrap">
          {skill.tags.map(tag => (
            <span key={tag} className="px-2 py-0.5 rounded text-xs bg-white/5 text-gray-400">{tag}</span>
          ))}
          <span className="ml-auto text-xs text-gray-600 flex-shrink-0">{skill.fileSizeKB} KB</span>
        </div>

        {/* MD 内容 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {mdLoading ? (
            <div className="flex items-center justify-center h-32 text-gray-500">
              <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              加载中...
            </div>
          ) : mdContent ? (
            <div
              className="prose-skill"
              dangerouslySetInnerHTML={{ __html: renderMd(mdContent) }}
            />
          ) : (
            <p className="text-gray-500 text-sm">未找到 SKILL.md 文件</p>
          )}
        </div>

        {/* 底部操作 */}
        <div className="border-t border-border flex-shrink-0 px-5 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.electronAPI.openInFinder(skill.dirPath)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-border transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              在 Finder 中打开
            </button>
          </div>
          {otherSources.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1.5">复制到来源：</p>
              <div className="flex flex-wrap gap-1.5">
                {otherSources.map(src => {
                  const st = copyState[src.id] || 'idle'
                  const alreadyExists = skill.existsInSources.includes(src.id)
                  return (
                    <button
                      key={src.id}
                      onClick={() => !alreadyExists && handleCopy(src.id)}
                      disabled={st === 'loading' || alreadyExists}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border transition-colors ${
                        st === 'done'
                          ? 'border-green-500/50 text-green-400 bg-green-500/10'
                          : alreadyExists
                          ? 'border-border text-gray-600 cursor-default'
                          : 'border-border text-gray-400 hover:text-gray-200 hover:border-gray-500 hover:bg-white/5'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: src.color }} />
                      {st === 'loading' ? '...' : st === 'done' ? '✓ 已复制' : alreadyExists ? `${src.label} ✓` : src.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .prose-skill { color: #d1d5db; font-size: 13px; line-height: 1.7; }
        .prose-skill h1 { color: #f3f4f6; font-size: 1.1em; font-weight: 700; margin: 1.2em 0 0.5em; border-bottom: 1px solid #374151; padding-bottom: 0.3em; }
        .prose-skill h2 { color: #e5e7eb; font-size: 1em; font-weight: 600; margin: 1em 0 0.4em; }
        .prose-skill h3 { color: #d1d5db; font-size: 0.95em; font-weight: 600; margin: 0.8em 0 0.3em; }
        .prose-skill p { margin: 0.5em 0; }
        .prose-skill code { background: #1f2937; color: #f9a8d4; padding: 0.1em 0.4em; border-radius: 3px; font-size: 0.85em; font-family: 'Menlo', monospace; }
        .prose-skill pre { background: #1f2937; border: 1px solid #374151; border-radius: 6px; padding: 12px; overflow-x: auto; margin: 0.8em 0; }
        .prose-skill pre code { background: none; color: #e5e7eb; padding: 0; font-size: 0.82em; }
        .prose-skill ul, .prose-skill ol { padding-left: 1.5em; margin: 0.5em 0; }
        .prose-skill li { margin: 0.2em 0; }
        .prose-skill blockquote { border-left: 3px solid #4b5563; padding-left: 1em; color: #9ca3af; margin: 0.5em 0; }
        .prose-skill a { color: #60a5fa; text-decoration: none; }
        .prose-skill a:hover { text-decoration: underline; }
        .prose-skill table { border-collapse: collapse; width: 100%; margin: 0.8em 0; font-size: 0.85em; }
        .prose-skill th, .prose-skill td { border: 1px solid #374151; padding: 6px 10px; text-align: left; }
        .prose-skill th { background: #1f2937; color: #e5e7eb; }
        .prose-skill hr { border: none; border-top: 1px solid #374151; margin: 1em 0; }
      `}</style>
    </>
  )
}
