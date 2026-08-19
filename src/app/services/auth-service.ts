import { storage } from './cache-service'
import { bangumiOAuthToken, type HttpResponse } from './http-service'
import { getActiveBangumiSite } from './settings-service'
import { desktopApi } from '../../platform/desktop-api'

type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in?: number
}

// 授权页的 URL 由主进程拼（client_id 在那边），这里只负责告诉它用哪个站点。
export function openAuthPage() {
  const site = getActiveBangumiSite()
  return desktopApi.openAuthPage(site.webBase)
}

async function parseTokenResponse(response: HttpResponse, errorPrefix: string): Promise<TokenResponse> {
  const text = await response.text()
  if (!response.ok) throw new Error(`${errorPrefix}: ${text}`)

  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`${errorPrefix}: ${text}`)
  }
}

export async function requestAccessToken(code: string): Promise<TokenResponse> {
  const site = getActiveBangumiSite()
  const response = await bangumiOAuthToken({ webBase: site.webBase, grantType: 'authorization_code', code })

  return parseTokenResponse(response, '获取授权失败')
}

export async function requestRefreshToken(refreshToken: string): Promise<TokenResponse> {
  const site = getActiveBangumiSite()
  const response = await bangumiOAuthToken({ webBase: site.webBase, grantType: 'refresh_token', refreshToken })

  return parseTokenResponse(response, '刷新令牌失败')
}

// token 的存储格式先保持不变，避免影响已有登录状态。
export function persistTokenData(tokenData: TokenResponse) {
  storage.set('access_token', tokenData.access_token)
  if (tokenData.refresh_token) storage.set('refresh_token', tokenData.refresh_token)
  if (tokenData.expires_in) storage.setTokenExpiry(tokenData.expires_in)
}

export function clearAuthStorage() {
  storage.remove('access_token')
  storage.remove('refresh_token')
  storage.remove('user_id')
  localStorage.removeItem('bangumibar_token_expiry')
}
