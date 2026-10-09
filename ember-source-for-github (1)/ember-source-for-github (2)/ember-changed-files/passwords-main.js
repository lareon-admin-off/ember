// Saved passwords. Everything is kept in one file, encrypted with the system's secure storage
// (Keychain on macOS, DPAPI on Windows, the keyring on Linux). Passwords are never synced and never sent anywhere.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
module.exports = function (c) {
  const { app, ipcMain, getWin } = c;
  const { safeStorage } = require('electron');
  const file = () => path.join(app.getPath('userData'), 'passwords.bin');
  const MAXN = 5000;

  const available = () => {
    try {
      if (!safeStorage || !safeStorage.isEncryptionAvailable()) return false;
      if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend && safeStorage.getSelectedStorageBackend() === 'basic_text') return false; // no real keyring
      return true;
    } catch (_) { return false; }
  };
  let cache = null, broken = false;
  function load() {
    if (cache) return cache;
    if (!fs.existsSync(file())) return (cache = { v: 1, items: [], never: [] });
    try {
      const j = JSON.parse(safeStorage.decryptString(fs.readFileSync(file())));
      cache = { v: 1, items: Array.isArray(j.items) ? j.items : [], never: Array.isArray(j.never) ? j.never : [] };
    } catch (_) { broken = true; cache = { v: 1, items: [], never: [] }; } // can't read it: never overwrite what is on disk
    return cache;
  }
  function save() {
    if (broken || !available()) return false;
    const tmp = file() + '.tmp';
    try { fs.writeFileSync(tmp, safeStorage.encryptString(JSON.stringify(cache)), { mode: 0o600 }); fs.renameSync(tmp, file()); return true; } catch (_) { return false; }
  }
  const origin = o => { try { const u = new URL(String(o)); return /^https?:$/.test(u.protocol) && u.origin.length <= 300 ? u.origin : ''; } catch (_) { return ''; } };
  const str = (v, n) => (typeof v === 'string' && v.length <= n) ? v : null;
  const fromUi = e => { const w = getWin && getWin(); return !!(w && !w.isDestroyed() && e.sender === w.webContents); };
  const guard = f => (e, ...a) => (fromUi(e) ? f(...a) : { error: 'denied' });
  const state = () => (!available() ? { error: 'unavailable' } : (load(), broken ? { error: 'unreadable' } : null));

  ipcMain.handle('pw:status', guard(() => ({ available: available() && !(load(), broken), error: state() && state().error })));
  ipcMain.handle('pw:list', guard(() => { const s = state(); if (s) return s; return { items: load().items.map(i => ({ id: i.id, origin: i.origin, username: i.username, updated: i.updated })) }; }));
  ipcMain.handle('pw:find', guard(o => { const s = state(); if (s) return s; o = origin(o); return { items: o ? load().items.filter(i => i.origin === o).map(i => ({ id: i.id, username: i.username })) : [] }; }));
  ipcMain.handle('pw:get', guard(id => { const s = state(); if (s) return s; const i = load().items.find(x => x.id === id); return i ? { password: i.password, username: i.username, origin: i.origin } : { error: 'missing' }; }));
  // is this login new, the same as one we have, or a changed password for a known username?
  ipcMain.handle('pw:check', guard(d => {
    const s = state(); if (s) return s; d = d || {}; const o = origin(d.origin), u = str(d.username, 300), p = str(d.password, 1000);
    if (!o || u === null || !p) return { result: 'skip' };
    const t = load(); if (t.never.includes(o)) return { result: 'never' };
    const ex = t.items.find(i => i.origin === o && i.username === u);
    return !ex ? { result: 'new' } : ex.password === p ? { result: 'same' } : { result: 'update', id: ex.id };
  }));
  ipcMain.handle('pw:save', guard(d => {
    const s = state(); if (s) return s; d = d || {}; const o = origin(d.origin), u = str(d.username, 300), p = str(d.password, 1000);
    if (!o || u === null || !p) return { error: 'invalid' };
    const t = load(), now = Date.now(); let ex = t.items.find(i => i.origin === o && i.username === u);
    if (ex) { ex.password = p; ex.updated = now; }
    else { if (t.items.length >= MAXN) return { error: 'full' }; ex = { id: crypto.randomUUID(), origin: o, username: u, password: p, created: now, updated: now }; t.items.push(ex); }
    return save() ? { ok: true, id: ex.id } : { error: 'write' };
  }));
  ipcMain.handle('pw:delete', guard(id => { const s = state(); if (s) return s; const t = load(), n = t.items.length; t.items = t.items.filter(i => i.id !== id); return t.items.length < n && save() ? { ok: true } : { error: 'missing' }; }));
  ipcMain.handle('pw:never', guard(o => { const s = state(); if (s) return s; o = origin(o); if (!o) return { error: 'invalid' }; const t = load(); if (!t.never.includes(o)) t.never.push(o); return save() ? { ok: true } : { error: 'write' }; }));
};
