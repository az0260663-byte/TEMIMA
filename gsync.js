/*
 * gsync.js: חיבור אמיתי בין המערכת ליומן הגוגל של תמימה.
 *
 * איך זה עובד:
 *   1. התחברות: Google Identity Services (חלון ההתחברות של גוגל). תמימה מאשרת הרשאות, ומקבלים
 *      אסימון גישה זמני. האסימון נשמר בזיכרון בלבד (לא בדפדפן ולא בשרת), ונמחק בניתוק.
 *   2. הגדרה: בוחרים יומן קיים או יוצרים "הסטודיו של תמימה". לכל ערוץ שיווק נוצר יומן משני.
 *   3. סנכרון ראשון: מושכים את כל האירועים מגוגל, ומעלים לגוגל רק מה שנבחר (ברירת מחדל: חוגים
 *      ומשבצות. לא מעלים לקוחות מדומים של הדמו ליומן אמיתי).
 *   4. כתיבה: כל שינוי באפליקציה (GCal.onMutate) נכנס לתור ונשלח לגוגל לפי הסדר, עם ניסיונות חוזרים.
 *      מזהי האירועים זהים בשני הצדדים (מזהה שנוצר באפליקציה, בפורמט base32hex שגוגל מקבל).
 *   5. קריאה: כל דקה, וכשחוזרים לחלון, סנכרון מצטבר עם syncToken: רק מה שהשתנה בגוגל.
 *      שינוי שעשה ערוץ שותף ביומן שלו (למשל שינוי כותרת של משבצת ל"נתפס") מדווח לאפליקציה.
 *   6. זמינות: freebusy של היומן האישי (רק "תפוס", בלי פרטים) ושל יומן הסטודיו, כשכבת ביטחון.
 *
 * מה נשמר בדפדפן (localStorage): רק מזהי היומנים שנבחרו וכתובת החשבון, כדי לא לשאול שוב.
 * האסימון לא נשמר. אחרי רענון הדף או כשהאסימון פג (כשעה) צריך ללחוץ "התחברות מחדש".
 *
 * דורש: מזהה לקוח OAuth של Google בקובץ config.js. הוראות: GOOGLE-CALENDAR-SETUP.md
 */
