import { persistentCache } from './cache-service'
import { buildAuthUrl, requestAccessToken, requestRefreshToken } from './auth-service'
import { getActiveBangumiSite } from './settings-service'

export const api = {
  getAuthUrl: () => buildAuthUrl(),

  getAccessToken: async (code: string) => requestAccessToken(code),

  refreshAccessToken: async (refreshToken: string) => requestRefreshToken(refreshToken),

  getMe: async (token: string) => {
    const site = getActiveBangumiSite()
    const response = await fetch(`${site.apiBase}/v0/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'BangumiBar/1.0 (Electron)'
      }
    })

    if (!response.ok) throw new Error('获取用户信息失败')
    return response.json()
  },

  getSubject: async (subjectId: number) => {
    const cached = persistentCache.getSubjectCache(subjectId)
    if (cached) return cached

    const site = getActiveBangumiSite()
    const response = await fetch(`${site.apiBase}/v0/subjects/${subjectId}`, {
      headers: { 'User-Agent': 'BangumiBar/1.0 (Electron)' }
    })

    if (!response.ok) throw new Error('获取条目详情失败')

    const data = await response.json()
    persistentCache.setSubjectCache(subjectId, data)
    return data
  },

  getCollections: async (token: string, username: string, type: number, subjectType: number) => {
    const limit = 30

    const fetchPage = async (page: number) => {
      const site = getActiveBangumiSite()
      const offset = (page - 1) * limit
      const url = `${site.apiBase}/v0/users/${username}/collections?type=${type}&subject_type=${subjectType}&limit=${limit}&offset=${offset}`
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'BangumiBar/1.0 (Electron)'
        }
      })

      if (!response.ok) throw new Error('获取收藏列表失败')
      return response.json()
    }

    const firstPage = await fetchPage(1)
    const total = firstPage.total || 0
    const firstItems = firstPage.data || []
    if (firstItems.length >= total) return firstItems

    const totalPages = Math.ceil(total / limit)
    const remainingPages = Array.from({ length: totalPages - 1 }, (_, index) => index + 2)
    const batchSize = 5
    const batches: number[][] = []

    for (let index = 0; index < remainingPages.length; index += batchSize) {
      batches.push(remainingPages.slice(index, index + batchSize))
    }

    const batchResults = await Promise.all(batches.map(batch => Promise.all(batch.map(page => fetchPage(page)))))
    const remainingItems = batchResults.flat().flatMap(result => result.data || [])
    return [...firstItems, ...remainingItems]
  },

  getEpisodes: async (token: string, subjectId: number) => {
    const site = getActiveBangumiSite()
    const response = await fetch(`${site.apiBase}/v0/users/-/collections/${subjectId}/episodes`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'BangumiBar/1.0 (Electron)'
      }
    })

    if (!response.ok) return []

    const data = await response.json()
    return data.data || []
  },

  updateEpisodeProgress: async (token: string, episodeId: number, status: number = 2) => {
    const site = getActiveBangumiSite()
    const response = await fetch(`${site.apiBase}/v0/users/-/collections/-/episodes/${episodeId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'BangumiBar/1.0 (Electron)'
      },
      body: JSON.stringify({ type: status })
    })

    if (!response.ok && response.status !== 204) {
      const text = await response.text()
      throw new Error(`更新进度失败: ${text}`)
    }

    return true
  },

  updateCollection: async (token: string, subjectId: number, data: { rating?: number; comment?: string; type?: number }) => {
    const site = getActiveBangumiSite()
    const response = await fetch(`${site.apiBase}/v0/users/-/collections/${subjectId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'BangumiBar/1.0 (Electron)'
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`更新收藏失败: ${text}`)
    }

    return response.json()
  }
}
