const { getAppState } = require('./app-context');
const { getPlatformAdapter } = require('./platform');

function getAppSettings() {
  const { store } = getAppState();

  return {
    openAtLogin: store.get('openAtLogin', false),
    showNotifications: store.get('showNotifications', true),
    useMirror: store.get('useMirror', false),
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
}

module.exports = {
  getAppSettings,
  setAppSettings,
};
