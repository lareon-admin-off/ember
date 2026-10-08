// Automatic updates from GitHub releases.
// Windows and Linux download and install updates; macOS (unsigned) shows a notice with a link instead.
const { app, shell, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const logFile = () => path.join(app.getPath('userData'), 'update-log.txt');
const log = m => { try { fs.appendFileSync(logFile(), new Date().toISOString() + '  ' + m + '\n'); } catch (_) {} };
let autoUpdater = null, loadError = '';
try { autoUpdater = require('electron-updater').autoUpdater; } catch (e) { loadError = String(e && e.message || e); }

const setupDone = () => fs.existsSync(path.join(app.getPath('userData'), 'setup-done'));
// Ember-styled prompt window; resolves with the index of the button chosen (closing the window counts as the second button)
const box = o => new Promise(resolve => {
  let done = false;
  const finish = n => { if (done) return; done = true; ipcMain.removeListener('upd:choice', onChoice); resolve(n); if (w && !w.isDestroyed()) w.close(); };
  const onChoice = (_, n) => finish(n === 0 ? 0 : 1);
  ipcMain.on('upd:choice', onChoice);
  const w = new BrowserWindow({ width: 440, height: 210, frame: false, resizable: false, maximizable: false, minimizable: false, fullscreenable: false, show: false, center: true, alwaysOnTop: true, backgroundColor: '#16131f', title: 'Ember update', icon: path.join(__dirname, 'assets', 'icon.png'), webPreferences: { preload: path.join(__dirname, 'update-preload.js'), sandbox: true, contextIsolation: true, nodeIntegration: false } });
  w.removeMenu();
  w.once('ready-to-show', () => { w.show(); w.focus(); });
  w.on('closed', () => finish(1));
  w.loadFile(path.join(__dirname, 'update-prompt.html'), { query: { m: o.message, d: o.detail, a: o.buttons[0], b: o.buttons[1] } }).catch(() => finish(1));
});

function init() {
  app.whenReady().then(() => log('start: version ' + app.getVersion() + ', packaged ' + app.isPackaged + ', updater ' + (autoUpdater ? 'loaded' : 'NOT loaded: ' + loadError)));
  if (!autoUpdater || !app.isPackaged) return;
  const mac = process.platform === 'darwin';
  let asked = false;
  autoUpdater.autoDownload = !mac;
  autoUpdater.autoInstallOnAppQuit = !mac;
  autoUpdater.on('checking-for-update', () => log('checking for update'));
  autoUpdater.on('update-not-available', i => log('no update (latest is ' + (i && i.version) + ')'));
  autoUpdater.on('error', e => log('ERROR: ' + String(e && e.message || e).split('\n')[0]));
  autoUpdater.on('update-available', info => {
    log('update available: ' + info.version);
    if (!mac || asked) return;
    asked = true;
    box({ type: 'info', buttons: ['Get the update', 'Later'], defaultId: 0, cancelId: 1, title: 'Ember update', message: 'Ember ' + info.version + ' is available', detail: 'Download the new version from ember.lareon.org.' })
      .then(r => { if (r.response === 0) shell.openExternal('https://ember.lareon.org'); }).catch(() => {});
  });
  autoUpdater.on('update-downloaded', info => {
    log('update downloaded: ' + info.version);
    box({ type: 'info', buttons: ['Restart now', 'Later'], defaultId: 0, cancelId: 1, title: 'Ember update', message: 'Ember ' + info.version + ' is ready', detail: 'Restart Ember to finish updating. If you choose Later, the update installs the next time you close Ember.' })
      .then(r => { if (r.response === 0) autoUpdater.quitAndInstall(true, true); }).catch(() => {});
  });
  const check = () => { if (setupDone()) autoUpdater.checkForUpdates().catch(e => log('check failed: ' + String(e && e.message || e).split('\n')[0])); else log('skipped check: setup not done'); };
  app.whenReady().then(() => { setTimeout(check, 20000); setTimeout(check, 180000); setInterval(check, 6 * 3600 * 1000); });
}
init();
