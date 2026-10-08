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

const welcomeFlag = () => path.join(app.getPath('userData'), 'welcome-seen');
let wwin = null, wfire = null;
// Long welcome page with the guide. With a callback it is the first-run page: the browser opens when it closes.
exports.showWelcome = afterClose => {
  if (wwin && !wwin.isDestroyed()) { wwin.focus(); return; }
  const first = typeof afterClose === 'function';
  let fired = false;
  wfire = () => { if (fired) return; fired = true; if (first) afterClose(); };
  wwin = new BrowserWindow({
    width: 920, height: 740, minWidth: 560, minHeight: 480, frame: false, show: false, center: true,
    backgroundColor: '#16131f', title: 'Welcome to Ember', icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'welcome-preload.js'), sandbox: true, contextIsolation: true, nodeIntegration: false }
  });
  wwin.removeMenu();
  wwin.once('ready-to-show', () => wwin.show());
  wwin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  wwin.webContents.on('will-navigate', e => e.preventDefault());
  wwin.loadFile(path.join(__dirname, 'welcome-page.html'), { query: { first: first ? '1' : '0' } });
  wwin.on('close', () => { if (wfire) wfire(); });
  wwin.on('closed', () => { wwin = null; });
  if (first) { try { fs.writeFileSync(welcomeFlag(), String(Date.now())); } catch (_) {} }
};
ipcMain.on('welcome:min', () => { if (wwin && !wwin.isDestroyed()) wwin.minimize(); });
ipcMain.on('welcome:start', () => { if (wwin && !wwin.isDestroyed()) { if (wfire) wfire(); wwin.close(); } });
// F1 reopens the welcome page and guide from anywhere in the browser (once setup is done)
app.on('web-contents-created', (_, wc) => {
  wc.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11' && app.isReady() && (completed || fs.existsSync(flag()))) {
      const w = BrowserWindow.getFocusedWindow(); // F11 toggles full screen on the browser window
      if (w && w !== win && w !== wwin) { e.preventDefault(); w.setFullScreen(!w.isFullScreen()); }
    }
    if (input.type === 'keyDown' && input.key === 'F1' && app.isReady() && (completed || fs.existsSync(flag()))) { e.preventDefault(); exports.showWelcome(); }
  });
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
    const seen = fs.existsSync(welcomeFlag());
    if (!seen || process.env.EMBER_WELCOME) exports.showWelcome(onDone); else onDone();
    if (win) win.close();
  });
  ipcMain.once('setup:quit', () => app.quit());
  ipcMain.on('setup:min', () => { if (win) win.minimize(); });
};
