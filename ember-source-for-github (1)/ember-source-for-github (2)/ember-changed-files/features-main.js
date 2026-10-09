// Ember 1.0 extras that need the main process: forgetting a site, choosing the downloads folder, importing bookmarks.
const fs = require('fs'), path = require('path'), os = require('os');
module.exports = function (c) {
  require('./sync-main')(c);
  require('./passwords-main')(c);
  const { app, ipcMain, session, dialog, setup, hostOf, permDecided, getWin } = c;
  const sfile = () => path.join(app.getPath('userData'), 'ember-settings.json');
  const rd = () => { try { return JSON.parse(fs.readFileSync(sfile(), 'utf8')); } catch (_) { return {}; } };

  ipcMain.handle('settings:get', () => ({ downloadDir: setup.downloadDir() || app.getPath('downloads'), version: app.getVersion() }));
  ipcMain.handle('settings:folder', async () => {
    const w = getWin(); const r = await dialog.showOpenDialog(w && !w.isDestroyed() ? w : undefined, { properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    try { fs.writeFileSync(sfile(), JSON.stringify({ ...rd(), downloadDir: r.filePaths[0] })); } catch (_) { return null; }
    return r.filePaths[0];
  });

  // Forget this site: cookies, storage, cache and remembered permissions for one site.
  ipcMain.handle('site:forget', async (_, host) => {
    host = String(host || '').toLowerCase().replace(/^www\./, ''); if (!host || host.length > 253) return false;
    const ses = session.defaultSession, same = d => { d = String(d).replace(/^\./, '').replace(/^www\./, ''); return d === host || d.endsWith('.' + host) || (d.includes('.') && host.endsWith('.' + d)); };
    try { for (const ck of await ses.cookies.get({})) if (same(ck.domain)) { const u = (ck.secure ? 'https://' : 'http://') + String(ck.domain).replace(/^\./, '') + ck.path; try { await ses.cookies.remove(u, ck.name); } catch (_) {} } } catch (_) {}
    for (const o of ['https://' + host, 'https://www.' + host, 'http://' + host, 'http://www.' + host]) { try { await ses.clearStorageData({ origin: o }); } catch (_) {} }
    try { await ses.clearCache(); } catch (_) {}
    for (const k of [...permDecided.keys()]) if (k.includes('|' + host) || k.includes(host + '|')) permDecided.delete(k);
    return true;
  });

  // Import bookmarks straight from Chrome, Edge or Brave if they are installed.
  ipcMain.handle('bm:import-browser', () => {
    const h = os.homedir(), L = process.env.LOCALAPPDATA || '', out = [], seen = new Set();
    const cands = process.platform === 'win32' ? [['Chrome', path.join(L, 'Google/Chrome/User Data/Default/Bookmarks')], ['Edge', path.join(L, 'Microsoft/Edge/User Data/Default/Bookmarks')], ['Brave', path.join(L, 'BraveSoftware/Brave-Browser/User Data/Default/Bookmarks')]]
      : process.platform === 'darwin' ? [['Chrome', path.join(h, 'Library/Application Support/Google/Chrome/Default/Bookmarks')], ['Edge', path.join(h, 'Library/Application Support/Microsoft Edge/Default/Bookmarks')], ['Brave', path.join(h, 'Library/Application Support/BraveSoftware/Brave-Browser/Default/Bookmarks')]]
      : [['Chrome', path.join(h, '.config/google-chrome/Default/Bookmarks')], ['Chromium', path.join(h, '.config/chromium/Default/Bookmarks')], ['Edge', path.join(h, '.config/microsoft-edge/Default/Bookmarks')], ['Brave', path.join(h, '.config/BraveSoftware/Brave-Browser/Default/Bookmarks')]];
    const found = [];
    const walk = n => { if (!n) return; if (n.type === 'url' && /^https?:/i.test(n.url || '') && !seen.has(n.url)) { seen.add(n.url); out.push({ u: n.url, t: n.name || n.url }); } (n.children || []).forEach(walk); };
    for (const [name, f] of cands) { try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); found.push(name); Object.values(j.roots || {}).forEach(walk); } catch (_) {} }
    return { found, items: out.slice(0, 5000) };
  });
};
