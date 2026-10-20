// בדיקת נתוני הסטודיו בשרת: שמירה, טעינה, הרשאות וגיבוי. מריצים: node tests/store.test.js
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server/server.js');
const { createStore } = require('../server/store.js');
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok  -', m); };

// גוגל מדומה: owner = חשבון הסטודיו, other = חשבון אחר
const who = { 'A-owner': 'owner@gmail.com', 'A-other': 'other@gmail.com' };
const fakeFetch = async (url, opts = {}) => {
  const res = (status, body) => ({ ok: status < 400, status, json: async () => body });
  if (url === 'https://fake/token') {
    const q = new URLSearchParams(opts.body);
    if (q.get('grant_type') === 'authorization_code') return res(200, { access_token: 'A-' + q.get('code'), refresh_token: 'R-' + q.get('code'), expires_in: 3599, scope: 'cal' });
    return res(200, { access_token: 'A-owner', expires_in: 3599, scope: 'cal' });
  }
  if (url === 'https://fake/who') return res(200, { id: who[(opts.headers.Authorization || '').slice(7)] });
  if (url === 'https://fake/revoke') return res(200, {});
  return res(404, {});
};

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tamima-db-'));
const make = () => createApp({ clientId: 'CID', clientSecret: 'SECRET', owner: 'owner@gmail.com', tokenUrl: 'https://fake/token', revokeUrl: 'https://fake/revoke', whoUrl: 'https://fake/who', dataDir, fetch: fakeFetch, envFile: path.join(dataDir, 'none') });
let app = make();
let srv = http.createServer(app).listen(0);
let base = `http://localhost:${srv.address().port}`;
const call = (p, { method = 'GET', body, cookie, headers = {} } = {}) => fetch(base + p, { method, headers: Object.assign({ 'Content-Type': 'application/json', 'X-Tamima': '1', Origin: base }, cookie ? { Cookie: cookie } : {}, headers), body: body ? JSON.stringify(body) : undefined });
const cookieOf = r => (r.headers.get('set-cookie') || '').split(';')[0];
const save = (cookie, changes, saveId = 'save-' + Math.random().toString(36).slice(2, 12)) => call('/api/data/save', { method: 'POST', cookie, body: { saveId, changes } });

