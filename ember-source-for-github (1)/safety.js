// safety.js: local protection checks for Ember. Nothing here touches the network.
const { domainToUnicode } = require('url');

// Real sites of the brands scammers copy most. `anyTld` means the brand's own name is also
// official on country domains (amazon.de, google.co.uk). Add your own domains to `lareon`.
const B = (name, display, domains, anyTld, always) => ({ name, display, domains, anyTld: !!anyTld, always: !!always, home: 'https://' + domains[0] });
const BRANDS = [
  B('lareon', 'Lareon', ['lareon.org'], false, true),
  B('paypal', 'PayPal', ['paypal.com', 'paypal.me', 'paypalobjects.com', 'paypal-community.com'], true),
  B('google', 'Google', ['google.com', 'gmail.com', 'youtube.com', 'youtu.be', 'googleapis.com', 'gstatic.com', 'googleusercontent.com', 'googlevideo.com', 'ggpht.com', 'withgoogle.com', 'blogger.com', 'blogspot.com'], true),
  B('microsoft', 'Microsoft', ['microsoft.com', 'microsoftonline.com', 'live.com', 'office.com', 'office365.com', 'microsoft365.com', 'outlook.com', 'hotmail.com', 'msn.com', 'bing.com', 'azure.com', 'windows.com', 'windows.net', 'xbox.com', 'skype.com', 'sharepoint.com', 'onedrive.com', 'visualstudio.com', 'azureedge.net', 'msauth.net', 'msftauth.net'], true),
  B('apple', 'Apple', ['apple.com', 'icloud.com', 'me.com', 'mzstatic.com', 'cdn-apple.com', 'apple.news'], true),
  B('amazon', 'Amazon', ['amazon.com', 'amazonaws.com', 'amazon-adsystem.com', 'media-amazon.com', 'ssl-images-amazon.com', 'primevideo.com', 'audible.com', 'aboutamazon.com'], true),
  B('netflix', 'Netflix', ['netflix.com', 'nflxext.com', 'nflximg.net', 'nflxvideo.net', 'nflxso.net'], true),
  B('facebook', 'Facebook', ['facebook.com', 'fb.com', 'fb.me', 'fbcdn.net', 'facebook.net', 'messenger.com', 'meta.com', 'fbsbx.com']),
  B('instagram', 'Instagram', ['instagram.com', 'cdninstagram.com', 'instagr.am']),
  B('whatsapp', 'WhatsApp', ['whatsapp.com', 'whatsapp.net', 'wa.me']),
  B('ebay', 'eBay', ['ebay.com', 'ebaystatic.com', 'ebayimg.com', 'ebay.us'], true),
  B('dropbox', 'Dropbox', ['dropbox.com', 'dropboxusercontent.com', 'dropboxstatic.com']),
  B('github', 'GitHub', ['github.com', 'github.io', 'githubusercontent.com', 'githubassets.com', 'github.dev', 'githubapp.com']),
  B('steam', 'Steam', ['steampowered.com', 'steamcommunity.com', 'steamstatic.com', 'steamgames.com', 'steam-chat.com']),
  B('discord', 'Discord', ['discord.com', 'discord.gg', 'discordapp.com', 'discordapp.net', 'discord.media', 'discordstatus.com']),
  B('roblox', 'Roblox', ['roblox.com', 'rbxcdn.com', 'robloxlabs.com']),
  B('coinbase', 'Coinbase', ['coinbase.com']),
  B('binance', 'Binance', ['binance.com', 'binance.us', 'bnbstatic.com', 'binance.org']),
  B('metamask', 'MetaMask', ['metamask.io']),
  B('chase', 'Chase', ['chase.com', 'jpmorganchase.com', 'jpmorgan.com']),
  B('wellsfargo', 'Wells Fargo', ['wellsfargo.com', 'wf.com']),
  B('bankofamerica', 'Bank of America', ['bankofamerica.com', 'bofa.com', 'ml.com']),
  B('citibank', 'Citibank', ['citi.com', 'citibank.com', 'citibankonline.com']),
  B('usps', 'USPS', ['usps.com']),
  B('fedex', 'FedEx', ['fedex.com'], true),
  B('linkedin', 'LinkedIn', ['linkedin.com', 'licdn.com', 'lnkd.in']),
  B('twitter', 'X (Twitter)', ['twitter.com', 'x.com', 't.co', 'twimg.com']),
  B('spotify', 'Spotify', ['spotify.com', 'scdn.co', 'spotifycdn.com', 'spoti.fi']),
  B('adobe', 'Adobe', ['adobe.com', 'adobe.io', 'adobelogin.com', 'typekit.net', 'adobecc.com']),
  B('zoom', 'Zoom', ['zoom.us', 'zoom.com', 'zoomgov.com']),
  B('docusign', 'DocuSign', ['docusign.com', 'docusign.net']),
  B('telegram', 'Telegram', ['telegram.org', 't.me', 'telegram.me', 'telesco.pe']),
  B('openai', 'OpenAI', ['openai.com', 'chatgpt.com', 'oaistatic.com']),
  B('anthropic', 'Anthropic', ['anthropic.com', 'claude.ai', 'claude.com'])
];

