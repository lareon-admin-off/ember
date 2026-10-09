// "What's new" window, shown once after Ember updates to a new version.
// Notes come from whatsnew.json (a list per version number). Set EMBER_WHATSNEW=1 to force it for testing.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const dataDir = () => app.getPath('userData');
const stateFile = () => path.join(dataDir(), 'last-version');
exports.markCurrent = () => { try { fs.writeFileSync(stateFile(), app.getVersion()); } catch (_) {} };

function show(version, notes) {
  const major = /^\d+\.0\.0$/.test(version) || version === '1.0.1'; // 1.0.1 is the real launch release of 1.0
  const w = new BrowserWindow({
    width: major ? 640 : 500, height: major ? 720 : 490, frame: false, resizable: false, maximizable: false, minimizable: false, fullscreenable: false,
    show: false, center: true, backgroundColor: '#16131f', title: "What's new in Ember", icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'whatsnew-preload.js'), sandbox: true, contextIsolation: true, nodeIntegration: false }
  });
  w.removeMenu();
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  w.webContents.on('will-navigate', e => e.preventDefault());
  w.webContents.once('did-finish-load', () => {
    const j = JSON.stringify({ version, notes, major }).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    const go = () => { if (!w.isDestroyed()) { w.show(); w.focus(); } };
    w.webContents.executeJavaScript('window.__init(' + j + ')').then(go, go);
  });
  w.loadFile(path.join(__dirname, 'whatsnew.html')).catch(() => {});
}
ipcMain.on('whatsnew:close', e => { const w = BrowserWindow.fromWebContents(e.sender); if (w && !w.isDestroyed()) w.close(); });

function maybeShow() {
  if (!fs.existsSync(path.join(dataDir(), 'setup-done'))) return; // brand-new install: the setup screens come first
  const cur = app.getVersion(), force = !!process.env.EMBER_WHATSNEW;
  let last = '';
  try { last = fs.readFileSync(stateFile(), 'utf8').trim(); } catch (_) {}
  if (last === cur && !force) return;
  exports.markCurrent();
  let notes = null;
  try { notes = JSON.parse(fs.readFileSync(path.join(__dirname, 'whatsnew.json'), 'utf8'))[cur]; } catch (_) {}
  if (Array.isArray(notes) && notes.length) setTimeout(() => show(cur, notes), 3000);
}
if (app.isPackaged || process.env.EMBER_WHATSNEW) app.whenReady().then(maybeShow);
