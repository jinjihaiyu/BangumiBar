const path = require('path');
const fs = require('fs');

let logFile = null;

function initLogFile(app) {
  logFile = path.join(app.getPath('userData'), 'bangumibar.log');
}

function log(...args) {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
  const logLine = `[${timestamp}] ${message}\n`;

  if (logFile) {
    try {
      fs.mkdirSync(path.dirname(logFile), { recursive: true });
      fs.appendFileSync(logFile, logLine);
    } catch {
      logFile = null;
    }
  }

  console.log(...args);
}

module.exports = {
  initLogFile,
  log,
};
