const { ipcRenderer } = require('electron');

const desktopAPI = {
  openExternal: url => ipcRenderer.invoke('open-external', url),
  hidePopover: () => ipcRenderer.invoke('hide-popover'),
  cancelHide: () => ipcRenderer.invoke('cancel-hide'),
  scheduleHide: delay => ipcRenderer.invoke('schedule-hide', delay),
  closeSettings: () => ipcRenderer.invoke('close-settings'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', { title, body }),
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
