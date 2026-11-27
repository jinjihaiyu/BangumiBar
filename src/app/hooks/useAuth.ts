import { useCallback, useRef, useState } from 'react'
import { api } from '../services/bangumi-service'
import { clearAuthStorage, persistTokenData } from '../services/auth-service'
import { storage } from '../services/cache-service'
import { isAuthError } from '../services/http-service'

type AuthenticatedPayload = {
  token: string
  username: string
  force: boolean
}

type HandleAuthSuccess = (payload: AuthenticatedPayload) => Promise<void>

export type GetValidTokenOptions = {
  forceRefresh?: boolean
}

export function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showManualCode, setShowManualCode] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [tokenExpired, setTokenExpired] = useState(false)
  const userLoadIdRef = useRef(0)
  // 并发刷新互斥锁：多个请求同时遇到过期/401 时复用同一次 refresh_token 请求。
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null)

  const logout = useCallback(() => {
    clearAuthStorage()
    setIsLoggedIn(false)
    setUser(null)
    setUsername('')
  }, [])

  // 令牌刷新逻辑集中在这里，避免页面层直接感知存储细节。
  const getValidToken = useCallback(async ({ forceRefresh = false }: GetValidTokenOptions = {}): Promise<string | null> => {
    const token = storage.getAccessToken()
    if (!token) return null

    const expiry = storage.getTokenExpiry()
    const isExpiredLocally = Boolean(expiry && Date.now() > expiry)

    if (!forceRefresh && !isExpiredLocally) {
      return token
    }

    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current
    }

    const refreshToken = storage.get('refresh_token')
    if (!refreshToken) {
      clearAuthStorage()
      setTokenExpired(true)
      setIsLoggedIn(false)
      return null
    }

    const refreshTask = (async () => {
      try {
        const data = await api.refreshAccessToken(refreshToken)
        persistTokenData(data)
        setTokenExpired(false)
        return data.access_token
      } catch {
        clearAuthStorage()
        setTokenExpired(true)
        setIsLoggedIn(false)
        return null
      } finally {
        refreshPromiseRef.current = null
      }
    })()

    refreshPromiseRef.current = refreshTask
    return refreshTask
  }, [])

  const loadUser = useCallback(async (token: string, hasRetriedAuth = false): Promise<any> => {
    const currentLoadId = ++userLoadIdRef.current

    try {
      const userData = await api.getMe(token)
      if (currentLoadId === userLoadIdRef.current) {
        setUser(userData)
        setUsername(userData.username)
        setError(null)
      }
      return userData
    } catch (requestError) {
      if (isAuthError(requestError)) {
        if (!hasRetriedAuth) {
          const refreshed = await getValidToken({ forceRefresh: true })
          if (refreshed && refreshed !== token) {
            return loadUser(refreshed, true)
          }
        }
        logout()
        setTokenExpired(true)
        return null
      }

      // 非 401 错误（如临时断网/超时）保留本地登录态，避免误踢下线。
      setError(requestError instanceof Error ? requestError.message : '获取用户信息失败')
      return null
    }
  }, [getValidToken, logout])

  const openAuthPage = useCallback(() => {
    api.openAuthPage()
  }, [])

  const handleCallback = useCallback(async (data: any, onAuthenticated: HandleAuthSuccess) => {
    const url = typeof data === 'string' ? data : (data.url || '')
    const code = url.match(/[?&]code=([^&]+)/)?.[1]
    if (!code) {
      setError('无效的授权码')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const tokenData = await api.getAccessToken(code)
      persistTokenData(tokenData)
      setIsLoggedIn(true)
      setTokenExpired(false)

      const userData = await loadUser(tokenData.access_token)
      if (!userData) return

      await onAuthenticated({
        token: tokenData.access_token,
        username: userData.username,
        force: true,
      })
    } catch (eventError: any) {
      setError('授权失败: ' + eventError.message)
    } finally {
      setIsLoading(false)
    }
  }, [loadUser])

  const submitManualCode = useCallback((onAuthenticated: HandleAuthSuccess) => {
    if (!manualCode.trim()) return

    void handleCallback(`bangumibar://auth?code=${manualCode.trim()}`, onAuthenticated)
    setShowManualCode(false)
    setManualCode('')
  }, [handleCallback, manualCode])

  const checkLogin = useCallback(async (onAuthenticated: HandleAuthSuccess) => {
    const token = await getValidToken()
    if (!token) return

    setIsLoggedIn(true)
    const userData = await loadUser(token)
    if (!userData) return

    const latestToken = storage.getAccessToken() || token
    await onAuthenticated({
      token: latestToken,
      username: userData.username,
      force: false,
    })
  }, [getValidToken, loadUser])

  return {
    isLoggedIn,
    isLoading,
    user,
    username,
    error,
    showManualCode,
    manualCode,
    tokenExpired,
    setShowManualCode,
    setManualCode,
    setError,
    getValidToken,
    openAuthPage,
    handleCallback,
    submitManualCode,
    checkLogin,
    logout,
  }
}
