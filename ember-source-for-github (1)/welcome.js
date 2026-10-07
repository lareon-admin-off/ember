// First-run welcome wizard. Additive: opens welcome.html once, on the first launch only.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const flag = () => path.join(app.getPath('userData'), 'welcome-done');
app.whenReady().then(() => {
  if (fs.existsSync(flag()) && !process.env.EMBER_WELCOME) return; // EMBER_WELCOME=1 forces it for testing
  setTimeout(() => {
    try { fs.writeFileSync(flag(), String(Date.now())); } catch (_) {}
    const parent = BrowserWindow.getAllWindows()[0];
    const w = new BrowserWindow({
      width: 820, height: 560, resizable: false, minimizable: false, maximizable: false, fullscreenable: false,
      show: false, parent, modal: !!parent, backgroundColor: '#16141f', autoHideMenuBar: true, title: 'Welcome to Ember',
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
    });
    w.removeMenu();
    w.once('ready-to-show', () => w.show());
    w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    w.webContents.on('will-navigate', e => e.preventDefault());
    w.loadFile(path.join(__dirname, 'welcome.html'));
  }, 700);
});
