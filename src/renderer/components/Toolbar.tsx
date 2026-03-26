import { useApp, useFilteredSkills } from '../context/AppContext'

export function Toolbar() {
  const { state, dispatch, refresh } = useApp()
  const filtered = useFilteredSkills()
  const { searchQuery, selectedSlugsWithSource, loading, activeTab } = state

  const filteredKeys = filtered.map(s => s.dirPath)
  const allSelected = filteredKeys.length > 0 && filteredKeys.every(k => selectedSlugsWithSource.has(k))

  const toggleSelectAll = () => {
    if (allSelected) dispatch({ type: 'CLEAR_SELECT' })
    else dispatch({ type: 'SELECT_ALL', keys: filteredKeys })
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-panel/50 flex-shrink-0 no-drag">
      {/* Tab 切换 */}
      <div className="flex items-center bg-surface border border-border rounded-lg overflow-hidden flex-shrink-0">
        <button
          onClick={() => dispatch({ type: 'SET_TAB', tab: 'local' })}
          className={`px-3 py-1.5 text-xs transition-colors ${
            activeTab === 'local' ? 'bg-accent/20 text-accent font-medium' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          🗂 本地
        </button>
        <button
          onClick={() => dispatch({ type: 'SET_TAB', tab: 'hub' })}
          className={`px-3 py-1.5 text-xs transition-colors ${
            activeTab === 'hub' ? 'bg-accent/20 text-accent font-medium' : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          🔥 热榜
        </button>
      </div>

      {/* 本地模式：搜索框 */}
      {activeTab === 'local' && (
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="搜索 skill 名称或描述..."
            value={searchQuery}
            onChange={e => dispatch({ type: 'SET_SEARCH', query: e.target.value })}
            className="w-full bg-surface border border-border rounded-lg pl-9 pr-4 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent/50 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => dispatch({ type: 'SET_SEARCH', query: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {activeTab === 'local' && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* 全选 */}
          <button
            onClick={toggleSelectAll}
            className="text-sm text-gray-400 hover:text-gray-200 whitespace-nowrap transition-colors"
          >
            {allSelected ? '取消全选' : '全选'}
          </button>

          {/* 已选数量 */}
          {selectedSlugsWithSource.size > 0 && (
            <span className="text-sm text-gray-500">
              已选 <span className="text-accent font-medium">{selectedSlugsWithSource.size}</span>
            </span>
          )}
        </div>
      )}

      <div className="flex-1" />

      {/* 安装按钮 */}
      <button
        onClick={() => dispatch({ type: 'SHOW_INSTALL', show: true })}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-accent/20 text-accent hover:bg-accent hover:text-white border border-accent/30 transition-colors flex-shrink-0"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        安装
      </button>

      {/* 刷新 */}
      <button
        onClick={refresh}
        disabled={loading}
        className="p-1.5 rounded-md text-gray-500 hover:text-gray-200 hover:bg-white/5 transition-colors disabled:opacity-40"
        title="刷新"
      >
        <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>
  )
}
