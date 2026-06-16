const path = require('path');
const { BrowserWindow, screen } = require('electron');
const { getAppState, setPopoverWindow, setSettingsWindow, clearHideTimeout, consumePendingAuthCallback } = require('./app-context');
const { log } = require('./log');
const { getPlatformAdapter } = require('./platform');

function getRendererFile() {
  return path.join(__dirname, '../../dist/index.html');
}

function createPopoverWindow(app) {
  const { popoverWindow } = getAppState();
  if (popoverWindow) return popoverWindow;
  const platformAdapter = getPlatformAdapter();


  const window = new BrowserWindow({
    width: 360,
    height: 520,
    show: false,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: false,
    backgroundColor: '#000000',
    hasShadow: true,
    ...platformAdapter.getPopoverWindowOptions(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // 拆分后的 preload 需要加载本地模块，关闭 sandbox 以保留 CommonJS require 能力。
      sandbox: false,
      preload: path.join(__dirname, '../preload.js'),
      webSecurity: false,
    },
  });

  setPopoverWindow(window);

  log('Popover window: creating with', getRendererFile());
  window.loadFile(getRendererFile());
  window.once('ready-to-show', () => {
    log('Popover window: ready-to-show - showing');
    window.show();
  });
  window.webContents.on('did-finish-load', () => {
    log('Popover window: did-finish-load');
    window.webContents.send('window-ready');
    const pendingAuthCallback = consumePendingAuthCallback();
    if (pendingAuthCallback) {
      // 登录回调可能发生在窗口尚未完成加载时，这里在渲染进程就绪后补发。
      window.webContents.send('auth-callback', pendingAuthCallback);
      window.show();
    }
  });
  window.webContents.on('did-fail-load', (_event, errCode, errDesc) => log('Popover window: FAIL load', errCode, errDesc));
  window.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) log('Console ERROR:', message);
  });
  window.webContents.on('render-process-gone', (_event, details) => {
    log('Popover: render-process-gone', details.reason);
  });
  window.webContents.on('crashed', () => {
    log('Popover: CRASHED');
  });

  // 悬浮窗失焦后自动隐藏，保持当前菜单栏工具的使用手感。
  window.on('blur', () => {
    if (!app.isQuitting) {
      window.hide();
    }
  });

  window.on('closed', () => {
    const { popoverWindow: currentWindow } = getAppState();
    if (currentWindow === window) {
      setPopoverWindow(null);
    }
  });

  window.on('close', event => {
    if (!app.isQuitting) {
      event.preventDefault();
      window.hide();
    }
  });

  return window;
}

function togglePopover(app) {
  const window = createPopoverWindow(app);
  const platformAdapter = getPlatformAdapter();


  if (window.isVisible()) {
    window.hide();
    return;
  }

  clearHideTimeout();

  const { tray } = getAppState();
  const trayBounds = tray?.getBounds();
  const windowBounds = window.getBounds();

  if (trayBounds && windowBounds) {
    const display = screen.getDisplayNearestPoint({
      x: Math.round(trayBounds.x + trayBounds.width / 2),
      y: Math.round(trayBounds.y + trayBounds.height / 2),
    });
    const position = platformAdapter.getPopoverPosition({
      trayBounds,
      windowBounds,
      workArea: display.workArea,
      displayBounds: display.bounds,
    });
    window.setPosition(position.x, position.y, false);
  }

  window.show();
}

function openSettings(app) {
  const { popoverWindow, settingsWindow } = getAppState();

  popoverWindow?.hide();
  if (settingsWindow) {
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow;
  }

  const window = new BrowserWindow({
    width: 400,
    height: 500,
    title: '设置',
    backgroundColor: '#1e1e1e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // 设置窗口与主悬浮窗共用 preload，保持桥接能力一致。
      sandbox: false,
      preload: path.join(__dirname, '../preload.js'),
    },
  });

  setSettingsWindow(window);
  window.loadFile(getRendererFile(), { hash: 'settings' });
  window.on('closed', () => {
    const { settingsWindow: currentWindow } = getAppState();
    if (currentWindow === window) {
      setSettingsWindow(null);
    }
  });

  return window;
}

module.exports = {
  createPopoverWindow,
  togglePopover,
  openSettings,
};
