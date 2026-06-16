const path = require('path');

const WINDOW_MARGIN = 8;
const WINDOW_GAP = 10;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getReservedEdge({ workArea, displayBounds }) {
  if (workArea.x > displayBounds.x) return 'left';
  if (workArea.y > displayBounds.y) return 'top';
  if (workArea.width < displayBounds.width) return 'right';
  if (workArea.height < displayBounds.height) return 'bottom';
  return 'top';
}

function getPopoverPosition({ trayBounds, windowBounds, workArea, displayBounds }) {
  // Linux 面板实现差异较大，这里先提供一个稳妥的锚点定位并强制限制在工作区内。
  const edge = getReservedEdge({ workArea, displayBounds });
  let rawX = trayBounds.x;
  let rawY = trayBounds.y;

  if (edge === 'top') {
    rawX = trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2;
    rawY = trayBounds.y + trayBounds.height + WINDOW_GAP;
  } else if (edge === 'bottom') {
    rawX = trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2;
    rawY = trayBounds.y - windowBounds.height - WINDOW_GAP;
  } else if (edge === 'left') {
    rawX = trayBounds.x + trayBounds.width + WINDOW_GAP;
    rawY = trayBounds.y + trayBounds.height / 2 - windowBounds.height / 2;
  } else {
    rawX = trayBounds.x - windowBounds.width - WINDOW_GAP;
    rawY = trayBounds.y + trayBounds.height / 2 - windowBounds.height / 2;
  }

  return {
    x: clamp(Math.round(rawX), workArea.x + WINDOW_MARGIN, workArea.x + workArea.width - windowBounds.width - WINDOW_MARGIN),
    y: clamp(Math.round(rawY), workArea.y + WINDOW_MARGIN, workArea.y + workArea.height - windowBounds.height - WINDOW_MARGIN),
  };
}

function registerProtocolClient(app) {
  if (process.defaultApp && process.argv[1]) {
    app.setAsDefaultProtocolClient('bangumibar', process.execPath, [path.resolve(process.argv[1])]);
    return;
  }

  app.setAsDefaultProtocolClient('bangumibar');
}

function applyOpenAtLogin(app, enabled) {
  if (typeof app.setLoginItemSettings !== 'function') return;

  // Linux 的登录项支持依赖桌面环境，先统一走 Electron 提供的入口。
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
  });
}

function getPopoverWindowOptions() {
  return {};
}

module.exports = {
  name: 'linux',
  getPopoverPosition,
  registerProtocolClient,
  applyOpenAtLogin,
  getPopoverWindowOptions,
};
