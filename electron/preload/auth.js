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
  notifyStateChanged: payload => ipcRenderer.invoke('notify-auth-changed', payload),
  onStateChanged: callback => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('auth-state-changed', handler);
    return () => ipcRenderer.removeListener('auth-state-changed', handler);
  },
};

module.exports = {
  authAPI,
};
