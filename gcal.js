/*
 * gcal.js: שכבת יומן בפורמט Google Calendar API v3.
 *
 * בדמו זו הדמיה בזיכרון, אבל הממשק זהה ל-API האמיתי, כך שבגרסה 1 מחליפים רק את המימוש:
 *   GCal.events.list / get / insert / patch / delete
 *   GCal.freebusy.query
 * שמות הפרמטרים, מבנה המשאב Event, מבנה התשובות וכללי הוולידציה תואמים את התיעוד:
 *   https://developers.google.com/calendar/api/v3/reference/events
 *
 * יומנים:
 *   STUDIO:   היומן של תמימה בסטודיו. חוגים (אירוע חוזר עם RRULE), סדנאות, חסימות,
 *             וכל אירוע שתמימה מוסיפה ישירות בגוגל (נקרא ונחשב תפוס).
 *   PERSONAL: היומן האישי של תמימה ('primary'). נקרא רק דרך freebusy, בלי פרטים.
 *   ערוצים:  לכל ערוץ שיווק יומן משני משלו (calendars.insert), משותף עם הערוץ,
 *             ובו רק המשבצות הפנויות ששייכות לערוץ. ראו GCal.channels בהמשך.
 *   CAL.salon ו-CAL.site נשארו לתאימות, ומצביעים ליומנים של הערוצים.
 *
 * מיפוי לנתוני האפליקציה: extendedProperties.private
 *   app=tamima-studio, kind=class|workshop|block, groupId, workshopId, source=site|salon
 * אירוע בלי app=tamima-studio הוא אירוע חיצוני (נוצר ישירות ביומן גוגל).
 *
 * זמינות: freebusy.query על יומן הסטודיו וגם על היומן האישי. רק אירועים confirmed עם transparency=opaque תופסים זמן.
 *
 * במעבר לגוגל האמיתי:
 *   - הקריאות אסינכרוניות (gapi.client.calendar.*). האפליקציה תשמור עותק מקומי ותתעדכן
 *     עם syncToken (כבר ממומש כאן ב-events.list), כך שהרינדור נשאר סינכרוני.
 *   - הרשאות OAuth (לאמת בקונסולת גוגל): calendar.events (קריאה וכתיבה ביומן הסטודיו),
 *     calendar.freebusy (זמינות, כולל היומן האישי), calendar.app.created (יצירת יומני
 *     הערוצים וניהולם), calendar.acls (שיתוף יומן ערוץ עם השותף).
 *   - התראות על שינויים (events.watch) דורשות שרת HTTPS, לא אפשרי ב-GitHub Pages בלבד.
 */
