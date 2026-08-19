import { desktopApi } from '../../platform/desktop-api'

// 每部番的精确播出时间（JST 分钟数），以 Bangumi subject ID 为键。
// 实际抓取与解析在主进程完成（见 electron/main/schedule-controller.js），
// 这里只负责缓存与降级，渲染层不再需要跨域请求能力。
const SCHEDULE_CACHE_KEY = 'bangumibar_schedule_map'
const SCHEDULE_TTL_MS = 6 * 60 * 60 * 1000

// subjectId -> broadcastTimeMinutes（JST 零点起算的分钟数，>=1440 表示跨日深夜档）
export type ScheduleMap = Record<number, number>

// unavailable: 既没抓到也没有可用缓存，此时精确时间整体失效。
export type ScheduleLoadResult = { map: ScheduleMap; unavailable: boolean }

type CacheEnvelope = {
  data: ScheduleMap
  expiry: number
}

function readCache(): ScheduleMap | null {
  try {
    const raw = localStorage.getItem(SCHEDULE_CACHE_KEY)
    if (!raw) return null
    const { data, expiry } = JSON.parse(raw) as CacheEnvelope
    if (Date.now() > expiry) {
      localStorage.removeItem(SCHEDULE_CACHE_KEY)
      return null
    }
    return data
  } catch {
    return null
  }
}

function writeCache(data: ScheduleMap) {
  try {
    localStorage.setItem(SCHEDULE_CACHE_KEY, JSON.stringify({ data, expiry: Date.now() + SCHEDULE_TTL_MS }))
  } catch {}
}

export const scheduleService = {
  // 优先返回缓存；无缓存或强制刷新时向主进程取。
  // 取不到时回退到旧缓存，连旧缓存也没有才算不可用——
  // 此时各工具函数退回按日期判断，UI 借 unavailable 提示这一降级。
  async load({ force = false }: { force?: boolean } = {}): Promise<ScheduleLoadResult> {
    if (!force) {
      const cached = readCache()
      if (cached) return { map: cached, unavailable: false }
    }

    try {
      const map = await desktopApi.getBroadcastSchedule()
      if (map && Object.keys(map).length > 0) {
        writeCache(map)
        return { map, unavailable: false }
      }
    } catch {}

    const fallback = readCache()
    return { map: fallback || {}, unavailable: !fallback }
  }
}
