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
  return 'bottom';
}

function getPopoverPosition({ trayBounds, windowBounds, workArea, displayBounds }) {
  // Windows 下任务栏方向不固定，优先根据工作区推断任务栏边缘后再贴边显示。
  const edge = getReservedEdge({ workArea, displayBounds });
  let rawX = trayBounds.x;
  let rawY = trayBounds.y;

  if (edge === 'bottom') {
    rawX = trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2;
    rawY = trayBounds.y - windowBounds.height - WINDOW_GAP;
  } else if (edge === 'top') {
    rawX = trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2;
    rawY = trayBounds.y + trayBounds.height + WINDOW_GAP;
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
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
  });
}

function getPopoverWindowOptions() {
  return {};
}

module.exports = {
  name: 'win',
  getPopoverPosition,
  registerProtocolClient,
  applyOpenAtLogin,
  getPopoverWindowOptions,
};
