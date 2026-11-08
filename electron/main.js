const { app, BrowserWindow } = require('electron');
const path = require('path');
const { initLogFile, log } = require('./main/log');
const { setStore, getAppState } = require('./main/app-context');
const { createTray } = require('./main/tray-controller');
const { createPopoverWindow, togglePopover, hidePopover, openSettings } = require('./main/window-controller');
const { setupUrlScheme, handleLaunchArgs } = require('./main/protocol-controller');
const { getPlatformAdapter } = require('./main/platform');
const { setupIPC } = require('./main/ipc');

if (process.env.ELECTRON_DISABLE_SANDBOX === '1') {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-gpu');
  app.disableHardwareAcceleration();
}

if (process.env.BANGUMIBAR_LOCAL_USER_DATA === '1') {
  app.setPath('userData', path.join(process.cwd(), '.electron-user-data'));
}

function setupSingleInstance() {
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    log('Another instance is already running, quitting...');
    app.quit();
    return false;
  }

  app.on('second-instance', (_event, commandLine) => {
    handleLaunchArgs(app, commandLine);

    const { popoverWindow } = getAppState();
    if (popoverWindow) {
      if (popoverWindow.isMinimized()) popoverWindow.restore();
      popoverWindow.show();
    }
  });

  return true;
}

if (!setupSingleInstance()) {
  app.quit();
}

app.whenReady().then(() => {
  initLogFile(app);
  log('App starting...');

  getPlatformAdapter().hideDockIcon(app);

  const Store = require('electron-store');
  setStore(new Store());

  setupUrlScheme(app);
  setupIPC(app);
  createTray(app, { togglePopover, hidePopover, openSettings });
  log('Tray created successfully');
  handleLaunchArgs(app, process.argv);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createPopoverWindow(app);
    }
  });
});

app.on('window-all-closed', () => {});
app.on('before-quit', () => {
  app.isQuitting = true;
});
