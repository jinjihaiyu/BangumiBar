import { useState, useEffect, useRef, useCallback } from 'react'
import './index.css'
import { isAired, calcUnwatchedCount, getNextEpisode, formatAirDate, formatTime } from './utils'

const BGM_CLIENT_ID = 'bgm601969ef220ea48ae'
const BGM_CLIENT_SECRET = 'adcf8bf04974ddcb88e5425e194da65c'
const BGM_REDIRECT_URI = 'bangumibar://auth'
const BGM_API_BASE = 'https://api.bgm.tv'
const BGM_OAUTH_BASE = 'https://bgm.tv'

const SUBJECT_TYPES = [
  { value: 2, label: '动画', icon: '🎬' },
  { value: 1, label: '书籍', icon: '📚' },
  { value: 4, label: '游戏', icon: '🎮' }
]

const CACHE_TTL_MS = 10 * 60 * 1000

// ─── Storage ─────────────────────────────────────────────────────────────────

const storage = {
  get: (key: string) => { try { const d = localStorage.getItem(`bangumibar_${key}`); return d ? JSON.parse(d) : null } catch { return null } },
  set: (key: string, value: any) => { try { localStorage.setItem(`bangumibar_${key}`, JSON.stringify(value)) } catch {} },
  remove: (key: string) => localStorage.removeItem(`bangumibar_${key}`),
  getTokenExpiry: () => { const v = localStorage.getItem('bangumibar_token_expiry'); return v ? parseInt(v) : null },
  setTokenExpiry: (expiresIn: number) => {
    localStorage.setItem('bangumibar_token_expiry', String(Date.now() + expiresIn * 1000 - 60 * 1000))
  },
  getAccessToken: () => storage.get('access_token'),
}

const persistentCache = {
  get: (key: string) => {
    try {
      const raw = localStorage.getItem(`bgmcache_${key}`)
      if (!raw) return null
      const { data, expiry } = JSON.parse(raw)
      if (Date.now() > expiry) { localStorage.removeItem(`bgmcache_${key}`); return null }
      return data
    } catch { return null }
  },
  set: (key: string, data: any, ttl = CACHE_TTL_MS) => {
    try { localStorage.setItem(`bgmcache_${key}`, JSON.stringify({ data, expiry: Date.now() + ttl })) } catch {}
  },
  getEpisodeCache: (subjectId: number) => {
    try {
      const raw = localStorage.getItem(`bgmep_${subjectId}`)
      if (!raw) return null
      const { data, expiry } = JSON.parse(raw)
      if (Date.now() > expiry) { localStorage.removeItem(`bgmep_${subjectId}`); return null }
      return data
    } catch { return null }
  },
  setEpisodeCache: (subjectId: number, data: any, ttl = CACHE_TTL_MS) => {
    try { localStorage.setItem(`bgmep_${subjectId}`, JSON.stringify({ data, expiry: Date.now() + ttl })) } catch {}
  },
  getSubjectCache: (subjectId: number) => {
    try {
      const raw = localStorage.getItem(`bgmsubj_${subjectId}`)
      if (!raw) return null
      const { data, expiry } = JSON.parse(raw)
      if (Date.now() > expiry) { localStorage.removeItem(`bgmsubj_${subjectId}`); return null }
      return data
    } catch { return null }
  },
  setSubjectCache: (subjectId: number, data: any, ttl = CACHE_TTL_MS * 6) => {
    try { localStorage.setItem(`bgmsubj_${subjectId}`, JSON.stringify({ data, expiry: Date.now() + ttl })) } catch {}
  }
}

const episodeCache = new Map<number, { data: any[]; time: number }>()

// ─── API ───────────────────────────────────────────────────────────────────────

const api = {
  getAuthUrl: () => {
    const params = new URLSearchParams({ client_id: BGM_CLIENT_ID, response_type: 'code', redirect_uri: BGM_REDIRECT_URI })
    return `https://bgm.tv/oauth/authorize?${params}`
  },

  getAccessToken: async (code: string) => {
    const resp = await fetch(`${BGM_OAUTH_BASE}/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'BangumiBar/1.0 (Electron)' },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: BGM_CLIENT_ID, client_secret: BGM_CLIENT_SECRET, code, redirect_uri: BGM_REDIRECT_URI })
    })
    const text = await resp.text()
    if (!resp.ok) throw new Error('获取授权失败: ' + text)
    try { return JSON.parse(text) } catch { throw new Error('获取授权失败: ' + text) }
  },

  refreshAccessToken: async (refreshToken: string) => {
    const resp = await fetch(`${BGM_OAUTH_BASE}/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'BangumiBar/1.0 (Electron)' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: BGM_CLIENT_ID, client_secret: BGM_CLIENT_SECRET, refresh_token: refreshToken })
    })
    const text = await resp.text()
    if (!resp.ok) throw new Error('刷新令牌失败: ' + text)
    try { return JSON.parse(text) } catch { throw new Error('刷新令牌失败: ' + text) }
  },

  getMe: async (token: string) => {
    const resp = await fetch(`${BGM_API_BASE}/v0/me`, { headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'BangumiBar/1.0 (Electron)' } })
    if (!resp.ok) throw new Error('获取用户信息失败')
    return resp.json()
  },

  getSubject: async (subjectId: number) => {
    const cached = persistentCache.getSubjectCache(subjectId)
    if (cached) return cached
    const resp = await fetch(`${BGM_API_BASE}/v0/subjects/${subjectId}`, { headers: { 'User-Agent': 'BangumiBar/1.0 (Electron)' } })
    if (!resp.ok) throw new Error('获取条目详情失败')
    const data = await resp.json()
    persistentCache.setSubjectCache(subjectId, data)
    return data
  },

  getCollections: async (token: string, username: string, type: number, subjectType: number) => {
    const limit = 30
    const fetchPage = async (page: number) => {
      const offset = (page - 1) * limit
      const url = `${BGM_API_BASE}/v0/users/${username}/collections?type=${type}&subject_type=${subjectType}&limit=${limit}&offset=${offset}`
      const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'BangumiBar/1.0 (Electron)' } })
      if (!resp.ok) throw new Error('获取收藏列表失败')
      return resp.json()
    }
    const firstPage = await fetchPage(1)
    const total = firstPage.total || 0
    const firstItems = firstPage.data || []
    if (firstItems.length >= total) return firstItems
    const totalPages = Math.ceil(total / limit)
    const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
    const BATCH = 5
    const batches: number[][] = []
    for (let i = 0; i < remainingPages.length; i += BATCH) batches.push(remainingPages.slice(i, i + BATCH))
    const batchResults = await Promise.all(batches.map(batch => Promise.all(batch.map(p => fetchPage(p)))))
    const remainingItems = batchResults.flat().flatMap(r => r.data || [])
    return [...firstItems, ...remainingItems]
  },

  getEpisodes: async (token: string, subjectId: number) => {
    const resp = await fetch(`${BGM_API_BASE}/v0/users/-/collections/${subjectId}/episodes`, {
      headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'BangumiBar/1.0 (Electron)' }
    })
    if (!resp.ok) return []
    const data = await resp.json()
    return (data.data || [])
  },

  updateEpisodeProgress: async (token: string, episodeId: number, status: number = 2) => {
    const resp = await fetch(`${BGM_API_BASE}/v0/users/-/collections/-/episodes/${episodeId}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'BangumiBar/1.0 (Electron)' },
      body: JSON.stringify({ type: status })
    })
    if (!resp.ok && resp.status !== 204) {
      const text = await resp.text()
      throw new Error('更新进度失败: ' + text)
    }
    return true
  },

  updateCollection: async (token: string, subjectId: number, data: { rating?: number; comment?: string; type?: number }) => {
    const resp = await fetch(`${BGM_API_BASE}/v0/users/-/collections/${subjectId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'BangumiBar/1.0 (Electron)' },
      body: JSON.stringify(data)
    })
    if (!resp.ok) { const text = await resp.text(); throw new Error('更新收藏失败: ' + text) }
    return resp.json()
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const showDesktopNotification = (title: string, body: string) => {
  ;(window as any).electronAPI?.showNotification?.(title, body)
}

