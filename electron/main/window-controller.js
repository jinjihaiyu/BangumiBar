const path = require('path');
const { BrowserWindow, screen } = require('electron');
const { getAppState, setPopoverWindow, setSettingsWindow, clearHideTimeout, setHideTimeout, consumePendingAuthCallback } = require('./app-context');
const { log } = require('./log');
const { getPlatformAdapter } = require('./platform');

const POPOVER_HIDE_ANIMATION_MS = 130;
let popoverPhase = 'hidden';
let popoverPendingShow = false;

function presentPopover(window) {
  popoverPendingShow = false;
  popoverPhase = 'shown';
  window.show();
  window.focus();
  log('Popover showing:', {
    visible: window.isVisible(),
    bounds: window.getBounds(),
  });
  sendPopoverVisibility(true);
}

function getRendererFile() {
  return path.join(__dirname, '../../dist/index.html');
}

function createPopoverWindow(app) {
  const { popoverWindow } = getAppState();
  if (popoverWindow) return popoverWindow;
  const platformAdapter = getPlatformAdapter();


  const window = new BrowserWindow({
    width: 360,
    height: 540,
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
    },
  });

  setPopoverWindow(window);

  log('Popover window: creating with', getRendererFile());
  window.loadFile(getRendererFile());
  window.webContents.on('did-finish-load', () => {
    log('Popover window: did-finish-load');
    window.webContents.send('window-ready');
    // did-finish-load 是首次点击最终可见的兜底入口。
    if (popoverPendingShow) {
      presentPopover(window);
    }
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

  // 悬浮窗失焦后自动隐藏，保持 macOS popover 的使用手感。
  // 点击托盘本身也会让窗口失焦；用托盘激活时间戳区分这两种场景。
  window.on('blur', () => {
    const { isTrayActivationFresh } = require('./app-context');
    if (!app.isQuitting && !isTrayActivationFresh()) {
      hidePopover(app);
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

function sendPopoverVisibility(visible) {
  const { popoverWindow } = getAppState();
  if (!popoverWindow || popoverWindow.isDestroyed() || popoverWindow.webContents.isDestroyed()) return;
  popoverWindow.webContents.send('popover-visibility', visible);
}

function hidePopover(app, { animated = true } = {}) {
  const { popoverWindow } = getAppState();
  if (!popoverWindow || popoverWindow.isDestroyed() || !popoverWindow.isVisible()) {
    popoverPhase = 'hidden';
    popoverPendingShow = false;
    return;
  }

  if (!animated) {
    clearHideTimeout();
    popoverPhase = 'hidden';
    popoverPendingShow = false;
    popoverWindow.hide();
    return;
  }

  clearHideTimeout();
  popoverPhase = 'hiding';
  sendPopoverVisibility(false);
  setHideTimeout(setTimeout(() => {
    if (!popoverWindow.isDestroyed() && popoverWindow.isVisible()) {
      popoverWindow.hide();
    }
    popoverPhase = 'hidden';
  }, POPOVER_HIDE_ANIMATION_MS), POPOVER_HIDE_ANIMATION_MS);
}

function showPopover(app) {
  const window = createPopoverWindow(app);
  const platformAdapter = getPlatformAdapter();
  clearHideTimeout();
  popoverPendingShow = false;

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

  // 首次点击时等待渲染完成，避免透明窗口先闪出一帧空面板。
  if (window.webContents.isLoading()) {
    popoverPhase = 'showing';
    popoverPendingShow = true;
    window.once('ready-to-show', () => {
      if (popoverPendingShow) presentPopover(window);
    });
    return;
  }

  presentPopover(window);
}

function togglePopover(app) {
  const window = createPopoverWindow(app);

  // 关闭动画还未结束时再次点击，取消关闭比重新开关更符合直觉。
  if (popoverPhase === 'hiding') {
    clearHideTimeout();
    popoverPhase = 'shown';
    if (window.isVisible()) {
      sendPopoverVisibility(true);
    } else {
      showPopover(app);
    }
    return;
  }

  if (popoverPhase === 'showing') return;

  if (window.isVisible()) {
    hidePopover(app);
    return;
  }

  showPopover(app);
}

function openSettings(app) {
  const { popoverWindow, settingsWindow } = getAppState();

  hidePopover(app, { animated: false });
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
  hidePopover,
  openSettings,
};
