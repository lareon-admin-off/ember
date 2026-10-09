const { app, BrowserWindow, shell, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { checkScam, checkRisk, isLocalHost, isRiskyFile } = require('./safety');

const setup = require('./welcome'); // first-run setup wizard (gates the browser)
let win;
let isReady = false;

function create() {
  if (!isReady || !app.isReady()) return;
  if (win && !win.isDestroyed()) { win.focus(); return; }
  if (setup.needed()) { setup.run(create); return; }
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 720, minHeight: 480,
    backgroundColor: '#16141f', show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : process.platform === 'win32' ? 'hidden' : 'default',
    ...(process.platform === 'win32' ? { titleBarOverlay: { color: '#1e1c2a', symbolColor: '#f3eef6', height: 44 } } : {}),
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true, contextIsolation: true, nodeIntegration: false
    }
  });
  win.once('ready-to-show', () => win.show());
  win.loadFile('index.html');
  if (process.platform !== 'darwin') win.removeMenu(); // no File/Edit/View bar on Windows and Linux
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) win.webContents.send('open-tab', url);
    return { action: 'deny' };
  });
}

// webviews: open links in tabs, keep them sandboxed, block non-web schemes
const notice = m => { try { if (win && !win.isDestroyed()) win.webContents.send('notice', m); } catch (_) {} };
app.on('web-contents-created', (_, wc) => {
  if (wc.getType() === 'window') {
    // webviews are page content: never let them get a preload script or Node access
    wc.on('will-attach-webview', (e, prefs, params) => {
      delete prefs.preload; delete prefs.preloadURL;
      prefs.nodeIntegration = false; prefs.nodeIntegrationInSubFrames = false; prefs.contextIsolation = true; prefs.sandbox = true; prefs.webSecurity = true;
      if (params.src && !/^(https?:|about:blank)/i.test(params.src)) e.preventDefault();
    });
  }
  if (wc.getType() === 'webview') {
    hookDownloads(wc.session, !wc.session.storagePath);
    hookSecurity(wc.session);
    wc.setWindowOpenHandler(({ url }) => {
      if (/^https?:/i.test(url)) win && win.webContents.send('open-tab', url, wc.id);
      return { action: 'deny' };
    });
    wc.on('before-input-event', (e, input) => {
      if (input.type !== 'keyDown' || !(input.control || input.meta)) return;
      if (/^(t|T|N|w|r|l|b|B|f|d|p|A|\[|\]|Tab|=|\+|-|0|[1-9])$/.test(input.key)) { e.preventDefault(); win && win.webContents.send('shortcut', { key: input.key, shift: input.shift }); }
    });
    wc.on('will-navigate', (e, url) => {
      if (/^(https?|about|file):/i.test(url)) return;
      e.preventDefault();
      if (/^(mailto|tel):/i.test(url)) shell.openExternal(url);
      else notice('Blocked a page from opening another app (' + (url.split(':')[0] || 'unknown') + ':).');
    });
  }
});

