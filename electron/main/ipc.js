const { ipcMain, shell } = require('electron');
const { getAppState, clearHideTimeout, setHideTimeout } = require('./app-context');
const { getAppSettings, setAppSettings } = require('./settings-controller');
const { showDesktopNotification } = require('./notification-controller');
const { fetchBroadcastSchedule } = require('./schedule-controller');
const { requestBangumi } = require('./http-controller');
const { exchangeToken, openAuthPage } = require('./auth-controller');
const { hidePopover } = require('./window-controller');

function broadcastToOtherWindows(sender, channel, payload) {
  const { popoverWindow, settingsWindow } = getAppState();
  for (const win of [popoverWindow, settingsWindow]) {
    if (!win || win.isDestroyed() || win.webContents.isDestroyed()) continue;
    if (sender && win.webContents === sender) continue;
    win.webContents.send(channel, payload);
  }
}

function setupIPC(app) {
  ipcMain.handle('get-store', (_event, key) => {
    const { store } = getAppState();
    return store.get(key);
  });

  ipcMain.handle('set-store', (_event, key, value) => {
    const { store } = getAppState();
    return store.set(key, value);
  });

  ipcMain.handle('delete-store', (_event, key) => {
    const { store } = getAppState();
    return store.delete(key);
  });

  ipcMain.handle('open-external', (_event, rawUrl) => {
    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return Promise.reject(new Error('无效的外部链接'));
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return Promise.reject(new Error(`不允许打开该协议的链接: ${parsed.protocol}`));
    }

    return shell.openExternal(parsed.toString());
  });
  ipcMain.handle('hide-popover', () => hidePopover(app));
  ipcMain.handle('cancel-hide', () => clearHideTimeout());
  ipcMain.handle('schedule-hide', (_event, delay) => {
    setHideTimeout(setTimeout(() => {
      hidePopover(app, { animated: false });
    }, delay));
  });
  ipcMain.handle('close-settings', () => getAppState().settingsWindow?.close());
  ipcMain.handle('get-version', () => app.getVersion());
  ipcMain.handle('show-notification', (_event, payload) => showDesktopNotification(payload));
  ipcMain.handle('get-app-settings', () => getAppSettings());
  ipcMain.handle('set-app-settings', (event, settings) => {
    setAppSettings(app, settings);
    broadcastToOtherWindows(event.sender, 'app-settings-changed', getAppSettings());
  });
  ipcMain.handle('notify-auth-changed', (event, payload) => {
    broadcastToOtherWindows(event.sender, 'auth-state-changed', payload);
  });
  ipcMain.handle('get-broadcast-schedule', () => fetchBroadcastSchedule());

  // 渲染层不再有跨域能力，Bangumi 的接口请求统一从这里出网（主机白名单在 http-controller）。
  ipcMain.handle('bangumi-request', (_event, options) => requestBangumi(options));
  ipcMain.handle('bangumi-oauth-token', (_event, options) => exchangeToken(options));
  ipcMain.handle('bangumi-open-auth-page', (_event, webBase) => openAuthPage(webBase));
}

module.exports = {
  setupIPC,
};
