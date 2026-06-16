const { ipcMain, shell } = require('electron');
const { getAppState, clearHideTimeout, setHideTimeout } = require('./app-context');
const { getAppSettings, setAppSettings } = require('./settings-controller');
const { showDesktopNotification } = require('./notification-controller');

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

  ipcMain.handle('open-external', (_event, url) => shell.openExternal(url));
  ipcMain.handle('hide-popover', () => getAppState().popoverWindow?.hide());
  ipcMain.handle('cancel-hide', () => clearHideTimeout());
  ipcMain.handle('schedule-hide', (_event, delay) => {
    setHideTimeout(setTimeout(() => {
      getAppState().popoverWindow?.hide();
    }, delay));
  });
  ipcMain.handle('close-settings', () => getAppState().settingsWindow?.close());
  ipcMain.handle('get-version', () => app.getVersion());
  ipcMain.handle('show-notification', (_event, payload) => showDesktopNotification(payload));
  ipcMain.handle('get-app-settings', () => getAppSettings());
  ipcMain.handle('set-app-settings', (_event, settings) => setAppSettings(app, settings));
}

module.exports = {
  setupIPC,
};
