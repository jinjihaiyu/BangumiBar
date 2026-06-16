const WINDOW_MARGIN = 8;
const WINDOW_GAP = 10;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getPopoverPosition({ trayBounds, windowBounds, workArea }) {
  // 非 macOS 平台先使用保守的锚点策略：优先贴近托盘，并确保窗口不飞出可用工作区。
  const rawX = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
  const showBelowTray = trayBounds.y < workArea.y + workArea.height / 2;
  const rawY = showBelowTray
    ? Math.round(trayBounds.y + trayBounds.height + WINDOW_GAP)
    : Math.round(trayBounds.y - windowBounds.height - WINDOW_GAP);

  return {
    x: clamp(rawX, workArea.x + WINDOW_MARGIN, workArea.x + workArea.width - windowBounds.width - WINDOW_MARGIN),
    y: clamp(rawY, workArea.y + WINDOW_MARGIN, workArea.y + workArea.height - windowBounds.height - WINDOW_MARGIN),
  };
}

function registerProtocolClient() {
  // 当前阶段先保持非 macOS 行为不变，后续再按平台逐步补全协议注册。
}

function applyOpenAtLogin(app, enabled) {
  if (typeof app.setLoginItemSettings !== 'function') return;

  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
  });
}

function getPopoverWindowOptions() {
  return {};
}

module.exports = {
  name: 'fallback',
  getPopoverPosition,
  registerProtocolClient,
  applyOpenAtLogin,
  getPopoverWindowOptions,
};
