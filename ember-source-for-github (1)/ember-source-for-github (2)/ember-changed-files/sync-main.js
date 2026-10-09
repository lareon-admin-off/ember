// Lareon account sign-in and sync for Ember. Runs in the main process so the session token never reaches web pages.
const fs = require('fs'), path = require('path');
module.exports = function ({ app, ipcMain }) {
  const { safeStorage } = require('electron');
  const BASE = process.env.LAREON_BASE || 'https://lareon.org';
  const file = () => path.join(app.getPath('userData'), 'lareon-account.json');
  const device = () => 'Ember on ' + ({ darwin: 'macOS', win32: 'Windows', linux: 'Linux' }[process.platform] || process.platform);
  function load() {
    try {
      const j = JSON.parse(fs.readFileSync(file(), 'utf8')); let t = j.token;
      if (j.enc) { if (!safeStorage.isEncryptionAvailable()) return null; t = safeStorage.decryptString(Buffer.from(t, 'base64')); }
      return t ? { token: t, email: j.email, username: j.username } : null;
    } catch (_) { return null; }
  }
  function save(o) {
    const enc = safeStorage.isEncryptionAvailable();
    const t = enc ? safeStorage.encryptString(o.token).toString('base64') : o.token;
    fs.writeFileSync(file(), JSON.stringify({ token: t, enc, email: o.email, username: o.username }), { mode: 0o600 });
  }
  const drop = () => { try { fs.unlinkSync(file()); } catch (_) {} };
  async function api(p, opt, tok) {
    const r = await fetch(BASE + p, Object.assign({}, opt, { headers: Object.assign({ 'content-type': 'application/json', 'user-agent': 'Ember/' + app.getVersion() + ' (' + device() + ')' }, tok ? { authorization: 'Bearer ' + tok } : {}) }));
    let d = {}; try { d = await r.json(); } catch (_) {}
    return { ok: r.ok, status: r.status, d };
  }
  const done = (r, u) => { save({ token: r.d.token, email: r.d.user.email, username: r.d.user.username }); return { ok: true, email: r.d.user.email }; };
  ipcMain.handle('acct:state', () => { const s = load(); return s ? { signedIn: true, email: s.email } : { signedIn: false }; });
  ipcMain.handle('acct:login', async (_, u, p) => {
    try {
      const r = await api('/api/login', { method: 'POST', body: JSON.stringify({ username: String(u || ''), password: String(p || '') }) });
      if (r.ok && r.d.requires2FA) return { needCode: true, contact: r.d.contact, username: String(u || '') };
      if (r.ok && r.d.token) return done(r);
      return { error: r.d.error === 'banned' ? 'This Lareon account has been suspended.' : (r.d.error || 'Could not sign in') };
    } catch (_) { return { error: 'Could not reach Lareon. Check your connection.' }; }
  });
  ipcMain.handle('acct:code', async (_, u, code) => {
    try {
      const r = await api('/api/auth/2fa/verify', { method: 'POST', body: JSON.stringify({ username: String(u || ''), code: String(code || '') }) });
      return r.ok && r.d.token ? done(r) : { error: r.d.error || 'That code did not work' };
    } catch (_) { return { error: 'Could not reach Lareon. Check your connection.' }; }
  });
  ipcMain.handle('acct:logout', async () => { const s = load(); if (s) { try { await api('/api/logout', { method: 'POST', body: '{}' }, s.token); } catch (_) {} } drop(); return true; });
  ipcMain.handle('sync:pull', async () => {
    const s = load(); if (!s) return { error: 'signed-out' };
    try { const r = await api('/api/sync', {}, s.token); if (r.status === 401) { drop(); return { error: 'signed-out' }; } return r.ok ? r.d : { error: r.d.error || 'Could not sync' }; }
    catch (_) { return { error: 'Could not reach Lareon' }; }
  });
  ipcMain.handle('sync:push', async (_, data, base) => {
    const s = load(); if (!s) return { error: 'signed-out' };
    try { const r = await api('/api/sync/push', { method: 'POST', body: JSON.stringify({ data: String(data || ''), baseVersion: Number(base) || 0, device: device() }) }, s.token); return Object.assign({ ok: r.ok, status: r.status }, r.d); }
    catch (_) { return { error: 'Could not reach Lareon' }; }
  });
};
