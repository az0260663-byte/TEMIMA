// בדיקת gsync.js מול שרת גוגל מדומה (fetch מזויף). מריצים: node tests/gsync.test.js
const path = require('path').join(__dirname, '..') + '/';
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok  -', m); };

// ---------- שרת גוגל מדומה ----------
const server = { cals: {}, ver: 1, primary: 'tamima@gmail.com', offline: false, calls: [], personalBusy: [{ start: '2026-10-06T08:00:00Z', end: '2026-10-06T11:00:00Z' }] };
const newCal = (id, summary) => { server.cals[id] = { id, summary, events: new Map(), vers: new Map() }; return server.cals[id]; };
newCal(server.primary, 'Tamima');
newCal('shared-old@group.calendar.google.com', 'יומן ישן');
const json = (status, body) => ({ status, ok: status < 400, statusText: String(status), json: async () => body });
global.fetch = async (url, opts) => {
  if (server.offline) throw new Error('offline');
  const u = new URL(url);
  const p = decodeURIComponent(u.pathname.replace('/calendar/v3', ''));
  const m = opts.method;
  const body = opts.body ? JSON.parse(opts.body) : null;
  server.calls.push(`${m} ${p.replace(/@[^/]+/g, '@…')}`);
  if (opts.headers.Authorization !== 'Bearer TOKEN') return json(401, { error: { message: 'auth' } });
  if (p === '/users/me/calendarList') return json(200, { items: Object.values(server.cals).map(c => ({ id: c.id, summary: c.summary, accessRole: 'owner', primary: c.id === server.primary })) });
  if (p === '/calendars' && m === 'POST') { const id = `c${Object.keys(server.cals).length}@group.calendar.google.com`; newCal(id, body.summary); return json(200, { id, summary: body.summary }); }
  if (p === '/freeBusy') return json(200, { calendars: Object.fromEntries(body.items.map(i => [i.id, { busy: i.id === 'primary' ? server.personalBusy : [] }])) });
  let mm = p.match(/^\/calendars\/([^/]+)$/);
  if (mm && m === 'PATCH') { server.cals[mm[1]].summary = body.summary; return json(200, {}); }
  mm = p.match(/^\/calendars\/([^/]+)\/events\/([^/]+)\/move$/);
  if (mm && m === 'POST') {
    const from = server.cals[mm[1]], to = server.cals[u.searchParams.get('destination')], ev = from.events.get(mm[2]);
    to.events.set(ev.id, Object.assign({}, ev)); to.vers.set(ev.id, ++server.ver);
    ev.status = 'cancelled'; from.vers.set(ev.id, ++server.ver);
    return json(200, ev);
  }
  mm = p.match(/^\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/);
  if (mm) {
    const c = server.cals[mm[1]];
    const id = mm[2];
    if (m === 'GET') {
      const tok = u.searchParams.get('syncToken');
      if (tok && server.expire === c.id) { server.expire = null; return json(410, { error: { message: 'gone' } }); }
      let items = [...c.events.values()];
      if (tok) items = items.filter(e => c.vers.get(e.id) > Number(tok)); else items = items.filter(e => e.status !== 'cancelled');
      return json(200, { items, nextSyncToken: String(server.ver) });
    }
    if (m === 'POST') { if (c.events.has(body.id) && c.events.get(body.id).status !== 'cancelled') return json(409, { error: { message: 'dup' } }); c.events.set(body.id, Object.assign({ status: 'confirmed' }, body)); c.vers.set(body.id, ++server.ver); return json(200, body); }
    if (m === 'PATCH') { if (!c.events.has(id)) return json(404, { error: { message: 'nf' } }); Object.assign(c.events.get(id), body); c.vers.set(id, ++server.ver); return json(200, c.events.get(id)); }
    if (m === 'DELETE') { if (!c.events.has(id)) return json(404, {}); c.events.get(id).status = 'cancelled'; c.vers.set(id, ++server.ver); return json(204, null); }
  }
  return json(404, { error: { message: 'no route ' + p } });
};

