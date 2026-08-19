import { useCallback, useEffect, useState } from 'react'
import { scheduleService, type ScheduleMap } from '../services/schedule-service'

// 加载 fankuhub 放送表，得到 subjectId -> 精确播出分钟数的映射。
// 抓取失败且无缓存时映射为空，各处工具函数会自动回退到按日期判断，
// scheduleUnavailable 让 UI 能把这种降级和「这部番本来就没精确时间」区分开。
export function useSchedule(enabled: boolean) {
  const [scheduleMap, setScheduleMap] = useState<ScheduleMap>({})
  const [scheduleUnavailable, setScheduleUnavailable] = useState(false)

  const loadSchedule = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
    const { map, unavailable } = await scheduleService.load({ force })
    setScheduleMap(map)
    setScheduleUnavailable(unavailable)
  }, [])

  useEffect(() => {
    if (!enabled) {
      setScheduleMap({})
      setScheduleUnavailable(false)
      return
    }
    void loadSchedule()
  }, [enabled, loadSchedule])

  return { scheduleMap, scheduleUnavailable, loadSchedule }
}
