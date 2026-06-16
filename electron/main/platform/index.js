const macAdapter = require('./mac');
const winAdapter = require('./win');
const linuxAdapter = require('./linux');
const fallbackAdapter = require('./fallback');

function getPlatformAdapter() {
  if (process.platform === 'darwin') {
    return macAdapter;
  }

  if (process.platform === 'win32') {
    return winAdapter;
  }

  if (process.platform === 'linux') {
    return linuxAdapter;
  }

  return fallbackAdapter;
}

module.exports = {
  getPlatformAdapter,
};
