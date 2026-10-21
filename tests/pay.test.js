// בדיקת הסליקה בשרת (server/pay.js) מול מורנינג מדומה. מריצים: node tests/pay.test.js
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createApp } = require('../server/server.js');
const { amountFor } = require('../server/pay.js');
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok  -', m); };

// מורנינג מדומה: כרטיס כניסה, דף תשלום, חיפוש מסמכים וקישור הורדה
const mr = { tokens: 0, forms: [], docs: [], expired: false };
const res = (status, body) => ({ ok: status < 400, status, json: async () => body });
const fakeMorning = async (url, opts = {}) => {
  const body = opts.body ? JSON.parse(opts.body) : {};
  if (url === 'https://api.morning.co/idp/v1/oauth/token') {
    if (body.client_id !== 'CID' || body.client_secret !== 'SEC' || body.grant_type !== 'client_credentials') return res(401, { error: 'invalid_client' });
    mr.tokens++;
    return res(200, { accessToken: 'T' + mr.tokens, tokenType: 'Bearer', expiresAt: Math.floor(Date.now() / 1000) + 3600 });
  }
  const auth = (opts.headers || {}).Authorization || '';
  if (!auth.startsWith('Bearer T') || (mr.expired && auth === 'Bearer T1')) return res(401, {});
  const p = url.replace('https://api.greeninvoice.co.il/api/v1', '');
  if (p === '/payments/form') { mr.forms.push(body); return res(201, { success: true, errorCode: 0, url: `https://pay.example/${mr.forms.length}` }); }
  if (p === '/documents/search') return res(200, { total: mr.docs.length, items: mr.docs });
  const m = p.match(/^\/documents\/([^/]+)\/download\/links$/);
  if (m) return res(200, { he: `https://files.example/${m[1]}.pdf`, origin: '' });
  return res(404, {});
};

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tamima-pay-'));
const prev = { id: process.env.MORNING_CLIENT_ID, sec: process.env.MORNING_CLIENT_SECRET };
process.env.MORNING_CLIENT_ID = 'CID'; process.env.MORNING_CLIENT_SECRET = 'SEC';
const app = createApp({ clientId: 'G', clientSecret: 'GS', dataDir, envFile: path.join(dataDir, 'none'), payFetch: fakeMorning });
process.env.MORNING_CLIENT_ID = prev.id || ''; process.env.MORNING_CLIENT_SECRET = prev.sec || '';
const srv = http.createServer(app).listen(0);
const base = `http://localhost:${srv.address().port}`;
const call = (p, body, headers = {}) => fetch(base + p, { method: body ? 'POST' : 'GET', headers: Object.assign({ 'Content-Type': 'application/json', 'X-Tamima': '1', Origin: base }, headers), body: body ? JSON.stringify(body) : undefined });
const client = { name: 'מיכל בדיקה', email: 'michal@example.com', phone: '052-7771234' };

(async () => {
  let r = await call('/api/pay/config'); let d = await r.json();
  assert(d.live && d.provider === 'morning' && d.test && d.prices.price2 === 2 && d.prices.cardPrice === 4, 'השרת מחובר למורנינג, במחירי בדיקה');

  // הסכום נקבע בשרת, לא בדפדפן
  assert(amountFor('workshop', 2) === 2 && amountFor('workshop', 3) === 3 && amountFor('workshop', 6) === 6 && amountFor('card') === 4, 'הסכום לפי סוג ההזמנה ומספר המשתתפים');
  assert(amountFor('workshop', 1) === null && amountFor('workshop', 7) === null && amountFor('other', 2) === null, 'סוג או מספר משתתפים לא תקינים נדחים');

  r = await call('/api/pay/start', { ref: 'ws_test1', kind: 'workshop', n: 3, amount: 0.01, desc: 'סדנת קרמיקה, 3 משתתפים', client });
  d = await r.json();
  const f = mr.forms[0];
  assert(r.ok && d.url === 'https://pay.example/1' && d.amount === 3, 'נפתח דף תשלום להזמנה, עם כתובת');
  assert(f.amount === 3 && f.type === 320 && f.currency === 'ILS' && f.custom === 'ws_test1' && f.description.includes('הזמנה ws_test1'), 'לדף נשלחו הסכום מהשרת (לא 0.01 מהדפדפן), חשבונית מס קבלה ומזהה ההזמנה');
  assert(f.client.name === client.name && f.client.emails[0] === client.email && f.client.phone === client.phone, 'פרטי הלקוח נשלחו מראש, כדי שלא יקליד אותם שוב');

  r = await call('/api/pay/start', { ref: 'ws_test2', kind: 'workshop', n: 3, client }, { 'X-Tamima': '' });
  assert(r.status === 403, 'פתיחת דף תשלום בלי הכותרת של המערכת נחסמת');
  r = await call('/api/pay/start', { ref: 'bad ref!', kind: 'workshop', n: 3, client });
  assert(r.status === 400, 'מזהה הזמנה לא תקין נדחה');

  // עוד לא שולם
  r = await call('/api/pay/check', { ref: 'ws_test1' }); d = await r.json();
  assert(r.ok && d.paid === false, 'לפני התשלום: לא שולם');
  r = await call('/api/pay/check', { ref: 'ws_unknown' });
  assert(r.status === 404, 'הזמנה בלי דף תשלום: אין מה לבדוק');

  // מסמך עם סכום אחר: לא נחשב תשלום
  mr.docs = [{ id: 'd1', number: 20001, description: 'סדנת קרמיקה · הזמנה ws_test1', amount: 1 }];
  r = await call('/api/pay/check', { ref: 'ws_test1' }); d = await r.json();
  assert(d.paid === false && d.mismatch, 'סכום שונה מהסכום של ההזמנה: לא נחשב שולם');

  // שולם
  mr.docs = [{ id: 'd0', number: 19999, description: 'הזמנה אחרת · הזמנה ws_other', amount: 3 }, { id: 'd2', number: 20002, description: 'סדנת קרמיקה · הזמנה ws_test1', amount: 3 }];
  r = await call('/api/pay/check', { ref: 'ws_test1' }); d = await r.json();
  assert(d.paid && d.number === '20002' && d.docId === 'd2' && d.amount === 3 && d.receiptUrl === 'https://files.example/d2.pdf', 'אחרי תשלום: נמצאה הקבלה של ההזמנה הזו, עם קישור להורדה');
  const searches = mr.tokens;
  r = await call('/api/pay/check', { ref: 'ws_test1' }); d = await r.json();
  assert(d.paid && d.number === '20002' && mr.tokens === searches, 'בדיקה חוזרת מחזירה את אותה תוצאה בלי לפנות שוב');

  // כרטיס כניסה שפג באמצע: מבקשים חדש פעם אחת וממשיכים
  mr.expired = true;
  r = await call('/api/pay/start', { ref: 'cp_test3', kind: 'card', client }); d = await r.json();
  assert(r.ok && d.amount === 4 && mr.tokens === 2, 'כרטיס כניסה שפג: מתחדש לבד, ודף התשלום לכרטיסייה נפתח (4 ₪)');

  srv.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
})().catch(e => { console.error(e); process.exitCode = 1; srv.close(); });
