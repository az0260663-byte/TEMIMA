// בדיקת שרת ההתחברות (server/server.js) מול גוגל מדומה. מריצים: node tests/server.test.js
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server/server.js');
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok  -', m); };

// ---------- גוגל מדומה ----------
const g = { refreshFor: { 'code-owner': 'R-OWNER-SECRET', 'code-other': 'R-OTHER' }, who: { 'A-code-owner': 'owner@gmail.com', 'A-code-other': 'other@gmail.com', 'A-code-norefresh': 'owner@gmail.com' }, revoked: [], n: 0, dead: false };
const fakeFetch = async (url, opts = {}) => {
  const res = (status, body) => ({ ok: status < 400, status, json: async () => body });
  if (url === 'https://fake/token') {
    const q = new URLSearchParams(opts.body);
    if (q.get('client_secret') !== 'SECRET') return res(401, { error: 'invalid_client' });
    if (q.get('grant_type') === 'authorization_code') {
      const code = q.get('code');
      if (!g.who['A-' + code]) return res(400, { error: 'invalid_grant' });
      return res(200, Object.assign({ access_token: 'A-' + code, expires_in: 3599, scope: 'cal mail' }, g.refreshFor[code] ? { refresh_token: g.refreshFor[code] } : {}));
    }
    if (q.get('grant_type') === 'refresh_token') {
      if (g.dead || q.get('refresh_token') !== 'R-OWNER-SECRET') return res(400, { error: 'invalid_grant' });
      return res(200, { access_token: 'A-code-owner', expires_in: 3599, scope: 'cal mail', n: ++g.n });
    }
  }
  if (url === 'https://fake/who') return res(200, { id: g.who[(opts.headers.Authorization || '').slice(7)] });
  if (url === 'https://fake/revoke') { g.revoked.push(new URLSearchParams(opts.body).get('token')); return res(200, {}); }
  return res(404, {});
};

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tamima-'));
const app = createApp({ clientId: 'CID', clientSecret: 'SECRET', tokenUrl: 'https://fake/token', revokeUrl: 'https://fake/revoke', whoUrl: 'https://fake/who', dataDir, fetch: fakeFetch, envFile: path.join(dataDir, 'none') });
const srv = http.createServer(app).listen(0);
const base = `http://localhost:${srv.address().port}`;
const call = (p, { method = 'GET', body, cookie, headers = {} } = {}) => fetch(base + p, { method, headers: Object.assign({ 'Content-Type': 'application/json', 'X-Tamima': '1', Origin: base }, cookie ? { Cookie: cookie } : {}, headers), body: body ? JSON.stringify(body) : undefined });
const cookieOf = r => (r.headers.get('set-cookie') || '').split(';')[0];

