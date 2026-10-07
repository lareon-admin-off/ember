// First-run setup wizard. The browser window only opens after the person finishes it.
// EMBER_WELCOME=1 forces the wizard again (for testing).
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const flag = () => path.join(app.getPath('userData'), 'setup-done');
let win = null, accepted = false, completed = false;

const settingsFile = () => path.join(app.getPath('userData'), 'ember-settings.json');
const readSettings = () => { try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch (_) { return {}; } };
// folder the person chose for downloads during setup (or null for the system Downloads folder)
exports.downloadDir = () => { const d = readSettings().downloadDir; try { if (d && fs.statSync(d).isDirectory()) return d; } catch (_) {} return null; };
ipcMain.handle('setup:dl-default', () => app.getPath('downloads'));
ipcMain.handle('setup:folder', async () => {
  if (!win || win.isDestroyed()) return null;
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
  return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
});

exports.needed = () => !completed && (!!process.env.EMBER_WELCOME || !fs.existsSync(flag()));

exports.run = onDone => {
  if (win && !win.isDestroyed()) { win.focus(); return; }
  accepted = false;
  win = new BrowserWindow({
    width: 780, height: 500, frame: false, resizable: false, maximizable: false, fullscreenable: false,
    show: false, center: true, backgroundColor: '#16131f', title: 'Ember setup',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'setup-preload.js'), sandbox: true, contextIsolation: true, nodeIntegration: false }
  });
  win.removeMenu();
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.loadFile(path.join(__dirname, 'welcome.html'));
  win.on('closed', () => { win = null; if (!accepted) app.quit(); });
  ipcMain.removeAllListeners('setup:done'); ipcMain.removeAllListeners('setup:quit'); ipcMain.removeAllListeners('setup:min');
  ipcMain.once('setup:done', (_, opts) => {
    accepted = true; completed = true;
    const dir = opts && typeof opts.downloadDir === 'string' ? opts.downloadDir : '';
    try { if (dir && fs.statSync(dir).isDirectory()) fs.writeFileSync(settingsFile(), JSON.stringify({ ...readSettings(), downloadDir: dir })); } catch (_) {}
    try { fs.writeFileSync(flag(), String(Date.now())); } catch (_) {}
    if (win) win.close();
    onDone();
  });
  ipcMain.once('setup:quit', () => app.quit());
  ipcMain.on('setup:min', () => { if (win) win.minimize(); });
};
