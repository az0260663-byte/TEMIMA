/*
 * server/pay.js: סליקה אמיתית מול מורנינג (חשבונית ירוקה), לבדיקה מקצה לקצה.
 *
 * זה ספק אחד מאחורי שכבת הסליקה. הממשקים (האתר והאזור האישי) לא יודעים איזה ספק עובד:
 *   GET  /api/pay/config   האם יש סליקה אמיתית, ואיזה מחירים
 *   POST /api/pay/start    דף תשלום להזמנה אחת: { ref, kind: 'workshop' | 'card', n, desc, client }  ->  { url, amount }
 *   POST /api/pay/check    האם ההזמנה שולמה: { ref }  ->  { paid, number, docId, amount, receiptUrl }
 *
 * הסכום נקבע כאן בשרת, לפי סוג ההזמנה ומספר המשתתפים. סכום שמגיע מהדפדפן לא משמש לכלום.
 * כרגע תמיד במחירי בדיקה (שקלים בודדים): המחירים האמיתיים יגיעו מהשרת כשההגדרות יעברו אליו (שלב 5).
 *
 * אימות: הדף של מורנינג לא יכול להחזיר את הלקוח לשרת שרץ במחשב (צריך כתובת https באינטרנט).
 * לכן הדף נפתח בלשונית חדשה, והאתר שואל את השרת כל כמה שניות. השרת מחפש במורנינג את המסמך
 * שנוצר לתשלום (לפי מזהה ההזמנה שבתיאור), ובודק שהסכום זהה. רק אז ההזמנה נחשבת "שולמה".
 * כשנעלה לשרת באינטרנט, יתווסף גם האישור שמורנינג שולח לשרת מיד אחרי תשלום.
 */
'use strict';

const BASE = {
  production: { api: 'https://api.greeninvoice.co.il/api/v1', idp: 'https://api.morning.co/idp/v1/oauth/token' },
  sandbox: { api: 'https://sandbox.d.greeninvoice.co.il/api/v1', idp: 'https://api.sandbox.morning.dev/idp/v1/oauth/token' }
};
// מחירי בדיקה: זוג 2 ₪, כל משתתף נוסף 1 ₪, כרטיסייה 4 ₪. כך רואים שהסכום משתנה לפי ההזמנה, בלי לשלם הרבה
const TEST_PRICES = { price2: 2, pricePer: 1, cardPrice: 4 };
// המחירים האמיתיים (כמו בהגדרות הסטודיו). ברירת המחדל. PAY_TEST_PRICES=1 מחזיר למחירי בדיקה
const REAL_PRICES = { price2: 680, pricePer: 300, cardPrice: 800 };
const DOC_TYPE = 320; // חשבונית מס / קבלה
// קופונים (כרגע רק לבדיקה). השרת מחשב את ההנחה בעצמו, ולא סומך על סכום מהדפדפן. לפחות 1 ₪ לתשלום
const COUPONS = { TEST679: 679 };
function withCoupon(amount, code) {
  const off = COUPONS[String(code || '').trim().toUpperCase()];
  return off ? Math.max(1, amount - off) : amount;
}

function amountFor(kind, n, prices = TEST_PRICES) {
  if (kind === 'card') return prices.cardPrice;
  if (kind === 'workshop' && Number.isInteger(n) && n >= 2 && n <= 6) return n === 2 ? prices.price2 : n * prices.pricePer;
  return null;
}
const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, max);
const day = (d, add = 0) => new Date(d.getTime() + add * 864e5).toISOString().slice(0, 10);

