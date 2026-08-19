const { net } = require('electron');
const { log } = require('./log');

// 渲染层已关闭跨域能力（webSecurity 恢复默认 + CSP 的 connect-src 'none'），
// 所有出网请求集中到这里。URL 由渲染层拼好传入，但必须过白名单——
// 白名单才是信任边界，渲染层传的 URL 只是入参。
const ALLOWED_HOSTS = new Set([
  'bgm.tv',
  'api.bgm.tv',
  'bangumi.one',
  'api.bangumi.one',
]);

// Bangumi API 要求带可识别的 UA。放在主进程才真正生效：
// User-Agent 是 fetch 规范里的禁止头，渲染层设了也会被 Chromium 静默丢弃。
const APP_USER_AGENT = 'BangumiBar/1.0 (Electron)';
const DEFAULT_TIMEOUT_MS = 15 * 1000;

function assertAllowedUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    log('Http: rejected malformed url', rawUrl);
    throw new Error('请求地址无效');
  }

  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
    log('Http: rejected url outside allowlist', url.protocol, url.hostname);
    throw new Error(`不允许请求该地址: ${url.hostname}`);
  }

  return url;
}

// 返回 { ok, status, body }：HTTP 错误状态照旧算「请求成功、结果不 ok」，
// 只有网络层失败才抛，与渲染层原来直接用 fetch 的语义保持一致。
async function requestBangumi({ url, method, headers, body, timeoutMs } = {}) {
  const target = assertAllowedUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || DEFAULT_TIMEOUT_MS);

  try {
    const response = await net.fetch(target.toString(), {
      method: method || 'GET',
      // UA 由主进程统一注入，放在前面便于调用方需要时覆盖。
      headers: { 'User-Agent': APP_USER_AGENT, ...(headers || {}) },
      body: body || undefined,
      signal: controller.signal,
    });

    return { ok: response.ok, status: response.status, body: await response.text() };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  APP_USER_AGENT,
  assertAllowedUrl,
  requestBangumi,
};