(function () {
  'use strict';

  const TZ = 'Asia/Jerusalem';
  const CAL = {
    studio: 'studio.tamima@group.calendar.google.com',   // סדנאות, חסימות ואירועים שנוספו בטלפון
    classes: 'classes.tamima@group.calendar.google.com', // החוגים השבועיים
    personal: 'primary',
    remoteBusy: 'remote.busy.local', // עותק של freebusy מגוגל, רק כשהיומן מחובר
    // תאימות לממשק הקודם: היומנים של ערוץ "בסלון" והאתר
    get salon() { const c = channelList.find(x => x.id === 'salon'); return c && c.calendarId; },
    get site() { const c = channelList.find(x => x.id === HOME); return c && c.calendarId; }
  };
  const B32 = '0123456789abcdefghijklmnopqrstuv'; // base32hex, התווים המותרים ב-event id

  let calendars, version, silent = false;
  let onWrite = null, onCall = null, onMutate = null, applyingRemote = false;

  function makeCal(id, summary, timeZone = TZ, description = '') {
    calendars[id] = { kind: 'calendar#calendar', id, summary, description, timeZone, events: new Map(), ver: new Map() };
    return calendars[id];
  }
  const calResource = c => ({ kind: 'calendar#calendar', etag: `"${version}"`, id: c.id, summary: c.summary, description: c.description || '', timeZone: c.timeZone });

  function reset() {
    version = 1;
    clock.offset = 0;
    calendars = {};
    makeCal(CAL.studio, 'הסטודיו של תמימה');
    makeCal(CAL.classes, 'הסטודיו של תמימה · חוגים');
    makeCal(CAL.personal, 'תמימה (אישי)');
    channelList = defaultChannels();
    releaseQueue = [];
    displaced = [];
    channelList.forEach(ch => makeCal(ch.calendarId, `הסטודיו של תמימה · ${ch.name}`, TZ, 'משבצות פנויות לסדנאות. משותף עם הערוץ.'));
  }
  function calendarName(id) {
    if (id === CAL.studio) return 'יומן הסטודיו';
    if (id === CAL.classes) return 'יומן החוגים';
    if (id === CAL.personal) return 'יומן אישי';
    if (id === CAL.remoteBusy) return 'זמינות מגוגל';
    const ch = channelList.find(c => c.calendarId === id);
    return ch ? `יומן ${ch.name}` : id;
  }

  /* ---------- מזהים ---------- */
  function b32hex(str) {
    const bytes = new TextEncoder().encode(str);
    let out = '', bits = 0, val = 0;
    for (const b of bytes) {
      val = (val << 8) | b; bits += 8;
      while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; val &= (1 << bits) - 1; }
    }
    if (bits > 0) out += B32[(val << (5 - bits)) & 31];
    return out;
  }
  function newId() {
    let s = '';
    for (let i = 0; i < 26; i++) s += B32[Math.floor(Math.random() * 32)];
    return s;
  }

  /* ---------- זמנים באזור הזמן של הסטודיו ---------- */
  const pad = n => String(n).padStart(2, '0');
  function offsetMin(instant) {
    try {
      const v = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' })
        .formatToParts(instant).find(p => p.type === 'timeZoneName').value;
      const m = v.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
      return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0)) : 0;
    } catch (e) { return -instant.getTimezoneOffset(); }
  }
  // 'YYYY-MM-DDTHH:MM:SS' בשעון ירושלים -> מילישניות UTC
  function wallToMs(wall) {
    const [d, t = '00:00:00'] = wall.split('T');
    const [y, mo, da] = d.split('-').map(Number);
    const [h, mi, s = 0] = t.split(':').map(Number);
    const guess = Date.UTC(y, mo - 1, da, h, mi, s);
    return guess - offsetMin(new Date(guess - offsetMin(new Date(guess)) * 6e4)) * 6e4;
  }
  function msToWall(ms) {
    const d = new Date(ms + offsetMin(new Date(ms)) * 6e4);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  }
  function rfc3339(wall) {
    const off = offsetMin(new Date(wallToMs(wall)));
    const sign = off < 0 ? '-' : '+';
    return `${wall}${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
  }
  // start/end של אירוע -> מילישניות
  function edgeMs(edge) {
    if (edge.date) return wallToMs(edge.date + 'T00:00:00');
    return /[zZ]|[+-]\d{2}:\d{2}$/.test(edge.dateTime) ? Date.parse(edge.dateTime) : wallToMs(edge.dateTime);
  }
  const utcBasic = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  /* ---------- שגיאות בסגנון ה-API ---------- */
  function apiError(code, reason, message) {
    const e = new Error(message);
    e.code = code; e.errors = [{ domain: 'global', reason, message }];
    return e;
  }
  function cal(calendarId) {
    const c = calendars[calendarId];
    if (!c) throw apiError(404, 'notFound', 'Not Found');
    return c;
  }

  function validate(ev) {
    if (!/^[a-v0-9]{5,1024}$/.test(ev.id)) throw apiError(400, 'invalid', 'Invalid resource id value.');
    if (!ev.start || !ev.end) throw apiError(400, 'required', 'Missing end time.');
    const both = e => (e.dateTime ? 1 : 0) + (e.date ? 1 : 0);
    if (both(ev.start) !== 1 || both(ev.end) !== 1) throw apiError(400, 'invalid', 'Start and end must each have exactly one of date or dateTime.');
    if (!!ev.start.date !== !!ev.end.date) throw apiError(400, 'invalid', 'Start and end must both be dates or both be dateTimes.');
    ['start', 'end'].forEach(k => {
      const e = ev[k];
      if (e.dateTime && !/[zZ]|[+-]\d{2}:\d{2}$/.test(e.dateTime) && !e.timeZone) throw apiError(400, 'invalid', 'A time zone offset is required unless a time zone is explicitly specified in timeZone.');
    });
    if (edgeMs(ev.end) <= edgeMs(ev.start)) throw apiError(400, 'timeRangeEmpty', 'The specified time range is empty.');
    if (ev.recurrence && ev.start.dateTime && !ev.start.timeZone) throw apiError(400, 'invalid', 'Recurring events require start.timeZone.');
    (ev.recurrence || []).forEach(r => { if (!/^(RRULE|EXRULE|RDATE|EXDATE)[:;]/.test(r)) throw apiError(400, 'invalid', 'Invalid recurrence rule.'); });
    if (ev.colorId && !/^([1-9]|1[01])$/.test(ev.colorId)) throw apiError(400, 'invalid', 'Invalid color id.');
    if (ev.transparency && !['opaque', 'transparent'].includes(ev.transparency)) throw apiError(400, 'invalid', 'Invalid transparency.');
    const props = ev.extendedProperties || {};
    ['private', 'shared'].forEach(scope => Object.entries(props[scope] || {}).forEach(([k, v]) => {
      if (k.length > 44 || String(v).length > 1024) throw apiError(400, 'invalid', 'Extended property key or value too long.');
    }));
  }

  function stamp(c, ev) {
    version++;
    c.ver.set(ev.id, version);
    ev.updated = nowIso();
    ev.etag = `"${version}${String(Date.now()).slice(-6)}"`;
  }
  const clone = o => JSON.parse(JSON.stringify(o));
  function write(method, path, body) {
    if (!silent && onWrite) onWrite(method, path, body);
  }
  // שינוי שנעשה באפליקציה (לא כזה שהגיע מגוגל). שכבת הסנכרון שולחת אותו לגוגל.
  function mutate(op, calendarId, eventId, body) {
    if (!silent && !applyingRemote && onMutate) onMutate({ op, calendarId, eventId, body: body ? clone(body) : null });
  }
  function trace(name, http, path, detail) {
    if (!silent && onCall) onCall({ name, http, path, detail: detail || '' });
  }

  /* ---------- הרחבת אירועים חוזרים (singleEvents=true) ----------
     תומך במה שתמימה יכולה ליצור ביומן גוגל: יומי, שבועי (כל N שבועות, ימים נבחרים), חודשי,
     שנתי, אירוע של יום שלם, EXDATE, ומופע בודד ששונה או נמחק (exIds: מזהי מופעים חריגים). */
  const DOW = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  const DAY_MS = 864e5;
  function expand(ev, minMs, maxMs, exIds) {
    const rule = (ev.recurrence || []).find(r => r.startsWith('RRULE:'));
    if (!rule) return [ev];
    const p = Object.fromEntries(rule.slice(6).split(';').map(x => x.split('=')));
    if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(p.FREQ)) return [ev];
    const allDay = !!ev.start.date;
    const startWall = allDay ? `${ev.start.date}T00:00:00` : ev.start.dateTime.slice(0, 19);
    const tz = ev.start.timeZone || TZ;
    const dur = edgeMs(ev.end) - edgeMs(ev.start);
    const interval = Math.max(1, Number(p.INTERVAL) || 1);
    const ex = new Set((ev.recurrence || []).filter(r => r.startsWith('EXDATE')).flatMap(r => r.split(':')[1].split(',')).map(v => v.replace(/Z$/, '')));
    const until = p.UNTIL ? Date.parse(p.UNTIL.replace(/^(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?(\d{2})?Z?$/, (m, y, mo, d, h = '23', mi = '59', s = '59') => `${y}-${mo}-${d}T${h}:${mi}:${s}Z`)) : Infinity;
    const count = p.COUNT ? Number(p.COUNT) : Infinity;
    const [y, mo, d] = startWall.slice(0, 10).split('-').map(Number);
    const time = startWall.slice(11);
    const startDow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
    const byDay = (p.BYDAY || '').split(',').filter(Boolean).map(x => DOW[x.slice(-2)]).filter(x => x != null);
    const days = byDay.length ? byDay : [startDow];
    const mdays = p.BYMONTHDAY ? p.BYMONTHDAY.split(',').map(Number) : [d];
    const s0 = wallToMs(startWall);
    // בלי COUNT אפשר לדלג קדימה עד קרוב לטווח המבוקש
    let iStart = 0;
    if (!p.COUNT && minMs > s0) iStart = Math.max(0, Math.floor((minMs - s0 - dur) / DAY_MS) - 7);
    const out = [];
    let n = 0;
    for (let i = iStart; i < iStart + 3700 && n < count; i++) {
      const day = new Date(Date.UTC(y, mo - 1, d + i));
      const dy = day.getUTCFullYear(), dm = day.getUTCMonth(), dd = day.getUTCDate(), dw = day.getUTCDay();
      let hit;
      if (p.FREQ === 'DAILY') hit = i % interval === 0;
      else if (p.FREQ === 'WEEKLY') hit = days.includes(dw) && Math.floor((i + startDow) / 7) % interval === 0;
      else if (p.FREQ === 'MONTHLY') hit = mdays.includes(dd) && (((dy - y) * 12 + dm - (mo - 1)) % interval === 0);
      else hit = dm === mo - 1 && dd === d && (dy - y) % interval === 0;
      if (!hit) continue;
      const dateStr = `${dy}-${pad(dm + 1)}-${pad(dd)}`;
      const wall = `${dateStr}T${time}`;
      const s = wallToMs(wall);
      if (s > until) break;
      n++;
      if (s >= maxMs) break;
      if (s + dur <= minMs) continue;
      const basic = wall.replace(/[-:]/g, '');
      if (ex.has(basic) || ex.has(basic.slice(0, 8))) continue;
      const instId = allDay ? `${ev.id}_${basic.slice(0, 8)}` : `${ev.id}_${utcBasic(s)}`;
      if (exIds && exIds.has(instId)) continue; // המופע הזה שונה או נמחק, והחריג שלו מגיע כאירוע נפרד
      const inst = clone(ev);
      delete inst.recurrence;
      inst.id = instId;
      inst.recurringEventId = ev.id;
      if (allDay) {
        inst.originalStartTime = { date: dateStr };
        inst.start = { date: dateStr };
        inst.end = { date: msToWall(s + dur).slice(0, 10) };
      } else {
        inst.originalStartTime = { dateTime: wall, timeZone: tz };
        inst.start = { dateTime: wall, timeZone: tz };
        inst.end = { dateTime: msToWall(s + dur), timeZone: ev.end.timeZone || tz };
      }
      out.push(inst);
    }
    return out;
  }
  // מזהי מופעים חריגים לכל אירוע חוזר ביומן
  function exceptionIds(c) {
    const map = new Map();
    c.events.forEach(e => { if (e.recurringEventId) { if (!map.has(e.recurringEventId)) map.set(e.recurringEventId, new Set()); map.get(e.recurringEventId).add(e.id); } });
    return map;
  }

  /* ---------- events ---------- */
  const events = {
    list({ calendarId, timeMin, timeMax, singleEvents = false, orderBy, showDeleted = false, syncToken, privateExtendedProperty } = {}) {
      trace('events.list', 'GET', `/calendars/${calendarId}/events`, syncToken ? `syncToken=${syncToken}` : [timeMin && `timeMin=${timeMin.slice(0, 10)}`, timeMax && `timeMax=${timeMax.slice(0, 10)}`, singleEvents && 'singleEvents'].filter(Boolean).join(' '));
      const c = cal(calendarId);
      if (orderBy === 'startTime' && !singleEvents) throw apiError(400, 'badRequest', 'The requested ordering is not available for the particular query.');
      if (syncToken && (timeMin || timeMax || orderBy)) throw apiError(400, 'badRequest', 'syncToken cannot be combined with timeMin, timeMax or orderBy.');
      let items = [...c.events.values()];
      const exc = exceptionIds(c);
      if (syncToken) {
        items = items.filter(e => c.ver.get(e.id) > Number(syncToken));
      } else {
        if (!showDeleted) items = items.filter(e => e.status !== 'cancelled');
        if (privateExtendedProperty) {
          const [k, v] = privateExtendedProperty.split('=');
          items = items.filter(e => ((e.extendedProperties || {}).private || {})[k] === v);
        }
        const minMs = timeMin ? Date.parse(timeMin) : -Infinity;
        const maxMs = timeMax ? Date.parse(timeMax) : Infinity;
        if (singleEvents) items = items.flatMap(e => expand(e, minMs, maxMs, exc.get(e.id)));
        items = items.filter(e => edgeMs(e.end) > minMs && edgeMs(e.start) < maxMs);
        if (orderBy === 'startTime') items.sort((a, b) => edgeMs(a.start) - edgeMs(b.start));
      }
      return { kind: 'calendar#events', summary: c.summary, timeZone: c.timeZone, updated: nowIso(), items: clone(items), nextSyncToken: String(version) };
    },
    get({ calendarId, eventId }) {
      trace('events.get', 'GET', `/calendars/${calendarId}/events/${eventId}`);
      const e = cal(calendarId).events.get(eventId);
      if (!e) throw apiError(404, 'notFound', 'Not Found');
      return clone(e);
    },
    insert({ calendarId, requestBody, sendUpdates = 'none' }) {
      trace('events.insert', 'POST', `/calendars/${calendarId}/events`, requestBody && requestBody.summary);
      const c = cal(calendarId);
      const ev = Object.assign({ id: newId(), status: 'confirmed', transparency: 'opaque', visibility: 'default', reminders: { useDefault: true } }, clone(requestBody));
      validate(ev);
      if (c.events.has(ev.id) && c.events.get(ev.id).status !== 'cancelled') throw apiError(409, 'duplicate', 'The requested identifier already exists.');
      const createdAt = nowIso();
      Object.assign(ev, { kind: 'calendar#event', created: createdAt, iCalUID: `${ev.id}@google.com`, sequence: 0, organizer: { email: calendarId, self: true } });
      stamp(c, ev);
      c.events.set(ev.id, ev);
      write('POST', `/calendars/${calendarId}/events`, { sendUpdates, ...requestBody, id: ev.id });
      mutate('insert', calendarId, ev.id, ev);
      return clone(ev);
    },
    patch({ calendarId, eventId, requestBody }) {
      trace('events.patch', 'PATCH', `/calendars/${calendarId}/events/${eventId}`, Object.keys(requestBody || {}).join(', '));
      const c = cal(calendarId);
      const cur = c.events.get(eventId);
      if (!cur || cur.status === 'cancelled') throw apiError(404, 'notFound', 'Not Found');
      const next = Object.assign(clone(cur), clone(requestBody));
      if (requestBody.extendedProperties) {
        next.extendedProperties = {
          private: Object.assign({}, (cur.extendedProperties || {}).private, (requestBody.extendedProperties || {}).private),
          shared: Object.assign({}, (cur.extendedProperties || {}).shared, (requestBody.extendedProperties || {}).shared)
        };
      }
      validate(next);
      next.sequence = (cur.sequence || 0) + (requestBody.start || requestBody.end ? 1 : 0);
      stamp(c, next);
      c.events.set(eventId, next);
      write('PATCH', `/calendars/${calendarId}/events/${eventId}`, requestBody);
      mutate('patch', calendarId, eventId, requestBody);
      return clone(next);
    },
    delete({ calendarId, eventId }) {
      trace('events.delete', 'DELETE', `/calendars/${calendarId}/events/${eventId}`);
      const c = cal(calendarId);
      const cur = c.events.get(eventId);
      if (!cur || cur.status === 'cancelled') throw apiError(410, 'deleted', 'Resource has been deleted');
      cur.status = 'cancelled'; // נשאר עם status=cancelled כדי שסנכרון מצטבר (syncToken) יראה את המחיקה
      stamp(c, cur);
      write('DELETE', `/calendars/${calendarId}/events/${eventId}`, null);
      mutate('delete', calendarId, eventId, null);
    }
  };

  /* ---------- freebusy ---------- */
  const freebusy = {
    query({ requestBody }) {
      const { timeMin, timeMax, items = [] } = requestBody;
      trace('freebusy.query', 'POST', '/freeBusy', `${items.map(i => calendarName(i.id)).join(' + ')} · ${(timeMin || '').slice(0, 10)} עד ${(timeMax || '').slice(0, 10)}`);
      if (!timeMin || !timeMax) throw apiError(400, 'required', 'Missing timeMin or timeMax.');
      const minMs = Date.parse(timeMin), maxMs = Date.parse(timeMax);
      const out = {};
      items.forEach(({ id }) => {
        const c = calendars[id];
        if (!c) { out[id] = { errors: [{ domain: 'global', reason: 'notFound' }], busy: [] }; return; }
        const exc = exceptionIds(c);
        const busy = [...c.events.values()]
          .filter(e => e.status !== 'cancelled' && (e.transparency || 'opaque') === 'opaque')
          .flatMap(e => expand(e, minMs, maxMs, exc.get(e.id)))
          .map(e => [Math.max(minMs, edgeMs(e.start)), Math.min(maxMs, edgeMs(e.end))])
          .filter(([s, e]) => e > s)
          .sort((a, b) => a[0] - b[0]);
        const merged = [];
        busy.forEach(([s, e]) => { const last = merged[merged.length - 1]; if (last && s <= last[1]) last[1] = Math.max(last[1], e); else merged.push([s, e]); });
        out[id] = { busy: merged.map(([s, e]) => ({ start: new Date(s).toISOString(), end: new Date(e).toISOString() })) };
      });
      return { kind: 'calendar#freeBusy', timeMin, timeMax, calendars: out };
    }
  };

  /* ---------- calendars ---------- */
  const calendarsApi = {
    insert({ requestBody } = {}) {
      trace('calendars.insert', 'POST', '/calendars', requestBody && requestBody.summary);
      if (!requestBody || !requestBody.summary) throw apiError(400, 'required', 'Missing title.');
      const id = `${newId()}@group.calendar.google.com`;
      const c = makeCal(id, requestBody.summary, requestBody.timeZone || TZ, requestBody.description);
      version++;
      write('POST', '/calendars', { id, summary: c.summary, timeZone: c.timeZone });
      return calResource(c);
    },
    get({ calendarId }) {
      trace('calendars.get', 'GET', `/calendars/${calendarId}`);
      return calResource(cal(calendarId));
    },
    patch({ calendarId, requestBody }) {
      trace('calendars.patch', 'PATCH', `/calendars/${calendarId}`);
      const c = cal(calendarId);
      ['summary', 'description'].forEach(k => { if (requestBody[k] != null) c[k] = requestBody[k]; });
      version++;
      write('PATCH', `/calendars/${calendarId}`, requestBody);
      return calResource(c);
    }
  };

  /* =========================================================
   * ערוצי שיווק: שכבה מעל ה-API
   * כל פעולה כאן עוברת רק דרך calendars.* / events.* / freebusy.query, כך שהיא תעבוד
   * זהה מול גוגל. בגרסה האמיתית tick() רץ בשרת כעבודה מתוזמנת (למשל כל שעה).
   *
   * כללים:
   *   - לכל ערוץ יומן משלו. כל משבצת פנויה שייכת לערוץ אחד בלבד
   *     (extendedProperties.private.channel) ונכתבת רק ליומן שלו.
   *   - הזמנה בכל ערוץ מוחקת את המשבצת מכל היומנים (book).
   *   - משבצת שלא נמכרה בערוץ שותף יורדת ממנו releaseDays לפני המועד, ואחרי
   *     bufferHours נפתחת באתר של תמימה (ערוץ הבית).
   *   - זמן תפוס ביומן הסטודיו או ביומן האישי לא מוצע באף ערוץ.
   *   - זמן פנוי שלא שייך לאף ערוץ נפתח באתר של תמימה.
   * ========================================================= */
  const DAY = 864e5, HOUR = 36e5;
  const HOME = 'site';
  const slotCfg = { times: {}, minutes: 120, horizonDays: 21, location: '' };
  let channelList = [], releaseQueue = [];
  // משבצות שירדו כי הזמן נתפס (למשל אירוע אישי). אם הזמן מתפנה, המשבצת חוזרת לערוץ שלה
  let displaced = [];

  function defaultChannels() {
    const t = nowIso();
    return [
      // ערוץ הבית: אין לו שחרור והמתנה (אליו חוזרות משבצות), אבל יש לו הגדרות משלו
      { id: HOME, name: 'האתר של תמימה', calendarId: 'site.slots.tamima@group.calendar.google.com', commission: 0, releaseDays: null, bufferHours: null, home: true,
        horizonDays: 21, minNoticeHours: 24, autoFill: true, slotTimes: null, travelMinutes: 0 },
      { id: 'salon', name: 'בסלון', calendarId: 'salon.slots.tamima@group.calendar.google.com', commission: 10, releaseDays: 5, bufferHours: 24 }
    ].map(ch => Object.assign({ status: 'active', createdAt: t, deactivatedAt: null, history: [{ at: t, action: 'נוצר' }] }, ch));
  }
  const chById = id => channelList.find(c => c.id === id);
  const copy = ch => ch && Object.assign({}, ch, { history: ch.history.slice() });
  const slotEndWall = (date, time) => msToWall(wallToMs(`${date}T${time}:00`) + slotCfg.minutes * 6e4);
  // שעות ברירת המחדל לסדנה: של ערוץ הבית אם הוגדרו, אחרת של ההגדרה הכללית
  const homeTimes = () => { const h = chById(HOME); return (h && h.slotTimes) || slotCfg.times; };
  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

  // צבעי גוגל: משבצת פנויה באתר = מרווה (ירוק בהיר), משבצת של ערוץ שותף = בננה (צהוב).
  // צבעים חזקים שמורים לתפוס: חוג = כחול, סדנה מהאתר = כתום, סדנה מערוץ = סגול, חסימה = אפור.
  const slotColor = ch => ch.home ? '2' : '5';
  const CLASS_COLOR = '9';

  function slotBody(date, time, ch, auto) {
    return {
      summary: `משבצת פנויה לסדנה · ${ch.name}`,
      description: 'משבצת פנויה בסטודיו של תמימה. כשהיא נתפסת היא יורדת מכל היומנים.',
      location: slotCfg.location,
      colorId: slotColor(ch),
      transparency: 'transparent',
      start: { dateTime: `${date}T${time}:00`, timeZone: TZ },
      end: { dateTime: slotEndWall(date, time), timeZone: TZ },
      // auto=true: נפתחה במילוי אוטומטי, ולכן תיסגר אוטומטית אם ההגדרות של ערוץ הבית משתנות
      extendedProperties: { private: Object.assign({ app: 'tamima-studio', kind: 'slot', channel: ch.id }, auto ? { auto: 'true' } : {}) }
    };
  }

  // זמן תפוס: freebusy על יומן הסטודיו, יומן החוגים והיומן האישי. מחזיר גם פירוק לפי יומן.
  function busyBetween(minMs, maxMs) {
    const items = [{ id: CAL.studio }, { id: CAL.classes }, { id: CAL.personal }].concat(calendars[CAL.remoteBusy] ? [{ id: CAL.remoteBusy }] : []);
    const fb = freebusy.query({ requestBody: { timeMin: new Date(minMs).toISOString(), timeMax: new Date(maxMs).toISOString(), timeZone: TZ, items } });
    const byCal = {};
    const all = [];
    const home = chById(HOME);
    const travel = ((home && home.travelMinutes) || 0) * 6e4;
    Object.entries(fb.calendars).forEach(([id, v]) => {
      byCal[id] = (v.busy || []).map(b => [Date.parse(b.start), Date.parse(b.end)]);
      all.push(...(id === CAL.personal && travel ? byCal[id].map(([a, b]) => [a - travel, b + travel]) : byCal[id]));
    });
    return { all, byCal };
  }
  const hits = (list, s, e) => list.some(([a, b]) => s < b && a < e);

  // כל המשבצות בכל יומני הערוצים בטווח
  function slotsBetween(minMs, maxMs) {
    const out = [];
    channelList.forEach(ch => {
      events.list({ calendarId: ch.calendarId, timeMin: new Date(minMs).toISOString(), timeMax: new Date(maxMs).toISOString(), singleEvents: true, orderBy: 'startTime' })
        .items.filter(ev => ((ev.extendedProperties || {}).private || {}).kind === 'slot')
        .forEach(ev => {
          const s = edgeMs(ev.start), w = msToWall(s);
          out.push({ channel: ch.id, calendarId: ch.calendarId, eventId: ev.id, date: w.slice(0, 10), time: w.slice(11, 16), s, e: edgeMs(ev.end), event: ev });
        });
    });
    return out.sort((a, b) => a.s - b.s);
  }

  function removeSlots(list) {
    list.forEach(x => events.delete({ calendarId: x.calendarId, eventId: x.eventId }));
  }

  const channels = {
    list: () => channelList.map(copy),
    get: id => copy(chById(id)),
    active: () => channelList.filter(c => c.status === 'active').map(copy),
    pending: () => releaseQueue.slice(),
    displaced: () => displaced.map(d => Object.assign({}, d)),
    configure(cfg) { Object.assign(slotCfg, cfg); },
    slotTimes: () => JSON.parse(JSON.stringify(homeTimes())),
    slotMinutes: () => slotCfg.minutes,

    // ערוץ חדש = יומן חדש בגוגל
    addChannel(name, opts = {}) {
      name = String(name || '').trim();
      if (!name) throw apiError(400, 'required', 'Missing channel name.');
      const c = calendarsApi.insert({ requestBody: { summary: `הסטודיו של תמימה · ${name}`, timeZone: TZ, description: 'משבצות פנויות לסדנאות. משותף עם הערוץ.' } });
      const t = nowIso();
      const ch = {
        id: `ch${newId().slice(0, 8)}`, name, calendarId: c.id, status: 'active',
        commission: opts.commission != null ? opts.commission : 10,
        releaseDays: opts.releaseDays != null ? opts.releaseDays : 5,
        bufferHours: opts.bufferHours != null ? opts.bufferHours : 24,
        createdAt: t, deactivatedAt: null, history: [{ at: t, action: 'נוצר' }]
      };
      channelList.push(ch);
      return copy(ch);
    },

    // לא מוחקים ערוץ: מסמנים "לא פעיל", שומרים את היומן וההיסטוריה, ומחזירים משבצות עתידיות לאתר
    deactivateChannel(id) {
      const ch = chById(id);
      if (!ch) throw apiError(404, 'notFound', 'Channel not found.');
      if (ch.home) throw apiError(400, 'invalid', 'The home channel cannot be deactivated.');
      if (ch.status === 'inactive') return copy(ch);
      const now = clock.now().getTime();
      const future = slotsBetween(now, now + 120 * DAY).filter(x => x.channel === id);
      removeSlots(future);
      future.forEach(x => releaseQueue.push({ id: newId(), date: x.date, time: x.time, from: id, releasedAt: now, publishAt: now, reason: 'deactivated' }));
      ch.status = 'inactive';
      ch.deactivatedAt = nowIso();
      ch.history.push({ at: ch.deactivatedAt, action: 'סומן לא פעיל', slotsReturned: future.length });
      calendarsApi.patch({ calendarId: ch.calendarId, requestBody: { description: `הערוץ לא פעיל מאז ${ch.deactivatedAt.slice(0, 10)}. היומן נשמר לצורך היסטוריה.` } });
      return copy(ch);
    },

    update(id, patch) {
      const ch = chById(id);
      if (!ch) throw apiError(404, 'notFound', 'Channel not found.');
      // לכל סוג ערוץ השדות שרלוונטיים לו
      const fields = ch.home
        ? ['name', 'commission', 'horizonDays', 'minNoticeHours', 'autoFill', 'slotTimes', 'travelMinutes']
        : ['name', 'commission', 'releaseDays', 'bufferHours'];
      const changed = {};
      fields.forEach(k => {
        if (patch[k] === undefined) return;
        let v = patch[k];
        if (k === 'name') { v = String(v).trim(); if (!v) throw apiError(400, 'required', 'Missing channel name.'); }
        else if (k === 'autoFill') v = !!v;
        else if (k === 'slotTimes') {
          const out = {};
          for (let d = 0; d < 7; d++) {
            const list = [...new Set((v[d] || []).map(String))].sort();
            if (list.some(t => !TIME_RE.test(t))) throw apiError(400, 'invalid', 'Invalid time. Use HH:MM.');
            out[d] = list;
          }
          v = out;
        } else {
          v = Number(v);
          if (!(v >= 0)) throw apiError(400, 'invalid', `Invalid value for ${k}.`);
          if (k === 'horizonDays') v = Math.min(90, Math.max(1, Math.round(v)));
          if (k === 'commission') v = Math.min(100, v);
          if (k === 'travelMinutes') v = Math.min(240, Math.round(v));
        }
        if (JSON.stringify(v) !== JSON.stringify(ch[k])) { ch[k] = v; changed[k] = v; }
      });
      if (changed.name) calendarsApi.patch({ calendarId: ch.calendarId, requestBody: { summary: `הסטודיו של תמימה · ${ch.name}` } });
      if (Object.keys(changed).length) ch.history.push({ at: nowIso(), action: 'עודכן', changed });
      return copy(ch);
    },

    slots: (minMs, maxMs) => slotsBetween(minMs, maxMs),
    busy: (minMs, maxMs) => busyBetween(minMs, maxMs),

    // שיוך משבצת לערוץ אחד בלבד: נמחקת מכל יומן אחר ונכתבת רק ליומן הערוץ
    assign(date, time, channelId) {
      const ch = chById(channelId);
      if (!ch || ch.status !== 'active') throw apiError(400, 'invalid', 'Channel is not active.');
      const s = wallToMs(`${date}T${time}:00`), e = s + slotCfg.minutes * 6e4;
      if (hits(busyBetween(s, e).all, s, e)) throw apiError(409, 'conflict', 'The time is busy.');
      removeSlots(slotsBetween(s, e).filter(x => x.s < e && s < x.e));
      releaseQueue = releaseQueue.filter(q => { const qs = wallToMs(`${q.date}T${q.time}:00`); return !(qs < e && s < qs + slotCfg.minutes * 6e4); });
      displaced = displaced.filter(d => !(d.s < e && s < d.e));
      return events.insert({ calendarId: ch.calendarId, requestBody: slotBody(date, time, ch) });
    },

    // הזמנה בכל ערוץ: המשבצת נמחקת מכל היומנים
    book(date, time) {
      const s = wallToMs(`${date}T${time}:00`), e = s + slotCfg.minutes * 6e4;
      const found = slotsBetween(s, e).filter(x => x.s < e && s < x.e);
      removeSlots(found);
      releaseQueue = releaseQueue.filter(q => { const qs = wallToMs(`${q.date}T${q.time}:00`); return !(qs < e && s < qs + slotCfg.minutes * 6e4); });
      displaced = displaced.filter(d => !(d.s < e && s < d.e));
      return found.map(x => ({ channel: x.channel, eventId: x.eventId }));
    },

    publishNow(queueId) {
      const q = releaseQueue.find(x => x.id === queueId);
      if (q) q.publishAt = clock.now().getTime();
      return channels.tick();
    },

    // העבודה המתוזמנת: שחרור, פתרון התנגשויות, פתיחה באתר ומילוי משבצות
    tick() {
      const now = clock.now().getTime();
      const home = chById(HOME);
      const horizon = home.horizonDays != null ? home.horizonDays : slotCfg.horizonDays;
      const times = homeTimes();
      const until = now + (horizon + 1) * DAY;
      const actions = [];
      let slots = slotsBetween(now, until + 60 * DAY);
      const busy = busyBetween(now, until + 60 * DAY).all;

      // 1. שחרור מערוצים שותפים releaseDays לפני המועד
      slots.filter(x => { const ch = chById(x.channel); return !ch.home && ch.status === 'active' && ch.releaseDays != null && x.s - ch.releaseDays * DAY <= now && x.s > now; })
        .forEach(x => {
          const ch = chById(x.channel);
          events.delete({ calendarId: x.calendarId, eventId: x.eventId });
          const q = { id: newId(), date: x.date, time: x.time, from: ch.id, releasedAt: now, publishAt: now + ch.bufferHours * HOUR, reason: 'release' };
          releaseQueue.push(q);
          actions.push({ type: 'release', channel: ch.id, date: x.date, time: x.time, publishAt: q.publishAt });
        });
      slots = slots.filter(x => !actions.some(a => a.type === 'release' && a.date === x.date && a.time === x.time));

      // 2. משבצת שהזמן שלה נתפס (סטודיו או אישי) יורדת מכל ערוץ
      slots.filter(x => x.s > now && hits(busy, x.s, x.e)).forEach(x => {
        events.delete({ calendarId: x.calendarId, eventId: x.eventId });
        actions.push({ type: 'conflict', channel: x.channel, date: x.date, time: x.time });
        if (!displaced.some(d => d.s === x.s)) displaced.push({ channel: x.channel, date: x.date, time: x.time, s: x.s, e: x.e, auto: ((x.event && x.event.extendedProperties || {}).private || {}).auto === 'true' });
      });
      slots = slots.filter(x => !(x.s > now && hits(busy, x.s, x.e)));

      // 2א. משבצת שצבעה לא תואם לסוג שלה (למשל מגרסה קודמת) מקבלת את הצבע הנכון, גם בגוגל
      slots.filter(x => x.s > now && x.event && x.event.colorId !== slotColor(chById(x.channel)))
        .forEach(x => events.patch({ calendarId: x.calendarId, eventId: x.eventId, requestBody: { colorId: slotColor(chById(x.channel)) } }));
      // גם החוגים: העברה בין יומנים בגוגל (events.move) מוחקת את צבע האירוע
      [...calendars[CAL.classes].events.values()].filter(e => e.status !== 'cancelled' && !e.recurringEventId && ((e.extendedProperties || {}).private || {}).kind === 'class' && e.colorId !== CLASS_COLOR)
        .forEach(e => events.patch({ calendarId: CAL.classes, eventId: e.id, requestBody: { colorId: CLASS_COLOR } }));

      // 2ב. משבצת שירדה כי הזמן נתפס, והזמן התפנה: חוזרת לערוץ שממנו ירדה, באותם תנאים
      displaced = displaced.filter(d => {
        const ch = chById(d.channel);
        if (d.s <= now || !ch || ch.status !== 'active') return false;
        if (!ch.home && ch.releaseDays != null && d.s - ch.releaseDays * DAY <= now) return false; // כבר בזמן השחרור: האתר ימלא לפי הכללים הרגילים
        if (hits(busy, d.s, d.e)) return true;                                                     // עדיין תפוס: ממשיכים לחכות
        if (slots.some(x => x.s < d.e && d.s < x.e)) return false;                                 // הזמן כבר שייך למשבצת אחרת
        const ev = events.insert({ calendarId: ch.calendarId, requestBody: slotBody(d.date, d.time, ch, d.auto) });
        slots.push({ channel: ch.id, calendarId: ch.calendarId, eventId: ev.id, date: d.date, time: d.time, s: d.s, e: d.e, event: ev });
        actions.push({ type: 'restore', channel: ch.id, date: d.date, time: d.time });
        return false;
      });

      // 3. פתיחה באתר אחרי תקופת ההמתנה
      releaseQueue = releaseQueue.filter(q => {
        const s = wallToMs(`${q.date}T${q.time}:00`), e = s + slotCfg.minutes * 6e4;
        if (s <= now || hits(busy, s, e)) { actions.push({ type: 'expired', channel: q.from, date: q.date, time: q.time }); return false; }
        if (q.publishAt > now) return true;
        if (!slots.some(x => x.s < e && s < x.e)) {
          const ev = events.insert({ calendarId: home.calendarId, requestBody: slotBody(q.date, q.time, home) });
          slots.push({ channel: HOME, calendarId: home.calendarId, eventId: ev.id, date: q.date, time: q.time, s, e });
          actions.push({ type: 'publish', channel: q.from, date: q.date, time: q.time, reason: q.reason });
        }
        return false;
      });

      // 4. משבצות שנפתחו אוטומטית באתר ולא מתאימות יותר להגדרות ערוץ הבית נסגרות
      //    (מילוי אוטומטי כבוי, מעבר לטווח הימים, או שעה שהוסרה). משבצות שתמימה פתחה ידנית נשארות.
      const lastDate = msToWall(now + horizon * DAY).slice(0, 10);
      const stale = slots.filter(x => x.channel === HOME && x.s > now && x.event && ((x.event.extendedProperties || {}).private || {}).auto === 'true' && (
        !home.autoFill || x.date > lastDate || !(times[new Date(`${x.date}T12:00:00Z`).getUTCDay()] || []).includes(x.time)));
      removeSlots(stale);
      if (stale.length) actions.push({ type: 'prune', channel: HOME, count: stale.length });
      slots = slots.filter(x => !stale.includes(x));

      // 5. זמן פנוי שלא שייך לאף ערוץ נפתח באתר (אם המילוי האוטומטי פעיל)
      let filled = 0;
      for (let i = 0; home.autoFill && i <= horizon; i++) {
        const date = msToWall(now + i * DAY).slice(0, 10);
        const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
        (times[dow] || []).forEach(time => {
          const s = wallToMs(`${date}T${time}:00`), e = s + slotCfg.minutes * 6e4;
          if (s <= now || hits(busy, s, e) || slots.some(x => x.s < e && s < x.e)) return;
          if (releaseQueue.some(q => { const qs = wallToMs(`${q.date}T${q.time}:00`); return qs < e && s < qs + slotCfg.minutes * 6e4; })) return;
          const ev = events.insert({ calendarId: home.calendarId, requestBody: slotBody(date, time, home, true) });
          slots.push({ channel: HOME, calendarId: home.calendarId, eventId: ev.id, date, time, s, e, event: ev });
          filled++;
        });
      }
      if (filled) actions.push({ type: 'fill', channel: HOME, count: filled });
      return actions;
    }
  };

  /* ---------- שעון מדומה (לכפתור "קדם זמן" בדמו) ---------- */
  const clock = {
    offset: 0,
    now() { return new Date(Date.now() + this.offset); },
    advance(hours) { this.offset += hours * HOUR; return this.now(); }
  };
  function nowIso() { return clock.now().toISOString(); }

  // לשימוש שכבת הסנכרון (gsync.js) בלבד: החלת שינויים שהגיעו מגוגל, בלי לשלוח אותם חזרה
  const internal = {
    remote(fn) { applyingRemote = true; try { return fn(); } finally { applyingRemote = false; } },
    upsertRaw(calendarId, ev) {
      const c = calendars[calendarId];
      if (!c) return;
      version++;
      if (ev.status === 'cancelled') {
        const cur = c.events.get(ev.id);
        if (cur) { cur.status = 'cancelled'; c.ver.set(ev.id, version); }
        else if (ev.recurringEventId) { c.events.set(ev.id, clone(ev)); c.ver.set(ev.id, version); }
        return;
      }
      c.events.set(ev.id, clone(ev));
      c.ver.set(ev.id, version);
    },
    rawEvents: calendarId => (calendars[calendarId] ? [...calendars[calendarId].events.values()].map(clone) : []),
    clearCalendar(calendarId) { const c = calendars[calendarId]; if (c) { c.events.clear(); c.ver.clear(); version++; } },
    ensureCalendar(id, summary) { if (!calendars[id]) { makeCal(id, summary); version++; } },
    dropCalendar(id) { if (calendars[id]) { delete calendars[id]; version++; } },
    hasCalendar: id => !!calendars[id],
    // שמירה בשרת: כל היומנים, הערוצים ותורי השחרור כנתונים פשוטים, וטעינה חזרה
    exportAll() {
      const cals = Object.values(calendars).filter(c => c.id !== CAL.remoteBusy).map(c => ({ id: c.id, summary: c.summary, description: c.description || '', timeZone: c.timeZone, events: [...c.events.values()].map(clone) }));
      return clone({ calendars: cals, channels: channelList, releaseQueue, displaced, slotCfg });
    },
    importAll(x) {
      if (!x || !Array.isArray(x.calendars)) return;
      const busy = calendars[CAL.remoteBusy];
      calendars = {};
      version++;
      x.calendars.forEach(c => {
        const cal = makeCal(c.id, c.summary, c.timeZone, c.description);
        (c.events || []).forEach(ev => { cal.events.set(ev.id, clone(ev)); cal.ver.set(ev.id, version); });
      });
      if (busy) calendars[CAL.remoteBusy] = busy;
      channelList = clone(x.channels || defaultChannels());
      releaseQueue = clone(x.releaseQueue || []);
      displaced = clone(x.displaced || []);
      if (x.slotCfg) Object.assign(slotCfg, clone(x.slotCfg));
    }
  };

  reset();
  window.GCal = {
    internal,
    set onMutate(fn) { onMutate = fn; },
    TZ, CAL, events, freebusy, calendars: calendarsApi, channels, clock, reset, b32hex, newId,
    rfc3339, wallToMs, msToWall, edgeMs, calendarName,
    version: () => version,
    set silent(v) { silent = v; },
    set onWrite(fn) { onWrite = fn; },
    set onCall(fn) { onCall = fn; }
  };
})();
