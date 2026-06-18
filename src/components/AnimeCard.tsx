import { useEffect, useRef, useState, type Dispatch, type MouseEvent, type SetStateAction } from 'react'
import { api } from '../app/services/bangumi-service'
import { CACHE_TTL_MS, episodeCache, persistentCache, storage } from '../app/services/cache-service'
import { calcUnwatchedCount, filterMainStoryEpisodes, formatAirDate, getEpisodeNumber, getNextEpisode, isAired } from '../utils'

type HoveredEpisode = { x: number; y: number; ep: any } | null

export interface AnimeCardProps {
  item: any
  index: number
  expandedCard: number | null
  isLoggedIn: boolean
  selectedFilter: number
  onToggleCard: (event: MouseEvent, item: any) => void
  onMarkEpisode: (subjectId: number, episodeId: number, newType: number) => void
  onOpenSubject: (subjectId: number) => void
  onShowEpisodeMenu: (event: MouseEvent, subjectId: number, episodeId: number) => void
  setHoveredEp: Dispatch<SetStateAction<HoveredEpisode>>
  onUnwatchedUpdate: (subjectId: number, count: number) => void
  unwatchedCounts: Record<number, number>
  onEditStatus: (subject: any, subjectType: number, item: any) => void
  subjectType: number
}

const EP_TOOLTIP_WIDTH = 180
const EP_TOOLTIP_HEIGHT = 92
const EP_TOOLTIP_GAP = 10
const EP_TOOLTIP_MARGIN = 8

function getSubjectId(item: any): number {
  return item.subjectId || item.subject?.id || item.subject_id
}

