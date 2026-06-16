const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell, Notification, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let LOG_FILE = null;
let store = null;

if (process.env.ELECTRON_DISABLE_SANDBOX === '1') {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-gpu');
  app.disableHardwareAcceleration();
}

if (process.env.BANGUMIBAR_LOCAL_USER_DATA === '1') {
  app.setPath('userData', path.join(process.cwd(), '.electron-user-data'));
}

function log(...args) {
  const timestamp = new Date().toISOString();
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  const logLine = `[${timestamp}] ${message}\n`;
  if (LOG_FILE) {
    try {
      fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
      fs.appendFileSync(LOG_FILE, logLine);
    } catch {
      LOG_FILE = null;
    }
  }
  console.log(...args);
}

function getAppSettings() {
  return {
    openAtLogin: store.get('openAtLogin', false),
    showNotifications: store.get('showNotifications', true),
    hideAfterClick: store.get('hideAfterClick', true),
    useMirror: store.get('useMirror', false),
  };
}

function setAppSettings(settings) {
  if ('openAtLogin' in settings) {
    store.set('openAtLogin', settings.openAtLogin);
    app.setLoginItemSettings({
      openAtLogin: settings.openAtLogin,
      path: process.execPath,
    });
  }
  if ('showNotifications' in settings) {
    store.set('showNotifications', settings.showNotifications);
  }
  if ('hideAfterClick' in settings) {
    store.set('hideAfterClick', settings.hideAfterClick);
  }
  if ('useMirror' in settings) {
    store.set('useMirror', settings.useMirror);
  }
}

let tray = null;
let popoverWindow = null;
let settingsWindow = null;

function createTrayIcon() {
  const icon2x = path.join(__dirname, 'icon@2x.png');
  const icon1x = path.join(__dirname, 'icon.png');
  log('Tray icon paths:', icon2x, icon1x);
  const icon2xImg = nativeImage.createFromPath(icon2x);
  log('icon@2x size:', icon2xImg.getSize().width, 'x', icon2xImg.getSize().height, 'isEmpty:', icon2xImg.isEmpty());
  if (!icon2xImg.isEmpty()) return icon2xImg;
  const icon1xImg = nativeImage.createFromPath(icon1x);
  log('icon 1x size:', icon1xImg.getSize().width, 'x', icon1xImg.getSize().height, 'isEmpty:', icon1xImg.isEmpty());
  if (!icon1xImg.isEmpty()) return icon1xImg;
  log('ERROR: Both icon files failed to load!');
  return nativeImage.createEmpty();
}

function setupIPC() {
  ipcMain.handle('get-store', (_e, key) => store.get(key));
  ipcMain.handle('set-store', (_e, key, value) => store.set(key, value));
  ipcMain.handle('delete-store', (_e, key) => store.delete(key));
  ipcMain.handle('open-external', (_e, url) => shell.openExternal(url));
  ipcMain.handle('hide-popover', () => popoverWindow?.hide());
  ipcMain.handle('cancel-hide', () => {
    if (hideTimeout) { clearTimeout(hideTimeout); hideTimeout = null; }
  });
  ipcMain.handle('schedule-hide', (_e, delay) => {
    if (hideTimeout) { clearTimeout(hideTimeout); hideTimeout = null; }
    hideTimeout = setTimeout(() => popoverWindow?.hide(), delay);
  });
  ipcMain.handle('close-settings', () => settingsWindow?.close());
  ipcMain.handle('get-version', () => app.getVersion());
  ipcMain.handle('show-notification', (_e, { title, body }) => {
    if (!Notification.isSupported()) return;
    const n = new Notification({ title, body, silent: false });
    n.show();
  });
  ipcMain.handle('get-app-settings', () => getAppSettings());
  ipcMain.handle('set-app-settings', (_e, settings) => setAppSettings(settings));
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('BangumiBar');
  tray.on('click', () => togglePopover());
  updateTrayMenu();
}

function updateTrayMenu() {
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示/隐藏', click: () => togglePopover() },
    { label: '设置', click: () => openSettings() },
    { type: 'separator' },
    { label: '关于', click: () => showAbout() },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuitting = true; app.quit(); } }
  ]));
}

let hideTimeout = null;

