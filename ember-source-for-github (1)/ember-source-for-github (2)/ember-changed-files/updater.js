// Automatic updates from GitHub releases.
// Windows and Linux download and install updates; macOS (unsigned) shows a notice with a link instead.
const { app, dialog, shell, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

let autoUpdater = null;
try { autoUpdater = require('electron-updater').autoUpdater; } catch (_) {}

const setupDone = () => fs.existsSync(path.join(app.getPath('userData'), 'setup-done'));
const box = o => { const w = BrowserWindow.getFocusedWindow(); return w ? dialog.showMessageBox(w, o) : dialog.showMessageBox(o); };

function init() {
  if (!autoUpdater || !app.isPackaged) return;
  const mac = process.platform === 'darwin';
  let asked = false;
  autoUpdater.autoDownload = !mac;
  autoUpdater.autoInstallOnAppQuit = !mac;
  autoUpdater.on('error', () => {});
  autoUpdater.on('update-available', info => {
    if (!mac || asked) return;
    asked = true;
    box({ type: 'info', buttons: ['Get the update', 'Later'], defaultId: 0, cancelId: 1, title: 'Ember update', message: 'Ember ' + info.version + ' is available', detail: 'Download the new version from ember.lareon.org.' })
      .then(r => { if (r.response === 0) shell.openExternal('https://ember.lareon.org'); }).catch(() => {});
  });
  autoUpdater.on('update-downloaded', info => {
    box({ type: 'info', buttons: ['Restart now', 'Later'], defaultId: 0, cancelId: 1, title: 'Ember update', message: 'Ember ' + info.version + ' is ready', detail: 'Restart Ember to finish updating. If you choose Later, the update installs the next time you close Ember.' })
      .then(r => { if (r.response === 0) autoUpdater.quitAndInstall(true, true); }).catch(() => {});
  });
  const check = () => { if (setupDone()) autoUpdater.checkForUpdates().catch(() => {}); };
  app.whenReady().then(() => { setTimeout(check, 20000); setInterval(check, 6 * 3600 * 1000); });
}
init();
