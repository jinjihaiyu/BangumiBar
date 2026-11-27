export const CACHE_TTL_MS = 10 * 60 * 1000

const EXPIRING_CACHE_PREFIXES = ['bgmcache_', 'bgmep_', 'bgmsubj_']
const EXPIRING_CACHE_EXACT_KEYS = new Set(['bangumibar_schedule_map'])

// 缓存键名和过期策略先保持不变，避免第一轮重构影响已有数据。
export const storage = {
  get: (key: string) => {
    try {
      const data = localStorage.getItem(`bangumibar_${key}`)
      return data ? JSON.parse(data) : null
    } catch {
      return null
    }
  },
  set: (key: string, value: any) => {
    try {
      localStorage.setItem(`bangumibar_${key}`, JSON.stringify(value))
    } catch {}
  },
  remove: (key: string) => localStorage.removeItem(`bangumibar_${key}`),
  getTokenExpiry: () => {
    const value = localStorage.getItem('bangumibar_token_expiry')
    return value ? parseInt(value) : null
  },
  setTokenExpiry: (expiresIn: number) => {
    localStorage.setItem('bangumibar_token_expiry', String(Date.now() + expiresIn * 1000 - 60 * 1000))
  },
  getAccessToken: () => storage.get('access_token'),
}

function isManagedCacheKey(key: string): boolean {
  if (EXPIRING_CACHE_EXACT_KEYS.has(key)) return true
  return EXPIRING_CACHE_PREFIXES.some(prefix => key.startsWith(prefix))
}

export function pruneExpiredCache(): number {
  const now = Date.now()
  let removed = 0

  try {
    const keys: string[] = []
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index)
      if (key && isManagedCacheKey(key)) keys.push(key)
    }

    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key)
        if (!raw) continue
        const parsed = JSON.parse(raw)
        if (!parsed || typeof parsed.expiry !== 'number' || now > parsed.expiry) {
          localStorage.removeItem(key)
          removed++
        }
      } catch {
        localStorage.removeItem(key)
        removed++
      }
    }
  } catch {}

  for (const [subjectId, entry] of episodeCache.entries()) {
    if (now - entry.time >= CACHE_TTL_MS) {
      episodeCache.delete(subjectId)
    }
  }

  return removed
}

function getExpiringCacheItem<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null

    const { data, expiry } = JSON.parse(raw)
    if (Date.now() > expiry) {
      localStorage.removeItem(key)
      return null
    }

    return data
  } catch {
    return null
  }
}

function setExpiringCacheItem(key: string, data: any, ttl: number) {
  const payload = JSON.stringify({ data, expiry: Date.now() + ttl })
  try {
    localStorage.setItem(key, payload)
  } catch {
    // 触发存储配额上限时先清理过期缓存，再重试写入一次。
    if (pruneExpiredCache() > 0) {
      try {
        localStorage.setItem(key, payload)
      } catch {}
    }
  }
}

export const persistentCache = {
  get: <T = any>(key: string): T | null => getExpiringCacheItem<T>(`bgmcache_${key}`),
  set: (key: string, data: any, ttl = CACHE_TTL_MS) => setExpiringCacheItem(`bgmcache_${key}`, data, ttl),
  getEpisodeCache: <T = any>(subjectId: number): T | null => getExpiringCacheItem<T>(`bgmep_${subjectId}`),
  setEpisodeCache: (subjectId: number, data: any, ttl = CACHE_TTL_MS) => setExpiringCacheItem(`bgmep_${subjectId}`, data, ttl),
  getSubjectCache: <T = any>(subjectId: number): T | null => getExpiringCacheItem<T>(`bgmsubj_${subjectId}`),
  setSubjectCache: (subjectId: number, data: any, ttl = CACHE_TTL_MS * 6) => setExpiringCacheItem(`bgmsubj_${subjectId}`, data, ttl),
  pruneExpired: pruneExpiredCache,
}

export const episodeCache = new Map<number, { data: any[]; time: number }>()
