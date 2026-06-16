import { useState } from 'react'
import { StarRating } from './StarRating'

type RatingModalProps = {
  subject: any
  onClose: () => void
  onSubmit: (rating: number, comment: string) => Promise<void> | void
}

export function RatingModal({ subject, onClose, onSubmit }: RatingModalProps) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('请先选择评分')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      await onSubmit(rating, comment)
      onClose()
    } catch (submitError: any) {
      setError(submitError.message || '提交失败')
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="rating-modal" onClick={event => event.stopPropagation()}>
        <div className="rating-modal-header">
          <span className="rating-modal-title">完结打分</span>
          <button className="rating-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="rating-modal-subject">
          <img src={subject?.images?.medium} className="rating-modal-poster" alt="" />
          <div className="rating-modal-info">
            <div className="rating-modal-name">{subject?.nameCn || subject?.name}</div>
            <div className="rating-modal-meta">{subject?.air_date} · 全{subject?.eps}集</div>
          </div>
        </div>
        <div className="rating-modal-section">
          <div className="rating-modal-label">你的评分</div>
          <div className="rating-modal-stars">
            <StarRating value={rating} onChange={setRating} size={28} />
            <span className="rating-modal-hint">点击星星打分（1-10分）</span>
          </div>
        </div>
        <div className="rating-modal-section">
          <div className="rating-modal-label">吐槽 <span className="rating-modal-label-hint">（选填）</span></div>
          <textarea
            className="rating-modal-comment"
            placeholder="写点什么..."
            value={comment}
            onChange={event => setComment(event.target.value)}
            maxLength={500}
            rows={3}
          />
          <div className="rating-modal-char-count">{comment.length}/500</div>
        </div>
        {error && <div className="rating-modal-error">{error}</div>}
        <div className="rating-modal-actions">
          <button className="rating-modal-skip" onClick={onClose}>跳过</button>
          <button className="rating-modal-submit" onClick={handleSubmit} disabled={submitting || rating === 0}>
            {submitting ? '提交中...' : '确认打分'}
          </button>
        </div>
      </div>
    </div>
  )
}
