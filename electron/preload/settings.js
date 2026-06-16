const { ipcRenderer } = require('electron');

const settingsAPI = {
  get: () => ipcRenderer.invoke('get-app-settings'),
  update: settings => ipcRenderer.invoke('set-app-settings', settings),
};

module.exports = {
  settingsAPI,
};