// words scam addresses add to a brand name ("paypal-secure-login.com")
const KW = new Set(['login', 'logon', 'signin', 'secure', 'security', 'verify', 'verification', 'account', 'accounts', 'support', 'helpdesk', 'update', 'billing', 'wallet', 'recover', 'recovery', 'unlock', 'auth', 'confirm', 'alert', 'service', 'services', 'customer', 'claim', 'reward', 'rewards', 'gift', 'free', 'prize', 'refund', 'payment', 'invoice']);
const KWL = ['login', 'signin', 'secure', 'verify', 'account', 'support', 'update', 'billing', 'wallet', 'recover', 'unlock', 'confirm', 'helpdesk'];
const RISKY_SUFFIX = new Set(['tk', 'ml', 'ga', 'cf', 'gq', 'pw', 'cc', 'ws', 'top', 'xyz', 'click', 'link', 'work', 'zip', 'mov', 'icu', 'cyou', 'buzz', 'rest', 'cam', 'monster', 'sbs', 'cfd']);
const CONFUSE = { 'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'і': 'i', 'ј': 'j', 'ѕ': 's', 'ԁ': 'd', 'ԍ': 'g', 'һ': 'h', 'ӏ': 'l', 'к': 'k', 'м': 'm', 'н': 'h', 'т': 't', 'в': 'b', 'ο': 'o', 'α': 'a', 'ν': 'v', 'ρ': 'p', 'ι': 'i', 'τ': 't', 'κ': 'k', 'υ': 'u', 'χ': 'x', 'ɡ': 'g', 'ı': 'i' };

function parts(h) {
  const l = h.split('.');
  let n = 1;
  if (l.length >= 3 && /^(co|com|org|net|gov|ac|edu|or|ne|go)$/.test(l[l.length - 2]) && l[l.length - 1].length === 2) n = 2;
  const suffix = l.slice(-n).join('.');
  const sld = l.length > n ? l[l.length - n - 1] : l[0];
  const sub = l.length > n + 1 ? l.slice(0, l.length - n - 1) : [];
  return { suffix, sld, sub, names: sub.concat(sld) };
}
function isOfficial(b, h, sld, suffix) {
  if (b.domains.some(d => h === d || h.endsWith('.' + d))) return true;
  if (b.anyTld && sld === b.name && !RISKY_SUFFIX.has(suffix)) return /^(com|net|org|[a-z]{2}|(co|com|org|net|ac)\.[a-z]{2})$/.test(suffix);
  return false;
}
// one inserted, dropped or swapped letter (substitutions are skipped on purpose: "finance" is not "binance")
function oneEdit(a, b) {
  if (a === b) return false;
  const la = a.length, lb = b.length;
  if (la === lb) { let i = 0; while (i < la && a[i] === b[i]) i++; return i < la - 1 && a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2); }
  if (Math.abs(la - lb) !== 1) return false;
  const s = la < lb ? a : b, l = la < lb ? b : a; let i = 0; while (i < s.length && s[i] === l[i]) i++;
  return s.slice(i) === l.slice(i + 1);
}
// "paypa1" -> "paypal", "g00gle" -> "google", "pay-pal" -> "paypal"
function canon(s) {
  const a = s.replace(/-/g, ''), t = a.replace(/0/g, 'o').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/rn/g, 'm').replace(/vv/g, 'w');
  return [a, t.replace(/1/g, 'l'), t.replace(/1/g, 'i')];
}
function brandHit(h) {
  const { suffix, sld, sub, names } = parts(h);
  const tokens = names.flatMap(n => n.split('-')).filter(Boolean);
  const hasKw = tokens.some(t => KW.has(t)) || names.some(n => KWL.some(k => n.length > k.length && n.includes(k)));
  for (const b of BRANDS) {
    if (isOfficial(b, h, sld, suffix)) continue;
    if (b.always && names.some(n => n.includes(b.name))) return { b, reason: 'brand' };
    if (sld === b.name) return { b, reason: 'brand' };
    const si = sub.indexOf(b.name);
    if (si >= 0 && (hasKw || /^(com|net|org|co|gov|edu|io)$/.test(sub[si + 1] || ''))) return { b, reason: 'brand' };
    const has = tokens.includes(b.name) || (b.name.length >= 6 && names.some(n => n.includes(b.name)));
    if (has && hasKw) return { b, reason: 'brand' };
    if (b.name.length >= 6 && sld.length >= 5 && canon(sld).some(x => x === b.name || oneEdit(x, b.name))) return { b, reason: 'typo' };
  }
  return null;
}
// Returns { kind:'scam', host, brand, home, reason, source } or null. `host` is a lowercase hostname.
function checkScamHost(host) {
  host = String(host || '').toLowerCase().replace(/\.$/, '');
  if (!host || /^[\d.]+$/.test(host) || host.startsWith('[')) return null;
  let uni = host;
  if (host.includes('xn--')) { try { uni = domainToUnicode(host) || host; } catch (_) {} }
  const source = 'Ember lookalike check';
  let hit = brandHit(host), reason = hit && hit.reason;
  let mixed = false, folded = uni;
  if (/[^\x00-\x7f]/.test(uni)) {
    mixed = uni.split('.').some(l => /[a-z]/i.test(l) && /[\u0370-\u03ff\u0400-\u04ff]/.test(l));
    folded = Array.from(uni).map(c => CONFUSE[c] || c).join('');
    if (!hit && folded !== uni && !/[^\x00-\x7f]/.test(folded)) { hit = brandHit(folded); if (hit) reason = 'chars'; }
  }
  if (hit) return { kind: 'scam', host, brand: hit.b.display, home: hit.b.home, reason, source };
  if (mixed) return { kind: 'scam', host, brand: null, home: null, reason: 'chars', source };
  return null;
}
function checkScam(url) { try { return checkScamHost(new URL(url).hostname); } catch (_) { return null; } }

