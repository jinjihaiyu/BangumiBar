import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../services/bangumi-service'
import { persistentCache } from '../services/cache-service'
import { desktopApi } from '../../platform/desktop-api'

type NotificationItem = {
  id: number
  type: 'progress' | 'rating'
  text: string
  time: Date
  subjectName: string
  subjectId?: number
}

function buildNotification(item: NotificationItem): NotificationItem {
  return item
}

type UseCollectionsArgs = {
  username: string
  isLoggedIn: boolean
  getValidToken: () => Promise<string | null>
  getSubjectId: (item: any) => number
  onToast: (message: string) => void
}

function showDesktopNotification(title: string, body: string) {
  desktopApi.showNotification(title, body)
}

export function useCollections({
  username,
  isLoggedIn,
  getValidToken,
  getSubjectId,
  onToast,
}: UseCollectionsArgs) {
  const [collections, setCollections] = useState<any[]>([])
  const [searchCorpus, setSearchCorpus] = useState<any[]>([])
  const [selectedFilter, setSelectedFilter] = useState(3)
  const [selectedSubjectType, setSelectedSubjectType] = useState(2)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notificationCount, setNotificationCount] = useState(0)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [unwatchedCounts, setUnwatchedCounts] = useState<Record<number, number>>({})

  const loadIdRef = useRef(0)
  const notifCountRef = useRef(0)

  const loadSearchCorpus = useCallback(async (usernameOverride?: string) => {
    const token = await getValidToken()
    const targetUsername = usernameOverride || username
    if (!token || !targetUsername) return

    try {
      const [doing, wish] = await Promise.all([
        api.getCollections(token, targetUsername, 3, selectedSubjectType),
        api.getCollections(token, targetUsername, 1, selectedSubjectType)
      ])
      setSearchCorpus([...doing, ...wish])
    } catch {}
  }, [getValidToken, selectedSubjectType, username])

  const fetchAndUpdate = useCallback(async (loadId: number, token: string, cacheKey: string, usernameOverride?: string) => {
    if (loadId !== loadIdRef.current) return

    const targetUsername = usernameOverride || username

    try {
      const data = await api.getCollections(token, targetUsername, selectedFilter, selectedSubjectType)
      if (loadId !== loadIdRef.current) return

      persistentCache.set(cacheKey, data)
      setCollections(data)
      setIsLoading(false)
    } catch (requestError: any) {
      if (loadId !== loadIdRef.current) return

      if (requestError.message?.includes('401')) {
        const refreshed = await getValidToken()
        if (refreshed && loadId === loadIdRef.current) {
          await fetchAndUpdate(loadId, refreshed, cacheKey, usernameOverride)
          return
        }
      }

      setError(requestError.message)
      setIsLoading(false)
    }
  }, [getValidToken, selectedFilter, selectedSubjectType, username])

  const loadCollections = useCallback(async ({ force = false, usernameOverride }: { force?: boolean; usernameOverride?: string } = {}) => {
    const token = await getValidToken()
    const targetUsername = usernameOverride || username
    if (!token || !targetUsername) return

    const cacheKey = `${targetUsername}_${selectedFilter}_${selectedSubjectType}`
    const currentLoadId = ++loadIdRef.current
    const cached = persistentCache.get(cacheKey)

    if (cached && currentLoadId === loadIdRef.current && !force) {
      setCollections(cached)
      setIsLoading(false)
      void fetchAndUpdate(currentLoadId, token, cacheKey, usernameOverride)
      return
    }

    setIsLoading(true)
    setError(null)
    await fetchAndUpdate(currentLoadId, token, cacheKey, usernameOverride)
  }, [fetchAndUpdate, getValidToken, selectedFilter, selectedSubjectType, username])

  useEffect(() => {
    if (!isLoggedIn || !username) return

    const cacheKey = `${username}_${selectedFilter}_${selectedSubjectType}`
    const cached = persistentCache.get(cacheKey)
    if (cached) {
      setCollections(cached)
      setIsLoading(false)
      void loadSearchCorpus(username)
      return
    }

    setCollections([])
    setIsLoading(true)
    const timer = window.setTimeout(() => {
      void loadCollections({ force: true, usernameOverride: username })
    }, 100)

    return () => window.clearTimeout(timer)
  }, [isLoggedIn, loadCollections, loadSearchCorpus, selectedFilter, selectedSubjectType, username])

  const resetCollectionState = useCallback(() => {
    setCollections([])
    setSearchCorpus([])
    setNotifications([])
    setNotificationCount(0)
    setShowNotifications(false)
    setUnwatchedCounts({})
    setError(null)
    setIsLoading(false)
    notifCountRef.current = 0
  }, [])

  const markEpisode = useCallback(async (subjectId: number, episodeId: number, newType: number) => {
    const token = await getValidToken()
    if (!token) return

    const typeNames: Record<number, string> = { 0: '取消', 2: '看过', 3: '看不了' }
    onToast(`已设为 ${typeNames[newType]}`)

    if (newType === 2) {
      notifCountRef.current++
      setNotificationCount(notifCountRef.current)

      const colItem = collections.find(item => getSubjectId(item) === subjectId)
      const name = colItem?.subject?.nameCn || colItem?.subject?.name || '番剧'

      setNotifications(prev => [buildNotification({
        id: Date.now(),
        type: 'progress',
        text: `第${colItem?.ep_status ? colItem.ep_status + 1 : '?'}集已标记为看过`,
        subjectName: name,
        subjectId,
        time: new Date()
      }), ...prev].slice(0, 50))

      showDesktopNotification('BangumiBar', `《${name}》标记为看过`)
    }

    try {
      await api.updateEpisodeProgress(token, episodeId, newType)
    } catch {
      onToast('操作失败')
    }
  }, [collections, getSubjectId, getValidToken, onToast])

  const batchMarkEpisodes = useCallback(async (subjectId: number, episodeIds: number[], newType: number, clearSelectedEpisodes: () => void) => {
    const token = await getValidToken()
    if (!token) return

    const typeNames: Record<number, string> = { 0: '取消', 2: '看过', 3: '看不了' }
    clearSelectedEpisodes()
    onToast(`已批量设为 ${typeNames[newType]}`)

    if (newType === 2) {
      notifCountRef.current += episodeIds.length
      setNotificationCount(notifCountRef.current)

      const colItem = collections.find(item => getSubjectId(item) === subjectId)
      const name = colItem?.subject?.nameCn || colItem?.subject?.name || '番剧'

      setNotifications(prev => [buildNotification({
        id: Date.now(),
        type: 'progress',
        text: `批量标记${episodeIds.length}集为看过`,
        subjectName: name,
        subjectId,
        time: new Date()
      }), ...prev].slice(0, 50))

      showDesktopNotification('BangumiBar', `《${name}》批量标记${episodeIds.length}集为看过`)
    }

    try {
      await Promise.all(episodeIds.map(id => api.updateEpisodeProgress(token, id, newType)))
    } catch {
      onToast('批量操作失败')
    }
  }, [collections, getSubjectId, getValidToken, onToast])

  const handleRatingSubmit = useCallback(async (pendingRating: any, rating: number, comment: string) => {
    const token = await getValidToken()
    if (!token || !pendingRating) return

    await api.updateCollection(token, pendingRating.id, { rating, comment })
    const name = pendingRating.nameCn || pendingRating.name || '番剧'
    setNotifications(prev => [buildNotification({
      id: Date.now(),
      type: 'rating',
      text: `完结打分 ${rating.toFixed(1)}分${comment ? ` · ${comment}` : ''}`,
      subjectName: name,
      subjectId: pendingRating.id,
      time: new Date()
    }), ...prev].slice(0, 50))
    onToast('评分已提交')
  }, [getValidToken, onToast])

  const handleStatusEdit = useCallback(async (statusEditItem: any, data: { type?: number; rating?: number; comment?: string }) => {
    const token = await getValidToken()
    if (!token || !statusEditItem || !username) return false

    const subjectId = statusEditItem.subject.id
    await api.updateCollection(token, subjectId, data)

    const cacheKey = `${username}_${selectedFilter}_${selectedSubjectType}`
    localStorage.removeItem(`bgmcache_${cacheKey}`)
    await loadCollections({ force: true, usernameOverride: username })
    onToast('已更新')
    return true
  }, [getValidToken, loadCollections, onToast, selectedFilter, selectedSubjectType, username])

  const handleRefreshCollections = useCallback(async () => {
    if (!username) return

    const cacheKey = `${username}_${selectedFilter}_${selectedSubjectType}`
    localStorage.removeItem(`bgmcache_${cacheKey}`)
    await Promise.all([
      loadCollections({ force: true, usernameOverride: username }),
      loadSearchCorpus(username)
    ])
    onToast('已刷新')
  }, [loadCollections, loadSearchCorpus, onToast, selectedFilter, selectedSubjectType, username])

  const handleUnwatchedUpdate = useCallback((subjectId: number, count: number) => {
    setUnwatchedCounts(prev => {
      if (prev[subjectId] === count) return prev
      return { ...prev, [subjectId]: count }
    })
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
    setNotificationCount(0)
    setShowNotifications(false)
    notifCountRef.current = 0
  }, [])

  const derived = useMemo(() => ({
    selectedFilter,
    selectedSubjectType,
    collections,
    searchCorpus,
    isLoading,
    error,
    notificationCount,
    notifications,
    showNotifications,
    unwatchedCounts,
  }), [
    selectedFilter,
    selectedSubjectType,
    collections,
    searchCorpus,
    isLoading,
    error,
    notificationCount,
    notifications,
    showNotifications,
    unwatchedCounts,
  ])

  return {
    ...derived,
    setSelectedFilter,
    setSelectedSubjectType,
    setShowNotifications,
    loadCollections,
    loadSearchCorpus,
    resetCollectionState,
    markEpisode,
    batchMarkEpisodes,
    handleRatingSubmit,
    handleStatusEdit,
    handleRefreshCollections,
    handleUnwatchedUpdate,
    clearNotifications,
  }
}
