const { exposeElectronAPI } = require('./preload/bridge');

// preload 仍保持原入口文件不变，仅把实现拆到更清晰的模块里。
exposeElectronAPI();
