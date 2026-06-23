'use client'

import { useState, useRef, useEffect } from 'react'
import { Info } from 'lucide-react'

interface InfoHintProps {
  /** 툴팁에 표시할 문구 */
  text: string
  className?: string
  /** 스크린리더용 라벨 (기본: text) */
  ariaLabel?: string
}

/**
 * 인포(ⓘ) 아이콘 + 툴팁 고지 컴포넌트.
 * 마우스 hover, 키보드 focus, 모바일 tap(클릭 토글) 모두에서 열려 — 모든 사용자에게 고지가 노출된다.
 * 클릭 이벤트는 전파를 막아 상위 클릭 영역(카드/행 선택)을 트리거하지 않는다.
 */
export function InfoHint({ text, className, ariaLabel }: InfoHintProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocPointer = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocPointer)
    document.addEventListener('touchstart', onDocPointer)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocPointer)
      document.removeEventListener('touchstart', onDocPointer)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  return (
    <span ref={ref} className={`relative inline-flex items-center ${className || ''}`}>
      <button
        type="button"
        aria-label={ariaLabel || text}
        className="inline-flex items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          setOpen((o) => !o)
        }}
      >
        <Info size={13} />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-[11px] font-normal text-foreground shadow-xl"
        >
          {text}
        </span>
      )}
    </span>
  )
}
