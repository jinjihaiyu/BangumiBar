import { memo, useEffect, useRef, useState, type Dispatch, type MouseEvent, type SetStateAction } from 'react'
import { api } from '../app/services/bangumi-service'
import { CACHE_TTL_MS, episodeCache, persistentCache, storage } from '../app/services/cache-service'
import { calcUnwatchedCount, filterMainStoryEpisodes, formatNextEpisode, getAirTransitionInstant, getCollectionStatusLabel, getEpisodeNumber, getNextEpisode, getSubjectDisplayTitle, getSubjectId, getUserRating, isAired } from '../utils'
import { StarRating } from './StarRating'

type HoveredEpisode = { x: number; y: number; ep: any } | null

export interface AnimeCardProps {
  item: any
  index: number
  expandedCard: number | null
  isLoggedIn: boolean
  selectedFilter: number
  showChineseTitle: boolean
  onToggleCard: (event: MouseEvent, item: any) => void
  onMarkEpisode: (subjectId: number, episodeId: number, newType: number, episodeNumber?: number) => Promise<boolean>
  onMarkEpisodesUpTo: (subjectId: number, episodeIds: number[], upToEpisodeNumber?: number) => Promise<boolean>
  onOpenSubject: (subjectId: number) => void
  onShowEpisodeMenu: (
    event: MouseEvent,
    subjectId: number,
    episodeId: number,
    episodeNumber: number,
    actions: { onSelect: (newType: number) => void; onWatchUpTo: () => void }
  ) => void
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

export const AnimeCard = memo(function AnimeCard({
  item,
  index: _index,
  expandedCard,
  selectedFilter,
  showChineseTitle,
  onToggleCard,
  onMarkEpisode,
  onMarkEpisodesUpTo,
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
  const shouldTrackEpisodes = isAnime && selectedFilter === 3
  const [subject, setSubject] = useState<any>(null)
  const [episodes, setEpisodes] = useState<any[]>([])
  const [loadingEpisodes, setLoadingEpisodes] = useState(false)
  // 播出时刻跨过后自增，驱动小圆点、待看数、下一集标签重新计算。
  const [airTick, setAirTick] = useState(0)

  const subjectId = getSubjectId(item)
  const broadcastMinutes = scheduleMap[subjectId]
  const totalEpisodes = item.subject?.eps || item.eps || 0
  const airDate = item.subject?.date || subject?.date || item.subject?.airDate
  const endDate = item.subject?.endDate
  const isAiredSubject = airDate ? new Date(airDate) <= new Date() : false
  const isEnded = isAiredSubject && !!endDate && new Date(endDate) < new Date()
  const rating = subject?.rating?.score || item.subject?.rating?.score || item.subject?.score || 0
  const userRating = getUserRating(item)
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
  const episodesRef = useRef<any[]>([])
  episodesRef.current = episodes

  // 分集加载完成后直接按本地状态统计已看集数，避免点击分集后进度条停留在旧快照。
  const watchedCount = episodesLoaded.current
    ? episodes.filter(ep => ep.type === 2).length
    : (item.ep_status || 0)

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

  // 仅在「在看动画」列表加载分集，避免书籍/游戏或想看列表发起无用请求。
  useEffect(() => {
    episodeLoadId.current++
    if (!shouldTrackEpisodes) {
      episodesLoaded.current = false
      setEpisodes([])
      setLoadingEpisodes(false)
      return
    }

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
  }, [shouldTrackEpisodes, subjectId])

  // 分集、放送表、播出时刻任一变化都重算待看数，是唯一的上报入口。
  useEffect(() => {
    if (!shouldTrackEpisodes || !episodesLoaded.current) return
    onUnwatchedUpdate(subjectId, calcUnwatchedCount(episodes, broadcastMinutes))
  }, [airTick, broadcastMinutes, episodes, onUnwatchedUpdate, shouldTrackEpisodes, subjectId])

  // 对准下一集的播出瞬间：到点自动翻转状态，不必等其它交互触发重渲染。
  useEffect(() => {
    if (!shouldTrackEpisodes) return
    const airdate = nextEpisode?.episode?.airdate
    if (!airdate) return
    const target = getAirTransitionInstant(airdate, broadcastMinutes)
    if (!target) return

    const delay = Math.min(Math.max(target.getTime() - Date.now(), 0) + AIR_TIMER_SLACK_MS, MAX_AIR_TIMER_MS)
    const timer = window.setTimeout(() => setAirTick(tick => tick + 1), delay)
    return () => window.clearTimeout(timer)
  }, [airTick, broadcastMinutes, nextEpisode, shouldTrackEpisodes])

  // 统一处理左键点击与右键菜单：仅更新外层观看状态（不覆盖 episode.episode.type），
  // 接口失败时按单集精确回滚，成功且看完最后一集后再弹出补评窗口。
  const handleEpisodeAction = async (episodeId: number, newType: number) => {
    const targetBefore = episodesRef.current.find((episode: any) => (episode.episode?.id || episode.id) === episodeId)
    const prevType = targetBefore?.type
    const episodeNumber = targetBefore ? getEpisodeNumber(targetBefore) : undefined

    setEpisodes(current => {
      const updated = current.map(episode => {
        const id = episode.episode?.id || episode.id
        return id === episodeId ? { ...episode, type: newType } : episode
      })
      episodeCache.set(subjectId, { data: updated, time: Date.now() })
      persistentCache.setEpisodeCache(subjectId, updated)
      return updated
    })

    const ok = await onMarkEpisode(subjectId, episodeId, newType, episodeNumber)
    if (!ok) {
      setEpisodes(current => {
        const rolledBack = current.map(episode => {
          const id = episode.episode?.id || episode.id
          return id === episodeId ? { ...episode, type: prevType } : episode
        })
        episodeCache.set(subjectId, { data: rolledBack, time: Date.now() })
        persistentCache.setEpisodeCache(subjectId, rolledBack)
        return rolledBack
      })
      return
    }

    const latestEpisodes = episodesRef.current
    const total = effectiveTotal > 0 ? effectiveTotal : latestEpisodes.length
    const isLastEpisode = total > 0 && typeof episodeNumber === 'number' && episodeNumber >= total && newType === 2
    const allMainEpisodesCompleted = latestEpisodes.length > 0 && latestEpisodes.every((episode: any) => episode.type === 2)
    const hasUpcomingMainEpisode = getNextEpisode(latestEpisodes, broadcastMinutes) !== null

    if (isLastEpisode && allMainEpisodesCompleted && !hasUpcomingMainEpisode) {
      const subjectForEdit = subject || item.subject || item
      if (subjectForEdit) {
        onEditStatus(subjectForEdit, subjectType, { ...item, type: 2 })
      }
    }
  }

  // 右键「看到此集」：批量将当前集及之前未看本篇集数全部标为看过，失败时按集精确回滚。
  const handleMarkUpTo = async (targetEpisodeId: number) => {
    const currentEpisodes = episodesRef.current
    const target = currentEpisodes.find((episode: any) => (episode.episode?.id || episode.id) === targetEpisodeId)
    if (!target) return

    const targetNumber = getEpisodeNumber(target)
    const toMark = currentEpisodes.filter((episode: any) => {
      const epNum = getEpisodeNumber(episode)
      return epNum <= targetNumber && episode.type !== 2
    })

    if (toMark.length === 0) {
      await onMarkEpisodesUpTo(subjectId, [], targetNumber)
      return
    }

    const prevTypesById = new Map<number, number>()
    const targetIds: number[] = []
    for (const ep of toMark) {
      const id = ep.episode?.id || ep.id
      targetIds.push(id)
      prevTypesById.set(id, ep.type)
    }
    const targetIdSet = new Set(targetIds)

    setEpisodes(current => {
      const updated = current.map(episode => {
        const id = episode.episode?.id || episode.id
        return targetIdSet.has(id) ? { ...episode, type: 2 } : episode
      })
      episodeCache.set(subjectId, { data: updated, time: Date.now() })
      persistentCache.setEpisodeCache(subjectId, updated)
      return updated
    })

    const ok = await onMarkEpisodesUpTo(subjectId, targetIds, targetNumber)
    if (!ok) {
      setEpisodes(current => {
        const rolledBack = current.map(episode => {
          const id = episode.episode?.id || episode.id
          return prevTypesById.has(id) ? { ...episode, type: prevTypesById.get(id) } : episode
        })
        episodeCache.set(subjectId, { data: rolledBack, time: Date.now() })
        persistentCache.setEpisodeCache(subjectId, rolledBack)
        return rolledBack
      })
      return
    }

    const latestEpisodes = episodesRef.current
    const total = effectiveTotal > 0 ? effectiveTotal : latestEpisodes.length
    const isLastEpisode = total > 0 && targetNumber >= total
    const allMainEpisodesCompleted = latestEpisodes.length > 0 && latestEpisodes.every((episode: any) => episode.type === 2)
    const hasUpcomingMainEpisode = getNextEpisode(latestEpisodes, broadcastMinutes) !== null

    if (isLastEpisode && allMainEpisodesCompleted && !hasUpcomingMainEpisode) {
      const subjectForEdit = subject || item.subject || item
      if (subjectForEdit) {
        onEditStatus(subjectForEdit, subjectType, { ...item, type: 2 })
      }
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
          <div
            className="anime-title clickable"
            onClick={() => onOpenSubject(subjectId)}
            title="在 Bangumi 中查看"
          >
            {displayTitle}
          </div>
          <button
            type="button"
            className="anime-edit-btn"
            onClick={event => {
              event.stopPropagation()
              onEditStatus(subject || item.subject || item, subjectType, item)
            }}
            title="修改条目 · 评分"
            aria-label="修改条目与评分"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          {rating > 0 && (
            <div className="anime-rating" title={`Bangumi 均分 ${rating.toFixed(1)}`}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <span>{rating.toFixed(1)}</span>
            </div>
          )}
        </div>
        <div className="anime-meta-row">
          {airDate && <span className="anime-date">{airDate}</span>}
          {isEnded && <span className="ended-badge">已完结</span>}
          {isAnime && nextEpisodeDate && !isEnded && <span className="next-ep-date">下一集 {nextEpisodeDate}</span>}
          {!isAnime && item.type && (
            <span className="collection-type-badge" data-type={item.type}>{getCollectionStatusLabel(item.type, subjectType)}</span>
          )}
          {userRating > 0 && (
            <button
              type="button"
              className="anime-user-stars"
              onClick={event => {
                event.stopPropagation()
                onEditStatus(subject || item.subject || item, subjectType, item)
              }}
              title={`我的评分 ${userRating} 分（点击修改）`}
            >
              <StarRating value={userRating} readonly size={10} compact />
            </button>
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
                        void handleEpisodeAction(episodeId, nextType)
                      }}
                      onContextMenu={event => {
                        event.preventDefault()
                        event.stopPropagation()
                        onShowEpisodeMenu(event, subjectId, episodeId, episodeNumber, {
                          onSelect: newType => { void handleEpisodeAction(episodeId, newType) },
                          onWatchUpTo: () => { void handleMarkUpTo(episodeId) },
                        })
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

      </div>
    </div>
  )
})
