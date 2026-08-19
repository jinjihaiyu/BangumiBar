const { shell } = require('electron');
const { assertAllowedUrl, requestBangumi } = require('./http-controller');

// OAuth 的 client_secret 只留在主进程，不再进渲染层 bundle。
const CLIENT_ID = 'bgm601969ef220ea48ae';
const CLIENT_SECRET = 'adcf8bf04974ddcb88e5425e194da65c';
const REDIRECT_URI = 'bangumibar://auth';

function buildAuthorizeUrl(webBase) {
  // webBase 由渲染层按当前站点（原站/镜像）传入，同样要过白名单。
  const base = assertAllowedUrl(webBase);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
  });

  return `${base.origin}/oauth/authorize?${params}`;
}

function openAuthPage(webBase) {
  return shell.openExternal(buildAuthorizeUrl(webBase));
}

// 换取/刷新令牌：渲染层只给 code 或 refresh_token，凭据由这里补齐。
// 返回值保持 { ok, status, body } 原样，让渲染层沿用原有的错误文案解析。
function exchangeToken({ webBase, grantType, code, refreshToken } = {}) {
  const base = assertAllowedUrl(webBase);
  const params = new URLSearchParams({
    grant_type: grantType,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });

  if (grantType === 'refresh_token') {
    params.set('refresh_token', refreshToken || '');
  } else {
    params.set('code', code || '');
    params.set('redirect_uri', REDIRECT_URI);
  }

  return requestBangumi({
    url: `${base.origin}/oauth/access_token`,
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
}

module.exports = {
  buildAuthorizeUrl,
  exchangeToken,
  openAuthPage,
};