// ---------- דפדפן מדומה ----------
const store = {};
global.window = { addEventListener() {}, removeEventListener() {} };
global.localStorage = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
global.document = { head: { appendChild() {} }, visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
let revoked = false;
global.google = { accounts: { oauth2: {
  initTokenClient: cfg => ({ requestAccessToken: () => setTimeout(() => cfg.callback({ access_token: 'TOKEN', expires_in: 3600 }), 0) }),
  hasGrantedAllScopes: () => true,
  revoke: () => { revoked = true; }
} } };
window.google = global.google;
window.TAMIMA_CONFIG = { googleClientId: 'test.apps.googleusercontent.com' };
require(path + 'gcal.js'); require(path + 'data.js');
const G = window.GCal;
const S = window.DEMO.seed();
require(path + 'gsync.js');
const X = window.GSync;
const remoteOf = local => X.state().calendars.find(c => c.local === local).remote;
const kinds = cal => [...cal.events.values()].filter(e => e.status !== 'cancelled').map(e => (e.extendedProperties && e.extendedProperties.private && e.extendedProperties.private.kind) || 'other');

(async () => {
  const cals = await X.connect();
  assert(X.state().status === 'authorized' && cals.length === 2, 'התחברות והצגת רשימת היומנים');

  await X.setup({ upload: 'basic' });
  const st = X.state();
  assert(st.status === 'connected', 'מחובר אחרי הגדרה');
  const studio = server.cals[remoteOf(G.CAL.studio)];
  assert(studio && studio.summary === 'הסטודיו של תמימה', 'נוצר יומן "הסטודיו של תמימה"');
  assert(st.calendars.length === 4, 'ארבעה יומנים ממופים: סטודיו, חוגים ושני ערוצים');
  const classesCal = server.cals[remoteOf(G.CAL.classes)];
  assert(classesCal && classesCal.summary === 'הסטודיו של תמימה · חוגים', 'נוצר יומן "הסטודיו של תמימה · חוגים"');
  const sk = kinds(studio);
  assert(!sk.length, 'ליומן הסטודיו לא עלו לקוחות מדומים וחסימות');
  assert(kinds(classesCal).filter(k => k === 'class').length === 3, 'ליומן החוגים עלו 3 החוגים');
  const site = server.cals[remoteOf(G.channels.get('site').calendarId)];
  const salon = server.cals[remoteOf(G.channels.get('salon').calendarId)];
  assert(site.events.size > 20 && salon.events.size === 0, `משבצות עלו ליומן האתר (${site.events.size}), ובסלון עוד אין משבצות בדמו הריק`);
  assert(G.channels.busy(Date.parse('2026-10-06T00:00:00Z'), Date.parse('2026-10-07T00:00:00Z')).byCal.primary.length === 1, 'זמן תפוס מהיומן האישי נקלט (בלי פרטים)');

  // כתיבה מקומית נשלחת לגוגל
  const slot = G.channels.slots(Date.now() + 2 * 864e5, Date.now() + 30 * 864e5).find(x => x.channel === 'site');
  G.channels.assign(slot.date, slot.time, 'salon');
  await new Promise(r => setTimeout(r, 30));
  const inSalon = [...salon.events.values()].some(e => e.status !== 'cancelled' && e.start.dateTime.startsWith(`${slot.date}T${slot.time}`));
  const inSite = site.events.get(slot.eventId).status;
  assert(inSalon && inSite === 'cancelled', 'העברת משבצת לערוץ: נמחקה מיומן האתר ונוצרה ביומן בסלון בגוגל');

  // שינוי בגוגל על ידי הערוץ נקלט בסנכרון מצטבר
  const salonEv = [...salon.events.values()].find(e => e.status !== 'cancelled');
  let remoteChanges = null;
  X.onRemote = ch => { remoteChanges = ch; };
  salonEv.summary = 'נתפס: 3 משתתפים'; salon.vers.set(salonEv.id, ++server.ver);
  const extId = 'ext0001'; studio.events.set(extId, { id: extId, status: 'confirmed', summary: 'פגישה מהטלפון', start: { dateTime: '2026-10-08T09:00:00+03:00' }, end: { dateTime: '2026-10-08T10:00:00+03:00' } }); studio.vers.set(extId, ++server.ver);
  await X.syncNow();
  const localSalon = G.internal.rawEvents(G.channels.get('salon').calendarId).find(e => e.id === salonEv.id);
  assert(localSalon && localSalon.summary === 'נתפס: 3 משתתפים', 'שינוי כותרת שעשה הערוץ בגוגל הגיע לאפליקציה');
  assert(remoteChanges && remoteChanges[G.channels.get('salon').calendarId], 'האפליקציה קיבלה הודעה על השינוי מהערוץ');
  assert(G.internal.rawEvents(G.CAL.studio).some(e => e.id === extId), 'אירוע שנוסף בטלפון ביומן הסטודיו נקלט');

  // אירוע אישי חדש בטלפון שנופל על משבצת פתוחה: האפליקציה מקבלת הודעה, והמשבצת יורדת גם מגוגל
  const target = G.channels.slots(Date.now() + 2 * 864e5, Date.now() + 30 * 864e5).find(x => x.channel === 'site');
  const targetRemote = server.cals[remoteOf(target.calendarId)];
  server.personalBusy = server.personalBusy.concat({ start: new Date(target.s).toISOString(), end: new Date(target.e).toISOString() });
  let busyNotified = false;
  X.onRemote = () => { busyNotified = true; G.channels.tick(); };
  await X.syncNow();
  await new Promise(r => setTimeout(r, 30));
  await X.syncNow();
  assert(busyNotified && targetRemote.events.get(target.eventId).status === 'cancelled', 'אירוע אישי חדש על משבצת פתוחה: המשבצת ירדה גם מיומן גוגל');
  X.onRemote = () => {};

  // מחיקה בגוגל נקלטת
  studio.events.get(extId).status = 'cancelled'; studio.vers.set(extId, ++server.ver);
  await X.syncNow();
  assert(G.internal.rawEvents(G.CAL.studio).find(e => e.id === extId).status === 'cancelled', 'מחיקה בגוגל נקלטה');

  // אין אינטרנט: השינוי נשמר בתור ונשלח כשהחיבור חוזר
  server.offline = true;
  const bodyEv = { summary: 'חסימה אישית', start: { dateTime: '2026-10-20T10:00:00', timeZone: G.TZ }, end: { dateTime: '2026-10-20T11:00:00', timeZone: G.TZ }, extendedProperties: { private: { app: 'tamima-studio', kind: 'block' } } };
  const blk = G.events.insert({ calendarId: G.CAL.studio, requestBody: bodyEv });
  await new Promise(r => setTimeout(r, 3600));
  assert(X.state().pending === 1 && /אין חיבור/.test(X.state().error), 'בלי אינטרנט: השינוי ממתין בתור עם הודעה ברורה');
  server.offline = false;
  await X.syncNow();
  assert(studio.events.has(blk.id) && X.state().pending === 0, 'כשהחיבור חזר, השינוי נשלח');

  // syncToken שפג בגוגל (410): סנכרון מלא מחדש של אותו יומן, בלי לאבד אירועים
  server.expire = remoteOf(G.CAL.classes);
  const fullBefore = server.calls.filter(c => c.startsWith('GET /calendars/c')).length;
  const classesBefore = G.internal.rawEvents(G.CAL.classes).filter(e => e.status !== 'cancelled' && e.extendedProperties && e.extendedProperties.private.kind === 'class').length;
  await X.syncNow();
  const classesAfter = G.internal.rawEvents(G.CAL.classes).filter(e => e.status !== 'cancelled' && e.extendedProperties && e.extendedProperties.private.kind === 'class').length;
  assert(server.expire === null && classesAfter === classesBefore && !X.state().error, 'אסימון סנכרון שפג (410): סנכרון מלא מחדש, בלי לאבד אירועים ובלי שגיאה');

  // מעבר מגרסה קודמת: חוג שנשמר ביומן הסטודיו עובר ליומן החוגים, עם אותו מזהה
  const cls = [...classesCal.events.values()].find(e => e.status !== 'cancelled');
  studio.events.set(cls.id, Object.assign({}, cls)); studio.vers.set(cls.id, ++server.ver); classesCal.events.delete(cls.id);
  const sv = JSON.parse(store['tamima.gcal.v1']); delete sv.map[G.CAL.classes]; store['tamima.gcal.v1'] = JSON.stringify(sv);
  await X.setup({ studioId: remoteOf(G.CAL.studio), upload: 'none' });
  const moved = server.cals[remoteOf(G.CAL.classes)];
  assert(moved.events.has(cls.id) && moved.events.get(cls.id).extendedProperties.private.kind === 'class' && moved.events.get(cls.id).colorId === '9' && studio.events.get(cls.id).status === 'cancelled' && G.internal.rawEvents(G.CAL.classes).some(e => e.id === cls.id && e.status !== 'cancelled'),
    'מעבר מגרסה קודמת: החוגים הועברו מיומן הסטודיו ליומן החוגים');

  // דפדפן חדש (בלי הגדרות שמורות): היומנים הקיימים נמצאים לפי השם, בלי ליצור עותקים ובלי כפילויות
  const calsBefore = Object.keys(server.cals).length, siteBefore = [...site.events.values()].filter(e => e.status !== 'cancelled').length;
  delete store['tamima.gcal.v1'];
  await X.setup({ upload: 'basic' });
  assert(Object.keys(server.cals).length === calsBefore && remoteOf(G.CAL.studio) === studio.id && [...site.events.values()].filter(e => e.status !== 'cancelled').length === siteBefore,
    'דפדפן חדש: היומנים הקיימים נמצאו לפי השם, בלי עותקים ובלי משבצות כפולות');

  // ניתוק: ביטול ההרשאה
  X.disconnect(true);
  assert(X.state().status === 'off' && revoked && !store['tamima.gcal.v1'], 'ניתוק: ההרשאה בוטלה בגוגל והפרטים נמחקו מהדפדפן');
  console.log('\nקריאות לשרת:', server.calls.length);
})().catch(e => { console.error('ERROR', e); process.exitCode = 1; });