const getSubjectId = (item: any): number => item.subjectId || item.subject?.id || item.subject_id

// ─── Star Rating ─────────────────────────────────────────────────────────────

function StarRating({ value, onChange, readonly = false, size = 18 }: {
  value: number; onChange?: (v: number) => void; readonly?: boolean; size?: number
}) {
  const [hover, setHover] = useState(-1)
  const displayStars = hover >= 0 ? hover / 2 : value / 2
  const handleClick = (idx: number) => {
    if (!onChange || readonly) return
    const fullVal = idx * 2
    const halfVal = idx * 2 - 1
    if (Math.abs((value || 0) - fullVal) < 0.5) onChange(halfVal)
    else onChange(fullVal)
  }
  return (
    <div className="star-rating" style={{ gap: 3 }}>
      {[1, 2, 3, 4, 5].map(idx => {
        const filledPercent = Math.min(100, Math.max(0, (displayStars - (idx - 1)) * 100))
        return (
          <div key={idx}
            className={`star ${filledPercent > 0 ? 'full' : 'empty'} ${!readonly ? 'interactive' : ''}`}
            style={{ width: size, height: size }}
            onMouseEnter={() => !readonly && setHover(idx * 2)}
            onMouseLeave={() => !readonly && setHover(-1)}
            onClick={() => handleClick(idx)}
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

// ─── Collection Status Edit Modal ─────────────────────────────────────────────

interface StatusEditModalProps {
  subject: any
  subjectType: number
  currentType: number
  currentRating: number
  currentComment: string
  onClose: () => void
  onSubmit: (data: { type?: number; rating?: number; comment?: string }) => void
}

function StatusEditModal({ subject, subjectType, currentType, currentRating, currentComment, onClose, onSubmit }: StatusEditModalProps) {
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
    setSubmitting(true); setError('')
    try {
      await onSubmit({ type: selectedType, rating: rating > 0 ? rating : undefined, comment: comment.trim() || undefined })
      onClose()
    } catch (e: any) {
      setError(e.message || '提交失败'); setSubmitting(false)
    }
  }

  const metaText = isAnime
    ? `${subject?.air_date || ''}${subject?.air_date && subject?.eps ? ' · ' : ''}${subject?.eps ? `全${subject.eps}集` : ''}`
    : subjectType === 1
      ? `${subject?.air_date || ''}${subject?.book?.volume_count ? ` · ${subject.book.volume_count}卷` : ''}`
      : `${subject?.air_date || ''}`

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="status-modal" onClick={e => e.stopPropagation()}>
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
            {statusOptions.map(opt => (
              <button
                key={opt.value}
                className={`status-pill ${selectedType === opt.value ? 'active' : ''}`}
                style={{ '--pill-color': opt.color } as React.CSSProperties}
                onClick={() => setSelectedType(opt.value)}
              >
                {opt.label}
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
          <textarea className="status-modal-comment" placeholder="写点什么..."
            value={comment} onChange={e => setComment(e.target.value)} maxLength={500} rows={2} />
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

// ─── Rating Modal (legacy, kept for animation completion prompt) ───────────────
// DEPRECATED: Use StatusEditModal instead. Kept for backwards compatibility.

function RatingModal({ subject, onClose, onSubmit }: {
  subject: any
  onClose: () => void
  onSubmit: (rating: number, comment: string) => void
}) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (rating === 0) { setError('请先选择评分'); return }
    setSubmitting(true); setError('')
    try { await onSubmit(rating, comment); onClose() }
    catch (e: any) { setError(e.message || '提交失败'); setSubmitting(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="rating-modal" onClick={e => e.stopPropagation()}>
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
          <textarea className="rating-modal-comment" placeholder="写点什么..."
            value={comment} onChange={e => setComment(e.target.value)} maxLength={500} rows={3} />
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

// ─── Anime Card ────────────────────────────────────────────────────────────────

interface AnimeCardProps {
  item: any
  index: number
  expandedCard: number | null
  selectedEpisodes: Set<number>
  isLoggedIn: boolean
  selectedFilter: number
  onToggleCard: (e: React.MouseEvent, item: any) => void
  onMarkEpisode: (subjectId: number, episodeId: number, newType: number) => void
  onBatchMark: (subjectId: number, episodeIds: number[], newType: number) => void
  onOpenSubject: (subjectId: number) => void
  onShowEpisodeMenu: (e: React.MouseEvent, subjectId: number, episodeId: number) => void
  getSelectedEpisodeIds: (subjectId: number) => number[]
  setSelectedEpisodes: React.Dispatch<React.SetStateAction<Set<number>>>
  setHoveredEp: React.Dispatch<React.SetStateAction<{ x: number; y: number; ep: any } | null>>
  onRequestRating: (subject: any) => void
  onUnwatchedUpdate: (subjectId: number, count: number) => void
  unwatchedCounts: Record<number, number>
  onEditStatus: (subject: any, subjectType: number, item: any) => void
  subjectType: number
}

function AnimeCard({
  item, index, expandedCard, selectedEpisodes, selectedFilter,
  onToggleCard, onMarkEpisode, onBatchMark, onOpenSubject, onShowEpisodeMenu,
  getSelectedEpisodeIds, setSelectedEpisodes, setHoveredEp, onRequestRating, onUnwatchedUpdate, unwatchedCounts,
  onEditStatus, subjectType
}: AnimeCardProps) {
  const isAnime = subjectType === 2
  const [subj, setSubj] = useState<any>(null)
  const [eps, setEps] = useState<any[]>([])
  const [loadingEps, setLoadingEps] = useState(false)

  const subjectId = getSubjectId(item)
  const watchedCount = item.ep_status || 0
  const totalEps = item.subject?.eps || item.eps || 0
  const airDate = item.subject?.airDate
  const endDate = item.subject?.endDate
  const isAiredSubject = airDate ? new Date(airDate) <= new Date() : false
  const isEnded = isAiredSubject && !!endDate && new Date(endDate) < new Date()
  const rating = subj?.rating?.score || item.subject?.rating?.score || 0

  const effectiveTotal = totalEps > 0 ? totalEps : eps.length
  let airedEps = effectiveTotal
  if (isAiredSubject && !isEnded && totalEps > 0) {
    const weeksSinceAir = Math.floor((Date.now() - new Date(airDate).getTime()) / (7 * 24 * 60 * 60 * 1000))
    airedEps = Math.min(Math.max(weeksSinceAir + 1, watchedCount), effectiveTotal)
  }
  const displayedUnwatched = unwatchedCounts[subjectId] || 0

  const nextEp = eps.length > 0 ? getNextEpisode(eps) : null
  const nextEpDate = nextEp?.episode?.airdate ? formatAirDate(nextEp.episode.airdate) : ''

  const subjLoadId = useRef(0)
  const epsLoadId = useRef(0)
  useEffect(() => {
    subjLoadId.current++
    const loadId = subjLoadId.current
    const cachedSubj = persistentCache.getSubjectCache(subjectId)
    if (cachedSubj && loadId === subjLoadId.current) setSubj(cachedSubj)
    else {
      api.getSubject(subjectId).then(data => { if (loadId === subjLoadId.current) setSubj(data) }).catch(() => {})
    }
  }, [subjectId])

  useEffect(() => {
    epsLoadId.current++
    const loadId = epsLoadId.current
    const token = storage.getAccessToken()
    if (!token) return
    const memCached = episodeCache.get(subjectId)
    if (memCached && Date.now() - memCached.time < CACHE_TTL_MS) {
      const filtered = memCached.data
      if (loadId === epsLoadId.current) { setEps(filtered); onUnwatchedUpdate(subjectId, calcUnwatchedCount(filtered)) }
      return
    }
    const diskCached = persistentCache.getEpisodeCache(subjectId)
    if (diskCached) {
      episodeCache.set(subjectId, { data: diskCached, time: Date.now() })
      const filtered = diskCached
      if (loadId === epsLoadId.current) { setEps(filtered); onUnwatchedUpdate(subjectId, calcUnwatchedCount(filtered)) }
      return
    }
    if (loadId === epsLoadId.current) setLoadingEps(true)
    api.getEpisodes(token, subjectId).then(data => {
        episodeCache.set(subjectId, { data, time: Date.now() })
        persistentCache.setEpisodeCache(subjectId, data)
        const filtered = data
      if (loadId === epsLoadId.current) { setEps(filtered); onUnwatchedUpdate(subjectId, calcUnwatchedCount(filtered)); setLoadingEps(false) }
    }).catch(() => { if (loadId === epsLoadId.current) setLoadingEps(false) })
  }, [subjectId])

  // Sync episode data from parent when it arrives
  const handleMark = (episodeId: number, newType: number) => {
    setEps(prevEps => {
      const updatedEps = prevEps.map(ep => {
        const id = ep.episode?.id || ep.id
        return id === episodeId ? { ...ep, type: newType, episode: ep.episode ? { ...ep.episode, type: newType } : undefined } : ep
      })
      episodeCache.set(subjectId, { data: updatedEps, time: Date.now() })
      persistentCache.setEpisodeCache(subjectId, updatedEps)
      onUnwatchedUpdate(subjectId, calcUnwatchedCount(updatedEps))

      // Check for last episode + rating prompt
      const total = effectiveTotal > 0 ? effectiveTotal : prevEps.length
      const targetEp = updatedEps.find((ep: any) => (ep.episode?.id || ep.id) === episodeId)
      const epNum = targetEp?.episode?.sort || targetEp?.episode?.ep || targetEp?.sort || targetEp?.ep || 0
      const isLastEp = total > 0 && epNum >= total && newType === 2
      const showEnded = subj?.endDate && new Date(subj.endDate) < new Date()
      if (isLastEp && isEnded && showEnded && subj) {
        onRequestRating(subj)
      }
      return updatedEps
    })
  }

  return (
    <div className={`anime-card ${expandedCard === subjectId ? 'expanded' : ''} ${isEnded ? 'ended' : ''} ${!isAnime ? 'non-anime-card' : ''}`}>
      <img src={item.subject?.images?.medium} className="poster clickable"
        onClick={() => onOpenSubject(subjectId)} title="在Bangumi中查看" alt="" />
      <div className="anime-info">
        <div className="anime-title-row">
          <div className="anime-title">{item.subject?.nameCn || item.subject?.name || '未知'}</div>
          <button className="anime-edit-btn" onClick={(e) => { e.stopPropagation(); onEditStatus(subj || item.subject || item, subjectType, item) }} title="修改状态 · 评分">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </button>
          {rating > 0 && (
            <div className="anime-rating">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <span>{rating.toFixed(1)}</span>
            </div>
          )}
        </div>
        <div className="anime-meta-row">
          <span className="anime-date">{item.subject?.airDate}</span>
          {isEnded && <span className="ended-badge">已完结</span>}
          {isAnime && nextEpDate && !isEnded && <span className="next-ep-date">下一集 {nextEpDate}</span>}
          {!isAnime && item.type && (
            <span className="collection-type-badge" data-type={item.type}>{['', '想看', '看过', '在看', '搁置', '抛弃'][item.type] || ''}</span>
          )}
        </div>
        {isAnime && selectedFilter === 3 && (
          <div className="anime-progress clickable" onClick={e => onToggleCard(e, item)}>
            <span className="progress-icon">▶</span>
            <span className="progress-text">{watchedCount}/{effectiveTotal}集</span>
            {displayedUnwatched > 0 && <span className="unwatched-badge">{displayedUnwatched}集待看</span>}
            {effectiveTotal > 0 && (
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${Math.min(100, (watchedCount / effectiveTotal) * 100)}%` }} />
              </div>
            )}
            <span className="expand-arrow">{expandedCard === subjectId ? '▲' : '▼'}</span>
          </div>
        )}
        {isAnime && selectedFilter === 3 && expandedCard === subjectId && (
          <div className="episode-grid-wrapper" onClick={e => e.stopPropagation()}>
            {selectedEpisodes.size > 0 && (
              <div className="batch-action-bar">
                <span className="batch-count">已选{selectedEpisodes.size}个</span>
                <button className="batch-btn watched" onClick={() => onBatchMark(subjectId, getSelectedEpisodeIds(subjectId), 2)}>看过</button>
                <button className="batch-btn unwatched" onClick={() => onBatchMark(subjectId, getSelectedEpisodeIds(subjectId), 0)}>取消</button>
                <button className="batch-btn cant-continue" onClick={() => onBatchMark(subjectId, getSelectedEpisodeIds(subjectId), 3)}>看不了</button>
                <button className="batch-btn cancel" onClick={() => setSelectedEpisodes(new Set())}>✕</button>
              </div>
            )}
            <div className="episode-grid">
              {loadingEps ? (
                <div className="loading-small">加载中...</div>
              ) : eps.length > 0 ? (
                eps.map(ep => {
                  const epId = ep.episode?.id || ep.id
                  const epNum = ep.episode?.sort || ep.episode?.ep || ep.sort || ep.ep
                  const epName = ep.episode?.nameCn || ep.episode?.name || ''
                  const epAirdate = ep.episode?.airdate || ''
                  const isWatched = ep.type === 2
                  const aired = isAired(epAirdate)
                  const isSelected = selectedEpisodes.has(epId)
                  return (
                    <div key={epId}
                      className={`episode-dot ${isWatched ? 'watched' : ''} ${!isWatched && !aired ? 'not-updated' : ''} ${isSelected ? 'selected' : ''}`}
                      onClick={e => {
                        e.stopPropagation()
                        if (e.shiftKey || e.ctrlKey || e.metaKey) {
                          setSelectedEpisodes(prev => {
                            const next = new Set(prev)
                            if (next.has(epId)) next.delete(epId)
                            else next.add(epId)
                            return next
                          })
                        } else {
                          const nextType = isWatched ? 0 : 2
                          handleMark(epId, nextType)
                          onMarkEpisode(subjectId, epId, nextType)
                        }
                      }}
                      onContextMenu={e => {
                        e.preventDefault(); e.stopPropagation()
                        onShowEpisodeMenu(e, subjectId, epId)
                      }}
                      onMouseEnter={e => {
                        const rect = (e.target as HTMLElement).getBoundingClientRect()
                        const win = window
                        const winOffsetX = win.innerWidth - 360
                        const winOffsetY = win.innerHeight - 540
                        setHoveredEp({
                          x: rect.left - winOffsetX + 24,
                          y: rect.top - winOffsetY + 24,
                          ep: { epNum, epName, epAirdate, isWatched }
                        })
                      }}
                      onMouseLeave={() => setHoveredEp(null)}
                    >
                      {epNum}
                    </div>
                  )
                })
              ) : (
                <div className="loading-small">暂无分集数据</div>
              )}
            </div>
          </div>
        )}

        {selectedFilter === 3 && expandedCard === subjectId && !isAnime && (
          <div className="non-anime-card-actions">
            <button className="card-edit-btn" onClick={() => onEditStatus(subj || item.subject || item, subjectType, item)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              修改状态
            </button>
          </div>
        )}

        {selectedFilter !== 3 && (
          <div className="card-edit-btn-row">
            <button className="card-edit-btn" onClick={() => onEditStatus(subj || item.subject || item, subjectType, item)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              修改状态
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── App ─────────────────────────────────────────────────────────────────────

function App() {
  const [currentPage, setCurrentPage] = useState<'main' | 'settings'>('main')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [username, setUsername] = useState('')
  const [selectedFilter, setSelectedFilter] = useState(3)
  const [selectedSubjectType, setSelectedSubjectType] = useState(2)
  const [error, setError] = useState<string | null>(null)
  const [showManualCode, setShowManualCode] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [expandedCard, setExpandedCard] = useState<number | null>(null)
  const [selectedEpisodes, setSelectedEpisodes] = useState<Set<number>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; subjectId: number; episodeId: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [appSettings, setAppSettings] = useState({ openAtLogin: false, showNotifications: true, hideAfterClick: true })
  const [searchQuery, setSearchQuery] = useState('')
  const [pendingRating, setPendingRating] = useState<any>(null)
  const [statusEditItem, setStatusEditItem] = useState<{ subject: any; subjectType: number; collectionItem: any } | null>(null)
  const [tokenExpired, setTokenExpired] = useState(false)
  const [notificationCount, setNotificationCount] = useState(0)
  const [hoveredEp, setHoveredEp] = useState<{ x: number; y: number; ep: any } | null>(null)
  const [notifications, setNotifications] = useState<Array<{ id: number; type: 'progress' | 'rating'; text: string; time: Date; subjectName: string; subjectId?: number }>>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [searchCorpus, setSearchCorpus] = useState<any[]>([])
  const [unwatchedCounts, setUnwatchedCounts] = useState<Record<number, number>>({})

  const loadIdRef = useRef(0)
  const notifCountRef = useRef(0)

  // ─── Token Management ───────────────────────────────────────────────────────

  const getValidToken = useCallback(async (): Promise<string | null> => {
    let token = storage.getAccessToken()
    if (!token) return null
    const expiry = storage.getTokenExpiry()
    if (expiry && Date.now() > expiry) {
      const refreshToken = storage.get('refresh_token')
      if (refreshToken) {
        try {
          const data = await api.refreshAccessToken(refreshToken)
          storage.set('access_token', data.access_token)
          if (data.refresh_token) storage.set('refresh_token', data.refresh_token)
          if (data.expires_in) storage.setTokenExpiry(data.expires_in)
          token = data.access_token
          setTokenExpired(false)
        } catch {
          storage.remove('access_token'); storage.remove('refresh_token'); storage.remove('user_id')
          setTokenExpired(true); setIsLoggedIn(false); return null
        }
      } else { setTokenExpired(true); return null }
    }
    return token
  }, [])

  // ─── Auth / Init ─────────────────────────────────────────────────────────

  const loadUser = async (token: string) => {
    const currentLoadId = ++loadIdRef.current
    try {
      const userData = await api.getMe(token)
      if (currentLoadId === loadIdRef.current) { setUser(userData); setUsername(userData.username) }
    } catch { logout() }
  }

  const loadCollections = async ({ force = false }: { force?: boolean } = {}) => {
    const token = await getValidToken()
    if (!token || !username) return
    const currentFilter = selectedFilter
    const currentSubjectType = selectedSubjectType
    const cacheKey = `${username}_${currentFilter}_${currentSubjectType}`
    const currentLoadId = ++loadIdRef.current

    const cached = persistentCache.get(cacheKey)
    if (cached && currentLoadId === loadIdRef.current) {
      setCollections(cached)
      setIsLoading(false)
      if (!force) fetchAndUpdate(currentLoadId, token, cacheKey)
      return
    }
    setIsLoading(true); setError(null)
    await fetchAndUpdate(currentLoadId, token, cacheKey)
  }

  const fetchAndUpdate = async (loadId: number, token: string, cacheKey: string) => {
    if (loadId !== loadIdRef.current) return
    try {
      const data = await api.getCollections(token, username, selectedFilter, selectedSubjectType)
      if (loadId !== loadIdRef.current) return
      persistentCache.set(cacheKey, data)
      setCollections(data)
      setIsLoading(false)
    } catch (e: any) {
      if (loadId !== loadIdRef.current) return
      if (e.message?.includes('401')) {
        const refreshed = await getValidToken()
        if (refreshed && loadId === loadIdRef.current) { await fetchAndUpdate(loadId, refreshed, cacheKey); return }
      }
      setError(e.message); setIsLoading(false)
    }
  }

  const [collections, setCollections] = useState<any[]>([])

  const loadSearchCorpus = async () => {
    const token = storage.getAccessToken()
    if (!token || !username) return
    try {
      const [doing, wish] = await Promise.all([
        api.getCollections(token, username, 3, selectedSubjectType),
        api.getCollections(token, username, 1, selectedSubjectType)
      ])
      setSearchCorpus([...doing, ...wish])
    } catch {}
  }

  const checkLogin = async () => {
    const token = await getValidToken()
    if (token) { setIsLoggedIn(true); await loadUser(token); await loadCollections({ force: false }); await loadSearchCorpus() }
  }

  // ─── Filter switch ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isLoggedIn) return
    const cacheKey = `${username}_${selectedFilter}_${selectedSubjectType}`
    const cached = persistentCache.get(cacheKey)
    if (cached) { setCollections(cached); setIsLoading(false) }
    else { setCollections([]); setIsLoading(true); const t = setTimeout(() => loadCollections({ force: true }), 100); return () => clearTimeout(t) }
    // Refresh search corpus for new subject type
    loadSearchCorpus()
  }, [selectedFilter, selectedSubjectType, isLoggedIn, username])

  // ─── Episode actions ───────────────────────────────────────────────────────

  const markEpisode = async (subjectId: number, episodeId: number, newType: number) => {
    const token = await getValidToken()
    if (!token) return
    const typeNames: Record<number, string> = { 0: '取消', 2: '看过', 3: '看不了' }
    showToast(`已设为 ${typeNames[newType]}`)
    if (newType === 2) {
      notifCountRef.current++
      setNotificationCount(notifCountRef.current)
      const colItem = collections.find(c => getSubjectId(c) === subjectId)
      const name = (colItem?.subject?.nameCn || colItem?.subject?.name || '番剧')
      setNotifications(prev => [{
        id: Date.now(),
        type: 'progress',
        text: `第${colItem?.ep_status ? colItem.ep_status + 1 : '?'}集已标记为看过`,
        subjectName: name,
        subjectId,
        time: new Date()
      }, ...prev].slice(0, 50))
      showDesktopNotification('BangumiBar', `《${name}》标记为看过`)
    }
    try { await api.updateEpisodeProgress(token, episodeId, newType) }
    catch { showToast('操作失败') }
  }

  const batchMarkEpisodes = async (subjectId: number, episodeIds: number[], newType: number) => {
    const token = await getValidToken()
    if (!token) return
    const typeNames: Record<number, string> = { 0: '取消', 2: '看过', 3: '看不了' }
    setSelectedEpisodes(new Set())
    showToast(`已批量设为 ${typeNames[newType]}`)
    if (newType === 2) {
      notifCountRef.current += episodeIds.length
      setNotificationCount(notifCountRef.current)
      const colItem = collections.find(c => getSubjectId(c) === subjectId)
      const name = (colItem?.subject?.nameCn || colItem?.subject?.name || '番剧')
      setNotifications(prev => [{
        id: Date.now(),
        type: 'progress',
        text: `批量标记${episodeIds.length}集为看过`,
        subjectName: name,
        subjectId,
        time: new Date()
      }, ...prev].slice(0, 50))
      showDesktopNotification('BangumiBar', `《${name}》批量标记${episodeIds.length}集为看过`)
    }
    try { await Promise.all(episodeIds.map(id => api.updateEpisodeProgress(token, id, newType))) }
    catch { showToast('批量操作失败') }
  }

  const handleRatingSubmit = async (rating: number, comment: string) => {
    const token = await getValidToken()
    if (!token || !pendingRating) return
    await api.updateCollection(token, pendingRating.id, { rating, comment })
    const name = pendingRating.nameCn || pendingRating.name || '番剧'
    setNotifications(prev => [{
      id: Date.now(),
      type: 'rating',
      text: `完结打分 ${rating.toFixed(1)}分${comment ? ` · ${comment}` : ''}`,
      subjectName: name,
      subjectId: pendingRating.id,
      time: new Date()
    }, ...prev].slice(0, 50))
    showToast('评分已提交')
  }

  const handleStatusEdit = async (data: { type?: number; rating?: number; comment?: string }) => {
    const token = await getValidToken()
    if (!token || !statusEditItem) return
    const subjectId = statusEditItem.subject.id
    await api.updateCollection(token, subjectId, data)
    // Invalidate cache to force refresh
    const cacheKey = `${username}_${selectedFilter}_${selectedSubjectType}`
    localStorage.removeItem(`bgmcache_${cacheKey}`)
    // Reload collections
    await loadCollections({ force: true })
    showToast('已更新')
  }

  // ─── UI handlers ─────────────────────────────────────────────────────────

  const showToast = (message: string) => { setToast(message); setTimeout(() => setToast(null), 2000) }

  const showEpisodeMenu = (e: React.MouseEvent, subjectId: number, episodeId: number) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    setContextMenu({ x: rect.left, y: rect.bottom + 4, subjectId, episodeId })
  }

  const getSelectedEpisodeIds = (_subjectId: number): number[] => {
    return [...selectedEpisodes]
  }

  const handleUnwatchedUpdate = (subjectId: number, count: number) => {
    setUnwatchedCounts(prev => {
      if (prev[subjectId] === count) return prev
      return { ...prev, [subjectId]: count }
    })
  }

  const toggleCard = (e: React.MouseEvent, item: any) => {
    e.stopPropagation()
    const subjectId = getSubjectId(item)
    setExpandedCard(prev => prev === subjectId ? null : subjectId)
    setSelectedEpisodes(new Set())
  }

  const openBangumiSubject = (subjectId: number) => {
    ;(window as any).electronAPI?.openExternal?.(`https://bgm.tv/subject/${subjectId}`)
  }

  const openAuthPage = () => {
    ;(window as any).electronAPI?.openExternal?.(api.getAuthUrl()) || window.open(api.getAuthUrl(), '_blank', 'width=500,height=600')
  }

  const handleCallback = async (data: any) => {
    const url = typeof data === 'string' ? data : (data.url || '')
    const code = url.match(/[?&]code=([^&]+)/)?.[1]
    if (!code) { setError('无效的授权码'); return }
    setIsLoading(true)
    try {
      const tokenData = await api.getAccessToken(code)
      storage.set('access_token', tokenData.access_token)
      if (tokenData.refresh_token) storage.set('refresh_token', tokenData.refresh_token)
      if (tokenData.expires_in) storage.setTokenExpiry(tokenData.expires_in)
      setIsLoggedIn(true)
      await loadUser(tokenData.access_token)
      await loadCollections({ force: true })
      await loadSearchCorpus()
    } catch (e: any) { setError('授权失败: ' + e.message) }
    finally { setIsLoading(false) }
  }

  const submitManualCode = () => {
    if (manualCode.trim()) { handleCallback(`bangumibar://auth?code=${manualCode.trim()}`); setShowManualCode(false); setManualCode('') }
  }

  const logout = () => {
    storage.remove('access_token'); storage.remove('refresh_token'); storage.remove('user_id')
    localStorage.removeItem('bangumibar_token_expiry')
    setIsLoggedIn(false); setUser(null); setUsername(''); setCollections([])
    setSearchCorpus([]); setNotifications([])
    notifCountRef.current = 0; setNotificationCount(0)
  }

  const updateAppSettings = (settings: Partial<typeof appSettings>) => {
    const next = { ...appSettings, ...settings }
    setAppSettings(next)
    ;(window as any).electronAPI?.setAppSettings?.(settings).catch(() => {})
  }

  // ─── Filter & sort ────────────────────────────────────────────────────────

  const filteredCollections = searchQuery.trim()
    ? collections.filter(item => {
        const name = item.subject?.nameCn || item.subject?.name || ''
        const nameRaw = item.subject?.name || ''
        const q = searchQuery.toLowerCase()
        return name.toLowerCase().includes(q) || nameRaw.toLowerCase().includes(q)
      })
    : collections

  const searchResults = searchQuery.trim()
    ? searchCorpus.filter(item => {
        const name = item.subject?.nameCn || item.subject?.name || ''
        const nameRaw = item.subject?.name || ''
        const q = searchQuery.toLowerCase()
        return name.toLowerCase().includes(q) || nameRaw.toLowerCase().includes(q)
      })
    : []

  const sortedCollections = [...filteredCollections].sort((a, b) => {
    const aid = getSubjectId(a), bid = getSubjectId(b)
    const aUnwatched = unwatchedCounts[aid] || 0
    const bUnwatched = unwatchedCounts[bid] || 0
    const aEnded = a.subject?.endDate && new Date(a.subject.endDate) < new Date()
    const bEnded = b.subject?.endDate && new Date(b.subject.endDate) < new Date()
    // 1. 有待看 > 无待看
    if ((aUnwatched > 0) !== (bUnwatched > 0)) return aUnwatched > 0 ? -1 : 1
    // 2. 未完结 > 已完结
    if (aEnded !== bEnded) return aEnded ? 1 : -1
    return 0
  })

  // ─── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (window.location.hash === '#settings') setCurrentPage('settings')
    ;(window as any).electronAPI?.onAuthCallback?.(handleCallback)
    checkLogin()
    ;(window as any).electronAPI?.getAppSettings?.().then((s: any) => {
      if (s) setAppSettings(s)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  // ─── Render: Login ───────────────────────────────────────────────────────

  if (!isLoggedIn) {
    return (
      <div className="login-page">
        {tokenExpired && <div className="login-expired-banner"><span>登录已过期，请重新登录</span></div>}
        <div className="login-logo">🎬</div>
        <h1 className="login-title">BangumiBar</h1>
        <p className="login-subtitle">管理你的追番列表</p>
        <button className="login-btn" onClick={openAuthPage} disabled={isLoading}>{isLoading ? '授权中...' : '授权登录'}</button>
        <p className="login-hint">点击后将打开浏览器进行授权</p>
        <button className="login-link" onClick={() => setShowManualCode(true)}>手动输入授权码</button>
        {showManualCode && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>输入授权码</h3>
              <input type="text" placeholder="请输入授权码" value={manualCode}
                onChange={e => setManualCode(e.target.value)} onKeyUp={e => e.key === 'Enter' && submitManualCode()} />
              <div className="modal-buttons">
                <button onClick={() => setShowManualCode(false)}>取消</button>
                <button className="primary" onClick={submitManualCode}>确认</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─── Render: Settings ─────────────────────────────────────────────────────

  if (currentPage === 'settings') {
    return (
      <div className="settings-page">
        <div className="settings-header">
          <h2>设置</h2>
          <button className="header-btn" onClick={() => setCurrentPage('main')}>✕</button>
        </div>
        <div className="settings-content">
          <div className="settings-section">
            <h3>用户</h3>
            <div className="settings-item">
              {user?.avatar?.medium && <img src={user.avatar.medium} className="avatar" alt="" />}
              <div className="settings-item-info">
                <div className="settings-item-text">{user?.nickname || user?.username}</div>
                <div className="settings-item-hint">@{user?.username}</div>
              </div>
            </div>
          </div>
          <div className="settings-section">
            <h3>账号</h3>
            <div className="settings-item" onClick={() => (window as any).electronAPI?.openExternal?.(`https://bgm.tv/${user?.username}`)}>
              <span className="settings-icon">🌐</span>
              <span className="settings-item-text">访问 Bangumi 主页</span>
              <span className="settings-item-hint">↗</span>
            </div>
            <div className="settings-item logout" onClick={logout}>
              <span className="settings-icon">🚪</span>
              <span className="settings-item-text">退出登录</span>
            </div>
          </div>
          <div className="settings-section">
            <h3>系统</h3>
            <div className="settings-item toggle-item" onClick={() => updateAppSettings({ openAtLogin: !appSettings.openAtLogin })}>
              <span className="settings-icon">🚀</span>
              <div className="settings-item-info">
                <div className="settings-item-text">开机自启</div>
                <div className="settings-item-hint">登录时自动启动 BangumiBar</div>
              </div>
              <div className={`toggle-switch ${appSettings.openAtLogin ? 'on' : ''}`}>
                <div className="toggle-knob" />
              </div>
            </div>
            <div className="settings-item toggle-item" onClick={() => updateAppSettings({ showNotifications: !appSettings.showNotifications })}>
              <span className="settings-icon">🔔</span>
              <div className="settings-item-info">
                <div className="settings-item-text">新集提醒</div>
                <div className="settings-item-hint">有新集更新时发送通知</div>
              </div>
              <div className={`toggle-switch ${appSettings.showNotifications ? 'on' : ''}`}>
                <div className="toggle-knob" />
              </div>
            </div>
            <div className="settings-item toggle-item" onClick={() => updateAppSettings({ hideAfterClick: !appSettings.hideAfterClick })}>
              <span className="settings-icon">👆</span>
              <div className="settings-item-info">
                <div className="settings-item-text">点击后隐藏</div>
                <div className="settings-item-hint">点击集数后自动关闭面板</div>
              </div>
              <div className={`toggle-switch ${appSettings.hideAfterClick ? 'on' : ''}`}>
                <div className="toggle-knob" />
              </div>
            </div>
          </div>
          <div className="settings-section">
            <h3>关于</h3>
            <div className="settings-item">
              <span className="settings-icon">📱</span>
              <span className="settings-item-text">版本</span>
              <span className="settings-item-hint">1.0.0</span>
            </div>
          </div>
        </div>
        <div className="settings-footer">BangumiBar · 追番管理工具</div>
      </div>
    )
  }

  // ─── Render: Main ────────────────────────────────────────────────────────

  return (
    <div className="page">
      <div className="header">
        {user?.avatar?.medium && <img src={user.avatar.medium} className="header-avatar" alt="" />}
        <div className="header-info">
          <div className="header-nickname">{user?.nickname || user?.username || '用户'}</div>
          <div className="header-sub">{tokenExpired ? '登录过期' : '在线'}</div>
        </div>
        <div className="header-actions">
          {notificationCount > 0 && (
            <button className="notif-badge-btn" onClick={() => setShowNotifications(v => !v)} title="查看通知">
              {notificationCount > 99 ? '99+' : notificationCount}
            </button>
          )}
          <button className="header-btn" onClick={() => setCurrentPage('settings')}>⚙</button>
        </div>
      </div>

      <div className="search-bar">
        <span className="search-icon">🔍</span>
        <input type="text" className="search-input" placeholder="搜索番剧..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        {searchQuery && <button className="search-clear" onClick={() => setSearchQuery('')}>✕</button>}
      </div>

      <div className="filter-bar">
        {[{ value: 3, label: '在看' }, { value: 1, label: '想看' }].map(f => (
          <button key={f.value} className={`filter-chip ${selectedFilter === f.value ? 'active' : ''}`}
            onClick={() => setSelectedFilter(f.value)}>{f.label}</button>
        ))}
        <div className="filter-spacer" />
        <button className="filter-refresh-btn" onClick={() => loadCollections({ force: true })} title="刷新">↻</button>
        <span className="filter-count">{searchQuery.trim() ? `${searchResults.length}条结果` : `${filteredCollections.length}部`}</span>
      </div>

      <div className="type-bar">
        {SUBJECT_TYPES.map(st => (
          <button key={st.value} className={`type-chip ${selectedSubjectType === st.value ? 'active' : ''}`}
            onClick={() => setSelectedSubjectType(st.value)}>
            <span className="type-icon">{st.icon}</span>
            <span className="type-label">{st.label}</span>
          </button>
        ))}
      </div>

      <div className="content">
        {isLoading && <div className="loading"><div className="spinner" /></div>}
        {!isLoading && error && <div className="empty-state"><div className="empty-title">{error}</div></div>}

        {!isLoading && !error && showNotifications && notifications.length > 0 && (
          <div className="notif-panel">
            <div className="notif-panel-header">
              <span>通知 ({notifications.length})</span>
              <button className="notif-clear" onClick={() => { setNotifications([]); setNotificationCount(0); notifCountRef.current = 0; setShowNotifications(false) }}>清空</button>
            </div>
            <div className="notif-list">
              {notifications.map(n => (
                <div key={n.id} className={`notif-item ${n.type}`} onClick={() => { if (n.subjectId) openBangumiSubject(n.subjectId); setShowNotifications(false) }}>
                  <div className="notif-item-title">
                    {n.type === 'rating' ? '⭐' : '▶'} {n.subjectName}
                  </div>
                  <div className="notif-item-text">{n.text}</div>
                  <div className="notif-item-time">{formatTime(n.time)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isLoading && !error && !showNotifications && searchQuery.trim() && searchResults.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <div className="empty-title">没有找到"{searchQuery}"</div>
            <div className="empty-hint">试试其他关键词</div>
          </div>
        )}

        {!isLoading && !error && !showNotifications && searchQuery.trim() && searchResults.length > 0 && (
          <>
            <div className="search-results-hint">在在看+想看中找到 {searchResults.length} 个结果</div>
            {searchResults.map((item, index) => (
              <AnimeCard
                key={getSubjectId(item) || index}
                item={item}
                index={index}
                expandedCard={expandedCard}
                selectedEpisodes={selectedEpisodes}
                isLoggedIn={isLoggedIn}
                selectedFilter={selectedFilter}
                onToggleCard={toggleCard}
                onMarkEpisode={markEpisode}
                onBatchMark={batchMarkEpisodes}
                onOpenSubject={openBangumiSubject}
                onShowEpisodeMenu={showEpisodeMenu}
                getSelectedEpisodeIds={getSelectedEpisodeIds}
                setSelectedEpisodes={setSelectedEpisodes}
                setHoveredEp={setHoveredEp}
                onRequestRating={setPendingRating}
                onUnwatchedUpdate={handleUnwatchedUpdate}
                unwatchedCounts={unwatchedCounts}
                onEditStatus={(subject, st, colItem) => setStatusEditItem({ subject, subjectType: st, collectionItem: colItem })}
                subjectType={selectedSubjectType}
              />
            ))}
          </>
        )}

        {!isLoading && !error && !showNotifications && !searchQuery.trim() && filteredCollections.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📺</div>
            <div className="empty-title">暂无内容</div>
            <div className="empty-hint">去 Bangumi 添加一些番剧吧</div>
          </div>
        )}

        {!isLoading && !error && !showNotifications && !searchQuery.trim() && sortedCollections.map((item, index) => (
          <AnimeCard
            key={getSubjectId(item) || index}
            item={item}
            index={index}
            expandedCard={expandedCard}
            selectedEpisodes={selectedEpisodes}
            isLoggedIn={isLoggedIn}
            selectedFilter={selectedFilter}
            onToggleCard={toggleCard}
            onMarkEpisode={markEpisode}
            onBatchMark={batchMarkEpisodes}
            onOpenSubject={openBangumiSubject}
            onShowEpisodeMenu={showEpisodeMenu}
            getSelectedEpisodeIds={getSelectedEpisodeIds}
            setSelectedEpisodes={setSelectedEpisodes}
            setHoveredEp={setHoveredEp}
            onRequestRating={setPendingRating}
            onUnwatchedUpdate={handleUnwatchedUpdate}
            unwatchedCounts={unwatchedCounts}
            onEditStatus={(subject, st, colItem) => setStatusEditItem({ subject, subjectType: st, collectionItem: colItem })}
            subjectType={selectedSubjectType}
          />
        ))}
      </div>

      <div className="footer"><span>BangumiBar</span></div>

      {toast && <div className="toast">{toast}</div>}

      {contextMenu && (
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }} onMouseLeave={() => setContextMenu(null)}>
          <div className="context-menu-item" onClick={() => { markEpisode(contextMenu.subjectId, contextMenu.episodeId, 2); setContextMenu(null) }}>
            <span className="menu-dot watched" /> 标记看过
          </div>
          <div className="context-menu-item" onClick={() => { markEpisode(contextMenu.subjectId, contextMenu.episodeId, 0); setContextMenu(null) }}>
            <span className="menu-dot unwatched" /> 取消看过
          </div>
        </div>
      )}

      {hoveredEp && (
        <div className="ep-tooltip"
          style={{ left: hoveredEp.x, top: hoveredEp.y }}
          onMouseEnter={() => setHoveredEp(hoveredEp)}
        >
          <div className="ep-tooltip-title">第{hoveredEp.ep.epNum}集</div>
          {hoveredEp.ep.epName && <div className="ep-tooltip-name">{hoveredEp.ep.epName}</div>}
          {hoveredEp.ep.epAirdate && <div className="ep-tooltip-date">播出: {hoveredEp.ep.epAirdate}</div>}
          <div className="ep-tooltip-status">
            {hoveredEp.ep.isWatched ? '已看' : '未看'}
          </div>
        </div>
      )}

      {pendingRating && (
        <RatingModal subject={pendingRating} onClose={() => setPendingRating(null)} onSubmit={handleRatingSubmit} />
      )}

      {statusEditItem && (
        <StatusEditModal
          subject={statusEditItem.subject}
          subjectType={statusEditItem.subjectType}
          currentType={statusEditItem.collectionItem?.type}
          currentRating={statusEditItem.collectionItem?.rating || statusEditItem.subject?.rating?.score || 0}
          currentComment={statusEditItem.collectionItem?.comment || ''}
          onClose={() => setStatusEditItem(null)}
          onSubmit={handleStatusEdit}
        />
      )}
    </div>
  )
}

export default App