export function AnimeCard({
  item,
  index: _index,
  expandedCard,
  selectedFilter,
  onToggleCard,
  onMarkEpisode,
  onOpenSubject,
  onShowEpisodeMenu,
  setHoveredEp,
  onUnwatchedUpdate,
  unwatchedCounts,
  onEditStatus,
  subjectType,
}: AnimeCardProps) {
  const isAnime = subjectType === 2
  const [subject, setSubject] = useState<any>(null)
  const [episodes, setEpisodes] = useState<any[]>([])
  const [loadingEpisodes, setLoadingEpisodes] = useState(false)

  const subjectId = getSubjectId(item)
  const watchedCount = item.ep_status || 0
  const totalEpisodes = item.subject?.eps || item.eps || 0
  const airDate = item.subject?.airDate
  const endDate = item.subject?.endDate
  const isAiredSubject = airDate ? new Date(airDate) <= new Date() : false
  const isEnded = isAiredSubject && !!endDate && new Date(endDate) < new Date()
  const rating = subject?.rating?.score || item.subject?.rating?.score || 0

  const effectiveTotal = totalEpisodes > 0 ? totalEpisodes : episodes.length
  const displayedUnwatched = unwatchedCounts[subjectId] || 0
  const nextEpisode = episodes.length > 0 ? getNextEpisode(episodes) : null
  const nextEpisodeDate = nextEpisode?.episode?.airdate ? formatAirDate(nextEpisode.episode.airdate) : ''

  const subjectLoadId = useRef(0)
  const episodeLoadId = useRef(0)

  useEffect(() => {
    subjectLoadId.current++
    const loadId = subjectLoadId.current
    const cachedSubject = persistentCache.getSubjectCache(subjectId)

    if (cachedSubject && loadId === subjectLoadId.current) {
      setSubject(cachedSubject)
      return
    }

    api.getSubject(subjectId).then(data => {
      if (loadId === subjectLoadId.current) {
        setSubject(data)
      }
    }).catch(() => {})
  }, [subjectId])

  useEffect(() => {
    episodeLoadId.current++
    const loadId = episodeLoadId.current
    const token = storage.getAccessToken()
    if (!token) return

    const memoryCached = episodeCache.get(subjectId)
    if (memoryCached && Date.now() - memoryCached.time < CACHE_TTL_MS) {
      const filtered = filterMainStoryEpisodes(memoryCached.data)
      if (loadId === episodeLoadId.current) {
        setEpisodes(filtered)
        onUnwatchedUpdate(subjectId, calcUnwatchedCount(filtered))
      }
      return
    }

    const diskCached = persistentCache.getEpisodeCache(subjectId)
    if (diskCached) {
      const filtered = filterMainStoryEpisodes(diskCached)
      episodeCache.set(subjectId, { data: filtered, time: Date.now() })
      persistentCache.setEpisodeCache(subjectId, filtered)
      if (loadId === episodeLoadId.current) {
        setEpisodes(filtered)
        onUnwatchedUpdate(subjectId, calcUnwatchedCount(filtered))
      }
      return
    }

    if (loadId === episodeLoadId.current) {
      setLoadingEpisodes(true)
    }

    api.getEpisodes(token, subjectId).then(data => {
      const filtered = filterMainStoryEpisodes(data)
      episodeCache.set(subjectId, { data: filtered, time: Date.now() })
      persistentCache.setEpisodeCache(subjectId, filtered)

      if (loadId === episodeLoadId.current) {
        setEpisodes(filtered)
        onUnwatchedUpdate(subjectId, calcUnwatchedCount(filtered))
        setLoadingEpisodes(false)
      }
    }).catch(() => {
      if (loadId === episodeLoadId.current) {
        setLoadingEpisodes(false)
      }
    })
  }, [onUnwatchedUpdate, subjectId])

  // 卡片内部先做乐观更新，保持分集点击后的即时反馈。
  const handleMark = (episodeId: number, newType: number) => {
    let shouldOpenStatusEdit = false
    let subjectForEdit: any = null
    let collectionItemForEdit: any = null

    setEpisodes(prevEpisodes => {
      const updatedEpisodes = prevEpisodes.map(episode => {
        const id = episode.episode?.id || episode.id
        return id === episodeId
          ? { ...episode, type: newType, episode: episode.episode ? { ...episode.episode, type: newType } : undefined }
          : episode
      })

      episodeCache.set(subjectId, { data: updatedEpisodes, time: Date.now() })
      persistentCache.setEpisodeCache(subjectId, updatedEpisodes)
      onUnwatchedUpdate(subjectId, calcUnwatchedCount(updatedEpisodes))

      const total = effectiveTotal > 0 ? effectiveTotal : prevEpisodes.length
      const targetEpisode = updatedEpisodes.find((episode: any) => (episode.episode?.id || episode.id) === episodeId)
      const episodeNumber = getEpisodeNumber(targetEpisode)
      const isLastEpisode = total > 0 && episodeNumber >= total && newType === 2
      const allMainEpisodesCompleted = updatedEpisodes.length > 0 && updatedEpisodes.every((episode: any) => episode.type === 2)
      const hasUpcomingMainEpisode = getNextEpisode(updatedEpisodes) !== null

      if (isLastEpisode && allMainEpisodesCompleted && !hasUpcomingMainEpisode) {
        shouldOpenStatusEdit = true
        subjectForEdit = subject || item.subject || item
        collectionItemForEdit = { ...item, type: 2 }
      }

      return updatedEpisodes
    })

    if (shouldOpenStatusEdit && subjectForEdit) {
      onEditStatus(subjectForEdit, subjectType, collectionItemForEdit)
    }
  }

  return (
    <div className={`anime-card ${expandedCard === subjectId ? 'expanded' : ''} ${isEnded ? 'ended' : ''} ${!isAnime ? 'non-anime-card' : ''}`}>
      <img
        src={item.subject?.images?.medium}
        className="poster clickable"
        onClick={() => onOpenSubject(subjectId)}
        title="在Bangumi中查看"
        alt=""
      />
      <div className="anime-info">
        <div className="anime-title-row">
          <div className="anime-title">{item.subject?.nameCn || item.subject?.name || '未知'}</div>
          <button
            className="anime-edit-btn"
            onClick={event => {
              event.stopPropagation()
              onEditStatus(subject || item.subject || item, subjectType, item)
            }}
            title="修改状态 · 评分"
          >
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
          {isAnime && nextEpisodeDate && !isEnded && <span className="next-ep-date">下一集 {nextEpisodeDate}</span>}
          {!isAnime && item.type && (
            <span className="collection-type-badge" data-type={item.type}>{['', '想看', '看过', '在看', '搁置', '抛弃'][item.type] || ''}</span>
          )}
        </div>
        {isAnime && selectedFilter === 3 && (
          <div className="anime-progress clickable" onClick={event => onToggleCard(event, item)}>
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
          <div className="episode-grid-wrapper" onClick={event => event.stopPropagation()}>
            <div className="episode-grid">
              {loadingEpisodes ? (
                <div className="loading-small">加载中...</div>
              ) : episodes.length > 0 ? (
                episodes.map(episode => {
                  const episodeId = episode.episode?.id || episode.id
                  const episodeNumber = getEpisodeNumber(episode)
                  const episodeName = episode.episode?.nameCn || episode.episode?.name || ''
                  const episodeAirdate = episode.episode?.airdate || ''
                  const isWatched = episode.type === 2
                  const aired = isAired(episodeAirdate)

                  return (
                    <div key={episodeId}
                      className={`episode-dot ${isWatched ? 'watched' : ''} ${!isWatched && !aired ? 'not-updated' : ''}`}
                      onClick={event => {
                        event.stopPropagation()
                        const nextType = isWatched ? 0 : 2
                        handleMark(episodeId, nextType)
                        onMarkEpisode(subjectId, episodeId, nextType)
                      }}
                      onContextMenu={event => {
                        event.preventDefault()
                        event.stopPropagation()
                        onShowEpisodeMenu(event, subjectId, episodeId)
                      }}
                      onMouseEnter={event => {
                        const rect = (event.target as HTMLElement).getBoundingClientRect()
                        const viewportWidth = window.innerWidth
                        const viewportHeight = window.innerHeight
                        let x = rect.right + EP_TOOLTIP_GAP
                        let y = rect.top - EP_TOOLTIP_GAP

                        if (x + EP_TOOLTIP_WIDTH > viewportWidth - EP_TOOLTIP_MARGIN) {
                          x = rect.left - EP_TOOLTIP_WIDTH - EP_TOOLTIP_GAP
                        }
                        if (x < EP_TOOLTIP_MARGIN) {
                          x = EP_TOOLTIP_MARGIN
                        }

                        if (y + EP_TOOLTIP_HEIGHT > viewportHeight - EP_TOOLTIP_MARGIN) {
                          y = rect.bottom - EP_TOOLTIP_HEIGHT
                        }
                        if (y < EP_TOOLTIP_MARGIN) {
                          y = EP_TOOLTIP_MARGIN
                        }

                        setHoveredEp({
                          x,
                          y,
                          ep: { epNum: episodeNumber, epName: episodeName, epAirdate: episodeAirdate, isWatched }
                        })
                      }}
                      onMouseLeave={() => setHoveredEp(null)}
                    >
                      {episodeNumber}
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
            <button className="card-edit-btn" onClick={() => onEditStatus(subject || item.subject || item, subjectType, item)}>
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
            <button className="card-edit-btn" onClick={() => onEditStatus(subject || item.subject || item, subjectType, item)}>
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
