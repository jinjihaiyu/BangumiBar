// fankuhub 的 broadcastTimeMinutes 以日本时间（JST，UTC+9）零点起算，
// >=1440 表示跨日深夜档（如 1530 => 次日 01:30）。airdate 为档期当天日期。
const JST_OFFSET_MS = 9 * 60 * 60 * 1000

function parseDateParts(airdateStr: string): { y: number; m: number; d: number } | null {
  const match = airdateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) }
}

// 根据档期日期 + JST 分钟数还原真实播出瞬间（UTC）。无精确时间时返回 null。
function getAirInstant(airdateStr: string | undefined, broadcastMinutes?: number): Date | null {
  if (!airdateStr || typeof broadcastMinutes !== 'number') return null
  const parts = parseDateParts(airdateStr)
  if (!parts) return null
  const jstMidnightUtc = Date.UTC(parts.y, parts.m - 1, parts.d)
  return new Date(jstMidnightUtc + broadcastMinutes * 60_000 - JST_OFFSET_MS)
}

// isAired 由未播转为已播的那个瞬间。有精确时间时就是播出瞬间，
// 否则是档期次日的本地零点（对应"档期早于今天才算已播"这个旧规则）。
// isAired 直接由它推出，两者共用同一条分界线——否则定时器可能在
// "已到点却仍判为未播" 的缝隙里反复重挂。
export function getAirTransitionInstant(airdateStr: string | undefined, broadcastMinutes?: number): Date | null {
  if (!airdateStr) return null
  const instant = getAirInstant(airdateStr, broadcastMinutes)
  if (instant) return instant
  // 用日期分量构造本地时间，避免 new Date('2026-08-04') 按 UTC 零点解析、
  // 在 UTC 负偏移时区整体错一天。
  const parts = parseDateParts(airdateStr)
  if (!parts) return null
  return new Date(parts.y, parts.m - 1, parts.d + 1)
}

export function isAired(airdateStr: string | undefined, broadcastMinutes?: number): boolean {
  const transition = getAirTransitionInstant(airdateStr, broadcastMinutes)
  return transition !== null && transition.getTime() <= Date.now()
}

export function getSubjectId(item: any): number {
  return item.subjectId || item.subject?.id || item.subject_id
}

export function getSubjectDisplayTitle(subjectOrCollectionItem: any, preferChineseTitle = true): string {
  const subject = subjectOrCollectionItem?.subject || subjectOrCollectionItem
  const rawName = typeof subject?.name === 'string' ? subject.name : ''
  const chineseName = typeof subject?.name_cn === 'string' && subject.name_cn
    ? subject.name_cn
    : (typeof subject?.nameCn === 'string' ? subject.nameCn : '')

  return (preferChineseTitle ? chineseName || rawName : rawName || chineseName) || '未知'
}

export function getSubjectSearchText(subjectOrCollectionItem: any): string {
  const subject = subjectOrCollectionItem?.subject || subjectOrCollectionItem
  return [subject?.name_cn, subject?.nameCn, subject?.name]
    .filter(name => typeof name === 'string' && name)
    .join(' ')
    .toLowerCase()
}

export function getEpisodeNumber(ep: any): number {
  const rawNumber = ep?.episode?.sort ?? ep?.episode?.ep ?? ep?.sort ?? ep?.ep
  return Number(rawNumber)
}

export function isMainStoryEpisode(ep: any): boolean {
  const epNumber = getEpisodeNumber(ep)
  // Bangumi 的 EpType：本篇 = 0，OP = 2，ED = 3。
  const episodeKind = ep?.episode?.type
  return Number.isInteger(epNumber) && epNumber > 0 && episodeKind !== 2 && episodeKind !== 3
}

export function filterMainStoryEpisodes(eps: any[]): any[] {
  return eps.filter(isMainStoryEpisode)
}

export function calcUnwatchedCount(eps: any[], broadcastMinutes?: number): number {
  return eps.filter(ep => isMainStoryEpisode(ep) && isAired(ep.episode?.airdate, broadcastMinutes) && ep.type !== 2).length
}

export function getNextEpisode(eps: any[], broadcastMinutes?: number): any | null {
  return eps.find(ep => isMainStoryEpisode(ep) && !isAired(ep.episode?.airdate, broadcastMinutes) && ep.type !== 2) || null
}

// 同样按日期分量构造本地时间，否则 UTC 负偏移时区显示的日期和星期会差一天。
export function formatAirDate(dateStr: string): string {
  if (!dateStr) return ''
  const parts = parseDateParts(dateStr)
  if (!parts) return ''
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(parts.y, parts.m - 1, parts.d).getDay()]
  return `${parts.m}月${parts.d}日 ${weekday}`
}

// 下一集标签：有精确播出时间时补上 fankuhub 风格的时刻（如 "8月4日 周二 25:30"），
// 时刻沿用日本放送惯例（>=24:00 表示跨日），无精确时间则仅显示日期。
export function formatNextEpisode(dateStr: string, broadcastMinutes?: number): string {
  const base = formatAirDate(dateStr)
  if (!base || typeof broadcastMinutes !== 'number') return base
  const hour = Math.floor(broadcastMinutes / 60)
  const minute = broadcastMinutes % 60
  return `${base} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function formatTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return `${Math.floor(diff / 86400000)}天前`
}
