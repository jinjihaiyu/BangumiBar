const { ipcRenderer } = require('electron');

// 渲染层唯一的出网入口：请求实际由主进程发出，这里只做转发。
const netAPI = {
  request: options => ipcRenderer.invoke('bangumi-request', options),
  oauthToken: options => ipcRenderer.invoke('bangumi-oauth-token', options),
  openAuthPage: webBase => ipcRenderer.invoke('bangumi-open-auth-page', webBase),
};

module.exports = {
  netAPI,
};
