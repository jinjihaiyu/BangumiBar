import { useCallback, useMemo, useRef, useState } from 'react'
import { desktopApi } from '../../platform/desktop-api'
import { DEFAULT_APP_SETTINGS, canReachOriginBangumi, getActiveBangumiSite, normalizeMirrorDomain, setActiveBangumiSite, type AppSettings } from '../services/settings-service'

export function useAppSettings() {
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS)
  const [autoUseMirror, setAutoUseMirror] = useState(false)
  const siteProbeIdRef = useRef(0)

  const resolveBangumiSiteMode = useCallback(async (manualUseMirror: boolean, mirrorDomain?: string) => {
    const probeId = ++siteProbeIdRef.current
    const domain = normalizeMirrorDomain(mirrorDomain)

    if (manualUseMirror) {
      if (probeId !== siteProbeIdRef.current) return
      setAutoUseMirror(false)
      setActiveBangumiSite(true, domain)
      return
    }

    const originAvailable = await canReachOriginBangumi()
    if (probeId !== siteProbeIdRef.current) return

    const fallbackToMirror = !originAvailable
    setAutoUseMirror(fallbackToMirror)
    setActiveBangumiSite(fallbackToMirror, domain)
  }, [])

  const initializeSettings = useCallback(async () => {
    const getSettingsPromise = desktopApi.getAppSettings()
    const storedSettings = getSettingsPromise && typeof getSettingsPromise.then === 'function'
      ? await getSettingsPromise.catch(() => null)
      : null

    const nextSettings: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      ...(storedSettings || {}),
      mirrorDomain: normalizeMirrorDomain(storedSettings?.mirrorDomain),
    }
    setAppSettings(nextSettings)
    await resolveBangumiSiteMode(nextSettings.useMirror, nextSettings.mirrorDomain)
    return nextSettings
  }, [resolveBangumiSiteMode])

  const updateAppSettings = useCallback((settings: Partial<AppSettings>) => {
    const normalizedPatch: Partial<AppSettings> = { ...settings }
    if (Object.prototype.hasOwnProperty.call(settings, 'mirrorDomain')) {
      normalizedPatch.mirrorDomain = normalizeMirrorDomain(settings.mirrorDomain)
    }

    const nextSettings = { ...appSettings, ...normalizedPatch }
    setAppSettings(nextSettings)

    const promise = desktopApi.setAppSettings(normalizedPatch)
    if (promise && typeof promise.catch === 'function') {
      promise.catch(() => {})
    }

    if (
      Object.prototype.hasOwnProperty.call(settings, 'useMirror') ||
      Object.prototype.hasOwnProperty.call(settings, 'mirrorDomain')
    ) {
      void resolveBangumiSiteMode(nextSettings.useMirror, nextSettings.mirrorDomain)
    }
  }, [appSettings, resolveBangumiSiteMode])

  const activeSite = getActiveBangumiSite()

  const derived = useMemo(() => {
    const isUsingMirror = appSettings.useMirror || autoUseMirror
    const domain = normalizeMirrorDomain(appSettings.mirrorDomain)
    const mirrorHint = appSettings.useMirror
      ? `已手动固定使用 ${domain} 镜像地址`
      : autoUseMirror
        ? `检测到原站不可用，当前已自动切换至 ${domain}`
        : `原站不可用时会自动切换至 ${domain}`

    return {
      isUsingMirror,
      mirrorHint,
    }
  }, [appSettings.mirrorDomain, appSettings.useMirror, autoUseMirror])

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
