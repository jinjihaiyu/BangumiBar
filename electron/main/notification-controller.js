const { Notification } = require('electron');

function showDesktopNotification({ title, body }) {
  if (!Notification.isSupported()) return;

  const notification = new Notification({
    title,
    body,
    silent: false,
  });

  notification.show();
}

module.exports = {
  showDesktopNotification,
};