// ---- security: certificate info, overrides, local threat lists ----
const certSeen = new Map(), certAllow = new Set(), threatAllow = new Set(), adultAllow = new Set(), scamAllow = new Set(), httpAllow = new Set(), secSeen = new WeakSet();
// "proceed anyway" choices are remembered per tab (webContents id + host), so opening the same site in a new tab shows the warning again
const akey = (id, h) => (Number(id) || 0) + '|' + String(h || '').toLowerCase();
let badHosts = new Set(), badUrls = new Set(), threatMeta = { updated: 0 };
const hostOf = u => { try { return new URL(u).hostname.toLowerCase().replace(/\.$/, ''); } catch (_) { return ''; } };
const threatKey = u => { try { const x = new URL(u); return x.hostname.toLowerCase() + x.pathname.replace(/\/$/, ''); } catch (_) { return ''; } };
// Lareon's own sites are exempt from the threat and adult lists only. They get the same certificate checks as everyone.
const isLareonHost = h => { h = String(h || '').toLowerCase().replace(/\.$/, ''); return h === 'lareon.org' || h.endsWith('.lareon.org'); };
function checkThreat(u) {
  const h = hostOf(u); if (!h || isLareonHost(h)) return null;
  const parts = h.split('.');
  for (let i = 0; i <= parts.length - 2; i++) if (badHosts.has(parts.slice(i).join('.'))) return { kind: 'malware', host: h, source: 'URLhaus' };
  if (badUrls.has(threatKey(u))) return { kind: 'phishing', host: h, source: 'OpenPhish' };
  return null;
}
// ---- adult sites: warn (not block) before loading ----
const ADULT_SEED = ['pornhub.com','xvideos.com','xnxx.com','xhamster.com','redtube.com','youporn.com','spankbang.com','eporner.com','tube8.com','tnaflix.com','motherless.com','onlyfans.com','fansly.com','chaturbate.com','stripchat.com','brazzers.com','nhentai.net','e621.net'];
let adultHosts = new Set(ADULT_SEED), adultLoaded = false; const adultMeta = { updated: 0 };
const ADULT_TLD = /\.(xxx|porn|adult|sex)$/;
const ADULT_WORD = /(^|[.-])(porn|porno|xxx|hentai|nhentai|xvideos|xnxx|xhamster|pornhub|nsfw)([.-]|$)/;
function checkAdult(u) {
  const h = hostOf(u); if (!h || isLareonHost(h)) return null;
  if (/\.(edu|gov|mil)$/.test(h) || /\.(ac|edu|gov)\.[a-z]{2}$/.test(h)) return null;
  const parts = h.split('.');
  for (let i = 0; i <= parts.length - 2; i++) if (adultHosts.has(parts.slice(i).join('.'))) return { kind: 'adult', host: h, source: 'Ember adult-site list' };
  if (ADULT_TLD.test(h) || ADULT_WORD.test(h)) return { kind: 'adult', host: h, source: 'the address' };
  return null;
}
const adultFile = () => path.join(app.getPath('userData'), 'adult.json');
async function loadAdult(force) {
  if (!adultLoaded) { adultLoaded = true; try { const j = JSON.parse(fs.readFileSync(adultFile(), 'utf8')); adultMeta.updated = j.updated || 0; adultHosts = new Set([...ADULT_SEED, ...j.hosts]); } catch (_) {} }
  if (!force && Date.now() - adultMeta.updated < 24 * 3600e3) return;
  try {
    const get = u => fetch(u, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'Ember/0.9' } }).then(r => r.ok ? r.text() : '').catch(() => '');
    let txt = await get('https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/porn-only/hosts');
    if (!txt) txt = await get('https://raw.githubusercontent.com/StevenBlack/hosts/master/extensions/porn/sinfonietta/hosts');
    const hosts = [];
    txt.split('\n').forEach(l => { l = l.trim(); if (!l || l[0] === '#') return; const p = l.split(/\s+/); if (!/^(0\.0\.0\.0|127\.0\.0\.1)$/.test(p[0])) return; const h = (p[1] || '').toLowerCase(); if (h.includes('.') && !/^[\d.]+$/.test(h)) hosts.push(h); });
    if (hosts.length > 1000) { adultHosts = new Set([...ADULT_SEED, ...hosts]); adultMeta.updated = Date.now(); fs.writeFileSync(adultFile(), JSON.stringify({ hosts, updated: adultMeta.updated })); }
  } catch (_) {}
}
const threatFile = () => path.join(app.getPath('userData'), 'threats.json');
async function loadThreats(force) {
  if (!badHosts.size && !badUrls.size) { try { const j = JSON.parse(fs.readFileSync(threatFile(), 'utf8')); badHosts = new Set(j.hosts); badUrls = new Set(j.urls); threatMeta.updated = j.updated || 0; } catch (_) {} }
  if (!force && Date.now() - threatMeta.updated < 6 * 3600e3) return;
  try {
    const get = u => fetch(u, { signal: AbortSignal.timeout(25000), headers: { 'User-Agent': 'Ember/0.9' } }).then(r => r.ok ? r.text() : '').catch(() => '');
    const [a, b] = await Promise.all([get('https://urlhaus.abuse.ch/downloads/hostfile/'), get('https://openphish.com/feed.txt')]);
    const hosts = new Set(), urls = new Set();
    a.split('\n').forEach(l => { l = l.trim(); if (!l || l[0] === '#') return; const p = l.split(/\s+/), h = (p[1] || p[0] || '').toLowerCase(); if (h.includes('.')) hosts.add(h); });
    b.split('\n').forEach(l => { const k = threatKey(l.trim()); if (k) urls.add(k); });
    if (hosts.size) badHosts = hosts;
    if (urls.size) badUrls = urls;
    if (hosts.size || urls.size) { threatMeta.updated = Date.now(); fs.writeFileSync(threatFile(), JSON.stringify({ hosts: [...badHosts], urls: [...badUrls], updated: threatMeta.updated })); }
  } catch (_) {}
}
const who = (p, k) => { try { return (p && (p.organizations && p.organizations[0] || p.commonName)) || k || ''; } catch (_) { return k || ''; } };
// ---- site permissions: nothing is granted unless the person says yes ----
const PERM_ASK = new Set(['media', 'geolocation', 'notifications', 'clipboard-read', 'midi', 'midiSysex']);
const PERM_OK = new Set(['fullscreen', 'pointerLock', 'clipboard-sanitized-write', 'keyboardLock', 'speaker-selection']);
const permDecided = new Map(), permPending = new Map(); let permId = 0;
const permGranted = (wcid, host, perm) => { const pre = akey(wcid, host) + '|' + perm; for (const [k, v] of permDecided) if (v && (k === pre || k.startsWith(pre + ':'))) return true; return false; };
function handlePermission(wc, perm, cb, details) {
  if (PERM_OK.has(perm)) return cb(true);
  if (!PERM_ASK.has(perm)) return cb(false);
  if (prefs.calm && (perm === 'notifications' || perm === 'geolocation')) return cb(false);
  const host = hostOf((details && details.requestingUrl) || (wc && wc.getURL()) || '');
  const media = perm === 'media' ? ((details && details.mediaTypes) || []).slice().sort() : [];
  const key = akey(wc && wc.id, host) + '|' + perm + (media.length ? ':' + media.join('+') : '');
  if (permDecided.has(key)) return cb(permDecided.get(key));
  if (!host || !win || win.isDestroyed()) return cb(false);
  const id = ++permId; permPending.set(id, { cb, key });
  win.webContents.send('perm:ask', { id, wc: wc ? wc.id : 0, host, perm, media });
}
ipcMain.on('perm:answer', (_, id, allow) => { const p = permPending.get(id); if (!p) return; permPending.delete(id); permDecided.set(p.key, !!allow); try { p.cb(!!allow); } catch (_) {} });

