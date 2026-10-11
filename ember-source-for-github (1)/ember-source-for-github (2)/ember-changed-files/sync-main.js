// Lareon account sign-in and sync for Ember. Runs in the main process so the session token never reaches web pages.
const fs = require('fs'), path = require('path');
module.exports = function ({ app, ipcMain, getWin }) {
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
    fs.writeFileSync(file(), JSON.stringify({ token: t, enc, email: o.email, username: o.username, name: o.name || '' }), { mode: 0o600 });
  }
  const drop = () => { try { fs.unlinkSync(file()); } catch (_) {} };
  async function api(p, opt, tok) {
    const r = await fetch(BASE + p, Object.assign({}, opt, { headers: Object.assign({ 'content-type': 'application/json', 'user-agent': 'Ember/' + app.getVersion() + ' (' + device() + ')' }, tok ? { authorization: 'Bearer ' + tok } : {}) }));
    let d = {}; try { d = await r.json(); } catch (_) {}
    return { ok: r.ok, status: r.status, d };
  }
  const done = (r, u) => { save({ token: r.d.token, email: r.d.user.email, username: r.d.user.username, name: r.d.user.display_name || '' }); return { ok: true, email: r.d.user.email, name: r.d.user.display_name || r.d.user.username }; };
  ipcMain.handle('acct:state', () => { const s = load(); return s ? { signedIn: true, email: s.email, name: s.name || s.username || '' } : { signedIn: false }; });
  // A one-time link that opens lareon.org/account already signed in. Falls back to the plain sign-in page.
  ipcMain.handle('acct:open', async () => {
    const s = load(); if (!s) return { url: BASE + '/account' };
    try { const r = await api('/api/auth/handoff', { method: 'POST', body: '{}' }, s.token); if (r.status === 401) { drop(); return { url: BASE + '/account', signedOut: true }; } if (r.ok && r.d.code) return { url: BASE + '/account#hc=' + r.d.code }; } catch (_) {}
    return { url: BASE + '/account' };
  });
  // "Sign in with Lareon": open the official sign-in page, the person approves there, and Ember collects the session.
  let linkTimer = null;
  ipcMain.handle('acct:link', async () => {
    if (linkTimer) { clearInterval(linkTimer); linkTimer = null; }
    let st; try { st = await api('/api/auth/link/start', { method: 'POST', body: '{}' }); } catch (_) { return { url: BASE + '/account' }; }
    if (!st.ok || !st.d.id) return { url: BASE + '/account' };
    const { id, secret, short } = st.d; const until = Date.now() + 10 * 60000; let viewed = false;
    linkTimer = setInterval(async () => {
      if (Date.now() > until) { clearInterval(linkTimer); linkTimer = null; return; }
      try {
        const r = await api('/api/auth/link/poll', { method: 'POST', body: JSON.stringify({ id, secret }) });
        if (r.status === 410) { clearInterval(linkTimer); linkTimer = null; return; }
        if (r.ok && r.d.pending && r.d.viewing && !viewed) { viewed = true; const w0 = getWin && getWin(); if (w0 && !w0.isDestroyed()) w0.webContents.send('acct:viewing', {}); }
        if (r.ok && r.d.token) {
          clearInterval(linkTimer); linkTimer = null;
          const u = r.d.user || {}; save({ token: r.d.token, email: u.email, username: u.username, name: u.display_name || '' });
          const w = getWin && getWin(); if (w && !w.isDestroyed()) w.webContents.send('acct:linked', { email: u.email, name: u.display_name || u.username });
        }
      } catch (_) {}
    }, 2000);
    return { url: BASE + '/account?link=' + id, short };
  });
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
  // Is this still a valid Lareon session? Signing out on lareon.org (or from another device) ends it, and Ember must notice.
  ipcMain.handle('acct:check', async () => {
    const s = load(); if (!s) return { signedOut: true };
    try { const r = await api('/api/account/profile', {}, s.token); if (r.status === 401 || r.status === 403) { drop(); return { signedOut: true }; } return { ok: r.ok }; }
    catch (_) { return { offline: true }; }
  });
  // Lareon cloud features in Ember (send a tab, other devices, reading list, collections, notes, mail count). Only these paths are reachable, always with the signed-in session.
  const EM_OK = /^\/api\/(ember\/[A-Za-z0-9\/_-]*(\?device=[A-Za-z0-9_-]{6,40})?|account\/summary)$/;
  const devId = () => {
    const f = path.join(app.getPath('userData'), 'ember-device-id');
    try { const v = fs.readFileSync(f, 'utf8').trim(); if (/^[A-Za-z0-9_-]{6,40}$/.test(v)) return v; } catch (_) {}
    const v = 'dev-' + require('crypto').randomBytes(8).toString('hex'); try { fs.writeFileSync(f, v, { mode: 0o600 }); } catch (_) {} return v;
  };
  ipcMain.handle('em:device', () => ({ id: devId(), name: device(), platform: process.platform }));
  ipcMain.handle('em:call', async (_, method, p, body) => {
    const s = load(); if (!s) return { error: 'signed-out' };
    method = String(method || 'GET').toUpperCase(); p = String(p || '');
    if (['GET', 'POST', 'PUT', 'DELETE'].indexOf(method) < 0 || !EM_OK.test(p)) return { error: 'blocked' };
    try {
      const r = await api(p, { method, body: body === undefined ? undefined : JSON.stringify(body) }, s.token);
      if (r.status === 401) { drop(); return { error: 'signed-out' }; }
      return { ok: r.ok, status: r.status, d: r.d };
    } catch (_) { return { error: 'offline' }; }
  });
  // Ask Aster about the page you are on. Nothing is saved to your Aster chats.
  ipcMain.handle('em:aster', async (_, o) => {
    const s = load(); if (!s) return { error: 'signed-out' };
    o = o || {}; const pg = o.page || {};
    const msg = String(o.message || '').slice(0, 1500); if (!msg) return { error: 'Ask something first' };
    try {
      const r = await api('/api/aster/chat', { method: 'POST', signal: AbortSignal.timeout(70000), body: JSON.stringify({ message: msg, save: false, page: { title: String(pg.title || '').slice(0, 200), url: String(pg.url || '').slice(0, 500), text: String(pg.text || '').slice(0, 14000) } }) }, s.token);
      if (r.status === 401) { drop(); return { error: 'signed-out' }; }
      return r.ok && r.d.reply ? { reply: String(r.d.reply) } : { error: (r.d && r.d.error) || 'Aster could not answer just now' };
    } catch (_) { return { error: 'Could not reach Aster. Try again.' }; }
  });
  ipcMain.handle('acct:logout', async () => { const s = load(); if (s) { try { await api('/api/logout', { method: 'POST', body: '{}' }, s.token); } catch (_) {} } drop(); return true; });
  ipcMain.handle('sync:pull', async () => {
    const s = load(); if (!s) return { error: 'signed-out' };
    try { const r = await api('/api/sync', {}, s.token); if (r.status === 401) { drop(); return { error: 'signed-out' }; } return r.ok ? r.d : { error: r.d.error || 'Could not sync' }; }
    catch (_) { return { error: 'Could not reach Lareon' }; }
  });
  ipcMain.handle('sync:push', async (_, data, base) => {
    const s = load(); if (!s) return { error: 'signed-out' };
    try { const r = await api('/api/sync/push', { method: 'POST', body: JSON.stringify({ data: String(data || ''), baseVersion: Number(base) || 0, device: device() }) }, s.token); if (r.status === 401) { drop(); return { error: 'signed-out' }; } return Object.assign({ ok: r.ok, status: r.status }, r.d); }
    catch (_) { return { error: 'Could not reach Lareon' }; }
  });
};
