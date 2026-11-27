const { ipcRenderer } = require('electron');

const settingsAPI = {
  get: () => ipcRenderer.invoke('get-app-settings'),
  update: settings => ipcRenderer.invoke('set-app-settings', settings),
  onChanged: callback => {
    const handler = (_event, settings) => callback(settings);
    ipcRenderer.on('app-settings-changed', handler);
    return () => ipcRenderer.removeListener('app-settings-changed', handler);
  },
};

module.exports = {
  settingsAPI,
};