// ---- plain http: upgrade to https when the site supports it, otherwise warn ----
const httpsSeen = new Map();
async function httpsWorks(h) {
  const c = httpsSeen.get(h); if (c && Date.now() - c.t < 600e3) return c.ok;
  let ok = false;
  try { await session.fromPartition('ember-probe').fetch('https://' + h + '/', { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(4500) }); ok = true; } catch (_) {}
  httpsSeen.set(h, { ok, t: Date.now() }); if (httpsSeen.size > 300) httpsSeen.delete(httpsSeen.keys().next().value);
  return ok;
}

// ---- 1.0 preferences pushed from the Ember window ----
const prefs = { cleanLinks: true, calm: false, focusUntil: 0, focusSites: [] };
ipcMain.on('prefs:set', (_, o) => {
  if (!o || typeof o !== 'object') return;
  if ('cleanLinks' in o) prefs.cleanLinks = !!o.cleanLinks;
  if ('calm' in o) prefs.calm = !!o.calm;
  if ('focusUntil' in o) prefs.focusUntil = Number(o.focusUntil) || 0;
  if (Array.isArray(o.focusSites)) prefs.focusSites = o.focusSites.map(x => String(x).toLowerCase().replace(/^www\./, '')).filter(Boolean).slice(0, 100);
});
const TRACK = /^(utm_[a-z]+|fbclid|gclid|dclid|msclkid|yclid|igshid|mc_eid|mc_cid|_hsenc|_hsmi|mkt_tok|vero_id|twclid|ttclid|li_fat_id|oly_enc_id|oly_anon_id|spm|ref_src)$/i;
function cleanUrl(u) {
  try {
    const x = new URL(u); if (!x.search || isLocalHost(x.hostname)) return null;
    let hit = false; for (const k of [...x.searchParams.keys()]) if (TRACK.test(k)) { x.searchParams.delete(k); hit = true; }
    return hit ? x.href : null;
  } catch (_) { return null; }
}
const focusBlocked = h => { if (Date.now() >= prefs.focusUntil || !prefs.focusSites.length) return false; h = String(h).replace(/^www\./, ''); return prefs.focusSites.some(s => h === s || h.endsWith('.' + s)); };

