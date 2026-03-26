import { useApp, useFilteredSkills } from '../context/AppContext'
import { SkillCard } from './SkillCard'

export function SkillGrid() {
  const { state, dispatch } = useApp()
  const filtered = useFilteredSkills()
  const { selectedSlugsWithSource, loading } = state

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600">
        <div className="text-center">
          <svg className="w-8 h-8 animate-spin mx-auto mb-3 text-accent/40" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <p className="text-sm">扫描 Skills...</p>
        </div>
      </div>
    )
  }

  if (filtered.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600">
        <div className="text-center">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-sm">没有找到匹配的 Skill</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="grid grid-cols-3 gap-3 xl:grid-cols-4">
        {filtered.map(skill => {
          const key = skill.dirPath
          return (
            <SkillCard
              key={key}
              skill={skill}
              isSelected={selectedSlugsWithSource.has(key)}
              onToggleSelect={() => dispatch({ type: 'TOGGLE_SELECT', key })}
            />
          )
        })}
      </div>
    </div>
  )
}