(async () => {
  let r = await call('/api/auth/status');
  let d = await r.json();
  assert(r.ok && d.server && d.configured && !d.connected && d.clientId === 'CID', 'השרת זמין ומוגדר, והמכשיר עוד לא מחובר');

  r = await call('/api/auth/exchange', { method: 'POST', body: { code: 'code-owner' }, headers: { 'X-Tamima': '' } });
  assert(r.status === 403, 'בקשה בלי הכותרת של המערכת נחסמת (הגנה מזיוף בקשות)');
  r = await call('/api/auth/exchange', { method: 'POST', body: { code: 'code-owner' }, headers: { Origin: 'https://evil.example' } });
  assert(r.status === 403, 'בקשה מאתר אחר נחסמת');

  r = await call('/api/auth/exchange', { method: 'POST', body: { code: 'code-owner' } });
  d = await r.json();
  const sc = r.headers.get('set-cookie') || '';
  const cookie = cookieOf(r);
  assert(r.ok && d.access_token === 'A-code-owner' && d.account === 'owner@gmail.com', 'התחברות ראשונה: כרטיס כניסה וחשבון הסטודיו');
  assert(/HttpOnly/.test(sc) && /SameSite=Strict/.test(sc) && /Path=\/api/.test(sc), 'העוגייה מאובטחת: לא נגישה לקוד בדף, ולא נשלחת מאתרים אחרים');
  const stored = fs.readFileSync(path.join(dataDir, 'store.json'), 'utf8');
  assert(!stored.includes('R-OWNER-SECRET') && !stored.includes(cookie.split('=')[1]), 'המפתח הקבוע נשמר מוצפן, ומזהה המכשיר נשמר רק כגיבוב');

  r = await call('/api/auth/status', { cookie });
  d = await r.json();
  assert(d.connected && d.account === 'owner@gmail.com', 'אחרי רענון: המכשיר מזוהה כמחובר');

  r = await call('/api/auth/token', { method: 'POST', cookie });
  d = await r.json();
  assert(r.ok && d.access_token === 'A-code-owner', 'כרטיס כניסה חדש בלי חלון של גוגל');
  r = await call('/api/auth/token', { method: 'POST' });
  assert(r.status === 401, 'מכשיר אחר בלי התחברות לא מקבל כרטיס');

  r = await call('/api/auth/exchange', { method: 'POST', body: { code: 'code-other' } });
  d = await r.json();
  assert(r.status === 403 && /owner@gmail\.com/.test(d.error), 'חשבון אחר לא יכול להחליף את חיבור הסטודיו');

  // מכשיר שני של תמימה: מתחבר פעם אחת, גם אם גוגל לא שולחת שוב מפתח קבוע
  g.refreshFor['code-owner'] = undefined;
  r = await call('/api/auth/exchange', { method: 'POST', body: { code: 'code-owner' } });
  const cookie2 = cookieOf(r);
  assert(r.ok && cookie2 && cookie2 !== cookie, 'מכשיר שני מתחבר פעם אחת ומקבל זיהוי משלו');
  r = await call('/api/auth/token', { method: 'POST', cookie: cookie2 });
  assert(r.ok, 'המכשיר השני מקבל כרטיס מהמפתח הקיים');

  // קבצים: האתר מוגש עם כותרות אבטחה, וקובצי השרת לא נחשפים
  r = await call('/index.html');
  assert(r.ok && r.headers.get('x-frame-options') === 'SAMEORIGIN' && /frame-ancestors 'self'/.test(r.headers.get('content-security-policy') || '') && r.headers.get('x-content-type-options') === 'nosniff', 'האתר מוגש עם כותרות אבטחה');
  const blocked = await Promise.all(['/server/server.js', '/server/.env', '/server/data/store.json', '/tests/server.test.js', '/.claude/launch.json', '/%2e%2e/%2e%2e/windows/win.ini', '/demo-v2-spec.md'].map(p => call(p).then(x => x.status)));
  assert(blocked.every(st => st === 404), 'קובצי השרת, ההגדרות, הנתונים והמסמכים הפנימיים לא נגישים מהדפדפן');

  // ניתוק המכשיר הזה בלבד
  r = await call('/api/auth/disconnect', { method: 'POST', cookie: cookie2, body: {} });
  assert(r.ok && /Max-Age=0/.test(r.headers.get('set-cookie') || ''), 'ניתוק מכשיר: העוגייה נמחקת');
  assert((await call('/api/auth/token', { method: 'POST', cookie: cookie2 })).status === 401 && (await call('/api/auth/token', { method: 'POST', cookie })).ok, 'המכשיר שנותק לא מקבל כרטיס, והמכשיר הראשון ממשיך לעבוד');

  // ההרשאה בוטלה בצד של גוגל
  g.dead = true;
  r = await call('/api/auth/token', { method: 'POST', cookie });
  d = await r.json();
  assert(r.status === 401 && d.reason === 'invalid_grant', 'הרשאה שבוטלה בגוגל: הודעה ברורה שצריך להתחבר מחדש');
  g.dead = false;

  // אישור ישן בלי מפתח קבוע: השרת מבטל אותו ומבקש אישור מלא
  fs.writeFileSync(path.join(dataDir, 'store.json'), JSON.stringify({ google: null, sessions: {} }));
  g.refreshFor['code-norefresh'] = undefined;
  r = await call('/api/auth/exchange', { method: 'POST', body: { code: 'code-norefresh' } });
  d = await r.json();
  assert(r.status === 409 && d.reason === 'consent_again' && g.revoked.includes('A-code-norefresh'), 'אישור ישן בלי מפתח קבוע: מבוטל, ובלחיצה הבאה מתבקש אישור מלא');

  // ניתוק מכל המכשירים: ביטול ההרשאה בגוגל
  g.refreshFor['code-owner'] = 'R-OWNER-SECRET';
  r = await call('/api/auth/exchange', { method: 'POST', body: { code: 'code-owner' } });
  const c3 = cookieOf(r);
  await call('/api/auth/disconnect', { method: 'POST', cookie: c3, body: { everywhere: true } });
  assert(g.revoked.includes('R-OWNER-SECRET') && (await call('/api/auth/token', { method: 'POST', cookie })).status === 401, 'ניתוק מלא: ההרשאה בוטלה בגוגל וכל המכשירים נותקו');

  srv.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
})().catch(e => { console.error('ERROR', e); process.exitCode = 1; srv.close(); });