function payRoutes(opts = {}) {
  const env = opts.env || process.env;
  const fetch = opts.fetch || globalThis.fetch;
  const now = opts.now || (() => new Date());
  const cfg = {
    id: env.MORNING_CLIENT_ID || '',
    secret: env.MORNING_CLIENT_SECRET || '',
    mode: env.MORNING_ENV === 'sandbox' ? 'sandbox' : 'production'
  };
  const live = !!(cfg.id && cfg.secret);
  const TEST = env.PAY_TEST_PRICES === '1';
  const PRICES = TEST ? TEST_PRICES : REAL_PRICES;
  // קישור תשלום קבוע (אופציונלי): אם הוגדר, הלקוחות משלמים בו, והשרת מזהה את התשלום לפי סכום, מייל ושעה
  const fixedLink = /^https:\/\/[\w.-]+\/\S+$/.test(env.MORNING_FIXED_LINK || '') ? env.MORNING_FIXED_LINK : '';
  const base = BASE[cfg.mode];

  // כרטיס כניסה למורנינג: תקף לשעה, ונשמר בזיכרון עד דקה לפני שהוא פג
  let token = null, tokenExp = 0;
  async function auth() {
    if (token && Date.now() < tokenExp) return token;
    const r = await fetch(base.idp, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grant_type: 'client_credentials', client_id: cfg.id, client_secret: cfg.secret }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.accessToken) { const e = new Error(`morning auth ${r.status} ${d.error || ''}`); e.reason = d.error === 'unauthorized_client' ? 'no_api' : 'auth'; throw e; }
    token = d.accessToken;
    tokenExp = (Number(d.expiresAt) ? Number(d.expiresAt) * 1000 : Date.now() + 3600e3) - 60e3;
    return token;
  }
  async function call(method, path, body) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await fetch(base.api + path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth()}` }, body: body ? JSON.stringify(body) : undefined });
      if (r.status === 401 && attempt === 0) { token = null; continue; } // כרטיס שפג: פעם אחת מבקשים חדש
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { const e = new Error(`morning ${path} ${r.status} ${d.errorMessage || d.errorDescription || ''}`); e.status = r.status; throw e; }
      return d;
    }
  }

  // מסוף הסליקה: חייבים לשלוח אותו במפורש. השרת מוצא לבד את המסוף הפעיל שמקבל כרטיס אשראי (או MORNING_PLUGIN_ID)
  let plugin = null;
  async function getPlugin() {
    if (plugin) return plugin;
    if (env.MORNING_PLUGIN_ID) return (plugin = { id: env.MORNING_PLUGIN_ID, groups: [100] });
    const d = await call('GET', `/documents/info?type=${DOC_TYPE}`);
    const list = (d && d.paymentPlugins) || [];
    const p = list.find(x => x.active && (x.groups || []).includes(100)) || list.find(x => x.active);
    if (!p) { const e = new Error('no active plugin'); e.reason = 'no_plugin'; throw e; }
    return (plugin = { id: p.id, groups: p.groups || [] });
  }

  const pending = new Map(); // ref -> { amount, kind, at }
  const done = new Map();    // ref -> התוצאה, כדי לא לחפש שוב
  const claimed = new Set(); // קבלות שכבר שויכו להזמנה, כדי שקבלה אחת לא תאשר שתי הזמנות
  const fail = (e, text) => { console.error('מורנינג:', e.message); return [502, { error: e.reason === 'no_api' ? 'בחשבון במורנינג אין גישה לחיבור מערכות (API). צריך מסלול שכולל אותו.' : e.reason === 'no_plugin' ? 'בחשבון במורנינג אין מסוף סליקה פעיל.' : text }]; };

  const routes = {
    'GET /api/pay/config': async () => [200, live ? { live: true, provider: 'morning', env: cfg.mode, test: TEST, prices: PRICES, fixedLink } : { live: false }],

    /* קישור קבוע: הלקוח לחץ "לתשלום" והקישור נפתח. כאן נרשם מה מחכים לו: סכום (מהשרת), מייל ושם, ומתי.
       אחר כך /api/pay/check מחפש קבלה חדשה במורנינג עם אותו סכום ואותו מייל (או שם), שנוצרה אחרי הלחיצה */
    'POST /api/pay/watch': async (req, b) => {
      if (!live || !fixedLink) return [503, { error: 'אין קישור תשלום קבוע.' }];
      const ref = String(b.ref || '');
      if (!/^[\w-]{4,60}$/.test(ref)) return [400, { error: 'מזהה הזמנה לא תקין.' }];
      const kind = b.kind === 'card' ? 'card' : b.kind === 'workshop' ? 'workshop' : '';
      const base = amountFor(kind, Number(b.n), PRICES);
      if (!base) return [400, { error: 'סוג ההזמנה או מספר המשתתפים לא תקינים.' }];
      if (b.coupon && (kind !== 'workshop' || !COUPONS[String(b.coupon).trim().toUpperCase()])) return [400, { error: 'הקופון לא תקין.' }];
      const amount = kind === 'workshop' ? withCoupon(base, b.coupon) : base;
      const c = b.client || {};
      const email = clean(c.email, 120).toLowerCase(), name = clean(c.name, 80);
      if (!email && !name) return [400, { error: 'חסרים מייל או שם.' }];
      pending.set(ref, { amount, kind, at: Date.now(), fixed: true, email, name });
      if (pending.size > 1000) pending.delete(pending.keys().next().value);
      return [200, { url: fixedLink, amount }];
    },

    'POST /api/pay/start': async (req, b) => {
      if (!live) return [503, { error: 'אין חיבור לסליקה.' }];
      const ref = String(b.ref || '');
      if (!/^[\w-]{4,60}$/.test(ref)) return [400, { error: 'מזהה הזמנה לא תקין.' }];
      const kind = b.kind === 'card' ? 'card' : b.kind === 'workshop' ? 'workshop' : '';
      const base = amountFor(kind, Number(b.n), PRICES);
      if (!base) return [400, { error: 'סוג ההזמנה או מספר המשתתפים לא תקינים.' }];
      if (b.coupon && (kind !== 'workshop' || !COUPONS[String(b.coupon).trim().toUpperCase()])) return [400, { error: 'הקופון לא תקין.' }];
      const amount = kind === 'workshop' ? withCoupon(base, b.coupon) : base;
      const c = b.client || {};
      const name = clean(c.name, 80), email = clean(c.email, 120), phone = clean(c.phone, 30);
      if (!name) return [400, { error: 'חסר שם.' }];
      const desc = `${clean(b.desc, 120) || (kind === 'card' ? 'כרטיסייה' : 'סדנה')} · הזמנה ${ref}`;
      let d;
      try {
        const pl = await getPlugin();
        d = await call('POST', '/payments/form', {
          // pluginId: המסוף. group 100 = כרטיס אשראי, חובה במסוף "תשלומים דיגיטליים" (Grow)
          description: desc, type: DOC_TYPE, amount, currency: 'ILS', vatType: 0, lang: 'he', maxPayments: 1, pluginId: pl.id, group: 100,
          client: Object.assign({ name }, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { emails: [email] } : {}, phone ? { phone } : {}),
          custom: ref
        });
      } catch (e) { return fail(e, 'לא הצלחנו לפתוח דף תשלום. נסו שוב בעוד רגע.'); }
      if (!d || !d.url) return [502, { error: d && d.errorDescription ? `מורנינג: ${clean(d.errorDescription, 200)}` : 'מורנינג לא החזיר דף תשלום.' }];
      pending.set(ref, { amount, kind, at: Date.now() });
      if (pending.size > 1000) pending.delete(pending.keys().next().value);
      return [200, { url: d.url, amount }];
    },

    'POST /api/pay/check': async (req, b) => {
      if (!live) return [503, { error: 'אין חיבור לסליקה.' }];
      const ref = String(b.ref || '');
      if (done.has(ref)) return [200, done.get(ref)];
      const p = pending.get(ref);
      if (!p) return [404, { error: 'אין דף תשלום פתוח להזמנה הזו.' }];
      let found;
      try {
        // המסמכים שנוצרו מאתמול, ומתוכם זה של ההזמנה הזו (מזהה ההזמנה כתוב בתיאור)
        const r = await call('POST', '/documents/search', { type: [DOC_TYPE, 400], fromDate: day(now(), -1), page: 1, pageSize: 50 });
        const items = r.items || [];
        if (!p.fixed) found = items.find(x => String(x.description || '').includes(`הזמנה ${ref}`));
        else {
          // קישור קבוע: קבלה שנוצרה אחרי הלחיצה (עם שתי דקות מרווח לשעון), באותו סכום, לאותו מייל או שם, ושעוד לא שויכה להזמנה אחרת
          const same = (a, b2) => a && b2 && String(a).trim().toLowerCase() === String(b2).trim().toLowerCase();
          found = items
            .filter(x => !claimed.has(String(x.id)) && Number(x.amount) === p.amount && Number(x.creationDate || 0) * 1000 >= p.at - 120e3)
            .filter(x => { const cl = x.client || {}; return (p.email && (cl.emails || []).some(e => same(e, p.email))) || same(cl.name, p.name); })
            .sort((a, b2) => Number(a.creationDate) - Number(b2.creationDate))[0];
        }
      } catch (e) { return fail(e, 'לא הצלחנו לבדוק את התשלום כרגע.'); }
      if (!found) return [200, { paid: false }];
      claimed.add(String(found.id));
      if (Number(found.amount) !== p.amount) return [200, { paid: false, mismatch: true, error: `הסכום במורנינג (${found.amount} ₪) שונה מהסכום של ההזמנה (${p.amount} ₪).` }];
      let receiptUrl = '';
      try { const l = await call('GET', `/documents/${encodeURIComponent(found.id)}/download/links`); receiptUrl = l.he || l.origin || ''; } catch (e) { /* הקבלה קיימת גם בלי קישור הורדה */ }
      const out = { paid: true, number: String(found.number || ''), docId: String(found.id), amount: Number(found.amount), receiptUrl };
      done.set(ref, out);
      pending.delete(ref);
      return [200, out];
    }
  };
  return { routes, live };
}

module.exports = { payRoutes, amountFor, withCoupon, TEST_PRICES, REAL_PRICES };
