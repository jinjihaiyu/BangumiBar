import { storage } from './cache-service'
import { getActiveBangumiSite } from './settings-service'

export const BGM_CLIENT_ID = 'bgm601969ef220ea48ae'
export const BGM_CLIENT_SECRET = 'adcf8bf04974ddcb88e5425e194da65c'
export const BGM_REDIRECT_URI = 'bangumibar://auth'

type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in?: number
}

export function buildAuthUrl() {
  const site = getActiveBangumiSite()
  const params = new URLSearchParams({
    client_id: BGM_CLIENT_ID,
    response_type: 'code',
    redirect_uri: BGM_REDIRECT_URI
  })

  return `${site.webBase}/oauth/authorize?${params}`
}

async function parseTokenResponse(response: Response, errorPrefix: string): Promise<TokenResponse> {
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
  const response = await fetch(`${site.webBase}/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'BangumiBar/1.0 (Electron)'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: BGM_CLIENT_ID,
      client_secret: BGM_CLIENT_SECRET,
      code,
      redirect_uri: BGM_REDIRECT_URI
    })
  })

  return parseTokenResponse(response, '获取授权失败')
}

export async function requestRefreshToken(refreshToken: string): Promise<TokenResponse> {
  const site = getActiveBangumiSite()
  const response = await fetch(`${site.webBase}/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'BangumiBar/1.0 (Electron)'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: BGM_CLIENT_ID,
      client_secret: BGM_CLIENT_SECRET,
      refresh_token: refreshToken
    })
  })

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
