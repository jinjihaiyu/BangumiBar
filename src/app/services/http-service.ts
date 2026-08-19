import type { BangumiHttpResult, BangumiOAuthOptions, BangumiRequestOptions } from '../../electron'
import { desktopApi } from '../../platform/desktop-api'

// 包成 Response 的形状，调用点保持 response.ok / response.json() 的写法不变。
export type HttpResponse = {
  ok: boolean
  status: number
  text: () => Promise<string>
  json: () => Promise<any>
}

export type HttpRequestInit = Omit<BangumiRequestOptions, 'url'>

export function toHttpResponse(result: BangumiHttpResult): HttpResponse {
  return {
    ok: result.ok,
    status: result.status,
    text: async () => result.body,
    json: async () => JSON.parse(result.body)
  }
}

// 渲染层自己已经不能出网了（webSecurity 恢复默认 + CSP 的 connect-src 'none'），
// 请求一律交给主进程发出，主机白名单也在那边把关。
export async function bangumiFetch(url: string, init: HttpRequestInit = {}): Promise<HttpResponse> {
  const result = await desktopApi.request({ url, ...init })
  if (!result) throw new Error('网络请求需要在 Electron 环境中运行')

  return toHttpResponse(result)
}

// OAuth 单独一个通道：client_id / client_secret 由主进程补齐，不再进渲染层 bundle。
export async function bangumiOAuthToken(options: BangumiOAuthOptions): Promise<HttpResponse> {
  const result = await desktopApi.oauthToken(options)
  if (!result) throw new Error('网络请求需要在 Electron 环境中运行')

  return toHttpResponse(result)
}
