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
  w.on('closed', () => finish(1));
  w.webContents.once('did-finish-load', () => {
    const j = JSON.stringify({ message: o.message, detail: o.detail, a: o.buttons[0], b: o.buttons[1] }).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    const show = () => { if (!w.isDestroyed()) { w.show(); w.focus(); } };
    w.webContents.executeJavaScript('window.__init(' + j + ')').then(show, show);
  });
  w.loadFile(path.join(__dirname, 'update-prompt.html')).catch(() => finish(1));
});

const https = require('https'), os = require('os'), crypto = require('crypto');
const updDir = () => path.join(os.tmpdir(), 'ember-update');
const cleanOld = () => { try { fs.rmSync(updDir(), { recursive: true, force: true }); } catch (_) {} };
const REL_BASE = 'https://github.com/lareon-admin-off/ember/releases/download/';
// Fetch a URL (following GitHub's redirects). With a destination it streams to disk and resolves with the file's sha512 (base64); without one it resolves with the text.
function fetchUrl(url, dest, onProg, hops) {
  hops = hops || 0;
  return new Promise((resolve, reject) => {
    if (hops > 6) return reject(new Error('too many redirects'));
    if (!/^https:\/\/(github\.com|objects\.githubusercontent\.com|release-assets\.githubusercontent\.com)\//.test(url)) return reject(new Error('unexpected host'));
    https.get(url, { headers: { 'user-agent': 'Ember/' + app.getVersion() } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); return fetchUrl(new URL(res.headers.location, url).toString(), dest, onProg, hops + 1).then(resolve, reject); }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      if (!dest) { let s = ''; res.setEncoding('utf8'); res.on('data', c => { s += c; }); res.on('end', () => resolve(s)); res.on('error', reject); return; }
      const total = Number(res.headers['content-length']) || 0, hash = crypto.createHash('sha512'); let got = 0;
      const out = fs.createWriteStream(dest);
      res.on('data', c => { got += c.length; hash.update(c); if (total && onProg) onProg(got / total); });
      res.on('error', reject); out.on('error', reject);
      out.on('finish', () => resolve(hash.digest('base64')));
      res.pipe(out);
    }).on('error', reject);
  });
}
// An unsigned Mac app can't replace itself, so Ember downloads the installer for you, checks it against the checksum published with the release, and only then opens it.
async function macUpdate(version) {
  const name = 'Ember-' + version + '-mac-' + (process.arch === 'arm64' ? 'arm64' : 'x64') + '.dmg';
  const base = REL_BASE + 'v' + version + '/';
  const dest = path.join(updDir(), name);
  const win = BrowserWindow.getAllWindows().find(w => !w.isDestroyed() && w.isVisible());
  const prog = p => { try { if (win && !win.isDestroyed()) win.setProgressBar(p); } catch (_) {} };
  try {
    cleanOld(); fs.mkdirSync(updDir(), { recursive: true });
    const yml = await fetchUrl(base + 'latest-mac.yml');
    const m = new RegExp('url:\\s*' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\n\\s*sha512:\\s*(\\S+)').exec(yml);
    if (!m) throw new Error('no checksum published for ' + name);
    log('downloading ' + name);
    const got = await fetchUrl(base + name, dest, prog);
    prog(-1);
    if (got !== m[1]) { try { fs.unlinkSync(dest); } catch (_) {} throw new Error('checksum mismatch'); }
    log('checksum ok, opening ' + name);
    const err = await shell.openPath(dest);
    if (err) throw new Error(err);
  } catch (e) {
    prog(-1); try { fs.unlinkSync(dest); } catch (_) {}
    log('mac update failed: ' + String(e && e.message || e));
    shell.openExternal('https://ember.lareon.org');
  }
}

function init() {
  if (process.platform === 'darwin') app.whenReady().then(() => setTimeout(cleanOld, 8000));
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
    box({ type: 'info', buttons: ['Get the update', 'Later'], defaultId: 0, cancelId: 1, title: 'Ember update', message: 'Ember ' + info.version + ' is available', detail: 'Ember will download it, check it, and open the installer. Drag Ember to Applications and choose Replace.' })
      .then(r => { if (r === 0) macUpdate(info.version); }).catch(() => {});
  });
  autoUpdater.on('update-downloaded', info => {
    log('update downloaded: ' + info.version);
    box({ type: 'info', buttons: ['Restart now', 'Later'], defaultId: 0, cancelId: 1, title: 'Ember update', message: 'Ember ' + info.version + ' is ready', detail: 'Restart Ember to finish updating. If you choose Later, the update installs the next time you close Ember.' })
      .then(r => { if (r === 0) autoUpdater.quitAndInstall(true, true); }).catch(() => {});
  });
  const check = () => { if (setupDone()) autoUpdater.checkForUpdates().catch(e => log('check failed: ' + String(e && e.message || e).split('\n')[0])); else log('skipped check: setup not done'); };
  app.whenReady().then(() => { setTimeout(check, 20000); setTimeout(check, 180000); setInterval(check, 6 * 3600 * 1000); });
}
init();
