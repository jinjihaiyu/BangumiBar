import { useState } from 'react'

type StarRatingProps = {
  value: number
  onChange?: (value: number) => void
  readonly?: boolean
  size?: number
}

export function StarRating({ value, onChange, readonly = false, size = 18 }: StarRatingProps) {
  const [hover, setHover] = useState(-1)
  const displayStars = hover >= 0 ? hover / 2 : value / 2

  const handleClick = (index: number) => {
    if (!onChange || readonly) return

    const fullValue = index * 2
    const halfValue = index * 2 - 1
    if (Math.abs((value || 0) - fullValue) < 0.5) onChange(halfValue)
    else onChange(fullValue)
  }

  return (
    <div className="star-rating" style={{ gap: 3 }}>
      {[1, 2, 3, 4, 5].map(index => {
        const filledPercent = Math.min(100, Math.max(0, (displayStars - (index - 1)) * 100))
        return (
          <div key={index}
            className={`star ${filledPercent > 0 ? 'full' : 'empty'} ${!readonly ? 'interactive' : ''}`}
            style={{ width: size, height: size }}
            onMouseEnter={() => !readonly && setHover(index * 2)}
            onMouseLeave={() => !readonly && setHover(-1)}
            onClick={() => handleClick(index)}
          >
            <div className="star-fill-wrapper" style={{ width: `${filledPercent}%` }}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
            <svg className="star-bg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
        )
      })}
      {value > 0 && <span className="star-score">{value.toFixed(1)}</span>}
    </div>
  )
}