function togglePopover() {
  if (!popoverWindow) createPopoverWindow();
  if (popoverWindow.isVisible()) {
    popoverWindow.hide();
  } else {
    if (hideTimeout) { clearTimeout(hideTimeout); hideTimeout = null; }

    const trayBounds = tray?.getBounds();
    const windowBounds = popoverWindow?.getBounds();
    if (trayBounds && windowBounds) {
      const x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
      const y = Math.round(trayBounds.y - windowBounds.height - 10);
      popoverWindow?.setPosition(x, y, false);
    }
    popoverWindow?.show();
  }
}

function createPopoverWindow() {
  popoverWindow = new BrowserWindow({
    width: 360, height: 520, show: false, frame: false, resizable: false,
    skipTaskbar: true, alwaysOnTop: true, transparent: false,
    backgroundColor: '#000000',
    hasShadow: true,
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'), webSecurity: false
    }
  });
  log('Popover window: creating with', path.join(__dirname, '../dist/index.html'));
  popoverWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  popoverWindow.once('ready-to-show', () => {
    log('Popover window: ready-to-show - showing');
    popoverWindow?.show();
  });
  popoverWindow.webContents.on('did-finish-load', () => {
    log('Popover window: did-finish-load');
    popoverWindow?.webContents.send('window-ready');
  });
  popoverWindow.webContents.on('did-fail-load', (_e, errCode, errDesc) => log('Popover window: FAIL load', errCode, errDesc));
  popoverWindow.webContents.on('console-message', (_e, level, msg) => { if (level >= 2) log('Console ERROR:', msg); });
  popoverWindow.webContents.on('render-process-gone', (_e, details) => log('Popover: render-process-gone', details.reason));
  popoverWindow.webContents.on('crashed', () => log('Popover: CRASHED'));

  popoverWindow.on('blur', () => {
    if (!app.isQuitting) {
      popoverWindow?.hide();
    }
  });

  popoverWindow.on('close', (e) => { if (!app.isQuitting) { e.preventDefault(); popoverWindow?.hide(); } });
}

function openSettings() {
  popoverWindow?.hide();
  if (settingsWindow) { settingsWindow.show(); settingsWindow.focus(); return; }
  settingsWindow = new BrowserWindow({
    width: 400, height: 500, title: '设置', backgroundColor: '#1e1e1e',
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') }
  });
  settingsWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: 'settings' });
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

function showAbout() {
  dialog.showMessageBox({
    type: 'info', title: '关于 BangumiBar', message: 'BangumiBar v1.0.0',
    detail: 'Bangumi 追番管理菜单栏应用\n\nMade with ❤️ for Bangumi users'
  });
}

function setupUrlScheme() {
  if (process.platform === 'darwin') app.setAsDefaultProtocolClient('bangumibar');
  app.on('open-url', (e, url) => { e.preventDefault(); handleCallback(url); });
}

function handleCallback(url) {
  log('handleCallback received:', url);
  try {
    const code = new URL(url).searchParams.get('code');
    log('Extracted code:', code);
    if (code) {
      if (popoverWindow?.webContents) {
        popoverWindow.webContents.send('auth-callback', { code, url });
        popoverWindow.show();
      } else {
        createPopoverWindow();
        setTimeout(() => {
          if (popoverWindow?.webContents) {
            popoverWindow.webContents.send('auth-callback', { code, url });
            popoverWindow.show();
          }
        }, 1000);
      }
    }
  } catch (err) { log('Parse callback URL failed:', err); }
}

app.whenReady().then(() => {
  LOG_FILE = path.join(app.getPath('userData'), 'bangumibar.log');
  log('App starting...');

  const Store = require('electron-store');
  store = new Store();

  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    log('Another instance is already running, quitting...');
    app.quit();
    return;
  }
  app.on('second-instance', (_e, cmd) => {
    const url = cmd.find(a => a.startsWith('bangumibar://'));
    if (url) handleCallback(url);
    if (popoverWindow) {
      if (popoverWindow.isMinimized()) popoverWindow.restore();
      popoverWindow.show();
    }
  });

  app.on('certificate-error', (e) => { e.preventDefault(); arguments[arguments.length - 1](true); });
  require('electron').session.defaultSession.webRequest.onHeadersReceived((d, cb) => cb({ responseHeaders: d.responseHeaders }));
  setupUrlScheme();
  setupIPC();
  createTray();
  log('Tray created successfully');
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createPopoverWindow(); });
});

app.on('window-all-closed', () => {});
app.on('before-quit', () => { app.isQuitting = true; });
