const path = require('path');
const fs = require('fs');

const MAX_LOG_SIZE_BYTES = 2 * 1024 * 1024;
let logFile = null;

function initLogFile(app) {
  logFile = path.join(app.getPath('userData'), 'bangumibar.log');
  try {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > MAX_LOG_SIZE_BYTES) {
      fs.renameSync(logFile, `${logFile}.old`);
    }
  } catch {
    logFile = null;
  }
}

function log(...args) {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
  const logLine = `[${timestamp}] ${message}\n`;

  if (logFile) {
    fs.appendFile(logFile, logLine, err => {
      if (err) {
        logFile = null;
      }
    });
  }

  console.log(...args);
}

module.exports = {
  initLogFile,
  log,
};
