import { useEffect, useState } from 'react'
import type { FeaturedSkill } from '../types'
import { InstallModal } from './InstallModal'

type SortKey = 'updated' | 'name'

export function HubPanel() {
  const [skills, setSkills] = useState<FeaturedSkill[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<'all' | 'ai-assistant' | 'development'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('updated')
  const [search, setSearch] = useState('')
  const [installTarget, setInstallTarget] = useState<{ url: string; slug: string } | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    window.electronAPI.fetchFeaturedSkills().then(data => {
      setSkills(data)
      setLoading(false)
    }).catch(() => {
      setError('加载失败，请检查网络连接')
      setLoading(false)
    })
  }, [])

  const filtered = skills
    .filter(s => {
      if (category !== 'all' && s.category !== category) return false
      if (search) {
        const q = search.toLowerCase()
        return s.slug.includes(q) || s.name.toLowerCase().includes(q) || s.summary.toLowerCase().includes(q) || s.tags.some(t => t.toLowerCase().includes(q))
      }
      return true
    })
    .sort((a, b) => {
      if (sortKey === 'updated') {
        const diff = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        return diff !== 0 ? diff : a.slug.localeCompare(b.slug)
      }
      return a.slug.localeCompare(b.slug)
    })

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* 工具栏 */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-panel flex-shrink-0 flex-wrap gap-y-2">
        {/* 搜索 */}
        <div className="relative flex-1 min-w-40">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索热榜 Skills..."
            className="w-full pl-8 pr-3 py-1.5 bg-surface border border-border rounded-lg text-xs text-gray-300 placeholder-gray-600 outline-none focus:border-accent/50"
          />
        </div>

        {/* 分类过滤 */}
        <div className="flex items-center bg-surface border border-border rounded-lg overflow-hidden">
          {(['all', 'ai-assistant', 'development'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 text-xs transition-colors ${
                category === cat
                  ? 'bg-accent/20 text-accent'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {cat === 'all' ? '全部' : cat === 'ai-assistant' ? '🤖 AI 助手' : '💻 开发'}
            </button>
          ))}
        </div>

        {/* 排序 */}
        <select
          value={sortKey}
          onChange={e => setSortKey(e.target.value as SortKey)}
          className="bg-surface border border-border rounded-lg px-2 py-1.5 text-xs text-gray-400 outline-none"
        >
          <option value="updated">🕒 最新更新</option>
          <option value="name">🔤 名称排序</option>
        </select>

        <span className="text-xs text-gray-600 flex-shrink-0">{filtered.length} 个</span>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-500">
            <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm">正在加载热榜数据...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-500">
            <span className="text-2xl">🌐</span>
            <p className="text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-xs text-accent hover:underline"
            >
              重试
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500">
            <span className="text-2xl mb-2">🔍</span>
            <p className="text-sm">没有找到匹配的 Skill</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {filtered.map(skill => (
              <HubSkillCard
                key={`${skill.source_url}-${skill.slug}`}
                skill={skill}
                onInstall={() => setInstallTarget({ url: skill.source_url, slug: skill.slug })}
              />
            ))}
          </div>
        )}
      </div>

      {/* 安装弹窗 */}
      {installTarget && (
        <InstallModal
          initialSourceUrl={installTarget.url}
          initialSlug={installTarget.slug}
          onClose={() => setInstallTarget(null)}
        />
      )}
    </div>
  )
}

function HubSkillCard({ skill, onInstall }: { skill: FeaturedSkill; onInstall: () => void }) {
  const summary = skill.summary.length > 120 ? skill.summary.slice(0, 120) + '...' : skill.summary
  const updatedDate = new Date(skill.updated_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })

  return (
    <div className="bg-panel border border-border rounded-xl p-4 hover:border-gray-600 transition-colors group flex flex-col gap-2">
      {/* 头部 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-gray-100 truncate">{skill.name || skill.slug}</span>
          <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
            skill.category === 'ai-assistant'
              ? 'bg-purple-500/20 text-purple-300'
              : 'bg-blue-500/20 text-blue-300'
          }`}>
            {skill.category === 'ai-assistant' ? 'AI' : 'Dev'}
          </span>
        </div>
      </div>

      {/* 描述 */}
      <p className="text-xs text-gray-400 leading-relaxed flex-1">{summary}</p>

      {/* Tags */}
      {skill.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {skill.tags.slice(0, 3).map(tag => (
            <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-gray-500">{tag}</span>
          ))}
          {skill.tags.length > 3 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-gray-600">+{skill.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* 底部 */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-gray-600">{updatedDate}</span>
        <button
          onClick={onInstall}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-accent/20 text-accent hover:bg-accent hover:text-white transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          安装
        </button>
      </div>
    </div>
  )
}
