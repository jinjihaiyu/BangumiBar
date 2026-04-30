export {}

declare global {
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
      closeSettings: () => Promise<void>
      getVersion: () => Promise<string>
      showNotification: (title: string, body: string) => Promise<void>
      getAppSettings: () => Promise<{ openAtLogin: boolean; showNotifications: boolean; hideAfterClick: boolean }>
      setAppSettings: (settings: Partial<{ openAtLogin: boolean; showNotifications: boolean; hideAfterClick: boolean }>) => Promise<void>
      platform: NodeJS.Platform
    }
  }
}
