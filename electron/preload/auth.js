const { ipcRenderer } = require('electron');

let pendingCallback = null;

const authAPI = {
  onCallback: callback => {
    if (pendingCallback) {
      callback(pendingCallback);
      pendingCallback = null;
    }

    ipcRenderer.on('auth-callback', (_event, data) => callback(data));
  },
  onWindowReady: callback => {
    ipcRenderer.on('window-ready', () => callback());
  },
};

module.exports = {
  authAPI,
};
