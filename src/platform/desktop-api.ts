import type { BangumiOAuthOptions, BangumiRequestOptions } from '../electron'

function getElectronAPI() {
  return window.electronAPI
}

export const desktopApi = {
  onAuthCallback: (callback: (data: any) => void) => getElectronAPI()?.onAuthCallback?.(callback),
  openExternal: (url: string) => getElectronAPI()?.openExternal?.(url),
  showNotification: (title: string, body: string) => getElectronAPI()?.showNotification?.(title, body),
  getBroadcastSchedule: () => getElectronAPI()?.getBroadcastSchedule?.(),
  getAppSettings: () => getElectronAPI()?.getAppSettings?.(),
  setAppSettings: (settings: Partial<{ openAtLogin: boolean; showNotifications: boolean; useMirror: boolean }>) => getElectronAPI()?.setAppSettings?.(settings),
  request: (options: BangumiRequestOptions) => getElectronAPI()?.request?.(options),
  oauthToken: (options: BangumiOAuthOptions) => getElectronAPI()?.oauthToken?.(options),
  openAuthPage: (webBase: string) => getElectronAPI()?.openAuthPage?.(webBase)
}
