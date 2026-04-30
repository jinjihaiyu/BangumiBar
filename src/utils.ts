export function isAired(airdateStr: string | undefined): boolean {
  if (!airdateStr) return false
  const aired = new Date(airdateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return aired < today
}

export function calcUnwatchedCount(eps: any[]): number {
  return eps.filter(ep => isAired(ep.episode?.airdate) && ep.type !== 2).length
}

export function getNextEpisode(eps: any[]): any | null {
  return eps.find(ep => !isAired(ep.episode?.airdate) && ep.type !== 2) || null
}

export function formatAirDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weekday}`
}

export function formatTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return `${Math.floor(diff / 86400000)}天前`
}
