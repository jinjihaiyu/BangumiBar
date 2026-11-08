const state = {
  tray: null,
  popoverWindow: null,
  settingsWindow: null,
  store: null,
  hideTimeout: null,
  pendingAuthCallback: null,
  lastTrayActivationAt: 0,
};

function getAppState() {
  return state;
}

function setTray(tray) {
  state.tray = tray;
}

function markTrayActivation() {
  state.lastTrayActivationAt = Date.now();
}

function isTrayActivationFresh(threshold = 500) {
  return Date.now() - state.lastTrayActivationAt < threshold;
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
  markTrayActivation,
  isTrayActivationFresh,
  setPopoverWindow,
  setSettingsWindow,
  setStore,
  clearHideTimeout,
  setHideTimeout,
  setPendingAuthCallback,
  consumePendingAuthCallback,
  peekPendingAuthCallback,
};
