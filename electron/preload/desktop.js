const { ipcRenderer } = require('electron');

let latestPopoverVisibility = false;
let popoverVisibilityCallback = null;

// preload 可能早于 documentElement 初始化执行，必须等 DOM 就绪后再写入标记。
const syncPopoverVisibility = () => {
  document.documentElement?.classList.toggle('popover-visible', latestPopoverVisibility);
  document.documentElement?.classList.toggle('popover-hiding', !latestPopoverVisibility);
};
const markElectronWindow = () => {
  if (!document.documentElement) return;
  document.documentElement.dataset.electronWindow = window.location.hash === '#settings' ? 'settings' : 'popover';
  syncPopoverVisibility();
};

if (document.documentElement) {
  markElectronWindow();
} else {
  document.addEventListener('DOMContentLoaded', markElectronWindow, { once: true });
}

ipcRenderer.on('popover-visibility', (_event, visible) => {
  latestPopoverVisibility = visible;
  syncPopoverVisibility();
  popoverVisibilityCallback?.(visible);
});

const desktopAPI = {
  openExternal: url => ipcRenderer.invoke('open-external', url),
  hidePopover: () => ipcRenderer.invoke('hide-popover'),
  cancelHide: () => ipcRenderer.invoke('cancel-hide'),
  scheduleHide: delay => ipcRenderer.invoke('schedule-hide', delay),
  onPopoverVisibility: callback => {
    popoverVisibilityCallback = callback;
    callback(latestPopoverVisibility);
  },
  closeSettings: () => ipcRenderer.invoke('close-settings'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', { title, body }),
  getBroadcastSchedule: () => ipcRenderer.invoke('get-broadcast-schedule'),
  platform: process.platform,
};

const storeAPI = {
  getStore: key => ipcRenderer.invoke('get-store', key),
  setStore: (key, value) => ipcRenderer.invoke('set-store', key, value),
  deleteStore: key => ipcRenderer.invoke('delete-store', key),
};

module.exports = {
  desktopAPI,
  storeAPI,
};
