import { useEffect, useRef, useState, type Dispatch, type MouseEvent, type SetStateAction } from 'react'
import { api } from '../app/services/bangumi-service'
import { CACHE_TTL_MS, episodeCache, persistentCache, storage } from '../app/services/cache-service'
import { calcUnwatchedCount, filterMainStoryEpisodes, formatNextEpisode, getAirTransitionInstant, getEpisodeNumber, getNextEpisode, getSubjectDisplayTitle, getSubjectId, isAired } from '../utils'

type HoveredEpisode = { x: number; y: number; ep: any } | null

export interface AnimeCardProps {
  item: any
  index: number
  expandedCard: number | null
  isLoggedIn: boolean
  selectedFilter: number
  showChineseTitle: boolean
  onToggleCard: (event: MouseEvent, item: any) => void
  onMarkEpisode: (subjectId: number, episodeId: number, newType: number) => void
  onOpenSubject: (subjectId: number) => void
  onShowEpisodeMenu: (event: MouseEvent, subjectId: number, episodeId: number) => void
  setHoveredEp: Dispatch<SetStateAction<HoveredEpisode>>
  onUnwatchedUpdate: (subjectId: number, count: number) => void
  unwatchedCounts: Record<number, number>
  scheduleMap: Record<number, number>
  onEditStatus: (subject: any, subjectType: number, item: any) => void
  subjectType: number
}

const EP_TOOLTIP_WIDTH = 180
const EP_TOOLTIP_HEIGHT = 92
const EP_TOOLTIP_GAP = 10
const EP_TOOLTIP_MARGIN = 8

// 播出时刻到了才重算，所以定时器只对准下一集的播出瞬间。
// 但仍设上限，避免超长延时受 setTimeout 精度、休眠唤醒影响而失准。
const MAX_AIR_TIMER_MS = 6 * 60 * 60 * 1000
// 越过分界再算，避免定时器提前几毫秒触发导致判断仍是未播。
const AIR_TIMER_SLACK_MS = 1000

export function AnimeCard({
  item,
  index: _index,
  expandedCard,
  selectedFilter,
  showChineseTitle,
  onToggleCard,
  onMarkEpisode,
  onOpenSubject,
  onShowEpisodeMenu,
  setHoveredEp,
  onUnwatchedUpdate,
  unwatchedCounts,
  scheduleMap,
  onEditStatus,
  subjectType,
}: AnimeCardProps) {
  const isAnime = subjectType === 2
  const [subject, setSubject] = useState<any>(null)
  const [episodes, setEpisodes] = useState<any[]>([])
  const [loadingEpisodes, setLoadingEpisodes] = useState(false)
  // 播出时刻跨过后自增，驱动小圆点、待看数、下一集标签重新计算。
  const [airTick, setAirTick] = useState(0)

  const subjectId = getSubjectId(item)
  const broadcastMinutes = scheduleMap[subjectId]
  const watchedCount = item.ep_status || 0
  const totalEpisodes = item.subject?.eps || item.eps || 0
  const airDate = item.subject?.airDate
  const endDate = item.subject?.endDate
  const isAiredSubject = airDate ? new Date(airDate) <= new Date() : false
  const isEnded = isAiredSubject && !!endDate && new Date(endDate) < new Date()
  const rating = subject?.rating?.score || item.subject?.rating?.score || 0
  const displayTitle = getSubjectDisplayTitle(subject || item.subject, showChineseTitle)

  const effectiveTotal = totalEpisodes > 0 ? totalEpisodes : episodes.length
  const displayedUnwatched = unwatchedCounts[subjectId] || 0
  const nextEpisode = episodes.length > 0 ? getNextEpisode(episodes, broadcastMinutes) : null
  const nextEpisodeDate = nextEpisode?.episode?.airdate ? formatNextEpisode(nextEpisode.episode.airdate, broadcastMinutes) : ''

  const subjectLoadId = useRef(0)
  const episodeLoadId = useRef(0)
  // 区分「还没加载」和「加载完但是空的」：后者要如实上报 0，
  // 否则接口出错返回空列表时旧徽标会一直残留。
  const episodesLoaded = useRef(false)

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

  // 只负责取分集。待看数的计算见下一个 effect：
  // 放在一起会让放送表异步到达时重跑整个加载流程，冷缓存下每张卡多打一次接口。
  useEffect(() => {
    episodeLoadId.current++
    const loadId = episodeLoadId.current
    const token = storage.getAccessToken()
    if (!token) return

    const memoryCached = episodeCache.get(subjectId)
    if (memoryCached && Date.now() - memoryCached.time < CACHE_TTL_MS) {
      const filtered = filterMainStoryEpisodes(memoryCached.data)
      if (loadId === episodeLoadId.current) {
        episodesLoaded.current = true
        setEpisodes(filtered)
      }
      return
    }

    const diskCached = persistentCache.getEpisodeCache(subjectId)
    if (diskCached) {
      const filtered = filterMainStoryEpisodes(diskCached)
      episodeCache.set(subjectId, { data: filtered, time: Date.now() })
      persistentCache.setEpisodeCache(subjectId, filtered)
      if (loadId === episodeLoadId.current) {
        episodesLoaded.current = true
        setEpisodes(filtered)
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
        episodesLoaded.current = true
        setEpisodes(filtered)
        setLoadingEpisodes(false)
      }
    }).catch(() => {
      if (loadId === episodeLoadId.current) {
        setLoadingEpisodes(false)
      }
    })
  }, [subjectId])

  // 分集、放送表、播出时刻任一变化都重算待看数，是唯一的上报入口。
  useEffect(() => {
    if (!episodesLoaded.current) return
    onUnwatchedUpdate(subjectId, calcUnwatchedCount(episodes, broadcastMinutes))
  }, [airTick, broadcastMinutes, episodes, onUnwatchedUpdate, subjectId])

  // 对准下一集的播出瞬间：到点自动翻转状态，不必等其它交互触发重渲染。
  useEffect(() => {
    const airdate = nextEpisode?.episode?.airdate
    if (!airdate) return
    const target = getAirTransitionInstant(airdate, broadcastMinutes)
    if (!target) return

    const delay = Math.min(Math.max(target.getTime() - Date.now(), 0) + AIR_TIMER_SLACK_MS, MAX_AIR_TIMER_MS)
    const timer = window.setTimeout(() => setAirTick(tick => tick + 1), delay)
    return () => window.clearTimeout(timer)
  }, [airTick, broadcastMinutes, nextEpisode])

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
      // 待看数由上面的 effect 随 episodes 变化统一上报，这里不再重复计算。

      const total = effectiveTotal > 0 ? effectiveTotal : prevEpisodes.length
      const targetEpisode = updatedEpisodes.find((episode: any) => (episode.episode?.id || episode.id) === episodeId)
      const episodeNumber = getEpisodeNumber(targetEpisode)
      const isLastEpisode = total > 0 && episodeNumber >= total && newType === 2
      const allMainEpisodesCompleted = updatedEpisodes.length > 0 && updatedEpisodes.every((episode: any) => episode.type === 2)
      const hasUpcomingMainEpisode = getNextEpisode(updatedEpisodes, broadcastMinutes) !== null

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
          <div className="anime-title">{displayTitle}</div>
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
                  const episodeName = episode.episode?.name_cn || episode.episode?.nameCn || episode.episode?.name || ''
                  const episodeAirdate = episode.episode?.airdate || ''
                  const isWatched = episode.type === 2
                  const aired = isAired(episodeAirdate, broadcastMinutes)

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
