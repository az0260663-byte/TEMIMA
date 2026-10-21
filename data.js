/* data.js: מקור הנתונים היחיד של הדמו. הכל נבנה יחסית להיום, כך שהשיעורים נופלים תמיד על הימים הנכונים. */
(function () {
  'use strict';

  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const fromMin = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const at = (date, time) => { const d = parse(date); const m = toMin(time); d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d; };
  // "היום" לפי השעון של שכבת היומן, כדי שכפתור "קדם זמן" יזיז את כל הדמו יחד
  const clockNow = () => window.GCal.clock.now();
  const startOfToday = () => { const d = clockNow(); d.setHours(0, 0, 0, 0); return d; };

  // שעות התחלה אפשריות לסדנה (שעתיים) לפי יום בשבוע. שבת סגור.
  const SLOT_TIMES = {
    0: ['10:00', '12:30', '15:00', '18:00'],
    1: ['10:00', '12:30', '15:00', '18:00'],
    2: ['10:00', '12:30', '15:00', '18:00'],
    3: ['10:00', '12:30', '15:00', '18:00'],
    4: ['10:00', '12:30', '15:00', '18:00'],
    5: ['10:00', '12:00'],
    6: []
  };
  const WORKSHOP_MIN = 120;

  let LOCATION = 'דרך בלפור, גבעת רם, ירושלים';
  const setLocation = v => { LOCATION = v; };
  const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

  // משאבי Event בפורמט Google Calendar. משמשים גם בזריעה וגם באפליקציה.
  // חוג: אירוע חוזר שבועי. כששעה או יום משתנים, הסדרה הישנה מסתיימת ונפתחת חדשה (היסטוריה נשמרת).
  function classEvent(g, id, fromDate) {
    const TZ = window.GCal.TZ;
    return {
      id,
      summary: `חוג קרמיקה: ${g.name}`,
      location: LOCATION,
      colorId: '9',
      start: { dateTime: `${fromDate}T${g.start}:00`, timeZone: TZ },
      end: { dateTime: `${fromDate}T${g.end}:00`, timeZone: TZ },
      recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[g.day]}`],
      extendedProperties: { private: { app: 'tamima-studio', kind: 'class', groupId: g.id } }
    };
  }
  const channelName = id => { const ch = window.GCal.channels.get(id); return ch ? ch.name : id; };
  function workshopEvent(w) {
    const TZ = window.GCal.TZ;
    const end = fromMin(toMin(w.time) + WORKSHOP_MIN);
    const own = w.source === 'site';
    return {
      id: w.eventId,
      summary: `סדנה ${own ? 'מהאתר' : '· ' + channelName(w.source)}: ${w.customer.name} (${w.n})`,
      description: [`${w.n} משתתפים`, w.customer.phone && `טלפון: ${w.customer.phone}`, own ? 'שולמה באתר' : `שולמה בערוץ "${channelName(w.source)}"`].filter(Boolean).join('\n'),
      location: LOCATION,
      colorId: own ? '6' : '3',
      start: { dateTime: `${w.date}T${w.time}:00`, timeZone: TZ },
      end: { dateTime: `${w.date}T${end}:00`, timeZone: TZ },
      extendedProperties: { private: { app: 'tamima-studio', kind: 'workshop', source: w.source, workshopId: w.id, participants: String(w.n) } }
    };
  }
  // תאימות: משאב משבצת של ערוץ "בסלון". המשבצות עצמן נכתבות דרך GCal.channels.assign.
  function salonSlotEvent(date, time) {
    const TZ = window.GCal.TZ;
    return {
      summary: 'משבצת פנויה לסדנה · בסלון',
      description: 'משבצת פנויה בסטודיו של תמימה. כשהיא נתפסת היא יורדת מכל היומנים.',
      location: LOCATION,
      colorId: '5',
      transparency: 'transparent',
      start: { dateTime: `${date}T${time}:00`, timeZone: TZ },
      end: { dateTime: `${date}T${fromMin(toMin(time) + WORKSHOP_MIN)}:00`, timeZone: TZ },
      extendedProperties: { private: { app: 'tamima-studio', kind: 'slot', channel: 'salon' } }
    };
  }

  function seed() {
    window.GCal.reset(); // מאפס גם את השעון המדומה, לפני שמחשבים את "היום"
    LOCATION = 'דרך בלפור, גבעת רם, ירושלים';
    const today = startOfToday();
    const now = clockNow();

    const settings = {
      price2: 680,          // ❓ לאמת: מחיר לזוג
      pricePer: 300,        // ❓ לאמת: למשתתף, 3 עד 6
      cardPrice: 800,
      cardSize: 4,
      workshopCancelHours: 48, // ❓ לאמת
      lessonCancelHours: 24,
      defaultMax: 6,
      whatsapp: '058-4194727',    // הטלפון והוואטסאפ של תמימה: בתחתית האתר, ולפניות של לקוחות
      stopParticipationFee: 200,  // ניכוי בהפסקת השתתפות ביוזמת הסטודיו
      policyVersion: '26-27',     // גרסת מדיניות הביטולים שהסטודנט מאשר
      // קופונים לסדנה. בדיקה: TEST679 מוריד 679 ₪ (לפחות 1 ₪ לתשלום). אותו קוד מוגדר גם בשרת, שקובע את הסכום בסליקה האמיתית
      coupons: [{ code: 'TEST679', off: 679 }]
    };

    const groups = [
      { id: 'sun', name: 'קבוצת ראשון', day: 0, start: '17:30', end: '20:00', max: 6, active: true },
      { id: 'mon', name: 'קבוצת שני', day: 1, start: '17:30', end: '20:00', max: 6, active: true },
      { id: 'tue', name: 'קבוצת שלישי', day: 2, start: '17:30', end: '20:00', max: 6, active: true }
    ];

    // נתוני הדגמה: שני סטודנטים (אישה וגבר), כל אחד מראה מצב תשלום אחר. תמימה מוסיפה עוד במערכת או דרך האתר
    // [שם, קבוצה, שיעורים שנוצלו, הכרטיסייה הבאה שולמה, נשלחה דרישת תשלום]
    const rows = [
      ['נועה לוי', 'mon', 3, false, true],   // אחרי שיעור 3: נשלחה דרישת תשלום
      ['דניאל כהן', 'sun', 4, false, false]  // שיעור 4 בלי תשלום: דורש טיפול
    ];
    const counters = { sun: 0, mon: 0, tue: 0 };
    const students = rows.map(([name, groupId, used, nextPaid, requestSent], i) => {
      counters[groupId]++;
      return {
        id: `${groupId}${counters[groupId]}`,
        name, groupId, used, nextPaid, requestSent,
        owes: false, reminded: null, active: true, notes: '', joined: iso(addDays(today, -(60 + i * 9))), start: iso(addDays(today, -(60 + i * 9))),
        phone: `05${2 + (i % 4)}-${String(3104417 + i * 7331).slice(0, 7)}`,
        email: `student${i + 1}@example.com`
      };
    });

    // שיעורים: 5 שבועות אחורה ו-8 שבועות קדימה, לפי יום הקבוצה
    const lessons = [];
    groups.forEach(g => {
      let d = addDays(today, -35);
      while (d.getDay() !== g.day) d = addDays(d, 1);
      for (; d <= addDays(today, 56); d = addDays(d, 7)) {
        lessons.push({ id: `${g.id}_${iso(d)}`, groupId: g.id, date: iso(d) });
      }
    });
    lessons.sort((a, b) => a.date.localeCompare(b.date));

    // נוכחות: שיעורים שעברו מסומנים, חוץ מהאחרון בכל קבוצה (מחכה לסימון של תמימה)
    const attendance = {};
    groups.forEach(g => {
      const mine = lessons.filter(l => l.groupId === g.id);
      const hasToday = mine.some(l => l.date === iso(today));
      const ended = mine.filter(l => at(l.date, g.end) < now && l.date !== iso(today));
      ended.forEach((l, i) => {
        const pending = !hasToday && i === ended.length - 1;
        attendance[l.id] = pending
          ? { marked: false, rec: {} }
          : { marked: true, rec: Object.fromEntries(students.filter(s => s.groupId === g.id).map(s => [s.id, 'arrived'])) };
      });
    });

    // השלמות: אין עדיין
    const makeups = [];

    // תשלומים: כרטיסייה נוכחית לכל סטודנט, ועוד אחת למי שכבר שילם על הבאה
    const pays = [];
    students.forEach(s => {
      pays.push({ studentId: s.id, date: iso(addDays(today, -Math.min(s.used * 7 + 3, today.getDate() - 1))) });
      if (s.nextPaid) pays.push({ studentId: s.id, date: iso(addDays(today, -2)) });
      if (s.name === 'נועה לוי') pays.push({ studentId: s.id, date: iso(addDays(today, -45)) });
    });
    pays.sort((a, b) => a.date.localeCompare(b.date));
    let invoice = 1001;
    const payments = pays.map((p, i) => ({ id: `p${i + 1}`, studentId: p.studentId, date: p.date, amount: settings.cardPrice, invoice: invoice++ }));

    // סדנאות, חסימות ומשבצות לסלון, ממוקמות בלי התנגשויות
    const workshops = [];
    const blocks = [];
    const salonOpen = [];
    const busyOn = date => {
      const out = [];
      lessons.filter(l => l.date === date).forEach(() => out.push([toMin('17:30'), toMin('20:00')]));
      workshops.filter(w => w.date === date).forEach(w => out.push([toMin(w.time), toMin(w.time) + WORKSHOP_MIN]));
      blocks.filter(b => b.date === date).forEach(b => out.push([toMin(b.start), toMin(b.end)]));
      salonOpen.filter(o => o.date === date).forEach(o => out.push([toMin(o.time), toMin(o.time) + WORKSHOP_MIN]));
      return out;
    };
    function place(offset, prefer) {
      let d = addDays(today, offset);
      if (d.getDay() === 6) d = addDays(d, offset < 0 ? -1 : 1);
      const date = iso(d);
      const times = SLOT_TIMES[d.getDay()].slice();
      times.sort((a, b) => (a === prefer ? -1 : b === prefer ? 1 : 0));
      const b = busyOn(date);
      const time = times.find(t => !b.some(([s, e]) => toMin(t) < e && s < toMin(t) + WORKSHOP_MIN));
      return time ? { date, time } : null;
    }
    const price = n => (n === 2 ? settings.price2 : n * settings.pricePer);
    // נתוני הדגמה: שתי סדנאות (אישה וגבר). [ימים מהיום, שעה מועדפת, ערוץ, משתתפים, שם]
    const ws = [
      [3, '12:30', 'site', 3, 'מיכל אברהם'],   // קרובה, מהאתר: שולמה וקבלה אוטומטית
      [-3, '15:00', 'salon', 4, 'יוסי מזרחי']  // עברה, מ"בסלון": מחכה לקבלה ידנית
    ];
    const customers = [];
    ws.forEach(([off, t, source, n, name], i) => {
      const p = place(off, t);
      if (!p) return;
      const past = at(p.date, fromMin(toMin(p.time) + WORKSHOP_MIN)) < now;
      workshops.push({
        id: `w${i + 1}`, source, date: p.date, time: p.time, n, amount: price(n),
        customer: { name, phone: `05${i % 5}-${String(2210934 + i * 5113).slice(0, 7)}`, email: `client${i + 1}@example.com` },
        status: 'confirmed', paid: true,
        receipt: source === 'site' ? 'auto' : 'pending',
        invoice: source === 'site' ? invoice++ : null,
        feedbackSent: past && source === 'site'
      });
      // כרטיס לקוח לכל מי שהזמין, כמו בהזמנה אמיתית
      const w = workshops[workshops.length - 1];
      const c = { id: `c${i + 1}`, name, phones: [w.customer.phone.replace(/\D/g, '')], email: w.customer.email, sumitIds: [], lateMoveUsed: '', studentId: null, since: p.date < iso(today) ? p.date : iso(today), notSame: [] };
      customers.push(c);
      w.customerId = c.id;
    });

    // בלי אירועים לדוגמה ביומן הסטודיו וביומן האישי
    const external = null, personal = null;

    /* ---------- כתיבה ליומן דרך שכבת ה-API ---------- */
    const G = window.GCal;
    G.silent = true;
    G.channels.configure({ times: SLOT_TIMES, minutes: WORKSHOP_MIN, horizonDays: 21, location: LOCATION });
    const TZ = G.TZ;
    const dt = (date, time) => ({ dateTime: `${date}T${time}:00`, timeZone: TZ });
    const APP = 'tamima-studio';

    groups.forEach(g => {
      const firstLesson = lessons.find(l => l.groupId === g.id);
      g.eventId = G.b32hex(`class-${g.id}`);
      g.masters = [{ id: g.eventId, from: firstLesson.date, start: g.start }];
      G.events.insert({ calendarId: G.CAL.classes, requestBody: classEvent(g, g.eventId, firstLesson.date) });
    });
    workshops.forEach(w => {
      w.eventId = G.b32hex(`ws-${w.id}`);
      G.events.insert({ calendarId: G.CAL.studio, requestBody: workshopEvent(w) });
    });
    blocks.forEach(b => {
      G.events.insert({ calendarId: G.CAL.studio, requestBody: {
        summary: b.note || 'חסימה אישית', colorId: '8', visibility: 'private',
        start: dt(b.date, b.start), end: dt(b.date, b.end),
        extendedProperties: { private: { app: APP, kind: 'block' } }
      } });
    });
    salonOpen.forEach(o => G.channels.assign(o.date, o.time, 'salon'));
    if (personal) {
      G.events.insert({ calendarId: G.CAL.personal, requestBody: { summary: 'ארוחת צהריים עם אמא', visibility: 'private', start: dt(personal.date, personal.start), end: dt(personal.date, personal.end) } });
    }
    if (external) {
      G.events.insert({ calendarId: G.CAL.studio, requestBody: {
        summary: 'פגישה עם ספק חימר', start: dt(external.date, external.start), end: dt(external.date, external.end)
      } });
    }
    G.channels.tick(); // מילוי ראשוני: כל זמן פנוי שלא שייך לערוץ נפתח באתר
    G.silent = false;

    const content = {
      heroEyebrow: 'סטודיו לקרמיקה · גבעת רם, ירושלים',
      heroTitle: 'יוצרים בחימר,',
      heroAccent: 'בקצב שלכם.',
      heroText: 'סדנאות היכרות וקורס שבועי בסטודיו קטן ושקט, עם ידיים בחימר ואובניים שמסתובבים לאט.',
      heroImage: 'hands-clay',
      workshopTitle: 'סדנת היכרות',
      workshopImage: 'wheel-hands',
      courseTitle: 'קורס שיעורים',
      courseText: 'שיעור שבועי של שעתיים וחצי. כרטיסייה של 4 שיעורים, תשלום בכרטיס אשראי.',
      courseImage: 'tamima-wheel',
      studioTitle: 'מקום קטן, הרבה חימר.',
      studioText: 'הסטודיו נמצא בגבעת רם, בין עצים ואור טבעי. עובדים בקבוצות קטנות, כך שיש זמן לכל אחד ליד האובניים.',
      ctaTitle: 'מוכנים ללכלך את הידיים?',
      ctaText: 'קבוצה גדולה, עד 12 משתתפים? נשמח לתאם ישירות מול תמימה.',
      address: LOCATION,
      gallery: ['cups-grass', 'bowl-underside', 'shelf-faces', 'bowls-lap', 'wheel-vase', 'vase-glaze', 'cups-hands', 'wheel-trim']
    };

    return {
      settings, groups, students, lessons, attendance, makeups, payments,
      workshops, content, log: [],
      // נתוני הדגמה: פנייה חדשה לקורס מהאתר, מחכה שתמימה תחזור אליה
      leads: [{ id: 'ld1', name: 'שירה גולן', phone: '054-7781203', email: 'lead1@example.com', group: 'tue', handled: false, status: 'new', at: iso(addDays(today, -1)) }], nextInvoice: invoice, seq: 1,
      customers,        // כרטיסי לקוחות: { id, name, phones, email, sumitIds (מזהי הלקוח בסאמיט), lateMoveUsed, studentId, since }
      refundCases: [],
      privacyRequests: [], // בקשות עיון או מחיקה מהאזור האישי
      audit: [],        // יומן פעולות: { at, action, who, target }  // זיכוי ממתין להחלטה: { id, inv, reason, suggested, status, wsId, studentId }
      refunds: [],      // זיכויים: { invoice, amount, date, creditNo, reason }
      nextCredit: 5001  // מספור נפרד למסמכי זיכוי
    };
  }

  window.DEMO = { seed, workshopEvent, salonSlotEvent, classEvent, setLocation, BYDAY, channelName, clockNow, iso, parse, addDays, addMonths, toMin, fromMin, at, startOfToday, SLOT_TIMES, WORKSHOP_MIN };
})();
