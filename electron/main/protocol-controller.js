const { getAppState, setPendingAuthCallback, consumePendingAuthCallback } = require('./app-context');
const { createPopoverWindow } = require('./window-controller');
const { log } = require('./log');
const { getPlatformAdapter } = require('./platform');

function canSendToPopoverWindow(popoverWindow) {
  if (!popoverWindow?.webContents || popoverWindow.webContents.isDestroyed()) {
    return false;
  }

  if (typeof popoverWindow.webContents.isLoadingMainFrame === 'function') {
    return !popoverWindow.webContents.isLoadingMainFrame();
  }

  return !popoverWindow.webContents.isLoading();
}

function dispatchPendingAuthCallback() {
  const { popoverWindow } = getAppState();
  if (!canSendToPopoverWindow(popoverWindow)) {
    return false;
  }

  const payload = consumePendingAuthCallback();
  if (!payload) {
    return false;
  }

  popoverWindow.webContents.send('auth-callback', payload);
  popoverWindow.show();
  return true;
}

function dispatchAuthCallback(app, code, url) {
  // 先缓存回调，再按窗口加载状态选择立即投递或延后重放。
  setPendingAuthCallback({ code, url });

  if (dispatchPendingAuthCallback()) {
    return;
  }

  const window = createPopoverWindow(app);
  window.show();
}

function extractProtocolUrl(commandLine = []) {
  return commandLine.find(arg => typeof arg === 'string' && arg.startsWith('bangumibar://')) || null;
}

function handleLaunchArgs(app, commandLine = []) {
  const url = extractProtocolUrl(commandLine);
  if (url) {
    handleCallback(app, url);
    return true;
  }

  return false;
}

function handleCallback(app, url) {
  log('handleCallback received:', url);

  try {
    const code = new URL(url).searchParams.get('code');
    log('Extracted code:', code);

    if (code) {
      dispatchAuthCallback(app, code, url);
    }
  } catch (error) {
    log('Parse callback URL failed:', error);
  }
}

function setupUrlScheme(app) {
  const platformAdapter = getPlatformAdapter();
  platformAdapter.registerProtocolClient(app);

  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleCallback(app, url);
  });
}

module.exports = {
  setupUrlScheme,
  handleCallback,
  handleLaunchArgs,
  extractProtocolUrl,
  dispatchPendingAuthCallback,
};
