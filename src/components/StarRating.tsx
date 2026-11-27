import { useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'

type StarRatingProps = {
  value: number
  onChange?: (value: number) => void
  readonly?: boolean
  size?: number
  compact?: boolean
}

// Bangumi 官方 1~10 分评价语义，仅在交互打分时轻量提示
const BANGUMI_SCORE_LABELS: Record<number, string> = {
  1: '不忍直视',
  2: '很差',
  3: '差',
  4: '较差',
  5: '不过不失',
  6: '还行',
  7: '推荐',
  8: '力荐',
  9: '神作',
  10: '超神作',
}

export function StarRating({ value, onChange, readonly = false, size = 18, compact = false }: StarRatingProps) {
  const [hoverScore, setHoverScore] = useState<number | null>(null)
  const [poppedIndex, setPoppedIndex] = useState<number | null>(null)
  const isDraggingRef = useRef(false)
  const popTimerRef = useRef<number | null>(null)

  const activeScore = hoverScore !== null ? hoverScore : value
  const displayStars = activeScore / 2
  const activeStarIndex = hoverScore !== null ? Math.ceil(hoverScore / 2) : null

  const resolveScoreFromPointer = (event: MouseEvent<HTMLDivElement>, index: number): number => {
    const rect = event.currentTarget.getBoundingClientRect()
    const isLeftHalf = event.clientX - rect.left < rect.width / 2
    return isLeftHalf ? index * 2 - 1 : index * 2
  }

  const triggerPop = (index: number) => {
    if (popTimerRef.current) window.clearTimeout(popTimerRef.current)
    setPoppedIndex(index)
    popTimerRef.current = window.setTimeout(() => setPoppedIndex(null), 260)
  }

  const commitScore = (nextScore: number, index: number, allowToggleClear = false) => {
    if (!onChange || readonly) return
    if (allowToggleClear && nextScore === value) {
      onChange(0)
      return
    }
    onChange(nextScore)
    triggerPop(index)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (readonly || !onChange) return
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault()
      const next = Math.min(10, (value || 0) + 1)
      onChange(next)
      triggerPop(Math.ceil(next / 2))
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault()
      const next = Math.max(0, (value || 0) - 1)
      onChange(next)
      if (next > 0) triggerPop(Math.ceil(next / 2))
    } else if (event.key === 'Backspace' || event.key === '0') {
      event.preventDefault()
      onChange(0)
    }
  }

  const formattedScore = Number.isInteger(activeScore) ? String(activeScore) : activeScore.toFixed(1)
  const scoreLabel = !readonly && !compact && activeScore > 0 ? BANGUMI_SCORE_LABELS[Math.round(activeScore)] : ''

  return (
    <div
      className={`star-rating ${compact ? 'compact' : ''} ${!readonly ? 'is-interactive' : ''}`}
      style={{ gap: compact ? 1.5 : 3 }}
      role={readonly ? undefined : 'slider'}
      tabIndex={readonly ? undefined : 0}
      aria-label={readonly ? undefined : '评分'}
      aria-valuemin={readonly ? undefined : 0}
      aria-valuemax={readonly ? undefined : 10}
      aria-valuenow={readonly ? undefined : value}
      onKeyDown={handleKeyDown}
      onMouseLeave={() => {
        isDraggingRef.current = false
        if (!readonly) setHoverScore(null)
      }}
      onMouseUp={() => {
        isDraggingRef.current = false
      }}
    >
      {[1, 2, 3, 4, 5].map(index => {
        const filledPercent = Math.min(100, Math.max(0, (displayStars - (index - 1)) * 100))
        const isHoveredTarget = !readonly && activeStarIndex === index
        const isPopped = poppedIndex === index

        return (
          <div
            key={index}
            className={`star ${filledPercent > 0 ? 'full' : 'empty'} ${!readonly ? 'interactive' : ''} ${isHoveredTarget ? 'hovered' : ''} ${isPopped ? 'popped' : ''}`}
            style={{ width: size, height: size }}
            onMouseMove={event => {
              if (readonly) return
              const score = resolveScoreFromPointer(event, index)
              setHoverScore(score)
              if (isDraggingRef.current && score !== value) {
                onChange?.(score)
              }
            }}
            onMouseDown={event => {
              if (readonly) return
              event.preventDefault()
              isDraggingRef.current = true
              const score = resolveScoreFromPointer(event, index)
              setHoverScore(score)
              commitScore(score, index, true)
            }}
          >
            <svg className="star-bg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <div className="star-fill-wrapper" style={{ width: `${filledPercent}%` }}>
              <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
          </div>
        )
      })}
      {activeScore > 0 && (
        <span className={`star-score ${compact ? 'compact' : ''} ${hoverScore !== null ? 'previewing' : ''}`}>
          {formattedScore}
          {scoreLabel && <span className="star-score-label">{scoreLabel}</span>}
        </span>
      )}
    </div>
  )
}
