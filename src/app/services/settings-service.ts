import { bangumiFetch } from './http-service'

export const DEFAULT_MIRROR_DOMAIN = 'bangumi.one'
const DOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i

export type AppSettings = {
  openAtLogin: boolean
  showNotifications: boolean
  useMirror: boolean
  mirrorDomain: string
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
  useMirror: false,
  mirrorDomain: DEFAULT_MIRROR_DOMAIN,
}

export function cleanMirrorDomainInput(raw?: string): string {
  if (typeof raw !== 'string') return ''
  return raw
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .toLowerCase()
}

export function isValidMirrorDomain(raw?: string): boolean {
  const cleaned = cleanMirrorDomainInput(raw)
  return Boolean(cleaned && DOMAIN_PATTERN.test(cleaned))
}

export function normalizeMirrorDomain(raw?: string): string {
  const cleaned = cleanMirrorDomainInput(raw)
  return cleaned && DOMAIN_PATTERN.test(cleaned) ? cleaned : DEFAULT_MIRROR_DOMAIN
}

function buildSiteConfig(domain: string): BangumiSiteConfig {
  return {
    webBase: `https://${domain}`,
    apiBase: `https://api.${domain}`,
    lainBase: `https://lain.${domain}`,
    fastBase: `https://fast.${domain}`,
    nextBase: `https://next.${domain}`,
    doujinBase: `https://doujin.${domain}`,
  }
}

const ORIGIN_SITE = buildSiteConfig('bgm.tv')

let activeBangumiSite: BangumiSiteKey = 'origin'
let activeMirrorDomain: string = DEFAULT_MIRROR_DOMAIN

export function setActiveBangumiSite(useMirror: boolean, mirrorDomain?: string) {
  if (mirrorDomain !== undefined) {
    activeMirrorDomain = normalizeMirrorDomain(mirrorDomain)
  }
  activeBangumiSite = useMirror ? 'mirror' : 'origin'
}

export function getActiveBangumiSite(): BangumiSiteConfig {
  return activeBangumiSite === 'mirror' ? buildSiteConfig(activeMirrorDomain) : ORIGIN_SITE
}

async function canReachUrl(url: string, timeoutMs = 2500): Promise<boolean> {
  try {
    // 超时交给主进程处理（渲染层已不再直接出网），语义与原来的 AbortController 一致。
    const response = await bangumiFetch(url, {
      timeoutMs,
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    })

    return response.ok
  } catch {
    return false
  }
}

export async function canReachOriginBangumi(timeoutMs = 2500): Promise<boolean> {
  const [webOk, apiOk] = await Promise.all([
    canReachUrl(ORIGIN_SITE.webBase, timeoutMs),
    canReachUrl(`${ORIGIN_SITE.apiBase}/v0/subjects/1`, timeoutMs)
  ])

  return webOk && apiOk
}
