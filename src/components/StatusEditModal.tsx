import type { CSSProperties } from 'react'
import { useState } from 'react'
import { StarRating } from './StarRating'

export interface StatusEditModalProps {
  subject: any
  subjectType: number
  currentType: number
  currentRating: number
  currentComment: string
  onClose: () => void
  onSubmit: (data: { type?: number; rating?: number; comment?: string }) => Promise<void> | void
}

export function StatusEditModal({
  subject,
  subjectType,
  currentType,
  currentRating,
  currentComment,
  onClose,
  onSubmit,
}: StatusEditModalProps) {
  const [selectedType, setSelectedType] = useState(currentType || 3)
  const [rating, setRating] = useState(currentRating || 0)
  const [comment, setComment] = useState(currentComment || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const isAnime = subjectType === 2
  const statusOptions = [
    { value: 3, label: '在看', color: 'var(--accent)' },
    { value: 1, label: '想看', color: 'var(--purple)' },
    { value: 2, label: '看过', color: 'var(--green)' },
    { value: 4, label: '搁置', color: 'var(--orange)' },
    { value: 5, label: '抛弃', color: 'var(--red)' },
  ]

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')

    try {
      await onSubmit({
        type: selectedType,
        rating: rating > 0 ? rating : undefined,
        comment: comment.trim() || undefined,
      })
      onClose()
    } catch (submitError: any) {
      setError(submitError.message || '提交失败')
      setSubmitting(false)
    }
  }

  const metaText = isAnime
    ? `${subject?.air_date || ''}${subject?.air_date && subject?.eps ? ' · ' : ''}${subject?.eps ? `全${subject.eps}集` : ''}`
    : subjectType === 1
      ? `${subject?.air_date || ''}${subject?.book?.volume_count ? ` · ${subject.book.volume_count}卷` : ''}`
      : `${subject?.air_date || ''}`

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="status-modal" onClick={event => event.stopPropagation()}>
        <div className="status-modal-header">
          <span className="status-modal-title">修改条目</span>
          <button className="status-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="status-modal-subject">
          <img src={subject?.images?.medium} className="status-modal-poster" alt="" />
          <div className="status-modal-info">
            <div className="status-modal-name">{subject?.nameCn || subject?.name}</div>
            {metaText && <div className="status-modal-meta">{metaText}</div>}
          </div>
        </div>
        <div className="status-modal-section">
          <div className="status-modal-label">收藏状态</div>
          <div className="status-pills">
            {statusOptions.map(option => (
              <button
                key={option.value}
                className={`status-pill ${selectedType === option.value ? 'active' : ''}`}
                style={{ '--pill-color': option.color } as CSSProperties}
                onClick={() => setSelectedType(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="status-modal-section">
          <div className="status-modal-label">评分 <span className="status-modal-label-hint">（选填）</span></div>
          <div className="status-modal-stars">
            <StarRating value={rating} onChange={setRating} size={24} />
            {rating > 0 && <span className="status-modal-score">{rating}分</span>}
          </div>
        </div>
        <div className="status-modal-section">
          <div className="status-modal-label">吐槽 <span className="status-modal-label-hint">（选填）</span></div>
          <textarea
            className="status-modal-comment"
            placeholder="写点什么..."
            value={comment}
            onChange={event => setComment(event.target.value)}
            maxLength={500}
            rows={2}
          />
          <div className="status-modal-char-count">{comment.length}/500</div>
        </div>
        {error && <div className="status-modal-error">{error}</div>}
        <div className="status-modal-actions">
          <button className="status-modal-cancel" onClick={onClose}>取消</button>
          <button className="status-modal-submit" onClick={handleSubmit} disabled={submitting}>
            {submitting ? '提交中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
