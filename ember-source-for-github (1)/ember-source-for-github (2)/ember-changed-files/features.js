/* Ember 1.0 features. Loaded after the main browser script, so everything here builds on top of it. */
(function () {
  'use strict';
  const E = window.ember || {};
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch (_) { return ''; } };
  const isWebTab = t => !!(t && t.mode === 'web' && t.wv && /^https?:/i.test(t.url || ''));
  const X = s => esc(String(s));

  /* ---------- preferences ---------- */
  const P = Object.assign({ calm: false, clean: true, bar: true, startup: 'resume' }, lsGet('ember.prefs', {}));
  const savePrefs = () => { lsSet('ember.prefs', P); pushMain(); };
  let focus = lsGet('ember.focus', { until: 0, sites: ['youtube.com', 'facebook.com', 'instagram.com', 'x.com', 'tiktok.com', 'reddit.com'] });
  const pushMain = () => { try { E.prefsSet && E.prefsSet({ cleanLinks: P.clean, calm: P.calm, focusUntil: focus.until, focusSites: focus.sites }); } catch (_) {} };
  pushMain();

  /* ---------- styles ---------- */
  const css = document.createElement('style');
  css.textContent = `
.tab.pinned{border-left-color:var(--accent2)}
.tab.pinned>i{display:none}
.tab .pin-ic,.tab .tmp-ic{font-size:11px;font-style:normal;opacity:.85}
#morebtn{font-size:18px;line-height:1}
#focuspill,#calmpill{display:none;align-items:center;gap:6px;padding:0 12px;border-radius:999px;border:1px solid var(--border);font-size:12px;font-weight:600;white-space:nowrap;-webkit-app-region:no-drag;cursor:pointer;background:none;color:var(--text)}
#focuspill.on{display:flex;border-color:var(--accent);color:var(--accent)}
#calmpill.on{display:flex;color:#8fd3ff;border-color:#35506a}
#bmbar{display:none;gap:4px;padding:5px 10px;background:var(--surface);border-bottom:1px solid var(--border);overflow:hidden;white-space:nowrap}
#bmbar.show{display:flex}
#bmbar button{flex:none;max-width:170px;overflow:hidden;text-overflow:ellipsis;padding:4px 10px;border-radius:8px;font-size:12.5px;color:var(--text);background:none;border:0;cursor:pointer}
#bmbar button:hover{background:var(--surface2)}
#calc{position:fixed;z-index:60;display:none;padding:9px 14px;border-radius:12px;background:var(--surface2);border:1px solid var(--border);box-shadow:0 14px 40px rgba(0,0,0,.45);font-size:14px;color:var(--text)}
#calc b{color:var(--accent);font-size:16px}#calc small{display:block;color:var(--muted);font-size:11.5px;margin-top:2px}
.menu1{position:fixed;z-index:80;min-width:210px;padding:6px;border-radius:14px;background:var(--surface2);border:1px solid var(--border);box-shadow:0 18px 50px rgba(0,0,0,.55);display:none}
.menu1.show{display:block}
.menu1 button{display:flex;width:100%;justify-content:space-between;gap:16px;text-align:left;padding:8px 12px;border:0;border-radius:9px;background:none;color:var(--text);font-size:13.5px;cursor:pointer}
.menu1 button:hover{background:var(--surface)}
.menu1 hr{border:0;border-top:1px solid var(--border);margin:5px 4px}
.menu1 small{color:var(--muted)}
.ovl{position:fixed;inset:0;z-index:75;display:none;align-items:center;justify-content:center;background:rgba(10,8,16,.6);-webkit-app-region:no-drag}
.ovl.show{display:flex}
.card1{width:min(560px,92vw);max-height:86vh;overflow:auto;padding:22px 24px;border-radius:20px;background:var(--surface);border:1px solid var(--border);box-shadow:0 30px 90px rgba(0,0,0,.6);color:var(--text)}
.card1 h2{margin:0 0 4px;font-size:20px}.card1 h3{margin:20px 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.card1 p{margin:4px 0;color:var(--muted);font-size:13.5px;line-height:1.5}
.row1{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:9px 0;border-bottom:1px solid var(--border);font-size:14px}
.row1:last-child{border-bottom:0}.row1 small{display:block;color:var(--muted);font-size:12px;margin-top:2px;max-width:340px;overflow:hidden;text-overflow:ellipsis}
.btn1{padding:7px 14px;border-radius:10px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}
.btn1:hover{border-color:var(--accent)}.btn1.pri{background:var(--accent);border-color:var(--accent);color:#1a1008}
.btn1.danger{color:#ff8a9a}
.sw{position:relative;width:40px;height:23px;flex:none;border-radius:99px;background:var(--border);border:0;cursor:pointer;padding:0}
.sw::after{content:"";position:absolute;top:3px;left:3px;width:17px;height:17px;border-radius:50%;background:#fff;transition:transform .15s}
.sw.on{background:var(--accent)}.sw.on::after{transform:translateX(17px)}
.card1 textarea,.card1 select,.card1 input[type=text],.card1 input[type=password],.card1 input[type=email],.card1 input:not([type]){width:100%;padding:8px 10px;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--text);font:13px inherit;outline:none}
.sp-more{margin-top:14px;text-align:left;padding:12px 14px;border-radius:14px;background:var(--surface2);border:1px solid var(--border);font-size:13px}
.sp-more h4{margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted)}
.sp-more li{margin:3px 0;color:var(--text)}.sp-more ul{margin:0;padding-left:18px}
.sp-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
`;
  document.head.appendChild(css);

  /* ---------- pinned tabs ---------- */
  let pinned = lsGet('ember.pinned', []);
  const sortPins = () => { const a = tabs.filter(t => t.pinned), b = tabs.filter(t => !t.pinned); const m = a.concat(b); if (m.some((t, i) => t !== tabs[i])) { tabs.length = 0; m.forEach(t => tabs.push(t)); } };
  const savePins = () => { pinned = tabs.filter(t => t.pinned && !t.priv && /^https?:/i.test(t.url || '')).map(t => t.url); lsSet('ember.pinned', pinned); };
  function togglePin(t) { if (t.priv) return toast('Private tabs can’t be pinned'); t.pinned = !t.pinned; savePins(); render(); toast(t.pinned ? 'Pinned' : 'Unpinned'); }

  /* ---------- tab snooze + temporary tabs ---------- */
  const snoozed = () => lsGet('ember.snoozed', []);
  function snooze(t, ms) {
    if (!isWebTab(t) || t.priv) return toast('Only normal web pages can be snoozed');
    const l = snoozed(); l.push({ u: t.url, t: t.title, wake: Date.now() + ms }); lsSet('ember.snoozed', l);
    toast('Snoozed. It will come back ' + whenTxt(Date.now() + ms)); closeTab(t.id);
  }
  const whenTxt = ts => { const d = new Date(ts), n = new Date(); return (d.toDateString() === n.toDateString() ? 'today at ' : 'on ' + d.toLocaleDateString([], { weekday: 'short' }) + ' at ') + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
  function wakeDue() {
    const l = snoozed(), now = Date.now(), due = l.filter(x => x.wake <= now);
    if (due.length) { lsSet('ember.snoozed', l.filter(x => x.wake > now)); const keep = active; due.forEach(x => newTab(x.u)); toast(due.length === 1 ? 'A snoozed tab is back: ' + (due[0].t || due[0].u) : due.length + ' snoozed tabs are back'); }
  }
  function tmpTick() { const now = Date.now(); tabs.slice().forEach(t => { if (t.temp && t.temp <= now) { toast('Closed a temporary tab'); closeTab(t.id); } }); }
  setInterval(() => { wakeDue(); tmpTick(); }, 15000); setTimeout(wakeDue, 2500);

  /* ---------- render hook (pins, temp marks, bookmarks bar) ---------- */
  const _render = render;
  render = function () {
    sortPins(); _render();
    document.querySelectorAll('#tabs .tab').forEach(el => {
      const t = tabs.find(x => String(x.id) === el.dataset.id); if (!t) return;
      el.classList.toggle('pinned', !!t.pinned);
      if (t.pinned) { const i = document.createElement('i'); i.className = 'pin-ic'; i.textContent = '📌'; el.insertBefore(i, el.firstChild); }
      if (t.temp) { const i = document.createElement('i'); i.className = 'tmp-ic'; i.textContent = '⏳'; i.title = 'Temporary: closes ' + whenTxt(t.temp); el.appendChild(i); }
    });
    drawBar();
  };

  /* ---------- small menu helper ---------- */
  function menu(id) { let m = document.getElementById(id); if (!m) { m = document.createElement('div'); m.id = id; m.className = 'menu1'; document.body.appendChild(m); } return m; }
  function showMenu(m, items, x, y) {
    m.innerHTML = ''; items.forEach(it => {
      if (it === '-') return m.appendChild(document.createElement('hr'));
      const b = document.createElement('button'); b.innerHTML = '<span>' + X(it[0]) + '</span>' + (it[2] ? '<small>' + X(it[2]) + '</small>' : '');
      b.onclick = () => { m.classList.remove('show'); it[1](); }; m.appendChild(b);
    });
    m.classList.add('show'); const w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(x, innerWidth - w - 8)) + 'px'; m.style.top = Math.max(8, Math.min(y, innerHeight - h - 8)) + 'px';
  }
  document.addEventListener('mousedown', e => { document.querySelectorAll('.menu1.show').forEach(m => { if (!m.contains(e.target) && e.target.id !== 'morebtn') m.classList.remove('show'); }); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.menu1.show').forEach(m => m.classList.remove('show')); });

  const hrs = h => h * 3600e3;
  const tomorrow9 = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d - Date.now(); };
  const tonight6 = () => { const d = new Date(); d.setHours(18, 0, 0, 0); if (d <= Date.now() + 36e5) d.setDate(d.getDate() + 1); return d - Date.now(); };
  document.addEventListener('contextmenu', e => {
    const el = e.target.closest && e.target.closest('#tabs .tab'); if (!el) return;
    e.preventDefault(); e.stopPropagation();
    const t = tabs.find(x => String(x.id) === el.dataset.id); if (!t) return;
    const web = isWebTab(t), m = menu('tabmenu');
    showMenu(m, [
      [t.pinned ? 'Unpin tab' : 'Pin tab', () => togglePin(t)],
      ['Snooze for 1 hour', () => snooze(t, hrs(1))], ['Snooze until this evening', () => snooze(t, tonight6())], ['Snooze until tomorrow morning', () => snooze(t, tomorrow9())],
      '-',
      [t.temp ? 'Keep this tab' : 'Make temporary (30 min)', () => { t.temp = t.temp ? 0 : Date.now() + 30 * 60e3; render(); toast(t.temp ? 'This tab will close itself in 30 minutes' : 'This tab will stay'); }],
      ...(t.temp ? [['Make temporary (2 hours)', () => { t.temp = Date.now() + hrs(2); render(); }]] : []),
      '-',
      ...(web ? [['Reader view', () => { select(t.id); readerView(t); }], ['Duplicate tab', () => newTab(t.url)]] : []),
      ['Close tab', () => closeTab(t.id)]
    ], e.clientX, e.clientY);
  }, true);

  /* ---------- reader view ---------- */
  async function readerView(t) {
    if (!isWebTab(t)) return toast('Open a web page first');
    const js = `(function(){try{
      var cands=[].slice.call(document.querySelectorAll('article,main,[role=main],#content,.content,.post,body')),best=null,bs=0;
      cands.forEach(function(c){var n=c.querySelectorAll('p').length,l=(c.innerText||'').length;var s=n*80+Math.min(l,20000)/10; if(c===document.body)s*=.7; if(s>bs){bs=s;best=c;}});
      if(!best)return false;var out=[],words=0;
      best.querySelectorAll('h1,h2,h3,p,li,blockquote,pre,img').forEach(function(n){
        if(n.closest('nav,header,footer,aside,form,[aria-hidden=true]'))return;
        if(n.tagName==='IMG'){if(n.naturalWidth>300&&n.src)out.push(['img',n.src,n.alt||'']);return;}
        var tx=(n.innerText||'').replace(/\\s+/g,' ').trim();if(!tx)return;
        if(n.tagName==='LI'&&tx.length<25)return;
        words+=tx.split(' ').length;out.push([n.tagName.toLowerCase(),tx]);});
      if(words<120)return false;
      var title=document.title;
      document.querySelectorAll('link[rel=stylesheet],style,script,noscript').forEach(function(n){n.remove();});
      document.head.innerHTML='<meta charset="utf-8"><title>'+title.replace(/</g,'')+'</title>';
      var st=document.createElement('style');st.textContent='html{background:#16141f}body{max-width:700px;margin:0 auto;padding:44px 24px 90px;font:19px/1.75 Georgia,serif;color:#e2e0ee}h1,h2,h3{font-family:system-ui,sans-serif;line-height:1.25;color:#fff}h1{font-size:34px}h2{font-size:25px;margin-top:1.6em}h3{font-size:20px}img{max-width:100%;border-radius:12px;margin:18px 0}blockquote{margin:1em 0;padding-left:18px;border-left:3px solid #ff7c1f;color:#b9b6cc}pre{overflow:auto;background:#1e1c2a;padding:14px;border-radius:10px;font-size:14px}li{margin:.3em 0}.rv{color:#7a7890;font:13px system-ui;margin-bottom:26px}';document.head.appendChild(st);
      document.body.removeAttribute('class');document.body.removeAttribute('style');document.body.innerHTML='';
      var rv=document.createElement('div');rv.className='rv';rv.textContent='Reader view \\u00b7 reload the page to go back';document.body.appendChild(rv);
      var inList=null;
      out.forEach(function(o){var el;
        if(o[0]==='img'){el=document.createElement('img');el.src=o[1];el.alt=o[2];}
        else if(o[0]==='li'){el=document.createElement('p');el.textContent='\\u2022 '+o[1];}
        else{el=document.createElement(o[0]);el.textContent=o[1];}
        document.body.appendChild(el);});
      return true;}catch(e){return false;}})()`;
    try { const ok = await t.wv.executeJavaScript(js); toast(ok ? 'Reader view. Reload the page to go back.' : 'This page doesn’t look like an article'); } catch (_) { toast('Reader view isn’t available on this page'); }
  }

  /* ---------- calm mode ---------- */
  const CALM_JS = `(function(){try{if(window.__emberCalm)return;window.__emberCalm=1;
    var stop=function(v){try{if(!(navigator.userActivation&&navigator.userActivation.isActive)){v.autoplay=false;v.pause();}}catch(e){}};
    document.addEventListener('play',function(e){if(e.target&&e.target.pause)stop(e.target);},true);
    document.querySelectorAll('video[autoplay],audio[autoplay]').forEach(stop);}catch(e){}})()`;
  function calmApply(w) { if (!P.calm) return; try { w.executeJavaScript(CALM_JS); } catch (_) {} }
  const pill = document.createElement('button'); pill.id = 'calmpill'; pill.textContent = '🌙 Calm'; pill.title = 'Calm mode is on. Click to turn it off.';
  pill.onclick = () => setCalm(false);
  function setCalm(v) { P.calm = !!v; savePrefs(); pill.classList.toggle('on', P.calm); toast(P.calm ? 'Calm mode on' : 'Calm mode off'); if (P.calm) tabs.forEach(t => t.wv && calmApply(t.wv)); drawSettings(); }

  /* ---------- per-site zoom + hooks on new pages ---------- */
  const zooms = lsGet('ember.zoom', {});
  const _mk = mkWv;
  mkWv = function (t) {
    _mk(t); const w = t.wv; if (!w) return;
    const apply = () => { try { const h = hostOf(w.getURL()); const z = zooms[h] || 1; if (z !== (t.zoom || 1) || z !== 1) { t.zoom = z; w.setZoomFactor(z); } } catch (_) {} };
    w.addEventListener('dom-ready', () => { apply(); calmApply(w); });
    w.addEventListener('did-navigate', () => { apply(); });
    w.addEventListener('did-finish-load', () => calmApply(w));
  };
  document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || !['=', '+', '-', '0'].includes(e.key)) return;
    const t = cur(); if (!isWebTab(t)) return; const h = hostOf(t.url); if (!h) return;
    if (!t.zoom || t.zoom === 1) delete zooms[h]; else zooms[h] = t.zoom;
    lsSet('ember.zoom', zooms); toast('Zoom ' + Math.round((t.zoom || 1) * 100) + '% for ' + h);
  });

  /* ---------- address bar calculator + unit converter ---------- */
  const UN = {
    len: { mm: .001, millimeter: .001, millimeters: .001, cm: .01, centimeter: .01, centimeters: .01, m: 1, meter: 1, meters: 1, km: 1000, kilometer: 1000, kilometers: 1000, in: .0254, inch: .0254, inches: .0254, ft: .3048, foot: .3048, feet: .3048, yd: .9144, yard: .9144, yards: .9144, mi: 1609.344, mile: 1609.344, miles: 1609.344 },
    mass: { g: 1, gram: 1, grams: 1, kg: 1000, kilogram: 1000, kilograms: 1000, oz: 28.3495, ounce: 28.3495, ounces: 28.3495, lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592 },
    vol: { ml: 1, l: 1000, liter: 1000, liters: 1000, litre: 1000, litres: 1000, tsp: 4.92892, tbsp: 14.7868, cup: 236.588, cups: 236.588, pt: 473.176, pint: 473.176, pints: 473.176, qt: 946.353, quart: 946.353, quarts: 946.353, gal: 3785.41, gallon: 3785.41, gallons: 3785.41 },
    spd: { mph: .44704, kph: .277778, kmh: .277778, 'm/s': 1, knots: .514444 },
    tmp: { c: 1, f: 1, k: 1, celsius: 1, fahrenheit: 1, kelvin: 1 }
  };
  function fmt(n) { if (!isFinite(n)) return null; const a = Math.abs(n); return a !== 0 && (a >= 1e12 || a < 1e-6) ? n.toExponential(4) : String(+n.toPrecision(8)).replace(/(\.\d*?[1-9])0+$/, '$1'); }
  function arith(src) {
    const s = src.replace(/×|x(?=\s*[\d(])/g, '*').replace(/÷/g, '/').replace(/,/g, ''); if (!/^[\d\s+\-*/().^%]+$/.test(s) || !/[+\-*/^]/.test(s.replace(/^\s*-/, ''))) return null;
    const tok = s.match(/\d+\.?\d*|\.\d+|[-+*/^()%]/g); if (!tok) return null; let i = 0;
    const num = () => { let t = tok[i++]; if (t === undefined) throw 0; if (t === '-') return -pw(); if (t === '+') return pw(); if (t === '(') { const v = ex(); if (tok[i++] !== ')') throw 0; return pct(v); } const v = parseFloat(t); if (isNaN(v)) throw 0; return pct(v); };
    const pct = v => { while (tok[i] === '%') { i++; v /= 100; } return v; };
    const pw = () => { const b = num(); if (tok[i] === '^') { i++; return Math.pow(b, pw()); } return b; };
    const tm = () => { let v = pw(); while (tok[i] === '*' || tok[i] === '/') { const o = tok[i++], r = pw(); v = o === '*' ? v * r : v / r; } return v; };
    const ex = () => { let v = tm(); while (tok[i] === '+' || tok[i] === '-') { const o = tok[i++], r = tm(); v = o === '+' ? v + r : v - r; } return v; };
    try { const v = ex(); return i === tok.length ? v : null; } catch (_) { return null; }
  }
  function calc(q) {
    q = q.trim().toLowerCase(); if (!q || q.length > 80 || /^[a-z]+:\/\//.test(q)) return null;
    let m = q.match(/^([\d.,]+)\s*%\s*of\s*([\d.,]+)$/);
    if (m) { const v = parseFloat(m[1].replace(/,/g, '')) / 100 * parseFloat(m[2].replace(/,/g, '')); const f = fmt(v); return f && { r: f, d: q }; }
    m = q.match(/^(-?[\d.,]+)\s*°?\s*([a-z/]+)\s+(?:to|in|into|as)\s+°?\s*([a-z/]+)$/);
    if (m) {
      const v = parseFloat(m[1].replace(/,/g, '')), a = m[2], b = m[3]; if (isNaN(v)) return null;
      if (UN.tmp[a] && UN.tmp[b]) { const k = { c: 'c', celsius: 'c', f: 'f', fahrenheit: 'f', k: 'k', kelvin: 'k' }; const A = k[a], B = k[b]; const c = A === 'c' ? v : A === 'f' ? (v - 32) * 5 / 9 : v - 273.15; const out = B === 'c' ? c : B === 'f' ? c * 9 / 5 + 32 : c + 273.15; return { r: fmt(out) + ' °' + B.toUpperCase(), d: q }; }
      for (const g of ['len', 'mass', 'vol', 'spd']) if (UN[g][a] && UN[g][b]) return { r: fmt(v * UN[g][a] / UN[g][b]) + ' ' + b, d: q };
      return null;
    }
    if (/^\d+(-\d+)+$/.test(q)) return null;
    const v = arith(q); if (v == null) return null; const f = fmt(v); return f && { r: f, d: q };
  }
  const calcBox = document.createElement('div'); calcBox.id = 'calc'; document.body.appendChild(calcBox);
  const barEl = $('#bar');
  barEl.addEventListener('input', () => {
    const c = calc(barEl.value); if (!c) { calcBox.style.display = 'none'; return; }
    const r = barEl.getBoundingClientRect(); calcBox.style.left = r.left + 'px'; calcBox.style.top = (r.bottom + 6) + 'px';
    calcBox.innerHTML = '= <b>' + X(c.r) + '</b><small>Press Enter to copy</small>'; calcBox.style.display = 'block';
  });
  barEl.addEventListener('blur', () => { calcBox.style.display = 'none'; });
  const _go = go;
  go = function (v) {
    const c = calc(String(v));
    if (c) { calcBox.style.display = 'none'; try { navigator.clipboard.writeText(c.r.replace(/[^\d.\-e+]/g, '') || c.r); } catch (_) {} toast(c.d + ' = ' + c.r + ' (copied)'); return; }
    if (/^ember:\/\/settings\/?$/i.test(String(v).trim())) { openSettings(); barEl.value = ''; return; }
    return _go(v);
  };

  /* ---------- bookmarks bar + import ---------- */
  const bms = () => lsGet('ember.bookmarks', []);
  const bar = document.createElement('div'); bar.id = 'bmbar'; $('#top').insertAdjacentElement('afterend', bar);
  let barKey = '';
  function drawBar() {
    const l = bms(), key = P.bar + '|' + JSON.stringify(l.map(b => b.u + b.t)); if (key === barKey) return; barKey = key;
    bar.classList.toggle('show', !!(P.bar && l.length)); bar.innerHTML = '';
    l.slice(0, 30).forEach(b => {
      const x = document.createElement('button'); x.textContent = (b.t || b.u).slice(0, 40); x.title = b.u;
      x.onclick = e => { if (e.ctrlKey || e.metaKey) newTab(b.u); else openUrl(b.u); };
      x.onauxclick = e => { if (e.button === 1) newTab(b.u); };
      x.oncontextmenu = e => { e.preventDefault(); e.stopPropagation(); showMenu(menu('bmmenu'), [['Open in new tab', () => newTab(b.u)], ['Remove bookmark', () => { lsSet('ember.bookmarks', bms().filter(y => y.u !== b.u)); barKey = ''; drawBar(); }]], e.clientX, e.clientY); };
      bar.appendChild(x);
    });
  }
  function addBookmarks(items) {
    const l = bms(), have = new Set(l.map(b => b.u)); let n = 0;
    items.forEach(b => { if (b.u && !have.has(b.u)) { have.add(b.u); l.push({ u: b.u, t: b.t || b.u, ts: Date.now() }); n++; } });
    lsSet('ember.bookmarks', l); barKey = ''; drawBar(); return n;
  }
  function importFile() {
    const f = document.createElement('input'); f.type = 'file'; f.accept = '.html,.htm';
    f.onchange = async () => { const file = f.files[0]; if (!file) return; const txt = await file.text(); const d = new DOMParser().parseFromString(txt, 'text/html'); const items = [...d.querySelectorAll('a[href]')].filter(a => /^https?:/i.test(a.getAttribute('href'))).map(a => ({ u: a.getAttribute('href'), t: a.textContent.trim() })); toast('Imported ' + addBookmarks(items) + ' bookmarks'); drawSettings(); };
    f.click();
  }
  async function importBrowsers() {
    if (!E.importBrowser) return toast('Not available here');
    const r = await E.importBrowser();
    if (!r || !r.found.length) return toast('No Chrome, Edge or Brave bookmarks found. Try importing a bookmarks file instead.');
    toast('Imported ' + addBookmarks(r.items) + ' bookmarks from ' + r.found.join(', ')); drawSettings();
  }

  /* ---------- focus timer ---------- */
  const fp = document.createElement('button'); fp.id = 'focuspill'; fp.title = 'Focus session. Click for details.'; fp.onclick = () => openSettings();
  function focusTick() {
    const left = focus.until - Date.now();
    if (left > 0) { const m = Math.floor(left / 60000), s = Math.floor(left % 60000 / 1000); fp.textContent = '🎯 ' + m + ':' + String(s).padStart(2, '0'); fp.classList.add('on'); }
    else if (focus.until) { focus.until = 0; lsSet('ember.focus', focus); pushMain(); fp.classList.remove('on'); toast('Focus session finished. Nice work.'); drawSettings(); }
    else fp.classList.remove('on');
  }
  setInterval(focusTick, 1000);
  function startFocus(min) {
    const sites = ($('#fsites') ? $('#fsites').value : focus.sites.join(', ')).split(/[\s,]+/).map(s => hostOf('https://' + s.replace(/^https?:\/\//, ''))).filter(Boolean);
    if (!sites.length) return toast('Add at least one site to block');
    focus = { until: Date.now() + min * 60000, sites }; lsSet('ember.focus', focus); pushMain(); focusTick(); toast('Focus session started for ' + min + ' minutes'); drawSettings();
  }
  function endFocus() { focus.until = 0; lsSet('ember.focus', focus); pushMain(); focusTick(); toast('Focus session ended'); drawSettings(); }
  if (E.onFocusBlocked) E.onFocusBlocked(b => toast(b.host + ' is blocked until ' + new Date(b.until).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })));
  errorMessages['-20'] = ['This site is paused.', 'Focus mode is blocking it right now. You can end the session in Settings.', 'Blocked by focus session'];
  focusTick();

  /* ---------- more menu + pills ---------- */
  const more = document.createElement('button'); more.id = 'morebtn'; more.title = 'More'; more.textContent = '⋯'; more.setAttribute('aria-label', 'More');
  const mailBtn = $('#mailbtn'); mailBtn.insertAdjacentElement('beforebegin', more); more.insertAdjacentElement('beforebegin', pill); more.insertAdjacentElement('beforebegin', fp);
  pill.classList.toggle('on', P.calm);
  more.onclick = () => {
    const r = more.getBoundingClientRect(), t = cur();
    showMenu(menu('moremenu'), [
      ['Settings', openSettings, 'Ctrl+,'],
      ['Reader view', () => readerView(t)],
      [P.calm ? 'Turn calm mode off' : 'Turn calm mode on', () => setCalm(!P.calm)],
      [focus.until > Date.now() ? 'Focus session…' : 'Start a focus session…', openSettings],
      [P.bar ? 'Hide bookmarks bar' : 'Show bookmarks bar', () => { P.bar = !P.bar; savePrefs(); drawBar(); drawSettings(); }],
      '-',
      ['Pin this tab', () => t && togglePin(t)],
      ['Snooze this tab for 1 hour', () => t && snooze(t, hrs(1))]
    ], r.left - 150, r.bottom + 6);
  };

  /* ---------- settings window ---------- */
  const ov = document.createElement('div'); ov.className = 'ovl'; ov.id = 'setpanel'; document.body.appendChild(ov);
  ov.addEventListener('mousedown', e => { if (e.target === ov) ov.classList.remove('show'); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && ov.classList.contains('show')) ov.classList.remove('show'); if ((e.ctrlKey || e.metaKey) && e.key === ',') { e.preventDefault(); openSettings(); } });
  /* ---------- Lareon account + sync ---------- */
  let acct = { signedIn: false, email: '', stage: 'form', msg: '', contact: '', user: '', last: lsGet('ember.sync.at', 0) };
  const SYNC_KEYS = ['ember.bookmarks', 'ember.pinned', 'ember.prefs', 'ember.dock', 'ember.zoom'];
  const collect = () => { const o = {}; SYNC_KEYS.forEach(k => { const v = lsGet(k, null); if (v != null) o[k] = v; }); return o; };
  const agoTxt = t => { const s = (Date.now() - t) / 1000; return s < 90 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : s < 86400 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' d ago'; };
  function mergeData(local, remote, rv, lv) {
    const out = Object.assign({}, local);
    const uniq = (a, b, key) => { const seen = new Set(), res = []; a.concat(b).forEach(x => { const k = key ? x && x[key] : x; if (k && !seen.has(k)) { seen.add(k); res.push(x); } }); return res; };
    out['ember.bookmarks'] = uniq(local['ember.bookmarks'] || [], remote['ember.bookmarks'] || [], 'u');
    out['ember.pinned'] = uniq(local['ember.pinned'] || [], remote['ember.pinned'] || [], null);
    if (rv !== lv) ['ember.prefs', 'ember.dock', 'ember.zoom'].forEach(k => { if (remote[k] != null) out[k] = Object.assign({}, local[k] || {}, remote[k]); }); // another device changed these since we last synced
    return out;
  }
  function applyData(d) { SYNC_KEYS.forEach(k => { if (d[k] != null) lsSet(k, d[k]); }); if (d['ember.prefs']) Object.assign(P, d['ember.prefs']); barKey = ''; drawBar(); }
  async function refreshAcct() { try { const s = E.acctState && await E.acctState(); if (s) { acct.signedIn = !!s.signedIn; acct.email = s.email || ''; } } catch (_) {} }
  async function doSync(manual) {
    if (!E.syncPull || !acct.signedIn) return;
    acct.msg = 'Syncing…'; if (manual) drawSettings();
    let r = await E.syncPull();
    if (r.error) { if (r.error === 'signed-out') { acct.signedIn = false; acct.msg = 'You were signed out. Sign in again.'; } else acct.msg = r.error; drawSettings(); return; }
    for (let i = 0; i < 2; i++) {
      let remote = {}; try { remote = r.data ? JSON.parse(r.data) : {}; } catch (_) {}
      const merged = mergeData(collect(), remote, r.version, lsGet('ember.sync.ver', 0));
      const p = await E.syncPush(JSON.stringify(merged), r.version);
      if (p.ok) { applyData(merged); lsSet('ember.sync.ver', p.version); lsSet('ember.sync.at', Date.now()); acct.last = Date.now(); acct.msg = 'Synced.'; break; }
      if (p.status === 409) { r = { version: p.version, data: p.data }; continue; }
      acct.msg = p.error || 'Could not sync'; break;
    }
    drawSettings();
  }
  function acctHtml() {
    const inp = 'style="width:100%;margin:6px 0"';
    if (acct.signedIn) return '<div class="row1"><div>' + X(acct.email) + '<small>' + (acct.last ? 'Last synced ' + agoTxt(acct.last) + '. ' : 'Not synced yet. ') + X(acct.msg || '') + '</small></div><button class="btn1 pri" id="acSync">Sync now</button></div><div class="row1"><div>Bookmarks, pinned tabs and settings follow you<small>Some settings apply the next time Ember starts. Manage your account at lareon.org/account.</small></div><button class="btn1" id="acOut">Sign out</button></div>';
    if (acct.stage === 'code') return '<p>We sent a code to ' + X(acct.contact) + '.</p><input id="acCode" ' + inp + ' placeholder="6-digit code" maxlength="6" autocomplete="one-time-code"><div class="sp-acts"><button class="btn1 pri" id="acCodeGo">Confirm</button></div><p>' + X(acct.msg) + '</p>';
    return '<p>Sign in with your Lareon account to sync bookmarks, pinned tabs and settings across your devices.</p><input id="acU" ' + inp + ' placeholder="Username" autocomplete="username" spellcheck="false"><input id="acP" ' + inp + ' type="password" placeholder="Password" autocomplete="current-password"><div class="sp-acts"><button class="btn1 pri" id="acGo">Sign in</button><button class="btn1" id="acNew">Create a Lareon account</button></div><p>' + X(acct.msg) + '</p>';
  }
  function acctWire() {
    const g = id => $('#' + id);
    if (g('acSync')) g('acSync').onclick = () => doSync(true);
    if (g('acOut')) g('acOut').onclick = async () => { await E.acctLogout(); acct = Object.assign(acct, { signedIn: false, email: '', stage: 'form', msg: '' }); drawSettings(); };
    if (g('acNew')) g('acNew').onclick = () => { ov.classList.remove('show'); newTab('https://lareon.org/account#register'); };
    const login = async () => { acct.msg = 'Signing in…'; const r = await E.acctLogin(g('acU').value.trim(), g('acP').value); if (r.ok) { acct.signedIn = true; acct.email = r.email; acct.msg = ''; acct.stage = 'form'; drawSettings(); doSync(true); return; } if (r.needCode) { acct.stage = 'code'; acct.contact = r.contact; acct.user = r.username; acct.msg = ''; } else acct.msg = r.error || 'Could not sign in'; drawSettings(); };
    if (g('acGo')) { g('acGo').onclick = login; g('acP').onkeydown = e => { if (e.key === 'Enter') login(); }; }
    const code = async () => { const r = await E.acctCode(acct.user, g('acCode').value.trim()); if (r.ok) { acct.signedIn = true; acct.email = r.email; acct.msg = ''; acct.stage = 'form'; drawSettings(); doSync(true); } else { acct.msg = r.error || 'That code did not work'; drawSettings(); } };
    if (g('acCodeGo')) { g('acCodeGo').onclick = code; g('acCode').onkeydown = e => { if (e.key === 'Enter') code(); }; }
  }
  setTimeout(() => refreshAcct().then(() => doSync(false)), 20000);
  setInterval(() => doSync(false), 300000);

  let dlDir = '';
  const sw = (k, on) => '<button class="sw' + (on ? ' on' : '') + '" data-sw="' + k + '" role="switch" aria-checked="' + !!on + '"></button>';
  function drawSettings() {
    if (!ov.classList.contains('show')) return;
    const sn = snoozed(), active = focus.until > Date.now(), left = Math.ceil((focus.until - Date.now()) / 60000);
    ov.innerHTML = '<div class="card1"><div style="display:flex;justify-content:space-between;align-items:center"><h2>Settings</h2><button class="btn1" id="setX">Done</button></div>' +
      '<h3>Downloads</h3><div class="row1"><div>Save downloads to<small>' + X(dlDir || '') + '</small></div><button class="btn1" id="setDir">Change…</button></div>' +
      '<h3>When Ember starts</h3><div class="row1"><div>Open<small>Choose what you see first.</small></div><select id="setStart" style="width:auto"><option value="resume"' + (P.startup === 'resume' ? ' selected' : '') + '>Where I left off</option><option value="new"' + (P.startup === 'new' ? ' selected' : '') + '>A fresh start page</option></select></div>' +
      '<h3>Browsing</h3>' +
      '<div class="row1"><div>Clean links<small>Removes tracking bits like utm_ and fbclid from addresses.</small></div>' + sw('clean', P.clean) + '</div>' +
      '<div class="row1"><div>Calm mode<small>Stops videos from starting on their own and hides notification and location requests.</small></div>' + sw('calm', P.calm) + '</div>' +
      '<div class="row1"><div>Bookmarks bar<small>Shows your bookmarks under the address bar.</small></div>' + sw('bar', P.bar) + '</div>' +
      '<h3>Lareon account</h3>' + acctHtml() +
      '<h3>Bring your bookmarks</h3><div class="row1"><div>From Chrome, Edge or Brave<small>Ember reads the bookmarks already on this computer.</small></div><button class="btn1" id="setImp">Import</button></div>' +
      '<div class="row1"><div>From a file<small>Any browser can export bookmarks as an .html file.</small></div><button class="btn1" id="setImpF">Choose file…</button></div>' +
      '<h3>Focus session</h3>' + (active
        ? '<div class="row1"><div>Focus is on<small>' + left + ' min left. ' + X(focus.sites.join(', ')) + ' are paused.</small></div><button class="btn1 danger" id="fEnd">End early</button></div>'
        : '<p>Pause distracting sites for a while. They come back when the time is up.</p><textarea id="fsites" rows="2">' + X(focus.sites.join(', ')) + '</textarea><div class="sp-acts"><button class="btn1 pri" data-f="25">25 min</button><button class="btn1 pri" data-f="45">45 min</button><button class="btn1 pri" data-f="60">1 hour</button></div>') +
      '<h3>Snoozed tabs</h3>' + (sn.length ? sn.map((x, i) => '<div class="row1"><div>' + X(x.t || x.u) + '<small>Back ' + whenTxt(x.wake) + '</small></div><button class="btn1" data-wake="' + i + '">Open now</button></div>').join('') : '<p>Nothing snoozed. Right-click a tab to snooze it.</p>') +
      '<h3>Safety</h3><p>Safe downloads, site checks and threat protection are always on. Click the lock beside the address to see the check for a site.</p></div>';
    $('#setX').onclick = () => ov.classList.remove('show');
    acctWire();
    $('#setDir').onclick = async () => { const d = E.pickFolder && await E.pickFolder(); if (d) { dlDir = d; drawSettings(); toast('Downloads will go to ' + d); } };
    $('#setStart').onchange = e => { P.startup = e.target.value; savePrefs(); };
    ov.querySelectorAll('[data-sw]').forEach(b => b.onclick = () => { const k = b.dataset.sw; if (k === 'calm') return setCalm(!P.calm); P[k] = !P[k]; savePrefs(); barKey = ''; drawBar(); drawSettings(); });
    $('#setImp').onclick = importBrowsers; $('#setImpF').onclick = importFile;
    ov.querySelectorAll('[data-f]').forEach(b => b.onclick = () => startFocus(+b.dataset.f));
    const fe = $('#fEnd'); if (fe) fe.onclick = endFocus;
    ov.querySelectorAll('[data-wake]').forEach(b => b.onclick = () => { const l = snoozed(), x = l.splice(+b.dataset.wake, 1)[0]; lsSet('ember.snoozed', l); if (x) newTab(x.u); drawSettings(); });
  }
  async function openSettings() { await refreshAcct(); try { const s = E.settingsGet && await E.settingsGet(); if (s) dlDir = s.downloadDir; } catch (_) {} ov.classList.add('show'); drawSettings(); }
  window.openEmberSettings = openSettings;

  /* ---------- site check panel extras ---------- */
  const _sp = secPanel;
  secPanel = async function (open) {
    await _sp(open);
    const p = $('#secpanel'), t = cur(); if (!open || !p || p.style.display !== 'flex' || !isWebTab(t)) return;
    const host = hostOf(t.url), box = p.querySelector('.sp'); if (!box || box.querySelector('.sp-more')) return;
    const notes = []; let u; try { u = new URL(t.url); } catch (_) { u = null; }
    if (u) {
      if (/^xn--|\.xn--/.test(u.hostname)) notes.push('The address uses unusual letters. Scammers use these to copy other sites.');
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname)) notes.push('This address is just numbers, not a normal website name.');
      if (u.hostname.split('.').length > 4) notes.push('The address has a lot of parts. Check the end of it is the site you expect.');
      if (u.username) notes.push('The address has a name in front of the @ sign. That is a common trick to hide the real site.');
    }
    let pw = false; try { pw = await t.wv.executeJavaScript('!!document.querySelector("input[type=password]")'); } catch (_) {}
    if (pw) notes.push(u && u.protocol === 'http:' ? 'This page asks for a password and isn’t private. Don’t type it here.' : 'This page asks for a password. Only type it if you trust this site.');
    const z = zooms[host] ? Math.round(zooms[host] * 100) + '% zoom is remembered for this site.' : '';
    const more = document.createElement('div'); more.className = 'sp-more';
    more.innerHTML = '<h4>What to watch for</h4><ul>' + (notes.length ? notes.map(n => '<li>' + X(n) + '</li>').join('') : '<li>Nothing unusual spotted on this page.</li>') + '</ul>' +
      '<h4 style="margin-top:12px">What this site can use</h4><ul><li>Camera, microphone, location and notifications: only if you say yes, each time.</li><li>Cookies: small notes the site saves on your device. “Forget this site” clears them.</li>' + (z ? '<li>' + X(z) + '</li>' : '') + '</ul>' +
      '<div class="sp-acts"><button class="btn1 danger" id="spForget">Forget this site</button><button class="btn1" id="spReader">Reader view</button><button class="btn1" id="spCalm">' + (P.calm ? 'Calm mode: on' : 'Calm mode: off') + '</button></div>';
    box.insertBefore(more, $('#spClose'));
    let armed = false; const fb = more.querySelector('#spForget');
    fb.onclick = async () => {
      if (!armed) { armed = true; fb.textContent = 'Tap again to forget ' + host; return; }
      try { await E.forgetSite(host); } catch (_) {}
      lsSet('ember.bookmarks', bms().filter(b => hostOf(b.u) !== host)); barKey = ''; drawBar(); delete zooms[host]; lsSet('ember.zoom', zooms);
      secPanel(false); toast('Ember forgot ' + host); try { t.wv.reload(); } catch (_) {}
    };
    more.querySelector('#spReader').onclick = () => { secPanel(false); readerView(t); };
    more.querySelector('#spCalm').onclick = e => { setCalm(!P.calm); e.target.textContent = P.calm ? 'Calm mode: on' : 'Calm mode: off'; };
  };

  /* ---------- startup: pinned tabs and the start-page choice ---------- */
  (function boot() {
    if (P.startup === 'new') { tabs.slice().forEach(t => { try { t.wv && t.wv.remove(); } catch (_) {} }); tabs.length = 0; newTab(); }
    const first = active;
    pinned.forEach(u => { let t = tabs.find(x => x.url === u && !x.pinned); if (!t) { newTab(u); t = tabs[tabs.length - 1]; } t.pinned = true; });
    if (tabs.some(t => !t.pinned) === false) newTab();
    const keep = tabs.find(t => t.id === first && !t.pinned) || tabs.find(t => !t.pinned) || tabs[0];
    sortPins(); select(keep.id); drawBar();
  })();
})();
