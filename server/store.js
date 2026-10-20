/*
 * server/store.js: שכבת הנתונים של הסטודיו.
 *
 * כל המידע נשמר כרשומות: { coll, id, data, rev }.
 *   coll  סוג המידע (students, workshops, settings...)
 *   id    מזהה הרשומה. "_" = רשומה אחת לכל הסוג (למשל ההגדרות)
 *   data  התוכן. null = נמחקה (נשאר סימון מחיקה, כדי שמכשיר אחר ידע למחוק גם אצלו)
 *   rev   מספר גרסה שעולה בכל שמירה. מכשיר ששואל "מה השתנה מאז X" מקבל רק את מה שאחרי X
 *
 * שתי אפשרויות שמתנהגות אותו דבר:
 *   file      קובץ מקומי (פיתוח ובדיקות). נכתב לקובץ זמני ואז מוחלף, כך שנפילה באמצע לא משאירה קובץ שבור
 *   supabase  מסד הנתונים ב-Supabase, דרך הממשק הרגיל שלו. המפתח הסודי נמצא רק בשרת
 */
'use strict';
const fs = require('fs');
const path = require('path');

const COLL = /^[a-zA-Z][a-zA-Z0-9_.]{0,40}$/;
const ID = /^[\w.:@-]{1,200}$/;
const validKey = (coll, id) => COLL.test(String(coll)) && ID.test(String(id));

// מספר גרסה שתמיד עולה, גם אם השעון של השרת זז אחורה
function revClock(start = 0) {
  let last = start;
  return () => { last = Math.max(Date.now(), last + 1); return last; };
}

function fileStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'records.json');
  let db;
  try { db = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { db = { rev: 0, rows: {} }; }
  const next = revClock(db.rev);
  const flush = () => {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db), { mode: 0o600 });
    fs.renameSync(tmp, file);
  };
  const list = filter => Object.entries(db.rows).filter(([, r]) => filter(r)).map(([k, r]) => {
    const i = k.indexOf('|');
    return { coll: k.slice(0, i), id: k.slice(i + 1), data: r.data, rev: r.rev };
  });
  return {
    kind: 'file',
    async all() { return { rev: db.rev, rows: list(r => r.data !== null) }; },
    async since(rev) { return { rev: db.rev, rows: list(r => r.rev > rev) }; },
    // changes: [{ coll, id, data }]. data null = מחיקה
    async apply(changes) {
      if (!changes.length) return db.rev;
      const rev = next();
      for (const c of changes) db.rows[`${c.coll}|${c.id}`] = { data: c.data, rev };
      db.rev = rev;
      flush();
      return rev;
    }
  };
}

function supabaseStore({ url, key, fetch = globalThis.fetch, table = 'records' }) {
  if (!url || !key) throw new Error('חסרים SUPABASE_URL או SUPABASE_SERVICE_KEY בקובץ server/.env.');
  const base = `${url.replace(/\/$/, '')}/rest/v1/${table}`;
  // מפתח סודי מהסוג החדש (sb_secret_...) נשלח רק בכותרת apikey. מפתח ישן (service_role) נשלח גם כ-Authorization
  const legacy = /^eyJ/.test(key);
  const headers = extra => Object.assign({ apikey: key, 'Content-Type': 'application/json' }, legacy ? { Authorization: `Bearer ${key}` } : {}, extra);
  async function call(method, query, body, extra) {
    const r = await fetch(`${base}${query}`, { method, headers: headers(extra), body: body === undefined ? undefined : JSON.stringify(body) });
    if (!r.ok) { const t = await r.text().catch(() => ''); const e = new Error(`supabase ${r.status} ${t.slice(0, 200)}`); e.status = r.status; throw e; }
    return r.status === 204 ? null : r.json();
  }
  // הגרסה האחרונה שנשמרה, כדי שגם אחרי הפעלה מחדש של השרת המספרים ימשיכו לעלות
  let next = null;
  async function clock() {
    if (next) return next;
    const top = await call('GET', '?select=rev&order=rev.desc&limit=1');
    next = revClock(top && top[0] ? Number(top[0].rev) : 0);
    return next;
  }
  const PAGE = 1000;
  async function page(filter) {
    const out = [];
    for (let from = 0; ; from += PAGE) {
      const rows = await call('GET', `?select=coll,id,data,rev${filter}&order=rev.asc`, undefined, { Range: `${from}-${from + PAGE - 1}` });
      out.push(...rows.map(r => ({ coll: r.coll, id: r.id, data: r.data, rev: Number(r.rev) })));
      if (rows.length < PAGE) return out;
    }
  }
  const topRev = rows => rows.reduce((m, r) => Math.max(m, r.rev), 0);
  return {
    kind: 'supabase',
    async all() { const rows = await page('&data=not.is.null'); return { rev: topRev(rows), rows }; },
    async since(rev) { const rows = await page(`&rev=gt.${Number(rev) || 0}`); return { rev: Math.max(topRev(rows), Number(rev) || 0), rows }; },
    async apply(changes) {
      if (!changes.length) return null;
      const rev = (await clock())();
      const at = new Date().toISOString();
      await call('POST', '?on_conflict=coll,id', changes.map(c => ({ coll: c.coll, id: c.id, data: c.data, rev, updated_at: at })), { Prefer: 'resolution=merge-duplicates,return=minimal' });
      return rev;
    }
  };
}

function createStore(opts = {}) {
  const env = process.env;
  const kind = opts.kind || env.STORE || 'file';
  if (kind === 'supabase') return supabaseStore({ url: opts.url || env.SUPABASE_URL, key: opts.key || env.SUPABASE_SERVICE_KEY, fetch: opts.fetch });
  return fileStore(opts.dir || path.join(env.TAMIMA_DATA || path.join(__dirname, 'data'), 'db'));
}

module.exports = { createStore, validKey };
