import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../services/bangumi-service'
import { persistentCache } from '../services/cache-service'
import { isAuthError } from '../services/http-service'
import { desktopApi } from '../../platform/desktop-api'
import { getSubjectDisplayTitle } from '../../utils'
import type { GetValidTokenOptions } from './useAuth'

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
  showDesktopNotifications: boolean
  getValidToken: (options?: GetValidTokenOptions) => Promise<string | null>
  getSubjectId: (item: any) => number
  onToast: (message: string) => void
}

function showDesktopNotification(title: string, body: string) {
  desktopApi.showNotification(title, body)
}

export function useCollections({
  username,
  isLoggedIn,
  showDesktopNotifications,
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

  const fetchAndUpdate = useCallback(async (
    loadId: number,
    token: string,
    cacheKey: string,
    usernameOverride?: string,
    hasRetriedAuth = false
  ) => {
    if (loadId !== loadIdRef.current) return

    const targetUsername = usernameOverride || username

    try {
      const data = await api.getCollections(token, targetUsername, selectedFilter, selectedSubjectType)
      if (loadId !== loadIdRef.current) return

      persistentCache.set(cacheKey, data)
      setCollections(data)
      setError(null)
      setIsLoading(false)
    } catch (requestError: any) {
      if (loadId !== loadIdRef.current) return

      // 401 仅强制刷新并重试一次，且确认拿到新令牌才重发，彻底避免死循环。
      if (isAuthError(requestError) && !hasRetriedAuth) {
        const refreshed = await getValidToken({ forceRefresh: true })
        if (refreshed && refreshed !== token && loadId === loadIdRef.current) {
          await fetchAndUpdate(loadId, refreshed, cacheKey, usernameOverride, true)
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

  const markEpisode = useCallback(async (
    subjectId: number,
    episodeId: number,
    newType: number,
    episodeNumber?: number
  ): Promise<boolean> => {
    const token = await getValidToken()
    if (!token) return false

    const typeNames: Record<number, string> = { 0: '取消', 2: '看过', 3: '看不了' }

    const submit = async (activeToken: string, hasRetriedAuth = false): Promise<boolean> => {
      try {
        await api.updateEpisodeProgress(activeToken, episodeId, newType)
        return true
      } catch (requestError) {
        if (isAuthError(requestError) && !hasRetriedAuth) {
          const refreshed = await getValidToken({ forceRefresh: true })
          if (refreshed && refreshed !== activeToken) {
            return submit(refreshed, true)
          }
        }
        return false
      }
    }

    const ok = await submit(token)
    if (!ok) {
      onToast('操作失败，已恢复原状态')
      return false
    }

    onToast(`已设为 ${typeNames[newType] ?? '已更新'}`)

    if (newType === 2) {
      notifCountRef.current++
      setNotificationCount(notifCountRef.current)

      const colItem = collections.find(item => getSubjectId(item) === subjectId)
      const name = getSubjectDisplayTitle(colItem)
      const epLabel = episodeNumber ?? (colItem?.ep_status ? colItem.ep_status + 1 : '?')

      setNotifications(prev => [buildNotification({
        id: Date.now(),
        type: 'progress',
        text: `第${epLabel}集已标记为看过`,
        subjectName: name,
        subjectId,
        time: new Date()
      }), ...prev].slice(0, 50))

      // 遵循设置页的通知开关，且仅在接口成功后发送。
      if (showDesktopNotifications) {
        showDesktopNotification('BangumiBar', `《${name}》第${epLabel}集已标记为看过`)
      }
    }

    return true
  }, [collections, getSubjectId, getValidToken, onToast, showDesktopNotifications])

  const markEpisodesUpTo = useCallback(async (
    subjectId: number,
    episodeIds: number[],
    upToEpisodeNumber?: number
  ): Promise<boolean> => {
    if (episodeIds.length === 0) {
      onToast('此前集数均已看过')
      return true
    }

    const token = await getValidToken()
    if (!token) return false

    const submit = async (activeToken: string, hasRetriedAuth = false): Promise<boolean> => {
      try {
        await api.batchUpdateEpisodeProgress(activeToken, subjectId, episodeIds, 2)
        return true
      } catch (requestError) {
        if (isAuthError(requestError) && !hasRetriedAuth) {
          const refreshed = await getValidToken({ forceRefresh: true })
          if (refreshed && refreshed !== activeToken) {
            return submit(refreshed, true)
          }
        }
        return false
      }
    }

    const ok = await submit(token)
    if (!ok) {
      onToast('批量标记失败，已恢复原状态')
      return false
    }

    const targetLabel = upToEpisodeNumber !== undefined ? `第${upToEpisodeNumber}集` : `${episodeIds.length}集`
    onToast(`已看到${targetLabel}（共标${episodeIds.length}集）`)

    notifCountRef.current++
    setNotificationCount(notifCountRef.current)

    const colItem = collections.find(item => getSubjectId(item) === subjectId)
    const name = getSubjectDisplayTitle(colItem)

    setNotifications(prev => [buildNotification({
      id: Date.now(),
      type: 'progress',
      text: `已看到${targetLabel}（批量标记${episodeIds.length}集）`,
      subjectName: name,
      subjectId,
      time: new Date()
    }), ...prev].slice(0, 50))

    if (showDesktopNotifications) {
      showDesktopNotification('BangumiBar', `《${name}》已看到${targetLabel}`)
    }

    return true
  }, [collections, getSubjectId, getValidToken, onToast, showDesktopNotifications])

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
    markEpisodesUpTo,
    handleStatusEdit,
    handleRefreshCollections,
    handleUnwatchedUpdate,
    clearNotifications,
  }
}
