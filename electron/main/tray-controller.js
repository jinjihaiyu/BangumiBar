const path = require('path');
const { Tray, Menu, nativeImage, dialog } = require('electron');
const { setTray, getAppState } = require('./app-context');
const { log } = require('./log');

function createTrayIcon() {
  const icon2x = path.join(__dirname, '../icon@2x.png');
  const icon1x = path.join(__dirname, '../icon.png');

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

function showAbout() {
  dialog.showMessageBox({
    type: 'info',
    title: '关于 BangumiBar',
    message: 'BangumiBar v1.0.0',
    detail: 'Bangumi 追番管理菜单栏应用\n\nMade with ❤️ for Bangumi users',
  });
}

function updateTrayMenu(app, { togglePopover, openSettings }) {
  const { tray } = getAppState();
  if (!tray) return;

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示/隐藏', click: () => togglePopover(app) },
    { label: '设置', click: () => openSettings(app) },
    { type: 'separator' },
    { label: '关于', click: () => showAbout() },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuitting = true; app.quit(); } },
  ]));
}

function createTray(app, { togglePopover, openSettings }) {
  const tray = new Tray(createTrayIcon());
  setTray(tray);

  tray.setToolTip('BangumiBar');
  tray.on('click', () => {
    togglePopover(app);
  });
  updateTrayMenu(app, { togglePopover, openSettings });

  return tray;
}

module.exports = {
  createTray,
  updateTrayMenu,
};
