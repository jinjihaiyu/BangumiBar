function getElectronAPI() {
  return window.electronAPI
}

export const desktopApi = {
  onAuthCallback: (callback: (data: any) => void) => getElectronAPI()?.onAuthCallback?.(callback),
  openExternal: (url: string) => getElectronAPI()?.openExternal?.(url),
  showNotification: (title: string, body: string) => getElectronAPI()?.showNotification?.(title, body),
  getAppSettings: () => getElectronAPI()?.getAppSettings?.(),
  setAppSettings: (settings: Partial<{ openAtLogin: boolean; showNotifications: boolean; useMirror: boolean }>) => getElectronAPI()?.setAppSettings?.(settings)
}
