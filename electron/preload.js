const { contextBridge, ipcRenderer } = require('electron');

let pendingCallback = null;

contextBridge.exposeInMainWorld('electronAPI', {
  onAuthCallback: (callback) => {
    if (pendingCallback) {
      callback(pendingCallback);
      pendingCallback = null;
    }
    ipcRenderer.on('auth-callback', (_event, data) => callback(data));
  },

  onWindowReady: (callback) => {
    ipcRenderer.on('window-ready', () => callback());
  },

  getStore: (key) => ipcRenderer.invoke('get-store', key),
  setStore: (key, value) => ipcRenderer.invoke('set-store', key, value),
  deleteStore: (key) => ipcRenderer.invoke('delete-store', key),

  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  hidePopover: () => ipcRenderer.invoke('hide-popover'),
  cancelHide: () => ipcRenderer.invoke('cancel-hide'),
  scheduleHide: (delay) => ipcRenderer.invoke('schedule-hide', delay),
  closeSettings: () => ipcRenderer.invoke('close-settings'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', { title, body }),

  getAppSettings: () => ipcRenderer.invoke('get-app-settings'),
  setAppSettings: (settings) => ipcRenderer.invoke('set-app-settings', settings),

  platform: process.platform
});
