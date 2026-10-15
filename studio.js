/* studio.js: הניהול של תמימה בלבד. בית, יומן, חוגים, סדנאות, קבלות, הגדרות וחיבור לגוגל. */
'use strict';

  /* ---------- מסך הזיכוי ----------
     הסכום מוצע (או ריק), ותמימה משנה אותו כרצונה. נחסם רק סכום מעל היתרה שלא זוכתה, כי סאמיט לא יאפשרו אותו.
     שלוש החלטות: "ביצוע זיכוי" (הקריאה היחידה לזיכוי בסאמיט), "ללא החזר", "אחר כך". */
  function refundSheetHtml() {
    const f = ui.rf;
    const info = f && invoiceInfo(f.inv);
    if (!info) return '';
    const done = refundedOf(f.inv), left = info.amount - done;
    const x = f.caseId && refundCase(f.caseId);
    const w = f.wsId && workshop(f.wsId);
    const cu = w && customerOf(w);
    const title = f.late ? 'פנייה מאוחרת מהלקוח' : f.reason && f.reason !== 'manual' ? `זיכוי ממתין להחלטה · ${REFUND_REASON[f.reason]}` : `זיכוי לחשבונית מס׳ ${f.inv}`;
    const late = f.late && w && w.status !== 'cancelled' ? `<div class="policy"><b>הזזה למועד אחר (חד פעמי)</b>במקום ביטול: הסדנה עוברת למועד אחר, והחשבונית נשארת.</div>
        ${cu && cu.lateMoveUsed ? `<p class="policy warn">כבר ניתנה הזזה חד פעמית ב-${dmy(cu.lateMoveUsed)}.${parse(cu.lateMoveUsed).getFullYear()}.</p>` : ''}
        <button class="btn primary block" data-act="lateMove">הזזה למועד אחר (חד פעמי)</button><h3>או ביטול</h3>` : '';
    return `<h2>${title}</h2>
      <p class="muted">${esc(info.name)} · ${esc(info.desc)}</p>
      ${x && x.status === 'failed' ? `<p class="err">הניסיון הקודם נכשל: ${esc(x.error)}</p>` : ''}
      ${late}
      <dl class="kv">
        <dt>חשבונית</dt><dd>מס׳ ${f.inv} · ${money(info.amount)}</dd>
        ${done ? `<dt>זוכה עד עכשיו</dt><dd>${money(done)}</dd>` : ''}
        <dt>יתרה שלא זוכתה</dt><dd><b>${money(left)}</b></dd>
      </dl>
      ${f.suggested != null ? `<div class="policy"><b>סכום מוצע: ${money(f.suggested)}</b>${esc(f.why || '')}</div>` : ''}
      <label class="field"><span>סכום הזיכוי</span><span class="with-suffix"><input type="number" min="0" step="1" inputmode="decimal" data-bind="rf.amount" value="${esc(f.amount)}" ${invAttr('rf', 'amount')}>₪</span></label>
      ${f.info ? `<p class="muted small">${esc(f.info)}</p>` : ''}
      ${errP('rf')}
      <button class="btn primary block" data-act="refundDo" data-needs="rf.amount" ${String(f.amount).trim() ? '' : 'disabled'}>ביצוע זיכוי</button>
      <button class="btn ghost block" data-act="refundSkip">${f.late && w && w.status !== 'cancelled' ? 'ביטול הסדנה ללא החזר' : 'ללא החזר'}</button>
      <button class="btn ghost block" data-act="refundLater">אחר כך</button>
      ${ui.guided ? '<div class="demo-note"><b>מאחורי הקלעים</b><p>המערכת פותחת את הזיכוי לתמימה. ההחזר יוצא רק אחרי אישור שלה, בקריאה אחת ל-API של סאמיט שמחזירה את הכסף ומפיקה מסמך זיכוי.</p></div>' : ''}`;
  }
  // פתיחת מסך הזיכוי. אם כבר יש לחשבונית זיכוי שממתין להחלטה, נפתח אותו
  function openRefund(inv, o = {}) {
    const info = invoiceInfo(inv);
    if (!info) return;
    const open = !o.caseId && openRefundCases().find(x => x.inv === inv);
    if (open) return openCaseSheet(open.id);
    const sug = o.reason ? o.suggested : suggestRefund(info);
    const suggested = o.reason ? (sug == null ? null : sug) : sug.amount;
    ui.rf = { inv, caseId: o.caseId || null, wsId: o.wsId || null, studentId: o.studentId || null, late: !!o.late, reason: o.reason || 'manual', suggested,
      why: o.reason ? o.why || '' : sug.why, info: o.info || '', amount: suggested == null ? '' : String(Math.round(suggested * 100) / 100), err: '', errField: '' };
    openSheet(refundSheetHtml);
  }
  function openCaseSheet(id) {
    const x = refundCase(id);
    if (!x) return;
    openRefund(x.inv, { caseId: x.id, wsId: x.wsId, studentId: x.studentId, late: x.late, reason: x.reason, suggested: x.suggested, why: x.why, info: x.info });
    if (x.status === 'failed' && x.amountTried) ui.rf.amount = String(x.amountTried);
    renderSheet();
  }
  /* ================= חיבור ליומן גוגל האמיתי (gsync.js) ================= */
  const gsLive = () => ['connected', 'syncing'].includes(gsState().status);
  const GS_STATUS = { off: 'לא מחובר', connecting: 'מתחבר...', authorized: 'מחובר לחשבון, צריך לבחור יומן', syncing: 'מסנכרן...', connected: 'מחובר ומסונכרן', reauth: 'צריך להתחבר מחדש' };
  function gsPill() {
    const g = gsState();
    if (g.status === 'off') return '';
    if (g.status === 'reauth') return `<button class="gs-pill warn" data-act="gsReconnect">צריך להתחבר מחדש ליומן גוגל</button>`;
    const txt = g.error ? 'אין חיבור לגוגל כרגע' : g.pending || g.busy ? 'שומר ביומן גוגל...' : 'מסונכרן עם יומן גוגל';
    return `<span class="gs-pill ${g.error ? 'warn' : 'ok'}" role="status">${txt}</span>`;
  }
  function gcalCard() {
    const g = gsState();
    const avail = GS && GS.available();
    const perms = `<details class="times"><summary>אילו הרשאות המערכת מבקשת?</summary><ul class="doc-list small">
        <li>ליצור ולעדכן אירועים ביומן הסטודיו (חוגים, סדנאות, חסימות).</li>
        <li>ליצור יומן לכל ערוץ שיווק ולנהל רק אותו.</li>
        <li>לראות את רשימת היומנים, כדי לבחור את יומן הסטודיו.</li>
        <li>לראות מתי את תפוסה ביומן האישי, בלי כותרות ופרטים.</li>
        <li>לשלוח מיילים מהחשבון (אישורים, תזכורות, משוב). לא חובה: בלי זה היומן עובד, והמיילים רק מוצגים.</li>
      </ul><p class="muted small">כרטיס הכניסה של גוגל נשמר בזיכרון בלבד. ההרשאה הקבועה נשמרת מוצפנת בשרת של הסטודיו, ולא בדפדפן. בדפדפן נשמרים רק מזהי היומנים שנבחרו.</p></details>`;
    let body;
    if (!avail) {
      body = `<p>כרגע הדמו עובד עם יומן מדומה. כדי לחבר את היומן האמיתי של הסטודיו צריך מזהה לקוח של גוגל (הגדרה חד פעמית, כ-15 דקות).</p>
        <p class="muted small">ההוראות בקובץ GOOGLE-CALENDAR-SETUP.md. אחרי שמדביקים את המזהה בקובץ config.js, הכפתור כאן יופעל.</p>
        <button class="btn primary" disabled>התחברות עם חשבון גוגל</button>${perms}`;
    } else if (g.status === 'connected' || g.status === 'syncing') {
      body = `<dl class="kv">
          <dt>חשבון</dt><dd dir="ltr">${esc(g.account || '')}</dd>
          <dt>יומנים</dt><dd>${g.calendars.map(c => esc(c.name || c.remote)).join('<br>')}</dd>
          <dt>סנכרון אחרון</dt><dd>${g.lastSync ? clock(new Date(g.lastSync)) : 'עוד לא'}${g.busy ? ' · מסנכרן עכשיו' : ''}</dd>
          <dt>ממתין לשליחה</dt><dd>${g.pending ? `${g.pending} שינויים` : 'אין'}</dd>
          <dt>שליחת מיילים</dt><dd>${g.gmail ? 'מאושרת' : 'לא אושרה'}</dd>
          <dt>התחברות</dt><dd>${GS.serverMode() ? 'קבועה במכשיר הזה. לא צריך להתחבר שוב' : 'זמנית: אחרי רענון או שעה צריך להתחבר מחדש'}</dd>
        </dl>
        ${ui.selfTest && ui.selfTest.steps.length ? `<ul class="audit-global" aria-label="תוצאות בדיקת החיבור">${ui.selfTest.steps.map(x => `<li class="${x.ok ? 'p' : 'f'}"><span aria-hidden="true">${x.ok ? '✓' : '✕'}</span><b>${esc(x.name)}</b><span class="sr-only">${x.ok ? 'עבר' : 'נכשל'}</span><small>${esc(x.detail)}</small></li>`).join('')}</ul>` : ''}
        <p class="muted small">שינויים במערכת נשלחים לגוגל מיד. שינויים ביומן גוגל (מהטלפון או מערוץ שותף) נקלטים כל דקה, וכשחוזרים לחלון.</p>
        <div class="btn-row"><button class="btn primary small" data-act="gsSelfTest" ${ui.selfTest && ui.selfTest.busy ? 'disabled' : ''}>${ui.selfTest && ui.selfTest.busy ? 'בודק...' : 'בדיקת חיבור מלאה'}</button><button class="btn ghost small" data-act="gsSync">סנכרון עכשיו</button><button class="btn ghost small" data-act="gsDisconnect">ניתוק</button><button class="btn ghost small" data-act="gsDisconnect" data-forget="1">ניתוק ושכחת היומנים</button></div>`;
    } else if (g.status === 'reauth') {
      body = `<p>החיבור לגוגל פג (זה קורה אחרי כשעה, או אחרי רענון הדף). ${g.pending ? `${g.pending} שינויים ממתינים ויישלחו אחרי ההתחברות.` : ''}</p>
        <div class="btn-row"><button class="btn primary" data-act="gsReconnect">התחברות מחדש</button><button class="btn ghost small" data-act="gsDisconnect" data-forget="1">שכחת החיבור</button></div>`;
    } else if (g.status === 'authorized') {
      body = `<p>מחובר לחשבון. נשאר לבחור איזה יומן ישמש את הסטודיו.</p><button class="btn primary" data-act="gsChoose">בחירת יומן</button>`;
    } else {
      body = `<p>חיבור היומן האמיתי של הסטודיו: חוגים, סדנאות ומועדים יופיעו ביומן גוגל, ושינויים שתמימה עושה בטלפון ייקלטו כאן.</p>
        <button class="btn primary" data-act="gsConnect" ${g.status === 'connecting' ? 'disabled' : ''}>${g.status === 'connecting' ? 'מתחבר...' : 'התחברות עם חשבון גוגל'}</button>${perms}`;
    }
    return card(`<div class="row-between"><h2>יומן גוגל</h2>${chip(GS_STATUS[g.status] || g.status, g.status === 'connected' ? 'paid' : g.status === 'reauth' ? 'requested' : 'muted')}</div>
      ${g.error ? `<p class="err" role="alert">${esc(g.error)}</p>` : ''}${body}`, 'gs-card');
  }
  // יומן סטודיו שכבר נוצר בחשבון (למשל מדפדפן אחר)
  const existingStudio = () => (ui.gsCals || []).find(x => x.summary === 'הסטודיו של תמימה' && !x.primary);
  function gsSetupSheet() {
    const c = ui.gsChoice;
    const ex = existingStudio();
    // היומנים המשניים (חוגים וערוצים) לא מתאימים כיומן הסטודיו, ולכן לא מוצגים
    const cals = (ui.gsCals || []).filter(x => !x.summary.startsWith('הסטודיו של תמימה · ') && (!ex || x.id !== ex.id));
    if (ex) return `<h2>חיבור יומן הסטודיו</h2>
      <p class="ok-line">נמצאו בחשבון היומנים של הסטודיו שכבר נוצרו.</p>
      <p class="small">המערכת תמשיך לעבוד איתם: הסטודיו, החוגים וכל ערוצי השיווק. שום דבר לא נוצר מחדש, ומה שכבר ביומן נשאר כמו שהוא.</p>
      ${ui.gsBusy ? '<p class="ok-line" role="status">מחבר ומסנכרן...</p>' : ''}
      <button class="btn primary block" data-act="gsSetup" ${ui.gsBusy ? 'disabled' : ''}>חיבור וסנכרון</button>`;
    const opt = (name, value, label, desc, checked) => `<label class="radio-row"><input type="radio" name="${name}" value="${esc(value)}" data-bind="gsChoice.${name}" ${checked ? 'checked' : ''}><span><b>${label}</b>${desc ? `<small>${desc}</small>` : ''}</span></label>`;
    const chosen = cals.find(x => x.id === c.studio);
    return `<h2>חיבור יומן הסטודיו</h2>
      <fieldset class="fs"><legend>איזה יומן ישמש את הסטודיו?</legend>
        ${opt('studio', 'new', 'יומן חדש: "הסטודיו של תמימה" (מומלץ)', 'נוצר עכשיו בחשבון, נפרד מהיומן האישי.', c.studio === 'new')}
        ${cals.map(x => opt('studio', x.id, esc(x.summary) + (x.primary ? ' (ראשי)' : ''), x.primary ? 'זה היומן האישי. אירועים אישיים יופיעו ביומן הסטודיו.' : '', c.studio === x.id)).join('')}
      </fieldset>
      ${chosen && chosen.primary ? '<p class="policy warn">עדיף יומן נפרד: ביומן הראשי כל האירועים האישיים ייראו כחלק מהסטודיו.</p>' : ''}
      <fieldset class="fs"><legend>מה להעלות מהמערכת ליומן?</legend>
        ${opt('upload', 'basic', 'רק החוגים והמשבצות (מומלץ)', 'בלי הלקוחות והסדנאות המדומים של הדמו.', c.upload === 'basic')}
        ${opt('upload', 'all', 'את כל נתוני הדמו', 'מתאים ליומן בדיקה בלבד, לא ליומן אמיתי.', c.upload === 'all')}
        ${opt('upload', 'none', 'כלום, רק לקרוא מהיומן', 'המערכת תציג את מה שכבר ביומן.', c.upload === 'none')}
      </fieldset>
      <p class="muted small">לכל ערוץ שיווק ("${esc(G.channels.list().map(ch => ch.name).join('", "'))}") ייווצר יומן משני, שאותו אפשר לשתף עם הערוץ.</p>
      ${ui.gsBusy ? '<p class="ok-line" role="status">מחבר ומסנכרן...</p>' : ''}
      <button class="btn primary block" data-act="gsSetup" ${ui.gsBusy ? 'disabled' : ''}>חיבור וסנכרון</button>`;
  }
  // שינוי שהגיע מגוגל: ערוץ שותף ששינה כותרת של משבצת = הזמנה (למשל "נתפס: 3 משתתפים")
  function onRemoteChanges(changes) {
    const byCal = Object.fromEntries(G.channels.list().map(c => [c.calendarId, c]));
    let booked = 0, other = 0;
    Object.entries(changes).forEach(([local, items]) => {
      const ch = byCal[local];
      items.forEach(ev => {
        const kind = ((ev.extendedProperties || {}).private || {}).kind;
        if (ch && !ch.home && kind === 'slot' && ev.status !== 'cancelled' && !/^משבצת פנויה/.test(ev.summary || '')) {
          const sp = G.msToWall(G.edgeMs(ev.start));
          if (S.workshops.some(w => w.date === sp.slice(0, 10) && w.time === sp.slice(11, 16))) return;
          const n = Math.min(12, Math.max(2, Number(((ev.summary || '').match(/\d+/) || [])[0]) || 2));
          bookWorkshop({ id: uid('w'), source: ch.id, date: sp.slice(0, 10), time: sp.slice(11, 16), n, amount: price(n),
            customer: { name: `לקוח דרך ${ch.name}`, phone: '', email: '' }, receipt: 'pending', invoice: null, feedbackSent: false });
          log('sync', `הזמנה חדשה מערוץ "${ch.name}" ביומן גוגל`, `${shortDay(sp.slice(0, 10))} ${sp.slice(11, 16)}, ${n} משתתפים. נקלטה מהיומן המשותף, והמשבצת ירדה מכל הערוצים.`);
          toast(`הזמנה חדשה דרך ${ch.name}`, `${shortDay(sp.slice(0, 10))} ${sp.slice(11, 16)}`);
          booked++;
        } else other++;
      });
    });
    if (other) log('sync', `${other} שינויים נקלטו מיומן גוגל`, 'למשל אירוע שנוסף או נמחק בטלפון. היומן והזמינות עודכנו.');
    runSync();
    scheduleRender();
  }
  /* ---------- לשונית "מיילים" ב"עוד" ---------- */
  function mailTab() {
    const g = gsState();
    const live = GS && g.status === 'connected' && g.gmail;
    const mode = !live
      ? `<p><b>מצב הדגמה.</b> הג'ימייל לא מחובר, אז המיילים לא נשלחים. כאן רואים בדיוק מה היה נשלח, למי ומתי.</p><button class="btn ghost small" data-act="moreTab" data-t="google">חיבור לגוגל</button>`
      : CFG.liveEmail
        ? `<p><b>שליחה אמיתית.</b> המיילים נשלחים מ-<span dir="ltr">${esc(g.account)}</span> לנמענים עצמם.</p>`
        : `<p><b>מצב בדיקה.</b> כל מייל נשלח רק לתיבה שלך (<span dir="ltr">${esc(g.account)}</span>), והנמען המקורי כתוב בנושא. אף לקוח לא מקבל מייל.</p>`;
    const groups = ['לקוחות', 'סטודנטים', 'תמימה'].map(aud => `<fieldset class="fs"><legend>${aud === 'תמימה' ? 'אלייך' : `ל${aud}`}</legend>${Object.entries(MAIL_KINDS).filter(([k, [a]]) => a === aud && k !== 'test').map(([k, [, label]]) => `<label class="consent"><input type="checkbox" data-mailauto="${k}" ${S.mail.auto[k] !== false ? 'checked' : ''}><span>${label}</span></label>`).join('')}</fieldset>`).join('');
    const rows = S.mail.outbox.slice(0, 40).map(m => `<button class="ws-row" data-act="mailView" data-id="${m.id}">
        <div><b>${esc(m.subject)}</b><small>${esc(m.toName)}${m.to ? ` · <span dir="ltr">${esc(m.to)}</span>` : ''} · ${clock(m.at)}${m.mode === 'test' ? ' · נשלח אלייך לבדיקה' : ''}</small></div>
        ${chip(MAIL_STATUS[m.status][0], MAIL_STATUS[m.status][1])}</button>`).join('');
    return card(`<h2>שליחת מיילים</h2>${mode}${live ? '<button class="btn primary small" data-act="mailTest">שליחת מייל בדיקה אליי</button>' : ''}`)
      + card(`<details class="times"><summary>אילו מיילים נשלחים אוטומטית (${Object.values(S.mail.auto).filter(Boolean).length - 1})</summary>${groups}</details>`)
      + card(`<h2>מיילים אחרונים</h2>${rows || empty('עוד לא נשלחו מיילים. הזמינו סדנה באתר או סמנו נוכחות, ותראו אותם כאן.')}`);
  }
  function mailViewHtml(id) {
    const m = S.mail.outbox.find(x => x.id === id);
    if (!m) return '';
    return `<h2>${esc(m.subject)}</h2>
      <dl class="kv"><dt>אל</dt><dd>${esc(m.toName)} <span dir="ltr">${esc(m.to || 'אין כתובת')}</span></dd><dt>סוג</dt><dd>${MAIL_KINDS[m.kind][1]}</dd><dt>מצב</dt><dd>${chip(MAIL_STATUS[m.status][0], MAIL_STATUS[m.status][1])}${m.mode === 'test' ? ' נשלח לתיבה שלך לבדיקה' : ''}</dd></dl>
      ${m.error ? `<p class="err" role="alert">${esc(m.error)}</p>` : ''}
      <div class="mail-preview" dir="rtl">${m.text.split('\n').map(l => `<p>${esc(l)}</p>`).join('')}${m.extra || ''}${m.cta ? `<a class="btn primary" href="${esc(m.cta[1])}" target="_blank" rel="noopener">${esc(m.cta[0])}</a>` : ''}</div>
      ${m.cta ? '<p class="muted small">הכפתור נפתח בלשונית חדשה, בדיוק כמו אצל מי שקיבל את המייל.</p>' : ''}
      ${m.status === 'failed' ? `<button class="btn primary block" data-act="mailRetry" data-id="${m.id}">שליחה חוזרת</button>` : ''}`;
  }

  /* ================= אזור 2: הדשבורד של תמימה ================= */
  const pendingReceipts = () => activeWorkshops().filter(w => w.receipt === 'pending').sort((a, b) => a.date.localeCompare(b.date));

  function tamimaView(r) {
    const page = r.page || 'home';
    const nav = appNav('tamima', page === 'student' ? 'classes' : page, [['home', 'בית'], ['calendar', 'יומן'], ['classes', 'חוגים'], ['workshops', 'סדנאות'], ['receipts', 'קבלות', pendingReceipts().length], ['more', 'עוד']]);
    const views = { home: tHome, calendar: tCalendar, classes: tClasses, workshops: tWorkshops, receipts: tReceipts, more: tMore, student: tStudentCard };
    const body = (views[page] || tHome)(r.param);
    const h = new Date().getHours();
    const hello = h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : 'ערב טוב';
    // במחשב: הדפים בעמודה קבועה בצד. בטלפון: שורה קבועה בתחתית. בלי כותרת תמונה גדולה, כדי שהתוכן יתחיל מיד
    return `<div class="appshell tshell${page === 'calendar' ? ' cal-page' : ''}">
      <aside class="tside" aria-label="תפריט">
        <span class="tside-brand"><span class="logo small" aria-hidden="true">ת</span><b>הסטודיו של תמימה</b></span>
        ${nav}
      </aside>
      <div class="tmain">
        ${page === 'calendar' ? '' : `<header class="t-head"><span class="t-hello">${hello}, תמימה</span><span class="t-date">${longDay(todayIso())}</span></header>`}
        <main id="main" tabindex="-1" class="wrap${page === 'calendar' ? ' wide' : ''}">${body}</main>
      </div></div>`;
  }

  function tHome() {
    const t = todayIso();
    const items = [];
    openConflicts().forEach(c => items.push(`
      <div class="todo">
        <div class="todo-main">${chip('התנגשות', 'overdue')}<b>${esc(c.title)}</b><small>חופפת ל${esc(c.src.label)}, ${c.src.when}</small></div>
        <div class="btn-row">${c.type === 'ws' ? `<button class="btn small primary" data-act="wsMoveOpen" data-id="${c.id}">הזזת הסדנה</button><button class="btn small ghost" data-act="wsCancelAsk" data-id="${c.id}">ביטול הסדנה</button>` : `<button class="btn small primary" data-act="lessonCancelAsk" data-l="${c.id}">ביטול השיעור</button>`}<button class="btn small ghost" data-act="conflictOk" data-k="${esc(c.key)}">לא רלוונטי</button></div>
      </div>`));
    S.students.filter(s => s.leave && !s.leave.seen && s.active !== false).forEach(s => items.push(`
      <div class="todo">
        <div class="todo-main">${chip('הודעת עזיבה', 'requested')}<b>${esc(s.name)}</b><small>${group(s.groupId).name} · תאריך הסיום ${fullDate(s.leave.endDate)}${s.leave.source === 'outside' ? ' · התקבלה מחוץ לאפליקציה' : ' · עם אישור'}</small></div>
        <div class="btn-row"><a class="btn small primary" href="#/tamima/student/${s.id}">לכרטיס</a><button class="btn small ghost" data-act="leaveSeen" data-id="${s.id}">ראיתי</button></div>
      </div>`));
    S.workshops.filter(w => w.lateRequest && w.lateRequest.status === 'open' && isLive(w)).forEach(w => items.push(`
      <div class="todo">
        <div class="todo-main">${chip('פנייה מאוחרת', 'requested')}<b>${esc(w.customer.name)}</b><small>ביטול ${shortDay(w.date)} ${w.time} · <span dir="ltr">${esc(w.customer.phone)}</span> · בוואטסאפ</small></div>
        <div class="btn-row"><button class="btn small primary" data-act="lateOpen" data-id="${w.id}">להחלטה</button><button class="btn small ghost" data-act="lateSeen" data-id="${w.id}">טופל</button></div>
      </div>`));
    (S.privacyRequests || []).filter(r => r.status === 'open').forEach(r => {
      const who = r.targetKind === 'student' ? student(r.targetId) : customer(r.targetId);
      items.push(`
      <div class="todo">
        <div class="todo-main">${chip('בקשת פרטיות', 'overdue')}<b>${esc(who ? who.name : '')}</b><small>${r.type} · ${fullDate(r.at)}${r.note ? ` · ${esc(r.note)}` : ''} · לטפל תוך 30 יום</small></div>
        <div class="btn-row">${r.type === 'מחיקה' ? `<button class="btn small primary" data-act="anonAsk" data-kind="${r.targetKind}" data-id="${r.targetId}">לאנונימיזציה</button>` : r.targetKind === 'student' ? `<a class="btn small primary" href="#/tamima/student/${r.targetId}">לפרטים</a>` : ''}<button class="btn small ghost" data-act="privacyDone" data-id="${r.id}">סומן כטופל</button></div>
      </div>`);
    });
    openRefundCases().forEach(x => {
      const info = invoiceInfo(x.inv);
      items.push(`
      <div class="todo">
        <div class="todo-main">${x.status === 'failed' ? chip('דורש טיפול', 'overdue') : chip('זיכוי ממתין להחלטה', 'requested')}<b>${esc(info ? info.name : '')} · ${REFUND_REASON[x.reason]}</b><small>${x.status === 'failed' ? 'הזיכוי נכשל בסאמיט · ' : ''}${x.suggested != null ? `מוצע ${money(x.suggested)}` : 'הסכום לפי החלטתך'} · חשבונית מס׳ ${x.inv}</small></div>
        <button class="btn small primary" data-act="caseOpen" data-id="${x.id}">להחלטה</button>
      </div>`);
    });
    S.students.filter(s => payStatus(s).key === 'overdue').forEach(s => items.push(`
      <div class="todo">
        <button class="todo-main" data-act="studentSheet" data-id="${s.id}">${chip('דורש טיפול', 'overdue')}<b>${esc(s.name)}</b><small>${group(s.groupId).name} · ${s.owes ? (s.firstDue ? 'הכרטיסייה הראשונה לא שולמה, והשיעור הראשון כבר התחיל' : `שיעור ${s.used} מתוך ${S.settings.cardSize}, הכרטיסייה הנוכחית לא שולמה`) : `שיעור ${s.used} מתוך ${S.settings.cardSize}, הכרטיסייה הבאה לא שולמה`}</small></button>
        <button class="btn small ${s.reminded ? 'ghost' : 'primary'}" data-act="remind" data-id="${s.id}">${s.reminded ? 'תזכורת נשלחה' : 'שליחת תזכורת'}</button>
      </div>`));
    pendingReceipts().forEach(w => items.push(`
      <div class="todo">
        <div class="todo-main">${chip('להפיק קבלה', 'salon')}<b>${srcLabel(w)}, ${esc(w.customer.name)}</b><small>${shortDay(w.date)} ${w.time} · ${w.n} משתתפים · ${money(w.amount)}</small></div>
        <a class="btn small primary" href="#/tamima/receipts/${w.id}" aria-label="להפקת קבלה: ${esc(w.customer.name)}, ${shortDay(w.date)}">להפקת קבלה</a>
      </div>`));
    S.lessons.filter(l => lEnd(l) < now() && !att(l.id).marked && !l.cancelled && group(l.groupId).active !== false && (lessonStudents(l).length || roster(l).guests.length)).forEach(l => items.push(`
      <div class="todo">
        <div class="todo-main">${chip('נוכחות', 'class')}<b>סימון נוכחות, ${group(l.groupId).name}</b><small>${relDay(l.date)} ${group(l.groupId).start}</small></div>
        <button class="btn small primary" data-act="goLesson" data-l="${l.id}" aria-label="לסימון נוכחות: ${group(l.groupId).name}, ${relDay(l.date)}">לסימון</button>
      </div>`));
    S.leads.filter(x => !x.handled).forEach(x => items.push(`
      <div class="todo">
        <div class="todo-main">${chip('פנייה לקורס', 'site')}<b>${esc(x.name)}</b><small><span dir="ltr">${esc(x.phone)}</span>${x.email ? ` · <span dir="ltr">${esc(x.email)}</span>` : ''} · ${x.group ? 'קבוצה מועדפת: ' + group(x.group).name : 'כל קבוצה'}</small></div>
        <div class="btn-row"><button class="btn small primary" data-act="leadToStudent" data-id="${x.id}">הוספה כסטודנט</button><button class="btn small ghost" data-act="leadDone" data-id="${x.id}">טופל</button></div>
      </div>`));

    const today = [];
    S.lessons.filter(l => l.date === t).forEach(l => {
      const rs = roster(l);
      today.push({ s: toMin(group(l.groupId).start), html: `<button class="agenda-row" data-act="goLesson" data-l="${l.id}"><span class="time">${group(l.groupId).start}</span><span class="dot dot-class" aria-hidden="true"></span><span class="ar-txt"><b>${group(l.groupId).name}</b><small>${rs.coming}/${rs.max} משתתפים</small></span></button>` });
    });
    activeWorkshops().filter(w => w.date === t).forEach(w => today.push({ s: toMin(w.time), html: `<button class="agenda-row" data-act="wsSheet" data-id="${w.id}"><span class="time">${w.time}</span><span class="dot dot-${srcCss(w)}" aria-hidden="true"></span><span class="ar-txt"><b>${srcLabel(w)}</b><small>${esc(w.customer.name)} · ${w.n} משתתפים</small></span></button>` }));
    today.sort((a, b) => a.s - b.s);

    const mk = t.slice(0, 7);
    const inM = d => d.slice(0, 7) === mk;
    const site = activeWorkshops().filter(w => isOwn(w) && inM(w.date)).reduce((a, w) => a + w.amount, 0);
    const salon = activeWorkshops().filter(w => !isOwn(w) && inM(w.date)).reduce((a, w) => a + w.amount, 0);
    const classes = S.payments.filter(p => inM(p.date)).reduce((a, p) => a + p.amount, 0);
    const total = site + salon + classes || 1;
    const fee = activeWorkshops().filter(w => inM(w.date)).reduce((a, w) => a + commissionOf(w), 0);
    const seg = (v, k) => `<span class="bar-${k}" style="width:${(v / total) * 100}%"></span>`;

    // במחשב: "ממתין לך" בעמודה אחת, "היום" ו"החודש" בעמודה לידה. בטלפון ובטאבלט: אחד מתחת לשני
    return `<h1 class="sr-only">בית</h1><div class="home-grid"><section class="hg-main">
      <h2 class="sec">ממתין לך עכשיו</h2>
      ${items.length ? `<div class="todos">${items.join('')}</div>` : card(empty('אין כרגע משהו שמחכה לך. יום רגוע!'))}
      </section><section class="hg-side">
      <h2 class="sec">היום</h2>
      ${card(today.length ? today.map(x => x.html).join('') : empty('אין שיעורים או סדנאות היום.'))}
      <h2 class="sec">החודש, ${MONTHS[startOfToday().getMonth()]}</h2>
      ${card(`<div class="metric-big"><small>הכנסות החודש</small><b>${money(site + salon + classes)}</b></div>
        <div class="bar">${seg(classes, 'class')}${seg(site, 'site')}${seg(salon, 'salon')}</div>
        <ul class="legend-list">
          <li><span class="dot dot-class"></span>חוגים<b>${money(classes)}</b></li>
          <li><span class="dot dot-site"></span>סדנאות מהאתר<b>${money(site)}</b></li>
          <li><span class="dot dot-salon"></span>סדנאות מערוצי שיווק<b>${money(salon)}</b></li>
          <li class="fee">עמלות לערוצים<b>${money(fee)}</b></li>
        </ul>`)}</section></div>`;
  }

  /* ---------- יומן: רשת שעות כמו ביומן גוגל (דרישות י-1 עד י-17 באפיון) ---------- */
  const GRID_FROM = 9 * 60, GRID_TO = 21 * 60;          // 09:00 עד 21:00
  const isMobileCal = () => window.innerWidth < 720;
  const hpx = () => (isMobileCal() ? 56 : 48);            // גובה שעה בפיקסלים
  const dayEndMin = date => (parse(date).getDay() === 5 ? 14 * 60 : GRID_TO);
  const slotKey = (date, time) => `${date}|${time}`;
  const chLabel = ch => (ch.home ? 'אתר' : ch.name);
  const inCh = ch => (ch.home ? 'באתר' : `בערוץ "${ch.name}"`);

  function calDays() {
    const week = calWeek();
    if (!isMobileCal()) return week;
    if (!ui.calDay || !week.includes(ui.calDay)) ui.calDay = week.includes(todayIso()) ? todayIso() : week[0];
    return [ui.calDay];
  }

  // כל הפריטים של יום אחד, מסווגים לארבעה סוגים: פעילות, לא זמין, פתוח, ממתין
  function dayItems(date) {
    const d = calData();
    const out = [];
    const d0 = G.wallToMs(`${date}T00:00:00`), d1 = G.wallToMs(`${iso(addDays(parse(date), 1))}T00:00:00`);
    d.studio.filter(ev => G.edgeMs(ev.start) < d1 && d0 < G.edgeMs(ev.end)).forEach(ev => {
      const p = priv(ev), sp = span(ev, date);
      if (p.app === APP && p.kind === 'class') {
        const l = lesson(`${p.groupId}_${date}`);
        const rs = l && roster(l);
        out.push(Object.assign(sp, { kind: 'class', label: l ? group(l.groupId).name : esc(ev.summary), sub: rs ? `${rs.coming}/${rs.max}` : '', act: l ? `data-act="goLesson" data-l="${l.id}"` : `data-act="calEvent" data-c="studio" data-id="${ev.id}"` }));
      } else if (p.app === APP && p.kind === 'workshop') {
        const w = workshop(p.workshopId);
        if (!w) return;
        out.push(Object.assign(sp, { kind: 'ws', label: esc(w.customer.name), sub: `${w.n} משתתפים`, tag: isOwn(w) ? '' : chName(w.source), act: `data-act="wsSheet" data-id="${w.id}"` }));
      } else if (p.app === APP && p.kind === 'closure') {
        out.push(Object.assign(sp, { kind: 'na', allDay: true, label: 'הסטודיו סגור', act: `data-act="closureSheet" data-id="${ev.id}"` }));
      } else if (p.app === APP && p.kind === 'block') {
        out.push(Object.assign(sp, { kind: 'na', label: ev.summary && ev.summary !== 'חסימה אישית' ? esc(ev.summary) : 'לא זמין', act: `data-act="calBlock" data-id="${ev.id}"` }));
      } else {
        out.push(Object.assign(sp, { kind: 'na', label: esc(ev.summary || 'לא זמין'), act: `data-act="calEvent" data-c="studio" data-id="${ev.id}"` }));
      }
    });
    personalBusy(date).forEach(iv => out.push(Object.assign(iv, { kind: 'na', label: 'לא זמין', act: `data-act="calPersonal" data-date="${date}" data-s="${iv.s}" data-e="${iv.e}"` })));
    slotsOn(date).forEach(x => {
      const ch = G.channels.get(x.channel);
      out.push({ s: toMin(x.time), e: toMin(x.time) + X.WORKSHOP_MIN, kind: 'open', ch: x.channel, key: slotKey(date, x.time), time: x.time,
        label: `פתוח · ${esc(chLabel(ch))}`, act: `data-act="calSlot" data-ch="${x.channel}" data-id="${x.eventId}"` });
    });
    S.workshops.filter(w => w.status === 'pending' && w.holdUntil > now().getTime() && w.date === date).forEach(w => out.push({ s: toMin(w.time), e: toMin(w.time) + X.WORKSHOP_MIN, kind: 'hold', time: w.time,
      label: 'בתהליך הזמנה', sub: `עוד ${Math.max(1, Math.ceil((w.holdUntil - now().getTime()) / 6e4))} דק׳`, act: `data-act="calHold" data-id="${w.id}"` }));
    G.channels.pending().filter(q => q.date === date).forEach(q => out.push({ s: toMin(q.time), e: toMin(q.time) + X.WORKSHOP_MIN, kind: 'pend', key: slotKey(date, q.time), time: q.time,
      label: 'ממתין לאתר', sub: whenMs(q.publishAt), act: `data-act="calPending" data-id="${q.id}"` }));
    return out;
  }

  // משפט אחד שעונה על "מה יש לי ביום הזה?" (יל-1)
  function daySummary(date) {
    if (parse(date).getDay() === 6) return 'שבת: הסטודיו סגור.';
    const items = dayItems(date);
    const n = k => items.filter(i => i.kind === k).length;
    const word = (c, one, many) => (c === 1 ? one : `${c} ${many}`);
    const parts = [];
    const cls = items.filter(i => i.kind === 'class');
    if (cls.length) parts.push(`${cls.length === 1 ? 'חוג' : `${cls.length} חוגים`} ב-${fromMin(cls[0].s)}`);
    if (n('ws')) parts.push(word(n('ws'), 'סדנה אחת', 'סדנאות'));
    const open = items.filter(i => i.kind === 'open' && at(date, i.time) > now()).length;
    if (open) parts.push(word(open, 'מועד פתוח אחד', 'מועדים פתוחים'));
    const lead = date === todayIso() ? 'היום' : relDay(date);
    return parts.length ? `${lead}: ${parts.join(' · ')}` : `${lead}: אין פעילות. לחיצה על זמן ברשת פותחת מועד.`;
  }

  // מלבנים חופפים באותו יום מתחלקים לנתיבים, כמו ביומן גוגל
  function layLanes(items) {
    items.sort((a, b) => a.s - b.s || b.e - a.e);
    let group = [], end = -1;
    const flush = () => { const lanes = []; group.forEach(it => { let i = lanes.findIndex(e => e <= it.s); if (i < 0) { i = lanes.length; lanes.push(0); } lanes[i] = it.e; it.lane = i; }); group.forEach(it => { it.lanes = lanes.length; }); group = []; };
    items.forEach(it => { if (it.s >= end && group.length) flush(); group.push(it); end = Math.max(end, it.e); });
    if (group.length) flush();
    return items;
  }

  // זמנים שאפשר לבחור במצב "פתיחת מועדים": זמני ברירת מחדל פנויים, ומשבצות של ערוצים אחרים
  function bulkTargets(date) {
    if (parse(date).getDay() === 6) return [];
    const items = dayItems(date);
    const taken = items.filter(i => i.kind === 'open' || i.kind === 'pend');
    const free = freeTimes(date).filter(t => !taken.some(o => overlaps(o, { s: toMin(t), e: toMin(t) + X.WORKSHOP_MIN })))
      .map(t => ({ time: t, from: null }));
    const others = taken.filter(o => o.kind === 'open' && o.ch !== ui.bulk.ch && at(date, o.time) > now()).map(o => ({ time: o.time, from: o.ch }));
    return free.concat(others);
  }

  const CAL_SHOW = { all: 'הכל', activity: 'פעילות', open: 'פתוח למכירה' };
  // חלון הבחירה: מה מוסיפים ליומן, עם הסבר קצר לכל אפשרות
  function addChooserHtml(date, time) {
    const at = date ? ` data-date="${date}"${time ? ` data-t="${time}"` : ''}` : '';
    return `<h2>מה מוסיפים ליומן?</h2>${date ? `<p class="muted">${longDay(date)}${time ? `, ${time}` : ''}</p>` : ''}
      <div class="choice-list">
        <button class="choice" data-act="addSlot"${at}><b>מועד למכירה</b><small>זמן פנוי שלקוחות יוכלו להזמין, באתר או בערוץ שיווק.</small></button>
        <button class="choice" data-act="evNew"${at}><b>אירוע שלי</b><small>זמן פרטי ביומן. אף אחד לא יוכל להזמין אותו. אפשר עם חזרה.</small></button>
      </div>`;
  }
  function tCalendar() {
    const T = todayIso();
    const days = calDays();
    const week = calWeek();
    const mobile = isMobileCal();
    const H = hpx();
    const px = m => ((m - GRID_FROM) / 60) * H;
    const f = ui.calFilter;
    const show = k => f === 'all' || (f === 'activity' ? ['class', 'ws', 'na', 'hold'].includes(k) : ['open', 'pend', 'na', 'hold'].includes(k));
    const bulk = ui.bulk.on;
    const sel = new Set(ui.bulk.sel.map(x => slotKey(x.date, x.time)));
    const flash = new Set(ui.flash || []);
    const nowMin = now().getHours() * 60 + now().getMinutes();

    // סיכום ערוצים לשבוע (י-17)
    const weekSlots = calData().slots.filter(x => week.includes(x.date) && at(x.date, x.time) > now());
    const summary = G.channels.active().map(ch => {
      const n = weekSlots.filter(x => x.channel === ch.id).length;
      return `<button class="cs-chip ${ui.calHi === ch.id ? 'on' : ''}" data-act="calHi" data-ch="${ch.id}" aria-pressed="${ui.calHi === ch.id}">${esc(chLabel(ch))} <b>${n}</b></button>`;
    }).join('');
    const pendN = G.channels.pending().filter(q => week.includes(q.date)).length;

    const cols = days.map((date, ci) => {
      const d = parse(date);
      const closed = d.getDay() === 6;
      const past = date < T;
      const items = layLanes(closed ? [] : dayItems(date).filter(it => show(it.kind) && it.e > GRID_FROM && it.s < GRID_TO));
      const blocks = items.map(it => {
        const top = px(Math.max(it.s, GRID_FROM)), h = Math.max(20, px(Math.min(it.e, GRID_TO)) - top - 2);
        const w = 100 / it.lanes;
        const dim = ui.calHi && it.kind === 'open' && it.ch !== ui.calHi;
        const hi = ui.calHi && it.kind === 'open' && it.ch === ui.calHi;
        const inBulk = bulk && it.kind === 'open' && sel.has(it.key);
        const range = it.allDay ? 'כל היום' : `${fromMin(it.s)} עד ${fromMin(it.e)}`;
        return `<button class="cg-ev k-${it.kind}${dim ? ' dim' : ''}${hi ? ' hi' : ''}${inBulk ? ' sel' : ''}${it.key && flash.has(it.key) ? ' just' : ''}${h < 34 ? ' tiny' : ''}"
          style="top:${top}px;height:${h}px;inset-inline-start:${it.lane * w}%;width:calc(${w}% - 3px)" ${bulk && it.kind === 'open' && it.ch !== ui.bulk.ch && !past ? `data-act="bulkToggle" data-date="${date}" data-t="${it.time}" data-from="${it.ch}"` : it.act}
          aria-label="${range}, ${it.label.replace(/<[^>]+>/g, '')}${it.sub ? ', ' + it.sub : ''}">
          ${it.allDay ? '' : `<span class="t">${fromMin(it.s)}</span>`}<span class="l">${it.label}${it.tag ? ` <i class="tag-mini">${esc(it.tag)}</i>` : ''}</span>${it.sub && h >= 50 ? `<span class="s">${esc(it.sub)}</span>` : ''}
        </button>`;
      }).join('');
      // מצב פתיחת מועדים: זמנים פנויים לבחירה
      const cands = bulk && !past ? bulkTargets(date).filter(c => !c.from).map(c => {
        const top = px(toMin(c.time)), h = px(toMin(c.time) + X.WORKSHOP_MIN) - top - 2;
        const on = sel.has(slotKey(date, c.time));
        return `<button class="cg-ev k-cand${on ? ' sel' : ''}" style="top:${top}px;height:${h}px;inset-inline-start:0;width:calc(100% - 3px)" data-act="bulkToggle" data-date="${date}" data-t="${c.time}" aria-pressed="${on}"><span class="t">${c.time}</span><span class="l">${on ? '✓ נבחר' : '+ זמין'}</span></button>`;
      }).join('') : '';
      // חלונית פתיחה במקום (י-14)
      let pop = '';
      if (ui.pop && ui.pop.date === date) {
        const pm = toMin(ui.pop.time);
        const ghost = `<div class="cg-ghost" style="top:${px(pm)}px;height:${px(pm + X.WORKSHOP_MIN) - px(pm) - 2}px"></div>`;
        const side = mobile || ci < 4 ? 'start' : 'end';
        pop = ghost + `<div class="cg-pop ${side}" style="top:${Math.min(px(pm + X.WORKSHOP_MIN) + 6, px(GRID_TO) - 150)}px" role="dialog" aria-label="פתיחת מועד">
          <button class="x-btn pop-x" data-act="popClose" aria-label="סגירה">×</button>
          <b>${shortDay(date)} · ${ui.pop.time} עד ${endOf(ui.pop.time)}</b>
          <div class="pop-ch" role="radiogroup" aria-label="ערוץ">${G.channels.active().map(ch => `<button role="radio" aria-checked="${ui.pop.ch === ch.id}" class="${ui.pop.ch === ch.id ? 'on' : ''}" data-act="popCh" data-ch="${ch.id}">${esc(chLabel(ch))}</button>`).join('')}</div>
          <div class="pop-act"><button class="btn primary small" data-act="popOpen">מועד למכירה</button><button class="btn ghost small" data-act="popEvent">אירוע שלי</button></div>
        </div>`;
      }
      const nowLine = date === T && nowMin > GRID_FROM && nowMin < GRID_TO ? `<div class="cg-now" style="top:${px(nowMin)}px"></div>` : '';
      const pastCover = past ? `<div class="cg-past" style="height:100%"></div>` : date === T && nowMin > GRID_FROM ? `<div class="cg-past" style="height:${px(Math.min(nowMin, GRID_TO))}px"></div>` : '';
      const friCut = d.getDay() === 5 ? `<div class="cg-closed-part" style="top:${px(dayEndMin(date))}px"></div>` : '';
      return `<div class="cg-col${closed ? ' closed' : ''}${date === T ? ' today' : ''}" ${closed || past ? '' : `data-act="gridClick" data-date="${date}" data-kbd-alt="newSlotForm"`}>
        ${pastCover}${friCut}${closed ? '<span class="cg-closed">סגור</span>' : ''}${blocks}${cands}${nowLine}${pop}
      </div>`;
    }).join('');

    const head = mobile
      ? `<div class="cg-strip" role="tablist">${week.map(date => { const d = parse(date); return `<button role="tab" aria-selected="${date === days[0]}" class="${date === days[0] ? 'on' : ''}${date === T ? ' today' : ''}" data-act="calPickDay" data-date="${date}"><small>${DAYS_SHORT[d.getDay()]}</small><b>${d.getDate()}</b></button>`; }).join('')}</div>`
      : `<div class="cg-head"><div class="cg-corner"></div>${days.map(date => { const d = parse(date); return `<div class="cg-dh${date === T ? ' today' : ''}${date < T ? ' past' : ''}"><small>${DAYS[d.getDay()]}</small><b>${d.getDate()}</b>${bulk && date >= T && d.getDay() !== 6 ? `<button class="linkish" data-act="bulkDay" data-date="${date}">כל הפנויים</button>` : ''}</div>`; }).join('')}</div>`;
    const hours = [];
    for (let m = GRID_FROM; m < GRID_TO; m += 60) hours.push(`<span style="top:${px(m)}px">${fromMin(m)}</span>`);
    const atToday = ui.weekOffset === 0 && (!mobile || days[0] === T);
    const title = mobile ? longDay(days[0]) : `${parse(week[0]).getDate()} ב${MONTHS[parse(week[0]).getMonth()]} עד ${parse(week[6]).getDate()} ב${MONTHS[parse(week[6]).getMonth()]}`;

    const bulkBar = bulk ? `<div class="bulk-bar" role="region" aria-label="פתיחת מועדים">
        <button class="x-btn bulk-x" data-act="bulkOff" aria-label="סגירת מצב פתיחת מועדים">×</button>
        <div class="bb-row"><b>פתיחת מועדים ב:</b><div class="pop-ch">${G.channels.active().map(ch => `<button class="${ui.bulk.ch === ch.id ? 'on' : ''}" data-act="bulkCh" data-ch="${ch.id}">${esc(chLabel(ch))}</button>`).join('')}</div></div>
        <div class="bb-row"><span>${ui.bulk.sel.length ? `נבחרו ${ui.bulk.sel.length}` : 'לחצו על זמנים ברשת כדי לבחור'}</span>
          <button class="btn primary small" data-act="bulkApply" ${ui.bulk.sel.length ? '' : 'disabled'}>פתיחה ${esc(inCh(G.channels.get(ui.bulk.ch)))}</button>
</div>
      </div>` : '';

    return `<div class="cal">
      <div class="cal-bar">
        <div class="cal-nav">
          ${atToday ? '' : '<button class="btn ghost small" data-act="calToday">היום</button>'}
          <button class="icon-btn" data-act="calStep" data-d="-1" aria-label="${mobile ? 'יום קודם' : 'שבוע קודם'}">›</button>
          <button class="icon-btn" data-act="calStep" data-d="1" aria-label="${mobile ? 'יום הבא' : 'שבוע הבא'}">‹</button>
          <h1 class="cal-title">${title}</h1>
        </div>
        <div class="cal-tools">
          <button class="btn ghost small" data-act="calShow" aria-haspopup="dialog">הצגה: ${CAL_SHOW[f]}</button>
          ${bulk ? '' : '<button class="btn primary small cal-add" data-act="addChooser" aria-haspopup="dialog">+ הוספה</button>'}
        </div>
      </div>
      <div class="cal-sub">
        <div class="cs">${mobile ? `<span class="cal-day-sum">${daySummary(days[0])}</span>` : ''}${gsPill()}${summary}${pendN ? `<span class="cs-pend">${pendN} ממתינים לאתר</span>` : ''}</div>
      </div>
      ${ui.calMsg ? `<p class="cal-msg" role="status"><span>${esc(ui.calMsg)}</span><button class="x-btn" data-act="calMsgClose" aria-label="סגירת ההודעה">×</button></p>` : ''}
      <div class="cg ${mobile ? 'one' : ''}${bulk ? ' bulk' : ''}" style="--h:${H}px;--cols:${days.length}">
        ${head}
        <div class="cg-body" style="height:${px(GRID_TO)}px">
          <div class="cg-hours">${hours.join('')}</div>
          ${cols}
        </div>
      </div>
      ${bulkBar}
      <ul class="cal-legend" aria-label="מקרא"><li><span class="lg k-class" aria-hidden="true"></span>שיעור</li><li><span class="lg k-ws" aria-hidden="true"></span>סדנה</li><li><span class="lg k-open" aria-hidden="true"></span>פתוח למכירה</li><li><span class="lg k-hold" aria-hidden="true"></span>בתהליך הזמנה</li><li><span class="lg k-na" aria-hidden="true"></span>לא זמין או אירוע</li></ul>
      ${bulk ? '' : '<button class="cal-fab" data-act="addChooser" aria-haspopup="dialog" aria-label="הוספה ליומן">+</button>'}
    </div>`;
  }

  const TIME_OK = /^([01]\d|2[0-3]):[0-5]\d$/;
  const PHONE_OK = v => /^0\d{8,9}$/.test(String(v || '').replace(/[\s-]/g, ''));
  const utcBasicOf = (date, time) => new Date(G.wallToMs(`${date}T${time}`)).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const halfHours = (from, to) => { const out = []; for (let m = toMin(from); m <= toMin(to); m += 30) out.push(fromMin(m)); return out; };
  const futureDays = n => { const out = []; for (let i = 0; i <= n; i++) { const d = iso(addDays(startOfToday(), i)); if (parse(d).getDay() !== 6) out.push(d); } return out; };

  /* ---------- סדרות החוגים ביומן ---------- */
  function masterFor(g, date) { return [...(g.masters || [])].reverse().find(m => m.from <= date) || (g.masters || [])[0]; }
  function endSeries(g, lastDate) {
    const m = g.masters[g.masters.length - 1];
    if (!m) return;
    if (!lastDate || m.from > lastDate) { try { G.events.delete({ calendarId: CAL.classes, eventId: m.id }); } catch (e) { /* כבר נמחק */ } g.masters.pop(); return; }
    const ev = G.events.get({ calendarId: CAL.classes, eventId: m.id });
    const rec = ev.recurrence.map(r => (r.startsWith('RRULE:') ? r.replace(/;UNTIL=[^;]*/, '') + `;UNTIL=${utcBasicOf(lastDate, '23:59:59')}` : r));
    G.events.patch({ calendarId: CAL.classes, eventId: m.id, requestBody: { recurrence: rec } });
    m.until = lastDate;
  }
  function startSeries(g, fromDate) {
    const id = G.b32hex(`class-${g.id}-${S.seq++}`);
    G.events.insert({ calendarId: CAL.classes, requestBody: X.classEvent(g, id, fromDate) });
    g.masters.push({ id, from: fromDate, start: g.start });
    g.eventId = id;
  }
  // שיעורים שכבר התחילו שומרים את השעה המקורית שלהם
  function stampPast(g) { S.lessons.filter(l => l.groupId === g.id && !l.start).forEach(l => { l.start = g.start; l.end = g.end; }); }
  function dropFutureLessons(g) {
    const future = S.lessons.filter(l => l.groupId === g.id && lStart(l) > now());
    const ids = new Set(future.map(l => l.id));
    S.lessons = S.lessons.filter(l => !ids.has(l.id));
    ids.forEach(id => delete S.attendance[id]);
    S.makeups.forEach(m => { if (ids.has(m.bookedLessonId)) m.bookedLessonId = null; }); // השלמה שנקבעה חוזרת לסטודנט
    return ids.size;
  }
  function buildFutureLessons(g) {
    let d = startOfToday();
    for (let i = 0; i < 8 && (d.getDay() !== g.day || at(iso(d), g.start) <= now()); i++) d = addDays(d, 1);
    const first = iso(d);
    for (; d <= addDays(startOfToday(), 56); d = addDays(d, 7)) S.lessons.push({ id: `${g.id}_${iso(d)}`, groupId: g.id, date: iso(d) });
    S.lessons.sort((a, b) => a.date.localeCompare(b.date));
    return first;
  }
  const lastStartedLesson = g => S.lessons.filter(l => l.groupId === g.id && lStart(l) <= now()).map(l => l.date).sort().pop();

  /* ---------- קבוצות ---------- */
  function saveGroup(f) {
    const name = String(f.name || '').trim(), day = Number(f.day), max = Number(f.max);
    if (name.length < 2) return 'נא לתת שם לקבוצה.';
    if (!(day >= 0 && day <= 5)) return 'נא לבחור יום (ראשון עד שישי).';
    if (!TIME_OK.test(f.start) || !TIME_OK.test(f.end) || f.end <= f.start) return 'שעת הסיום צריכה להיות אחרי שעת ההתחלה.';
    const existing = f.id && group(f.id);
    const count = existing ? groupStudents(existing.id).length : 0;
    if (!(max >= 1 && max <= 12)) return 'מספר המקומות צריך להיות בין 1 ל-12.';
    if (max < count) return `בקבוצה יש ${count} סטודנטים, אז צריך לפחות ${count} מקומות.`;
    const clash = activeGroups().find(g => g.id !== f.id && g.day === day && g.start < f.end && f.start < g.end);
    if (clash) return `הזמן הזה חופף ל${clash.name}.`;
    if (!existing) {
      const g = { id: `g${S.seq++}`, name, day, start: f.start, end: f.end, max, active: true, masters: [] };
      S.groups.push(g);
      startSeries(g, buildFutureLessons(g));
      log('sync', `קבוצה חדשה: ${name}`, `יום ${DAYS[day]}, ${f.start} עד ${f.end}. נוספה ליומן כאירוע חוזר, ומופיעה באתר.`);
      runSync();
      return '';
    }
    const g = existing;
    const moved = g.day !== day || g.start !== f.start || g.end !== f.end;
    if (moved) {
      stampPast(g);
      dropFutureLessons(g);
      g.day = day; g.start = f.start; g.end = f.end; g.name = name;
      const first = buildFutureLessons(g);
      endSeries(g, lastStartedLesson(g));
      startSeries(g, first);
      groupStudents(g.id).forEach(st => email('groupMoved', toStudent(st), `שינוי מועד: ${name}`, [`היי ${first(st)},`, `החל מ${longDay(first)} הקבוצה נפגשת ביום ${DAYS[day]}, ${f.start} עד ${f.end}.`, 'השיעורים מתעדכנים באפליקציה. אם המועד החדש לא מתאים, אפשר לענות למייל הזה.']));
      log('sync', 'היומן עודכן', 'הסדרה הקודמת הסתיימה ונפתחה סדרה חדשה. השיעורים שכבר היו נשמרו בהיסטוריה.');
    } else if (g.name !== name) {
      g.name = name;
      G.events.patch({ calendarId: CAL.classes, eventId: g.eventId, requestBody: { summary: `חוג קרמיקה: ${name}` } });
    }
    g.max = max;
    runSync();
    return '';
  }
  function removeGroup(id) {
    const g = group(id);
    if (groupStudents(id).length) return 'יש בקבוצה סטודנטים. קודם מעבירים אותם לקבוצה אחרת.';
    stampPast(g);
    dropFutureLessons(g);
    endSeries(g, lastStartedLesson(g));
    g.active = false;
    log('sync', `${g.name} הוסרה`, 'השיעורים העתידיים ירדו מהיומן ומהאתר. ההיסטוריה נשמרה.');
    runSync();
    return '';
  }

  /* ---------- ביטול שיעור בתאריך מסוים (חג, מחלה) ---------- */
  function setLessonCancelled(lid, on, opts = {}) {
    const l = lesson(lid), g = group(l.groupId), m = masterFor(g, l.date);
    const ex = `EXDATE;TZID=${G.TZ}:${l.date.replace(/-/g, '')}T${(l.start || m.start).replace(':', '')}00`;
    const ev = G.events.get({ calendarId: CAL.classes, eventId: m.id });
    const rec = on ? ev.recurrence.filter(r => r !== ex).concat(ex) : ev.recurrence.filter(r => r !== ex);
    G.events.patch({ calendarId: CAL.classes, eventId: m.id, requestBody: { recurrence: rec } });
    l.cancelled = on;
    if (on) {
      const a = att(lid);
      Object.entries(a.rec).forEach(([sid, v]) => { if (v === 'arrived' || v === 'late') unuseLesson(student(sid)); });
      a.rec = {}; a.marked = false;
      S.makeups.forEach(mk => { if (mk.bookedLessonId === lid) mk.bookedLessonId = null; });
    }
    if (opts.silent) return;
    lessonStudents(l).forEach(st => email('lessonCancelled', toStudent(st), on ? `השיעור ב${shortDay(l.date)} מבוטל` : `השיעור ב${shortDay(l.date)} מתקיים`, [`היי ${first(st)},`, on ? `השיעור ב${longDay(l.date)} מבוטל. הוא לא ייספר בכרטיסייה.` : `השיעור ב${longDay(l.date)} מתקיים כרגיל, ${l.start || g.start}.`]));
    runSync();
  }

  /* ---------- התנגשויות: אירוע אישי, אירוע מהטלפון או ימי סגירה על סדנה או שיעור שכבר נקבעו ----------
     לא מבטלים כלום אוטומטית. מתריעים לתמימה (בבית ובמייל), והיא מחליטה. */
  const fmtRange = (a, b) => {
    const x = G.msToWall(a), y = G.msToWall(b);
    return x.slice(0, 10) === y.slice(0, 10) ? `${shortDay(x.slice(0, 10))} ${x.slice(11, 16)} עד ${y.slice(11, 16)}` : `${shortDay(x.slice(0, 10))} ${x.slice(11, 16)} עד ${shortDay(y.slice(0, 10))} ${y.slice(11, 16)}`;
  };
  function conflicts() {
    const n = now().getTime(), until = n + 120 * 864e5;
    const srcs = [];
    (G.channels.busy(n, until).byCal[CAL.personal] || []).forEach(([a, b]) => srcs.push({ a, b, key: `p${a.toString(36)}-${b.toString(36)}`, label: 'אירוע ביומן האישי', when: fmtRange(a, b) }));
    G.events.list({ calendarId: CAL.studio, timeMin: new Date(n).toISOString(), timeMax: new Date(until).toISOString(), singleEvents: true }).items
      .filter(ev => ev.status !== 'cancelled' && (ev.transparency || 'opaque') === 'opaque')
      .forEach(ev => {
        const pv = priv(ev);
        if (pv.app === APP && pv.kind !== 'closure') return; // סדנאות וחסימות של המערכת עצמה
        const a = G.edgeMs(ev.start), b = G.edgeMs(ev.end);
        srcs.push({ a, b, key: `s${ev.id}`, label: pv.kind === 'closure' ? `ימי הסגירה${pv.note ? ` (${pv.note})` : ''}` : `"${ev.summary || 'אירוע'}" ביומן הסטודיו`, when: pv.kind === 'closure' ? closureRange(closureOf(ev)) : fmtRange(a, b) });
      });
    const targets = activeWorkshops().filter(w => at(w.date, w.time) > now())
      .map(w => ({ type: 'ws', id: w.id, a: at(w.date, w.time).getTime(), b: wEnd(w).getTime(), title: `סדנה של ${w.customer.name}, ${shortDay(w.date)} ${w.time}` }))
      .concat(S.lessons.filter(l => !l.cancelled && lStart(l) > now() && group(l.groupId).active !== false)
        .map(l => ({ type: 'class', id: l.id, a: lStart(l).getTime(), b: lEnd(l).getTime(), title: `${group(l.groupId).name}, ${shortDay(l.date)} ${l.start || group(l.groupId).start}` })));
    const out = [];
    targets.forEach(t => srcs.forEach(src => { if (t.a < src.b && src.a < t.b) out.push(Object.assign({}, t, { src, key: `${t.type}:${t.id}|${src.key}` })); }));
    return out.sort((x, y) => x.a - y.a);
  }
  const openConflicts = () => conflicts().filter(c => !S.conflictsDismissed.includes(c.key));
  // התנגשות חדשה: מייל והתראה לתמימה, פעם אחת לכל התנגשות
  function notifyConflicts() {
    if (!S || !S.conflictsSeen) return;
    conflicts().filter(c => !S.conflictsSeen.includes(c.key)).forEach(c => {
      S.conflictsSeen.push(c.key);
      email('conflict', toStudio(), `התנגשות ביומן: ${c.title}`, ['שלום תמימה,', `${c.title} חופפת ל${c.src.label}, ${c.src.when}.`,
        c.type === 'ws' ? 'הסדנה לא בוטלה. אפשר להזיז אותה, או לסמן שהאירוע לא רלוונטי.' : 'השיעור לא בוטל. אפשר לבטל אותו, או לסמן שהאירוע לא רלוונטי.'], { cta: ['לטיפול', siteUrl('#/tamima/home')] });
      toast('התנגשות ביומן', `${c.title} חופפת ל${c.src.label}.`);
    });
  }

  /* ---------- ימי סגירה: אירוע של יום שלם ביומן הסטודיו (תפוס), כך שכל הערוצים רואים שהזמן לא פנוי ---------- */
  const closureOf = ev => ({ id: ev.id, from: ev.start.date, to: iso(addDays(parse(ev.end.date), -1)), note: priv(ev).note || '', lessons: (priv(ev).lessons || '').split(',').filter(Boolean) });
  const closureRange = c => (c.from === c.to ? longDay(c.from) : `${shortDay(c.from)} עד ${shortDay(c.to)}`);
  function closures() {
    const t0 = G.rfc3339(`${iso(addDays(startOfToday(), -1))}T00:00:00`), t1 = G.rfc3339(`${iso(addDays(startOfToday(), 400))}T00:00:00`);
    return G.events.list({ calendarId: CAL.studio, timeMin: t0, timeMax: t1, singleEvents: true, orderBy: 'startTime' }).items
      .filter(ev => ev.status !== 'cancelled' && priv(ev).kind === 'closure' && ev.start.date).map(closureOf);
  }
  const closureLessons = (from, to) => S.lessons.filter(l => l.date >= from && l.date <= to && !l.cancelled && group(l.groupId).active !== false && lStart(l) > now());
  function addClosure(f) {
    const from = f.from, to = f.to || f.from, note = String(f.note || '').trim().slice(0, 80);
    if (!from) return { err: 'נא לבחור תאריך התחלה.' };
    if (from < todayIso()) return { err: 'אי אפשר לסגור ימים שכבר עברו.' };
    if (to < from) return { err: 'תאריך הסיום לפני תאריך ההתחלה.' };
    if ((parse(to) - parse(from)) / 864e5 >= 60) return { err: 'אפשר לסגור עד 60 ימים בבת אחת.' };
    if (closures().some(c => c.from <= to && from <= c.to)) return { err: 'כבר יש סגירה שחופפת לימים האלה.' };
    const ls = f.cancel ? closureLessons(from, to) : [];
    ls.forEach(l => setLessonCancelled(l.id, true, { silent: true }));
    const range = closureRange({ from, to });
    // הודעה אחת מרוכזת לכל סטודנט, עם כל השיעורים שלו שמתבטלים
    S.students.filter(st => st.active !== false).forEach(st => {
      const mine = ls.filter(l => l.groupId === st.groupId && inLesson(st, l));
      if (!mine.length) return;
      email('closure', toStudent(st), `הסטודיו סגור: ${range}`, [`היי ${first(st)},`, `הסטודיו סגור ${from === to ? 'ב' : 'מ'}${range}${note ? ` (${note})` : ''}.`,
        `${mine.length === 1 ? 'השיעור שמתבטל' : 'השיעורים שמתבטלים'}: ${mine.map(l => shortDay(l.date)).join(', ')}. הם לא ייספרו בכרטיסייה.`]);
    });
    const ev = G.events.insert({ calendarId: CAL.studio, requestBody: {
      summary: `הסטודיו סגור${note ? ': ' + note : ''}`, description: 'ימי סגירה. בימים האלה לא נפתחים מועדים באף ערוץ.', colorId: '8', transparency: 'opaque',
      start: { date: from }, end: { date: iso(addDays(parse(to), 1)) },
      extendedProperties: { private: { app: APP, kind: 'closure', note, lessons: ls.map(l => l.id).join(',') } } } });
    log('sync', `הסטודיו סגור: ${range}`, `המועדים בימים האלה ירדו מכל הערוצים${ls.length ? `, ו-${ls.length} שיעורים בוטלו עם הודעה לסטודנטים` : ''}.`);
    runSync();
    return { id: ev.id };
  }
  function removeClosure(id) {
    const ev = safeGet(CAL.studio, id);
    if (!ev || ev.status === 'cancelled') return;
    const c = closureOf(ev);
    const back = c.lessons.map(lesson).filter(l => l && l.cancelled && lStart(l) > now());
    back.forEach(l => setLessonCancelled(l.id, false, { silent: true }));
    S.students.filter(st => st.active !== false).forEach(st => {
      const mine = back.filter(l => l.groupId === st.groupId);
      if (!mine.length) return;
      email('closure', toStudent(st), 'השיעורים חוזרים', [`היי ${first(st)},`, `הסטודיו פתוח בכל זאת. ${mine.length === 1 ? 'השיעור מתקיים' : 'השיעורים מתקיימים'} כרגיל: ${mine.map(l => shortDay(l.date)).join(', ')}.`]);
    });
    G.events.delete({ calendarId: CAL.studio, eventId: id });
    log('sync', `הסגירה בוטלה: ${closureRange(c)}`, 'מועדים פנויים ייפתחו שוב לפי ההגדרות.');
    runSync();
  }
  function closedTab() {
    const f = ui.cf, t = todayIso();
    const from = f.from, to = f.to && f.to >= f.from ? f.to : f.from;
    const ls = from ? closureLessons(from, to) : [];
    const ws = from ? activeWorkshops().filter(w => w.date >= from && w.date <= to) : [];
    const list = closures();
    return card(`<h2>סגירת הסטודיו</h2>
        <p class="muted small">חופשה, חג או יריד. בימים האלה לא נפתחים מועדים באף ערוץ, וביומן גוגל מופיע "הסטודיו סגור".</p>
        <label class="field"><span>מתאריך</span><input type="date" min="${t}" data-bind="cf.from" data-rerender="page" value="${esc(f.from)}"></label>
        <label class="field"><span>עד תאריך <small class="muted">(ליום אחד: להשאיר ריק)</small></span><input type="date" min="${esc(f.from || t)}" data-bind="cf.to" data-rerender="page" value="${esc(f.to)}"></label>
        <label class="field"><span>סיבה <small class="muted">(לא חובה. תופיע בהודעה לסטודנטים)</small></span><input data-bind="cf.note" maxlength="80" value="${esc(f.note)}" placeholder="למשל: חופשה"></label>
        ${ls.length ? `<label class="consent"><input type="checkbox" data-bind="cf.cancel" ${f.cancel ? 'checked' : ''}><span>לבטל ${ls.length === 1 ? 'שיעור אחד' : `${ls.length} שיעורים`} בימים האלה ולשלוח הודעה לסטודנטים</span></label>` : ''}
        ${ws.length ? `<p class="policy warn">יש ${ws.length === 1 ? 'סדנה אחת' : `${ws.length} סדנאות`} שכבר נקבעו בימים האלה. הן לא מתבטלות, ויופיעו ב"ממתין לך" כדי להחליט מה לעשות.</p>` : ''}
        ${f.err ? `<p class="err" role="alert">${esc(f.err)}</p>` : ''}
        <button class="btn primary" data-act="closureAdd">סגירת הימים</button>`)
      + card(`<h2>ימי סגירה קרובים</h2>${list.length ? list.map(c => `<div class="todo"><div class="todo-main"><b>${closureRange(c)}</b><small>${c.note ? esc(c.note) + ' · ' : ''}${c.lessons.length ? `${c.lessons.length} שיעורים בוטלו` : 'בלי שיעורים שבוטלו'}</small></div><button class="btn small ghost" data-act="closureRemoveAsk" data-id="${c.id}">ביטול הסגירה</button></div>`).join('') : empty('אין ימי סגירה מתוכננים.')}`);
  }

  /* ---------- סטודנטים ---------- */
  function saveStudent(f) {
    const name = String(f.name || '').trim();
    if (name.length < 2) return ['name', 'נא למלא שם מלא.'];
    if (!PHONE_OK(f.phone)) return ['phone', 'נא למלא טלפון תקין, למשל 050-1234567.'];
    if (!EMAIL_OK(f.email)) return ['email', 'כתובת המייל לא תקינה.'];
    if (!group(f.groupId) || group(f.groupId).active === false) return ['groupId', 'נא לבחור קבוצה.'];
    if (!f.start || !/^\d{4}-\d{2}-\d{2}$/.test(f.start)) return ['start', 'נא לבחור את תחילת הקורס.'];
    const g = group(f.groupId);
    const s = f.id && student(f.id);
    const inGroup = groupStudents(g.id).filter(x => !s || x.id !== s.id).length;
    if (inGroup >= g.max) return ['groupId', `${g.name} מלאה (${g.max} מקומות). אפשר להגדיל את מספר המקומות בלשונית "קבוצות".`];
    if (!s) {
      // "כבר שולמה": הכרטיסייה הנוכחית שולמה מחוץ למערכת, והספירה מתחילה מהשיעורים שכבר נוצלו
      const paid = !!f.paid;
      const used = paid ? Math.round(Number(f.used) || 0) : 0;
      if (paid && !(used >= 0 && used <= S.settings.cardSize)) return ['used', `מספר השיעורים שנוצלו צריך להיות בין 0 ל-${S.settings.cardSize}.`];
      const n = { id: `st${S.seq++}`, name, phone: f.phone.trim(), email: (f.email || '').trim(), groupId: g.id, k: token(), used, nextPaid: false, requestSent: !paid, owes: !paid, firstDue: !paid, reminded: null, active: true, notes: f.notes || '', joined: todayIso(), start: f.start };
      S.students.push(n);
      { const cu = (S.customers || []).find(x => x.phones.includes(normPhone(n.phone))); if (cu) cu.studentId = n.id; }
      const intro = [`היי ${first(n)},`, `שמחים שהצטרפת. הקבוצה נפגשת ביום ${DAYS[g.day]}, ${g.start} עד ${g.end}.`, `השיעור הראשון: ${longDay(n.start)}.`, `הכתובת: ${S.content.address}.`];
      if (paid) email('welcome', toStudent(n), `ברוכים הבאים ל${g.name}!`, intro.concat('השיעורים, הכרטיסייה והתשלומים שלך נמצאים באפליקציה.'), { cta: ['לאפליקציה שלי', studentUrl(n, 'home')] });
      else email('welcome', toStudent(n), `ברוכים הבאים ל${g.name}!`, intro.concat(`לתשלום הכרטיסייה הראשונה (${money(S.settings.cardPrice)}, 4 שיעורים) בכרטיס אשראי, בקישור המאובטח:`, 'אחרי התשלום יישלח אליך קישור לאזור האישי, עם השיעורים, הכרטיסייה וההשלמות.'), { cta: ['לתשלום הכרטיסייה', studentUrl(n, 'pay')] });
      log('sumit', paid ? `${n.name}: הכרטיסייה כבר שולמה` : `סאמיט: נשלח קישור תשלום ל${n.name}`, paid ? `הספירה מתחילה מ-${used} שיעורים שנוצלו. לא נשלח קישור תשלום.` : `הכרטיסייה הראשונה, ${money(S.settings.cardPrice)}. הסטטוס "ממתין לתשלום" עד השיעור הראשון.`);
      // אם כבר נוצלו 3 שיעורים, דרישת התשלום לכרטיסייה הבאה יוצאת מיד
      if (paid && used >= S.settings.cardSize - 1) {
        n.requestSent = true;
        email('payRequest', toStudent(n), 'הכרטיסייה הבאה מחכה לתשלום', [`היי ${first(n)},`, `נוצלו ${used} מתוך ${S.settings.cardSize} שיעורים בכרטיסייה.`, `לתשלום הכרטיסייה הבאה (${money(S.settings.cardPrice)}) בכרטיס אשראי, בקישור המאובטח:`], { cta: ['לתשלום בסאמיט', studentUrl(n, 'pay')] });
      }
      return ['', '', n.id];
    }
    if (s.groupId !== g.id) {
      // ביטולים ששמרה בקבוצה הקודמת לשיעורים עתידיים כבר לא רלוונטיים
      S.lessons.filter(l => l.groupId === s.groupId && lStart(l) > now()).forEach(l => { delete att(l.id).rec[s.id]; });
      email('groupMoved', toStudent(s), `עברת ל${g.name}`, [`היי ${first(s)},`, `מעכשיו השיעורים שלך ביום ${DAYS[g.day]}, ${g.start} עד ${g.end}.`]);
    }
    const changed = [['שם', s.name, name], ['טלפון', s.phone, f.phone.trim()], ['מייל', s.email || '', (f.email || '').trim()], ['קבוצה', s.groupId, g.id]].filter(x => x[1] !== x[2]).map(x => x[0]);
    Object.assign(s, { name, phone: f.phone.trim(), email: (f.email || '').trim(), groupId: g.id, notes: f.notes || '' });
    if (changed.length) audit(`שינוי פרטים: ${changed.join(', ')}`, 'תמימה', name);
    return ['', '', s.id];
  }
  function setStudentActive(id, on) {
    const s = student(id);
    s.active = on;
    if (!on) {
      S.makeups.forEach(m => { if (m.studentId === id && m.bookedLessonId && lStart(lesson(m.bookedLessonId)) > now()) m.bookedLessonId = null; });
      S.lessons.filter(l => lStart(l) > now()).forEach(l => { if (S.attendance[l.id]) delete S.attendance[l.id].rec[id]; });
    }
    log('sync', on ? `${s.name}: חזרה לקורס` : `${s.name}: הסרה מהקורס`, on ? 'חזרה לרשימת הנוכחות של הקבוצה.' : 'המקום בקבוצה התפנה. ההיסטוריה והתשלומים נשמרו.');
  }

  /* ---------- סדנאות ---------- */
  function patchWorkshopEvent(w, fields) {
    const body = X.workshopEvent(w);
    G.events.patch({ calendarId: CAL.studio, eventId: w.eventId, requestBody: Object.fromEntries(fields.map(k => [k, body[k]])) });
  }
  function saveWorkshop(f) {
    const w = workshop(f.id);
    const n = Number(f.n), amount = Number(String(f.amount).replace(/[^\d.]/g, ''));
    if (String(f.name || '').trim().length < 2) return ['name', 'נא למלא שם.'];
    if (f.phone && !PHONE_OK(f.phone)) return ['phone', 'נא למלא טלפון תקין.'];
    if (!EMAIL_OK(f.email)) return ['email', 'כתובת המייל לא תקינה.'];
    if (!(n >= 1 && n <= 12)) return ['n', 'מספר המשתתפים צריך להיות בין 1 ל-12.'];
    if (!(amount >= 0)) return ['amount', 'נא למלא סכום.'];
    const changed = [['שם', w.customer.name, f.name.trim()], ['טלפון', w.customer.phone, (f.phone || '').trim()], ['מייל', w.customer.email, (f.email || '').trim()]].filter(x => x[1] !== x[2]).map(x => x[0]);
    Object.assign(w.customer, { name: f.name.trim(), phone: (f.phone || '').trim(), email: (f.email || '').trim() });
    if (changed.length) audit(`שינוי פרטי לקוח: ${changed.join(', ')}`, 'תמימה', w.customer.name);
    // סכום שלא שונה ידנית מחושב מחדש לפי המחירון כשמספר המשתתפים משתנה
    w.amount = n !== w.n && amount === w.amount && w.amount === price(w.n) ? price(n) : amount;
    w.n = n;
    if (f.paid != null && w.receipt !== 'auto') { w.paid = !!f.paid; if (w.paid && w.receipt === 'unpaid') w.receipt = 'pending'; if (!w.paid && w.receipt === 'pending') w.receipt = 'unpaid'; }
    patchWorkshopEvent(w, ['summary', 'description', 'extendedProperties']);
    return ['', ''];
  }
  function moveWorkshop(id, date, time) {
    const w = workshop(id);
    const ignore = { date: w.date, s: toMin(w.time), e: toMin(w.time) + X.WORKSHOP_MIN };
    const prob = startProblem(date, time, true, ignore);
    if (prob) return prob;
    shiftWorkshop(w, date, time);
    return '';
  }
  function setWorkshopCancelled(id, on, opts = {}) {
    const w = workshop(id);
    if (!on) {
      const prob = startProblem(w.date, w.time, true);
      if (prob) return 'המועד כבר לא פנוי. אפשר להחזיר את הסדנה במועד אחר דרך "הזזת מועד".';
      w.status = 'confirmed';
      G.events.insert({ calendarId: CAL.studio, requestBody: X.workshopEvent(w) });
      G.channels.book(w.date, w.time);
    } else {
      w.status = 'cancelled';
      try { G.events.delete({ calendarId: CAL.studio, eventId: w.eventId }); } catch (e) { /* כבר נמחק */ }
    }
    runSync();
    if (on) { if (opts.mail !== false) wsCancelMail(w, null); }
    else email('wsCancelled', toCustomer(w), 'הסדנה מתקיימת', [`שלום ${w.customer.name.split(' ')[0]},`, `הסדנה ב${longDay(w.date)}, ${w.time} מתקיימת כרגיל.`]);
    return '';
  }
  function addWorkshop(f) {
    const err = (!f.date || !f.time) ? ['time', 'נא לבחור יום ושעה.'] : null;
    if (err) return err;
    const n = Number(f.n);
    const w = { id: uid('w'), source: HOME, manual: true, date: f.date, time: f.time, n, amount: Number(f.amount) || price(n),
      customer: { name: String(f.name || '').trim(), phone: (f.phone || '').trim(), email: (f.email || '').trim() },
      status: 'confirmed', paid: !!f.paid, receipt: f.paid ? 'pending' : 'unpaid', invoice: null, feedbackSent: false };
    const v = saveWorkshopDraftCheck(w);
    if (v) return v;
    const prob = startProblem(w.date, w.time, true);
    if (prob) return ['time', prob];
    bookWorkshop(w);
    runSync();
    log('notify', `סדנה חדשה נוספה ידנית`, `${w.customer.name}, ${w.n} משתתפים, ${shortDay(w.date)} ${w.time}. ${w.paid ? 'שולמה.' : 'עוד לא שולמה.'}`);
    return ['', '', w.id];
  }
  function saveWorkshopDraftCheck(w) {
    if (w.customer.name.length < 2) return ['name', 'נא למלא שם.'];
    if (w.customer.phone && !PHONE_OK(w.customer.phone)) return ['phone', 'נא למלא טלפון תקין.'];
    if (!EMAIL_OK(w.customer.email)) return ['email', 'כתובת המייל לא תקינה.'];
    if (!(w.n >= 1 && w.n <= 12)) return ['n', 'מספר המשתתפים צריך להיות בין 1 ל-12.'];
    return null;
  }

  // זמני התחלה אפשריים ביום (לטפסים): מועד פתוח בדיוק בשעה הזאת, או זמן פנוי שלא חופף לשום מועד
  function timeOptions(date, opts = {}) {
    const open = dayItems(date).filter(i => (i.kind === 'open' || i.kind === 'pend') && !(opts.skipSlot && opts.skipSlot.date === date && i.time === opts.skipSlot.time));
    const out = [];
    for (let m = GRID_FROM; m + X.WORKSHOP_MIN <= dayEndMin(date); m += 30) {
      const t = fromMin(m);
      if (startProblem(date, t, true, opts.ignore)) continue;
      const hit = open.filter(i => overlaps(i, { s: m, e: m + X.WORKSHOP_MIN }));
      if (hit.length && !(opts.takeSlots && hit.length === 1 && hit[0].time === t && hit[0].kind === 'open' && hit[0].ch !== opts.notChannel)) continue;
      out.push({ t, label: `${t} עד ${endOf(t)}${hit.length ? ` (פתוח כרגע ${inCh(G.channels.get(hit[0].ch))})` : ''}` });
    }
    return out;
  }

  function setContent(key, value) {
    const c = S.content;
    const v = typeof value === 'string' ? value.trim() : value;
    if (typeof v === 'string' && !v) return 'השדה לא יכול להיות ריק.';
    if (key === 'gallery' && v.length < 3) return 'צריך לפחות 3 תמונות בגלריה.';
    c[key] = v;
    if (key === 'address') {
      X.setLocation(v);
      G.channels.configure({ location: v });
      // המיקום מתעדכן גם באירועים העתידיים ביומן
      activeWorkshops().filter(w => wEnd(w) > now()).forEach(w => patchWorkshopEvent(w, ['location']));
      activeGroups().forEach(g => G.events.patch({ calendarId: CAL.classes, eventId: g.eventId, requestBody: { location: v } }));
      log('sync', 'הכתובת עודכנה', 'באתר, באישורי ההזמנה ובאירועים העתידיים ביומן.');
    }
    return '';
  }

  /* ---------- רכיבי טופס ---------- */
  const errP = root => (ui[root] && ui[root].err ? `<p class="err" id="${root}-err" role="alert">${esc(ui[root].err)}</p>` : '');
  const invAttr = (root, key) => (ui[root] && ui[root].errField === key ? `aria-invalid="true" aria-describedby="${root}-err"` : '');
  const fld = (root, key, label, extra = '') => `<label class="field"><span>${label}</span><input data-bind="${root}.${key}" value="${esc(ui[root][key] == null ? '' : ui[root][key])}" ${extra} ${invAttr(root, key)}></label>`;
  const pickSel = (root, key, label, options, rerender) => `<label class="field"><span>${label}</span><select data-bind="${root}.${key}" ${rerender ? 'data-rerender="sheet"' : ''} ${invAttr(root, key)}>${options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(ui[root][key]) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  const confirmHtml = (title, text, act, attrs, yes) => () => `<h2>${title}</h2><p>${text}</p>
    <div class="btn-row"><button class="btn danger" data-act="${act}" ${attrs}>${yes || 'כן'}</button><button class="btn ghost" data-act="closeSheet">לא, חזרה</button></div>`;
  const dayOptions = n => futureDays(n).map(d => [d, longDay(d)]);

  // כרטיס "סיום הקורס" בכרטיס הסטודנט: ההודעה, החתימה, ותאריך סיום שתמימה יכולה לשנות
  function leaveCardHtml(s) {
    const L = s.leave;
    if (!ui.ld || ui.ld.id !== s.id) ui.ld = { id: s.id, date: L.endDate };
    const min = L.minDate || L.endDate;
    return card(`<h2>הודעת עזיבה</h2>
      <dl class="kv"><dt>התקבלה ב</dt><dd>${fullDate(L.noticeDate)}${L.source === 'outside' ? ' · התקבלה מחוץ לאפליקציה' : ''}</dd>
        ${L.name ? `<dt>שם</dt><dd>${esc(L.name)}</dd>` : ''}<dt>תאריך הסיום</dt><dd><b>${longDay(L.endDate)}</b></dd><dt>גרסת מדיניות</dt><dd>${esc(L.version)}</dd></dl>
      ${L.confirmedAt ? `<p class="ok-line">✓ אושר ב-${dateTime(L.confirmedAt)}</p>` : ''}
      <label class="field"><span>שינוי תאריך הסיום</span><input type="date" data-bind="ld.date" data-rerender="page" value="${esc(ui.ld.date)}"></label>
      ${ui.ld.date && ui.ld.date < min ? `<p class="policy warn">התאריך מוקדם מהמדיניות (לפיה: ${longDay(min)}). אפשר לשמור בכל זאת.</p>` : ''}
      ${ui.ld.date && ui.ld.date !== L.endDate ? `<button class="btn ghost small" data-act="stuLeaveDate" data-id="${s.id}">שמירת תאריך הסיום</button>` : ''}
      <p class="muted small">עד תאריך הסיום הכל ממשיך כרגיל, כולל דרישות תשלום. כרטיסייה שתתחיל אחרי הסיום לא נשלחת לתשלום.</p>`);
  }

  /* ---------- כרטיס סטודנט ---------- */
  function tStudentCard(id) {
    const s = student(id) || S.students[0];
    if (!s) return `<a class="back" href="#/tamima/classes" data-act="clsTab" data-t="students">חזרה לסטודנטים</a><h1>כרטיס סטודנט</h1>${card(empty('עדיין אין סטודנטים. מוסיפים ב"חוגים", בלשונית "סטודנטים".'))}`;
    const g = group(s.groupId);
    const ps = payStatus(s);
    const size = S.settings.cardSize;
    const stChip = l => {
      if (l.cancelled) return chip('בוטל על ידי הסטודיו', 'muted');
      const v = att(l.id).rec[s.id];
      if (v === 'arrived') return chip('הגעה', 'paid');
      if (v === 'cancelled') return chip('ביטול בזמן', 'requested');
      if (v === 'late') return chip('ביטול מאוחר', 'overdue');
      if (v === 'absent') return chip('אי הגעה', 'overdue');
      return lStart(l) > now() ? chip('מתוכנן', 'ok') : chip('לא סומן', 'muted');
    };
    const upcoming = studentUpcoming(s).slice(0, 4);
    const recent = S.lessons.filter(l => l.groupId === s.groupId && inLesson(s, l) && lEnd(l) < now()).slice(-4).reverse();
    const credits = S.makeups.filter(m => m.studentId === s.id && (m.bookedLessonId ? lEnd(lesson(m.bookedLessonId)) > now() : m.expires >= todayIso()));
    const pays = S.payments.filter(p => p.studentId === s.id).sort((a, b) => b.date.localeCompare(a.date));
    const needs = ps.key === 'requested' || ps.key === 'overdue';
    const off = s.active === false;
    return `<a class="back" href="#/tamima/classes" data-act="clsTab" data-t="students">חזרה לסטודנטים</a>
      <section class="card stu-head">
        <span class="avatar" aria-hidden="true">${esc(s.name.trim()[0] || '?')}</span>
        <div class="stu-id">
          <h1>${esc(s.name)}</h1>
          <p class="muted">${g ? `${esc(g.name)} · יום ${DAYS[g.day]} ${g.start}` : ''}${s.start ? ` · ${s.start > todayIso() ? `מתחיל ב${longDay(s.start)}` : `תחילת הקורס ${dmy(s.start)}`}` : ''}</p>
          <p class="stu-contact"><span dir="ltr">${esc(s.phone)}</span>${s.email ? ` · <span dir="ltr">${esc(s.email)}</span>` : ' · <span class="muted">אין מייל</span>'}</p>
          <div class="srow-meta">${off ? chip('לא בקורס', 'muted') : chip(ps.label, ps.key)}${credits.some(m => !m.bookedLessonId) ? chip('השלמה פתוחה', 'site') : ''}${s.policy ? chip(`מדיניות אושרה ב-${fullDate(s.policy.date)}`, 'paid') : chip('מדיניות לא אושרה', 'requested')}${s.leave && !off ? chip(`סיום ב-${fullDate(s.leave.endDate)}`, 'requested') : ''}</div>
          ${s.policy ? '' : `<button class="btn ghost small" data-act="stuPolicyLink" data-id="${s.id}">שליחת קישור לאישור המדיניות</button>`}
        </div>
        <div class="btn-row"><button class="btn primary small" data-act="stuEdit" data-id="${s.id}">עריכת פרטים</button>${off
          ? `<button class="btn ghost small" data-act="stuActive" data-id="${s.id}" data-on="1">החזרה לקורס</button>`
          : `${s.leave ? '' : `<button class="btn ghost small" data-act="stuLeaveOutside" data-id="${s.id}">התקבלה הודעת עזיבה</button>`}<button class="btn ghost small" data-act="stuStopAsk" data-id="${s.id}">הסטודיו מפסיק את ההשתתפות</button>`}${s.anonymizedAt ? '' : `<button class="btn ghost small" data-act="anonAsk" data-kind="student" data-id="${s.id}">אנונימיזציה</button>`}</div>
      </section>
      <div class="stu-grid">
        ${s.leave ? leaveCardHtml(s) : ''}
        ${card(`<h2>כרטיסייה</h2>${punchDots(s)}
          <div class="counter"><button class="icon-btn" data-act="stuUse" data-id="${s.id}" data-d="-1" aria-label="הורדת שיעור מהכרטיסייה" ${s.used <= 0 ? 'disabled' : ''}>−</button><b aria-live="polite">${s.used}/${size}</b><button class="icon-btn" data-act="stuUse" data-id="${s.id}" data-d="1" aria-label="הוספת שיעור לכרטיסייה">+</button></div>
          <p class="muted small center">תיקון ידני, למשל שיעור שלא סומן.</p>
          ${needs ? `<button class="btn primary block" data-act="remind" data-id="${s.id}">${s.reminded ? 'לשלוח שוב תזכורת' : 'שליחת תזכורת לתשלום'}</button>` : ''}
          <button class="btn ghost block" data-act="stuPayManual" data-id="${s.id}">רישום תשלום שהתקבל</button>
          ${needs && ui.guided ? `<button class="btn demo block" data-act="simPay" data-id="${s.id}">הדגמה: תשלום בקישור</button>` : ''}`)}
        ${card(`<h2>פרטי קשר</h2>
          <dl class="kv"><dt>טלפון</dt><dd dir="ltr"><a href="tel:${esc(s.phone.replace(/[^\d+]/g, ''))}">${esc(s.phone)}</a></dd>
          <dt>מייל</dt><dd dir="ltr">${s.email ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : 'לא נמסר'}</dd></dl>
          <label class="field"><span>הערות <small class="hint-inline">רק תמימה רואה. נשמר אוטומטית.</small></span><textarea data-note="${s.id}" rows="3">${esc(s.notes || '')}</textarea></label>`)}
        ${card(`<div class="row-between"><h2>השלמות</h2><button class="btn ghost small" data-act="stuGrant" data-id="${s.id}">מתן השלמה</button></div>
          ${credits.length ? credits.map(m => {
            const bl = m.bookedLessonId && lesson(m.bookedLessonId);
            return `<div class="ws-row"><div><b>${bl ? `נקבעה: ${esc(group(bl.groupId).name)}, ${shortDay(bl.date)}` : `פתוחה, בתוקף עד ${dmy(m.expires)}`}</b><small>${m.sourceLessonId ? 'מביטול שיעור' : 'ניתנה ידנית'}</small></div>${bl ? '' : `<button class="btn ghost small" data-act="stuCreditExtend" data-id="${m.id}">הארכה בחודש</button>`}<button class="x-btn" data-act="stuCreditDel" data-id="${m.id}" aria-label="ביטול ההשלמה">×</button></div>`;
          }).join('') : empty('אין השלמות פתוחות.')}`)}
        ${card(`<h2>שיעורים</h2>
          <h3 class="mini-h">הבאים</h3>${upcoming.map(x => `<div class="ws-row"><div><b>${shortDay(x.l.date)}</b><small>${esc(group(x.l.groupId).name)}${x.kind === 'makeup' ? ' · השלמה' : ''}</small></div>${stChip(x.l)}</div>`).join('') || empty('אין שיעורים קרובים.')}
          <h3 class="mini-h">אחרונים</h3>${recent.map(l => `<button class="ws-row" data-act="goLesson" data-l="${l.id}"><div><b>${shortDay(l.date)}</b><small>${esc(group(l.groupId).name)} · לסימון נוכחות</small></div>${stChip(l)}</button>`).join('') || empty('אין עדיין.')}`)}
        ${card(`<h2>תשלומים</h2>${pays.map(p => `<div class="pay-row"><button class="ws-row" data-act="invoiceSheet" data-id="${p.id}"><span class="dot dot-paid" aria-hidden="true"></span><div><b>${money(p.amount)}</b><small>${dmy(p.date)} · חשבונית מס קבלה מס׳ ${p.invoice}${p.manual ? ' · נרשם ידנית' : ''}</small></div><span class="go">חשבונית</span></button><div class="btn-row">${pdfBtn(p.invoice)}</div>${refundLines(p.invoice)}${refundable(p.invoice) ? `<button class="btn ghost small" data-act="refundOpen" data-inv="${p.invoice}" aria-label="זיכוי לחשבונית ${p.invoice}">זיכוי</button>` : ''}</div>`).join('') || empty('אין תשלומים עדיין.')}`)}
      </div>`;
  }

  /* ---------- פניות לקורס מהאתר ---------- */
  // [שם, צבע, הסבר]
  const LEAD_STATUS = {
    new: ['חדשה', 'site', ''],
    waiting: ['ממתין למקום', 'requested', 'יש רצון להצטרף, אבל אין עכשיו מקום בקבוצה המתאימה'],
    noanswer: ['לא ענה', 'muted', 'ניסיתי ליצור קשר ולא הצלחתי'],
    notfit: ['דיברנו, לא מתאים', 'muted', 'הקורס לא מתאים כרגע'],
    student: ['הצטרפות לקורס', 'paid', '']
  };
  const leadStatus = l => l.status || (l.handled ? 'notfit' : 'new');
  const hasSeat = gid => { const g = group(gid); return g && g.active !== false && groupStudents(gid).length < g.max; };
  function leadsCard() {
    if (!S.leads.length) return '';
    const order = { waiting: 0, new: 1, noanswer: 2, notfit: 3, student: 4 };
    const list = S.leads.slice().sort((a, b) => order[leadStatus(a)] - order[leadStatus(b)] || String(b.at || '').localeCompare(String(a.at || '')));
    const row = l => {
      const st = leadStatus(l);
      const seat = st === 'waiting' && (l.group ? hasSeat(l.group) : activeGroups().some(g => hasSeat(g.id)));
      return `<div class="lead-row">
        <div class="lead-txt"><b>${esc(l.name)}</b>
          <small><span dir="ltr">${esc(l.phone)}</span>${l.email ? ` · <span dir="ltr">${esc(l.email)}</span>` : ''}</small>
          <small>${l.group && group(l.group) ? 'קבוצה מועדפת: ' + group(l.group).name : 'כל קבוצה'}${l.at ? ` · פנייה מ-${dmy(l.at)}` : ''}</small>
          <span class="srow-meta">${chip(LEAD_STATUS[st][0], LEAD_STATUS[st][1])}${seat ? chip('יש מקום בקבוצה', 'ok') : ''}</span></div>
        ${st === 'student' ? (l.studentId && student(l.studentId) ? `<a class="btn small ghost" href="#/tamima/student/${l.studentId}">לכרטיס</a>` : '')
          : `<button class="btn small ${seat || st === 'new' ? 'primary' : 'ghost'}" data-act="leadToStudent" data-id="${l.id}">הוספה כסטודנט</button>`}
      </div>`;
    };
    return card(`<h2>פניות מהאתר</h2><p class="muted small">מי שהשאיר פרטים בעמוד הקורס. מי שממתין למקום מופיע ראשון.</p>${list.map(row).join('')}`);
  }

  /* ---------- לשוניות בחוגים: סטודנטים, קבוצות ---------- */
  function studentsTab() {
    const q = String(ui.stq.q || '').trim();
    const digits = q.replace(/\D/g, '');
    const match = s => !q || s.name.includes(q) || (digits.length >= 3 && s.phone.replace(/\D/g, '').includes(digits));
    const row = s => {
      const ps = payStatus(s);
      return `<a class="st-row" href="#/tamima/student/${s.id}"><span class="avatar sm" aria-hidden="true">${esc(s.name.trim()[0] || '?')}</span>
        <span class="st-txt"><b>${esc(s.name)}</b><small>כרטיסייה ${s.used}/${S.settings.cardSize} · <span dir="ltr">${esc(s.phone)}</span></small></span>${s.active === false ? chip('לא בקורס', 'muted') : chip(ps.label, ps.key)}</a>`;
    };
    const sections = activeGroups().map(g => {
      const list = groupStudents(g.id).filter(match);
      return list.length || !q ? `<h2 class="mini-h">${esc(g.name)} <small>${groupStudents(g.id).length}/${g.max}</small></h2>${list.map(row).join('') || empty('אין סטודנטים בקבוצה.')}` : '';
    }).join('');
    const old = ui.stq.old ? S.students.filter(s => s.active === false && match(s)) : [];
    return `<div class="row-between list-tools">
        <label class="field search"><span class="sr-only">חיפוש סטודנט</span><input type="search" data-bind="stq.q" data-live="page" value="${esc(q)}" placeholder="חיפוש לפי שם או טלפון"></label>
        <button class="btn primary small" data-act="stuNew">+ סטודנט</button>
      </div>
      ${card(sections + (old.length ? `<h2 class="mini-h">לא פעילים</h2>${old.map(row).join('')}` : '') + (q && !sections && !old.length ? empty('לא נמצאו סטודנטים.') : ''))}
      <label class="consent"><input type="checkbox" data-bind="stq.old" data-rerender="page" ${ui.stq.old ? 'checked' : ''}><span>להציג גם סטודנטים שעזבו</span></label>
      ${leadsCard()}`;
  }
  function groupsTab() {
    return `<div class="row-between list-tools"><p class="muted small">שינוי יום או שעה חל מהשיעור הבא. הסטודנטים מקבלים הודעה, והיומן והאתר מתעדכנים.</p><button class="btn primary small" data-act="grpNew">+ קבוצה</button></div>
      ${card(activeGroups().map(g => `<div class="grp-row">
        <div><b>${esc(g.name)}</b><small>יום ${DAYS[g.day]} · ${g.start} עד ${g.end} · ${groupStudents(g.id).length}/${g.max} סטודנטים</small></div>
        <div class="btn-row"><button class="btn ghost small" data-act="grpEdit" data-id="${g.id}" aria-label="עריכת ${esc(g.name)}">עריכה</button><button class="btn ghost small" data-act="grpRemoveAsk" data-id="${g.id}" aria-label="הסרת ${esc(g.name)}">הסרה</button></div>
      </div>`).join('') || empty('אין קבוצות.'))}`;
  }

  /* ---------- טפסים בחלון ---------- */
  function studentFormHtml() {
    const f = ui.stf;
    return `<h2>${f.id ? 'עריכת פרטי סטודנט' : 'הוספה לקורס'}</h2>
      ${fld('stf', 'name', 'שם מלא', 'autocomplete="off" required aria-required="true"')}
      ${fld('stf', 'phone', 'טלפון', 'type="tel" inputmode="tel" required aria-required="true"')}
      ${fld('stf', 'email', 'מייל <small class="hint-inline">לאישורים, חשבוניות ותזכורות</small>', 'type="email" inputmode="email" autocomplete="off" placeholder="name@example.com"')}
      ${f.id ? '' : `<label class="consent"><input type="checkbox" data-bind="stf.paid" data-rerender="sheet" ${f.paid ? 'checked' : ''}><span>הכרטיסייה הנוכחית כבר שולמה</span></label>
      ${f.paid ? fld('stf', 'used', `שיעורים שנוצלו <small class="hint-inline">מתוך ${S.settings.cardSize}</small>`, `type="number" min="0" max="${S.settings.cardSize}" inputmode="numeric"`)
        : '<p class="muted small">יישלח מייל ברוכים הבאים עם קישור תשלום לכרטיסייה הראשונה.</p>'}`}
      ${pickSel('stf', 'groupId', 'קבוצה', activeGroups().map(g => [g.id, `${g.name} · ${groupStudents(g.id).filter(x => x.id !== f.id).length}/${g.max}`]), true)}
      ${(() => {
        const dates = groupLessonDates(f.groupId);
        const saved = f.id && student(f.id).groupId === f.groupId ? student(f.id).start : ''; // התאריך השמור של סטודנט קיים (גם אם עבר) נשאר לבחירה
        if (saved && !dates.includes(saved)) dates.unshift(saved);
        if (!f.start || !dates.includes(f.start)) f.start = dates[0] || '';
        return dates.length ? pickSel('stf', 'start', 'תחילת הקורס', dates.map(d => [d, d < todayIso() ? `${longDay(d)} (כבר התחיל)` : longDay(d)]))
          : '<p class="notice">אין לקבוצה הזו שיעורים קרובים. אפשר לבחור קבוצה אחרת.</p>';
      })()}
      <p class="muted small">מהתאריך הזה השם מופיע ברשימת הנוכחות, והכרטיסייה מתחילה להיספר.</p>
      ${f.id && student(f.id).groupId !== f.groupId ? '<p class="notice">המעבר חל מהשיעור הבא, ותישלח הודעה במייל.</p>' : ''}
      ${errP('stf')}
      <button class="btn primary block" data-act="stuSave">שמירה</button>`;
  }
  function groupFormHtml() {
    const f = ui.gf;
    const hrs = halfHours('08:00', '22:00').map(t => [t, t]);
    return `<h2>${f.id ? 'עריכת קבוצה' : 'קבוצה חדשה'}</h2>
      ${fld('gf', 'name', 'שם', 'required aria-required="true"')}
      ${pickSel('gf', 'day', 'יום', [0, 1, 2, 3, 4, 5].map(d => [d, `יום ${DAYS[d]}`]))}
      <div class="two">${pickSel('gf', 'start', 'שעת התחלה', hrs)}${pickSel('gf', 'end', 'שעת סיום', hrs)}</div>
      ${fld('gf', 'max', 'מקסימום מקומות', 'type="number" min="1" max="12" inputmode="numeric"')}
      ${f.id ? '<p class="notice">שינוי יום או שעה חל מהשיעור הבא. השיעורים שכבר היו נשמרים.</p>' : ''}
      ${errP('gf')}
      <button class="btn primary block" data-act="grpSave">שמירה</button>`;
  }
  function wsFormHtml() {
    const f = ui.wsf;
    let when = '';
    if (f.mode === 'new') {
      const opts = timeOptions(f.date, { takeSlots: true });
      if (!opts.some(o => o.t === f.time)) f.time = opts.length ? opts[0].t : '';
      when = `${pickSel('wsf', 'date', 'יום', dayOptions(60), true)}
        ${opts.length ? pickSel('wsf', 'time', 'שעה', opts.map(o => [o.t, o.label])) : '<p class="policy warn" role="status">אין ביום הזה שעתיים פנויות. בחרו יום אחר.</p>'}`;
    }
    const w = f.id && workshop(f.id);
    return `<h2>${f.mode === 'new' ? 'סדנה חדשה' : 'עריכת סדנה'}</h2>
      ${when}
      ${fld('wsf', 'name', 'שם הלקוח', 'required aria-required="true"')}
      <div class="two">${fld('wsf', 'phone', 'טלפון', 'type="tel" inputmode="tel"')}${fld('wsf', 'n', 'משתתפים', 'type="number" min="1" max="12" inputmode="numeric"')}</div>
      ${fld('wsf', 'email', 'מייל (לא חובה)', 'type="email" inputmode="email"')}
      ${fld('wsf', 'amount', `סכום (ברירת מחדל ${money(price(Number(f.n) || 2))})`, 'inputmode="numeric"')}
      ${!w || w.receipt !== 'auto' ? `<label class="consent"><input type="checkbox" data-bind="wsf.paid" ${f.paid ? 'checked' : ''}><span>שולם</span></label>` : ''}
      ${errP('wsf')}
      <button class="btn primary block" data-act="wsSave" ${f.mode === 'new' && !f.time ? 'disabled' : ''}>שמירה</button>`;
  }
  function moveFormHtml() {
    const f = ui.mvf;
    const opts = f.kind === 'ws'
      ? timeOptions(f.date, { takeSlots: true, ignore: f.ignore })
      : timeOptions(f.date, { skipSlot: { date: f.fromDate, time: f.fromTime }, takeSlots: true, notChannel: f.ch });
    if (!opts.some(o => o.t === f.time)) f.time = opts.length ? opts[0].t : '';
    return `<h2>הזזה למועד אחר</h2><p class="muted">עכשיו: ${longDay(f.fromDate)}, ${f.fromTime}</p>
      ${pickSel('mvf', 'date', 'יום', dayOptions(60).filter(([d]) => f.kind === 'ws' || !releaseProblem(f.ch, d, '23:59')), true)}
      ${opts.length ? pickSel('mvf', 'time', 'שעה', opts.map(o => [o.t, o.label])) : '<p class="policy warn" role="status">אין ביום הזה שעתיים פנויות.</p>'}
      ${f.kind === 'ws' ? '<p class="notice">יישלח מייל עם המועד החדש.</p>' : ''}
      ${errP('mvf')}
      <button class="btn primary block" data-act="mvSave" ${f.time ? '' : 'disabled'}>הזזה</button>`;
  }
  /* ---------- אירוע ביומן: שעות או יום שלם, עם חזרה ----------
     האירוע של תמימה תמיד נשמר. הוא סוגר את הזמן הפנוי לכל הערוצים, אבל לא מבטל הזמנה של לקוח:
     לא הזמנה בתהליך ולא הזמנה ששולמה. לפני השמירה מוצגת אזהרה וזמנים חלופיים קרובים. */
  const DOW_CODE = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const evDur = f => (f.allDay ? 1440 : toMin(f.end) - toMin(f.start));
  // מועדי האירוע ב-120 הימים הקרובים (לאזהרות)
  function evOccurrences(f, limitDays = 120) {
    if (!f.date) return [];
    if (f.repeat === 'none') return [f.date];
    const start = parse(f.date), maxD = addDays(startOfToday(), limitDays);
    const untilD = f.endMode === 'until' && f.until ? parse(f.until) : null;
    const maxN = f.endMode === 'count' ? Math.max(1, Number(f.count) || 1) : Infinity;
    const days = f.days.length ? f.days : [start.getDay()];
    const sw = addDays(start, -start.getDay());
    const out = [];
    for (let d = start; d <= maxD && out.length < maxN; d = addDays(d, 1)) {
      if (untilD && d > untilD) break;
      if (f.repeat === 'daily') { out.push(iso(d)); continue; }
      const wk = Math.floor(Math.round((d - sw) / 864e5) / 7);
      if (days.includes(d.getDay()) && wk % (Number(f.interval) || 1) === 0) out.push(iso(d));
    }
    return out;
  }
  // מה חופף: הזמנות בתהליך, הזמנות ששולמו ושיעורים
  function evOverlaps(f) {
    const res = { holds: 0, paid: 0, lessons: 0, first: [] };
    const span = f.allDay ? Math.max(0, Math.round((parse(f.toDate || f.date) - parse(f.date)) / 864e5)) : 0;
    evOccurrences(f).forEach(d0 => {
      for (let k = 0; k <= span; k++) {
        const d = iso(addDays(parse(d0), k));
        const s = f.allDay ? 0 : toMin(f.start), e = f.allDay ? 1440 : toMin(f.end);
        const b = bookingsAt(d, s, e);
        const ls = S.lessons.filter(l => l.date === d && !l.cancelled && group(l.groupId).active !== false && toMin(l.start || group(l.groupId).start) < e && s < toMin(l.end || group(l.groupId).end));
        res.holds += b.holds.length; res.paid += b.paid.length; res.lessons += ls.length;
        if ((b.holds.length || b.paid.length || ls.length) && res.first.length < 3) res.first.push(shortDay(d));
      }
    });
    return res;
  }
  // שלושה זמנים פנויים קרובים באותו אורך (רק לאירוע חד פעמי בשעות)
  function evAlternatives(f) {
    if (f.allDay || f.repeat !== 'none' || !f.date) return [];
    const dur = evDur(f);
    if (!(dur > 0)) return [];
    const out = [];
    for (let k = 0; k < 4 && out.length < 3; k++) {
      const d = iso(addDays(parse(f.date), k));
      if (parse(d).getDay() === 6) continue;
      const b = busy(d);
      for (let m = 8 * 60; m + dur <= 22 * 60 && out.length < 3; m += 30) {
        if (d === f.date && fromMin(m) === f.start) continue;
        if (at(d, fromMin(m)) <= now()) continue;
        const iv = { s: m, e: m + dur };
        if (b.some(x => overlaps(x, iv))) continue;
        const bk2 = bookingsAt(d, m, m + dur);
        if (bk2.holds.length || bk2.paid.length) continue;
        out.push({ date: d, start: fromMin(m), end: fromMin(m + dur) });
      }
    }
    return out;
  }
  function rruleFor(f) {
    if (f.repeat === 'none') return null;
    const parts = [`FREQ=${f.repeat === 'daily' ? 'DAILY' : 'WEEKLY'}`];
    if (f.repeat === 'weekly') {
      parts.push(`INTERVAL=${Math.max(1, Number(f.interval) || 1)}`);
      parts.push('BYDAY=' + (f.days.length ? f.days : [parse(f.date).getDay()]).slice().sort().map(i => DOW_CODE[i]).join(','));
    }
    if (f.endMode === 'count') parts.push(`COUNT=${Math.min(200, Math.max(1, Number(f.count) || 1))}`);
    else parts.push(`UNTIL=${f.until.replace(/-/g, '')}T235959Z`);
    return 'RRULE:' + parts.join(';');
  }
  // תיאור החזרה במילים
  function rruleText(rule) {
    const p = Object.fromEntries(rule.slice(6).split(';').map(x => x.split('=')));
    const n = Number(p.INTERVAL) || 1;
    let t = p.FREQ === 'DAILY' ? 'חוזר כל יום' : `חוזר ${n === 1 ? 'כל שבוע' : n === 2 ? 'כל שבועיים' : `כל ${n} שבועות`}`;
    if (p.BYDAY) t += ` בימים ${p.BYDAY.split(',').map(c => DAYS_SHORT[DOW_CODE.indexOf(c)]).join(', ')}`;
    if (p.COUNT) t += `, ${p.COUNT} פעמים`;
    if (p.UNTIL) t += `, עד ${dmy(`${p.UNTIL.slice(0, 4)}-${p.UNTIL.slice(4, 6)}-${p.UNTIL.slice(6, 8)}`)}`;
    return t + '.';
  }
  function evFormHtml() {
    const f = ui.evf;
    const hrs = halfHours('07:00', '23:00').map(t => [t, t]);
    const ov = evOverlaps(f), alts = ov.holds || ov.paid || ov.lessons ? evAlternatives(f) : [];
    const warn = [];
    if (ov.holds) warn.push(ov.holds === 1 ? 'לקוח באמצע הזמנה בזמן הזה' : `${ov.holds} לקוחות באמצע הזמנה בזמנים האלה`);
    if (ov.paid) warn.push(ov.paid === 1 ? 'סדנה שכבר שולמה' : `${ov.paid} סדנאות שכבר שולמו`);
    if (ov.lessons) warn.push(ov.lessons === 1 ? 'שיעור של קבוצה' : `${ov.lessons} שיעורים של קבוצות`);
    const title = f.id ? (f.scope === 'one' ? 'עריכת המופע הזה' : 'עריכת האירוע') : 'אירוע חדש';
    return `<h2>${title}</h2>
      ${fld('evf', 'summary', 'שם האירוע <small class="hint-inline">רק תמימה רואה</small>', 'maxlength="80"')}
      <label class="consent"><input type="checkbox" data-bind="evf.allDay" data-rerender="sheet" ${f.allDay ? 'checked' : ''}><span>יום שלם</span></label>
      ${f.allDay
        ? `<div class="two"><label class="field"><span>מתאריך</span><input type="date" min="${todayIso()}" data-bind="evf.date" data-rerender="sheet" value="${esc(f.date)}"></label><label class="field"><span>עד תאריך</span><input type="date" min="${esc(f.date)}" data-bind="evf.toDate" data-rerender="sheet" value="${esc(f.toDate)}"></label></div>`
        : `<label class="field"><span>תאריך</span><input type="date" min="${todayIso()}" data-bind="evf.date" data-rerender="sheet" value="${esc(f.date)}"></label>
          <div class="two">${pickSel('evf', 'start', 'משעה', hrs, true)}${pickSel('evf', 'end', 'עד שעה', hrs, true)}</div>`}
      ${f.scope === 'one' ? '' : `${pickSel('evf', 'repeat', 'חזרה', [['none', 'בלי חזרה'], ['daily', 'כל יום'], ['weekly', 'כל שבוע, בימים שבוחרים']], true)}
      ${f.repeat === 'weekly' ? `<p class="small" id="ev-days-l">בימים</p><div class="ev-days" role="group" aria-labelledby="ev-days-l">${DAYS_SHORT.map((x, i) => `<button type="button" data-act="evDay" data-d="${i}" aria-pressed="${f.days.includes(i)}" aria-label="יום ${DAYS[i]}">${x}</button>`).join('')}</div>
        ${pickSel('evf', 'interval', 'כל כמה שבועות', [[1, 'כל שבוע'], [2, 'כל שבועיים'], [3, 'כל 3 שבועות'], [4, 'כל 4 שבועות']], true)}` : ''}
      ${f.repeat !== 'none' ? `${pickSel('evf', 'endMode', 'עד מתי', [['until', 'עד תאריך'], ['count', 'מספר פעמים']], true)}
        ${f.endMode === 'count' ? fld('evf', 'count', 'כמה פעמים', 'type="number" min="1" max="200" inputmode="numeric" data-rerender="sheet"') : `<label class="field"><span>עד תאריך</span><input type="date" min="${esc(f.date)}" data-bind="evf.until" data-rerender="sheet" value="${esc(f.until)}"></label>`}` : ''}`}
      ${warn.length ? `<div class="policy warn"><b>יש בזמן הזה: ${warn.join(', ')}${ov.first.length ? ` (${ov.first.join(', ')})` : ''}.</b>האירוע יישמר, וההזמנות והשיעורים נשארים כמו שהם. אפשר לבחור זמן אחר.</div>
        ${alts.length ? `<p class="small">זמנים פנויים קרובים:</p><div class="ev-alts">${alts.map(x => `<button class="btn ghost small" data-act="evAlt" data-date="${x.date}" data-s="${x.start}" data-e="${x.end}">${shortDay(x.date)} ${x.start} עד ${x.end}</button>`).join('')}</div>` : ''}` : ''}
      ${errP('evf')}
      <button class="btn primary block" data-act="evSave">${f.id ? 'שמירה' : 'הוספה ליומן'}</button>`;
  }
  // גוף האירוע ליומן גוגל
  function evBody(f, withRule) {
    const summary = String(f.summary || '').trim() || 'אירוע';
    const rule = withRule ? rruleFor(f) : null;
    // מופעים שנמחקו קודם נשארים מחוקים, גם כשהשעה של הסדרה משתנה
    const ex = (f.keepEx || []).map(x => (f.allDay || !/T\d{6}/.test(x) ? x : x.replace(/T\d{6}/g, `T${f.start.replace(':', '')}00`)));
    const extra = rule ? { recurrence: [rule].concat(ex) } : {};
    if (!f.allDay) return blockBody(f.date, f.start, f.end, summary, extra);
    return Object.assign({ summary, colorId: '8', visibility: 'private', start: { date: f.date }, end: { date: iso(addDays(parse(f.toDate || f.date), 1)) },
      extendedProperties: { private: { app: APP, kind: 'block' } } }, extra);
  }
  // מילוי הטופס מאירוע קיים: כל הסדרה, או מופע אחד
  function evFromEvent(ev, master, scope) {
    const src = scope === 'one' ? ev : master || ev;
    const allDay = !!src.start.date;
    const f = { id: (master || ev).id, scope, instId: ev.id, inst: ev.originalStartTime ? (ev.originalStartTime.dateTime || ev.originalStartTime.date) : null,
      summary: src.summary === 'חסימה אישית' ? '' : src.summary || '', allDay,
      date: allDay ? src.start.date : G.msToWall(G.edgeMs(src.start)).slice(0, 10),
      start: allDay ? '10:00' : G.msToWall(G.edgeMs(src.start)).slice(11, 16), end: allDay ? '12:00' : G.msToWall(G.edgeMs(src.end)).slice(11, 16),
      toDate: allDay ? iso(addDays(parse(src.end.date), -1)) : '', repeat: 'none', interval: 1, days: [], endMode: 'until', until: '', count: 8, keepEx: [], err: '', errField: '' };
    const rule = scope === 'series' && (src.recurrence || []).find(r => r.startsWith('RRULE:'));
    if (rule) {
      const p = Object.fromEntries(rule.slice(6).split(';').map(x => x.split('=')));
      f.repeat = p.FREQ === 'DAILY' ? 'daily' : 'weekly';
      f.interval = Number(p.INTERVAL) || 1;
      f.days = (p.BYDAY || '').split(',').filter(Boolean).map(c => DOW_CODE.indexOf(c)).filter(i => i >= 0);
      if (p.COUNT) { f.endMode = 'count'; f.count = Number(p.COUNT); }
      if (p.UNTIL) f.until = `${p.UNTIL.slice(0, 4)}-${p.UNTIL.slice(4, 6)}-${p.UNTIL.slice(6, 8)}`;
      f.keepEx = src.recurrence.filter(r => r.startsWith('EXDATE'));
    }
    return f;
  }
  const exdateFor = inst => (/T/.test(inst) ? `EXDATE;TZID=${G.TZ}:${inst.slice(0, 19).replace(/[-:]/g, '')}` : `EXDATE;VALUE=DATE:${inst.replace(/-/g, '')}`);
  // אירוע לפי מזהה, כולל מופע של אירוע חוזר (בשעות או ביום שלם)
  function evGet(id) {
    const e = safeGet(CAL.studio, id);
    if (e) return e;
    const t = instanceOf(CAL.studio, id);
    if (t) return t;
    const m = String(id).match(/_(\d{4})(\d{2})(\d{2})$/);
    if (!m) return null;
    const d = `${m[1]}-${m[2]}-${m[3]}`;
    return G.events.list({ calendarId: CAL.studio, ...dayRange(d, d), singleEvents: true }).items.find(x => x.id === id) || null;
  }

  /* ---------- תוכן האתר (לשונית ב"עוד") ---------- */
  function contentTab() {
    const c = S.content;
    const t = (k, label, area) => area
      ? `<label class="field"><span>${label}</span><textarea data-content="${k}" rows="3">${esc(c[k])}</textarea></label>`
      : `<label class="field"><span>${label}</span><input data-content="${k}" value="${esc(c[k])}"></label>`;
    const pick = (k, label) => `<details class="photo-choose"><summary><img src="${IMGS(c[k])}" alt=""><span><b>${label}</b><small>${esc(PHOTOS[c[k]] || '')} · החלפה</small></span></summary>
      <fieldset class="photo-pick"><legend class="sr-only">${label}</legend>${Object.keys(PHOTOS).map(p => `<label class="ph"><input type="radio" name="cp-${k}" data-content="${k}" value="${p}" ${c[k] === p ? 'checked' : ''}><img src="${IMGS(p)}" alt=""><span>${PHOTOS[p]}</span></label>`).join('')}</fieldset></details>`;
    return `${ui.cMsg ? `<p class="${ui.cMsg.ok ? 'flash' : 'err'}" role="status"><span>${esc(ui.cMsg.text)}</span></p>` : ''}
      ${card(`<div class="row-between"><h2>עמוד הבית</h2><a class="btn ghost small" href="#/client">צפייה באתר</a></div>
        ${t('heroEyebrow', 'שורה קטנה מעל הכותרת')}${t('heroTitle', 'כותרת')}${t('heroAccent', 'המשך הכותרת')}${t('heroText', 'טקסט פתיחה', 1)}${pick('heroImage', 'תמונה ראשית')}`)}
      ${card(`<h2>סדנה וקורס</h2>${t('workshopTitle', 'שם הסדנה')}${pick('workshopImage', 'תמונת הסדנה')}${t('courseTitle', 'שם הקורס')}${t('courseText', 'תיאור הקורס', 1)}${pick('courseImage', 'תמונת הקורס')}
        <p class="muted small">הימים והשעות של החוגים, והמחירים, מתעדכנים באתר לבד לפי הקבוצות וההגדרות.</p>`)}
      ${card(`<h2>הסטודיו</h2>${t('studioTitle', 'כותרת')}${t('studioText', 'טקסט', 1)}${t('ctaTitle', 'כותרת בתחתית')}${t('ctaText', 'טקסט בתחתית', 1)}${t('address', 'כתובת')}`)}
      ${card(`<h2>גלריה</h2><p class="muted small">לפחות 3 תמונות.</p><fieldset class="photo-pick"><legend class="sr-only">תמונות בגלריה</legend>${Object.keys(PHOTOS).map(p => `<label class="ph"><input type="checkbox" data-gallery value="${p}" ${c.gallery.includes(p) ? 'checked' : ''}><img src="${IMGS(p)}" alt=""><span>${PHOTOS[p]}</span></label>`).join('')}</fieldset>`)}`;
  }

  /* ---------- "מועד חדש": חלופה נגישה במקלדת ללחיצה על הרשת (ת"י 5568, 2.1.1) ---------- */
  function nsfDays() {
    const out = [];
    for (let i = 0; i <= 21; i++) { const d = iso(addDays(startOfToday(), i)); if (parse(d).getDay() !== 6) out.push(d); }
    return out;
  }
  function nsfHtml() {
    const f = ui.nsf;
    const times = [];
    // גם זמנים שכבר פתוחים למכירה: בחירת ערוץ מעבירה אותם אליו (אותה פעולה כמו לחיצה על משבצת ברשת)
    const open = dayItems(f.date).filter(i => i.kind === 'open' || i.kind === 'pend');
    // שני סוגים בלבד: מועד שפתוח בדיוק בשעה הזאת (כדי להעביר אותו), או זמן פנוי שלא חופף לשום מועד
    for (let m = GRID_FROM; m + X.WORKSHOP_MIN <= dayEndMin(f.date); m += 30) {
      const t = fromMin(m);
      if (startProblem(f.date, t, true)) continue;
      const hit = open.filter(i => overlaps(i, { s: m, e: m + X.WORKSHOP_MIN }));
      if (!hit.length || (hit.length === 1 && hit[0].time === t && hit[0].kind === 'open')) times.push(t);
    }
    const where = t => { const o = open.find(i => i.time === t && i.kind === 'open'); return o ? ` (פתוח כרגע ${inCh(G.channels.get(o.ch))})` : ' (פנוי)'; };
    if (!times.includes(f.time)) f.time = times[0] || '';
    return `<h2>מועד חדש</h2>
      <p class="muted small">מוצגות רק שעות שיש בהן שעתיים פנויות. מועד שכבר פתוח יעבור לערוץ שתבחרו.</p>
      <label class="field"><span>יום</span><select data-bind="nsf.date" data-rerender="sheet">${nsfDays().map(d => `<option value="${d}" ${d === f.date ? 'selected' : ''}>${longDay(d)}</option>`).join('')}</select></label>
      ${times.length ? `
        <label class="field"><span>שעת התחלה</span><select data-bind="nsf.time">${times.map(t => `<option value="${t}" ${t === f.time ? 'selected' : ''}>${t} עד ${endOf(t)}${where(t)}</option>`).join('')}</select></label>
        <fieldset class="fs"><legend>איפה לפתוח?</legend>${G.channels.active().map(ch => `<label class="radio-row"><input type="radio" name="nsf-ch" value="${ch.id}" data-bind="nsf.ch" ${f.ch === ch.id ? 'checked' : ''}><span><b>${ch.home ? 'באתר של תמימה' : `בערוץ "${esc(ch.name)}"`}</b></span></label>`).join('')}</fieldset>
        <button class="btn primary block" data-act="nsfOpen">פתיחת המועד</button>
        <button class="btn ghost block" data-act="nsfBlock">חסימת הזמן</button>
`
      : '<p class="policy warn" role="status">אין ביום הזה שעתיים פנויות. בחרו יום אחר.</p>'}
      <button class="linkish block-link" data-act="bulkOn">לפתוח כמה מועדים בבת אחת</button>`;
  }

  /* ---------- הערות נגישות ואבטחה לכל מסך, בהדגמה המודרכת ---------- */
  const COMPL_NOTES = {
    'client/home': ['כל האתר עובד גם עם מקלדת בלבד.', 'אפשר לעצור את הגלריה הנעה.', 'בתחתית העמוד: הצהרת נגישות ומדיניות פרטיות.'],
    'client/workshop': ['ליד הטופס מוסבר למה צריך את הפרטים, עם קישור למדיניות הפרטיות.', 'הסכמה לעדכונים במייל היא בחירה של הלקוח, ולא מסומנת מראש.', 'אם חסר פרט, ההודעה אומרת מה לתקן, והסמן עובר לשדה.', 'פרטי האשראי לא נשמרים אצל הסטודיו.'],
    'client/course': ['ליד הטופס מוסבר למה צריך את הפרטים.', 'הסכמה לעדכונים במייל היא בחירה, ולא מסומנת מראש.'],
    'client/accessibility': ['העמוד מסביר ללקוח מה אפשר לעשות באתר, ואיך לבקש התאמה או לדווח על בעיה.'],
    'client/privacy': ['העמוד מסביר ללקוח, בקצרה, מה נאסף, למה, ומי רואה.'],
    'student/home': ['באזור האישי מוצגים רק השיעורים והתשלומים של בעל/ת הקישור.'],
    'student/payments': ['התשלום בעמוד המאובטח של סאמיט. פרטי האשראי לא מגיעים לסטודיו.']
  };
  function complNotes(r) {
    const list = COMPL_NOTES[`${r.role}/${r.page || 'home'}`];
    return list ? `<ul>${list.map(x => `<li>${x}</li>`).join('')}</ul>` : '';
  }

  /* ---------- פעולות יומן עם משוב וביטול (י-12, יל-9) ---------- */
  // למה אי אפשר לפתוח מועד בזמן הזה. מחרוזת ריקה = אפשר.
  function startProblem(date, time, allowSlots, ignore) {
    const m = toMin(time), iv = { s: m, e: m + X.WORKSHOP_MIN };
    if (parse(date).getDay() === 6) return 'שבת: הסטודיו סגור.';
    if (at(date, time) <= now()) return 'אי אפשר לפתוח מועד בזמן שעבר.';
    if (m < GRID_FROM || iv.e > dayEndMin(date)) return `סדנה של שעתיים צריכה להסתיים עד ${fromMin(dayEndMin(date))}.`;
    // ignore: הזמן של האירוע שמזיזים לא נחשב תפוס עבור עצמו
    const b = busy(date).flatMap(x => (!ignore || ignore.date !== date || !overlaps(x, ignore) ? [x] : [{ s: x.s, e: ignore.s }, { s: ignore.e, e: x.e }].filter(p => p.e > p.s)));
    if (b.some(x => overlaps(x, iv))) return 'הזמן הזה לא פנוי.';
    if (!allowSlots && dayItems(date).some(i => (i.kind === 'open' || i.kind === 'pend') && overlaps(i, iv))) return 'יש כבר מועד פתוח שחופף לזמן הזה.';
    return '';
  }
  function releaseProblem(chId, date, time) {
    const ch = G.channels.get(chId);
    if (!ch || ch.home || ch.releaseDays == null) return '';
    return at(date, time) - ch.releaseDays * 864e5 <= now() ? `מועדים ל"${ch.name}" נפתחים לפחות ${ch.releaseDays} ימים מראש. מועד קרוב יותר נשאר באתר.` : '';
  }
  function calMessage(text) {
    ui.calMsg = text;
    render();
    clearTimeout(ui.calMsgT);
    ui.calMsgT = setTimeout(() => { ui.calMsg = ''; if (route().page === 'calendar') render(); }, 3500);
  }
  function flashKeys(keys) {
    ui.flash = keys;
    render();
    clearTimeout(ui.flashT2);
    ui.flashT2 = setTimeout(() => { ui.flash = []; }, 1600);
  }
  document.addEventListener('mouseover', e => { if (e.target.closest && e.target.closest('#snack')) clearTimeout(ui.snackT); });
  document.addEventListener('focusin', e => { if (e.target.closest && e.target.closest('#snack')) clearTimeout(ui.snackT); });
  // החזרת משבצת למצב שלפני השיוך
  function undoAssign(x, ch) {
    try {
      if (x.from) G.channels.assign(x.date, x.time, x.from);
      else G.events.delete({ calendarId: ch.calendarId, eventId: x.eventId });
    } catch (e) { /* הזמן נתפס בינתיים: משאירים כמו שהוא */ }
  }
  function openWithUndo(date, time, chId) {
    const ch = G.channels.get(chId);
    const iv = { s: toMin(time), e: toMin(time) + X.WORKSHOP_MIN };
    const displaced = slotsOn(date).filter(x => overlaps({ s: toMin(x.time), e: toMin(x.time) + X.WORKSHOP_MIN }, iv)).map(x => ({ time: x.time, channel: x.channel }));
    const rp = releaseProblem(chId, date, time);
    if (rp) { closeSheet(); calMessage(rp); return; }
    let ev;
    try { ev = G.channels.assign(date, time, chId); }
    catch (e) { calMessage('הזמן כבר לא פנוי. היומן עודכן.'); return; }
    log('sync', `${shortDay(date)} ${time} נפתח ${inCh(ch)}`, 'המועד נמחק מכל ערוץ אחר ונכתב רק ליומן של הערוץ הזה.');
    closeSheet();
    flashKeys([slotKey(date, time)]);
    snack(`${shortDay(date)} ${time} נפתח ${inCh(ch)}`, () => {
      undoAssign({ date, time, from: null, eventId: ev.id }, ch);
      displaced.forEach(x => { try { G.channels.assign(date, x.time, x.channel); } catch (e) { /* הזמן נתפס בינתיים */ } });
    });
  }
  function blockBody(date, time, end, summary, extra = {}) {
    return Object.assign({ summary: summary || 'חסימה אישית', colorId: '8', visibility: 'private',
      start: { dateTime: `${date}T${time}:00`, timeZone: G.TZ }, end: { dateTime: `${date}T${end}:00`, timeZone: G.TZ },
      extendedProperties: { private: { app: APP, kind: 'block' } } }, extra);
  }
  function blockWithUndo(date, time) {
    const ev = G.events.insert({ calendarId: CAL.studio, requestBody: blockBody(date, time, endOf(time)) });
    log('sync', 'זמן נחסם', `${shortDay(date)} ${time} עד ${endOf(time)} לא יוצע באף ערוץ.`);
    runSync();
    closeSheet();
    render();
    snack(`${shortDay(date)} ${time} נחסם`, () => {
      G.events.delete({ calendarId: CAL.studio, eventId: ev.id });
      runSync();
    });
  }

  function tClasses(gid) {
    const clsTabs = `<div class="tabs" role="tablist" aria-label="חוגים">${[['att', 'נוכחות'], ['students', 'סטודנטים'], ['groups', 'קבוצות']].map(([k, l]) => `<button role="tab" aria-selected="${ui.clsTab === k}" class="${ui.clsTab === k ? 'on' : ''}" data-act="clsTab" data-t="${k}">${l}</button>`).join('')}</div>`;
    if (ui.clsTab === 'students') return `<h1>חוגים</h1>${clsTabs}${studentsTab()}`;
    if (ui.clsTab === 'groups') return `<h1>חוגים</h1>${clsTabs}${groupsTab()}`;
    if (!activeGroups().length) return `<h1>חוגים</h1>${clsTabs}${card(empty('אין קבוצות. מוסיפים קבוצה בלשונית "קבוצות".'))}`;
    gid = group(gid) && group(gid).active !== false ? gid : ((S.lessons.find(l => lEnd(l) < now() && !att(l.id).marked && !l.cancelled && group(l.groupId).active !== false) || {}).groupId || activeGroups()[0].id);
    const g = group(gid);
    const T = todayIso();
    const mine = S.lessons.filter(l => l.groupId === gid);
    const recent = mine.filter(l => l.date <= T).slice(-4);
    const next = mine.find(l => l.date > T);
    const chips = recent.concat(next ? [next] : []);
    let sel = lesson(ui.lessonSel[gid]);
    if (!sel || sel.groupId !== gid) sel = recent.find(l => !att(l.id).marked && lEnd(l) < now()) || recent.find(l => l.date === T) || recent[recent.length - 1] || next;
    if (!sel) return `<h1>חוגים</h1>${clsTabs}${card(empty('אין לקבוצה הזו שיעורים מתוכננים.'))}`;
    ui.lessonSel[gid] = sel.id;
    const a = att(sel.id);
    const canMark = sel.date <= T && !sel.cancelled;
    const rs = roster(sel);
    const done = rs.regs.filter(s => a.rec[s.id]).length;

    const opts = [['arrived', 'הגיע'], ['cancelled', 'ביטול בזמן'], ['late', 'ביטול מאוחר']];
    const rows = rs.regs.map(s => {
      const ps = payStatus(s);
      const cr = openCredits(s).length;
      return `<div class="srow">
        <button class="srow-main" data-act="studentSheet" data-id="${s.id}">
          <b>${esc(s.name)}</b>
          <span class="srow-meta"><span class="punch">כרטיסייה ${s.used}/${S.settings.cardSize}</span>${chip(ps.label, ps.key)}${cr ? chip(`השלמה פתוחה`, 'muted') : ''}</span>
        </button>
        <div class="seg att">${opts.map(([v, l]) => `<button class="${a.rec[s.id] === v ? 'on on-' + v : ''}" data-act="mark" data-l="${sel.id}" data-s="${s.id}" data-v="${v}" ${canMark ? '' : 'disabled'}>${l}</button>`).join('')}</div>
      </div>`;
    }).join('');
    const guests = rs.guests.map(({ s }) => `<div class="srow guest">
        <div class="srow-main"><b>${esc(s.name)}</b><span class="srow-meta">${chip('השלמה מ' + group(s.groupId).name, 'muted')}<span class="punch">כרטיסייה ${s.used}/${S.settings.cardSize}</span></span></div>
        <div class="seg att">${[['arrived', 'הגיע'], ['absent', 'לא הגיע']].map(([v, l]) => `<button class="${a.rec[s.id] === v ? 'on on-' + v : ''}" data-act="mark" data-l="${sel.id}" data-s="${s.id}" data-v="${v}" ${canMark ? '' : 'disabled'}>${l}</button>`).join('')}</div>
      </div>`).join('');

    return `<h1>חוגים</h1>${clsTabs}
      <nav class="tabs sub" aria-label="קבוצה">${activeGroups().map(x => `<a href="#/tamima/classes/${x.id}" class="${x.id === gid ? 'on' : ''}" ${x.id === gid ? 'aria-current="page"' : ''}>${esc(x.name.replace('קבוצת ', ''))}</a>`).join('')}</nav>
      ${card(`<div class="row-between"><div><b>${g.name}</b><small class="muted"> · ${g.start} עד ${g.end} · ${groupStudents(gid).length} סטודנטים</small></div>
        <div class="mini-stepper"><span class="small muted">מקסימום מקומות</span>
          <button data-act="maxSeat" data-g="${gid}" data-d="-1" aria-label="פחות">−</button><b>${g.max}</b><button data-act="maxSeat" data-g="${gid}" data-d="1" aria-label="יותר">+</button></div></div>`)}
      <div class="lesson-chips">${chips.map(l => `<button class="lchip ${l.id === sel.id ? 'on' : ''}" data-act="selLesson" data-g="${gid}" data-l="${l.id}">${relDay(l.date)}${l.cancelled ? ' · בוטל' : att(l.id).marked ? ' ✓' : (lEnd(l) < now() ? ' •' : '')}</button>`).join('')}</div>
      ${card(`<div class="row-between"><h2>שיעור ${longDay(sel.date)}</h2><span class="row-tools"><span class="muted small">${rs.coming}/${rs.max} משתתפים</span>${!sel.cancelled && lStart(sel) > now() ? `<button class="btn ghost small" data-act="lessonCancelAsk" data-l="${sel.id}">ביטול השיעור</button>` : ''}</span></div>
        ${sel.cancelled ? `<div class="policy warn" role="status"><b>השיעור בוטל על ידי הסטודיו</b>הסטודנטים קיבלו הודעה, והשיעור לא נספר בכרטיסייה. <button class="linkish" data-act="lessonRestore" data-l="${sel.id}">החזרת השיעור</button></div>` : ''}
        ${canMark ? `<div class="row-between mark-bar"><span class="small">${a.marked ? 'הנוכחות סומנה' : `סומנו ${done} מתוך ${rs.regs.length}`}</span>${a.marked ? '' : `<button class="btn small ghost" data-act="markAll" data-l="${sel.id}">כל השאר הגיעו</button>`}</div>`
          : `<p class="muted small">אפשר לסמן נוכחות ביום השיעור. ביטולים שהסטודנטים עשו באפליקציה כבר מסומנים.</p>`}
        ${rows}${guests}`)}`;
  }

  function wsRow(w) {
    const past = wEnd(w) < now();
    const rc = w.status === 'pending' ? chip('ממתין לתשלום', 'requested') : w.status === 'cancelled' ? chip('בוטלה', 'muted') : w.receipt === 'auto' ? chip('קבלה הופקה אוטומטית', 'paid') : w.receipt === 'manual' ? chip('קבלה הופקה', 'paid') : w.receipt === 'unpaid' ? chip('לא שולמה', 'requested') : chip('דורשת קבלה ידנית', 'overdue');
    return `<button class="ws-row" data-act="wsSheet" data-id="${w.id}">
      <span class="dot dot-${srcCss(w)}"></span>
      <div><b>${relDay(w.date)} ${w.time}</b><small>${esc(w.customer.name)} · ${w.n} משתתפים · ${money(w.amount)}</small>
      <span class="srow-meta">${chip(isOwn(w) ? 'אתר' : chName(w.source), srcCss(w))}${chip(paidLabel(w), 'muted')}${rc}${past && !w.feedbackSent ? chip('משוב לא נשלח', 'requested') : ''}</span></div>
    </button>`;
  }
  function tWorkshops() {
    const up = S.workshops.filter(w => (isLive(w) || (w.status === 'pending' && w.holdUntil > now().getTime())) && wEnd(w) >= now()).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    const cancelled = S.workshops.filter(w => w.status === 'cancelled').sort((a, b) => b.date.localeCompare(a.date));
    const past = activeWorkshops().filter(w => wEnd(w) < now()).sort((a, b) => b.date.localeCompare(a.date));
    const list = ui.wsTab === 'upcoming' ? up : ui.wsTab === 'cancelled' ? cancelled : past;
    const custs = S.customers || [];
    return `<div class="row-between"><h1>סדנאות</h1><button class="btn primary small" data-act="wsNew">+ סדנה</button></div>
      <div class="tabs" role="tablist" aria-label="סדנאות"><button role="tab" aria-selected="${ui.wsTab === 'upcoming'}" data-act="wsTab" data-t="upcoming" class="${ui.wsTab === 'upcoming' ? 'on' : ''}">קרובות (${up.length})</button><button role="tab" aria-selected="${ui.wsTab === 'past'}" data-act="wsTab" data-t="past" class="${ui.wsTab === 'past' ? 'on' : ''}">עברו (${past.length})</button>${cancelled.length ? `<button role="tab" aria-selected="${ui.wsTab === 'cancelled'}" data-act="wsTab" data-t="cancelled" class="${ui.wsTab === 'cancelled' ? 'on' : ''}">בוטלו (${cancelled.length})</button>` : ''}<button role="tab" aria-selected="${ui.wsTab === 'customers'}" data-act="wsTab" data-t="customers" class="${ui.wsTab === 'customers' ? 'on' : ''}">לקוחות (${custs.length})</button></div>
      ${ui.wsTab === 'customers' ? customersCard(custs) : card(list.length ? list.map(wsRow).join('') : empty('אין סדנאות.'))}`;
  }

  /* ---------- לקוחות ----------
     רשימה עם חיפוש לפי שם או טלפון. לחיצה פותחת את כרטיס הלקוח כחלונית. */
  const fmtPhone = d => (d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3)}` : d);
  // זוגות של "אולי זה אותו לקוח?" (אותו מייל, טלפון אחר), כל זוג פעם אחת
  function twinPairs() {
    const seen = new Set(), out = [];
    (S.customers || []).forEach(c => mergeCandidates(c).forEach(o => { const k = [c.id, o.id].sort().join('|'); if (!seen.has(k)) { seen.add(k); out.push([c, o]); } }));
    return out;
  }
  const twinRow = (c, o) => `<div class="todo"><div class="todo-main">${chip('אולי זה אותו לקוח?', 'requested')}<b>${esc(c.name)} ו${esc(o.name)}</b><small>אותו מייל (${esc(c.email)}), טלפונים שונים: <span dir="ltr">${c.phones.map(fmtPhone).join(', ')}</span> ו-<span dir="ltr">${o.phones.map(fmtPhone).join(', ')}</span></small></div>
      <div class="btn-row"><button class="btn small primary" data-act="custMergeAsk" data-keep="${c.id}" data-drop="${o.id}">איחוד</button><button class="btn small ghost" data-act="custNotSame" data-a="${c.id}" data-b="${o.id}">לא אותו לקוח</button></div></div>`;
  function customersCard(custs) {
    const q = String((ui.cq || {}).q || '').trim().toLowerCase(), qd = q.replace(/\D/g, '');
    const match = c => !q || c.name.toLowerCase().includes(q) || (qd.length >= 3 && c.phones.some(p => p.includes(qd)));
    const rows = custs.filter(match).map(c => ({ c, ws: customerWorkshops(c.id) })).sort((x, y) => ((y.ws[0] || {}).date || '').localeCompare((x.ws[0] || {}).date || ''));
    const twins = twinPairs();
    return (twins.length ? card(`<h2>אולי זה אותו לקוח?</h2>${twins.map(([c, o]) => twinRow(c, o)).join('')}`) : '') + card(`
      <label class="field"><span>חיפוש לפי שם או טלפון</span><input type="search" data-bind="cq.q" data-live="page" value="${esc((ui.cq || {}).q || '')}" placeholder="למשל: דנה, או 050"></label>
      ${rows.length ? rows.map(({ c, ws }) => {
        const paid = ws.filter(w => w.status !== 'cancelled').reduce((s, w) => s + w.amount, 0);
        return `<button class="ws-row" data-act="customerSheet" data-id="${c.id}"><span class="dot dot-site"></span>
          <div><b>${esc(c.name)}</b><small><span dir="ltr">${c.phones.map(fmtPhone).join(', ')}</span> · ${ws.length === 1 ? 'הזמנה אחת' : `${ws.length} הזמנות`} · ${money(paid)}</small>
          <span class="srow-meta">${c.studentId && student(c.studentId) ? chip('גם סטודנט', 'class') : ''}${c.lateMoveUsed ? chip('הזזה חד פעמית נוצלה', 'muted') : ''}</span></div></button>`;
      }).join('') : empty(q ? 'לא נמצא לקוח כזה.' : 'עדיין אין לקוחות. כל מי שמזמין סדנה נכנס לכאן אוטומטית.')}`);
  }
  function customerSheetHtml(id) {
    const c = customer(id);
    if (!c) return '';
    const ws = customerWorkshops(c.id);
    const inv = ws.filter(w => w.invoice);
    const stu = c.studentId && student(c.studentId);
    const twins = mergeCandidates(c);
    return `<h2>${esc(c.name)}</h2><p class="muted">לקוח מאז ${dmy(c.since)}.${parse(c.since).getFullYear()}</p>
      ${twins.map(o => twinRow(c, o)).join('')}
      <dl class="kv"><dt>טלפון</dt><dd dir="ltr">${c.phones.map(fmtPhone).join(', ') || 'לא נמסר'}</dd><dt>מייל</dt><dd dir="ltr">${esc(c.email || 'לא נמסר')}</dd>
        <dt>דיוור</dt><dd>${c.marketing ? `מסכים מ-${fullDate(c.marketingAt)}` : 'לא'}</dd>
        <dt>הזזה חד פעמית</dt><dd>${c.lateMoveUsed ? `נוצלה (${dmy(c.lateMoveUsed)}.${parse(c.lateMoveUsed).getFullYear()})` : 'זמינה'}</dd>
        ${stu ? `<dt>סטודנט</dt><dd><a href="#/tamima/student/${stu.id}" data-act="closeSheet">${esc(stu.name)}, ${esc(group(stu.groupId).name)}</a></dd>` : ''}</dl>
      <h3>הזמנות</h3>${ws.map(w => `<button class="ws-row" data-act="wsSheet" data-id="${w.id}"><span class="dot dot-${srcCss(w)}"></span>
        <div><b>${longDay(w.date)}, ${w.time}</b><small>${w.n} משתתפים · ${money(w.amount)} · ${isOwn(w) ? 'מהאתר' : esc(chName(w.source))}</small></div>${w.status === 'cancelled' ? chip('בוטלה', 'muted') : ''}</button>`).join('') || empty('אין הזמנות.')}
      <h3>חשבוניות</h3>${inv.map(w => `<div class="pay-row"><span>חשבונית מס קבלה מס׳ ${w.invoice} · ${money(w.amount)} · ${shortDay(w.date)}</span>
        <div class="btn-row">${pdfBtn(w.invoice)}${isOwn(w) && refundable(w.invoice) ? `<button class="btn ghost small" data-act="refundOpen" data-inv="${w.invoice}">זיכוי</button>` : ''}</div>${refundLines(w.invoice)}</div>`).join('') || empty('אין חשבוניות עדיין.')}
      ${(S.customers || []).length > 1 && !c.anonymizedAt ? `<button class="btn ghost block" data-act="custMergePick" data-id="${c.id}">איחוד עם לקוח אחר</button>` : ''}
      ${c.anonymizedAt ? '' : `<button class="btn ghost block" data-act="anonAsk" data-kind="customer" data-id="${c.id}">אנונימיזציה</button>`}`;
  }
  function mergePreviewHtml(keepId, dropId) {
    const k = customer(keepId), d = customer(dropId);
    if (!k || !d) return '';
    const ws = customerWorkshops(d.id), inv = ws.filter(w => w.invoice);
    return `<h2>איחוד כרטיסי לקוח</h2><p>הכרטיס של <b>${esc(d.name)}</b> יתאחד לתוך הכרטיס של <b>${esc(k.name)}</b>.</p>
      <ul class="doc-list">
        <li>${ws.length === 1 ? 'הזמנה אחת עוברת' : `${ws.length} הזמנות עוברות`}, ו${inv.length === 1 ? 'חשבונית אחת' : `${inv.length} חשבוניות`}.</li>
        <li>הטלפונים שיישמרו: <span dir="ltr">${[...new Set(k.phones.concat(d.phones))].map(fmtPhone).join(', ')}</span></li>
        ${k.lateMoveUsed || d.lateMoveUsed ? `<li>הזזה חד פעמית: נוצלה (${dmy([k.lateMoveUsed, d.lateMoveUsed].filter(Boolean).sort().pop())}). זה עובר לכרטיס המאוחד.</li>` : ''}
      </ul>
      <div class="btn-row"><button class="btn primary" data-act="custMergeDo" data-keep="${k.id}" data-drop="${d.id}">איחוד</button><button class="btn ghost" data-act="customerSheet" data-id="${k.id}">חזרה</button></div>`;
  }

  function tReceipts(wid) {
    const w = workshop(wid);
    if (w && w.receipt !== 'auto') {
      if (!ui.rcpt || ui.rcpt.wid !== wid) ui.rcpt = { wid, name: w.customer.name, amount: w.amount, date: w.date, done: w.receipt !== 'pending' };
      const r = ui.rcpt;
      if (w.receipt !== 'pending') {
        return `<a class="back" href="#/tamima/receipts">חזרה לקבלות</a><h1>הקבלה הופקה</h1>
          ${card(`<div class="done-ic">✓</div><p class="center">הקבלה הופקה בסאמיט ונשלחה ללקוח.</p>${invoiceDoc(w.invoice, w.customer.name, `סדנת קרמיקה, ${w.n} משתתפים`, r.amount, w.date)}
          <a class="btn primary block" href="#/tamima/receipts">חזרה לרשימה</a>`, 'done')}`;
      }
      return `<a class="back" href="#/tamima/receipts">חזרה לקבלות</a><h1>קבלה ל${srcLabel(w)}</h1>
        ${card(`<p class="muted small">הפרטים מולאו מראש מההזמנה. אפשר לתקן לפני ההפקה.</p>
          <label class="field"><span>שם הלקוח</span><input data-bind="rcpt.name" value="${esc(r.name)}"></label>
          <label class="field"><span>סכום</span><input data-bind="rcpt.amount" value="${esc(r.amount)}" inputmode="numeric"></label>
          <label class="field"><span>תאריך הסדנה</span><input value="${dmy(r.date)}.${parse(r.date).getFullYear()}" disabled></label>
          <label class="field"><span>פירוט</span><input value="סדנת קרמיקה, ${w.n} משתתפים" disabled></label>
          <button class="btn primary block" data-act="issueReceipt" data-id="${w.id}">הפקה בסאמיט</button>`)}`;
    }
    const pend = pendingReceipts();
    const issued = S.workshops.filter(x => !isOwn(x) && x.receipt === 'manual');
    return `<h1>קבלות</h1>
      <p class="muted">סדנאות מערוצי שיווק שמחכות לחשבונית מס קבלה. סדנאות מהאתר מקבלות קבלה אוטומטית.</p>
      ${card(pend.length ? pend.map(x => `<a class="ws-row" href="#/tamima/receipts/${x.id}"><span class="dot dot-salon"></span><div><b>${esc(x.customer.name)}</b><small>${esc(chName(x.source))} · ${shortDay(x.date)} ${x.time} · ${x.n} משתתפים · ${money(x.amount)}</small></div><span class="go">להפקה</span></a>`).join('') : empty('כל הקבלות הופקו.'))}
      ${issued.length ? `<h2>הופקו לאחרונה</h2>${card(issued.map(x => `<div class="ws-row"><span class="dot dot-salon"></span><div><b>${esc(x.customer.name)}</b><small>חשבונית מס קבלה מס׳ ${x.invoice} · ${money(x.amount)}</small></div></div>`).join(''))}` : ''}`;
  }

  function tMore() {
    const st = S.settings;
    const tab = ui.moreTab || 'channels';
    const num = (k, label, suffix) => `<label class="field inline"><span>${label}</span><span class="with-suffix"><input type="number" data-setting="${k}" value="${st[k]}">${suffix}</span></label>`;
    const tabs = [['channels', 'ערוצים'], ['closed', 'ימי סגירה'], ['site', 'אתר'], ['mail', 'מיילים'], ['google', 'גוגל'], ['settings', 'מחירים'], ['audit', 'יומן פעולות']];
    let body;
    if (tab === 'google') body = gcalCard();
    else if (tab === 'closed') body = closedTab();
    else if (tab === 'site') body = contentTab();
    else if (tab === 'mail') body = mailTab();
    else if (tab === 'audit') body = card(`<h2>יומן פעולות</h2><p class="muted small">כל זיכוי, אנונימיזציה ושינוי פרטים: מה נעשה, מי, על מי ומתי. בדמו אין כניסה למערכת, ולכן "מי" הוא התפקיד.</p>
      ${(S.audit || []).length ? `<div class="actlog-wrap"><table class="actlog"><thead><tr><th scope="col">מתי</th><th scope="col">פעולה</th><th scope="col">מי</th><th scope="col">על מי</th></tr></thead><tbody>${S.audit.map(x => `<tr><td data-l="מתי">${dateTime(x.at)}</td><td data-l="פעולה">${esc(x.action)}</td><td data-l="מי">${esc(x.who)}</td><td data-l="על מי">${esc(x.target)}</td></tr>`).join('')}</tbody></table></div>` : empty('עדיין אין פעולות ביומן.')}`);
    else if (tab === 'settings') {
      body = card(`<h2>מחירון</h2>${num('price2', 'סדנה לזוג', '₪')}${num('pricePer', 'סדנה, 3 עד 6, למשתתף', '₪')}${num('cardPrice', 'כרטיסייה, 4 שיעורים', '₪')}`)
        + card(`<h2>מדיניות ביטול</h2>${num('workshopCancelHours', 'סדנה: ביטול עד', 'שעות לפני')}${num('stopParticipationFee', 'הפסקת השתתפות ביוזמת הסטודיו: ניכוי', '₪')}
          <label class="field inline"><span>מספר הוואטסאפ של תמימה<small class="muted">לפניות של לקוחות על ביטול מאוחר</small></span><input class="txt" type="tel" dir="ltr" data-settext="whatsapp" value="${esc(st.whatsapp || '')}"></label>${num('lessonCancelHours', 'חוג: ביטול עם השלמה עד', 'שעות לפני')}
          <p class="muted small">השלמה אחת בחודש, בתוקף לחודש מיום הביטול, בקבוצה אחרת שיש בה מקום.</p>`)
        + `<p class="note">בקרוב: ניהול מלאי, וניהול צוות ומורה נוספת.</p>`;
    } else {
      const rows = G.channels.list().map(ch => {
        const sold = S.workshops.filter(w => w.source === ch.id && isLive(w)).length;
        const off = ch.status !== 'active' ? 'disabled' : '';
        const set = (k, label, suffix, max) => `<label class="field inline"><span>${label}</span><span class="with-suffix"><input type="number" min="0" ${max ? `max="${max}"` : ''} data-chset="${ch.id}|${k}" value="${ch[k]}" ${off}>${suffix}</span></label>`;
        const txt = (k, label) => `<label class="field inline"><span>${label}</span><input class="txt" data-chset="${ch.id}|${k}" value="${esc(ch[k])}" ${off}></label>`;
        const msg = ui.chMsg && ui.chMsg.id === ch.id ? `<p class="${ui.chMsg.ok ? 'ok-line small' : 'err'}" role="status">${esc(ui.chMsg.text)}</p>` : '';
        const open = ui.chOpen[ch.id] || (ui.chMsg && ui.chMsg.id === ch.id);
        const sub = ch.home ? `${ch.autoFill ? 'מילוי אוטומטי' : 'בלי מילוי אוטומטי'} · ${ch.horizonDays} ימים קדימה` : ch.status === 'active' ? `עמלה ${ch.commission}% · שחרור ${ch.releaseDays} ימים לפני` : `לא פעיל מאז ${dmy(ch.deactivatedAt.slice(0, 10))}`;
        let inner = '';
        if (open) {
          if (ch.home) {
            const times = G.channels.slotTimes();
            inner = `<p class="muted small">מועדים שלא שייכים לאף ערוץ, ומועדים שהשתחררו מערוצים אחרים, נפתחים כאן.</p>
              ${txt('name', 'שם')}
              ${set('horizonDays', 'פתיחת מועדים קדימה', 'ימים', 90)}
              ${set('minNoticeHours', 'אפשר להזמין עד', 'שעות לפני')}
              <label class="field inline"><span>זמן מעבר סביב אירוע אישי<small class="muted">מועד שצמוד יותר לאירוע ביומן האישי לא ייפתח</small></span><select data-chset="${ch.id}|travelMinutes">${[[0, 'בלי'], [15, 'רבע שעה'], [30, 'חצי שעה'], [60, 'שעה']].map(([v, l]) => `<option value="${v}" ${(ch.travelMinutes || 0) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
              ${set('commission', 'עמלת סליקה', '%', 100)}
              <label class="field inline check-row"><span>מילוי אוטומטי<small class="muted">זמן פנוי נפתח באתר לבד</small></span><input type="checkbox" data-chset="${ch.id}|autoFill" ${ch.autoFill ? 'checked' : ''}></label>
              <details class="times"${ui.chMsg && ui.chMsg.id === ch.id && ui.chMsg.times ? ' open' : ''}><summary>שעות לסדנה בכל יום</summary>
                ${[0, 1, 2, 3, 4, 5, 6].map(dw => `<label class="field inline"><span>${DAYS[dw]}</span><input class="txt" dir="ltr" data-chtimes="${dw}" value="${(times[dw] || []).join(', ')}" placeholder="סגור"></label>`).join('')}
                <p class="muted small">שעות התחלה מופרדות בפסיק, למשל 10:00, 12:30. שדה ריק: סגור.</p>
              </details>`;
          } else {
            inner = txt('name', 'שם') + set('commission', 'עמלה', '%', 100) + set('releaseDays', 'שחרור לאתר', 'ימים לפני') + set('bufferHours', 'המתנה לפני פתיחה באתר', 'שעות')
              + (ch.status === 'active' ? `<button class="btn ghost small" data-act="deactivateChannel" data-id="${ch.id}">סימון כלא פעיל</button>` : '<p class="muted small">היומן וההיסטוריה נשמרו.</p>');
          }
          inner += msg + (ui.guided ? `<details class="json"><summary>הגדרות הערוץ</summary><pre dir="ltr">${esc(JSON.stringify(ch, null, 2))}</pre></details>` : '');
        }
        return `<div class="ch-row ${ch.status}${open ? ' open' : ''}">
          <button class="ch-head" data-act="chToggle" data-id="${ch.id}" aria-expanded="${!!open}">
            <span><b>${esc(ch.name)}</b><small>${esc(sub)} · ${sold} סדנאות</small></span>
            ${ch.home ? chip('ערוץ הבית', 'site') : ch.status === 'active' ? chip('פעיל', 'ok') : chip('לא פעיל', 'muted')}
            <i aria-hidden="true">${open ? '−' : '+'}</i>
          </button>
          ${open ? `<div class="ch-body">${inner}</div>` : ''}
        </div>`;
      }).join('');
      body = card(`<p class="muted small">לכל ערוץ יומן משלו. כל מועד פתוח שייך לערוץ אחד, ומועד שלא נמכר חוזר לאתר.</p>
        <div class="ch-list">${rows}</div>
        <div class="ch-add">
          <label class="field"><span>ערוץ חדש</span><input data-bind="chf.name" value="${esc(ui.chf.name)}" placeholder="למשל: גלריה בעיר"></label>
          ${ui.chf.err ? `<p class="err" role="alert">${esc(ui.chf.err)}</p>` : ''}
          <button class="btn primary" data-act="addChannel">הוספת ערוץ</button>
        </div>`);
    }
    return `<h1>עוד</h1>
      <div class="tabs" role="tablist" aria-label="הגדרות">${tabs.map(([k, l]) => `<button role="tab" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}" data-act="moreTab" data-t="${k}">${l}</button>`).join('')}</div>
      <div role="tabpanel">${body}</div>`;
  }

  function studentSheetHtml(id) {
    const s = student(id);
    const ps = payStatus(s);
    const hist = S.payments.filter(p => p.studentId === id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
    const cr = openCredits(s);
    const needs = ps.key === 'requested' || ps.key === 'overdue';
    return `<h2>${esc(s.name)}</h2><p class="muted">${group(s.groupId).name} · ${esc(s.phone)}</p>
      <dl class="kv">
        <dt>כרטיסייה</dt><dd>${s.used}/${S.settings.cardSize}</dd>
        <dt>תשלום</dt><dd>${chip(ps.label, ps.key)}</dd>
        <dt>השלמות פתוחות</dt><dd>${cr.length ? cr.map(m => 'עד ' + dmy(m.expires)).join(', ') : 'אין'}</dd>
      </dl>
      ${needs ? `<button class="btn ${s.reminded ? 'ghost' : 'primary'} block" data-act="remind" data-id="${s.id}">${s.reminded ? 'תזכורת נשלחה, לשלוח שוב' : 'שליחת תזכורת לתשלום'}</button>` : ''}
      ${needs && ui.guided ? `<button class="btn demo block" data-act="simPay" data-id="${s.id}">הדגמה: תשלום בקישור</button>` : ''}
      <h3>תשלומים אחרונים</h3>
      ${hist.map(p => `<div class="ws-row"><span class="dot dot-paid"></span><div><b>${money(p.amount)}</b><small>${dmy(p.date)} · חשבונית מס קבלה מס׳ ${p.invoice}</small></div></div>`).join('')}`;
  }

  function workshopSheetHtml(id) {
    const w = workshop(id);
    if (!w) return '';
    const past = wEnd(w) < now();
    const future = wEnd(w) > now();
    const tools = w.status === 'cancelled'
      ? (future ? `<div class="btn-row"><button class="btn primary small" data-act="wsRestore" data-id="${w.id}">החזרת הסדנה</button></div>` : '')
      : `<div class="btn-row"><button class="btn ghost small" data-act="wsEdit" data-id="${w.id}">עריכת פרטים</button>${future ? `<button class="btn ghost small" data-act="wsMoveOpen" data-id="${w.id}">הזזת מועד</button><button class="btn ghost small" data-act="wsCancelAsk" data-id="${w.id}">ביטול הסדנה</button>` : ''}</div>`;
    return `<h2>${srcLabel(w)}${w.status === 'cancelled' ? ' · בוטלה' : ''}</h2><p class="muted">${longDay(w.date)}, ${w.time} עד ${endOf(w.time)}</p>
      ${tools}
      <dl class="kv">
        <dt>לקוח</dt><dd>${esc(w.customer.name)}</dd>
        <dt>טלפון</dt><dd>${esc(w.customer.phone)}</dd>
        <dt>מייל</dt><dd>${esc(w.customer.email)}</dd>
        <dt>משתתפים</dt><dd>${w.n}</dd>
        <dt>סכום</dt><dd>${money(w.amount)}</dd>
        <dt>ערוץ</dt><dd>${esc(isOwn(w) ? 'האתר של תמימה' : chName(w.source))}</dd>
        <dt>תשלום</dt><dd>${paidLabel(w)}</dd>
        <dt>קבלה</dt><dd>${w.receipt === 'auto' ? `הופקה אוטומטית, מס׳ ${w.invoice}` : w.receipt === 'manual' ? `הופקה, מס׳ ${w.invoice}` : w.receipt === 'unpaid' ? 'לא שולמה' : 'דורשת קבלה ידנית'}</dd>
      </dl>
      ${w.invoice ? `<div class="pay-row"><div class="btn-row">${pdfBtn(w.invoice, `חשבונית מס׳ ${w.invoice} (PDF)`)}${isOwn(w) && refundable(w.invoice) ? `<button class="btn ghost small" data-act="refundOpen" data-inv="${w.invoice}">זיכוי</button>` : ''}</div>${refundLines(w.invoice)}</div>` : ''}
      ${!isOwn(w) && w.invoice ? `<p class="muted small">החזר לסדנה מ"${esc(chName(w.source))}" מתבצע דרך הערוץ.</p>` : ''}
      ${isOwn(w) && w.invoice && w.status !== 'cancelled' && hoursTo(w) > 0 && hoursTo(w) < S.settings.workshopCancelHours ? `<button class="btn ghost block" data-act="lateOpen" data-id="${w.id}">פנייה מאוחרת מהלקוח (וואטסאפ)</button>` : ''}
      ${w.receipt === 'pending' ? `<a class="btn primary block" href="#/tamima/receipts/${w.id}" data-act="closeSheet">להפקת קבלה</a>` : ''}
      ${past ? (w.feedbackSent ? `<p class="ok-line">✓ מייל משוב נשלח</p>` : `<button class="btn ${w.receipt === 'pending' ? 'ghost' : 'primary'} block" data-act="feedback" data-id="${w.id}">שליחת מייל משוב</button>`)
        : `<p class="muted small">אחרי הסדנה יהיה אפשר לשלוח מייל משוב.</p>`}
      ${ui.guided ? `<div class="demo-note"><b>במצב הדגמה</b><p>מייל המשוב יוצא אוטומטית כמה שעות אחרי הסדנה. אופציה שנייה: הודעת וואטסאפ.</p>
        <button class="btn demo block" data-act="whatsapp" data-id="${w.id}">שליחת משוב בוואטסאפ</button></div>${w.eventId && safeGet(CAL.studio, w.eventId) ? eventJson(safeGet(CAL.studio, w.eventId), CAL.studio) : ''}` : ''}`;
  }

  Object.assign(A, {
    // תמימה
    leadDone(d) {
      const x = S.leads.find(l => l.id === d.id);
      if (!x) return;
      openSheet(() => `<h2>מה יצא מהפנייה?</h2><p class="muted">${esc(x.name)} · <span dir="ltr">${esc(x.phone)}</span></p>
        <div class="choice-list">${['waiting', 'noanswer', 'notfit'].map(k => `<button class="choice" data-act="leadClose" data-id="${x.id}" data-s="${k}"><b>${LEAD_STATUS[k][0]}</b><small>${LEAD_STATUS[k][2]}</small></button>`).join('')}</div>
        <p class="muted small">הפנייה נשמרת ברשימת הפניות ב"חוגים", בלשונית "סטודנטים", ואפשר להפוך אותה לסטודנט בכל שלב.</p>`);
    },
    leadClose(d) {
      const x = S.leads.find(l => l.id === d.id);
      if (!x) return;
      const prev = { status: x.status, handled: x.handled, handledAt: x.handledAt };
      Object.assign(x, { status: d.s, handled: true, handledAt: todayIso() });
      closeSheet(); render();
      snack(`הפנייה של ${x.name} סומנה: ${LEAD_STATUS[d.s][0]}`, () => { Object.assign(x, prev); render(); });
    },
    remind(d) {
      const s = student(d.id);
      s.reminded = todayIso();
      email('payReminder', toStudent(s), 'תזכורת: הכרטיסייה מחכה לתשלום', [`היי ${first(s)},`, `תזכורת קטנה: הכרטיסייה (${money(S.settings.cardPrice)}) מחכה לתשלום.`, 'תודה!'], { cta: ['לתשלום בסאמיט', studentUrl(s, 'pay')] });
      render();
    },
    simPay(d) { payCard(student(d.id)); render(); },
    studentSheet(d) { location.hash = `#/tamima/student/${d.id}`; },
    goLesson(d) { const l = lesson(d.l); ui.lessonSel[l.groupId] = l.id; location.hash = `#/tamima/classes/${l.groupId}`; },
    selLesson(d) { ui.lessonSel[d.g] = d.l; render(); },
    mark(d) { setAtt(d.l, d.s, d.v); render(); },
    markAll(d) { const l = lesson(d.l); const a = att(l.id); lessonStudents(l).forEach(s => { if (!a.rec[s.id]) setAtt(l.id, s.id, 'arrived'); }); roster(l).guests.forEach(({ s }) => { if (!a.rec[s.id]) setAtt(l.id, s.id, 'arrived'); }); render(); },
    maxSeat(d) { const g = group(d.g); g.max = Math.min(12, Math.max(groupStudents(g.id).length, g.max + Number(d.d))); render(); },
    week(d) { ui.weekOffset = Number(d.d) === 0 ? 0 : ui.weekOffset + Number(d.d); render(); },
    calFree(d) {
      openSheet(() => `<h2>זמן פנוי</h2><p class="muted">${longDay(d.date)}, ${d.t} עד ${endOf(d.t)}</p>
        <p class="small">כל משבצת שייכת לערוץ אחד בלבד. בחרו איפה למכור אותה, או חסמו אותה.</p>
        ${G.channels.active().map(ch => `<button class="btn ${ch.home ? 'primary' : 'ghost'} block" data-act="assignSlot" data-date="${d.date}" data-t="${d.t}" data-ch="${ch.id}">פתיחה ב${ch.home ? 'אתר של תמימה' : `ערוץ "${esc(ch.name)}"`}</button>`).join('')}
        <button class="btn ghost block" data-act="addBlock" data-date="${d.date}" data-t="${d.t}">חסימה אישית</button>`);
    },
    assignSlot(d) { openWithUndo(d.date, d.t, d.ch); },
    addBlock(d) { blockWithUndo(d.date, d.t); },
    calSlot(d) {
      openSheet(() => {
        const ch = G.channels.get(d.ch);
        const ev = ch && safeGet(ch.calendarId, d.id);
        if (!ev || ev.status === 'cancelled') return '';
        const sp = G.msToWall(G.edgeMs(ev.start));
        const date = sp.slice(0, 10), time = sp.slice(11, 16);
        const others = G.channels.active().filter(c => c.id !== ch.id);
        const rel = !ch.home && ch.releaseDays != null ? G.edgeMs(ev.start) - ch.releaseDays * 864e5 : null;
        return `<h2>${ch.home ? 'פתוח באתר של תמימה' : `פתוח בערוץ "${esc(ch.name)}"`}</h2><p class="muted">${whenOf(ev)}</p>
          <p class="small">${ch.home ? 'לקוחות רואים את המשבצת באתר ויכולים להזמין אותה.' : `רק "${esc(ch.name)}" רואה את המשבצת, ביומן המשותף שלו. היא לא מוצעת באתר.`}</p>
          ${rel ? `<div class="policy"><b>שחרור אוטומטי</b>אם לא תימכר, היא תרד מהערוץ ב${whenMs(rel)} ותיפתח באתר ${ch.bufferHours} שעות אחר כך.</div>` : ''}
          ${others.map(c => `<button class="btn ghost block" data-act="assignSlot" data-date="${date}" data-t="${time}" data-ch="${c.id}">העברה ל${c.home ? 'אתר של תמימה' : `ערוץ "${esc(c.name)}"`}</button>`).join('')}
          <button class="btn ghost block" data-act="slotMoveOpen" data-ch="${ch.id}" data-id="${ev.id}">הזזה למועד אחר</button>
          <button class="btn ghost block" data-act="addBlock" data-date="${date}" data-t="${time}">חסימה אישית</button>
          ${ui.guided && !ch.home ? `<div class="demo-note"><b>במצב הדגמה</b><p>הערוץ מסמן הזמנה בעריכת האירוע ביומן המשותף. המערכת מזהה את השינוי בסנכרון מצטבר, יוצרת סדנה ומוחקת את המשבצת מכל היומנים.</p>
            <button class="btn demo block" data-act="channelBooks" data-ch="${ch.id}" data-id="${ev.id}">הדגמה: "${esc(ch.name)}" הזמין את המשבצת</button></div>` : ''}
          ${ui.guided ? eventJson(ev, ch.calendarId) : ''}`;
      });
    },
    channelBooks(d) {
      const ch = G.channels.get(d.ch);
      // 1. הערוץ עורך את האירוע ביומן המשותף (בגוגל, מחוץ לאפליקציה)
      const token = G.events.list({ calendarId: ch.calendarId }).nextSyncToken;
      G.events.patch({ calendarId: ch.calendarId, eventId: d.id, requestBody: { summary: `נתפס: הזמנה דרך ${ch.name}, 3 משתתפים`, extendedProperties: { shared: { booking: 'true', participants: '3' } } } });
      // 2. סנכרון מצטבר: האפליקציה מושכת רק את מה שהשתנה מאז ה-syncToken
      const changed = G.events.list({ calendarId: ch.calendarId, syncToken: token }).items
        .filter(e => e.status !== 'cancelled' && ((e.extendedProperties || {}).shared || {}).booking === 'true');
      changed.forEach(ev => {
        const sp = G.msToWall(G.edgeMs(ev.start));
        const n = Number(ev.extendedProperties.shared.participants) || 2;
        const w = { id: uid('w'), source: ch.id, date: sp.slice(0, 10), time: sp.slice(11, 16), n, amount: price(n),
          customer: { name: `לקוח דרך ${ch.name}`, phone: '', email: '' }, receipt: 'pending', invoice: null, feedbackSent: false };
        bookWorkshop(w);
        log('sync', `הזמנה נקלטה מהיומן של "${ch.name}"`, `${shortDay(w.date)} ${w.time}, ${n} משתתפים. נכנסה ליומן הסטודיו, נמחקה מכל יומני הערוצים, ומחכה לקבלה ידנית.`);
        toast(`הזמנה חדשה דרך ${ch.name}`, `${shortDay(w.date)} ${w.time}, ${n} משתתפים`);
      });
      closeSheet(); render();
    },
    calPending(d) {
      openSheet(() => {
        const q = G.channels.pending().find(x => x.id === d.id);
        if (!q) return '';
        const from = G.channels.get(q.from);
        return `<h2>ממתינה לפתיחה באתר</h2><p class="muted">${longDay(q.date)}, ${q.time} עד ${endOf(q.time)}</p>
          <p class="small">${q.reason === 'deactivated' ? `הערוץ "${esc(from.name)}" סומן לא פעיל.` : `המשבצת לא נמכרה ב"${esc(from.name)}" ושוחררה ב${whenMs(q.releasedAt)}.`} כרגע היא לא מוצעת באף ערוץ, ותיפתח באתר ב${whenMs(q.publishAt)}.</p>
          <button class="btn primary block" data-act="publishNow" data-id="${q.id}">פתיחה באתר עכשיו</button>`;
      });
    },
    publishNow(d) {
      G.channels.publishNow(d.id).forEach(() => {});
      log('sync', 'משבצת נפתחה באתר לפני הזמן', 'תמימה קיצרה את תקופת ההמתנה.');
      closeSheet(); render();
    },
    calPersonal(d) {
      openSheet(() => `<h2>תפוס ביומן האישי</h2><p class="muted">${longDay(d.date)}, ${fromMin(+d.s)} עד ${fromMin(+d.e)}</p>
        <p class="small">המערכת קוראת מהיומן האישי רק "תפוס או פנוי", בלי כותרת ובלי פרטים. הזמן הזה לא מוצע באף ערוץ.</p>`);
    },
    // אירוע ביומן (גם חסימה ישנה): פרטים, ומחיקה או עריכה של מופע אחד או של כל הסדרה
    calBlock(d) {
      openSheet(() => {
        const ev = evGet(d.id);
        if (!ev || ev.status === 'cancelled') return '';
        const master = ev.recurringEventId ? safeGet(CAL.studio, ev.recurringEventId) : null;
        const rule = ((master || ev).recurrence || []).find(r => r.startsWith('RRULE:'));
        const s = G.msToWall(G.edgeMs(ev.start)), e = G.msToWall(G.edgeMs(ev.end));
        const b = ev.start.date ? { holds: [], paid: [] } : bookingsAt(s.slice(0, 10), toMin(s.slice(11, 16)), toMin(e.slice(11, 16)));
        const both = b.holds.length || b.paid.length;
        const rec = !!(master && rule);
        return `<h2>${esc(ev.summary && ev.summary !== 'חסימה אישית' ? ev.summary : 'אירוע')}</h2><p class="muted">${whenOf(ev)}</p>
          ${rule ? `<p class="small">${rruleText(rule)}</p>` : ''}
          ${both ? '<p class="policy warn">יש הזמנה באותו זמן. האירוע נשמר, והסדנה נשארת.</p>' : ''}
          <p class="small muted">נשמר ביומן הגוגל של הסטודיו כאירוע פרטי. הערוצים רואים רק שהזמן לא פנוי.</p>
          ${rec
            ? `<button class="btn primary block" data-act="blockEdit" data-id="${ev.id}" data-scope="one">עריכת המופע הזה</button>
               <button class="btn ghost block" data-act="blockEdit" data-id="${ev.id}" data-scope="series">עריכת כל הסדרה</button>
               <button class="btn ghost block" data-act="removeBlockOne" data-id="${ev.id}">מחיקת המופע הזה</button>
               <button class="btn ghost block" data-act="removeBlock" data-id="${master.id}">מחיקת כל הסדרה</button>`
            : `<button class="btn primary block" data-act="blockEdit" data-id="${ev.id}" data-scope="series">עריכה</button>
               <button class="btn ghost block" data-act="removeBlock" data-id="${ev.id}">מחיקה</button>`}
          ${ui.guided ? eventJson(master || ev, CAL.studio) : ''}`;
      });
    },
    // לקוח באמצע הזמנה: בלי פרטים אישיים
    calHold(d) {
      openSheet(() => {
        const w = workshop(d.id);
        if (!w || w.status !== 'pending') return '';
        const left = Math.max(1, Math.ceil((w.holdUntil - now().getTime()) / 6e4));
        return `<h2>בתהליך הזמנה</h2><p class="muted">${longDay(w.date)}, ${w.time} עד ${endOf(w.time)}</p>
          <p>לקוח באמצע הזמנה באתר. המועד שמור עוד ${left} דקות, ומתחדש כל עוד ממלאים את ההזמנה.</p>
          <p class="small muted">אם יתווסף אירוע בזמן הזה, ההזמנה לא תתבטל. אם לא יהיה תשלום, המועד יתפנה לבד.</p>`;
      });
    },
    blockEdit(d) {
      const ev = evGet(d.id);
      const master = ev.recurringEventId ? G.events.get({ calendarId: CAL.studio, eventId: ev.recurringEventId }) : null;
      ui.evf = evFromEvent(ev, master, d.scope || 'series');
      openSheet(evFormHtml);
    },
    removeBlock(d) {
      const ev = evGet(d.id);
      const body = JSON.parse(JSON.stringify(ev));
      ['id', 'etag', 'htmlLink', 'iCalUID', 'created', 'updated', 'status', 'kind'].forEach(k => delete body[k]);
      G.events.delete({ calendarId: CAL.studio, eventId: d.id });
      log('sync', 'אירוע הוסר מהיומן', `${whenOf(ev)}${ev.recurrence ? ', כל הסדרה' : ''}. הזמן חזר להיות פנוי.`);
      runSync();
      closeSheet(); render();
      snack('האירוע הוסר', () => { G.events.insert({ calendarId: CAL.studio, requestBody: body }); runSync(); render(); });
    },
    removeBlockOne(d) {
      const ev = evGet(d.id);
      const master = G.events.get({ calendarId: CAL.studio, eventId: ev.recurringEventId });
      const before = master.recurrence.slice();
      G.events.patch({ calendarId: CAL.studio, eventId: master.id, requestBody: { recurrence: before.concat(exdateFor(ev.originalStartTime.dateTime || ev.originalStartTime.date)) } });
      log('sync', 'מופע אחד הוסר מהיומן', `${whenOf(ev)}. שאר הסדרה נשארת.`);
      runSync();
      closeSheet(); render();
      snack('המופע הוסר', () => { G.events.patch({ calendarId: CAL.studio, eventId: master.id, requestBody: { recurrence: before } }); runSync(); render(); });
    },
    evNew(d) {
      const date = (d && d.date) || (ui.calDay && calWeek().includes(ui.calDay) ? ui.calDay : todayIso());
      const start = (d && d.t) || '10:00';
      ui.evf = { id: null, scope: 'series', summary: '', allDay: false, date: date < todayIso() ? todayIso() : date, start, end: fromMin(Math.min(toMin(start) + 120, 23 * 60)), toDate: '',
        repeat: 'none', interval: 1, days: [], endMode: 'until', until: iso(addMonths(startOfToday(), 2)), count: 8, keepEx: [], err: '', errField: '' };
      openSheet(evFormHtml);
    },
    evDay(d) {
      const f = ui.evf, i = Number(d.d);
      f.days = f.days.includes(i) ? f.days.filter(x => x !== i) : f.days.concat(i);
      renderSheet();
      ui.focusSel = `#sheet [data-act="evDay"][data-d="${i}"]`; focusPending();
    },
    evAlt(d) { Object.assign(ui.evf, { date: d.date, start: d.s, end: d.e }); renderSheet(); },
    evSave() {
      const f = ui.evf;
      const bad = (field, msg) => { f.err = msg; f.errField = field; renderSheet(); return false; };
      if (!f.date) return bad('date', 'נא לבחור תאריך.');
      if (!f.id && f.date < todayIso()) return bad('date', 'אי אפשר להוסיף אירוע לתאריך שעבר.');
      if (!f.allDay && !(toMin(f.end) > toMin(f.start))) return bad('end', 'שעת הסיום צריכה להיות אחרי שעת ההתחלה.');
      if (f.allDay) {
        if (!f.toDate) f.toDate = f.date;
        if (f.toDate < f.date) return bad('toDate', 'תאריך הסיום לפני תאריך ההתחלה.');
        if ((parse(f.toDate) - parse(f.date)) / 864e5 >= 60) return bad('toDate', 'אפשר עד 60 ימים באירוע אחד.');
      }
      if (f.scope !== 'one' && f.repeat !== 'none') {
        if (f.endMode === 'until' && !(f.until && f.until >= f.date)) return bad('until', 'נא לבחור תאריך סיום לחזרה, אחרי תאריך ההתחלה.');
        if (f.endMode === 'count' && !(Number(f.count) >= 1 && Number(f.count) <= 200)) return bad('count', 'מספר הפעמים צריך להיות בין 1 ל-200.');
      }
      const ov = evOverlaps(f);
      let newId = null;
      if (f.id && f.scope === 'one') {
        // מופע אחד: יוצא מהסדרה, ונשמר כאירוע נפרד בזמן החדש
        const master = G.events.get({ calendarId: CAL.studio, eventId: f.id });
        G.events.patch({ calendarId: CAL.studio, eventId: f.id, requestBody: { recurrence: master.recurrence.concat(exdateFor(f.inst)) } });
        newId = G.events.insert({ calendarId: CAL.studio, requestBody: evBody(f, false) }).id;
      } else if (f.id) {
        const body = evBody(f, true);
        if (!body.recurrence) body.recurrence = [];
        G.events.patch({ calendarId: CAL.studio, eventId: f.id, requestBody: body });
      } else {
        newId = G.events.insert({ calendarId: CAL.studio, requestBody: evBody(f, true) }).id;
      }
      const name = String(f.summary || '').trim() || 'אירוע';
      log('sync', f.id ? `אירוע עודכן: ${name}` : `אירוע נוסף ליומן: ${name}`, `${f.allDay ? `יום שלם, ${shortDay(f.date)}${f.toDate && f.toDate !== f.date ? ` עד ${shortDay(f.toDate)}` : ''}` : `${shortDay(f.date)} ${f.start} עד ${f.end}`}${f.scope !== 'one' && f.repeat !== 'none' ? `. ${rruleText(rruleFor(f))}` : '.'} זמנים פנויים חופפים ירדו מכל הערוצים.`);
      runSync();
      closeSheet(); render();
      const msg = ov.holds || ov.paid ? 'יש הזמנה באותו זמן. האירוע נשמר, והסדנה נשארת.' : f.id ? 'האירוע עודכן ביומן.' : 'האירוע נוסף ליומן. זמנים פנויים חופפים ירדו מכל הערוצים.';
      snack(msg, !f.id && newId ? () => { G.events.delete({ calendarId: CAL.studio, eventId: newId }); runSync(); render(); } : null);
    },
    calEvent(d) {
      openSheet(() => {
        const pick = c => (d.id.includes('_') ? instanceOf(c, d.id) : safeGet(c, d.id));
        const cal = pick(CAL.classes) ? CAL.classes : CAL.studio;
        const ev = pick(cal);
        if (!ev || ev.status === 'cancelled') return '';
        const ext = priv(ev).app !== APP;
        return `<h2>${esc(ev.summary || 'אירוע')}</h2><p class="muted">${whenOf(ev)}</p>
          ${ext ? '<p class="small">האירוע נוסף ישירות ביומן הגוגל של הסטודיו. הזמן הזה לא מוצע באף ערוץ.</p>' : ''}
          ${ui.guided ? eventJson(ev, cal) : ''}`;
      });
    },
    addPersonal() {
      if (gsLive()) { snack('בחיבור אמיתי: הוסיפו אירוע ביומן האישי בגוגל, ולחצו "סנכרון עכשיו" ב"עוד".'); return; }
      // הדגמה: תמימה מוסיפה אירוע ביומן האישי מהטלפון. הוא נופל על משבצת פתוחה באתר.
      let target = null;
      for (let i = 1; i <= 14 && !target; i++) {
        const date = iso(addDays(startOfToday(), i));
        const t = freeSlots(date)[0];
        if (t) target = { date, t };
      }
      if (!target) return;
      G.events.insert({ calendarId: CAL.personal, requestBody: { summary: 'תור לשיננית', visibility: 'private', start: { dateTime: `${target.date}T${target.t}:00`, timeZone: G.TZ }, end: { dateTime: `${target.date}T${fromMin(toMin(target.t) + 60)}:00`, timeZone: G.TZ } } });
      log('sync', 'אירוע חדש ביומן האישי', `${shortDay(target.date)} ${target.t}. נוצר בטלפון, לא באפליקציה.`);
      runSync();
      ui.weekOffset = Math.floor((parse(target.date) - addDays(startOfToday(), -startOfToday().getDay())) / (7 * 864e5));
      render();
    },
    advance(d) {
      if (gsLive()) { snack('בחיבור ליומן אמיתי אי אפשר לקדם זמן, כי גוגל עובד לפי השעה האמיתית.'); return; }
      const hrs = Number(d.h) || 24;
      G.clock.advance(hrs);
      log('sync', `הזמן קודם ב-${hrs === 24 ? 'יום' : hrs + ' שעות'}`, `עכשיו: ${longDay(todayIso())}, ${clock(now())}. העבודה המתוזמנת רצה.`);
      const acts = runSync();
      runAutomations();
      if (!acts.some(a => a.type !== 'fill')) log('sync', 'אין שחרורים בשלב הזה', 'אף משבצת בערוץ שותף עוד לא הגיעה למועד השחרור.');
      render();
    },
    addChannel() {
      const name = (ui.chf.name || '').trim();
      if (!name) { ui.chf.err = 'נא לתת שם לערוץ.'; render(); return; }
      const ch = G.channels.addChannel(name);
      log('sync', `ערוץ חדש: "${ch.name}"`, 'נוצר יומן גוגל חדש לערוץ. משבצות שישויכו אליו ייכתבו רק ליומן הזה.');
      ui.chf = { name: '', err: '' };
      render();
    },
    deactivateChannel(d) {
      const ch = G.channels.deactivateChannel(d.id);
      log('sync', `הערוץ "${ch.name}" סומן לא פעיל`, `היומן וההיסטוריה נשמרו. ${ch.history[ch.history.length - 1].slotsReturned || 0} משבצות עתידיות חוזרות לאתר.`);
      runSync();
      render();
    },
    // ניווט (י-1)
    calStep(d) {
      const step = Number(d.d);
      if (isMobileCal()) {
        ui.calDay = iso(addDays(parse(ui.calDay || todayIso()), step));
        const t = startOfToday(), ws = addDays(t, -t.getDay());
        ui.weekOffset = Math.floor((parse(ui.calDay) - ws) / (7 * 864e5));
      } else ui.weekOffset += step;
      render();
    },
    calToday() { ui.weekOffset = 0; ui.calDay = todayIso(); render(); },
    calPickDay(d) { ui.calDay = d.date; render(); },
    calFilter(d) { ui.calFilter = d.f; render(); },
    calHi(d) { ui.calHi = ui.calHi === d.ch ? null : d.ch; render(); },

    // לחיצה על זמן ריק ברשת (י-14), או בחירה במצב פתיחת מועדים (י-15)
    gridClick(d, el, e) {
      const y = e.clientY - el.getBoundingClientRect().top;
      let m = GRID_FROM + Math.floor((y / hpx()) * 2) * 30;
      m = Math.max(GRID_FROM, Math.min(m, dayEndMin(d.date) - X.WORKSHOP_MIN));
      let time = fromMin(m);
      let err = startProblem(d.date, time);
      if (err) {
        const near = [-30, 30, -60, 60, -90, 90].map(o => fromMin(m + o)).find(t => toMin(t) >= GRID_FROM && !startProblem(d.date, t));
        if (near) { time = near; err = ''; }
      }
      if (err) { ui.pop = null; calMessage(/חופף|לא פנוי/.test(err) ? 'אין כאן שעתיים פנויות. בחרו זמן אחר ברשת.' : err); return; }
      if (ui.bulk.on) { A.bulkToggle({ date: d.date, t: time }); return; }
      ui.pop = { date: d.date, time, ch: (ui.pop && ui.pop.ch) || HOME };
      render();
    },
    popCh(d) { ui.pop.ch = d.ch; render(); },
    popClose() { ui.pop = null; render(); },
    popOpen() { const p = ui.pop; ui.pop = null; openWithUndo(p.date, p.time, p.ch); },
    popBlock() { const p = ui.pop; ui.pop = null; blockWithUndo(p.date, p.time); },
    popEvent() { const p = ui.pop; ui.pop = null; render(); A.evNew({ date: p.date, t: p.time }); },
    addChooser(d) { openSheet(() => addChooserHtml(d && d.date, d && d.t)); },
    addSlot(d) { closeSheet(); A.newSlotForm(); if (d && d.date && ui.nsf) { ui.nsf.date = d.date; if (d.t) ui.nsf.time = d.t; renderSheet(); } },
    calShow() {
      openSheet(() => `<h2>מה להציג ביומן</h2><div class="choice-list">${[['all', 'הכל', 'שיעורים, סדנאות, אירועים ומועדים פתוחים.'], ['activity', 'פעילות', 'רק מה שקורה בפועל: שיעורים, סדנאות ואירועים.'], ['open', 'פתוח למכירה', 'רק מועדים פנויים שאפשר להזמין, ומה שחוסם אותם.']].map(([k, l, x]) => `<button class="choice${ui.calFilter === k ? ' on' : ''}" data-act="calFilterPick" data-f="${k}" aria-pressed="${ui.calFilter === k}"><b>${l}</b><small>${x}</small></button>`).join('')}</div>`);
    },
    calFilterPick(d) { ui.calFilter = d.f; closeSheet(); render(); },

    // פתיחת מועדים מרובה לערוץ (י-15)
    bulkOn() { if (ui.sheet) closeSheet(); ui.bulk = { on: true, ch: (G.channels.active().find(c => !c.home) || { id: HOME }).id, sel: [] }; ui.pop = null; ui.calFilter = 'all'; render(); },
    bulkOff() { ui.bulk = { on: false, ch: ui.bulk.ch, sel: [] }; render(); },
    bulkCh(d) { ui.bulk.ch = d.ch; ui.bulk.sel = ui.bulk.sel.filter(x => x.from !== d.ch); render(); },
    bulkToggle(d) {
      const k = slotKey(d.date, d.t);
      const i = ui.bulk.sel.findIndex(x => slotKey(x.date, x.time) === k);
      if (i >= 0) ui.bulk.sel.splice(i, 1);
      else ui.bulk.sel.push({ date: d.date, time: d.t, from: d.from || null });
      render();
    },
    bulkDay(d) {
      const targets = bulkTargets(d.date);
      const keys = new Set(ui.bulk.sel.map(x => slotKey(x.date, x.time)));
      const allOn = targets.length && targets.every(t => keys.has(slotKey(d.date, t.time)));
      ui.bulk.sel = ui.bulk.sel.filter(x => x.date !== d.date);
      if (!allOn) targets.forEach(t => ui.bulk.sel.push({ date: d.date, time: t.time, from: t.from }));
      render();
    },
    bulkApply() {
      const ch = G.channels.get(ui.bulk.ch);
      const done = [];
      let failed = 0;
      let early = 0;
      ui.bulk.sel.forEach(x => {
        if (releaseProblem(ch.id, x.date, x.time)) { early++; return; }
        try { const ev = G.channels.assign(x.date, x.time, ch.id); done.push({ date: x.date, time: x.time, from: x.from, eventId: ev.id }); }
        catch (err) { failed++; }
      });
      ui.bulk = { on: false, ch: ch.id, sel: [] };
      log('sync', `${done.length} מועדים נפתחו ${inCh(ch)}`, 'כל מועד נמחק מכל ערוץ אחר ונכתב רק ליומן של הערוץ הזה.');
      flashKeys(done.map(x => slotKey(x.date, x.time)));
      snack(`${done.length === 1 ? 'מועד אחד נפתח' : `${done.length} מועדים נפתחו`} ${inCh(ch)}${failed ? `. ${failed} לא נפתחו כי הזמן כבר לא פנוי` : ''}${early ? `. ${early} קרובים מדי, ונשארו באתר` : ''}`, () => {
        done.forEach(x => undoAssign(x, ch));
      });
    },
    undo() {
      const fn = ui.undo;
      hideSnack();
      if (!fn) return;
      fn();
      render();
      snack('הפעולה בוטלה');
    },
    // נגישות
    skipToMain() { focusMain(); },
    toggleMotion() { ui.motionOff = !ui.motionOff; document.body.classList.toggle('motion-off', ui.motionOff); render(); ui.focusSel = '[data-act="toggleMotion"]'; focusPending(); },
    accSend() {
      const f = ui.accForm;
      f.err = ''; f.errField = '';
      if (f.name.trim().length < 2) { f.err = 'נא למלא שם.'; f.errField = 'name'; }
      else if (f.contact.trim().length < 5) { f.err = 'נא למלא טלפון או מייל לחזרה.'; f.errField = 'contact'; }
      else if (f.text.trim().length < 5) { f.err = 'נא לתאר בקצרה מה לא עבד.'; f.errField = 'text'; }
      else { f.sent = true; log('notify', 'פנייה בנושא נגישות', `${f.name.trim()}: ${f.text.trim()}`); }
      if (f.errField) ui.focusSel = `[data-bind="accForm.${f.errField}"]`;
      render();
    },
    newSlotForm() {
      const days = nsfDays();
      if (!ui.nsf || !days.includes(ui.nsf.date)) ui.nsf = { date: ui.calDay && days.includes(ui.calDay) ? ui.calDay : days[0], time: '', ch: HOME };
      openSheet(nsfHtml);
    },
    nsfOpen() { const f = ui.nsf; if (f.time) openWithUndo(f.date, f.time, f.ch); },
    nsfBlock() { const f = ui.nsf; if (f.time) blockWithUndo(f.date, f.time); },

    // מסך התאימות
    runAudit() { runAudit(); render(); ui.focusSel = '.audit-sum'; focusPending(); },
    compTab(d) { ui.compTab = d.t; render(); },

    // חיבור ליומן גוגל
    async gsConnect() {
      try {
        ui.gsCals = await GS.connect();
        ui.gsChoice = { studio: existingStudio() ? existingStudio().id : 'new', upload: 'basic' };
        openSheet(gsSetupSheet);
      } catch (e) { render(); }
    },
    async gsChoose() {
      try {
        if (!ui.gsCals) ui.gsCals = await GS.listCalendars();
        ui.gsChoice = ui.gsChoice || { studio: existingStudio() ? existingStudio().id : 'new', upload: 'basic' };
        openSheet(gsSetupSheet);
      } catch (e) { render(); }
    },
    async gsSetup() {
      ui.gsBusy = true;
      renderSheet();
      try {
        await GS.setup({ studioId: ui.gsChoice.studio === 'new' ? null : ui.gsChoice.studio, upload: ui.gsChoice.upload });
        ui.gsBusy = false;
        closeSheet();
        runSync();
        render();
        snack('היומן מחובר. מעכשיו כל שינוי נשמר גם ביומן גוגל.');
      } catch (e) { ui.gsBusy = false; closeSheet(); render(); }
    },
    gsSync() { GS.syncNow().then(scheduleRender); },
    async gsReconnect() {
      try { await GS.reconnect(); } catch (e) { /* ההודעה מוצגת בכרטיס */ }
      if (GS.state().status === 'authorized') return A.gsChoose();
      render();
    },
    gsDisconnect(d) {
      GS.disconnect(d.forget === '1');
      render();
      snack(d.forget === '1' ? 'החיבור נותק, והיומנים שנבחרו נשכחו.' : 'החיבור לגוגל נותק. הדמו ממשיך עם העותק המקומי.');
    },
    /* ---------- עריכה: סטודנטים ---------- */
    clsTab(d) { ui.clsTab = d.t; if (location.hash.startsWith('#/tamima/student/')) return; render(); },
    stuNew(d) {
      ui.stf = { id: null, paid: false, used: 0, name: d.name || '', phone: d.phone || '', email: d.email || '', groupId: (d.group && group(d.group) ? d.group : (activeGroups()[0] || {}).id), start: '', leadId: d.lead || null, err: '', errField: '' };
      openSheet(studentFormHtml);
    },
    stuEdit(d) {
      const s = student(d.id);
      ui.stf = { id: s.id, name: s.name, phone: s.phone, email: s.email || '', groupId: s.groupId, start: s.start || '', notes: s.notes, err: '', errField: '' };
      openSheet(studentFormHtml);
    },
    stuSave() {
      const f = ui.stf;
      const isNew = !f.id;
      const [field, err, id] = saveStudent(f);
      if (err) { f.err = err; f.errField = field; renderSheet(); const el = $(`[data-bind="stf.${field}"]`); if (el) el.focus(); return; }
      if (f.leadId) { const l = S.leads.find(x => x.id === f.leadId); if (l) Object.assign(l, { handled: true, status: 'student', handledAt: todayIso(), studentId: id }); }
      closeSheet();
      snack(isNew ? 'נוסף לקורס. השם מופיע ברשימת הנוכחות של הקבוצה.' : 'הפרטים נשמרו.');
      if (isNew) location.hash = `#/tamima/student/${id}`; else render();
    },
    stuRemoveAsk(d) { const s = student(d.id); openSheet(confirmHtml(`להסיר את ${esc(s.name)} מהקורס?`, 'המקום בקבוצה יתפנה. ההיסטוריה, התשלומים והחשבוניות נשמרים, ואפשר להחזיר לקורס בכל רגע. אם נשארו שיעורים שלא נוצלו, ייפתח מסך זיכוי.', 'stuActive', `data-id="${s.id}" data-on="0"`, 'הסרה')); },
    stuActive(d) {
      setStudentActive(d.id, d.on === '1'); closeSheet(); render();
      if (d.on !== '1') {
        // נשארו שיעורים שלא נוצלו בכרטיסייה ששולמה: מוצע זיכוי
        const p = S.payments.filter(x => x.studentId === d.id).sort((a, b) => b.date.localeCompare(a.date) || b.invoice - a.invoice).find(x => refundable(x.invoice) && suggestRefund(invoiceInfo(x.invoice)).amount > 0);
        if (p) { openRefund(p.invoice); return; }
      }
      snack(d.on === '1' ? 'החזרה לקורס בוצעה.' : 'ההסרה מהקורס בוצעה.');
    },
    stuUse(d) {
      const s = student(d.id);
      if (Number(d.d) > 0) useLesson(s); else unuseLesson(s);
      render();
      snack(`הכרטיסייה עודכנה: ${s.used}/${S.settings.cardSize}`);
    },
    stuPayManual(d) {
      const s = student(d.id);
      payCard(s, { manual: true });
      S.payments[S.payments.length - 1].manual = true;
      render();
      snack('התשלום נרשם, והחשבונית נשלחה במייל.');
    },
    stuPolicyLink(d) {
      const s = student(d.id);
      email('policyLink', toStudent(s), 'מדיניות הביטולים של הקורס', [`היי ${first(s)},`, 'מצורף קישור לקריאה ואישור של מדיניות הביטולים של הקורס.', 'תודה, תמימה'], { cta: ['לקריאה ואישור', studentUrl(s, 'policy')] });
      render(); snack('נשלח קישור לאישור המדיניות.');
    },
    leaveSeen(d) { const s = student(d.id); s.leave.seen = true; render(); snack('סומן.', () => { s.leave.seen = false; render(); }); },
    // הודעת עזיבה שהגיעה ישירות לתמימה: אותו חישוב של תאריך הסיום, בלי חתימה
    stuLeaveOutside(d) {
      const s = student(d.id), e = leaveEndDate(s);
      openSheet(confirmHtml(`התקבלה הודעת עזיבה מ${esc(s.name)}?`, `${LEAVE_CLAUSE} תאריך הסיום: <b>${longDay(e.date)}</b> (${lessonsUntil(s, e.date)} שיעורים עד אז). יישלח מייל אישור.`, 'stuLeaveOutsideDo', `data-id="${s.id}"`, 'רישום ההודעה'));
    },
    stuLeaveOutsideDo(d) {
      const s = student(d.id), e = leaveEndDate(s);
      s.leave = { noticeDate: todayIso(), endDate: e.date, minDate: e.date, name: '', sig: '', version: S.settings.policyVersion, source: 'outside', seen: true };
      leaveMailStudent(s);
      log('notify', `הודעת עזיבה נרשמה: ${s.name}`, `התקבלה מחוץ לאפליקציה. תאריך הסיום ${fullDate(e.date)}.`);
      closeSheet(); render(); snack(`נרשם. תאריך הסיום: ${longDay(e.date)}.`);
    },
    stuLeaveDate(d) {
      const s = student(d.id), v = ui.ld.date;
      if (!v) return;
      s.leave.endDate = v;
      log('notify', `תאריך הסיום עודכן: ${s.name}`, `${fullDate(v)}${v < (s.leave.minDate || v) ? ', מוקדם מהמדיניות' : ''}.`);
      render(); snack(`תאריך הסיום עודכן ל${longDay(v)}.`);
    },
    // הסטודיו מפסיק את ההשתתפות: מוצע החזר על השיעורים שלא נוצלו, פחות דמי הטיפול. שום החזר לא יוצא לבד
    stuStopAsk(d) {
      const s = student(d.id), un = paidUnused(s), sug = Math.max(0, un * perLesson() - S.settings.stopParticipationFee);
      openSheet(confirmHtml(`הסטודיו מפסיק את ההשתתפות של ${esc(s.name)}?`, `היציאה מהקורס היא מעכשיו, והמקום בקבוצה מתפנה.${lastPayment(s) ? ` ייפתח מסך זיכוי עם הצעה: ${un} שיעורים שלא נוצלו × ${money(perLesson())}, פחות ${money(S.settings.stopParticipationFee)} = ${money(sug)}.` : ''}`, 'stuStop', `data-id="${s.id}"`, 'הפסקת ההשתתפות'));
    },
    stuStop(d) {
      const s = student(d.id), un = paidUnused(s), p = lastPayment(s);
      const sug = Math.max(0, un * perLesson() - S.settings.stopParticipationFee);
      deactivateStudent(s);
      log('sync', `${s.name}: הסטודיו הפסיק את ההשתתפות`, 'המקום בקבוצה התפנה. ההיסטוריה והתשלומים נשמרו.');
      render();
      if (!p) { closeSheet(); snack('ההשתתפות הופסקה.'); return; }
      const x = openRefundCase({ inv: p.invoice, reason: 'stop', studentId: s.id, suggested: Math.min(sug, p.amount - refundedOf(p.invoice)), why: `${un} שיעורים שלא נוצלו × ${money(perLesson())}, פחות ${money(S.settings.stopParticipationFee)} דמי טיפול והיערכות.` });
      openCaseSheet(x.id);
    },
    stuGrant(d) {
      const s = student(d.id);
      grantCredit(s, { id: null });
      email('makeupGranted', toStudent(s), 'קיבלת השלמה', [`היי ${first(s)},`, 'תמימה נתנה לך השלמה. אפשר לקבוע אותה באפליקציה, בקבוצה אחרת שיש בה מקום, במשך חודש.'], { cta: ['לקביעת השלמה', studentUrl(s, 'lessons')] });
      render();
      snack('ניתנה השלמה, בתוקף לחודש.');
    },
    stuCreditExtend(d) {
      const m = S.makeups.find(x => x.id === d.id), s = student(m.studentId);
      m.expires = iso(addMonths(parse(m.expires), 1));
      m.warned = false;
      email('makeupGranted', toStudent(s), 'ההשלמה שלך הוארכה', [`היי ${first(s)},`, `ההשלמה שלך בתוקף עכשיו עד ${longDay(m.expires)}.`], { cta: ['לקביעת השלמה', studentUrl(s, 'lessons')] });
      render(); snack(`ההשלמה הוארכה עד ${dmy(m.expires)}.`);
    },
    mailView(d) { openSheet(() => mailViewHtml(d.id)); },
    mailRetry(d) { const m = S.mail.outbox.find(x => x.id === d.id); m.status = 'queued'; m.error = ''; deliver(m); closeSheet(); render(); },
    mailTest() { email('test', toStudio(), 'בדיקת שליחה מהסטודיו של תמימה', ['אם המייל הזה הגיע, שליחת המיילים מהמערכת עובדת.', 'עברית, קישורים ועיצוב: הכל אמור להיראות תקין.'], { cta: ['לדשבורד', siteUrl('#/tamima/home')] }); render(); snack('מייל בדיקה נשלח. בדקו את התיבה.'); },
    async gsSelfTest() {
      ui.selfTest = { busy: true, steps: [] };
      render();
      ui.selfTest = { busy: false, steps: await GS.selfTest(), at: new Date() };
      render();
    },
    stuCreditDel(d) { S.makeups = S.makeups.filter(m => m.id !== d.id); render(); snack('ההשלמה בוטלה.'); },
    invoiceSheet(d) { const p = S.payments.find(x => x.id === d.id); const s = student(p.studentId); openSheet(() => invoiceDoc(p.invoice, s.name, 'כרטיסייה, 4 שיעורים', p.amount, p.date) + refundLines(p.invoice)); },
    leadToStudent(d) { const l = S.leads.find(x => x.id === d.id); A.stuNew({ name: l.name, phone: l.phone, email: l.email, group: l.group, lead: l.id }); },

    /* ---------- עריכה: קבוצות ושיעורים ---------- */
    grpNew() { ui.gf = { id: null, name: '', day: 3, start: '17:30', end: '20:00', max: S.settings.defaultMax, err: '', errField: '' }; openSheet(groupFormHtml); },
    grpEdit(d) { const g = group(d.id); ui.gf = { id: g.id, name: g.name, day: g.day, start: g.start, end: g.end, max: g.max, err: '', errField: '' }; openSheet(groupFormHtml); },
    grpSave() {
      const err = saveGroup(ui.gf);
      if (err) { ui.gf.err = err; renderSheet(); return; }
      const isNew = !ui.gf.id;
      closeSheet(); render();
      snack(isNew ? 'הקבוצה נוספה, והופיעה ביומן ובאתר.' : 'הקבוצה עודכנה ביומן, באתר ואצל הסטודנטים.');
    },
    grpRemoveAsk(d) {
      const g = group(d.id);
      if (groupStudents(g.id).length) { snack(`ב${g.name} יש סטודנטים. קודם מעבירים אותם לקבוצה אחרת.`); return; }
      openSheet(confirmHtml(`להסיר את ${esc(g.name)}?`, 'השיעורים העתידיים יורדו מהיומן ומהאתר. ההיסטוריה נשמרת.', 'grpRemove', `data-id="${g.id}"`, 'הסרה'));
    },
    grpRemove(d) { const err = removeGroup(d.id); closeSheet(); render(); snack(err || 'הקבוצה הוסרה.'); },
    lessonCancelAsk(d) { const l = lesson(d.l); const late = (lStart(l) - now()) / 36e5 < 48; openSheet(confirmHtml(`לבטל את השיעור ב${longDay(l.date)}?`, `כל הסטודנטים ב${esc(group(l.groupId).name)} יקבלו הודעה. השיעור לא ייספר בכרטיסייה, והוא יורד מהיומן.${late ? '</p><p class="policy warn">לפי המדיניות, יש לעדכן עד 48 שעות לפני.' : ''}`, 'lessonCancel', `data-l="${l.id}"`, 'ביטול השיעור')); },
    lessonCancel(d) { setLessonCancelled(d.l, true); closeSheet(); render(); snack('השיעור בוטל, והסטודנטים קיבלו הודעה.', () => setLessonCancelled(d.l, false)); },
    lessonRestore(d) { setLessonCancelled(d.l, false); render(); snack('השיעור חזר ללוח.'); },
    conflictOk(d) {
      S.conflictsDismissed.push(d.k);
      render();
      snack('סומן כלא רלוונטי.', () => { S.conflictsDismissed = S.conflictsDismissed.filter(k => k !== d.k); render(); });
    },
    closureAdd() {
      const r = addClosure(ui.cf);
      if (r.err) { ui.cf.err = r.err; render(); return; }
      ui.cf = { from: '', to: '', note: '', cancel: true, err: '' };
      render();
      snack('הימים נסגרו, והמועדים בהם ירדו מכל הערוצים.', () => { removeClosure(r.id); render(); });
    },
    closureSheet(d) {
      openSheet(() => {
        const ev = safeGet(CAL.studio, d.id);
        if (!ev || ev.status === 'cancelled') return '';
        const c = closureOf(ev);
        return `<h2>הסטודיו סגור</h2><p class="muted">${closureRange(c)}</p>${c.note ? `<p>${esc(c.note)}</p>` : ''}
          <p class="small">בימים האלה לא נפתחים מועדים באף ערוץ.${c.lessons.length ? ` ${c.lessons.length} שיעורים בוטלו.` : ''}</p>
          <button class="btn ghost block" data-act="closureRemoveAsk" data-id="${c.id}">ביטול הסגירה</button>`;
      });
    },
    closureRemoveAsk(d) {
      const ev = safeGet(CAL.studio, d.id);
      if (!ev) return;
      const c = closureOf(ev);
      openSheet(confirmHtml('לבטל את הסגירה?', `${closureRange(c)}. ${c.lessons.length ? 'השיעורים שבוטלו יחזרו, והסטודנטים יקבלו הודעה. ' : ''}מועדים פנויים ייפתחו שוב לפי ההגדרות.`, 'closureRemove', `data-id="${c.id}"`, 'ביטול הסגירה'));
    },
    closureRemove(d) { removeClosure(d.id); closeSheet(); render(); snack('הסגירה בוטלה.'); },

    /* ---------- עריכה: סדנאות ---------- */
    wsNew() {
      const days = futureDays(60);
      ui.wsf = { mode: 'new', date: days.find(dd => timeOptions(dd, { takeSlots: true }).length) || days[0], time: '', n: 2, name: '', phone: '', email: '', amount: '', paid: false, err: '', errField: '' };
      openSheet(wsFormHtml);
    },
    wsEdit(d) {
      const w = workshop(d.id);
      ui.wsf = { mode: 'edit', id: w.id, name: w.customer.name, phone: w.customer.phone, email: w.customer.email, n: w.n, amount: w.amount, paid: w.paid !== false, err: '', errField: '' };
      openSheet(wsFormHtml);
    },
    wsSave() {
      const f = ui.wsf;
      const r = f.mode === 'new' ? addWorkshop(f) : saveWorkshop(f);
      if (r[1]) { f.err = r[1]; f.errField = r[0]; renderSheet(); const el = $(`[data-bind="wsf.${r[0]}"]`); if (el) el.focus(); return; }
      closeSheet(); render();
      snack(f.mode === 'new' ? 'הסדנה נוספה ליומן, והמועד ירד מכל הערוצים.' : 'הסדנה עודכנה, גם ביומן.');
    },
    wsMoveOpen(d) {
      const w = workshop(d.id);
      ui.mvf = { kind: 'ws', id: w.id, fromDate: w.date, fromTime: w.time, date: w.date, time: w.time, ignore: { date: w.date, s: toMin(w.time), e: toMin(w.time) + X.WORKSHOP_MIN }, err: '' };
      openSheet(moveFormHtml);
    },
    slotMoveOpen(d) {
      const ch = G.channels.get(d.ch);
      const ev = G.events.get({ calendarId: ch.calendarId, eventId: d.id });
      const sp = G.msToWall(G.edgeMs(ev.start));
      const firstOk = futureDays(60).find(dd => !releaseProblem(d.ch, dd, '23:59')) || sp.slice(0, 10);
      ui.mvf = { kind: 'slot', ch: d.ch, eventId: d.id, fromDate: sp.slice(0, 10), fromTime: sp.slice(11, 16), date: releaseProblem(d.ch, sp.slice(0, 10), '23:59') ? firstOk : sp.slice(0, 10), time: '', err: '' };
      openSheet(moveFormHtml);
    },
    mvSave() {
      const f = ui.mvf;
      if (f.kind === 'ws') {
        const err = moveWorkshop(f.id, f.date, f.time);
        if (err) { f.err = err; renderSheet(); return; }
        if (f.late) {
          const w = workshop(f.id), cu = customerOf(w);
          if (cu) cu.lateMoveUsed = todayIso();
          if (w.lateRequest) w.lateRequest.status = 'done';
          const x = typeof f.late === 'string' && refundCase(f.late);
          if (x) x.status = 'moved';
          log('notify', `הזזה חד פעמית: ${w.customer.name}`, `נרשם בכרטיס הלקוח (${dmy(todayIso())}). החשבונית נשארת, ולא נפתח זיכוי.`);
        }
        closeSheet(); render(); snack('הסדנה הוזזה. היומן והערוצים עודכנו, ונשלח מייל עם המועד החדש.');
        return;
      }
      const ch = G.channels.get(f.ch);
      const rp = releaseProblem(f.ch, f.date, f.time);
      if (rp) { f.err = rp; renderSheet(); return; }
      G.events.delete({ calendarId: ch.calendarId, eventId: f.eventId });
      try { G.channels.assign(f.date, f.time, f.ch); }
      catch (e) { G.channels.assign(f.fromDate, f.fromTime, f.ch); f.err = 'הזמן כבר לא פנוי.'; renderSheet(); return; }
      runSync();
      closeSheet(); render(); snack(`המועד הוזז ל${shortDay(f.date)} ${f.time}.`);
    },
    wsCancelAsk(d) { const w = workshop(d.id); const paid = isOwn(w) && w.invoice && refundable(w.invoice); openSheet(confirmHtml('לבטל את הסדנה?', `${esc(w.customer.name)}, ${longDay(w.date)} ${w.time}. המועד יחזור להיות פנוי.${paid ? ' אחרי הביטול ייפתח מסך הזיכוי עם החזר מלא מוצע. המייל יישלח אחרי ההחלטה.' : ' יישלח מייל.'}`, 'wsCancel', `data-id="${w.id}"`, 'ביטול הסדנה')); },
    wsCancel(d) {
      const w = workshop(d.id);
      // סדנה ששולמה באתר: תמימה ביטלה, ולכן מוצע החזר מלא בלי קשר למועד. שום החזר לא יוצא לפני ההחלטה שלה
      if (isOwn(w) && w.invoice && refundable(w.invoice)) {
        setWorkshopCancelled(d.id, true, { mail: false });
        const x = openRefundCase({ inv: w.invoice, reason: 'studio', wsId: w.id, suggested: w.amount - refundedOf(w.invoice), why: 'תמימה ביטלה את הסדנה: מוצע החזר מלא, בלי קשר למועד.' });
        render(); openCaseSheet(x.id); return;
      }
      setWorkshopCancelled(d.id, true); closeSheet(); render(); snack('הסדנה בוטלה.', () => { const err = setWorkshopCancelled(d.id, false); if (err) snack(err); });
    },
    refundOpen(d) { openRefund(Number(d.inv)); },
    caseOpen(d) { openCaseSheet(d.id); },
    lateSeen(d) { const w = workshop(d.id); w.lateRequest.status = 'done'; render(); snack('סומן כטופל.', () => { w.lateRequest.status = 'open'; render(); }); },
    privacyDone(d) { const r = S.privacyRequests.find(x => x.id === d.id); r.status = 'done'; r.doneAt = todayIso(); render(); snack('הבקשה סומנה כטופלה.', () => { r.status = 'open'; render(); }); },
    anonAsk(d) {
      const who = d.kind === 'student' ? student(d.id) : customer(d.id);
      openSheet(confirmHtml(`אנונימיזציה של ${esc(who.name)}?`, 'נמחקים השם, הטלפון והמייל, גם מההיסטוריה ומהמיילים. הקבלות, הסכומים והתאריכים נשמרים, כי חובה לשמור אותם לפי חוק. אי אפשר לבטל את הפעולה.', 'anonDo', `data-kind="${d.kind}" data-id="${d.id}"`, 'אנונימיזציה'));
    },
    anonDo(d) { anonymize(d.kind, d.id, 'תמימה'); closeSheet(); render(); snack('האנונימיזציה בוצעה. הקבלות נשמרו.'); },
    // פנייה מאוחרת (הלקוח פנה בוואטסאפ): מוצע 0 ₪, ומוצגת גם הזזה חד פעמית
    lateOpen(d) {
      const w = workshop(d.id);
      openRefund(w.invoice, { wsId: w.id, late: true, reason: 'customer', suggested: 0, why: `פנייה בפחות מ-${S.settings.workshopCancelHours} שעות לפני הסדנה: לפי המדיניות אין החזר.` });
    },
    lateMove() {
      const f = ui.rf, w = workshop(f.wsId);
      ui.rf = null;
      A.wsMoveOpen({ id: w.id });
      ui.mvf.late = f.caseId || true;
    },
    refundDo() {
      const f = ui.rf, info = invoiceInfo(f.inv);
      const left = info.amount - refundedOf(f.inv);
      const raw = String(f.amount).trim();
      const amt = Math.round(Number(raw.replace(/[^\d.]/g, '')) * 100) / 100;
      f.errField = 'amount';
      const bad = msg => { f.err = msg; renderSheet(); ui.focusSel = '#sheet [data-bind="rf.amount"]'; focusPending(); };
      if (!raw || !(amt > 0)) { bad('נא למלא סכום גדול מאפס.'); return; }
      if (amt > left + 0.001) { bad(`אי אפשר לזכות יותר מ-${money(left)}, היתרה שעוד לא זוכתה בחשבונית הזו. סאמיט לא יאפשרו זיכוי גבוה יותר.`); return; }
      // הקריאה היחידה לזיכוי בסאמיט, רק אחרי הלחיצה של תמימה
      const res = sumitRefund({ customer: info.customer, token: info.token, amount: amt, invoice: f.inv, desc: `זיכוי לחשבונית מס׳ ${f.inv}` });
      let x = f.caseId && refundCase(f.caseId);
      if (!res.ok) {
        if (!x) x = openRefundCase({ inv: f.inv, reason: f.reason, wsId: f.wsId, studentId: f.studentId, suggested: f.suggested, why: f.why, info: f.info, late: f.late });
        Object.assign(x, { status: 'failed', error: res.error, amountTried: amt });
        audit(`זיכוי נכשל (${money(amt)})`, 'תמימה', info.name);
        f.caseId = x.id;
        log('sumit', 'סאמיט: הזיכוי נכשל', res.error);
        email('refundFailed', toStudio(), `הזיכוי ל${info.name} לא בוצע`, ['שלום תמימה,', `הזיכוי של ${money(amt)} לחשבונית מס׳ ${f.inv} לא בוצע.`, res.error, 'הזיכוי מסומן "דורש טיפול" בבית.'], { cta: ['לטיפול', siteUrl('#/tamima/home')] });
        toast('הזיכוי נכשל', `${info.name}: ${res.error}`);
        f.errField = ''; f.err = `הזיכוי לא בוצע: ${res.error} הוא מסומן "דורש טיפול" בבית.`;
        renderSheet(); return;
      }
      const r = { id: uid('rf'), invoice: f.inv, amount: amt, date: todayIso(), creditNo: res.creditNo, reason: f.reason || 'manual' };
      S.refunds.push(r);
      if (x) Object.assign(x, { status: 'done', refundId: r.id });
      audit(`זיכוי ${money(amt)} לחשבונית ${f.inv}`, 'תמימה', info.name);
      if (f.late && f.wsId && workshop(f.wsId).lateRequest) workshop(f.wsId).lateRequest.status = 'done';
      log('sumit', 'סאמיט: הזיכוי בוצע', `${info.name}, ${money(amt)}. ההחזר יצא לכרטיס האשראי, והופקה חשבונית מס קבלה זיכוי מס׳ ${r.creditNo}.`);
      const w = f.wsId && workshop(f.wsId);
      if (w) { if (w.status !== 'cancelled') dropWorkshop(w); wsCancelMail(w, r); }
      else email(info.kind === 'ws' ? 'refund' : 'refundStudent', info.to, `זיכוי ${money(amt)}, חשבונית מס קבלה זיכוי מס׳ ${r.creditNo}`, [`שלום ${info.name.split(' ')[0]},`, `בוצע זיכוי של ${money(amt)} עבור חשבונית מס קבלה מס׳ ${f.inv} (${info.desc}).`, 'ההחזר בוצע לכרטיס האשראי. מסמך זיכוי מצורף.'], { extra: creditMailHtml(r) });
      ui.rf = null;
      closeSheet(); render();
      snack(`הזיכוי בוצע: ${money(amt)}. מסמך זיכוי מס׳ ${r.creditNo}.`);
    },
    // ללא החזר: אין קריאה לסאמיט. בסדנה, הלקוח מקבל "הסדנה בוטלה" בלי אזכור של החזר
    refundSkip() {
      const f = ui.rf, x = f.caseId && refundCase(f.caseId);
      if (x) x.status = 'none';
      if (f.late && f.wsId && workshop(f.wsId).lateRequest) workshop(f.wsId).lateRequest.status = 'done';
      const w = f.wsId && workshop(f.wsId);
      if (w) { if (w.status !== 'cancelled') dropWorkshop(w); wsCancelMail(w, null); }
      if (x || w) log('notify', 'החלטה: ללא החזר', `${invoiceInfo(f.inv).name}, חשבונית מס׳ ${f.inv}. לא נשלחה קריאה לסאמיט.`);
      ui.rf = null; closeSheet(); render();
      snack(w ? 'הסדנה בוטלה בלי החזר, ונשלח מייל.' : 'סומן: ללא החזר.');
    },
    // אחר כך: הזיכוי נשאר ב"ממתין לך עכשיו"
    refundLater() {
      const f = ui.rf;
      if (!f.caseId) openRefundCase({ inv: f.inv, reason: f.reason, wsId: f.wsId, studentId: f.studentId, suggested: f.suggested, why: f.why, info: f.info, late: f.late });
      ui.rf = null; closeSheet(); render();
      snack('הזיכוי ממתין להחלטה ב"ממתין לך עכשיו".');
    },
    creditDoc(d) { const r = S.refunds.find(x => x.id === d.id); if (r) openSheet(() => creditDocHtml(r)); },
    wsRestore(d) { const err = setWorkshopCancelled(d.id, false); closeSheet(); render(); snack(err || 'הסדנה חזרה ליומן.'); },

    /* ---------- עריכה: חסימות ---------- */
    wsTab(d) { ui.wsTab = d.t; render(); },
    wsSheet(d) { openSheet(() => workshopSheetHtml(d.id)); },
    customerSheet(d) { openSheet(() => customerSheetHtml(d.id)); },
    custMergePick(d) {
      const c = customer(d.id);
      openSheet(() => `<h2>איחוד עם לקוח אחר</h2><p class="muted">${esc(c.name)}. בחרו את הכרטיס שיתאחד לתוכו.</p>
        <div class="choice-list">${S.customers.filter(o => o.id !== c.id).map(o => `<button class="choice" data-act="custMergeAsk" data-keep="${c.id}" data-drop="${o.id}"><b>${esc(o.name)}</b><small dir="ltr">${o.phones.map(fmtPhone).join(', ')}${o.email ? ' · ' + esc(o.email) : ''}</small></button>`).join('')}</div>`);
    },
    custMergeAsk(d) { openSheet(() => mergePreviewHtml(d.keep, d.drop)); },
    custMergeDo(d) { mergeCustomers(d.keep, d.drop); openSheet(() => customerSheetHtml(d.keep)); render(); snack('הכרטיסים אוחדו.'); },
    custNotSame(d) {
      const x = customer(d.a), y = customer(d.b);
      x.notSame = (x.notSame || []).concat(y.id); y.notSame = (y.notSame || []).concat(x.id);
      if (ui.sheet) renderSheet();
      render(); snack('סומן: לא אותו לקוח.', () => { x.notSame = x.notSame.filter(i => i !== y.id); y.notSame = y.notSame.filter(i => i !== x.id); render(); });
    },
    feedback(d) {
      const w = workshop(d.id); w.feedbackSent = true;
      email('feedback', toCustomer(w), 'איך היה בסדנה?', [`שלום ${w.customer.name.split(' ')[0]},`, 'תודה שהגעתם לסטודיו! נשמח לשמוע איך היה, בכמה מילים.', 'הכלים שלכם יהיו מוכנים לאיסוף אחרי הייבוש והשריפה בתנור.']);
      render();
    },
    whatsapp(d) {
      const w = workshop(d.id); w.feedbackSent = true;
      log('whatsapp', `הודעת משוב בוואטסאפ ל${w.customer.name}`, `היי ${w.customer.name.split(' ')[0]}, תודה שהגעתם לסדנה! איך היה?`);
      render();
    },
    issueReceipt(d) {
      const w = workshop(d.id);
      const amount = Number(String(ui.rcpt.amount).replace(/[^\d.]/g, '')) || w.amount;
      w.customer.name = ui.rcpt.name.trim() || w.customer.name; ui.rcpt.amount = amount;
      w.receipt = 'manual'; w.invoice = sumitCreateDocument(w.customer, wsDesc(w), amount);
      if (w.eventId) G.events.patch({ calendarId: CAL.studio, eventId: w.eventId, requestBody: { summary: X.workshopEvent(w).summary, extendedProperties: { private: { receipt: String(w.invoice) } } } });
      email('receipt', toCustomer(w), `חשבונית מס קבלה מס׳ ${w.invoice}`, [`שלום ${w.customer.name.split(' ')[0]},`, `מצורפת חשבונית מס קבלה מס׳ ${w.invoice} עבור הסדנה ב${longDay(w.date)}.`]);
      render(); scrollTop();
    },

  });

  // שמירת הגדרות ערוץ, עם הודעה ברורה על מה שהשתנה או מה לא תקין
  function saveChannel(id, patch, isTimes) {
    try {
      G.channels.update(id, patch);
      const acts = runSync();
      const pr = acts.find(a => a.type === 'prune'), fl = acts.find(a => a.type === 'fill');
      const cnt = (n, verb) => (n === 1 ? `מועד אחד ${verb}` : `${n} מועדים ${verb}ו`);
      const effect = [fl && `${cnt(fl.count, 'נפתח')} באתר`, pr && `${cnt(pr.count, 'נסגר')} באתר`].filter(Boolean).join(', ');
      ui.chMsg = { id, ok: true, times: isTimes, text: effect ? `נשמר. ${effect}.` : 'נשמר.' };
    } catch (err) {
      const m = err.message || '';
      ui.chMsg = { id, ok: false, times: isTimes, text: /time/i.test(m) ? 'שעה לא תקינה. כתבו בפורמט 10:00.' : /name/i.test(m) ? 'נא לתת שם.' : 'הערך לא תקין.' };
    }
    render();
    clearTimeout(ui.chMsgT);
    ui.chMsgT = setTimeout(() => { if (ui.chMsg && ui.chMsg.ok) { ui.chMsg = null; if (route().page === 'more') render(); } }, 4000);
  }

