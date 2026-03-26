import { useApp, useFilteredSkills } from '../context/AppContext'

export function BottomBar() {
  const { state, dispatch } = useApp()
  const filtered = useFilteredSkills()

  const { selectedSlugsWithSource } = state
  const selectedCount = selectedSlugsWithSource.size

  return (
    <div className="flex-shrink-0 border-t border-border bg-panel">
      <div className="flex items-center justify-between px-4 py-3 no-drag">
        <div className="flex items-center gap-3">
          {selectedCount > 0 ? (
            <>
              <span className="text-sm text-gray-400">
                已选 <span className="text-white font-medium">{selectedCount}</span> 个 skill
              </span>
              <button
                onClick={() => dispatch({ type: 'CLEAR_SELECT' })}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                清空
              </button>
            </>
          ) : (
            <span className="text-sm text-gray-600">
              共 {filtered.length} 个 skill{filtered.length !== state.skills.length ? `（已筛选）` : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
