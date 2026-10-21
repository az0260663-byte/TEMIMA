/* student.js: האזור האישי של סטודנט בלבד (נפתח מהקישור האישי במייל). */
'use strict';

  /* ================= אזור 3: סטודנט ================= */
  function studentView(r) {
    const page = r.page || 'home';
    const s = me();
    if (!s && PORTAL) return `<div class="appshell student">
      ${appHead('plate-apron', 'הסטודיו של תמימה', 'האזור האישי')}
      <main id="main" tabindex="-1" class="wrap"><h1 class="sr-only">האזור האישי</h1>
        ${ui.portalWait ? card('<p class="center">טוען את האזור האישי...</p>')
          : card(`<h2>הקישור לא זמין</h2><p>הקישור לא תקין, או שפג תוקפו. אפשר לבקש מתמימה קישור חדש.</p>
            <p class="muted small">בדמו: הקישור האישי עובד כשהדמו פתוח באותו דפדפן, בלשונית אחרת.</p>`)}
      </main></div>`;
    if (!s) return `<div class="appshell student">
      ${appHead('plate-apron', 'אפליקציית הסטודנט', 'כאן מוצגים השיעורים, הכרטיסייה והתשלומים של כל סטודנט')}
      <main id="main" tabindex="-1" class="wrap"><h1 class="sr-only">אפליקציית הסטודנט</h1>
        ${card(`<h2>עדיין אין סטודנטים</h2>
          <p>ברגע שנוסף סטודנט, האפליקציה שלו מופיעה כאן.</p>
          <ul class="doc-list"><li>תמימה מוסיפה סטודנט: "תמימה", ואז "חוגים", "סטודנטים", ו"+ סטודנט".</li><li>או שמישהו משאיר פרטים לקורס באתר, ותמימה מוסיפה אותו מ"ממתין לך עכשיו".</li></ul>
          <a class="btn primary block" href="#/tamima/classes">לחוגים של תמימה</a>`)}
      </main></div>`;
    // לפני התשלום הראשון: רק מסך התשלום, בלי תפריט ובלי שאר האזור
    if (isLocked(s)) return `<div class="appshell student">
      ${appHead('cups-grass', `שלום ${first(s)}`, `${group(s.groupId).name} · ${group(s.groupId).start} עד ${group(s.groupId).end}`)}
      <main id="main" tabindex="-1" class="wrap">${page === 'pay' ? sPay() : sWelcomePay(s)}</main></div>`;
    const actives = S.students.filter(x => x.active !== false);
    const pick = !PORTAL && actives.length > 1 ? `<label class="me-pick"><span class="sr-only">צפייה באפליקציה של</span><select data-me>${actives.map(x => `<option value="${x.id}" ${x.id === s.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>` : '';
    const nav = appNav('student', { makeup: 'lessons', pay: 'payments', policy: 'payments', leave: 'home' }[page] || page, [['home', 'בית'], ['lessons', 'שיעורים'], ['payments', 'תשלומים']]);
    const views = { home: sHome, lessons: sLessons, payments: sPayments, makeup: sMakeup, pay: sPay, policy: sPolicy, leave: sLeave };
    const body = (views[page] || sHome)(r.param);
    const msg = ui.stuMsg ? `<div class="flash" role="status"><span>${ui.stuMsg}</span><button class="x-btn" data-act="flashClose" aria-label="סגירת ההודעה">×</button></div>` : '';
    return `<div class="appshell student">
      ${appHead({ home: 'plate-apron', lessons: 'bowls-lap', payments: 'cups-grass', makeup: 'bowls-raise', pay: 'cups-grass' }[page] || 'plate-apron', `שלום ${first(s)}`, `${group(s.groupId).name} · ${group(s.groupId).start} עד ${group(s.groupId).end}`, pick)}
      ${nav}<main id="main" tabindex="-1" class="wrap">${msg}${body}</main></div>`;
  }

  function stuPayCard(s) {
    const ps = payStatus(s);
    if (ps.key === 'requested' || ps.key === 'overdue') {
      return card(`<div class="row-between"><h2>תשלום</h2>${chip(ps.key === 'overdue' || s.firstDue ? 'ממתין לתשלום' : 'נשלחה דרישת תשלום', ps.key)}</div>
        <p>${s.owes ? (s.firstDue ? 'הכרטיסייה הראשונה' : 'הכרטיסייה הנוכחית') : 'הכרטיסייה הבאה'} (${money(S.settings.cardPrice)}) מחכה לתשלום.</p>
        <a class="btn primary block" href="#/student/pay">תשלום בסאמיט</a>`);
    }
    return card(`<div class="row-between"><h2>תשלום</h2>${chip(ps.key === 'paid' ? 'הכרטיסייה הבאה שולמה' : 'הכרטיסייה שולמה', 'paid')}</div>
      <p class="muted small">הכרטיסייה הבאה תישלח לתשלום אחרי השיעור השלישי.</p>`);
  }

  function sWelcomePay(s) {
    return `<h1>ברוכים הבאים</h1>${card(`<h2>תשלום הכרטיסייה הראשונה</h2>
      <p>כרטיסייה של ${S.settings.cardSize} שיעורים, ${money(S.settings.cardPrice)}. התשלום בכרטיס אשראי, בקישור מאובטח של סאמיט.</p>
      <p class="muted small">אחרי התשלום נפתח האזור האישי: השיעורים, הכרטיסייה, ההשלמות והתשלומים. הקישור יישלח גם למייל.</p>
      <a class="btn primary block" href="#/student/pay">לתשלום</a>`, 'hero-card')}`;
  }

  /* ---------- מדיניות: אישור בתשלום הראשון, או בקישור לסטודנט שנוסף כ"כבר שולמה" ---------- */
  const policyCheck = () => `<label class="consent policy-ok"><input type="checkbox" data-bind="pol.ok" data-rerender="page" ${ui.pol && ui.pol.ok ? 'checked' : ''}><span>קראתי ואני מאשר/ת</span></label>`;
  function sPolicy() {
    const s = me();
    return `<a class="back" href="#/student/payments">חזרה</a><h1 class="sr-only">מדיניות</h1>${card(policyHtml() + (s.policy
      ? `<p class="ok-line">✓ אישרת את המדיניות ב-${fullDate(s.policy.date)}</p>`
      : `${policyCheck()}<button class="btn primary block" data-act="stuPolicyApprove" ${ui.pol && ui.pol.ok ? '' : 'disabled'}>אישור המדיניות</button>`))}`;
  }

  /* ---------- סיום הקורס ---------- */
  function sLeave() {
    const s = me();
    if (s.leave) return `<a class="back" href="#/student/home">חזרה</a><h1>סיום הקורס</h1>${card(`<h2>הודעת העזיבה התקבלה</h2>
      <dl class="kv"><dt>נשלחה ב</dt><dd>${fullDate(s.leave.noticeDate)}</dd><dt>תאריך הסיום</dt><dd>${longDay(s.leave.endDate)}</dd></dl>
      <p class="muted small">עד תאריך הסיום הכל ממשיך כרגיל: השיעורים, ההשלמות והתשלומים.</p>`)}`;
    const e = leaveEndDate(s);
    const f = ui.lv || (ui.lv = { name: '', ok: false, err: '', errField: '' });
    return `<a class="back" href="#/student/home">חזרה</a><h1>סיום הקורס</h1>
      ${card(`<div class="policy"><b>מתוך המדיניות</b>${LEAVE_CLAUSE}</div>
        <dl class="kv"><dt>תאריך הסיום</dt><dd><b>${longDay(e.date)}</b></dd><dt>שיעורים עד הסיום</dt><dd>${lessonsUntil(s, e.date)}</dd></dl>
        <p class="muted small">${e.early ? 'שלושה חודשים מתחילת הקורס עוד לא עברו, ולכן זה תאריך הסיום המוקדם האפשרי.' : 'חודש מהיום, לפי המדיניות.'} עד תאריך הסיום הכל ממשיך כרגיל.</p>
        <label class="field"><span>שם מלא</span><input data-bind="lv.name" value="${esc(f.name)}" autocomplete="name" ${f.errField === 'name' ? 'aria-invalid="true" aria-describedby="lv-err"' : ''}></label>
        <label class="consent"><input type="checkbox" data-bind="lv.ok" ${f.ok ? 'checked' : ''} ${f.errField === 'ok' ? 'aria-invalid="true" aria-describedby="lv-err"' : ''}><span>אני מאשר/ת את סיום הקורס</span></label>
        ${f.err ? `<p class="err" id="lv-err" role="alert">${esc(f.err)}</p>` : ''}
        <button class="btn primary block" data-act="stuLeaveSend">שליחת הודעת עזיבה</button>`)}`;
  }
  function sHome() {
    const s = me();
    const up = studentUpcoming(s).filter(x => !x.l.cancelled && (x.kind === 'makeup' || !x.st));
    const nx = up[0];
    const cr = openCredits(s);
    return `<h1 class="sr-only">בית</h1>${card(nx ? `<small class="eyebrow">השיעור הבא</small>
        <h2 class="big">${longDay(nx.l.date)}</h2>
        <p>${group(nx.l.groupId).start} עד ${group(nx.l.groupId).end} · ${nx.kind === 'makeup' ? 'השלמה ב' + group(nx.l.groupId).name : group(nx.l.groupId).name}</p>
        <button class="btn ghost small" data-act="stuLesson" data-l="${nx.l.id}">פרטים וביטול</button>` : empty('אין שיעורים קרובים.'), 'hero-card')}
      ${card(`<div class="row-between"><h2>כרטיסייה</h2><b>${s.used}/${S.settings.cardSize}</b></div>${punchDots(s)}<p class="muted small">נוצלו ${s.used} מתוך ${S.settings.cardSize} שיעורים.</p>`)}
      ${card(`<div class="row-between"><h2>השלמות זמינות</h2><b>${cr.length}</b></div>
        ${cr.length ? cr.map(m => `<p class="small">בתוקף עד ${dmy(m.expires)}</p><a class="btn primary block" href="#/student/makeup/${m.id}">קביעת השלמה</a>`).join('') : '<p class="muted small">ביטול עד 24 שעות לפני שיעור מזכה בהשלמה, פעם בחודש.</p>'}`)}
      ${stuPayCard(s)}
      <a class="btn ghost block" href="#/student/leave">סיום הקורס</a>`;
  }

  function sLessons() {
    const s = me();
    const list = studentUpcoming(s);
    const cr = openCredits(s);
    const row = x => {
      const g = group(x.l.groupId);
      let st;
      if (x.l.cancelled) st = chip('בוטל על ידי הסטודיו', 'muted');
      else if (x.kind === 'makeup') st = chip('השלמה', 'site');
      else if (x.st === 'cancelled') st = chip('בוטל', 'muted');
      else if (x.st === 'late') st = chip('ביטול מאוחר', 'overdue');
      else if (x.st === 'arrived') st = chip('נוכחות סומנה', 'paid');
      else st = chip('מתוכנן', 'ok');
      return `<button class="ws-row" data-act="stuLesson" data-l="${x.l.id}"><span class="dot dot-${x.kind === 'makeup' ? 'site' : 'class'}"></span>
        <div><b>${longDay(x.l.date)}</b><small>${g.start} עד ${g.end} · ${g.name}</small></div>${st}</button>`;
    };
    return `<h1>השיעורים שלי</h1>
      ${cr.length ? card(`<h2>יש לך ${cr.length === 1 ? 'השלמה אחת' : cr.length + ' השלמות'} לקבוע</h2>${cr.map(m => `<a class="btn primary block" href="#/student/makeup/${m.id}">קביעת השלמה, בתוקף עד ${dmy(m.expires)}</a>`).join('')}`, 'accent') : ''}
      ${card(list.map(row).join('') || empty('אין שיעורים קרובים.'))}
      ${card(policyHtml())}`;
  }

  function sMakeup(mid) {
    const s = me();
    const m = S.makeups.find(x => x.id === mid && x.studentId === s.id && !x.bookedLessonId);
    if (!m) return `<a class="back" href="#/student/lessons">חזרה</a>${card(empty('ההשלמה כבר נקבעה או שאינה זמינה.'))}`;
    const opts = makeupOptions(s, m);
    return `<a class="back" href="#/student/lessons">חזרה</a><h1>קביעת השלמה</h1>
      <p class="muted">שיעורים בקבוצות אחרות שיש בהן מקום, עד ${dmy(m.expires)}.</p>
      ${card(opts.length ? opts.map(l => {
        const g = group(l.groupId); const f = roster(l).free;
        return `<button class="ws-row" data-act="pickMakeup" data-m="${m.id}" data-l="${l.id}"><span class="dot dot-class"></span>
          <div><b>${longDay(l.date)}</b><small>${g.start} עד ${g.end} · ${g.name}</small></div>${chip(f === 1 ? 'נשאר מקום אחד' : `נשארו ${f} מקומות`, f === 1 ? 'requested' : 'ok')}</button>`;
      }).join('') : empty('אין כרגע מקום פנוי בקבוצות האחרות עד תום תוקף ההשלמה.'))}`;
  }

  function sPayments() {
    const s = me();
    const hist = S.payments.filter(p => p.studentId === s.id).sort((a, b) => b.date.localeCompare(a.date));
    return `<h1>תשלומים</h1>
      ${stuPayCard(s)}
      ${card(`<h2>היסטוריה</h2>${hist.map(p => p.unverified ? `<div class="ws-row"><span class="dot dot-paid"></span>
        <div><b>כרטיסייה, 4 שיעורים</b><small>${dmy(p.date)}.${parse(p.date).getFullYear()} · ${money(p.amount)}</small></div>${chip('ממתין לאישור תמימה', 'requested')}</div>` : `<button class="ws-row" data-act="stuInvoice" data-id="${p.id}"><span class="dot dot-paid"></span>
        <div><b>כרטיסייה, 4 שיעורים</b><small>${dmy(p.date)}.${parse(p.date).getFullYear()} · ${money(p.amount)}</small></div><span class="go">חשבונית מס קבלה</span></button>${pdfBtn(p.invoice)}${refundLines(p.invoice)}`).join('') || empty('אין תשלומים עדיין.')}`)}
      ${card(`<h2>מדיניות ביטולים</h2>${s.policy ? `<p class="ok-line">✓ אישרת ב-${fullDate(s.policy.date)}</p>` : '<p>עוד לא אישרת את המדיניות.</p>'}<a class="btn ghost block" href="#/student/policy">${s.policy ? 'למדיניות' : 'לקריאה ואישור'}</a>`)}
      ${privacyCard(s)}
      <p class="muted small">התשלום מתבצע בכרטיס אשראי, בקישור מאובטח של סאמיט.</p>`;
  }
  function privacyCard(s) {
    const open = (S.privacyRequests || []).find(r => r.targetKind === 'student' && r.targetId === s.id && r.status === 'open');
    const f = ui.pr;
    if (open) return card(`<h2>הפרטיות שלך</h2><p class="ok-line">✓ הבקשה ל${open.type} נשלחה ב-${fullDate(open.at)}. תמימה תחזור אליך.</p>`);
    if (!f) return card(`<h2>הפרטיות שלך</h2><p class="muted small">אפשר לבקש לראות את הפרטים שנשמרו עליך, או למחוק אותם. הקבלות נשמרות לפי חוק.</p><button class="btn ghost block" data-act="stuPrivacyOpen">בקשה לעיון או מחיקה</button>`);
    return card(`<h2>בקשה לעיון או מחיקה</h2>
      <fieldset class="fs"><legend>מה מבקשים?</legend>${[['עיון', 'לראות את הפרטים שנשמרו'], ['מחיקה', 'למחוק את השם, הטלפון והמייל']].map(([v, l]) => `<label class="radio-row"><input type="radio" name="pr-type" value="${v}" data-bind="pr.type" ${f.type === v ? 'checked' : ''}><span><b>${v}</b> <small class="muted">${l}</small></span></label>`).join('')}</fieldset>
      <label class="field"><span>הערה <small class="hint-inline">לא חובה</small></span><textarea data-bind="pr.note" rows="2" maxlength="300">${esc(f.note || '')}</textarea></label>
      ${f.err ? `<p class="err" role="alert">${esc(f.err)}</p>` : ''}
      <button class="btn primary block" data-act="stuPrivacySend">שליחת הבקשה</button><button class="btn ghost block" data-act="stuPrivacyCancel">ביטול</button>`);
  }

  function sPay() {
    const s = me();
    const ps = payStatus(s);
    if (ps.key !== 'requested' && ps.key !== 'overdue') return `<a class="back" href="#/student/payments">חזרה</a>${card(empty('אין כרגע תשלום פתוח.'))}`;
    // התשלום הראשון: אישור מדיניות הביטולים לפני התשלום. בלי אישור אין תשלום
    const first = s.firstDue;
    // סליקה אמיתית: הלקוח משלם בלשונית אחרת, וכאן מחכים לאישור
    if (ui.stuLive && s.payOrder && ui.stuLive.ref === s.payOrder.id) return '<h1 class="sr-only">תשלום</h1>' + liveWaitView(ui.stuLive, 'stuPayBack');
    // קישור תשלום קבוע (בדיקה): משלמים בלשונית אחרת, ואז "שילמתי"
    if (!PAY.live && CFG.fixedPayLink) {
      const opened = ui.stuFixed === s.id;
      return `<h1 class="sr-only">תשלום</h1><div class="sumit live-pay">
        <div class="sumit-head"><div><b>תשלום מאובטח</b><small>בדף של מורנינג</small></div><span class="demo-badge">בדיקה: קישור תשלום קבוע</span></div>
        <div class="sumit-amount"><small>כרטיסייה, ${S.settings.cardSize} שיעורים · בדף התשלום מקלידים את הסכום</small><b>${money(S.settings.cardPrice)}</b></div>
        ${first ? `<div class="policy-box">${policyHtml()}${policyCheck()}</div>` : ''}
        ${opened ? `<p class="hint">דף התשלום נפתח בלשונית חדשה. אחרי התשלום חוזרים לכאן ולוחצים "שילמתי".</p>
          <button class="btn primary block" data-act="stuFixedPaid">שילמתי</button>
          <button class="btn ghost block" data-act="stuFixedOpen">לפתיחת דף התשלום שוב</button>`
          : `<button class="btn primary block" data-act="stuFixedOpen" ${first && !(ui.pol && ui.pol.ok) ? 'disabled' : ''}>לתשלום ${money(S.settings.cardPrice)}</button>`}
        <button class="btn ghost block" data-act="stuPayBack">חזרה</button>
        <p class="muted small">בבדיקה הזו המערכת לא יודעת לבד שהתשלום עבר. התשלום יישמר כ"לא אומת", ותמימה תבדוק אותו במורנינג.</p>
      </div>`;
    }
    return '<h1 class="sr-only">תשלום</h1>' + sumitView(S.settings.cardPrice, 'כרטיסייה, 4 שיעורים', 'stuPay', 'stuPayBack', null,
      first ? `<div class="policy-box">${policyHtml()}${policyCheck()}</div>` : '', { payDisabled: first && !(ui.pol && ui.pol.ok) });
  }

  Object.assign(A, {
    // סטודנט
    stuLesson(d) {
      openSheet(() => {
        const s = me(); const l = lesson(d.l); const g = group(l.groupId);
        const mk = S.makeups.find(m => m.studentId === s.id && m.bookedLessonId === l.id);
        const st = att(l.id).rec[s.id];
        let html = `<h2>${mk ? 'השלמה, ' : ''}${g.name}</h2><p class="muted">${longDay(l.date)}, ${g.start} עד ${g.end}</p>`;
        if (mk) {
          const hrs = (lStart(l) - now()) / 36e5;
          html += hrs >= S.settings.lessonCancelHours
            ? `<div class="policy">ביטול ההשלמה יחזיר לך אותה, ואפשר יהיה לקבוע מועד אחר עד ${dmy(mk.expires)}.</div><button class="btn primary block" data-act="cancelMakeup" data-id="${mk.id}">ביטול ההשלמה</button>`
            : `<div class="policy warn">פחות מ-24 שעות לפני השיעור אי אפשר לבטל השלמה.</div>`;
        } else if (st === 'cancelled') html += `<p>${chip('בוטל', 'muted')} ביטלת את השיעור הזה.</p>`;
        else if (st === 'late') html += `<p>${chip('ביטול מאוחר', 'overdue')} השיעור נספר כשיעור שנוצל.</p>`;
        else if (st === 'arrived') html += `<p>${chip('נוכחות סומנה', 'paid')} תמימה סימנה שהגעת לשיעור.</p>`;
        else {
          const ci = cancelInfo(s, l);
          if (!ci.ok) html += `<p class="muted">השיעור כבר התחיל.</p>`;
          else {
            html += ci.late
              ? `<div class="policy warn"><b>ביטול מאוחר</b>השיעור מתחיל בעוד פחות מ-24 שעות. הביטול ייחשב כשיעור שנוצל מהכרטיסייה, ולא תהיה השלמה.</div>`
              : ci.credit
                ? `<div class="policy"><b>ביטול בזמן</b>תהיה לך השלמה שאפשר לקבוע בקבוצה אחרת שיש בה מקום, עד ${dmy(iso(addMonths(startOfToday(), 1)))}.</div>`
                : `<div class="policy warn"><b>ביטול בזמן, ללא השלמה</b>כבר קיבלת השלמה החודש. אפשר לבטל, אבל הביטול הזה לא מזכה בהשלמה נוספת.</div>`;
            html += `<button class="btn ${ci.late ? 'danger' : 'primary'} block" data-act="stuCancel" data-l="${l.id}">אישור ביטול</button><button class="btn ghost block" data-act="closeSheet">השארת השיעור</button>`;
          }
        }
        return html;
      });
    },
    stuCancel(d) {
      const s = me(); const l = lesson(d.l); const ci = cancelInfo(s, l);
      if (!ci.ok) return;
      const a = att(l.id);
      if (ci.late) { a.rec[s.id] = 'late'; useLesson(s); ui.stuMsg = 'השיעור בוטל. הביטול נספר כשיעור שנוצל.'; }
      else { a.rec[s.id] = 'cancelled'; if (ci.credit) { grantCredit(s, l); ui.stuMsg = 'השיעור בוטל, וקיבלת השלמה. אפשר לקבוע אותה עכשיו.'; } else ui.stuMsg = 'השיעור בוטל. הביטול לא מזכה בהשלמה החודש.'; }
      email('lessonCancelledByStudent', toStudent(s), `ביטלת את השיעור ב${shortDay(l.date)}`, [`היי ${first(s)},`, `השיעור ב${longDay(l.date)} בוטל.`, ci.late ? 'הביטול היה פחות מ-24 שעות לפני, ולכן השיעור נספר בכרטיסייה.' : ci.credit ? 'קיבלת השלמה, שאפשר לקבוע בקבוצה אחרת במשך חודש.' : 'השיעור לא נספר בכרטיסייה. החודש כבר נוצלה השלמה.'], ci.credit ? { cta: ['לקביעת השלמה', studentUrl(s, 'lessons')] } : {});
      log('notify', `ביטול שיעור: ${s.name}`, `${group(l.groupId).name}, ${shortDay(l.date)}. ${ci.late ? 'ביטול מאוחר, נספר בכרטיסייה.' : ci.credit ? 'ביטול בזמן, נוצרה השלמה.' : 'ביטול בזמן, ללא השלמה.'} מסומן ברשימת הנוכחות.`);
      closeSheet(); render(); flashClear();
    },
    cancelMakeup(d) {
      const m = S.makeups.find(x => x.id === d.id); const l = lesson(m.bookedLessonId);
      m.bookedLessonId = null;
      log('notify', `ביטול השלמה: ${me().name}`, `${group(l.groupId).name}, ${shortDay(l.date)}. המקום התפנה.`);
      ui.stuMsg = 'ההשלמה בוטלה ואפשר לקבוע אותה מחדש.';
      closeSheet(); render(); flashClear();
    },
    pickMakeup(d) {
      const l = lesson(d.l); const g = group(l.groupId);
      openSheet(() => `<h2>השלמה ב${g.name}</h2><p class="muted">${longDay(l.date)}, ${g.start} עד ${g.end}</p>
        <p>${roster(l).free === 1 ? 'נשאר מקום אחד.' : `נשארו ${roster(l).free} מקומות.`}</p>
        <button class="btn primary block" data-act="bookMakeup" data-m="${d.m}" data-l="${l.id}">קביעת ההשלמה</button>`);
    },
    bookMakeup(d) {
      const m = S.makeups.find(x => x.id === d.m); const l = lesson(d.l);
      if (roster(l).free < 1) return;
      m.bookedLessonId = l.id;
      log('notify', `${me().name} קבעה השלמה`, `${group(l.groupId).name}, ${shortDay(l.date)}. נוספה לרשימת הנוכחות של השיעור.`);
      ui.stuMsg = `ההשלמה נקבעה ל${longDay(l.date)} ב${group(l.groupId).name}.`;
      closeSheet(); location.hash = '#/student/lessons'; flashClear();
    },
    stuPay() {
      const s0 = me();
      if (s0.firstDue && !(ui.pol && ui.pol.ok)) { ui.stuMsg = 'כדי לשלם צריך לאשר את מדיניות הביטולים.'; render(); return; }
      if (s0.firstDue) s0.policy = { date: todayIso(), version: S.settings.policyVersion };
      const opens = isLocked(s0);
      if (PAY.live) {
        s0.payOrder = { id: uid('cp'), amount: S.settings.cardPrice };
        ui.stuLive = {};
        livePayStart({ id: s0.payOrder.id, customer: { name: s0.name, phone: s0.phone, email: s0.email }, amount: s0.payOrder.amount, desc: `כרטיסייה, ${S.settings.cardSize} שיעורים` }, 'card', 0, ui.stuLive)
          .then(() => { render(); livePoll(ui.stuLive, id => A.stuPayDone(id, opens), () => render()); })
          .catch(() => render());
        render();
        return;
      }
      const inv = payCardOnline(s0);
      if (!inv) { ui.stuMsg = 'לא הצלחנו לאמת את התשלום. אפשר לנסות שוב.'; render(); return; }
      ui.stuMsg = opens ? `התשלום התקבל, והאזור האישי פתוח. חשבונית מס קבלה מס׳ ${inv} והקישור האישי נשלחו למייל.` : `התשלום התקבל. חשבונית מס קבלה מס׳ ${inv} נשלחה למייל.`;
      location.hash = opens ? '#/student/home' : '#/student/payments'; flashClear();
    },
    // תשלום אמיתי שאומת: אותה נקודת אישור כמו כל תשלום
    stuPayDone(paymentId, opens) {
      const res = confirmPayment(paymentId, 'check');
      ui.stuLive = null;
      if (res.result !== 'confirmed') { ui.stuMsg = res.result === 'already' ? 'התשלום כבר נרשם.' : 'לא הצלחנו לאמת את התשלום. אפשר לנסות שוב.'; render(); return; }
      const inv = (S.payments.find(p => p.paymentId === paymentId) || {}).invoice;
      ui.stuMsg = opens ? `התשלום התקבל, והאזור האישי פתוח. חשבונית מס קבלה מס׳ ${inv} והקישור האישי נשלחו למייל.` : `התשלום התקבל. חשבונית מס קבלה מס׳ ${inv} נשלחה למייל.`;
      location.hash = opens ? '#/student/home' : '#/student/payments'; flashClear();
    },
    stuFixedOpen() {
      const s = me();
      if (s.firstDue && !(ui.pol && ui.pol.ok)) { ui.stuMsg = 'כדי לשלם צריך לאשר את מדיניות הביטולים.'; render(); return; }
      window.open(CFG.fixedPayLink, '_blank', 'noopener');
      ui.stuFixed = s.id;
      log('sumit', 'מורנינג: נפתח קישור תשלום קבוע', `${s.name}, כרטיסייה, ${money(S.settings.cardPrice)}. בקישור קבוע המערכת לא מקבלת אישור על התשלום.`);
      render();
    },
    stuFixedPaid() {
      const s = me();
      if (s.firstDue) s.policy = { date: todayIso(), version: S.settings.policyVersion };
      const opens = isLocked(s);
      s.payOrder = { id: uid('cp'), amount: S.settings.cardPrice };
      const id = `fix_${token().slice(0, 10)}`;
      sumitStore().payments[id] = { id, ref: s.payOrder.id, amount: s.payOrder.amount, valid: true, doc: null, docId: null, customerId: '', unverified: true };
      ui.stuFixed = null;
      const res = confirmPayment(id, 'fixed');
      if (res.result !== 'confirmed') { ui.stuMsg = 'לא הצלחנו לרשום את התשלום. אפשר לנסות שוב.'; render(); return; }
      ui.stuMsg = opens ? 'התשלום נרשם, והאזור האישי פתוח. תמימה תאשר את התשלום אחרי בדיקה, והקבלה תישלח ממערכת הסליקה.' : 'התשלום נרשם. תמימה תאשר אותו אחרי בדיקה, והקבלה תישלח ממערכת הסליקה.';
      location.hash = opens ? '#/student/home' : '#/student/payments'; flashClear();
    },
    stuPayBack() { if (ui.stuFixed) { ui.stuFixed = null; render(); return; } if (ui.stuLive) { livePollStop(); ui.stuLive = null; render(); return; } history.back(); },
    stuPolicyApprove() {
      const s = me();
      if (!(ui.pol && ui.pol.ok)) return;
      s.policy = { date: todayIso(), version: S.settings.policyVersion };
      log('notify', `${s.name}: המדיניות אושרה`, `גרסה ${s.policy.version}, ${fullDate(s.policy.date)}.`);
      ui.stuMsg = 'המדיניות אושרה. תודה!'; location.hash = '#/student/payments'; flashClear();
    },
    // הודעת עזיבה: בלי שם ובלי סימון האישור אין שליחה
    stuLeaveSend() {
      const s = me(), f = ui.lv;
      f.err = ''; f.errField = '';
      if (String(f.name || '').trim().length < 2) { f.err = 'נא לכתוב שם מלא.'; f.errField = 'name'; ui.focusSel = '[data-bind="lv.name"]'; render(); return; }
      if (!f.ok) { f.err = 'נא לסמן "אני מאשר/ת את סיום הקורס".'; f.errField = 'ok'; render(); return; }
      const e = leaveEndDate(s);
      s.leave = { noticeDate: todayIso(), endDate: e.date, minDate: e.date, name: f.name.trim(), confirmedAt: new Date().toISOString(), version: S.settings.policyVersion, source: 'app', seen: false };
      leaveMailStudent(s);
      email('leaveAlert', toStudio(), `הודעת עזיבה: ${s.name}`, ['שלום תמימה,', `${s.name}: הודעת עזיבה נשלחה מהאפליקציה, עם אישור.`, `תאריך הסיום: ${longDay(s.leave.endDate)}.`], { cta: ['לכרטיס הסטודנט', siteUrl(`#/tamima/student/${s.id}`)] });
      log('notify', `הודעת עזיבה: ${s.name}`, `תאריך הסיום ${fullDate(s.leave.endDate)}. נשמרו התאריך, השם, רגע האישור וגרסת המדיניות.`);
      toast('הודעת עזיבה', `${s.name}, סיום ב${longDay(s.leave.endDate)}`);
      ui.lv = null; ui.stuMsg = `הודעת העזיבה נשלחה. תאריך הסיום: ${longDay(s.leave.endDate)}.`; render(); flashClear();
    },
    stuPrivacyOpen() { ui.pr = { type: '', note: '', err: '' }; render(); },
    stuPrivacyCancel() { ui.pr = null; render(); },
    stuPrivacySend() {
      const s = me(), f = ui.pr;
      if (!f.type) { f.err = 'נא לבחור עיון או מחיקה.'; render(); return; }
      if (!S.privacyRequests) S.privacyRequests = [];
      S.privacyRequests.push({ id: uid('pr'), targetKind: 'student', targetId: s.id, type: f.type, note: String(f.note || '').trim(), at: todayIso(), status: 'open' });
      email('privacyRequest', toStudio(), `בקשת ${f.type}: ${s.name}`, ['שלום תמימה,', `${s.name}: בקשה ל${f.type} של הפרטים האישיים.`, f.note ? `הערה: ${String(f.note).trim()}` : '', 'צריך לטפל בבקשה תוך 30 יום.'].filter(Boolean), { cta: ['לטיפול', siteUrl('#/tamima/home')] });
      log('notify', `בקשת פרטיות: ${s.name}`, `${f.type}. מופיעה אצל תמימה ב"ממתין לך עכשיו".`);
      audit(`בקשת ${f.type}`, 'סטודנט', s.name);
      toast('בקשת פרטיות', `${s.name}: ${f.type}`);
      ui.pr = null; ui.stuMsg = 'הבקשה נשלחה. תמימה תחזור אליך.'; render(); flashClear();
    },
    stuInvoice(d) {
      const p = S.payments.find(x => x.id === d.id);
      openSheet(() => invoiceDoc(p.invoice, me().name, 'כרטיסייה, 4 שיעורים', p.amount, p.date) + refundLines(p.invoice));
    }
  });