function hookSecurity(ses) {
  if (secSeen.has(ses)) return; secSeen.add(ses);
  ses.setCertificateVerifyProc((req, cb) => {
    try {
      const c = req.certificate;
      certSeen.set(req.hostname, { subject: (c.subject && c.subject.commonName) || c.subjectName || '', issuer: who(c.issuer, c.issuerName), validStart: c.validStart, validExpiry: c.validExpiry, fingerprint: c.fingerprint, bad: !!((req.errorCode && req.errorCode !== 0) || (req.verificationResult && !/^(net::)?OK$/i.test(String(req.verificationResult)))) });
      if (certSeen.size > 500) certSeen.delete(certSeen.keys().next().value);
    } catch (_) {}
    cb(-3);
  });
  ses.setPermissionRequestHandler(handlePermission);
  ses.setPermissionCheckHandler((wc, perm, origin) => PERM_OK.has(perm) || (PERM_ASK.has(perm) && permGranted(wc && wc.id, hostOf(origin || ''), perm)));
  ses.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (d, cb) => {
    if (d.resourceType === 'mainFrame') {
      const h = hostOf(d.url), wcId = d.webContentsId || 0;
      if (focusBlocked(h)) { try { if (win && !win.isDestroyed()) win.webContents.send('focus:blocked', { wc: wcId, host: h, until: prefs.focusUntil }); } catch (_) {} return cb({ cancel: true }); }
      if (prefs.cleanLinks) { const cl = cleanUrl(d.url); if (cl) return cb({ redirectURL: cl }); }
      // tell the Ember window right away, so it shows the warning screen no matter which error code Chromium reports for the cancelled load
      const block = (kind, info) => { try { if (win && !win.isDestroyed()) win.webContents.send('nav:blocked', { wc: wcId, url: d.url, kind, info }); } catch (_) {} return cb({ cancel: true }); };
      const th = checkThreat(d.url); if (th && !threatAllow.has(akey(wcId, h))) return block('threat', th);
      const sc = isLareonHost(h) ? null : checkScam(d.url); if (sc && !scamAllow.has(akey(wcId, h))) return block('scam', sc);
      const rk = isLareonHost(h) ? null : checkRisk(d.url); if (rk && !scamAllow.has(akey(wcId, h))) return block('risk', rk);
      const ad = checkAdult(d.url); if (ad && !adultAllow.has(akey(wcId, h))) return block('adult', ad);
      if (/^http:/i.test(d.url) && !isLocalHost(h) && !httpAllow.has(akey(wcId, h))) {
        let u; try { u = new URL(d.url); } catch (_) { return cb({}); }
        const info = { host: h, source: 'Ember HTTPS check', canUpgrade: !u.port };
        if (u.port) return block('insecure', info);
        return httpsWorks(h).then(ok => { if (ok) { u.protocol = 'https:'; return cb({ redirectURL: u.href }); } block('insecure', info); });
      }
    }
    cb({});
  });
}
app.on('certificate-error', (e, wc, url, err, cert, cb) => { e.preventDefault(); const h = hostOf(url); cb(certAllow.has(akey(wc && wc.id, h))); });
ipcMain.handle('cert:get', (_, h, id) => { h = String(h).toLowerCase(); const c = certSeen.get(h), o = certAllow.has(akey(id, h)); return c ? { ...c, overridden: o } : (o ? { overridden: true, bad: true } : null); });
ipcMain.handle('cert:allow', (_, h, id) => { certAllow.add(akey(id, h)); return true; });
ipcMain.handle('threat:check', (_, u) => checkThreat(String(u)));
ipcMain.handle('threat:status', () => ({ hosts: badHosts.size, urls: badUrls.size, updated: threatMeta.updated }));
ipcMain.handle('threat:allow', (_, h, id) => { threatAllow.add(akey(id, h)); return true; });
ipcMain.handle('scam:check', (_, u) => isLareonHost(hostOf(String(u))) ? null : (checkScam(String(u)) || checkRisk(String(u))));
ipcMain.handle('scam:allow', (_, h, id) => { scamAllow.add(akey(id, h)); return true; });
ipcMain.handle('http:allow', (_, h, id) => { httpAllow.add(akey(id, h)); return true; });
ipcMain.handle('adult:check', (_, u) => checkAdult(String(u)));
ipcMain.handle('adult:allow', (_, h, id) => { adultAllow.add(akey(id, h)); return true; });