(function () {
  'use strict';
  const G = window.GCal;
  const CFG = window.TAMIMA_CONFIG || {};
  const API = 'https://www.googleapis.com/calendar/v3';
  // ההרשאות המינימליות שנדרשות (עקרון צמצום הרשאות)
  const SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',               // אירועים ביומן הסטודיו
    'https://www.googleapis.com/auth/calendar.app.created',          // יצירת יומני הערוצים וניהולם
    'https://www.googleapis.com/auth/calendar.calendarlist.readonly', // רשימת היומנים לבחירה
    'https://www.googleapis.com/auth/calendar.freebusy'              // זמינות מהיומן האישי, בלי פרטים
  ];
  // שליחת מיילים מהחשבון המחובר. לא חובה: בלי ההרשאה הזו היומן עובד, והמיילים רק מוצגים בדמו.
  const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
  const GMAIL_SEND = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
  const STORE = 'tamima.gcal.v1';
  // שינוי במערכת נשלח לגוגל מיד. שינוי שנעשה בגוגל נקלט כל 30 שניות, וגם כשחוזרים ללשונית.
  // קליטה מיידית ממש מגוגל דורשת שרת שמקבל התראות (events.watch), ולכן היא בגרסה האמיתית.
  const SYNC_MS = 30 * 1000;
  const onVisible = () => { if (document.visibilityState === 'visible') syncNow(); };
  const DAY = 864e5;
  const FB_WINDOW = 56 * DAY;
  // הודעות השגיאה של גוגל באנגלית; מציגים לתמימה הודעה בעברית
  const HE_ERR = { 400: 'גוגל דחתה את הבקשה.', 403: 'אין הרשאה לפעולה הזו בחשבון גוגל.', 404: 'הפריט לא נמצא ביומן גוגל.', 409: 'הפריט כבר קיים ביומן גוגל.', 410: 'הפריט נמחק ביומן גוגל.' };
  const KEEP = ['id', 'summary', 'description', 'location', 'colorId', 'start', 'end', 'recurrence', 'transparency', 'visibility', 'extendedProperties', 'reminders', 'status', 'recurringEventId', 'originalStartTime'];

  const st = { gmail: false, status: 'off', error: '', account: '', map: {}, names: {}, tokens: {}, personal: true, queue: [], lastSync: 0, busy: false, upload: 'basic' };
  let token = null, tokenExp = 0, timer = null, flushing = false, retryT = null;
  const listeners = new Set();
  let onCallHook = null, onRemoteHook = null;
  let busySig = null; // חתימת הזמן התפוס האחרון מגוגל, כדי לזהות שינוי
  // שרת ההתחברות (server/server.js): null = עוד לא נבדק, false = אין שרת (דפדפן בלבד), אחרת המצב שלו
  let server = null, refreshing = null;

  const enc = encodeURIComponent;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const emit = () => listeners.forEach(fn => { try { fn(state()); } catch (e) { /* מאזין שנכשל לא עוצר את הסנכרון */ } });
  const clean = ev => Object.fromEntries(Object.entries(ev || {}).filter(([k]) => KEEP.includes(k)));
  const errFrom = (code, message, extra) => Object.assign(new Error(message), { code }, extra || {});

  function state() {
    return { status: st.status, error: st.error, account: st.account, busy: st.busy, pending: st.queue.length, lastSync: st.lastSync,
      gmail: st.gmail, personal: st.personal, calendars: Object.entries(st.map).map(([local, remote]) => ({ local, remote, name: st.names[remote] || '' })) };
  }
  function saved() { try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { return null; } }
  function persist() { try { localStorage.setItem(STORE, JSON.stringify({ map: st.map, names: st.names, account: st.account, upload: st.upload, uploaded: st.uploaded })); } catch (e) { /* מצב פרטי: פשוט לא נשמר */ } }

  /* ---------- התחברות ---------- */
  function loadGis() {
    return new Promise((res, rej) => {
      if (window.google && google.accounts && google.accounts.oauth2) return res();
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => res();
      s.onerror = () => rej(errFrom(0, 'לא הצלחנו לטעון את חלון ההתחברות של גוגל. בדקו את החיבור לאינטרנט.'));
      document.head.appendChild(s);
    });
  }
  // חייב לרוץ מתוך לחיצה של המשתמש, אחרת הדפדפן חוסם את החלון
  function requestToken(prompt) {
    return new Promise((res, rej) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CFG.googleClientId,
        scope: SCOPES.concat(GMAIL_SCOPE).join(' '),
        callback: r => {
          if (r.error) return rej(errFrom(401, 'ההתחברות לא הושלמה.'));
          if (!google.accounts.oauth2.hasGrantedAllScopes(r, ...SCOPES)) return rej(errFrom(403, 'לא אושרו כל הרשאות היומן. נסו שוב וסמנו את כל ההרשאות.'));
          st.gmail = google.accounts.oauth2.hasGrantedAllScopes(r, GMAIL_SCOPE);
          token = r.access_token;
          tokenExp = Date.now() + (Number(r.expires_in) - 60) * 1000;
          res();
        },
        error_callback: e => rej(errFrom(401, e && e.type === 'popup_closed' ? 'חלון ההתחברות נסגר לפני הסיום.' : 'חלון ההתחברות נחסם או נכשל.'))
      });
      client.requestAccessToken({ prompt });
    });
  }

  /* ---------- התחברות חד פעמית דרך השרת ----------
     תמימה מאשרת פעם אחת בכל מכשיר. השרת שומר את המפתח הקבוע אצלו, והדפדפן מקבל ממנו כרטיס כניסה זמני
     בכל פעם שצריך, בלי חלון של גוגל. כשאין שרת (למשל אתר סטטי בלבד), חוזרים להתחברות בדפדפן בלבד. */
  async function detectServer() {
    if (server !== null) return server;
    try {
      const r = await fetch('api/auth/status', { credentials: 'same-origin', cache: 'no-store' });
      const d = r.ok ? await r.json() : null;
      server = d && d.server && d.configured ? d : false;
    } catch (e) { server = false; }
    return server;
  }
  async function serverPost(path, body) {
    let r;
    try { r = await fetch('api/auth/' + path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Tamima': '1' }, body: JSON.stringify(body || {}) }); }
    catch (e) { throw errFrom(0, 'אין חיבור לשרת של הסטודיו כרגע.'); }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw errFrom(r.status, d.error || 'שגיאה בשרת של הסטודיו.', { reason: d.reason });
    return d;
  }
  function applyToken(d) {
    const granted = String(d.scope || '').split(/\s+/);
    if (!SCOPES.every(x => granted.includes(x))) throw errFrom(403, 'לא אושרו כל הרשאות היומן. נסו שוב וסמנו את כל ההרשאות.');
    st.gmail = granted.includes(GMAIL_SCOPE);
    token = d.access_token;
    tokenExp = Date.now() + (Number(d.expires_in) - 60) * 1000;
  }
  // חלון ההרשאה של גוגל (פעם אחת בכל מכשיר). הקוד שחוזר עובר לשרת, שמחליף אותו במפתח קבוע
  function requestCode() {
    return new Promise((res, rej) => {
      const client = google.accounts.oauth2.initCodeClient({
        client_id: CFG.googleClientId,
        scope: SCOPES.concat(GMAIL_SCOPE).join(' '),
        ux_mode: 'popup',
        callback: async r => {
          if (r.error) return rej(errFrom(401, 'ההתחברות לא הושלמה.'));
          try {
            const d = await serverPost('exchange', { code: r.code });
            applyToken(d);
            if (d.account) st.account = d.account;
            server.connected = true;
            res();
          } catch (e) { rej(e); }
        },
        error_callback: e => rej(errFrom(401, e && e.type === 'popup_closed' ? 'חלון ההתחברות נסגר לפני הסיום.' : 'חלון ההתחברות נחסם או נכשל.'))
      });
      client.requestCode();
    });
  }
  // כרטיס כניסה חדש מהשרת, בלי חלון. כמה בקשות במקביל מחכות לאותה קריאה
  function refreshFromServer() {
    if (!refreshing) {
      refreshing = serverPost('token').then(applyToken).catch(e => {
        if (e.code === 401) { server.connected = false; st.status = 'reauth'; emit(); throw errFrom(401, 'צריך להתחבר לגוגל שוב במכשיר הזה.', { reauth: true }); }
        throw e;
      }).finally(() => { refreshing = null; });
    }
    return refreshing;
  }
  const serverMode = () => !!(server && server.connected);

  /* ---------- קריאות ל-Google Calendar API ---------- */
  async function api(method, path, opts = {}) {
    if ((!token || Date.now() > tokenExp) && serverMode()) await refreshFromServer();
    if (!token || Date.now() > tokenExp) {
      st.status = 'reauth';
      emit();
      throw errFrom(401, 'פג תוקף החיבור לגוגל. לחצו "התחברות מחדש".', { reauth: true });
    }
    const url = (path.startsWith('https://') ? path : API + path) + (opts.query ? '?' + new URLSearchParams(opts.query) : '');
    if (onCallHook) onCallHook({ name: path.startsWith(GMAIL_SEND) ? 'gmail.send' : `google ${method}`, http: method, path: path.replace('https://gmail.googleapis.com/gmail/v1', '').replace(/^\/calendars\/[^/]+/, m => '/calendars/' + (st.names[decodeURIComponent(m.slice(11))] || '…')), detail: opts.detail || '', remote: true });
    for (let attempt = 0; ; attempt++) {
      let r;
      try {
        r = await fetch(url, { method, headers: Object.assign({ Authorization: 'Bearer ' + token }, opts.body ? { 'Content-Type': 'application/json' } : {}), body: opts.body ? JSON.stringify(opts.body) : undefined });
      } catch (e) {
        if (attempt >= 3) throw errFrom(0, 'אין חיבור לגוגל כרגע.');
        await sleep(500 * 2 ** attempt);
        continue;
      }
      if (r.status === 204) return null;
      const data = await r.json().catch(() => null);
      const reason = data && data.error && data.error.errors && data.error.errors[0] && data.error.errors[0].reason;
      const retryable = r.status === 429 || r.status >= 500 || (r.status === 403 && /rate/i.test(reason || ''));
      if (retryable && attempt < 3) { await sleep(500 * 2 ** attempt + Math.random() * 300); continue; }
      if (r.status === 401 && serverMode() && attempt < 3) { token = null; await refreshFromServer(); continue; }
      if (r.status === 401) { token = null; st.status = 'reauth'; emit(); throw errFrom(401, 'פג תוקף החיבור לגוגל. לחצו "התחברות מחדש".', { reauth: true }); }
      if (!r.ok) {
        if (data && data.error) console.warn('Google API', r.status, reason, data.error.message);
        throw errFrom(r.status, HE_ERR[r.status] || `שגיאה מגוגל (${r.status}).`, { reason });
      }
      return data;
    }
  }
  async function listAll(remoteId, query) {
    const items = [];
    let pageToken, nextSyncToken;
    do {
      const q = Object.assign({ maxResults: '2500' }, query, pageToken ? { pageToken } : {});
      const r = await api('GET', `/calendars/${enc(remoteId)}/events`, { query: q, detail: query.syncToken ? 'סנכרון מצטבר' : 'סנכרון מלא' });
      items.push(...(r.items || []));
      pageToken = r.nextPageToken;
      nextSyncToken = r.nextSyncToken || nextSyncToken;
    } while (pageToken);
    return { items, nextSyncToken };
  }
  async function listCalendars() {
    const out = [];
    let pageToken;
    do {
      const r = await api('GET', '/users/me/calendarList', { query: Object.assign({ minAccessRole: 'writer' }, pageToken ? { pageToken } : {}), detail: 'רשימת יומנים' });
      out.push(...(r.items || []));
      pageToken = r.nextPageToken;
    } while (pageToken);
    return out.map(c => ({ id: c.id, summary: c.summaryOverride || c.summary, primary: !!c.primary, role: c.accessRole }));
  }
  async function createCalendar(summary) {
    const c = await api('POST', '/calendars', { body: { summary, timeZone: G.TZ, description: 'נוצר על ידי מערכת הסטודיו של תמימה.' }, detail: summary });
    st.names[c.id] = summary;
    return c.id;
  }

  /* ---------- מייל: בניה בפורמט MIME ושליחה דרך Gmail API ---------- */
  function b64utf8(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  const wrap76 = b => b.replace(/.{1,76}/g, '$&\r\n').trim();
  const encWord = v => `=?UTF-8?B?${b64utf8(v)}?=`;            // כותרת בעברית (RFC 2047)
  const cleanHeader = v => String(v || '').replace(/[\r\n]+/g, ' ').trim(); // מונע הזרקת כותרות
  function buildMime({ to, toName, subject, html, text, from }) {
    if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(cleanHeader(to))) throw errFrom(400, 'כתובת הנמען לא תקינה.');
    const b = 'b' + Math.random().toString(36).slice(2);
    return [
      `From: ${from ? `${encWord('הסטודיו של תמימה')} <${cleanHeader(from)}>` : encWord('הסטודיו של תמימה')}`,
      `To: ${toName ? `${encWord(cleanHeader(toName))} ` : ''}<${cleanHeader(to)}>`,
      `Subject: ${encWord(cleanHeader(subject))}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${b}"`,
      '',
      `--${b}`, 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', wrap76(b64utf8(text || '')),
      `--${b}`, 'Content-Type: text/html; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', wrap76(b64utf8(html || '')),
      `--${b}--`, ''
    ].join('\r\n');
  }
  const base64url = str => btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  /* ---------- כתיבה: תור השינויים ---------- */
  function onMutate(m) {
    if (!['connected', 'reauth'].includes(st.status)) return;
    const remote = st.map[m.calendarId];
    if (!remote) return; // היומן האישי וזמינות מגוגל: קריאה בלבד
    st.queue.push({ op: m.op, local: m.calendarId, remote, eventId: m.eventId, body: m.body });
    emit();
    setTimeout(flush, 0);
  }
  async function sendOp(q) {
    const base = `/calendars/${enc(q.remote)}/events`;
    if (q.op === 'insert') {
      try { await api('POST', base, { body: clean(q.body), query: { sendUpdates: 'none' }, detail: q.body && q.body.summary }); }
      catch (e) {
        if (e.code !== 409) throw e;
        // המזהה כבר קיים (למשל אירוע שנמחק ונוצר מחדש): מעדכנים אותו
        await api('PATCH', `${base}/${enc(q.eventId)}`, { body: Object.assign(clean(q.body), { status: 'confirmed' }), query: { sendUpdates: 'none' } });
      }
    } else if (q.op === 'patch') {
      try { await api('PATCH', `${base}/${enc(q.eventId)}`, { body: clean(q.body), query: { sendUpdates: 'none' } }); }
      catch (e) {
        if (e.code !== 404) throw e;
        const cur = G.internal.rawEvents(q.local).find(x => x.id === q.eventId && x.status !== 'cancelled');
        if (cur) await api('POST', base, { body: clean(cur), query: { sendUpdates: 'none' } });
      }
    } else {
      try { await api('DELETE', `${base}/${enc(q.eventId)}`, { query: { sendUpdates: 'none' } }); }
      catch (e) { if (e.code !== 404 && e.code !== 410) throw e; }
    }
  }
  async function flush() {
    if (flushing || st.status !== 'connected') return;
    flushing = true;
    let wrote = false;
    try {
      while (st.queue.length) {
        const q = st.queue[0];
        try { await sendOp(q); st.queue.shift(); wrote = true; emit(); }
        catch (e) {
          if (e.reauth) return;
          if (e.code === 0 || e.code === 429 || e.code >= 500) {
            st.error = 'אין חיבור לגוגל כרגע. השינויים נשמרו ויישלחו כשהחיבור יחזור.';
            clearTimeout(retryT);
            retryT = setTimeout(flush, 15000);
            return;
          }
          st.queue.shift(); // שגיאה קבועה (למשל נתון לא תקין): לא נתקעים עליה
          st.error = `שינוי אחד לא נשמר בגוגל (${e.message}).`;
        }
      }
    } finally { flushing = false; emit(); }
    if (wrote) await refreshBusy().catch(() => {});
  }

  /* ---------- קריאה ---------- */
  async function pull(local) {
    const remote = st.map[local];
    const tok = st.tokens[local];
    let res;
    try { res = await listAll(remote, tok ? { syncToken: tok, showDeleted: 'true' } : {}); }
    catch (e) {
      if (e.code !== 410) throw e;
      // האסימון פג בצד של גוגל: סנכרון מלא מחדש של היומן הזה
      delete st.tokens[local];
      res = await listAll(remote, {});
      G.internal.remote(() => G.internal.clearCalendar(local));
    }
    G.internal.remote(() => res.items.forEach(ev => G.internal.upsertRaw(local, ev)));
    st.tokens[local] = res.nextSyncToken;
    return res.items;
  }
  // זמינות מגוגל: היומן האישי (רק "תפוס"), יומן הסטודיו ויומן החוגים (שכבת ביטחון לאירועים חוזרים מורכבים)
  async function refreshBusy() {
    const now = Date.now();
    const items = [{ id: st.map[G.CAL.studio] }].concat(st.map[G.CAL.classes] ? [{ id: st.map[G.CAL.classes] }] : [], st.personal ? [{ id: 'primary' }] : []);
    // גוגל מגבילה את טווח הזמן בכל שאילתת freeBusy, ולכן שואלים בחלונות של עד 56 יום
    const studioBusy = [], personalBusy = [];
    for (let from = now - 7 * DAY, end = now + 120 * DAY; from < end; from += FB_WINDOW) {
      const to = Math.min(from + FB_WINDOW, end);
      const fb = await api('POST', '/freeBusy', { body: { timeMin: new Date(from).toISOString(), timeMax: new Date(to).toISOString(), timeZone: G.TZ, items }, detail: 'זמינות' });
      [G.CAL.studio, G.CAL.classes].forEach(k => studioBusy.push(...((fb.calendars[st.map[k]] || {}).busy || [])));
      personalBusy.push(...((fb.calendars.primary || {}).busy || []));
    }
    const asEvents = list => list.map(b => ({ id: G.b32hex(`fb${b.start}${b.end}`).slice(0, 80), status: 'confirmed', summary: '', transparency: 'opaque', visibility: 'private', start: { dateTime: b.start }, end: { dateTime: b.end } }));
    G.internal.remote(() => {
      G.internal.ensureCalendar(G.CAL.remoteBusy, 'זמינות מגוגל');
      G.internal.clearCalendar(G.CAL.remoteBusy);
      asEvents(studioBusy).forEach(ev => G.internal.upsertRaw(G.CAL.remoteBusy, ev));
      if (st.personal) {
        G.internal.clearCalendar(G.CAL.personal);
        asEvents(personalBusy).forEach(ev => G.internal.upsertRaw(G.CAL.personal, ev));
      }
    });
    // זמן תפוס חדש (למשל אירוע אישי שתמימה הוסיפה בטלפון) לא מגיע כשינוי ביומני הסטודיו,
    // ולכן מודיעים לאפליקציה בנפרד: העבודה המתוזמנת מורידה משבצות חופפות מכל הערוצים
    const sig = JSON.stringify([studioBusy, personalBusy]);
    if (sig !== busySig) {
      const first = busySig === null;
      busySig = sig;
      if (!first && onRemoteHook) setTimeout(() => onRemoteHook({}), 0);
    }
  }
  // ערוץ שנוסף באפליקציה אחרי החיבור מקבל יומן בגוגל; שינוי שם ערוץ מעדכן את שם היומן
  async function ensureChannelCalendars() {
    for (const ch of G.channels.list()) {
      const want = `הסטודיו של תמימה · ${ch.name}`;
      if (!st.map[ch.calendarId]) {
        st.map[ch.calendarId] = await createCalendar(want);
        persist();
        const slots = G.internal.rawEvents(ch.calendarId).filter(e => e.status !== 'cancelled');
        slots.forEach(ev => st.queue.push({ op: 'insert', local: ch.calendarId, remote: st.map[ch.calendarId], eventId: ev.id, body: ev }));
      } else if (st.names[st.map[ch.calendarId]] !== want) {
        await api('PATCH', `/calendars/${enc(st.map[ch.calendarId])}`, { body: { summary: want }, detail: want });
        st.names[st.map[ch.calendarId]] = want;
        persist();
      }
    }
  }

  async function syncNow() {
    if (st.status !== 'connected' || st.busy) return;
    st.busy = true;
    emit();
    try {
      await ensureChannelCalendars();
      await flush();
      const changes = {};
      for (const local of Object.keys(st.map)) {
        const items = await pull(local);
        if (items.length) changes[local] = items;
      }
      await refreshBusy();
      st.lastSync = Date.now();
      if (!st.queue.length) st.error = '';
      if (onRemoteHook && Object.keys(changes).length) onRemoteHook(changes);
    } catch (e) {
      if (!e.reauth) st.error = e.code === 0 ? 'אין חיבור לגוגל כרגע. ננסה שוב בעוד דקה.' : `הסנכרון נכשל: ${e.message}`;
    } finally { st.busy = false; emit(); }
  }
  function startTimers() {
    stopTimers();
    timer = setInterval(syncNow, SYNC_MS);
    window.addEventListener('focus', syncNow);
    document.addEventListener('visibilitychange', onVisible);
  }
  function stopTimers() {
    clearInterval(timer);
    clearTimeout(retryT);
    window.removeEventListener('focus', syncNow);
    document.removeEventListener('visibilitychange', onVisible);
  }

  /* ---------- ממשק לאפליקציה ---------- */
  const keepBasic = ev => ['class', 'slot'].includes(((ev.extendedProperties || {}).private || {}).kind);

  const GSync = {
    scopes: SCOPES,
    available: () => !!CFG.googleClientId,
    state,
    savedConfig: saved,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    set onCall(fn) { onCallHook = fn; },
    set onRemote(fn) { onRemoteHook = fn; },

    // שלב 1: התחברות (מתוך לחיצה)
    async connect() {
      if (!GSync.available()) throw errFrom(400, 'חסר מזהה לקוח של גוגל בקובץ config.js.');
      st.error = '';
      st.status = 'connecting';
      emit();
      try {
        await loadGis();
        if (await detectServer()) {
          try { await requestCode(); }
          catch (e) {
            // גוגל לא נתנה הרשאה קבועה (למשל אישור קודם בלי שרת): השרת ביטל את האישור הישן, ולחיצה נוספת תבקש אישור מלא
            if (e.reason === 'consent_again') throw errFrom(409, 'צריך לאשר שוב פעם אחת. לחצו שוב על "התחברות עם חשבון גוגל".');
            throw e;
          }
        } else await requestToken(saved() ? '' : 'consent');
        st.status = 'authorized';
      } catch (e) { st.status = 'off'; st.error = e.message; throw e; } finally { emit(); }
      return listCalendars();
    },

    // שלב 2: בחירת יומן וסנכרון ראשון. upload: 'basic' (חוגים ומשבצות) / 'all' / 'none'
    async setup({ studioId, upload = 'basic' }) {
      st.status = 'syncing';
      st.upload = upload;
      st.uploaded = upload === 'none'; // נהיה true רק אחרי שכל ההעלאה הראשונה הגיעה לגוגל
      st.error = '';
      emit();
      try {
        const cals = await listCalendars();
        const primary = cals.find(c => c.primary);
        st.account = primary ? primary.id : '';
        cals.forEach(c => { st.names[c.id] = c.summary; });
        const prev = saved() || { map: {} };
        // יומן קיים: לפי מה שנשמר בדפדפן, ואם אין (דפדפן אחר או מחשב אחר) לפי השם בחשבון. רק אם אין, יוצרים חדש
        const fresh = new Set();
        const byName = name => (cals.find(c => c.summary === name && !c.primary) || {}).id;
        const pick = async (oldId, name) => {
          if (oldId && cals.some(c => c.id === oldId)) return oldId;
          const found = byName(name);
          if (found) return found;
          const id = await createCalendar(name);
          fresh.add(id);
          return id;
        };
        const studio = studioId && cals.some(c => c.id === studioId) ? studioId : await pick(null, 'הסטודיו של תמימה');
        st.map = { [G.CAL.studio]: studio };
        // יומן נפרד לחוגים. בגרסה קודמת החוגים נשמרו ביומן הסטודיו, ולכן מעבירים אותם (עם אותו מזהה)
        st.map[G.CAL.classes] = await pick(prev.map && prev.map[G.CAL.classes], 'הסטודיו של תמימה · חוגים');
        if (!fresh.has(studio)) { // חוגים שנמצאים עדיין ביומן הסטודיו עוברים ליומן החוגים
          const { items } = await listAll(studio, {});
          const toMove = items.filter(e => e.status !== 'cancelled' && !e.recurringEventId && ((e.extendedProperties || {}).private || {}).kind === 'class');
          // לא events.move: הוא מוחק את התגיות הפרטיות ואת הצבע. יוצרים עותק מלא עם אותו מזהה ומוחקים את המקור
          for (const ev of toMove) {
            await api('POST', `/calendars/${enc(st.map[G.CAL.classes])}/events`, { body: clean(ev), query: { sendUpdates: 'none' }, detail: ev.summary });
            await api('DELETE', `/calendars/${enc(studio)}/events/${enc(ev.id)}`, { query: { sendUpdates: 'none' } });
          }
        }
        for (const ch of G.channels.list()) {
          st.map[ch.calendarId] = await pick(prev.map && prev.map[ch.calendarId], `הסטודיו של תמימה · ${ch.name}`);
        }
        st.personal = !primary || primary.id !== studio; // אם יומן הסטודיו הוא היומן הראשי, אין יומן אישי נפרד
        st.tokens = {};
        persist();
        // סנכרון ראשון: היומן המקומי = מה שבגוגל + מה שבחרנו להעלות
        for (const [local, remote] of Object.entries(st.map)) {
          const { items, nextSyncToken } = await listAll(remote, {});
          const ids = new Set(items.map(e => e.id));
          const mine = G.internal.rawEvents(local).filter(e => e.status !== 'cancelled' && !e.recurringEventId);
          // מעלים רק ליומן חדש, או להשלמת העלאה ראשונה שנקטעה באותו דפדפן. ביומן קיים גוגל הוא המקור, כדי לא ליצור כפילויות
          const resume = prev.uploaded === false && prev.map && prev.map[local] === remote;
          const push = upload === 'none' || !(fresh.has(remote) || resume) ? [] : mine.filter(e => !ids.has(e.id) && (upload === 'all' || keepBasic(e)));
          G.internal.remote(() => {
            G.internal.clearCalendar(local);
            items.forEach(ev => G.internal.upsertRaw(local, ev));
            push.forEach(ev => G.internal.upsertRaw(local, ev));
          });
          st.tokens[local] = nextSyncToken;
          push.forEach(ev => st.queue.push({ op: 'insert', local, remote, eventId: ev.id, body: ev }));
        }
        await refreshBusy();
        st.status = 'connected';
        st.lastSync = Date.now();
        emit();
        startTimers();
        await flush();
        if (!st.queue.length && !st.uploaded) { st.uploaded = true; persist(); }
      } catch (e) {
        st.status = e.reauth ? 'reauth' : 'off';
        st.error = e.message;
        emit();
        throw e;
      }
    },

    // אחרי רענון או כשהאסימון פג: התחברות מחדש וחזרה לסנכרון, בלי לשאול שוב על היומנים
    async reconnect() {
      if (await detectServer() && server.connected) await refreshFromServer(); // בלי חלון
      else { await loadGis(); await requestToken(''); }
      const prev = saved();
      // באותו דף (האסימון פג): ממשיכים מהסנכרון המצטבר
      if (st.map[G.CAL.studio] && Object.keys(st.tokens).length) { st.status = 'connected'; emit(); startTimers(); await syncNow(); return; }
      // אחרי רענון: העותק המקומי נבנה מחדש מגוגל, בלי להעלות שוב את נתוני הדמו
      // אם ההעלאה הראשונה נקטעה באמצע, משלימים אותה (נשלח רק מה שעדיין חסר בגוגל)
      if (prev && prev.map && prev.map[G.CAL.studio]) return GSync.setup({ studioId: prev.map[G.CAL.studio], upload: prev.uploaded === false ? (prev.upload || 'basic') : 'none' });
      st.status = 'authorized';
      emit();
    },

    syncNow,
    listCalendars,
    buildMime,

    // שליחת מייל מהחשבון המחובר
    async sendMail(msg) {
      if (st.status !== 'connected') throw errFrom(401, 'החשבון לא מחובר.');
      if (!st.gmail) throw errFrom(403, 'אין הרשאה לשליחת מיילים. התחברו מחדש ואשרו "שליחת אימייל".');
      const raw = base64url(buildMime(Object.assign({ from: st.account }, msg)));
      return api('POST', GMAIL_SEND, { body: { raw }, detail: msg.subject });
    },

    // בדיקת חיבור: קריאה, כתיבה, קריאה חוזרת, זמינות ומחיקה, מול היומן האמיתי
    async selfTest() {
      const out = [];
      const step = async (name, fn) => { try { out.push({ name, ok: true, detail: (await fn()) || '' }); return true; } catch (e) { out.push({ name, ok: false, detail: e.message }); return false; } };
      const remote = st.map[G.CAL.studio];
      if (!remote || st.status !== 'connected') return [{ name: 'חיבור', ok: false, detail: 'צריך להתחבר ולבחור יומן קודם.' }];
      const base = `/calendars/${enc(remote)}/events`;
      const id = 'tst' + Date.now().toString(32);
      const day = new Date(Date.now() + 3 * DAY).toISOString().slice(0, 10);
      await step('קריאה מיומן הסטודיו', async () => { const r = await api('GET', base, { query: { maxResults: '5' }, detail: 'בדיקה' }); return `נקראו ${(r.items || []).length} אירועים`; });
      const wrote = await step('כתיבת אירוע בדיקה', async () => {
        await api('POST', base, { body: { id, summary: 'בדיקת חיבור (נמחק מיד)', start: { dateTime: `${day}T07:00:00`, timeZone: G.TZ }, end: { dateTime: `${day}T07:15:00`, timeZone: G.TZ }, transparency: 'transparent' }, query: { sendUpdates: 'none' }, detail: 'בדיקה' });
        return `${day} 07:00`;
      });
      if (wrote) {
        await step('קריאה חוזרת של האירוע', async () => { const r = await api('GET', `${base}/${id}`, { detail: 'בדיקה' }); return r.summary; });
        await step('מחיקת אירוע הבדיקה', async () => { await api('DELETE', `${base}/${id}`, { query: { sendUpdates: 'none' }, detail: 'בדיקה' }); return 'נמחק'; });
      }
      await step('זמינות מהיומן האישי (רק תפוס או פנוי)', async () => {
        const r = await api('POST', '/freeBusy', { body: { timeMin: new Date().toISOString(), timeMax: new Date(Date.now() + 7 * DAY).toISOString(), items: [{ id: 'primary' }] }, detail: 'בדיקה' });
        return `${((r.calendars.primary || {}).busy || []).length} פרקי זמן תפוסים בשבוע הקרוב`;
      });
      out.push({ name: 'הרשאת שליחת מיילים', ok: st.gmail, detail: st.gmail ? 'אושרה' : 'לא אושרה. התחברו מחדש וסמנו "שליחת אימייל".' });
      return out;
    },

    // ניתוק: ביטול ההרשאה בגוגל, מחיקת האסימון מהזיכרון. forget: גם שכחת היומנים שנבחרו.
    // מצב השרת: האם ההתחברות חד פעמית במכשיר הזה
    serverMode,
    disconnect(forget) {
      stopTimers();
      if (server) {
        // עם שרת: ניתוק רגיל = המכשיר הזה בלבד. "שכחת היומנים" = ביטול ההרשאה בגוגל לגמרי
        serverPost('disconnect', { everywhere: !!forget }).catch(() => {});
        server.connected = false;
      } else if (token && window.google && google.accounts && google.accounts.oauth2) google.accounts.oauth2.revoke(token, () => {});
      token = null;
      tokenExp = 0;
      const lost = st.queue.length;
      st.queue = [];
      st.status = 'off';
      st.gmail = false;
      st.error = lost ? `${lost} שינויים שלא נשלחו לגוגל נשארו רק בדמו.` : '';
      G.internal.dropCalendar(G.CAL.remoteBusy);
      if (forget) { st.map = {}; st.names = {}; st.tokens = {}; st.account = ''; try { localStorage.removeItem(STORE); } catch (e) { /* מצב פרטי */ } }
      emit();
    }
  };

  G.onMutate = onMutate;
  const prev = saved();
  if (prev) { st.map = prev.map || {}; st.names = prev.names || {}; st.account = prev.account || ''; st.upload = prev.upload || 'basic'; st.status = st.map[G.CAL.studio] ? 'reauth' : 'off'; }
  window.GSync = GSync;
  // פתיחת הדף: אם המכשיר כבר מחובר דרך השרת, חוזרים לסנכרון לבד, בלי לחיצה ובלי חלון
  if (CFG.googleClientId) detectServer().then(sv => {
    if (sv && sv.connected && st.map[G.CAL.studio]) {
      st.status = 'connecting'; emit();
      GSync.reconnect().catch(e => { st.status = e.reauth ? 'reauth' : 'off'; st.error = e.reauth ? '' : e.message; emit(); });
    }
  });
})();
