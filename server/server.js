/*
 * server/server.js: שרת קטן לסטודיו של תמימה.
 *
 * תפקידים:
 *   1. מגיש את קובצי האתר (במקום שרת התצוגה המקומי), עם כותרות אבטחה שאי אפשר להגדיר בדף עצמו.
 *   2. התחברות חד פעמית לגוגל: תמימה מאשרת פעם אחת, והשרת שומר את "המפתח הקבוע" (refresh token)
 *      מוצפן אצלו. הדפדפן מקבל ממנו כרטיס כניסה זמני (access token) בכל פעם שצריך, בלי חלון של גוגל.
 *      ההתחברות הזו היא גם הכניסה של תמימה לניהול: רק חשבון הסטודיו מקבל עוגיית כניסה.
 *   3. נתוני הסטודיו (api.js): טעינה ושמירה, רק אחרי כניסה. גיבוי יומי מוצפן (backup.js).
 *
 * המפתח הקבוע לא יוצא מהשרת אף פעם. הדפדפן מזוהה בעוגייה מאובטחת (httpOnly, SameSite=Strict),
 * כך שכל מכשיר מתחבר פעם אחת בלבד.
 *
 * הפעלה מקומית: node server/server.js   (הגדרות בקובץ server/.env, ראו server/.env.example)
 * בלי תלויות חיצוניות. דורש Node 18 ומעלה.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createStore } = require('./store');
const { dataRoutes } = require('./api');
const { createBackup } = require('./backup');

const ROOT = path.join(__dirname, '..');

/* ---------- הגדרות ---------- */
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

