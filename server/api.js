/*
 * server/api.js: כתובות הנתונים של הניהול. רק לתמימה, אחרי כניסה.
 *
 *   GET  /api/data            כל נתוני הסטודיו
 *   GET  /api/data?since=N    רק מה שהשתנה אחרי גרסה N (כשהניהול פתוח בשני מכשירים)
 *   POST /api/data/save       שמירה של מה שהשתנה בלבד: { saveId, changes: [{ coll, id, data }] }
 *
 * saveId: מזהה לכל שמירה. אם אותה שמירה מגיעה פעמיים (למשל ניסיון חוזר אחרי ניתוק), היא נשמרת פעם אחת.
 */
'use strict';
const { validKey } = require('./store');

const MAX_ROW = 512 * 1024;    // רשומה אחת
const MAX_CHANGES = 5000;      // רשומות בשמירה אחת
const SAVE_BODY = 8 * 1024 * 1024;

function dataRoutes({ store, authed, audit = () => {} }) {
  const recent = new Map(); // saveId -> rev, לשמירות שכבר בוצעו
  const remember = (id, rev) => {
    recent.set(id, rev);
    if (recent.size > 500) recent.delete(recent.keys().next().value);
  };
  const deny = [401, { error: 'צריך להיכנס מחדש.', reason: 'signin' }];
  return {
    bodyLimit: { 'POST /api/data/save': SAVE_BODY },
    routes: {
      'GET /api/data': async req => {
        if (!authed(req)) return deny;
        const since = new URL(req.url, 'http://x').searchParams.get('since');
        if (since != null) {
          if (!/^\d{1,16}$/.test(since)) return [400, { error: 'גרסה לא תקינה.' }];
          return [200, await store.since(Number(since))];
        }
        return [200, await store.all()];
      },
      'POST /api/data/save': async (req, body) => {
        const who = authed(req);
        if (!who) return deny;
        const saveId = String(body.saveId || '');
        if (!/^[\w-]{8,64}$/.test(saveId)) return [400, { error: 'חסר מזהה שמירה.' }];
        // גם אם השמירה הכפולה הגיעה בזמן שהראשונה עוד רצה: מחכים לראשונה ולא שומרים שוב
        if (recent.has(saveId)) return [200, { rev: await recent.get(saveId), repeated: true }];
        const changes = Array.isArray(body.changes) ? body.changes : null;
        if (!changes || changes.length > MAX_CHANGES) return [400, { error: 'רשימת השינויים לא תקינה.' }];
        for (const c of changes) {
          if (!c || !validKey(c.coll, c.id)) return [400, { error: 'סוג או מזהה רשומה לא תקינים.' }];
          if (c.data === undefined) return [400, { error: 'רשומה בלי תוכן.' }];
          if (c.data !== null && (typeof c.data !== 'object' && typeof c.data !== 'number' && typeof c.data !== 'string' && typeof c.data !== 'boolean')) return [400, { error: 'תוכן רשומה לא תקין.' }];
          if (JSON.stringify(c.data).length > MAX_ROW) return [413, { error: 'רשומה גדולה מדי.' }];
        }
        const job = store.apply(changes.map(c => ({ coll: String(c.coll), id: String(c.id), data: c.data })));
        remember(saveId, job);
        let rev;
        try { rev = await job; } catch (e) { recent.delete(saveId); throw e; }
        audit(who, changes.length);
        return [200, { rev }];
      }
    }
  };
}

module.exports = { dataRoutes };
