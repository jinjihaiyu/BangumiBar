const state = {
  tray: null,
  popoverWindow: null,
  settingsWindow: null,
  store: null,
  hideTimeout: null,
  pendingAuthCallback: null,
};

function getAppState() {
  return state;
}

function setTray(tray) {
  state.tray = tray;
}

function setPopoverWindow(window) {
  state.popoverWindow = window;
}

function setSettingsWindow(window) {
  state.settingsWindow = window;
}

function setStore(store) {
  state.store = store;
}

function clearHideTimeout() {
  if (state.hideTimeout) {
    clearTimeout(state.hideTimeout);
    state.hideTimeout = null;
  }
}

function setHideTimeout(timeout) {
  clearHideTimeout();
  state.hideTimeout = timeout;
}

function setPendingAuthCallback(payload) {
  state.pendingAuthCallback = payload;
}

function consumePendingAuthCallback() {
  const payload = state.pendingAuthCallback;
  state.pendingAuthCallback = null;
  return payload;
}

function peekPendingAuthCallback() {
  return state.pendingAuthCallback;
}

module.exports = {
  getAppState,
  setTray,
  setPopoverWindow,
  setSettingsWindow,
  setStore,
  clearHideTimeout,
  setHideTimeout,
  setPendingAuthCallback,
  consumePendingAuthCallback,
  peekPendingAuthCallback,
};