function createApp(opts = {}) {
  loadEnv(opts.envFile || path.join(__dirname, '.env'));
  const env = process.env;
  const cfg = {
    clientId: opts.clientId || env.GOOGLE_CLIENT_ID || '',
    clientSecret: opts.clientSecret || env.GOOGLE_CLIENT_SECRET || '',
    tokenUrl: opts.tokenUrl || env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token',
    revokeUrl: opts.revokeUrl || env.GOOGLE_REVOKE_URL || 'https://oauth2.googleapis.com/revoke',
    whoUrl: opts.whoUrl || env.GOOGLE_WHO_URL || 'https://www.googleapis.com/calendar/v3/users/me/calendarList/primary',
    // חשבון הסטודיו. אם הוגדר, רק הוא יכול להתחבר. אם לא, החשבון הראשון שמתחבר הופך לחשבון הסטודיו
    owner: (opts.owner || env.OWNER_EMAIL || '').toLowerCase(),
    dataDir: opts.dataDir || env.TAMIMA_DATA || path.join(__dirname, 'data'),
    secureCookie: opts.secureCookie != null ? opts.secureCookie : env.COOKIE_SECURE === '1',
    // כתובות שמותר להן לשלוח בקשות לשרת (מופרדות בפסיק). ריק = רק הכתובת של השרת עצמו
    origins: (opts.origins || env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
    fetch: opts.fetch || globalThis.fetch
  };
  fs.mkdirSync(cfg.dataDir, { recursive: true });

  /* ---------- הצפנה ושמירה ---------- */
  const keyFile = path.join(cfg.dataDir, 'key');
  if (!fs.existsSync(keyFile)) fs.writeFileSync(keyFile, crypto.randomBytes(32).toString('base64'), { mode: 0o600 });
  const KEY = Buffer.from(env.TAMIMA_KEY || fs.readFileSync(keyFile, 'utf8').trim(), 'base64');
  function seal(text) {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
    const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
    return [iv, c.getAuthTag(), enc].map(b => b.toString('base64')).join('.');
  }
  function open(sealed) {
    const [iv, tag, enc] = sealed.split('.').map(s => Buffer.from(s, 'base64'));
    const d = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
  }
  const storeFile = path.join(cfg.dataDir, 'store.json');
  const load = () => { try { return JSON.parse(fs.readFileSync(storeFile, 'utf8')); } catch (e) { return { google: null, sessions: {} }; } };
  const save = s => fs.writeFileSync(storeFile, JSON.stringify(s, null, 2), { mode: 0o600 });
  const hash = sid => crypto.createHash('sha256').update(sid).digest('hex');

  /* ---------- עזרים ל-HTTP ---------- */
  const SEC_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    // מותר להציג את האתר בתוך מסגרת רק מאותו אתר (עמוד ההצגה בטלפון), לא מאתרים אחרים
    'X-Frame-Options': 'SAMEORIGIN',
    'Content-Security-Policy': "frame-ancestors 'self'",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups'
  };
  function send(res, status, body, headers = {}) {
    const h = Object.assign({}, SEC_HEADERS, cfg.secureCookie ? { 'Strict-Transport-Security': 'max-age=31536000' } : {}, headers);
    if (body !== undefined && typeof body !== 'string' && !Buffer.isBuffer(body)) { body = JSON.stringify(body); h['Content-Type'] = 'application/json; charset=utf-8'; h['Cache-Control'] = 'no-store'; }
    res.writeHead(status, h);
    res.end(body);
  }
  const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim().split('=')).filter(p => p[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
  const COOKIE = 'tamima_sid';
  const setCookie = (sid, maxAge) => `${COOKIE}=${sid}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${cfg.secureCookie ? '; Secure' : ''}`;
  function readBody(req, limit = 16 * 1024) {
    return new Promise((resolve, reject) => {
      let size = 0; const parts = [];
      req.on('data', c => { size += c.length; if (size > limit) { const e = new Error('too large'); e.tooLarge = true; reject(e); req.destroy(); } else parts.push(c); });
      req.on('end', () => { try { resolve(parts.length ? JSON.parse(Buffer.concat(parts).toString('utf8')) : {}); } catch (e) { reject(e); } });
      req.on('error', reject);
    });
  }
  // הגנה מזיוף בקשות: רק מהכתובת של השרת עצמו (או מכתובות שהוגדרו), ורק עם כותרת שדפדפן לא שולח לבד
  function sameOrigin(req) {
    const origin = req.headers.origin;
    const own = `${cfg.secureCookie ? 'https' : 'http'}://${req.headers.host}`;
    return (!origin || origin === own || cfg.origins.includes(origin)) && req.headers['x-tamima'] === '1';
  }
  // הגבלת קצב פשוטה לכל כתובת. לנתונים מכסה נפרדת וגדולה יותר, כי הניהול שומר אחרי כל פעולה
  const hits = new Map();
  function limited(req, bucket, max) {
    const key = `${bucket}|${req.socket.remoteAddress || ''}`;
    const now = Date.now(), win = hits.get(key) || [];
    const recent = win.filter(t => now - t < 60e3);
    recent.push(now);
    hits.set(key, recent);
    return recent.length > max;
  }

  /* ---------- גוגל ---------- */
  async function google(url, params) {
    const r = await cfg.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(data.error_description || data.error || `google ${r.status}`); e.code = data.error || String(r.status); throw e; }
    return data;
  }
  function session(req) {
    const sid = cookies(req)[COOKIE];
    if (!sid) return null;
    const s = load();
    const rec = s.sessions[hash(sid)];
    return rec ? { sid, rec, store: s } : null;
  }

  /* ---------- נקודות קצה ---------- */
  const routes = {
    // האם השרת זמין, והאם הדפדפן הזה כבר מחובר
    'GET /api/auth/status': async req => {
      const ss = session(req);
      const s = ss ? ss.store : load();
      return [200, { server: true, data: true, configured: !!(cfg.clientId && cfg.clientSecret), clientId: cfg.clientId, connected: !!(ss && s.google), account: ss && s.google ? s.google.account : '', scope: ss && s.google ? s.google.scope : '' }];
    },
    // החלפת קוד ההרשאה (מהחלון של גוגל) במפתח קבוע. קורה פעם אחת בכל מכשיר
    'POST /api/auth/exchange': async (req, body) => {
      if (!cfg.clientId || !cfg.clientSecret) return [503, { error: 'השרת עוד לא הוגדר. חסרים פרטי הלקוח של גוגל בקובץ server/.env.' }];
      const code = String(body.code || '');
      if (!code || code.length > 2048) return [400, { error: 'חסר קוד הרשאה.' }];
      let t;
      try { t = await google(cfg.tokenUrl, { code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: 'postmessage', grant_type: 'authorization_code' }); }
      catch (e) { return [400, { error: 'גוגל לא אישרה את ההתחברות. נסו שוב.', reason: e.code }]; }
      // מי התחבר: כתובת החשבון לפי היומן הראשי שלו
      let account = '';
      try {
        const r = await cfg.fetch(cfg.whoUrl, { headers: { Authorization: 'Bearer ' + t.access_token } });
        account = String(((await r.json()) || {}).id || '').toLowerCase();
      } catch (e) { /* נבדק מיד למטה */ }
      if (!account) return [400, { error: 'לא הצלחנו לזהות את החשבון. נסו שוב.' }];
      const s = load();
      // רק חשבון הסטודיו: חשבון אחר לא יכול להחליף את החיבור
      const owner = cfg.owner || (s.google && s.google.account) || '';
      if (owner && account !== owner) return [403, { error: `אפשר להתחבר רק עם חשבון הסטודיו (${owner}).` }];
      // אם גוגל לא החזירה מפתח קבוע חדש (משתמש שכבר אישר), ממשיכים עם הקיים
      if (!t.refresh_token && !(s.google && s.google.refresh)) {
        // קורה כשהחשבון כבר אישר בעבר בלי שרת. מבטלים את האישור הישן, וההתחברות הבאה תבקש אישור מלא עם מפתח קבוע
        await google(cfg.revokeUrl, { token: t.access_token }).catch(() => {});
        return [409, { error: 'צריך לאשר שוב פעם אחת.', reason: 'consent_again' }];
      }
      s.google = { refresh: t.refresh_token ? seal(t.refresh_token) : s.google.refresh, scope: t.scope || '', account, at: new Date().toISOString() };
      const sid = crypto.randomBytes(32).toString('base64url');
      s.sessions[hash(sid)] = { created: new Date().toISOString(), lastUsed: new Date().toISOString(), agent: String(req.headers['user-agent'] || '').slice(0, 120) };
      save(s);
      return [200, { access_token: t.access_token, expires_in: t.expires_in, scope: t.scope || '', account }, { 'Set-Cookie': setCookie(sid, 400 * 86400) }];
    },
    // כרטיס כניסה חדש מהמפתח הקבוע, בלי חלון של גוגל
    'POST /api/auth/token': async req => {
      const ss = session(req);
      if (!ss || !ss.store.google) return [401, { error: 'המכשיר הזה עוד לא מחובר.' }];
      let t;
      try { t = await google(cfg.tokenUrl, { refresh_token: open(ss.store.google.refresh), client_id: cfg.clientId, client_secret: cfg.clientSecret, grant_type: 'refresh_token' }); }
      catch (e) {
        if (e.code === 'invalid_grant') { // ההרשאה בוטלה בגוגל או פגה: צריך להתחבר מחדש
          ss.store.google = null; save(ss.store);
          return [401, { error: 'ההרשאה בגוגל בוטלה או פגה. צריך להתחבר מחדש.', reason: 'invalid_grant' }];
        }
        return [502, { error: 'אין חיבור לגוגל כרגע.' }];
      }
      ss.rec.lastUsed = new Date().toISOString();
      save(ss.store);
      return [200, { access_token: t.access_token, expires_in: t.expires_in, scope: t.scope || ss.store.google.scope }];
    },
    // ניתוק: המכשיר הזה בלבד, או כולם (כולל ביטול ההרשאה בגוגל)
    'POST /api/auth/disconnect': async (req, body) => {
      const ss = session(req);
      if (!ss) return [200, { ok: true }, { 'Set-Cookie': setCookie('', 0) }];
      if (body.everywhere) {
        if (ss.store.google) await google(cfg.revokeUrl, { token: open(ss.store.google.refresh) }).catch(() => {});
        save({ google: null, sessions: {} });
      } else {
        delete ss.store.sessions[hash(ss.sid)];
        save(ss.store);
      }
      return [200, { ok: true }, { 'Set-Cookie': setCookie('', 0) }];
    }
  };

  /* ---------- נתוני הסטודיו ---------- */
  // מי נכנס: רק דפדפן עם עוגיית כניסה בתוקף, כשחשבון הסטודיו מחובר. אחרת null
  function authed(req) {
    const ss = session(req);
    if (!ss || !ss.store.google) return null;
    const owner = cfg.owner || ss.store.google.account;
    return ss.store.google.account === owner ? owner : null;
  }
  const store = opts.store || createStore({ dir: path.join(cfg.dataDir, 'db') });
  const backup = createBackup({ store, dir: path.join(cfg.dataDir, 'backups'), seal, open });
  const data = dataRoutes({ store, authed });
  Object.assign(routes, data.routes);

  /* ---------- קבצים סטטיים ---------- */
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8' };
  // רק קבצי האתר. תיקיית השרת, הבדיקות וקבצים נסתרים לא מוגשים אף פעם
  const BLOCKED = /^\/(server|tests|node_modules)(\/|$)|\/\./;
  function serveStatic(req, res) {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    if (BLOCKED.test(p) || !TYPES[path.extname(p)] || p.endsWith('.md')) return send(res, 404, 'Not found');
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT + path.sep)) return send(res, 404, 'Not found');
    fs.readFile(file, (e, d) => (e ? send(res, 404, 'Not found') : send(res, 200, d, { 'Content-Type': TYPES[path.extname(p)], 'Cache-Control': 'no-cache' })));
  }

  async function handler(req, res) {
    const route = `${req.method} ${req.url.split('?')[0]}`;
    if (!route.includes(' /api/')) return req.method === 'GET' || req.method === 'HEAD' ? serveStatic(req, res) : send(res, 405, 'Method not allowed');
    const fn = routes[route];
    if (!fn) return send(res, 404, { error: 'not found' });
    const isData = route.includes(' /api/data');
    if (limited(req, isData ? 'data' : 'auth', isData ? 300 : 60)) return send(res, 429, { error: 'יותר מדי בקשות. נסו שוב בעוד דקה.' });
    // גם קריאת הנתונים מוגנת: רק מהאתר עצמו, עם הכותרת שדפדפן לא שולח לבד
    if ((req.method === 'POST' || isData) && !sameOrigin(req)) return send(res, 403, { error: 'בקשה ממקור לא מורשה.' });
    try {
      const body = req.method === 'POST' ? await readBody(req, data.bodyLimit[route]) : {};
      const [status, out, headers] = await fn(req, body);
      send(res, status, out, headers);
    } catch (e) {
      if (e.tooLarge) return send(res, 413, { error: 'הבקשה גדולה מדי.' });
      if (e instanceof SyntaxError) return send(res, 400, { error: 'בקשה לא תקינה.' });
      send(res, 500, { error: 'שגיאה בשרת.' });
    }
  }
  handler.store = store;
  handler.backup = backup;
  return handler;
}

module.exports = { createApp };

if (require.main === module) {
  const port = Number(process.env.PORT) || 8123;
  const app = createApp();
  app.backup.start();
  http.createServer(app).listen(port, () => console.log(`הסטודיו של תמימה: http://localhost:${port} (נתונים: ${app.store.kind === 'supabase' ? 'Supabase' : 'קובץ מקומי'})`));
}
