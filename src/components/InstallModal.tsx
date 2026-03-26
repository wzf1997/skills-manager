import { useState, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { api } from '../api'

interface Props {
  initialSourceUrl?: string
  initialSlug?: string
  onClose: () => void
}

export function InstallModal({ initialSourceUrl = '', initialSlug = '', onClose }: Props) {
  const { dispatch } = useApp()
  const [sourceUrl, setSourceUrl] = useState(initialSourceUrl)
  const [skillSlug, setSkillSlug] = useState(initialSlug)
  const [logs, setLogs] = useState<string[]>([])
  const [installing, setInstalling] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  // 自动滚动日志
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !installing) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [installing, onClose])

  // 监听安装进度
  useEffect(() => {
    let unlisten: (() => void) | undefined
    api.onInstallProgress((line) => {
      setLogs(prev => [...prev, line])
    }).then(fn => { unlisten = fn })
    return () => { unlisten?.() }
  }, [])

  const handleInstall = async () => {
    if (!sourceUrl.trim()) return
    setInstalling(true)
    setDone(false)
    setError(null)
    setLogs([`> npx skills add ${sourceUrl}${skillSlug ? ` --skill ${skillSlug}` : ''} -g -y\n`])

    const slug = skillSlug.trim()
    const result = await api.installSkill(sourceUrl.trim(), slug || undefined)
    setInstalling(false)
    setDone(true)
    if (!result.success) {
      setError(result.error ?? '安装失败')
    } else {
      const [sources, newSkills, config] = await Promise.all([
        api.discoverSources(),
        api.scanAllSkills(),
        api.getConfig(),
      ])
      dispatch({ type: 'SET_SOURCES', sources })
      dispatch({ type: 'SET_SKILLS', skills: newSkills })
      dispatch({ type: 'SET_CONFIG', config })
      dispatch({ type: 'SET_TAB', tab: 'local' })
      const hasRecent = (config.recentInstalls ?? []).length > 0
      dispatch({ type: 'SET_ACTIVE_SOURCE', id: hasRecent ? 'recent' : null })
      onClose()
    }
  }

  return (
    <>
      {/* 蒙层 */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => !installing && onClose()}
      />

      {/* 弹窗 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-panel border border-border rounded-xl shadow-2xl w-full max-w-lg flex flex-col"
          style={{ animation: 'fadeInScale 0.18s ease-out' }}>
          {/* 头部 */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="text-base">📦</span>
              <h2 className="text-sm font-semibold text-gray-100">在线安装 Skill</h2>
            </div>
            <button
              onClick={() => !installing && onClose()}
              className="p-1.5 rounded-md text-gray-500 hover:text-gray-200 hover:bg-white/5 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 输入区 */}
          <div className="px-5 py-4 space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">来源 URL <span className="text-gray-600">（GitHub shorthand 或完整链接）</span></label>
              <input
                value={sourceUrl}
                onChange={e => setSourceUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !installing && handleInstall()}
                placeholder="例如：vercel-labs/agent-skills 或 anthropics/skills"
                disabled={installing}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-accent/50 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">指定 Skill 名称 <span className="text-gray-600">（可选，留空安装全部）</span></label>
              <input
                value={skillSlug}
                onChange={e => setSkillSlug(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !installing && handleInstall()}
                placeholder="例如：frontend-design"
                disabled={installing}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 outline-none focus:border-accent/50 disabled:opacity-50"
              />
            </div>
          </div>

          {/* 日志输出 */}
          {logs.length > 0 && (
            <div className="mx-5 mb-3 bg-black/40 rounded-lg border border-border/50 overflow-hidden">
              <div className="px-3 py-1.5 border-b border-border/30 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-gray-500">安装日志</span>
              </div>
              <div className="p-3 max-h-48 overflow-y-auto font-mono text-xs">
                {logs.map((line, i) => (
                  <div key={i} className="text-gray-400 whitespace-pre-wrap leading-5">{line}</div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}

          {/* 状态提示 */}
          {done && !error && (
            <div className="mx-5 mb-3 flex items-center gap-2 text-green-400 text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              安装成功！Skills 已更新到本地。
            </div>
          )}
          {error && (
            <div className="mx-5 mb-3 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* 底部按钮 */}
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
            <button
              onClick={() => !installing && onClose()}
              disabled={installing}
              className="px-4 py-1.5 rounded-lg text-sm text-gray-400 hover:text-gray-200 hover:bg-white/5 border border-border transition-colors disabled:opacity-50"
            >
              {done ? '关闭' : '取消'}
            </button>
            {!done && (
              <button
                onClick={handleInstall}
                disabled={installing || !sourceUrl.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm bg-accent text-white hover:bg-accent/80 transition-colors disabled:opacity-50"
              >
                {installing ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    安装中...
                  </>
                ) : '安装'}
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  )
}
