export {}

// 出网通道的数据契约：IPC 只能传结构化数据，Response 对象过不去，
// 所以主进程回的是 { ok, status, body }，由渲染层再包成 Response 的形状。
export type BangumiRequestOptions = {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
}

export type BangumiOAuthOptions = {
  webBase: string
  grantType: 'authorization_code' | 'refresh_token'
  code?: string
  refreshToken?: string
}

export type BangumiHttpResult = {
  ok: boolean
  status: number
  body: string
}

declare global {
  // 构建时由 vite.config.ts 从 package.json 注入，避免版本号在两处各写一遍。
  const __APP_VERSION__: string

  interface Window {
    electronAPI: {
      onAuthCallback: (callback: (data: any) => void) => void
      onWindowReady: (callback: () => void) => void
      getStore: (key: string) => Promise<any>
      setStore: (key: string, value: any) => Promise<void>
      deleteStore: (key: string) => Promise<void>
      openExternal: (url: string) => Promise<void>
      hidePopover: () => Promise<void>
      cancelHide: () => Promise<void>
      scheduleHide: (delay: number) => Promise<void>
      onPopoverVisibility: (callback: (visible: boolean) => void) => void
      closeSettings: () => Promise<void>
      getVersion: () => Promise<string>
      showNotification: (title: string, body: string) => Promise<void>
      getBroadcastSchedule: () => Promise<Record<number, number>>
      getAppSettings: () => Promise<{ openAtLogin: boolean; showNotifications: boolean; useMirror: boolean }>
      setAppSettings: (settings: Partial<{ openAtLogin: boolean; showNotifications: boolean; useMirror: boolean }>) => Promise<void>
      request: (options: BangumiRequestOptions) => Promise<BangumiHttpResult>
      oauthToken: (options: BangumiOAuthOptions) => Promise<BangumiHttpResult>
      openAuthPage: (webBase: string) => Promise<void>
      platform: NodeJS.Platform
      auth: {
        onCallback: (callback: (data: any) => void) => void
        onWindowReady: (callback: () => void) => void
      }
      desktop: {
        openExternal: (url: string) => Promise<void>
        hidePopover: () => Promise<void>
        cancelHide: () => Promise<void>
        scheduleHide: (delay: number) => Promise<void>
        onPopoverVisibility: (callback: (visible: boolean) => void) => void
        closeSettings: () => Promise<void>
        getVersion: () => Promise<string>
        showNotification: (title: string, body: string) => Promise<void>
        getBroadcastSchedule: () => Promise<Record<number, number>>
        platform: NodeJS.Platform
      }
      net: {
        request: (options: BangumiRequestOptions) => Promise<BangumiHttpResult>
        oauthToken: (options: BangumiOAuthOptions) => Promise<BangumiHttpResult>
        openAuthPage: (webBase: string) => Promise<void>
      }
      settings: {
        get: () => Promise<{ openAtLogin: boolean; showNotifications: boolean; useMirror: boolean }>
        update: (settings: Partial<{ openAtLogin: boolean; showNotifications: boolean; useMirror: boolean }>) => Promise<void>
      }
    }
  }
}
