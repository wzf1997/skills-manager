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

  const containerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(width)
  const liveWidth = useRef(width)  // 拖拽中实时宽度，不触发 re-render

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = e.clientX - startX.current
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta))
      liveWidth.current = next
      // 直接操作 DOM，零 React re-render，保持 60fps 流畅
      if (containerRef.current) containerRef.current.style.width = `${next}px`
    }
    const onMouseUp = () => {
      if (!dragging.current) return
      dragging.current = false
      if (overlayRef.current) overlayRef.current.style.display = 'none'
      // 拖拽结束才同步 React state（仅一次 re-render）
      setWidth(liveWidth.current)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(width))
  }, [width])

  const onDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startWidth.current = width
    liveWidth.current = width
    if (overlayRef.current) overlayRef.current.style.display = 'block'
  }

  return (
    <div ref={containerRef} className="flex-shrink-0 flex" style={{ width }}>
      <div className="flex-1 min-w-0 overflow-hidden">
        {children}
      </div>
      {/* 拖拽分割线 */}
      <div
        onMouseDown={onDividerMouseDown}
        className="w-1 flex-shrink-0 bg-border hover:bg-accent/50 cursor-col-resize transition-colors"
        title="拖拽调整宽度"
      />
      {/* 拖拽遮罩（常驻 DOM，display 切换避免挂载开销）：
          1. 捕获全部鼠标事件，防止文本选中
          2. no-drag 阻止 Tauri drag-region 区域吞噬 mouseup */}
      <div
        ref={overlayRef}
        className="no-drag"
        style={{
          display: 'none',
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          cursor: 'col-resize',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        } as React.CSSProperties}
      />
    </div>
  )
}
