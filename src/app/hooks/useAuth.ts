import { useCallback, useRef, useState } from 'react'
import { api } from '../services/bangumi-service'
import { clearAuthStorage, persistTokenData } from '../services/auth-service'
import { storage } from '../services/cache-service'
import { desktopApi } from '../../platform/desktop-api'

type AuthenticatedPayload = {
  token: string
  username: string
  force: boolean
}

type HandleAuthSuccess = (payload: AuthenticatedPayload) => Promise<void>

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

  // 令牌刷新逻辑集中在这里，避免页面层直接感知存储细节。
  const getValidToken = useCallback(async (): Promise<string | null> => {
    let token = storage.getAccessToken()
    if (!token) return null

    const expiry = storage.getTokenExpiry()
    if (expiry && Date.now() > expiry) {
      const refreshToken = storage.get('refresh_token')
      if (refreshToken) {
        try {
          const data = await api.refreshAccessToken(refreshToken)
          persistTokenData(data)
          token = data.access_token
          setTokenExpired(false)
        } catch {
          clearAuthStorage()
          setTokenExpired(true)
          setIsLoggedIn(false)
          return null
        }
      } else {
        setTokenExpired(true)
        return null
      }
    }

    return token
  }, [])

  const logout = useCallback(() => {
    clearAuthStorage()
    setIsLoggedIn(false)
    setUser(null)
    setUsername('')
  }, [])

  const loadUser = useCallback(async (token: string) => {
    const currentLoadId = ++userLoadIdRef.current

    try {
      const userData = await api.getMe(token)
      if (currentLoadId === userLoadIdRef.current) {
        setUser(userData)
        setUsername(userData.username)
      }
      return userData
    } catch {
      logout()
      return null
    }
  }, [logout])

  const openAuthPage = useCallback(() => {
    desktopApi.openExternal(api.getAuthUrl()) || window.open(api.getAuthUrl(), '_blank', 'width=500,height=600')
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

    await onAuthenticated({
      token,
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
