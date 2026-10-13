/* core.js: המשותף לכל הדפים. מצב (S), עזרים, לוגיקה עסקית, יומן, מיילים, חלוניות. */
'use strict';

  const X = window.DEMO;
  const { iso, parse, addDays, addMonths, toMin, fromMin, at, startOfToday } = X;

  const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const DAYS_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
  const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

  let S, bk, lead;
  const ui = { clsTab: 'att', stq: { q: '', old: false }, stf: {}, gf: {}, wsf: {}, mvf: {}, bf: {}, cMsg: null, gsec: {}, chOpen: {}, moreTab: 'channels', chf: { name: '', err: '' }, cf: { from: '', to: '', note: '', cancel: true, err: '' }, calDay: null, calFilter: 'all', calHi: null, bulk: { on: false, ch: 'salon', sel: [] }, pop: null, flash: [], calMsg: '', chMsg: null, guided: false, guideOpen: false, sheet: null, weekOffset: 0, lessonSel: {}, wsTab: 'upcoming', rcpt: null, stuMsg: null, toastTimer: null };
  let uidN = 1;
  const TAB = Math.random().toString(36).slice(2, 5);
  const uid = p => `${p}_n${TAB}${uidN++}`;
  // קוד אישי לקישור של סטודנט (לא ניתן לניחוש)
  const token = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(36).padStart(2, '0')).join('').slice(0, 20);
  /* מצב "קישור אישי": קישור מהמייל פותח רק את מה שמותר לנמען.
     ?p=s&k=<קוד>  סטודנט: רק האזור שלו, רק הנתונים שלו
     ?p=site       לקוח: רק האתר הציבורי
     בלי פרמטר     המערכת המלאה (תמימה, ובדמו גם פס המעבר בין התפקידים) */
  const APP_MODE = document.body.dataset.app || 'demo';
  const PORTAL = (() => {
    if (APP_MODE === 'demo') return null;
    const k = new URLSearchParams(location.search).get('k') || '';
    return { kind: APP_MODE, k: APP_MODE === 'student' && /^[a-z0-9]{8,40}$/.test(k) ? k : null };
  })();
  // כל דף מציג רק את האזור שלו
  const PORTAL_ROLE = { site: ['client', '#/client'], student: ['student', '#/student/home'], studio: ['tamima', '#/tamima/home'] };

  function reset() {
    S = X.seed();
    S.mail = { auto: Object.fromEntries(Object.keys(MAIL_KINDS).map(k => [k, true])), outbox: [], studioEmail: 'tamima.studio@example.com' };
    // מה שכבר "הגיע זמנו" בנתוני הדמו נחשב כאילו טופל, כדי שרענון הדף לא ישלח מיילים שוב
    const n0 = now().getTime();
    S.workshops.forEach(w => {
      if (at(w.date, w.time).getTime() - n0 <= 24 * 36e5) w.reminderSent = true;
      if (wEnd(w).getTime() <= n0) w.feedbackAuto = true;
    });
    S.students.forEach(st => { if (payStatus(st).key === 'overdue') st.autoReminded = true; });
    S.makeups.forEach(m => { if ((parse(m.expires) - startOfToday()) / 864e5 <= 7) m.warned = true; });
    S.conflictsDismissed = [];
    S.conflictsSeen = typeof conflicts === 'function' ? conflicts().map(c => c.key) : [];
    bk = { step: 'slot', n: 2, date: null, time: null, name: '', phone: '', email: '', err: '', errField: '', marketing: false, done: null };
    lead = { name: '', phone: '', email: '', group: '', sent: false, err: '', errField: '', marketing: false };
    ui.accForm = { name: '', contact: '', text: '', sent: false, err: '', errField: '' };
    Object.assign(ui, { sheet: null, weekOffset: 0, lessonSel: {}, rcpt: null, stuMsg: null });
  }

  /* ---------- עזרים ---------- */
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => Math.round(n).toLocaleString('he-IL') + ' ₪';
  const now = () => X.clockNow();
  const todayIso = () => iso(startOfToday());
  const dmy = s => { const d = parse(s); return `${d.getDate()}.${d.getMonth() + 1}`; };
  const shortDay = s => `יום ${DAYS_SHORT[parse(s).getDay()]} ${dmy(s)}`;
  const longDay = s => { const d = parse(s); return `יום ${DAYS[d.getDay()]}, ${d.getDate()} ב${MONTHS[d.getMonth()]}`; };
  const relDay = s => {
    const diff = Math.round((parse(s) - startOfToday()) / 864e5);
    if (diff === 0) return 'היום';
    if (diff === 1) return 'מחר';
    if (diff === -1) return 'אתמול';
    return shortDay(s);
  };
  const endOf = t => fromMin(toMin(t) + X.WORKSHOP_MIN);
  const first = s => s.name.split(' ')[0];
  const clock = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  /* ---------- שאילתות על המצב ---------- */
  const group = id => S.groups.find(g => g.id === id);
  const student = id => S.students.find(s => s.id === id);
  const lesson = id => S.lessons.find(l => l.id === id);
  const workshop = id => S.workshops.find(w => w.id === id);
  // אפליקציית הסטודנט מוצגת בשם הסטודנט שנבחר, ואם לא נבחר: האחרון שנוסף
  const me = () => {
    if (PORTAL) return PORTAL.kind === 'student' && PORTAL.k ? S.students.find(x => x.k === PORTAL.k && x.active !== false) : undefined;
    const s = student(ui.meId); return s && s.active !== false ? s : [...S.students].reverse().find(x => x.active !== false);
  };
  const groupStudents = gid => S.students.filter(s => s.groupId === gid && s.active !== false);
  // סטודנט משתתף בשיעור רק מתאריך תחילת הקורס שלו
  const inLesson = (s, l) => !s.start || s.start <= l.date;
  const lessonStudents = l => groupStudents(l.groupId).filter(s => inLesson(s, l));
  // מועדי השיעורים הקרובים של קבוצה (לבחירת תחילת הקורס)
  const groupLessonDates = gid => S.lessons.filter(l => l.groupId === gid && !l.cancelled && lStart(l) > now()).map(l => l.date);
  const att = lid => (S.attendance[lid] = S.attendance[lid] || { marked: false, rec: {} });
  // לשיעור שכבר התקיים נשמרת השעה המקורית, גם אם הקבוצה עברה לשעה אחרת
  const lStart = l => at(l.date, l.start || group(l.groupId).start);
  const lEnd = l => at(l.date, l.end || group(l.groupId).end);
  const wEnd = w => at(w.date, endOf(w.time));
  const price = n => (n === 2 ? S.settings.price2 : n * S.settings.pricePer);
  const overlaps = (a, b) => a.s < b.e && b.s < a.e;

  function roster(l) {
    const rec = att(l.id).rec;
    const g = group(l.groupId);
    const regs = lessonStudents(l);
    const away = regs.filter(s => rec[s.id] === 'cancelled' || rec[s.id] === 'late');
    const guests = S.makeups.filter(m => m.bookedLessonId === l.id).map(m => ({ m, s: student(m.studentId) }));
    const coming = regs.length - away.length + guests.length;
    return { regs, guests, coming, max: g.max, free: Math.max(0, g.max - coming) };
  }

  /* ---------- יומן: קריאה רק דרך שכבת Google Calendar ---------- */
  const G = window.GCal;
  const CAL = G.CAL;
  const APP = 'tamima-studio';
  const dayRange = (from, to) => ({ timeMin: G.rfc3339(`${from}T00:00:00`), timeMax: G.rfc3339(`${iso(addDays(parse(to), 1))}T00:00:00`) });
  const priv = ev => (ev.extendedProperties && ev.extendedProperties.private) || {};
  // מיקום אירוע ביום מסוים, בדקות מחצות (שעון ירושלים)
  function span(ev, date) {
    const s = G.msToWall(G.edgeMs(ev.start)), e = G.msToWall(G.edgeMs(ev.end));
    return { date: s.slice(0, 10), s: s.slice(0, 10) < date ? 0 : toMin(s.slice(11, 16)), e: e.slice(0, 10) > date ? 1440 : toMin(e.slice(11, 16)) };
  }
  function listEvents(calendarId, from, to) {
    return G.events.list({ calendarId, ...dayRange(from, to), singleEvents: true, orderBy: 'startTime' }).items;
  }
  function safeGet(calendarId, eventId) { try { return G.events.get({ calendarId, eventId }); } catch (e) { return null; } }
  // מופע של אירוע חוזר, לפי מזהה המופע של גוגל: <recurringEventId>_<YYYYMMDDTHHMMSSZ>
  function instanceOf(calendarId, instId) {
    const m = instId.match(/_(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
    if (!m) return null;
    const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    return G.events.list({ calendarId, timeMin: new Date(ms).toISOString(), timeMax: new Date(ms + 864e5).toISOString(), singleEvents: true }).items.find(e => e.id === instId) || null;
  }
  function whenOf(ev) {
    const s = G.msToWall(G.edgeMs(ev.start)), e = G.msToWall(G.edgeMs(ev.end));
    return `${longDay(s.slice(0, 10))}, ${s.slice(11, 16)} עד ${e.slice(11, 16)}`;
  }
  function eventJson(ev, calendarId) {
    return `<details class="json"><summary>משאב Event ב-Google Calendar</summary><p class="small muted" dir="ltr">calendarId: ${esc(calendarId)}</p><pre dir="ltr">${esc(JSON.stringify(ev, null, 2))}</pre></details>`;
  }
  // כרטיס לקוח: לקוח שחוזר (לפי מייל או טלפון) נוסף לאותו כרטיס
  const digitsOf = p => String(p || '').replace(/\D/g, '');
  function customerFor(c) {
    if (!c || !c.name) return null;
    if (!S.customers) S.customers = [];
    const mail = String(c.email || '').trim().toLowerCase(), ph = digitsOf(c.phone);
    let x = S.customers.find(k => (mail && k.email.toLowerCase() === mail) || (ph && digitsOf(k.phone) === ph));
    if (!x) { x = { id: uid('c'), name: c.name, phone: c.phone || '', email: c.email || '', since: todayIso() }; S.customers.push(x); }
    else { if (!x.email && c.email) x.email = c.email; if (!x.phone && c.phone) x.phone = c.phone; }
    return x;
  }
  const customerWorkshops = id => S.workshops.filter(w => w.customerId === id).sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

  // כתיבת סדנה: נתוני האפליקציה, אירוע ביומן הסטודיו, והמשבצת נמחקת מכל יומני הערוצים
  function bookWorkshop(w) {
    const c = customerFor(w.customer);
    if (c) w.customerId = c.id;
    w.eventId = w.eventId || G.newId();
    S.workshops.push(w);
    G.events.insert({ calendarId: CAL.studio, requestBody: X.workshopEvent(w) });
    return G.channels.book(w.date, w.time);
  }

  /* ---------- זמינות וערוצים ----------
     שאילתה אחת לטווח (freebusy על הסטודיו והיומן האישי, ו-events.list לכל יומן ערוץ),
     שנשמרת עד הכתיבה הבאה ליומן. כך גם בגוגל האמיתי לא שולחים שאילתה לכל יום. */
  const HOME = 'site';
  let calCache = { key: '' };
  function calData() {
    const t = startOfToday().getTime();
    const ws = G.wallToMs(`${calWeek()[0]}T00:00:00`);
    const a = Math.min(t - 35 * 864e5, ws), b = Math.max(t + 105 * 864e5, ws + 8 * 864e5);
    const key = `${G.version()}|${todayIso()}|${a}|${b}`;
    if (calCache.key === key) trace.cacheHits++;
    if (calCache.key !== key) {
      calCache = { key, busy: G.channels.busy(a, b), slots: G.channels.slots(a, b),
        // יומן הסטודיו ויומן החוגים מוצגים יחד ברשת
        studio: [CAL.studio, CAL.classes].flatMap(calendarId => G.events.list({ calendarId, timeMin: new Date(a).toISOString(), timeMax: new Date(b).toISOString(), singleEvents: true, orderBy: 'startTime' }).items)
          .sort((x, y) => G.edgeMs(x.start) - G.edgeMs(y.start)) };
    }
    return calCache;
  }
  // מרווחים (בדקות מחצות) ביום מסוים מתוך רשימת [התחלה, סוף] במילישניות
  function onDay(list, date) {
    const d0 = G.wallToMs(`${date}T00:00:00`), d1 = G.wallToMs(`${iso(addDays(parse(date), 1))}T00:00:00`);
    return list.filter(([s, e]) => s < d1 && d0 < e).map(([s, e]) => ({ s: Math.max(0, Math.round((s - d0) / 6e4)), e: Math.min(1440, Math.round((e - d0) / 6e4)) }));
  }
  const busy = date => onDay(calData().busy.all, date);
  const personalBusy = date => onDay(calData().busy.byCal[CAL.personal] || [], date);
  const slotsOn = date => calData().slots.filter(x => x.date === date);
  // זמנים פנויים באמת (בלי קשר לערוץ)
  function freeTimes(date) {
    const b = busy(date);
    return (G.channels.slotTimes()[parse(date).getDay()] || []).filter(t => {
      const iv = { s: toMin(t), e: toMin(t) + X.WORKSHOP_MIN };
      return !b.some(x => overlaps(x, iv)) && at(date, t) > now();
    });
  }
  // מה שהאתר של תמימה מציע: רק משבצות שבבעלות ערוץ האתר, ופנויות
  function freeSlots(date, own) {
    const free = freeTimes(date);
    const notice = (G.channels.get(HOME).minNoticeHours || 0) * 36e5;
    return slotsOn(date).filter(x => x.channel === HOME && free.includes(x.time) && at(date, x.time) - now() >= notice && !heldByOther(date, x.time, own)).map(x => x.time);
  }

  /* ---------- שמירת מועד בזמן התשלום ----------
     כשלקוח עובר לתשלום, המועד נשמר לו ל-5 דקות ולא מוצע לאף אחד אחר.
     אם לא שילם בזמן הזה, המועד משתחרר וחוזר להיות פנוי. */
  const HOLD_MIN = 5;
  const holdOf = id => (S.holds || []).find(h => h.id === id && h.until > now().getTime());
  const heldByOther = (date, time, own) => (S.holds || []).some(h => h.date === date && h.time === time && h.id !== own && h.until > now().getTime());
  function holdSlot(date, time, own) {
    const cur = holdOf(own);
    if (cur && cur.date === date && cur.time === time) return cur;
    releaseHold(own);
    const h = { id: uid('h'), date, time, until: now().getTime() + HOLD_MIN * 6e4 };
    S.holds = (S.holds || []).concat(h);
    log('sync', `${shortDay(date)} ${time} נשמר ללקוח ל-${HOLD_MIN} דקות`, 'הלקוח עבר לתשלום. בזמן הזה המועד לא מוצע לאף אחד אחר.');
    return h;
  }
  function releaseHold(id) { if (id && S.holds) S.holds = S.holds.filter(h => h.id !== id); }
  function pruneHolds() {
    const n = now().getTime();
    (S.holds || []).filter(h => h.until <= n).forEach(h => log('sync', `${shortDay(h.date)} ${h.time} שוחרר`, `עברו ${HOLD_MIN} דקות בלי תשלום, והמועד חזר להיות פנוי.`));
    if (S.holds) S.holds = S.holds.filter(h => h.until > n);
  }

  // סאמיט שולח למערכת אישור תשלום (בגרסה האמיתית: הודעת שרת מסאמיט).
  // רק אז המועד נסגר ביומן והקבלה נשמרת בכרטיס הלקוח
  function sumitPaid(p) {
    releaseHold(p.holdId);
    const w = { id: uid('w'), source: HOME, date: p.date, time: p.time, n: p.n, amount: p.amount, customer: p.customer, receipt: 'auto', invoice: p.invoice, paidAt: todayIso(), feedbackSent: false };
    const removed = bookWorkshop(w);
    log('sumit', 'סאמיט שלח למערכת אישור תשלום וקבלה', `חשבונית מס קבלה מס׳ ${p.invoice} התקבלה ונשמרה בכרטיס הלקוח של ${w.customer.name}.`);
    log('sync', 'היומן עודכן', `המשבצת ${shortDay(w.date)} ${w.time} נסגרה ולא תוצע יותר באתר${removed.length ? ' וגם הוסרה מיומן הסלון' : ' ובסלון'}.`);
    return w;
  }
  const chName = id => X.channelName(id);
  const isOwn = w => w.source === HOME;
  const srcCss = w => (isOwn(w) ? 'site' : 'salon');
  const srcLabel = w => (isOwn(w) ? 'סדנה מהאתר' : `סדנה · ${chName(w.source)}`);
  const paidLabel = w => (w.paid === false ? 'לא שולמה' : w.manual ? 'שולמה (נרשם ידנית)' : isOwn(w) ? 'שולמה' : `שולמה בערוץ "${chName(w.source)}"`);
  const commissionOf = w => { const ch = G.channels.get(w.source); return ch && !ch.home ? w.amount * ch.commission / 100 : 0; };
  const whenMs = ms => { const d = new Date(ms); return `${shortDay(iso(d))} ${clock(d)}`; };

  // העבודה המתוזמנת של הסנכרון. בגרסה האמיתית רצה בשרת; כאן אחרי כל שינוי ובכל "קדם זמן".
  // תיקון עצמי: חוג שאיבד את התגיות הפרטיות שלו (למשל אחרי העברה בין יומנים בגוגל) מזוהה לפי המזהה הקבוע שלו
  function healClasses() {
    S.groups.forEach(g => (g.masters || []).forEach(m => {
      const ev = safeGet(CAL.classes, m.id);
      if (!ev || ev.status === 'cancelled' || (priv(ev).kind === 'class' && priv(ev).groupId === g.id)) return;
      G.events.patch({ calendarId: CAL.classes, eventId: m.id, requestBody: { colorId: '9', extendedProperties: { private: { app: APP, kind: 'class', groupId: g.id } } } });
    }));
  }
  function runSync() {
    healClasses();
    const acts = G.channels.tick();
    acts.forEach(a => {
      const ch = G.channels.get(a.channel) || { name: '' };
      if (a.type === 'release') log('sync', `שחרור: ${shortDay(a.date)} ${a.time} ירדה מיומן ${ch.name}`, `לא נמכרה ${ch.releaseDays} ימים לפני המועד. תיפתח באתר של תמימה ב${whenMs(a.publishAt)}, אחרי ${ch.bufferHours} שעות המתנה.`);
      if (a.type === 'publish') log('sync', `${shortDay(a.date)} ${a.time} נפתחה באתר של תמימה`, a.reason === 'deactivated' ? `הערוץ "${ch.name}" סומן לא פעיל, והמשבצת חזרה לאתר.` : `עברה תקופת ההמתנה מאז השחרור מ"${ch.name}".`);
      if (a.type === 'conflict') log('sync', `${shortDay(a.date)} ${a.time} ירדה מיומן ${ch.name}`, 'הזמן נתפס ביומן הסטודיו או ביומן האישי, ולכן המשבצת לא מוצעת יותר.');
      if (a.type === 'fill') log('sync', `${a.count} משבצות חדשות נפתחו באתר`, 'זמן פנוי שלא שייך לאף ערוץ נפתח אוטומטית באתר של תמימה.');
      if (a.type === 'restore') log('sync', `${shortDay(a.date)} ${a.time} חזרה ל${ch.home ? 'אתר' : `ערוץ "${ch.name}"`}`, 'הזמן התפנה, והמשבצת חזרה לערוץ שממנו ירדה, באותם תנאים.');
    });
    if (typeof notifyConflicts === 'function') notifyConflicts();
    return acts;
  }

  // הכרטיסייה הראשונה של סטודנט חדש: "ממתין לתשלום" עד השיעור הראשון, ואז "דורש טיפול"
  const firstLessonStarted = s => s.used > 0 || S.lessons.some(l => l.groupId === s.groupId && (!s.start || l.date >= s.start) && !l.cancelled && lStart(l) <= now());
  function payStatus(s) {
    if (s.owes && s.firstDue && !firstLessonStarted(s)) return { key: 'requested', label: 'ממתין לתשלום' };
    if (s.owes || (!s.nextPaid && s.used >= S.settings.cardSize)) return { key: 'overdue', label: 'דורש טיפול' };
    if (s.nextPaid) return { key: 'paid', label: 'שולם' };
    if (s.requestSent) return { key: 'requested', label: 'נשלחה דרישת תשלום' };
    return { key: 'ok', label: 'בתוקף' };
  }
  // לפני התשלום הראשון האזור האישי סגור: הקישור פותח רק את מסך התשלום
  const isLocked = s => !!(s && s.owes && s.firstDue);
  const openCredits = s => S.makeups.filter(m => m.studentId === s.id && !m.bookedLessonId && m.expires >= todayIso());

  function log(kind, title, body) { S.log.unshift({ id: uid('e'), at: new Date(), kind, title, body: body || '' }); }

  /* ---------- לוגיקה עסקית ---------- */
  function useLesson(s) {
    const size = S.settings.cardSize;
    if (s.used >= size) {
      s.owes = !s.nextPaid;
      s.used = 0; s.nextPaid = false; s.requestSent = s.owes; s.reminded = null;
    }
    s.used++;
    if (s.used === size - 1 && !s.nextPaid && !s.owes && !s.requestSent) {
      s.requestSent = true;
      email('payRequest', toStudent(s), 'הכרטיסייה הבאה מחכה לתשלום', [`היי ${first(s)},`, 'סיימת 3 מתוך 4 שיעורים בכרטיסייה.', `לתשלום הכרטיסייה הבאה (${money(S.settings.cardPrice)}) בכרטיס אשראי, בקישור המאובטח:`, 'תודה, תמימה'], { cta: ['לתשלום בסאמיט', studentUrl(s, 'pay')] });
    }
    if (s.used === size && !s.nextPaid) log('notify', `${s.name}: שיעור 4 בכרטיסייה ללא תשלום`, 'עבר ל"ממתין לך עכשיו" עם כפתור לשליחת תזכורת.');
  }
  function unuseLesson(s) { if (s.used > 0) s.used--; }

  function payCard(s) {
    const inv = S.nextInvoice++;
    const opens = isLocked(s);                              // התשלום הראשון פותח את האזור האישי
    S.payments.push({ id: uid('p'), studentId: s.id, date: todayIso(), amount: S.settings.cardPrice, invoice: inv });
    if (s.owes) { s.owes = false; s.firstDue = false; s.requestSent = false; s.reminded = null; } else s.nextPaid = true;
    log('sumit', `סאמיט: התקבל תשלום מ${s.name}`, `${money(S.settings.cardPrice)}, חשבונית מס קבלה מס׳ ${inv} הופקה אוטומטית.`);
    email('payReceipt', toStudent(s), `התשלום התקבל, חשבונית מס קבלה מס׳ ${inv}`, [`היי ${first(s)},`, `קיבלנו את התשלום על הכרטיסייה (${money(S.settings.cardPrice)}). תודה!`, `חשבונית מס קבלה מס׳ ${inv} מצורפת ונשמרת גם באפליקציה.`].concat(opens ? ['מעכשיו האזור האישי שלך פתוח: השיעורים, הכרטיסייה, ההשלמות והתשלומים. זה הקישור האישי שלך, כדאי לשמור אותו.'] : []), { cta: opens ? ['לאזור האישי שלי', studentUrl(s, 'home')] : ['לתשלומים שלי', studentUrl(s, 'payments')] });
    return inv;
  }

  function creditEligible(s) {
    const mk = todayIso().slice(0, 7);
    return !S.makeups.some(m => m.studentId === s.id && m.cancelDate.slice(0, 7) === mk);
  }
  function grantCredit(s, l) {
    const t = startOfToday();
    S.makeups.push({ id: uid('mk'), studentId: s.id, sourceLessonId: l.id, cancelDate: iso(t), expires: iso(addMonths(t, 1)), bookedLessonId: null });
  }
  function cancelInfo(s, l) {
    const hrs = (lStart(l) - now()) / 36e5;
    if (hrs <= 0 || l.cancelled) return { ok: false };
    const late = hrs < S.settings.lessonCancelHours;
    return { ok: true, late, credit: !late && creditEligible(s) };
  }

  function setAtt(lid, sid, v) {
    const a = att(lid);
    const prev = a.rec[sid];
    if (prev === v) return;
    const s = student(sid), l = lesson(lid);
    const counted = x => x === 'arrived' || x === 'late';
    if (prev === 'cancelled') S.makeups = S.makeups.filter(m => !(m.studentId === sid && m.sourceLessonId === lid && !m.bookedLessonId));
    a.rec[sid] = v;
    if (counted(prev) && !counted(v)) unuseLesson(s);
    if (!counted(prev) && counted(v)) useLesson(s);
    if (v === 'cancelled' && s.groupId === l.groupId && creditEligible(s)) grantCredit(s, l);
    a.marked = lessonStudents(l).every(x => a.rec[x.id]);
  }

  function studentUpcoming(s) {
    const own = S.lessons.filter(l => l.groupId === s.groupId && inLesson(s, l) && lEnd(l) > now()).slice(0, 5)
      .map(l => ({ l, kind: 'own', st: att(l.id).rec[s.id] }));
    const mk = S.makeups.filter(m => m.studentId === s.id && m.bookedLessonId)
      .map(m => ({ l: lesson(m.bookedLessonId), kind: 'makeup', m })).filter(x => lEnd(x.l) > now());
    return own.concat(mk).sort((a, b) => lStart(a.l) - lStart(b.l));
  }
  function makeupOptions(s, m) {
    return S.lessons.filter(l => l.groupId !== s.groupId && !l.cancelled && group(l.groupId).active !== false && lStart(l) > now() && l.date <= m.expires
      && roster(l).free > 0 && !S.makeups.some(x => x.studentId === s.id && x.bookedLessonId === l.id));
  }

  /* ---------- רכיבים ---------- */
  const chip = (label, key) => `<span class="chip chip-${key}">${esc(label)}</span>`;
  const card = (inner, cls = '') => `<section class="card ${cls}">${inner}</section>`;
  const empty = t => `<p class="empty">${t}</p>`;

  function steps(list, current) {
    const i = list.findIndex(x => x[0] === current);
    return `<ol class="steps">${list.map((x, j) => `<li class="${j < i ? 'done' : j === i ? 'on' : ''}"><span>${j + 1}</span>${x[1]}</li>`).join('')}</ol>`;
  }

  function sumitView(amount, desc, payAct, backAct) {
    return `<div class="sumit">
      <div class="sumit-head"><div><b>סאמיט</b><small>תשלום מאובטח</small></div><span class="demo-badge">דמו, אין חיוב</span></div>
      <div class="sumit-amount"><small>${esc(desc)}</small><b>${money(amount)}</b><small>לתשלום לסטודיו של תמימה</small></div>
      <p class="sumit-method">תשלום בכרטיס אשראי</p>
        <label class="field"><span>מספר כרטיס</span><input inputmode="numeric" placeholder="0000 0000 0000 0000" autocomplete="off"></label>
        <div class="two">
          <label class="field"><span>תוקף</span><input placeholder="MM/YY" autocomplete="off"></label>
          <label class="field"><span>CVV</span><input inputmode="numeric" placeholder="000" autocomplete="off"></label>
        </div>
        <p class="hint">בדמו אפשר להשאיר ריק וללחוץ על תשלום.</p>
      <button class="btn primary block" data-act="${payAct}">תשלום ${money(amount)}</button>
      <button class="btn ghost block" data-act="${backAct}">חזרה</button>
    </div>`;
  }

  /* ---------- זיכוי (החזר) דרך סאמיט ----------
     המערכת מבצעת זיכוי בכרטיס ומפיקה "חשבונית מס קבלה זיכוי" דרך ה-API של סאמיט. תמימה לא נכנסת לסאמיט. */
  const refundsOf = inv => S.refunds.filter(r => r.invoice === inv);
  const refundedOf = inv => refundsOf(inv).reduce((a, r) => a + r.amount, 0);
  // פרטי חשבונית: כרטיסייה של סטודנט, או סדנה מהאתר (לסדנה מהסלון אין זיכוי, ההחזר דרך הסלון)
  function invoiceInfo(inv) {
    const p = S.payments.find(x => x.invoice === inv);
    if (p) { const s = student(p.studentId); return { inv, kind: 'card', p, s, amount: p.amount, date: p.date, name: s.name, to: toStudent(s), desc: `כרטיסייה, ${S.settings.cardSize} שיעורים` }; }
    const w = S.workshops.find(x => x.invoice === inv && isOwn(x));
    if (w) return { inv, kind: 'ws', w, amount: w.amount, date: w.paidAt || w.date, name: w.customer.name, to: toCustomer(w), desc: `סדנת קרמיקה, ${w.n} משתתפים, ${shortDay(w.date)} ${w.time}` };
    return null;
  }
  const refundable = inv => { const i = invoiceInfo(inv); return !!i && refundedOf(inv) < i.amount; };
  // סכום מוצע לפי המדיניות. אפשר לשנות במסך הזיכוי
  function suggestRefund(info) {
    const left = info.amount - refundedOf(info.inv);
    if (info.kind === 'ws') {
      const hrs = (at(info.w.date, info.w.time) - now()) / 36e5;
      return hrs >= S.settings.workshopCancelHours
        ? { amount: left, why: `ביטול יותר מ-${S.settings.workshopCancelHours} שעות לפני הסדנה: החזר מלא.` }
        : { amount: 0, why: `פחות מ-${S.settings.workshopCancelHours} שעות לפני הסדנה: לפי המדיניות אין החזר.` }; // ❓ לאמת מול תמימה
    }
    const s = info.s;
    const pays = S.payments.filter(x => x.studentId === s.id).sort((a, b) => a.date.localeCompare(b.date) || a.invoice - b.invoice);
    const last = pays[pays.length - 1];
    const per = S.settings.cardPrice / S.settings.cardSize;
    if (s.nextPaid && info.p === last) return { amount: left, why: 'כרטיסייה ששולמה מראש ועוד לא התחילה: החזר מלא.' };
    const current = s.owes ? null : s.nextPaid ? pays[pays.length - 2] : last;
    if (info.p === current) {
      const unused = Math.max(0, S.settings.cardSize - s.used);
      return { amount: Math.min(left, unused * per), why: `${unused} שיעורים שלא נוצלו בכרטיסייה × ${money(per)} לשיעור.` };
    }
    return { amount: 0, why: 'כל השיעורים בכרטיסייה הזו כבר נוצלו.' };
  }
  // שורות "זוכה X ₪ · מסמך זיכוי מס׳ Y" ליד החשבונית המקורית
  const refundLines = inv => refundsOf(inv).map(r => `<button class="refund-line" data-act="creditDoc" data-id="${r.id}">זוכה ${money(r.amount)} · מסמך זיכוי מס׳ ${r.creditNo}</button>`).join('');
  function creditDocHtml(r) {
    const info = invoiceInfo(r.invoice);
    return `<div class="invoice credit">
      <div class="inv-head"><b>הסטודיו של תמימה</b><small>${esc(S.content.address)}</small></div>
      <h3>חשבונית מס קבלה זיכוי מס׳ ${r.creditNo}</h3>
      <dl class="kv">
        <dt>תאריך</dt><dd>${dmy(r.date)}.${parse(r.date).getFullYear()}</dd>
        <dt>לכבוד</dt><dd>${esc(info ? info.name : '')}</dd>
        <dt>פירוט</dt><dd>זיכוי לחשבונית מס קבלה מס׳ ${r.invoice}${info ? ` · ${esc(info.desc)}` : ''}</dd>
        <dt>סכום</dt><dd><b>−${money(r.amount)}</b></dd>
        <dt>אמצעי</dt><dd>זיכוי לכרטיס האשראי (סאמיט)</dd>
      </dl>
    </div>`;
  }
  // מייל ביטול סדנה: עם החזר (ומסמך זיכוי) או בלי
  function wsCancelMail(w, refund) {
    email('wsCancelled', toCustomer(w), 'הסדנה בוטלה', [`שלום ${w.customer.name.split(' ')[0]},`, `הסדנה ב${longDay(w.date)}, ${w.time} בוטלה.`,
      refund ? `ההחזר בוצע לכרטיס האשראי (${money(refund.amount)}). מסמך זיכוי מצורף: חשבונית מס קבלה זיכוי מס׳ ${refund.creditNo}.` : '',
      'נשמח לקבוע מועד אחר.'].filter(Boolean));
  }

  function invoiceDoc(inv, name, desc, amount, date) {
    return `<div class="invoice">
      <div class="inv-head"><b>הסטודיו של תמימה</b><small>${esc(S.content.address)}</small></div>
      <h3>חשבונית מס קבלה מס׳ ${inv}</h3>
      <dl class="kv">
        <dt>תאריך</dt><dd>${dmy(date)}.${parse(date).getFullYear()}</dd>
        <dt>לכבוד</dt><dd>${esc(name)}</dd>
        <dt>פירוט</dt><dd>${esc(desc)}</dd>
        <dt>סכום</dt><dd><b>${money(amount)}</b></dd>
        <dt>אמצעי תשלום</dt><dd>כרטיס אשראי (סאמיט)</dd>
      </dl>
    </div>`;
  }

  const GS = window.GSync;
  const gsState = () => (GS ? GS.state() : { status: 'off', calendars: [], pending: 0 });
  let renderPending = false;
  // רינדור אחרי שינוי ברקע, בלי להפריע למי שמקליד בשדה
  function scheduleRender() {
    if (renderPending) return;
    renderPending = true;
    setTimeout(() => {
      renderPending = false;
      const a = document.activeElement;
      if (a && ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName)) { a.addEventListener('blur', scheduleRender, { once: true }); return; }
      render();
    }, 120);
  }

  /* =========================================================
     מיילים אוטומטיים
     כל מייל נכנס לתיבת היוצא (S.mail.outbox). מצבי שליחה:
       הדגמה: לא מחובר לג'ימייל. המייל מוצג רק כאן ובהדגמה המודרכת.
       בדיקה: מחובר. כל מייל נשלח לתיבה של החשבון המחובר, והנמען המקורי כתוב בנושא.
       אמיתי: רק אם config.js מגדיר liveEmail: true. אז המייל נשלח לנמען עצמו.
     ========================================================= */
  const CFG = window.TAMIMA_CONFIG || {};
  const MAIL_KINDS = {
    booking: ['לקוחות', 'אישור הזמנה וחשבונית'],
    wsReminder: ['לקוחות', 'תזכורת יום לפני הסדנה'],
    moved: ['לקוחות', 'שינוי מועד סדנה'],
    wsCancelled: ['לקוחות', 'ביטול סדנה'],
    feedback: ['לקוחות', 'בקשת משוב אחרי הסדנה'],
    receipt: ['לקוחות', 'חשבונית לסדנה מערוץ שותף'],
    refund: ['לקוחות', 'זיכוי והחזר כספי'],
    welcome: ['סטודנטים', 'ברוכים הבאים לקורס'],
    payRequest: ['סטודנטים', 'דרישת תשלום אחרי שיעור 3'],
    payReminder: ['סטודנטים', 'תזכורת תשלום'],
    payReceipt: ['סטודנטים', 'אישור תשלום וחשבונית'],
    refundStudent: ['סטודנטים', 'זיכוי והחזר כספי'],
    lessonCancelledByStudent: ['סטודנטים', 'אישור ביטול שיעור'],
    lessonCancelled: ['סטודנטים', 'ביטול שיעור על ידי הסטודיו'],
    groupMoved: ['סטודנטים', 'שינוי יום או שעה של הקבוצה'],
    makeupGranted: ['סטודנטים', 'השלמה חדשה'],
    makeupExpiring: ['סטודנטים', 'השלמה תפוג בעוד שבוע'],
    closure: ['סטודנטים', 'הסטודיו סגור'],
    newBooking: ['תמימה', 'הזמנה חדשה'],
    newLead: ['תמימה', 'פנייה חדשה לקורס'],
    conflict: ['תמימה', 'התנגשות ביומן'],
    test: ['תמימה', 'מייל בדיקה']
  };
  const MAIL_STATUS = { demo: ['הודגם', 'muted'], queued: ['בתור', 'muted'], sending: ['נשלח...', 'requested'], sent: ['נשלח', 'paid'], failed: ['נכשל', 'overdue'], skipped: ['אין כתובת', 'muted'], off: ['כבוי', 'muted'] };
  const toStudent = s => ({ name: s.name, email: s.email });
  const toCustomer = w => ({ name: w.customer.name, email: w.customer.email });
  const toStudio = () => ({ name: 'תמימה', email: gsState().account || S.mail.studioEmail });
  const pageUrl = file => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}${file}`;
  const siteUrl = hash => pageUrl(APP_MODE === 'demo' ? 'demo-app.html' : 'studio.html') + hash; // לתמימה: הניהול
  const publicUrl = hash => pageUrl('index.html') + hash;                                    // ללקוחות: רק האתר
  function studentUrl(st, page) {                         // לסטודנט: רק האזור האישי שלו
    if (!st.k) st.k = token();
    return `${pageUrl('student.html')}?k=${st.k}#/student/${page}`;
  }

  // תבנית HTML למייל: עיצוב מוטבע (תוכנות מייל מתעלמות מקובצי CSS), מימין לשמאל
  function mailHtml(subject, lines, cta, extra = '') {
    const p = lines.map(l => `<p style="margin:0 0 12px;line-height:1.6">${esc(l)}</p>`).join('');
    const btn = cta ? `<p style="margin:20px 0"><a href="${esc(cta[1])}" style="background:#a5552f;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold;display:inline-block">${esc(cta[0])}</a></p>` : '';
    return `<!doctype html><html lang="he" dir="rtl"><body style="margin:0;background:#f6f0e7;font-family:Arial,Helvetica,sans-serif;color:#2a231d">
      <div style="max-width:560px;margin:0 auto;padding:24px 16px" dir="rtl">
        <div style="font-size:20px;font-weight:bold;color:#7d3b1c;margin-bottom:16px">הסטודיו של תמימה</div>
        <div style="background:#fffcf7;border:1px solid #e6dccd;border-radius:16px;padding:22px">
          <h1 style="font-size:20px;margin:0 0 14px">${esc(subject)}</h1>${p}${extra}${btn}
        </div>
        <p style="font-size:12px;color:#6c5f55;margin-top:16px">הסטודיו של תמימה · ${esc(S.content.address)}<br>המייל נשלח בעקבות הזמנה או הרשמה. <a href="${esc(publicUrl('#/client/privacy'))}" style="color:#7d3b1c">מדיניות פרטיות</a></p>
      </div></body></html>`;
  }

  // הקבלה בגוף המייל (עיצוב מוטבע). בגרסה האמיתית מצורף גם הקובץ שסאמיט הפיק
  function receiptMailHtml(inv, name, desc, amount, date) {
    const row = (k, v) => `<tr><td style="padding:4px 0;color:#6c5f55;width:110px">${k}</td><td style="padding:4px 0">${v}</td></tr>`;
    return `<div style="margin:18px 0;border:1px solid #e6dccd;border-radius:12px;padding:16px;background:#fff" dir="rtl">
      <div style="font-weight:bold;margin-bottom:8px">חשבונית מס קבלה מס׳ ${inv}</div>
      <table style="border-collapse:collapse;font-size:14px;width:100%">${row('תאריך', `${dmy(date)}.${parse(date).getFullYear()}`)}${row('לכבוד', esc(name))}${row('פירוט', esc(desc))}${row('סכום', `<b>${money(amount)}</b>`)}${row('אמצעי תשלום', 'כרטיס אשראי (סאמיט)')}</table></div>`;
  }

  function email(kind, to, subject, lines, opts = {}) {
    const item = { id: uid('m'), kind, to: (to && to.email) || '', toName: (to && to.name) || '', subject, text: lines.join('\n'), html: mailHtml(subject, lines, opts.cta, opts.extra), cta: opts.cta || null, extra: opts.extra || '', at: new Date(), status: 'queued', mode: '', error: '' };
    S.mail.outbox.unshift(item);
    if (S.mail.auto[kind] === false) { item.status = 'off'; log('sync', `לא נשלח: ${MAIL_KINDS[kind][1]}`, `האוטומציה כבויה ב"עוד" > "מיילים".`); return item; }
    log(MAIL_KINDS[kind][0] === 'לקוחות' ? 'mail-client' : MAIL_KINDS[kind][0] === 'סטודנטים' ? 'mail-student' : 'notify', `${MAIL_KINDS[kind][1]} · ${item.toName}`, item.text);
    deliver(item);
    return item;
  }
  async function deliver(item) {
    const g = gsState();
    if (!item.to) { item.status = 'skipped'; item.error = 'לנמען אין כתובת מייל.'; return; }
    if (!(GS && g.status === 'connected' && g.gmail)) { item.status = 'demo'; return; }
    item.mode = CFG.liveEmail ? 'live' : 'test';
    const target = item.mode === 'live' ? item.to : g.account;
    item.status = 'sending';
    scheduleRender();
    try {
      await GS.sendMail({ to: target, toName: item.toName, subject: item.mode === 'test' ? `[בדיקה · אל ${item.to}] ${item.subject}` : item.subject, html: item.html, text: item.text });
      item.status = 'sent';
      item.sentAt = new Date();
    } catch (e) { item.status = 'failed'; item.error = e.message; }
    scheduleRender();
  }

  // אוטומציות שתלויות בזמן. רצות כל דקה, אחרי "קדם זמן", ובטעינה.
  function runAutomations() {
    const n = now().getTime();
    pruneHolds();
    activeWorkshops().forEach(w => {
      const start = at(w.date, w.time).getTime(), end = wEnd(w).getTime();
      if (!w.reminderSent && start > n && start - n <= 24 * 36e5) {
        w.reminderSent = true;
        email('wsReminder', toCustomer(w), `תזכורת: הסדנה שלכם מחר, ${w.time}`, [`שלום ${w.customer.name.split(' ')[0]},`, `מחכים לכם ב${longDay(w.date)}, ${w.time} עד ${endOf(w.time)}.`, `הכתובת: ${S.content.address}.`, 'כדאי להגיע בבגדים שלא אכפת ללכלך.']);
      }
      if (!w.feedbackSent && !w.feedbackAuto && n - end >= 2 * 36e5 && n - end <= 48 * 36e5) {
        w.feedbackSent = true;
        email('feedback', toCustomer(w), 'איך היה בסדנה?', [`שלום ${w.customer.name.split(' ')[0]},`, 'תודה שהגעתם לסטודיו! נשמח לשמוע איך היה, בכמה מילים.', 'הכלים שלכם יהיו מוכנים לאיסוף אחרי הייבוש והשריפה בתנור. נעדכן כשהם מוכנים.']);
      }
    });
    S.makeups.forEach(m => {
      const s = student(m.studentId);
      if (!s || s.active === false || m.bookedLessonId || m.warned) return;
      const left = (parse(m.expires) - startOfToday()) / 864e5;
      if (left >= 0 && left <= 7) {
        m.warned = true;
        email('makeupExpiring', toStudent(s), 'ההשלמה שלך תפוג בעוד שבוע', [`היי ${first(s)},`, `יש לך השלמה שבתוקף עד ${longDay(m.expires)}.`, 'אפשר לקבוע אותה עכשיו, בקבוצה אחרת שיש בה מקום.'], { cta: ['לקביעת השלמה', studentUrl(s, 'lessons')] });
      }
    });
    S.students.filter(s => s.active !== false && payStatus(s).key === 'overdue' && !s.autoReminded).forEach(s => {
      s.autoReminded = true;
      email('payReminder', toStudent(s), 'תזכורת: הכרטיסייה מחכה לתשלום', [`היי ${first(s)},`, `הכרטיסייה הבאה (${money(S.settings.cardPrice)}) עוד לא שולמה.`, 'אפשר לשלם בכרטיס אשראי בקישור המאובטח:'], { cta: ['לתשלום בסאמיט', studentUrl(s, 'pay')] });
    });
  }

  const IMG = n => `img/${n}.jpg`;
  const IMGS = n => `img/${n}-s.jpg`;
  const ICON = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    classes: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8"/><circle cx="17" cy="9.5" r="2.3"/><path d="M15.8 14.4c2.3.2 4 1.8 4.6 4.6"/>',
    workshops: '<path d="M4 11h16c0 4.4-3.6 8-8 8s-8-3.6-8-8Z"/><path d="M8 7c0-1.5 1-2 1-3.5M12 7c0-1.5 1-2 1-3.5M16 7c0-1.5 1-2 1-3.5"/>',
    receipts: '<path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2Z"/><path d="M9 8.5h6M9 12h6"/>',
    more: '<circle cx="5.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.5" cy="12" r="1.4"/>',
    lessons: '<path d="M4 5.5c2.7-1 5.3-1 8 .7 2.7-1.7 5.3-1.7 8-.7v13c-2.7-1-5.3-1-8 .7-2.7-1.7-5.3-1.7-8-.7Z"/><path d="M12 6.2v13"/>',
    payments: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10.5h18M7 15h4"/>'
  };
  const icon = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[n] || ''}</svg>`;

  function appNav(role, page, items) {
    return `<nav class="appnav" aria-label="ניווט ראשי">${items.map(([id, label, badge]) =>
      `<a href="#/${role}/${id}" class="${page === id ? 'on' : ''}" ${page === id ? 'aria-current="page"' : ''}>${icon(id)}<span>${label}</span>${badge ? `<i><span class="sr-only">, ממתינות </span>${badge}</i>` : ''}</a>`).join('')}</nav>`;
  }
  function appHead(photo, title, sub, extra = '') {
    return `<header class="app-head" data-photo-bg="0.66">
      <div class="app-head-bg"><img src="${IMG(photo)}" alt=""></div>
      <div class="app-head-inner">
        <div class="app-head-top"><span class="brand light"><span class="logo small" aria-hidden="true">ת</span><span><b>הסטודיו של תמימה</b></span></span>${extra}</div>
        <p class="app-hello">${title}</p><p>${sub}</p>
      </div>
    </header>`;
  }

  // לוח שנה קטן לבחירת יום: שבוע בכל שורה. ימים עם מועד פנוי ניתנים ללחיצה, ושאר הימים מעומעמים
  function dayPlan(avail, selected) {
    if (!avail.length) return '';
    const set = new Set(avail);
    const first = parse(avail[0]), last = parse(avail[avail.length - 1]);
    const from = addDays(first, -first.getDay()), to = addDays(last, 6 - last.getDay());
    const months = [...new Set([first.getMonth(), last.getMonth()])].map(m => MONTHS[m]).join(' עד ');
    const cells = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const k = iso(d);
      const mon = d.getDate() === 1 ? `<small>${MONTHS[d.getMonth()]}</small>` : '';
      if (set.has(k)) cells.push(`<button class="daycell${k === selected ? ' on' : ''}" data-act="bkDate" data-date="${k}" aria-label="${longDay(k)}" ${k === selected ? 'aria-pressed="true"' : 'aria-pressed="false"'}><b>${d.getDate()}</b>${mon}</button>`);
      else cells.push(`<span class="daycell off" aria-hidden="true">${k < todayIso() ? '' : `<b>${d.getDate()}</b>${mon}`}</span>`);
    }
    return `<p class="dayplan-month">${months}</p>
      <div class="dayplan" role="group" aria-label="ימים עם מועד פנוי">${DAYS_SHORT.map(x => `<span class="dh" aria-hidden="true">${x}</span>`).join('')}${cells.join('')}</div>`;
  }

  function calWeek() {
    const t = startOfToday();
    const ws = addDays(t, -t.getDay() + ui.weekOffset * 7);
    return [0, 1, 2, 3, 4, 5, 6].map(i => iso(addDays(ws, i)));
  }
  /* =========================================================
     עריכה מלאה לתמימה
     כל פעולה משנה את מקור הנתונים היחיד (S) ואת היומן (ודרכו את גוגל),
     ולכן כל המסכים (תמימה, סטודנט, אתר, יומן, מדדים) מתעדכנים ברינדור הבא.
     ========================================================= */
  const activeGroups = () => S.groups.filter(g => g.active !== false).sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
  const activeWorkshops = () => S.workshops.filter(w => w.status !== 'cancelled');
  const EMAIL_OK = v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());
  // שעות החוגים לאתר, נגזרות מהקבוצות (משתנה אוטומטית כשתמימה עורכת קבוצה)
  function classDaysText() {
    const gs = activeGroups();
    const names = [...new Set(gs.map(g => DAYS[g.day]))];
    return names.length > 1 ? `${names.slice(0, -1).join(', ')} או ${names[names.length - 1]}` : (names[0] || '');
  }
  function classHoursText() {
    const gs = activeGroups();
    if (!gs.length) return 'יתעדכן בקרוב';
    const same = gs.every(g => g.start === gs[0].start && g.end === gs[0].end);
    const names = [...new Set(gs.map(g => DAYS[g.day]))];
    const days = names.length > 1 ? `${names.slice(0, -1).join(', ')} ו${names[names.length - 1]}` : names[0];
    return same ? `${days} · ${gs[0].start} עד ${gs[0].end}` : gs.map(g => `${DAYS[g.day]} ${g.start}`).join(', ');
  }

  /* ---------- תוכן האתר ---------- */
  const PHOTOS = { 'hands-clay': 'ידיים לשות חימר', 'wheel-hands': 'עבודה על האובניים', 'tamima-wheel': 'תמימה ליד האובניים', 'tamima-stack': 'תמימה בסטודיו', 'bowls-green': 'קערות בגלזורה ירוקה', 'cups-hands': 'כוסות קרמיקה בידיים', 'cups-grass': 'כוסות על הדשא', 'bowl-underside': 'תחתית קערה', 'shelf-faces': 'פסלים על המדף', 'bowls-lap': 'קערות על הברכיים', 'wheel-vase': 'אגרטל על האובניים', 'vase-glaze': 'אגרטל עם גלזורה', 'wheel-trim': 'גימור על האובניים', 'plate-apron': 'צלחת וסינר', 'bowl-hand': 'קערה ביד', 'bowls-raise': 'קערות מורמות' };
  function hideSnack() {
    const el = $('#snack');
    if (el) el.classList.remove('show');
    ui.undo = null;
  }
  function snack(text, undoFn) {
    let el = $('#snack');
    if (!el) { el = document.createElement('div'); el.id = 'snack'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    ui.undo = undoFn || null;
    el.innerHTML = `<span>${esc(text)}</span>${undoFn ? '<button data-act="undo">ביטול</button>' : ''}<button class="x-btn" data-act="snackClose" aria-label="סגירת ההודעה">×</button>`;
    el.classList.add('show');
    clearTimeout(ui.snackT);
    ui.snackT = setTimeout(hideSnack, 8000);
  }
  function punchDots(s) {
    const n = S.settings.cardSize;
    return `<div class="punch-dots">${Array.from({ length: n }, (_, i) => `<span class="${i < s.used ? 'on' : ''}"></span>`).join('')}</div>`;
  }
  function toast(title, body) {
    if (!ui.guided) return;
    const el = $('#toast');
    el.innerHTML = `<div class="toast-card"><button class="x-btn" data-act="toastClose" aria-label="סגירת ההתראה">×</button><small>התראה לתמימה</small><b>${esc(title)}</b><p>${esc(body)}</p></div>`;
    el.classList.add('show');
    clearTimeout(ui.toastTimer);
    ui.toastTimer = setTimeout(() => el.classList.remove('show'), 5000);
  }

  /* ---------- חלונית (sheet) ---------- */
  // חלון נגיש: role="dialog", הרקע לא נגיש (inert) בזמן שהחלון פתוח, מיקוד על הכותרת, Esc סוגר, והמיקוד חוזר למי שפתח
  let sheetOpener = null;
  function openSheet(fn) {
    if (!ui.sheet) sheetOpener = document.activeElement;
    ui.sheet = fn;
    renderSheet();
    if (typeof renderGuide === 'function') renderGuide(route());
    const h = document.querySelector('.sheet-card h2, .sheet-card h3');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
  }
  function closeSheet() {
    if (ui.rf && ui.rf.wsId) { const w = workshop(ui.rf.wsId); ui.rf = null; if (w) wsCancelMail(w, null); }
    ui.rf = null;
    ui.sheet = null;
    renderSheet();
    if (sheetOpener && document.contains(sheetOpener)) sheetOpener.focus();
    sheetOpener = null;
  }
  function renderSheet() {
    const el = $('#sheet');
    const html = ui.sheet && ui.sheet();
    const keep = document.activeElement && el.contains(document.activeElement) ? document.activeElement.getAttribute('data-bind') || document.activeElement.getAttribute('data-act') : null;
    const bg = [$('#layout'), $('#demobar')];
    if (!html) { ui.sheet = null; el.innerHTML = ''; el.classList.remove('open'); bg.forEach(b => b && (b.inert = false)); return; }
    el.innerHTML = `<div class="sheet-back" data-act="closeSheet" data-kbd-alt="Esc"></div><div class="sheet-card" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><button class="sheet-x" data-act="closeSheet" aria-label="סגירת החלון">×</button>${html}</div>`;
    const h = el.querySelector('.sheet-card h2, .sheet-card h3');
    if (h) h.id = 'sheet-title';
    el.classList.add('open');
    bg.forEach(b => b && (b.inert = true));
    if (keep) { const k = el.querySelector(`[data-bind="${keep}"], [data-act="${keep}"]`); if (k) k.focus(); }
  }

  /* ---------- פעולות ---------- */
  const A = {
    closeSheet,
    guideToggle() { ui.guideOpen = !ui.guideOpen; render(); },
    gsecToggle(d) { const cur = document.querySelector(`[data-act="gsecToggle"][data-k="${d.k}"]`); ui.gsec[d.k] = !(cur && cur.getAttribute('aria-expanded') === 'true'); renderGuide(route()); const b = document.querySelector(`[data-act="gsecToggle"][data-k="${d.k}"]`); if (b) b.focus(); },
    calMsgClose() { ui.calMsg = ''; render(); },
    snackClose() { hideSnack(); },
    toastClose() { $('#toast').classList.remove('show'); },
    flashClose() { ui.stuMsg = null; render(); },
    moreTab(d) { ui.moreTab = d.t; render(); },
    chToggle(d) { ui.chOpen[d.id] = !ui.chOpen[d.id]; if (ui.chMsg && ui.chMsg.id === d.id) ui.chMsg = null; render(); ui.focusSel = `[data-act="chToggle"][data-id="${d.id}"]`; focusPending(); },

  };
  function flashClear() { clearTimeout(ui.flashT); ui.flashT = setTimeout(() => { ui.stuMsg = null; if (route().role === 'student') render(); }, 6000); }
  function scrollTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

