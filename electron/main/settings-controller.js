const { getAppState } = require('./app-context');
const { getPlatformAdapter } = require('./platform');

const DEFAULT_MIRROR_DOMAIN = 'bangumi.one';
const DOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

function normalizeMirrorDomain(raw) {
  if (typeof raw !== 'string') return DEFAULT_MIRROR_DOMAIN;
  const cleaned = raw
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .toLowerCase();

  if (!cleaned || !DOMAIN_PATTERN.test(cleaned)) {
    return DEFAULT_MIRROR_DOMAIN;
  }

  return cleaned;
}

function getAppSettings() {
  const { store } = getAppState();

  return {
    openAtLogin: store.get('openAtLogin', false),
    showNotifications: store.get('showNotifications', true),
    useMirror: store.get('useMirror', false),
    mirrorDomain: normalizeMirrorDomain(store.get('mirrorDomain', DEFAULT_MIRROR_DOMAIN)),
  };
}

function setAppSettings(app, settings) {
  const { store } = getAppState();
  const platformAdapter = getPlatformAdapter();

  if ('openAtLogin' in settings) {
    store.set('openAtLogin', settings.openAtLogin);
    // 开机启动改走平台适配层，便于后续补齐 Windows/Linux 细节。
    platformAdapter.applyOpenAtLogin(app, settings.openAtLogin);
  }

  if ('showNotifications' in settings) {
    store.set('showNotifications', settings.showNotifications);
  }

  if ('useMirror' in settings) {
    store.set('useMirror', settings.useMirror);
  }

  if ('mirrorDomain' in settings) {
    store.set('mirrorDomain', normalizeMirrorDomain(settings.mirrorDomain));
  }
}

module.exports = {
  DEFAULT_MIRROR_DOMAIN,
  normalizeMirrorDomain,
  getAppSettings,
  setAppSettings,
};
