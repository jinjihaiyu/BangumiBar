export type AppSettings = {
  openAtLogin: boolean
  showNotifications: boolean
  useMirror: boolean
}

type BangumiSiteKey = 'origin' | 'mirror'

export type BangumiSiteConfig = {
  webBase: string
  apiBase: string
  lainBase: string
  fastBase: string
  nextBase: string
  doujinBase: string
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  openAtLogin: false,
  showNotifications: true,
  useMirror: false
}

const BANGUMI_SITES: Record<BangumiSiteKey, BangumiSiteConfig> = {
  origin: {
    webBase: 'https://bgm.tv',
    apiBase: 'https://api.bgm.tv',
    lainBase: 'https://lain.bgm.tv',
    fastBase: 'https://fast.bgm.tv',
    nextBase: 'https://next.bgm.tv',
    doujinBase: 'https://doujin.bgm.tv'
  },
  mirror: {
    webBase: 'https://bangumi.one',
    apiBase: 'https://api.bangumi.one',
    lainBase: 'https://lain.bangumi.one',
    fastBase: 'https://fast.bangumi.one',
    nextBase: 'https://next.bangumi.one',
    doujinBase: 'https://doujin.bangumi.one'
  }
}

let activeBangumiSite: BangumiSiteKey = 'origin'

export function setActiveBangumiSite(useMirror: boolean) {
  activeBangumiSite = useMirror ? 'mirror' : 'origin'
}

export function getActiveBangumiSite(): BangumiSiteConfig {
  return BANGUMI_SITES[activeBangumiSite]
}

async function canReachUrl(url: string, timeoutMs = 2500): Promise<boolean> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'User-Agent': 'BangumiBar/1.0 (Electron)'
      }
    })

    return response.ok
  } catch {
    return false
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export async function canReachOriginBangumi(timeoutMs = 2500): Promise<boolean> {
  const [webOk, apiOk] = await Promise.all([
    canReachUrl(BANGUMI_SITES.origin.webBase, timeoutMs),
    canReachUrl(`${BANGUMI_SITES.origin.apiBase}/v0/subjects/1`, timeoutMs)
  ])

  return webOk && apiOk
}
