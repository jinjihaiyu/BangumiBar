import { useCallback, useMemo, useRef, useState } from 'react'
import { desktopApi } from '../../platform/desktop-api'
import { DEFAULT_APP_SETTINGS, canReachOriginBangumi, getActiveBangumiSite, setActiveBangumiSite, type AppSettings } from '../services/settings-service'

export function useAppSettings() {
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS)
  const [autoUseMirror, setAutoUseMirror] = useState(false)
  const siteProbeIdRef = useRef(0)

  const resolveBangumiSiteMode = useCallback(async (manualUseMirror: boolean) => {
    const probeId = ++siteProbeIdRef.current

    if (manualUseMirror) {
      if (probeId !== siteProbeIdRef.current) return
      setAutoUseMirror(false)
      setActiveBangumiSite(true)
      return
    }

    const originAvailable = await canReachOriginBangumi()
    if (probeId !== siteProbeIdRef.current) return

    const fallbackToMirror = !originAvailable
    setAutoUseMirror(fallbackToMirror)
    setActiveBangumiSite(fallbackToMirror)
  }, [])

  const initializeSettings = useCallback(async () => {
    const getSettingsPromise = desktopApi.getAppSettings()
    const storedSettings = getSettingsPromise && typeof getSettingsPromise.then === 'function'
      ? await getSettingsPromise.catch(() => null)
      : null

    const nextSettings: AppSettings = { ...DEFAULT_APP_SETTINGS, ...(storedSettings || {}) }
    setAppSettings(nextSettings)
    await resolveBangumiSiteMode(nextSettings.useMirror)
    return nextSettings
  }, [resolveBangumiSiteMode])

  const updateAppSettings = useCallback((settings: Partial<AppSettings>) => {
    const nextSettings = { ...appSettings, ...settings }
    setAppSettings(nextSettings)

    const promise = desktopApi.setAppSettings(settings)
    if (promise && typeof promise.catch === 'function') {
      promise.catch(() => {})
    }

    if (Object.prototype.hasOwnProperty.call(settings, 'useMirror')) {
      void resolveBangumiSiteMode(nextSettings.useMirror)
    }
  }, [appSettings, resolveBangumiSiteMode])

  const activeSite = getActiveBangumiSite()

  const derived = useMemo(() => {
    const isUsingMirror = appSettings.useMirror || autoUseMirror
    const mirrorHint = appSettings.useMirror
      ? '已手动固定使用 bangumi.one 镜像地址'
      : autoUseMirror
        ? '检测到原站不可用，当前已自动切换镜像'
        : '原站不可用时会自动切换到镜像地址'

    return {
      isUsingMirror,
      mirrorHint,
    }
  }, [appSettings.useMirror, autoUseMirror])

  return {
    appSettings,
    autoUseMirror,
    activeSite,
    initializeSettings,
    resolveBangumiSiteMode,
    updateAppSettings,
    ...derived,
  }
}
