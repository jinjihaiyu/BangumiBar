function getPopoverPosition({ trayBounds, windowBounds }) {
  return {
    x: Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2),
    y: Math.round(trayBounds.y - windowBounds.height - 10),
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

function getPopoverWindowOptions() {
  return {};
}

module.exports = {
  name: 'mac',
  getPopoverPosition,
  registerProtocolClient,
  applyOpenAtLogin,
  getPopoverWindowOptions,
};