// downloads: save to the Downloads folder, report progress to the UI
const dlSeen = new WeakSet(), dlItems = new Map(), dlPaths = new Set(); let dlId = 0;
const dlDir = () => setup.downloadDir() || app.getPath('downloads');
function hookDownloads(ses, priv) {
  if (dlSeen.has(ses)) return; dlSeen.add(ses);
  ses.on('will-download', (_, item) => {
    for (const u of [...(item.getURLChain() || []), item.getURL()]) if (checkThreat(u)) { item.cancel(); notice('Blocked a download from a known dangerous site.'); return; }
    const id = ++dlId, dir = dlDir();
    const fn = path.basename(item.getFilename() || 'download'), ext = path.extname(fn), base = path.basename(fn, ext);
    let target = path.join(dir, fn), k = 1;
    while (fs.existsSync(target)) target = path.join(dir, base + ' (' + (k++) + ')' + ext);
    item.setSavePath(target); dlItems.set(id, item); dlPaths.add(target); const risky = isRiskyFile(target);
    const src = hostOf(item.getURL()), parts = fn.toLowerCase().split('.').slice(1), dbl = parts.length >= 2 && isRiskyFile('x.' + parts[parts.length - 1]) && /^(pdf|docx?|xlsx?|pptx?|jpe?g|png|gif|txt|mp[34]|zip|rtf)$/.test(parts[parts.length - 2]);
    const warn = dbl ? 'This file pretends to be a ' + parts[parts.length - 2].toUpperCase() + ' but is really a program. That is a common trick.' : '';
    const send = state => { if (win && !win.isDestroyed()) win.webContents.send('dl:update', { id, name: path.basename(target), path: target, received: item.getReceivedBytes(), total: item.getTotalBytes(), state, priv, risky, src, warn }); };
    send('progressing');
    item.on('updated', (_, st) => send(st === 'interrupted' ? 'interrupted' : (item.isPaused() ? 'paused' : 'progressing')));
    item.once('done', (_, st) => { dlItems.delete(id); send(st); });
  });
}
const inDownloads = p => { const r = path.resolve(String(p || '')); return [dlDir(), app.getPath('downloads')].some(d => r.startsWith(path.resolve(d) + path.sep)); };
ipcMain.on('dl:cancel', (_, id) => { const it = dlItems.get(id); if (it) it.cancel(); });
ipcMain.on('dl:show', (_, p) => { if (inDownloads(p)) shell.showItemInFolder(p); });
ipcMain.on('dl:open', (_, p) => {
  if (!inDownloads(p)) return;
  if (isRiskyFile(p)) shell.showItemInFolder(p); else shell.openPath(p);
});
ipcMain.on('dl:discard', (_, id, p) => { const it = dlItems.get(id); if (it) it.cancel(); if (dlPaths.has(p) && inDownloads(p)) setTimeout(() => { try { fs.unlinkSync(p); } catch (_) {} }, it ? 400 : 0); });
// private tabs: wipe everything their in-memory session held
ipcMain.handle('data:clear', async (_, o) => {
  o = o || {};
  try {
    const ses = session.defaultSession;
    if (o.site) await ses.clearStorageData();
    if (o.cache) { await ses.clearCache(); await ses.clearAuthCache(); }
    return true;
  } catch (_) { return false; }
});
ipcMain.handle('private:wipe', async (_, id) => {
  const n = parseInt(id, 10); if (!n) return false;
  try { const ses = session.fromPartition('ember-private-' + n); await ses.clearStorageData(); await ses.clearCache(); await ses.clearAuthCache(); await ses.clearHostResolverCache(); return true; } catch (_) { return false; }
});