// addresses where plain http is normal: this computer, home/office networks, single-word intranet names
function isLocalHost(h) {
  h = String(h || '').toLowerCase();
  if (!h || h === 'localhost' || h === '[::1]' || /\.(localhost|local|internal|lan|home\.arpa)$/.test(h)) return true;
  if (!h.includes('.') && !h.includes(':')) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) { const p = h.split('.').map(Number); return p[0] === 10 || p[0] === 127 || (p[0] === 192 && p[1] === 168) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 169 && p[1] === 254); }
  return false;
}
// files that can run code on the computer
const RISKY_EXT = /\.(exe|msi|bat|cmd|scr|com|ps1|sh|app|jar|vbs|js|command|dmg|pkg|iso|apk|dll|lnk|hta|reg|wsf|cpl|docm|xlsm|pptm)$/i;
const isRiskyFile = name => RISKY_EXT.test(String(name || ''));

// ---- risky-site categories: scams, fake alerts, malware bait, gambling, strangers, trackers, shock ----
// Everything is matched on the address itself, on this device. Big legitimate sites are skipped.
const ALLOW = ['roblox.com', 'rbxcdn.com', 'robloxlabs.com', 'epicgames.com', 'fortnite.com', 'playstation.com', 'xbox.com', 'nintendo.com', 'minecraft.net', 'mojang.com', 'steampowered.com', 'steamcommunity.com', 'discord.com', 'discordapp.com', 'wikipedia.org', 'youtube.com'];
// free site builders: the page name after the slash is what scammers choose, so Ember reads it too
const HOSTING = ['sites.google.com', 'github.io', 'weebly.com', 'wixsite.com', 'blogspot.com', 'netlify.app', 'pages.dev', 'vercel.app', 'glitch.me', 'repl.co', 'webflow.io', 'carrd.co', 'notion.site', 'web.app', 'firebaseapp.com'];
const SEED = {
  gambling: ['bloxflip.com', 'rbxflip.com', 'stake.com', 'stake.us', 'roobet.com', 'rollbit.com', 'bc.game', 'gamdom.com', 'duelbits.com', 'hellcase.com', 'keydrop.com', 'key-drop.com', 'csgoempire.com', 'csgoroll.com', 'skinclub.com', 'clash.gg', 'bet365.com', 'draftkings.com', 'fanduel.com', 'pokerstars.com', 'williamhill.com', 'betfair.com', 'betmgm.com', 'bovada.lv', 'betway.com', 'unibet.com', '1xbet.com', 'paddypower.com', 'ladbrokes.com', 'bwin.com'],
  strangers: ['omegle.com', 'ome.tv', 'chatroulette.com', 'emeraldchat.com', 'chatrandom.com', 'camsurf.com', 'shagle.com', 'bazoocam.com', 'chatspin.com', 'monkey.app', 'azarlive.com', 'chatous.com'],
  tracker: ['grabify.link', 'iplogger.org', 'iplogger.com', 'iplogger.ru', '2no.co', 'yip.su', 'leancoding.co', 'stopify.co', 'joinmy.site', 'curiouscat.club', 'catsnthings.fun', 'ipgrabber.ru', 'ipgraber.ru', 'ps3cfw.com', 'blasze.com', 'blasze.tk', 'gyazo.nl', 'lovebird.guru', 'quickmessage.us', 'spottyfly.com'],
  cheats: ['thepiratebay.org', '1337x.to', 'fitgirl-repacks.site', 'yts.mx', 'limetorrents.info', 'torrentgalaxy.to', 'oceanofgames.com', 'igg-games.com', 'steamunlocked.net', 'nulled.to', 'cracked.io', 'cracked.to', 'rarbg.to', 'kmspico.net'],
  shock: ['kaotic.com', 'theync.com', 'crazyshit.com', 'goregrish.com', 'documentingreality.com', 'bestgore.fun', 'watchpeopledie.tv']
};
const MODS = '(?:free|generator|gen|hack|cheat|unlimited|claim|earn|codes?|giveaway|glitch|instant)', PRIZE = '(?:robux|rbx|vbucks?|primogems?|minecoins?|giftcards?|robloxgift|steamgift|psngift)';
const RES = [
  ['freebies', new RegExp(MODS + PRIZE + '|' + PRIZE + MODS + '|freeiphone|freeps5|freexbox|youwon|claimyourprize|prizewinner|moneygenerator|cashgenerator|robloxgenerator|freenitro|nitrogift|freerobloxaccounts|bitcoindoubler|doubleyourbitcoin|cryptogiveaway')],
  ['support', /virus(?:detected|alert|warning|found)|(?:pc|computer|device|windows|mac|iphone|phone)(?:isinfected|hasvirus|infected|hacked|compromised)|yourcomputerhasbeen|trojanalert|malware(?:detected|alert|warning)|callmicrosoft|microsoft(?:supportnumber|helpline|techsupport)|apple(?:supportnumber|helpline|techsupport)|windows(?:defender)?(?:alert|warning)|techsupport(?:number|helpline)/],
  ['cheats', /robloxexecutor|robloxexploit|robloxhack|robloxcheat|rbxexecutor|executor(?:roblox|rbx)|krnl|synapsex|scriptware|fluxus|aimbot|wallhack|keygen|warez|kmspico|modapk|apkmod|hackedapk|modmenu|crackeddownload|crackedgames|fullcrack|crackedsoftware|freecrack|repackgames/],
  ['tracker', /iplogger|grabify|ipgrabber/],
  ['gambling', /casino|sportsbook|betting|jackpot|roulette|blackjack|slotsonline|onlineslots|freespins|bloxflip|rbxflip|skingambl|caseopening|casesbattle/],
  ['strangers', /omegle|chatroulette|randomchat|randomvideochat|strangerchat|talktostrangers|chatwithstrangers/],
  ['shock', /realdeath|deathvideos?|watchpeopledie|bestgore|realgore|livegore|goregrish/]
];
const inDomains = (h, list) => list.some(d => h === d || h.endsWith('.' + d));
// Returns { kind:'risk', cat, host, source } or null. `cat` is one of freebies, support, cheats, tracker, gambling, strangers, shock.
function checkRisk(url) {
  let u; try { u = new URL(url); } catch (_) { return null; }
  const h = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!h || /^[\d.]+$/.test(h) || isLocalHost(h) || inDomains(h, ALLOW)) return null;
  const mk = cat => ({ kind: 'risk', cat, host: h, source: 'Ember safety check' });
  for (const c of Object.keys(SEED)) if (inDomains(h, SEED[c])) return mk(c);
  let text = parts(h).names.join('-');
  if (inDomains(h, HOSTING)) { try { text += '-' + decodeURIComponent(u.pathname).split('/').slice(1, 3).join('-'); } catch (_) {} }
  const sq = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [c, re] of RES) if (re.test(sq)) return mk(c);
  return null;
}

module.exports = { checkScam, checkScamHost, checkRisk, isLocalHost, isRiskyFile };
