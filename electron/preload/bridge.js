const { contextBridge } = require('electron');
const { authAPI } = require('./auth');
const { desktopAPI, storeAPI } = require('./desktop');
const { settingsAPI } = require('./settings');

function buildElectronAPI() {
  return {
    // 兼容旧接口，避免第一阶段重构牵连渲染层大面积修改。
    onAuthCallback: authAPI.onCallback,
    onWindowReady: authAPI.onWindowReady,
    getStore: storeAPI.getStore,
    setStore: storeAPI.setStore,
    deleteStore: storeAPI.deleteStore,
    openExternal: desktopAPI.openExternal,
    hidePopover: desktopAPI.hidePopover,
    cancelHide: desktopAPI.cancelHide,
    scheduleHide: desktopAPI.scheduleHide,
    closeSettings: desktopAPI.closeSettings,
    getVersion: desktopAPI.getVersion,
    showNotification: desktopAPI.showNotification,
    getAppSettings: settingsAPI.get,
    setAppSettings: settingsAPI.update,
    platform: desktopAPI.platform,

    // 新合同先预留分组式入口，后续渲染层可逐步切换。
    auth: authAPI,
    desktop: desktopAPI,
    settings: settingsAPI,
  };
}

function exposeElectronAPI() {
  contextBridge.exposeInMainWorld('electronAPI', buildElectronAPI());
}

module.exports = {
  exposeElectronAPI,
};
