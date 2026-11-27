const WINDOW_MARGIN = 8;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getPopoverPosition({ trayBounds, windowBounds, workArea }) {
  // MacBook 刘海屏托盘被遮挡或刚初始化时 trayBounds 可能为 0x0，回退到右上角展示。
  const hasTrayBounds = Boolean(trayBounds && (trayBounds.width > 0 || trayBounds.height > 0));
  const rawX = hasTrayBounds
    ? Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2)
    : Math.round((workArea ? workArea.x + workArea.width : windowBounds.width) - windowBounds.width - WINDOW_MARGIN);
  const rawY = hasTrayBounds
    ? Math.round(trayBounds.y + trayBounds.height + 6)
    : Math.round((workArea ? workArea.y : 0) + WINDOW_MARGIN);

  if (!workArea) {
    return { x: rawX, y: rawY };
  }

  return {
    x: clamp(rawX, workArea.x + WINDOW_MARGIN, workArea.x + workArea.width - windowBounds.width - WINDOW_MARGIN),
    y: clamp(rawY, workArea.y + WINDOW_MARGIN, workArea.y + workArea.height - windowBounds.height - WINDOW_MARGIN),
  };
}

function registerProtocolClient(app) {
  app.setAsDefaultProtocolClient('bangumibar');
}

function applyOpenAtLogin(app, enabled) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
  });
}

// 打好的包靠 Info.plist 里的 LSUIElement 就不会有 Dock 图标（见 package.json 的 build.mac.extendInfo），
// 但 `npm run dev` 跑的是 Electron 自带的 bundle，读不到那份 plist，所以运行时再隐一次：
// 一是让开发态和发布态一致，二是 Dock 图标会把应用变成 regular 类型，窗口失焦行为跟发布态不一样。
function hideDockIcon(app) {
  if (app.dock) app.dock.hide();
}

function getPopoverWindowOptions() {
  return {
    // 透明 + vibrancy 在部分 macOS/GPU 状态下会造成可见性异常；
    // 使用系统圆角的原生不透明窗口是更可靠的托盘弹层方案。
    roundedCorners: true,
  };
}

module.exports = {
  name: 'mac',
  getPopoverPosition,
  registerProtocolClient,
  applyOpenAtLogin,
  hideDockIcon,
  getPopoverWindowOptions,
};