app.whenReady().then(() => {
  isReady = true;
  loadThreats(); setInterval(() => loadThreats(true), 6 * 3600e3);
  loadAdult(); setInterval(() => loadAdult(true), 24 * 3600e3);
  create();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => {
  if (!isReady || !app.isReady()) return;
  if (!BrowserWindow.getAllWindows().length) create();
});

// Ember Search: use free data sources only. Ember renders every result itself.
const SEARCH_INSTANCES = [
  'https://search.ctq.ro',
  'https://searx.tiekoetter.com',
  'https://search.hbubli.cc'
];

function decodeHtml(v) {
  return String(v || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ').trim();
}

// Search engines wrap result links in redirect URLs (e.g. bing.com/ck/a?u=a1<base64>).
// Every wrapped link shares the same origin+path, so the dedupe step used to collapse
// them all into a single result. Unwrap them to the real destination first.
function unwrapRedirect(u) {
  const ru = String(u).match(/\/RU=([^/]+)\/R[KS]=/);
  if (ru) { try { return decodeURIComponent(ru[1]); } catch (_) {} }
  try {
    const x = new URL(u, 'https://duckduckgo.com');
    if (/(^|\.)duckduckgo\.com$/i.test(x.hostname) && x.pathname.startsWith('/l')) {
      const t = x.searchParams.get('uddg'); if (t) return t;
    }
    if (/(^|\.)bing\.com$/i.test(x.hostname) && x.pathname.startsWith('/ck/')) {
      let p = x.searchParams.get('u');
      if (p) {
        if (/^a\d/.test(p)) p = p.slice(2);
        p = p.replace(/-/g, '+').replace(/_/g, '/');
        const d = Buffer.from(p, 'base64').toString('utf8');
        if (/^https?:\/\//i.test(d)) return d;
      }
      return ''; // undecodable Bing tracker link: drop it
    }
  } catch (_) {}
  return u;
}
function urlKey(u) {
  try {
    const x = new URL(u), keep = [];
    x.searchParams.forEach((v, k) => { if (!/^(utm_|fbclid|gclid|ref$|ref_|cmpid|mc_)/i.test(k)) keep.push(k + '=' + v); });
    keep.sort();
    return x.hostname.replace(/^www\./, '').toLowerCase() + x.pathname.replace(/\/$/, '') + (keep.length ? '?' + keep.join('&') : '');
  } catch (_) { return String(u); }
}
function absUrl(href, base) {
  try { return new URL(href, base).href; } catch { return ''; }
}
function rankResults(results, query) {
  const terms = query.toLowerCase().split(/\s+/).filter(x => x.length > 1);
  const seen = new Set();
  return results.map(x => ({...x, title: decodeHtml(x.title), desc: decodeHtml(x.desc)}))
    .filter(x => /^https?:\/\//i.test(x.url))
    .filter(x => { try { new URL(x.url); const k=urlKey(x.url); if(seen.has(k)) return false; seen.add(k); return true; } catch { return false; } })
    .map(x => {
      const title=x.title.toLowerCase(), desc=x.desc.toLowerCase(), url=x.url.toLowerCase();
      let score = 100 - ((x._provider||0)*3) - (x._rank||0)*1.5;
      for(const term of terms){ if(title.includes(term)) score+=12; if(desc.includes(term)) score+=4; if(url.includes(term)) score+=2; }
      if(title.includes(query.toLowerCase())) score+=25;
      return {...x,score};
    }).sort((a,b)=>b.score-a.score).map(({score,_provider,_rank,...x})=>x);
}
async function searxSearch(query, page = 1) {
  // Ask every available public SearXNG instance instead of stopping at the
  // first one. This gives Ember a real pool of results when one instance
  // returns only a small set or has incomplete upstream coverage.
  const jobs = SEARCH_INSTANCES.map(async (base, providerIndex) => {
    try {
      const url = base + '/search?q=' + encodeURIComponent(query) + '&format=json&categories=general&safesearch=1&pageno=' + page;
      const r = await fetch(url, {
        signal: AbortSignal.timeout(6500),
        headers: {Accept:'application/json','User-Agent':'Ember/0.9'}
      });
      if (!r.ok) return [];
      const j = await r.json();
      if (!Array.isArray(j.results)) return [];
      return j.results.map((x, i) => ({
        title: x.title || x.url,
        url: x.url,
        desc: x.content || x.description || '',
        _provider: providerIndex,
        _rank: i
      }));
    } catch (_) {
      return [];
    }
  });

  const groups = await Promise.all(jobs);
  const merged = groups.flat();
  const seen = new Set();
  return merged.filter(x => {
    try {
      new URL(x.url);
      const key = urlKey(x.url);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    } catch (_) {
      return false;
    }
  });
}
async function htmlSearch(url, parser) {
  try {
    const r = await fetch(url, {signal: AbortSignal.timeout(9000), headers:{'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 Chrome/154 Safari/537.36','Accept':'text/html','Accept-Language':'en-US,en;q=0.9'}});
    if (!r.ok) return [];
    return parser(await r.text());
  } catch (_) { return []; }
}
function parseBing(html) {
  const out=[];
  const re=/<li[^>]+class=["'][^"']*b_algo[^"']*["'][\s\S]*?<\/li>/gi; let m;
  while((m=re.exec(html)) && out.length<100){ const block=m[0]; const a=block.match(/<h2[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i); if(!a) continue; const p=block.match(/<p[^>]*>([\s\S]*?)<\/p>/i); const u=unwrapRedirect(decodeHtml(a[1])); if(/^https?:/i.test(u)) out.push({title:a[2],url:u,desc:p?p[1]:''}); }
  return out;
}
function parseDuck(html) {
  const out=[];
  const re=/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi; let m;
  while((m=re.exec(html)) && out.length<100){
    let u=decodeHtml(m[1]);
    if(u.startsWith('//')) u='https:'+u;
    u=unwrapRedirect(u);
    if(!/^https?:\/\//i.test(u)) continue;
    const before=html.slice(Math.max(0,m.index-500),Math.min(html.length,m.index+1600));
    const sn=before.match(/class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    out.push({title:m[2],url:u,desc:sn?sn[1]:''});
  }
  return out;
}
function parseDuckLite(html) {
  const out=[]; const re=/<a[^>]+rel=["']nofollow["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi; let m;
  while((m=re.exec(html)) && out.length<100){
    let u=decodeHtml(m[1]); if(u.startsWith('//')) u='https:'+u;
    u=unwrapRedirect(u);
    if(!/^https?:\/\//i.test(u) || /duckduckgo\.com/i.test(u)) continue;
    const title=decodeHtml(m[2]); if(!title || title.length<2) continue;
    const tail=html.slice(m.index, m.index+1800); const sn=tail.match(/class=["'][^"']*(?:result-snippet|snippet)[^"']*["'][^>]*>([\s\S]*?)<\//i);
    out.push({title,url:u,desc:sn?sn[1]:''});
  }
  return out;
}

function parseBrave(html) {
  const out=[]; const seen=new Set();
  // Brave's result markup has changed over time, so look for result-title links and fall back to generic external links.
  const patterns=[
    /<a[^>]+href=["']([^"']+)["'][^>]*class=["'][^"']*(?:snippet-title|result-header|heading)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi,
    /<a[^>]+class=["'][^"']*(?:snippet-title|result-header|heading)[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  ];
  for(const re of patterns){let m;while((m=re.exec(html))&&out.length<100){let u=decodeHtml(m[1]);if(u.startsWith('/'))u='https://search.brave.com'+u;if(!/^https?:\/\//i.test(u)||/search\.brave\.com/i.test(u))continue;let title=decodeHtml(m[2]);if(!title||title.length<2)continue;if(!seen.has(u)){seen.add(u);out.push({title,url:u,desc:''});}}}
  return out;
}
async function braveSearch(query, page = 1){
  return htmlSearch('https://search.brave.com/search?q='+encodeURIComponent(query)+'&source=web&offset='+(page-1),parseBrave);
}
function parseMojeek(html) {
  const out=[]; let m;
  const re=/<a[^>]+(?:class=["'][^"']*\btitle\b[^"']*["'][^>]*href=["']([^"']+)["']|href=["']([^"']+)["'][^>]*class=["'][^"']*\btitle\b[^"']*["'])[^>]*>([\s\S]*?)<\/a>/gi;
  while((m=re.exec(html)) && out.length<100){
    const u=decodeHtml(m[1]||m[2]); if(!/^https?:\/\//i.test(u)) continue;
    const sn=html.slice(m.index,m.index+2500).match(/<p[^>]+class=["'][^"']*\bs\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
    out.push({title:m[3],url:u,desc:sn?sn[1]:''});
  }
  return out;
}
function parseYahoo(html) {
  const out=[]; let m;
  const re=/<a[^>]+href=["']([^"']*\/RU=[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  while((m=re.exec(html)) && out.length<100){
    const u=unwrapRedirect(decodeHtml(m[1])); if(!/^https?:\/\//i.test(u) || /yahoo\.com/i.test(u)) continue;
    const title=decodeHtml(m[2]); if(!title || title.length<3) continue;
    const sn=html.slice(m.index,m.index+3000).match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    out.push({title,url:u,desc:sn?sn[1]:''});
  }
  return out;
}
async function wikiSearch(query, page = 1) {
  try {
    const r = await fetch('https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=15&sroffset='+((page-1)*15)+'&srsearch='+encodeURIComponent(query),
      {signal:AbortSignal.timeout(7000), headers:{'User-Agent':'Ember/0.9 (browser by Lareon)'}});
    if (!r.ok) return [];
    const j = await r.json();
    return ((j.query && j.query.search) || []).map(x => ({title:x.title, url:'https://en.wikipedia.org/wiki/'+encodeURIComponent(String(x.title).replace(/ /g,'_')), desc:x.snippet||''}));
  } catch (_) { return []; }
}
ipcMain.handle('search:query', async (_, q, pageNo) => {
  const query = String(q).trim().slice(0, 300);
  const page = Math.max(1, Math.min(50, parseInt(pageNo, 10) || 1));
  if (!query) return {results:[], page};
  // Ask every free provider for this page and merge them, so each Ember results page is a
  // big pool (often 20-40 results) rather than whatever a single engine returned.
  const enc = encodeURIComponent(query);
  const groups = await Promise.all([
    searxSearch(query, page),
    htmlSearch('https://www.bing.com/search?q='+enc+'&count=50&first='+((page-1)*50+1)+'&setlang=en-US&cc=US', parseBing),
    htmlSearch('https://html.duckduckgo.com/html/?q='+enc+(page>1?'&s='+((page-1)*30)+'&dc='+((page-1)*30+1):''), parseDuck),
    htmlSearch('https://lite.duckduckgo.com/lite/?q='+enc+(page>1?'&s='+((page-1)*20):''), parseDuckLite),
    braveSearch(query, page),
    htmlSearch('https://www.mojeek.com/search?q='+enc+'&s='+((page-1)*10+1), parseMojeek),
    htmlSearch('https://search.yahoo.com/search?p='+enc+'&b='+((page-1)*10+1), parseYahoo),
    wikiSearch(query, page)
  ]);
  const [sx, bing, duck0, lite, brave, mojeek, yahoo, wiki] = groups;
  const duck = duck0.length ? duck0 : lite;
  const merged=[];
  [sx, bing, duck, brave, mojeek, yahoo, wiki].forEach((g, p) => g.forEach((x, i) => merged.push({...x, _provider:p, _rank:i})));
  // flag results that would trigger a warning screen, so people see it before they click
  const results = rankResults(merged, query).map(r => {
    if (isLareonHost(hostOf(r.url))) return r;
    const k = checkThreat(r.url) ? 'threat' : checkScam(r.url) ? 'scam' : (checkRisk(r.url) || {}).cat || (checkAdult(r.url) ? 'adult' : '');
    return k ? { ...r, warn: k } : r;
  });
  return results.length ? {results, page} : {error:'unavailable', page};
});
require('./features-main')({ app, ipcMain, session, dialog: require('electron').dialog, setup, hostOf, permDecided, getWin: () => win });
