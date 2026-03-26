import { useRef, useState, useEffect, ReactNode } from 'react'

const MIN_WIDTH = 140
const MAX_WIDTH = 360
const DEFAULT_WIDTH = 208
const STORAGE_KEY = 'sidebar-width'

interface Props {
  children: ReactNode
}

export function ResizableSidebar({ children }: Props) {
  const [width, setWidth] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? parseInt(stored, 10) : DEFAULT_WIDTH
  })
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(width)

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = e.clientX - startX.current
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta))
      setWidth(next)
    }
    const onMouseUp = () => {
      if (dragging.current) {
        dragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  // 持久化宽度
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(width))
  }, [width])

  const onDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startWidth.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <div className="flex-shrink-0 flex" style={{ width }}>
      <div className="flex-1 min-w-0 overflow-hidden">
        {children}
      </div>
      {/* 拖拽分割线 */}
      <div
        onMouseDown={onDividerMouseDown}
        className="w-1 flex-shrink-0 bg-border hover:bg-accent/50 cursor-col-resize transition-colors"
        title="拖拽调整宽度"
      />
    </div>
  )
}