(async () => {
  // בלי כניסה: אין גישה לנתונים
  let r = await call('/api/data');
  assert(r.status === 401, 'בלי כניסה: קריאת הנתונים חסומה');
  r = await save('', [{ coll: 'students', id: 'st1', data: { id: 'st1', name: 'דנה' } }]);
  assert(r.status === 401, 'בלי כניסה: שמירה חסומה');

  // חשבון אחר לא נכנס
  r = await call('/api/auth/exchange', { method: 'POST', body: { code: 'other' } });
  assert(r.status === 403 && !cookieOf(r), 'חשבון שאינו של הסטודיו לא מקבל כניסה');

  // כניסה של תמימה
  r = await call('/api/auth/exchange', { method: 'POST', body: { code: 'owner' } });
  const cookie = cookieOf(r);
  assert(r.ok && cookie, 'כניסה עם חשבון הסטודיו');

  r = await call('/api/data', { cookie });
  let d = await r.json();
  assert(r.ok && d.rows.length === 0 && d.rev === 0, 'בפעם הראשונה השרת ריק');

  // קריאה מאתר אחר או בלי הכותרת של המערכת: חסומה גם עם עוגייה
  r = await call('/api/data', { cookie, headers: { Origin: 'https://evil.example' } });
  assert(r.status === 403, 'קריאת הנתונים מאתר אחר חסומה, גם עם עוגייה');
  r = await call('/api/data', { cookie, headers: { 'X-Tamima': '' } });
  assert(r.status === 403, 'קריאת הנתונים בלי הכותרת של המערכת חסומה');

  // שמירה וטעינה
  r = await save(cookie, [
    { coll: 'students', id: 'st1', data: { id: 'st1', name: 'דנה כהן', phone: '050-1234567' } },
    { coll: 'students', id: '_order', data: ['st1'] },
    { coll: 'settings', id: '_', data: { price2: 380 } }
  ], 'first-save-001');
  d = await r.json();
  const rev1 = d.rev;
  assert(r.ok && rev1 > 0, 'שמירה ראשונה מחזירה מספר גרסה');

  // אותה שמירה פעמיים (ניסיון חוזר אחרי ניתוק): נשמרת פעם אחת
  r = await save(cookie, [{ coll: 'students', id: 'st1', data: { id: 'st1', name: 'אחר' } }], 'first-save-001');
  d = await r.json();
  assert(r.ok && d.repeated && d.rev === rev1, 'שמירה כפולה עם אותו מזהה: לא נשמרת שוב');
  const twin = await Promise.all([1, 2].map(() => save(cookie, [{ coll: 'groups', id: 'g1', data: { id: 'g1' } }], 'twin-save-0001').then(x => x.json())));
  assert(twin[0].rev === twin[1].rev && twin.some(x => x.repeated), 'שתי שמירות זהות שמגיעות יחד: נשמרות פעם אחת');

  r = await call('/api/data', { cookie });
  d = await r.json();
  const st = d.rows.find(x => x.coll === 'students' && x.id === 'st1');
  assert(st && st.data.name === 'דנה כהן' && d.rows.length === 4, 'הטעינה מחזירה בדיוק את מה שנשמר');

  // רק מה שהשתנה מאז גרסה מסוימת (מכשיר שני)
  const before = d.rev;
  await save(cookie, [{ coll: 'students', id: 'st1', data: null }, { coll: 'students', id: '_order', data: [] }]);
  r = await call(`/api/data?since=${before}`, { cookie });
  d = await r.json();
  assert(d.rows.length === 2 && d.rows.some(x => x.id === 'st1' && x.data === null), 'מכשיר שני מקבל רק את מה שהשתנה, כולל מחיקה');
  r = await call('/api/data', { cookie });
  d = await r.json();
  assert(!d.rows.some(x => x.id === 'st1'), 'רשומה שנמחקה לא חוזרת בטעינה מלאה');

  // בדיקת תקינות
  r = await save(cookie, [{ coll: '../etc', id: 'x', data: {} }]);
  assert(r.status === 400, 'סוג רשומה לא תקין נדחה');
  r = await save(cookie, [{ coll: 'students', id: 'a b<script>', data: {} }]);
  assert(r.status === 400, 'מזהה רשומה לא תקין נדחה');
  r = await save(cookie, [{ coll: 'students', id: 'big', data: { s: 'x'.repeat(600 * 1024) } }]);
  assert(r.status === 413, 'רשומה גדולה מדי נדחית');
  r = await call(`/api/data?since=abc`, { cookie });
  assert(r.status === 400, 'מספר גרסה לא תקין נדחה');

  // הנתונים נשארים אחרי הפעלה מחדש של השרת
  srv.close();
  app = make();
  srv = http.createServer(app).listen(0);
  base = `http://localhost:${srv.address().port}`;
  r = await call('/api/data', { cookie });
  d = await r.json();
  assert(r.ok && d.rows.some(x => x.coll === 'settings' && x.data.price2 === 380), 'אחרי הפעלה מחדש של השרת הנתונים נשארו, והכניסה בתוקף');
  const r2 = await (await save(cookie, [{ coll: 'settings', id: '_', data: { price2: 400 } }])).json();
  assert(r2.rev > d.rev, 'מספרי הגרסה ממשיכים לעלות אחרי הפעלה מחדש');

  // יציאה: העוגייה כבר לא נותנת גישה
  await call('/api/auth/disconnect', { method: 'POST', cookie, body: {} });
  r = await call('/api/data', { cookie });
  assert(r.status === 401, 'אחרי יציאה אין גישה לנתונים');

  // גיבוי: מוצפן, אחד ליום, ואפשר לשחזר
  const name = await app.backup.run(true);
  const raw = fs.readFileSync(path.join(dataDir, 'backups', name), 'utf8');
  assert(name && !raw.includes('price2'), 'הגיבוי נשמר מוצפן');
  const back = app.backup.restore(name);
  assert(back.rows.some(x => x.coll === 'settings' && x.data.price2 === 400), 'שחזור מהגיבוי מחזיר את הנתונים');
  assert((await app.backup.run()) === null, 'גיבוי שני באותו יום לא נוצר');
  const bdir = path.join(dataDir, 'backups');
  for (let i = 1; i <= 33; i++) fs.writeFileSync(path.join(bdir, `2020-01-${String(i).padStart(2, '0')}.bak`), 'x');
  await app.backup.run(true);
  assert(app.backup.list().length === 30, 'נשמרים רק 30 הגיבויים האחרונים');

  // Supabase: אותן פעולות מול ממשק מדומה
  const sb = new Map(); const sent = [];
  const sbFetch = async (url, opts = {}) => {
    sent.push({ url, opts });
    const res = (status, body) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) });
    if (opts.headers.apikey !== 'sb_secret_TEST' || opts.headers.Authorization) return res(401, {});
    const u = new URL(url);
    if (opts.method === 'POST') { JSON.parse(opts.body).forEach(x => sb.set(`${x.coll}|${x.id}`, x)); return res(201, null); }
    let rows = [...sb.values()];
    const rev = u.searchParams.get('rev');
    if (rev) rows = rows.filter(x => x.rev > Number(rev.slice(3)));
    if (u.searchParams.get('data') === 'not.is.null') rows = rows.filter(x => x.data !== null);
    rows.sort((a, b) => (u.searchParams.get('order') === 'rev.desc' ? b.rev - a.rev : a.rev - b.rev));
    if (u.searchParams.get('limit')) rows = rows.slice(0, Number(u.searchParams.get('limit')));
    return res(200, rows);
  };
  const s = createStore({ kind: 'supabase', url: 'https://x.supabase.co', key: 'sb_secret_TEST', fetch: sbFetch });
  const legacyHeaders = [];
  await createStore({ kind: 'supabase', url: 'https://x.supabase.co', key: 'eyJLEGACY', fetch: async (u, o) => { legacyHeaders.push(o.headers); return { ok: true, status: 200, json: async () => [] }; } }).all();
  assert(legacyHeaders[0].apikey === 'eyJLEGACY' && legacyHeaders[0].Authorization === 'Bearer eyJLEGACY', 'Supabase: גם מפתח מהסוג הישן עובד');
  const sr = await s.apply([{ coll: 'students', id: 'st9', data: { id: 'st9' } }, { coll: 'leads', id: 'l1', data: { id: 'l1' } }]);
  await s.apply([{ coll: 'leads', id: 'l1', data: null }]);
  const all = await s.all();
  const since = await s.since(sr);
  assert(all.rows.length === 1 && all.rows[0].id === 'st9' && since.rows.length === 1 && since.rows[0].data === null, 'Supabase: שמירה, טעינה, ושינויים מאז גרסה');
  assert(sent.every(x => x.url.startsWith('https://x.supabase.co/rest/v1/records')) && sent.some(x => /on_conflict=coll,id/.test(x.url) && /merge-duplicates/.test(x.opts.headers.Prefer)), 'Supabase: כתיבה כעדכון או הוספה, רק לטבלת הרשומות');

  srv.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
})().catch(e => { console.error(e); process.exitCode = 1; srv.close(); });
