const path = require('path');
const { Tray, Menu, nativeImage, dialog } = require('electron');
const { setTray, getAppState, markTrayActivation } = require('./app-context');
const { log } = require('./log');

function createTrayIcon() {
  // macOS 菜单栏使用系统 template icon，自动适配浅色、深色和高亮状态。
  if (process.platform === 'darwin') {
    const templateIcon = nativeImage.createFromPath(path.join(__dirname, '../trayTemplate.png'));
    if (!templateIcon.isEmpty()) {
      const templateIcon2x = nativeImage.createFromPath(path.join(__dirname, '../trayTemplate@2x.png'));
      if (!templateIcon2x.isEmpty()) {
        templateIcon.addRepresentation({
          scaleFactor: 2,
          buffer: templateIcon2x.toPNG(),
        });
      }
      templateIcon.setTemplateImage(true);
      return templateIcon;
    }
  }

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

function showAbout(app) {
  dialog.showMessageBox({
    type: 'info',
    title: '关于 BangumiBar',
    // 版本号取自 package.json，避免写死之后和发布版本脱节。
    message: `BangumiBar v${app.getVersion()}`,
    detail: 'Bangumi 追番管理菜单栏应用\n\nMade with ❤️ for Bangumi users',
  });
}

function updateTrayMenu(app, { togglePopover, openSettings }) {
  const { tray } = getAppState();
  if (!tray) return;

  return Menu.buildFromTemplate([
    { label: '设置', click: () => openSettings(app) },
    { type: 'separator' },
    { label: '关于', click: () => showAbout(app) },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuitting = true; app.quit(); } },
  ]);
}

function createTray(app, { togglePopover, hidePopover, openSettings }) {
  const tray = new Tray(createTrayIcon());
  setTray(tray);

  tray.setToolTip('BangumiBar');
  // 不绑定 contextMenu：左键只做 popover 的显示/隐藏切换。
  tray.setContextMenu(null);

  // 托盘点击会让 popover 失焦。先记录激活时间，避免 blur 先隐藏、click 又显示。
  tray.on('mouse-down', markTrayActivation);
  tray.on('click', () => {
    togglePopover(app);
  });

  const trayMenu = updateTrayMenu(app, { togglePopover, openSettings });
  tray.on('right-click', (_event, bounds) => {
    hidePopover(app, { animated: false });
    tray.popUpContextMenu(trayMenu, bounds);
  });

  return tray;
}

module.exports = {
  createTray,
  updateTrayMenu,
};
