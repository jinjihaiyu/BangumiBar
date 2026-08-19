const { net } = require('electron');
const { log } = require('./log');

// 放送表抓取放在主进程：渲染层不再需要跨域 fetch，
// 所以窗口的 webSecurity 恢复默认值后这个功能照旧。
const FANKUHUB_HOME = 'https://fankuhub.com/';

// fankuhub 是 Next.js，服务端把数据以 self.__next_f.push([1,"..."]) 的分片流式塞进 HTML。
// 拼接所有分片得到一段完整文本，再从中定位 "schedule":{...} 对象。
function collectNextFlightPayload(html) {
  const pushRegex = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let combined = '';
  let match;
  while ((match = pushRegex.exec(html)) !== null) {
    try {
      // 分片本身是一个 JSON 字符串字面量，用 JSON.parse 还原转义。
      combined += JSON.parse(`"${match[1]}"`);
    } catch {
      combined += match[1];
    }
  }
  return combined;
}

// 从 payload 中 "schedule": 之后做花括号配对，抽出完整对象文本。
function extractScheduleObject(payload) {
  const marker = '"schedule":';
  const markerIndex = payload.indexOf(marker);
  if (markerIndex === -1) return null;

  const start = payload.indexOf('{', markerIndex + marker.length);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < payload.length; i++) {
    const ch = payload[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return payload.slice(start, i + 1);
    }
  }

  return null;
}

// sourceCoverUrl 形如 https://lain.bgm.tv/pic/cover/l/xx/yy/637339_xxx.jpg，
// 其中的数字段即 Bangumi subject id。
function extractSubjectId(sourceCoverUrl) {
  if (typeof sourceCoverUrl !== 'string') return null;
  const match = sourceCoverUrl.match(/\/(\d+)_[^/]*\.(?:jpg|jpeg|png|webp)/i);
  return match ? Number(match[1]) : null;
}

function parseScheduleMap(html) {
  const payload = collectNextFlightPayload(html);
  const objectText = extractScheduleObject(payload);
  if (!objectText) return {};

  let schedule;
  try {
    schedule = JSON.parse(objectText);
  } catch {
    return {};
  }

  const map = {};
  for (const items of Object.values(schedule)) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const subjectId = extractSubjectId(item && item.sourceCoverUrl);
      const minutes = item && item.broadcastTimeMinutes;
      if (subjectId !== null && typeof minutes === 'number') {
        map[subjectId] = minutes;
      }
    }
  }
  return map;
}

// 连点刷新时复用同一次请求，避免重复拉取整页 HTML。
let inFlightRequest = null;
// 并发去重挡不住连续的强制刷新，再加一个时间下限：
// 首页约 800KB，而放送表按周排，一分钟内不可能变。
const MIN_REFETCH_INTERVAL_MS = 60 * 1000;
let lastResult = null;

async function fetchBroadcastSchedule() {
  if (inFlightRequest) return inFlightRequest;
  if (lastResult && Date.now() - lastResult.time < MIN_REFETCH_INTERVAL_MS) {
    return lastResult.map;
  }

  inFlightRequest = (async () => {
    try {
      // 用 Electron 的 net.fetch 而非 Node 全局 fetch：走 Chromium 网络栈，
      // 与渲染层原有行为一致，能沿用应用的代理设置。
      // UA 保持 Chromium 默认，不套用 http-controller 里那个 BangumiBar UA：
      // 这里抓的是 HTML 页面，换 UA 可能拿到不同的标记，解析规则会跟着失配。
      const response = await net.fetch(FANKUHUB_HOME, {
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (!response.ok) {
        log('Schedule: fetch failed with status', response.status);
        return {};
      }

      const html = await response.text();
      const map = parseScheduleMap(html);
      const count = Object.keys(map).length;

      // 解析出 0 条通常意味着 fankuhub 改版导致结构失配，记一条日志便于排查。
      if (count === 0) log('Schedule: parsed 0 entries - page structure may have changed');
      else log('Schedule: parsed', count, 'entries');
      // 只缓存成功结果，失败下次仍会重试。
      if (count > 0) lastResult = { map, time: Date.now() };

      return map;
    } catch (error) {
      log('Schedule: fetch error', error && error.message);
      return {};
    } finally {
      inFlightRequest = null;
    }
  })();

  return inFlightRequest;
}

module.exports = {
  fetchBroadcastSchedule,
};
