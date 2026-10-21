/* site.js: האתר הציבורי ללקוחות בלבד. דף הבית, הזמנת סדנה, קורס, נגישות ופרטיות. */
'use strict';

  /* ================= עמודי חובה: הצהרת נגישות ומדיניות פרטיות ================= */
  // הודעה בעת איסוף מידע (סעיף 11 לחוק הגנת הפרטיות) והסכמה נפרדת לדיוור, שלא מסומנת מראש
  function consentBlock(root, obj, purpose) {
    return `<p class="notice" id="${root}-notice">${purpose} לא חובה לפי חוק, אבל בלי הפרטים לא נוכל לקבוע. <a href="#/client/privacy">מדיניות פרטיות</a></p>
      <label class="consent"><input type="checkbox" data-bind="${root}.marketing" ${obj.marketing ? 'checked' : ''}><span>אשמח לקבל עדכונים על סדנאות חדשות</span></label>`;
  }

  function accessibilityPage() {
    const f = ui.accForm;
    const form = f.sent
      ? `<p class="ok-line" role="status">תודה. הפנייה התקבלה, ותמימה תחזור אליך בהקדם.</p>`
      : `<div class="acc-form">
          <p class="muted small">כל השדות חובה.</p>
          <label class="field"><span>שם</span><input data-bind="accForm.name" value="${esc(f.name)}" required aria-required="true" autocomplete="name" ${f.errField === 'name' ? 'aria-invalid="true" aria-describedby="acc-err"' : ''}></label>
          <label class="field"><span>טלפון או מייל לחזרה</span><input data-bind="accForm.contact" value="${esc(f.contact)}" required aria-required="true" ${f.errField === 'contact' ? 'aria-invalid="true" aria-describedby="acc-err"' : ''}></label>
          <label class="field"><span>מה לא עבד?</span><textarea data-bind="accForm.text" rows="3" required aria-required="true" ${f.errField === 'text' ? 'aria-invalid="true" aria-describedby="acc-err"' : ''}>${esc(f.text)}</textarea></label>
          ${f.err ? `<p class="err" id="acc-err" role="alert">${esc(f.err)}</p>` : ''}
          <button class="btn primary" data-act="accSend">שליחה</button>
        </div>`;
    return `<a class="back" href="#/client">חזרה לאתר</a>
      <article class="doc">
        <span class="eyebrow">נגישות</span>
        <h1 class="display">הצהרת נגישות</h1>
        <p>אנחנו רוצים שכל אחד יוכל להזמין סדנה או להירשם לקורס בקלות. האתר נבנה לפי תקנות הנגישות לשירות והתקן הישראלי ת"י 5568.</p>

        <h2>מה אפשר לעשות באתר</h2>
        <ul class="doc-list">
          <li>להשתמש באתר עם מקלדת בלבד. האתר בנוי גם לעבודה עם קוראי מסך.</li>
          <li>להגדיל את הטקסט בדפדפן, והאתר נשאר קריא גם בטלפון.</li>
          <li>לעצור את התמונות הנעות בעמוד הבית.</li>
          <li>למלא טפסים עם הסבר ברור אם משהו חסר.</li>
        </ul>

        <h2>הגעה לסטודיו</h2>
        <p>צריכים התאמה בסדנה או בשיעור? ספרו לנו מראש ונשמח לתאם. מידע על הגישה לסטודיו, החניה והשירותים יתווסף כאן בקרוב.</p>

        <h2>נתקלתם בבעיה?</h2>
        <p>רכזת הנגישות היא תמימה, בעלת הסטודיו. אפשר לכתוב לה כאן:</p>
        ${form}
        <p class="muted small">עודכן: ${longDay(todayIso())}</p>
      </article>`;
  }

  function privacyPage() {
    return `<a class="back" href="#/client">חזרה לאתר</a>
      <article class="doc">
        <span class="eyebrow">פרטיות</span>
        <h1 class="display">מדיניות פרטיות</h1>
        <p>בקצרה: אנחנו מבקשים רק את מה שצריך כדי לקבוע סדנה או שיעור, ולא מעבירים את זה לאף אחד בשביל פרסום.</p>

        <h2>מה אנחנו מבקשים ולמה</h2>
        <ul class="doc-list">
          <li><b>בהזמנת סדנה:</b> שם, טלפון ומייל, כדי לקבוע את הסדנה ולשלוח אישור וחשבונית.</li>
          <li><b>בהרשמה לקורס:</b> שם וטלפון, כדי שתמימה תחזור אליך. בזמן הקורס נשמרים גם השיעורים, הכרטיסייה והתשלומים שלך.</li>
        </ul>
        <p>לא חובה לפי חוק למסור את הפרטים, אבל בלעדיהם לא נוכל לקבוע את ההזמנה.</p>

        <h2>תשלום</h2>
        <p>התשלום מתבצע בעמוד המאובטח של סאמיט. פרטי כרטיס האשראי לא מגיעים אלינו.</p>

        <h2>מי עוד רואה את הפרטים</h2>
        <p>רק תמימה, והשירותים שעוזרים לה לנהל את הסטודיו: סאמיט (תשלום וחשבונית) ו-Google (יומן הסטודיו). אם הזמנת דרך שותף, למשל "בסלון", הוא מעביר לנו את פרטי ההזמנה.</p>

        <h2>עדכונים במייל</h2>
        <p>נשלח עדכונים רק אם סימנת שמתאים לך, ותמיד אפשר להפסיק.</p>

        <h2>הזכויות שלך</h2>
        <p>אפשר לבקש לראות את הפרטים ששמורים עליך, לתקן אותם או למחוק אותם. פונים לתמימה, ונענה תוך 30 יום.</p>
        <p class="muted small">עודכן: ${longDay(todayIso())}</p>
      </article>`;
  }

  /* ================= אזור 1: לקוח ================= */
  const BOOK_IMG = { n: 'wheel-hands', slot: 'bowl-hand', details: 'cups-hands', summary: 'bowls-green', pay: 'plate-apron', done: 'bowls-raise' };
  const BOOK_CAPTION = { n: 'שעתיים על האובניים, בקצב שלכם', slot: 'כל כלי יוצא קצת אחר', details: 'עוד רגע אתם בסטודיו', summary: 'שני כלים לכל משתתף', pay: 'כמעט שם', done: 'נתראה בסטודיו' };

  function siteHeader(overlay) {
    return `<header class="site-head ${overlay ? 'overlay' : ''}" ${overlay ? 'data-photo-bg="0.66"' : ''}>
      <a class="brand" href="#/client"><span class="logo" aria-hidden="true">ת</span><span><b>הסטודיו של תמימה</b><small>קרמיקה · גבעת רם</small></span></a>
      <nav class="site-nav"><a href="#/client/course">קורס שבועי</a><a class="pill" href="#/client/workshop" data-act="startBooking">הזמנת סדנה</a></nav>
    </header>`;
  }

  function clientView(r) {
    const home = !r.page;
    let body;
    if (r.page === 'workshop') body = bookingView();
    else if (r.page === 'course') body = courseView();
    else if (r.page === 'accessibility') body = accessibilityPage();
    else if (r.page === 'privacy') body = privacyPage();
    else if (r.page === 'booking') body = myBookingView(r.param);
    else body = clientHome();
    return `<div class="site ${home ? 'is-home' : ''}">
      ${siteHeader(home)}
      ${home ? `<main id="main" tabindex="-1">${body}</main>` : `<main id="main" tabindex="-1" class="wrap wide">${body}</main>`}
      <footer class="site-foot">
        <div class="foot-inner">
          <div class="brand light"><span class="logo" aria-hidden="true">ת</span><span><b>הסטודיו של תמימה</b><small>סטודיו לקרמיקה</small></span></div>
          <div><small>איפה</small><p>${esc(S.content.address)}</p></div>
          <div><small>טלפון</small><p><a href="tel:${esc(String(S.settings.whatsapp || '').replace(/\D/g, ''))}" dir="ltr">${esc(S.settings.whatsapp || '')}</a></p></div>
          <div><small>חוגים</small><p>${esc(classHoursText())}</p></div>
        </div>
        <nav class="foot-links" aria-label="מידע משפטי"><a href="#/client/accessibility">הצהרת נגישות</a><a href="#/client/privacy">מדיניות פרטיות</a></nav>
      </footer>
    </div>`;
  }

  function clientHome() {
    const c = S.content;
    const gallery = c.gallery;
    const strip = gallery.concat(gallery).map((g, i) => `<figure><img src="${IMGS(g)}" alt="" loading="lazy" ${i >= gallery.length ? 'aria-hidden="true"' : ''}></figure>`).join('');
    return `<section class="hero" data-photo-bg="0.66">
        <div class="hero-bg"><img src="${IMG(c.heroImage)}" alt="${esc(PHOTOS[c.heroImage] || '')}"></div>
        <div class="hero-inner">
          <span class="eyebrow light">${esc(c.heroEyebrow)}</span>
          <h1>${esc(c.heroTitle)}<br><em>${esc(c.heroAccent)}</em></h1>
          <p>${esc(c.heroText)}</p>
          <div class="hero-cta">
            <a class="btn primary lg" href="#/client/workshop" data-act="startBooking">הזמנת ${esc(c.workshopTitle)}</a>
            <a class="btn glass lg" href="#/client/course">לקורס השבועי</a>
          </div>
        </div>
        <span class="scroll-cue" aria-hidden="true"></span>
      </section>

      <section class="section wrap wide">
        <div class="sec-head reveal"><span class="eyebrow">שתי דרכים להתחיל</span><h2 class="display">מה מתאים לכם?</h2></div>
        <div class="offer-grid">
          <a class="offer reveal" href="#/client/workshop" data-act="startBooking">
            <div class="offer-img"><img src="${IMGS(c.workshopImage)}" alt="${esc(PHOTOS[c.workshopImage] || '')}" loading="lazy"></div>
            <div class="offer-body">
              <span class="tag">חוויה חד פעמית</span>
              <h3>${esc(c.workshopTitle)}</h3>
              <ul class="facts"><li>שעתיים בסטודיו</li><li>2 עד 6 משתתפים</li><li>שני כלים לכל משתתף</li></ul>
              <div class="offer-foot"><span class="price">החל מ-${money(S.settings.pricePer)} <small>למשתתף</small></span><span class="arrow">לבחירת מועד</span></div>
            </div>
          </a>
          <a class="offer reveal" href="#/client/course">
            <div class="offer-img"><img src="${IMGS(c.courseImage)}" alt="${esc(PHOTOS[c.courseImage] || '')}" loading="lazy"></div>
            <div class="offer-body">
              <span class="tag olive">כל שבוע</span>
              <h3>${esc(c.courseTitle)}</h3>
              <ul class="facts"><li>${esc(classDaysText())}</li><li>${esc(classHoursText().split(' · ')[1] || 'לפי קבוצה')}</li><li>קבוצות קטנות</li></ul>
              <div class="offer-foot"><span class="price">${money(S.settings.cardPrice)} <small>ל-4 שיעורים</small></span><span class="arrow">לקבוצות</span></div>
            </div>
          </a>
        </div>
      </section>

      <section class="section studio">
        <div class="wrap wide studio-grid">
          <div class="collage reveal">
            <img class="c1" src="${IMGS('tamima-stack')}" alt="תמימה בסטודיו" loading="lazy">
            <img class="c2" src="${IMGS('bowls-green')}" alt="קערות בגלזורה ירוקה" loading="lazy">
            <img class="c3" src="${IMGS('cups-hands')}" alt="כוסות קרמיקה" loading="lazy">
          </div>
          <div class="studio-text reveal">
            <span class="eyebrow">הסטודיו</span>
            <h2 class="display">${esc(c.studioTitle)}</h2>
            <p>${esc(c.studioText)}</p>
            <ol class="how">
              <li><b>בוחרים מועד</b><span>סדנה או קבוצה שבועית, ישירות באתר.</span></li>
              <li><b>מגיעים ויוצרים</b><span>תמימה מלווה צעד אחר צעד, גם בפעם הראשונה.</span></li>
              <li><b>אוספים את הכלים</b><span>אחרי הייבוש והשריפה בתנור, הם שלכם.</span></li>
            </ol>
          </div>
        </div>
      </section>

      <section class="marquee-wrap" aria-label="תמונות מהסטודיו"><div class="marquee"><div class="marquee-track">${strip}</div></div><button class="motion-btn inline" data-act="toggleMotion" aria-pressed="${!!ui.motionOff}" aria-label="${ui.motionOff ? 'הפעלת הגלריה' : 'עצירת הגלריה'}">${ui.motionOff ? '▶' : '❚❚'}</button></section>

      <section class="section wrap wide">
        <div class="cta-band reveal">
          <img src="${IMGS('vase-glaze')}" alt="" loading="lazy">
          <div>
            <h2 class="display">${esc(c.ctaTitle)}</h2>
            <p>${esc(c.ctaText)}</p>
          </div>
          <a class="btn primary lg" href="#/client/workshop" data-act="startBooking">לבחירת מועד</a>
        </div>
      </section>`;
  }

  function bookLayout(inner) {
    const k = bk.step;
    return `<div class="book-layout">
      <div class="book-main">${inner}</div>
      <aside class="book-aside"><figure class="book-photo" data-k="${k}" data-photo-bg="0.75"><img src="${IMG(BOOK_IMG[k] || 'wheel-hands')}" alt=""><figcaption>${BOOK_CAPTION[k] || ''}</figcaption></figure></aside>
    </div>`;
  }

  // ספירה לאחור של המועד השמור במסך התשלום. כשהזמן נגמר, המועד משתחרר
  // קופון שהופעל, והסכום אחריו (לפחות 1 ₪). בסליקה האמיתית השרת מחשב את אותו סכום בעצמו
  const bkCoupon = () => (bk.coupon && (S.settings.coupons || []).find(c => c.code === bk.coupon)) || null;
  const bkTotal = () => { const c = bkCoupon(), p = price(bk.n); return c ? Math.max(1, p - c.off) : p; };
  const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  let holdTimer = null;
  function startHoldTimer() {
    if (holdTimer) return;
    holdTimer = setInterval(() => {
      const h = pendingOrder(bk.hold);
      if (bk.step !== 'pay' || route().page !== 'workshop') { clearInterval(holdTimer); holdTimer = null; if (bk.step === 'pay' && !h) A.bkExpire(); return; }
      if (!h) { clearInterval(holdTimer); holdTimer = null; livePollStop(); bk.live = null; A.bkExpire(); return; }
      // בזמן שהלקוח משלם בלשונית של הסליקה, המועד ממשיך להישמר לו (עד 15 דקות, ואז הבדיקה נעצרת)
      if (bk.live && !bk.live.error) touchHold(h.id);
      const el = document.getElementById('hold-left');
      if (el) el.textContent = mmss(h.holdUntil - now().getTime());
    }, 1000);
  }

  function bookingView() {
    const list = [['slot', 'משתתפים ומועד'], ['details', 'פרטים'], ['summary', 'סיכום'], ['pay', 'תשלום']];
    const top = bk.step === 'done' ? '' : `<a class="back" href="#/client">חזרה לאתר</a><span class="eyebrow">${esc(S.content.workshopTitle)} · שעתיים</span><h1 class="display">הזמנת סדנה</h1>${steps(list, bk.step === 'confirming' ? 'pay' : bk.step)}`;
    const err = bk.err ? `<p class="err" id="bk-err" role="alert">${esc(bk.err)}</p>` : '';
    const inv = f => (bk.errField === f ? 'aria-invalid="true" aria-describedby="bk-err"' : '');
    let body = '';

    if (bk.step === 'slot') {
      const days = [];
      for (let i = 0; i <= G.channels.get(HOME).horizonDays; i++) {
        const date = iso(addDays(startOfToday(), i));
        const slots = freeSlots(date, bk.hold);
        if (slots.length) days.push({ date, slots });
      }
      if (!bk.date || !days.some(d => d.date === bk.date)) { bk.date = days.length ? days[0].date : null; bk.time = null; }
      const cur = days.find(d => d.date === bk.date);
      body = card(`<h2>כמה משתתפים?</h2>
        <div class="n-row">
          <div class="stepper">
            <button data-act="bkN" data-d="-1" ${bk.n <= 2 ? 'disabled' : ''} aria-label="פחות משתתפים">−</button>
            <b aria-live="polite">${bk.n}</b>
            <button data-act="bkN" data-d="1" ${bk.n >= 6 ? 'disabled' : ''} aria-label="יותר משתתפים">+</button>
          </div>
          <p class="price-line">${bk.n === 2 ? `זוג: ${money(price(2))}` : `${bk.n} × ${money(S.settings.pricePer)}`} <b>סה״כ ${money(price(bk.n))}</b></p>
        </div>
        <p class="muted small">שעתיים בסטודיו, שני כלים לכל משתתף. 7 עד 12 משתתפים? צרו קשר לתיאום ישיר.</p>
        <h2>בחירת יום</h2>
        ${dayPlan(days.map(d => d.date), bk.date)}
        ${cur ? `<h2>שעה, ${longDay(cur.date)}</h2>
        <div class="slots">${cur.slots.map(t => `<button class="slot ${t === bk.time ? 'on' : ''}" data-act="bkTime" data-t="${t}">${t} עד ${endOf(t)}</button>`).join('')}</div>` : empty('אין מועדים פנויים בשבועות הקרובים.')}
        ${err}
        <button class="btn primary block" data-act="bkGo" data-s="details" ${bk.time ? '' : 'disabled'}>להמשך</button>`);
    }

    if (bk.step === 'details') {
      body = card(`<h2>פרטים אישיים</h2>
        <p class="muted small">כל השדות חובה.</p>
        <label class="field"><span>שם מלא</span><input data-bind="bk.name" value="${esc(bk.name)}" autocomplete="name" required aria-required="true" ${inv('name')}></label>
        <label class="field"><span>טלפון</span><input data-bind="bk.phone" value="${esc(bk.phone)}" type="tel" inputmode="tel" autocomplete="tel" placeholder="050-0000000" required aria-required="true" ${inv('phone')}></label>
        <label class="field"><span>מייל <small class="hint-inline">לכאן יישלחו האישור והחשבונית</small></span><input data-bind="bk.email" value="${esc(bk.email)}" type="email" inputmode="email" autocomplete="email" placeholder="name@example.com" required aria-required="true" ${inv('email')}></label>
        ${consentBlock('bk', bk, 'נשתמש בפרטים רק כדי לקבוע את הסדנה ולשלוח אישור וחשבונית.')}
        ${err}
        <button class="btn primary block" data-act="bkDetails">לסיכום ההזמנה</button>
        <button class="btn ghost block" data-act="bkGo" data-s="slot">חזרה</button>`);
    }

    if (bk.step === 'summary') {
      body = card(`<h2>סיכום ההזמנה</h2>
        <dl class="kv">
          <dt>סדנה</dt><dd>סדנת היכרות, שעתיים</dd>
          <dt>תאריך</dt><dd>${longDay(bk.date)}</dd>
          <dt>שעה</dt><dd>${bk.time} עד ${endOf(bk.time)}</dd>
          <dt>משתתפים</dt><dd>${bk.n}</dd>
          <dt>שם</dt><dd>${esc(bk.name)}</dd>
          <dt>מיקום</dt><dd>${esc(S.content.address)}</dd>
          <dt>סכום</dt><dd>${bkCoupon() ? `<s>${money(price(bk.n))}</s>` : `<b>${money(price(bk.n))}</b>`}</dd>
          ${bkCoupon() ? `<dt>קופון ${esc(bkCoupon().code)}</dt><dd>${money(bkTotal() - price(bk.n))}</dd><dt>לתשלום</dt><dd><b>${money(bkTotal())}</b></dd>` : ''}
        </dl>
        <div class="coupon-row"><label class="field"><span>קוד קופון</span><input class="txt" dir="ltr" data-bind="bk.couponIn" value="${esc(bk.couponIn || '')}" autocomplete="off"></label><button class="btn ghost small" data-act="bkCouponApply">${bkCoupon() ? 'החלפה' : 'הפעלה'}</button></div>${bk.couponMsg ? `<p class="${bk.couponOk ? 'ok-line small' : 'err'}" role="status">${esc(bk.couponMsg)}</p>` : ''}
        <div class="policy">ביטול או שינוי מועד עד ${S.settings.workshopCancelHours} שעות לפני הסדנה. ביטול מאוחר יותר אינו כולל החזר.</div>
        ${err}
        <button class="btn primary block" data-act="bkToPay">לתשלום ${money(bkTotal())}</button>
        <button class="btn ghost block" data-act="bkGo" data-s="details">חזרה</button>`);
    }

    if (bk.step === 'pay') {
      const h = pendingOrder(bk.hold);
      body = (h ? `<p class="hold-note">ההזמנה ממתינה לתשלום. המועד שמור לכם עוד <b id="hold-left">${mmss(h.holdUntil - now().getTime())}</b> דקות</p>` : '') + err
        + (bk.live ? liveWaitView(bk.live, 'bkPayBack') : sumitView(h ? h.amount : bkTotal(), `סדנת היכרות, ${bk.n} משתתפים, ${shortDay(bk.date)} ${bk.time}`, 'bkPay', 'bkPayBack', 'bkPayFail'));
      startHoldTimer();
    }
    if (bk.step === 'confirming') body = card(`<div class="confirming" role="status"><span class="spin" aria-hidden="true"></span><h2>מאשרים את התשלום</h2><p class="muted">רגע, ההזמנה נסגרת.</p></div>`);

    if (bk.step === 'done') {
      const w = workshop(bk.done);
      body = card(`<div class="done-ic">✓</div>
        <h1 class="center">ההזמנה אושרה</h1>
        <p class="center">אישור ההזמנה והקבלה נשלחו למייל <b>${esc(w.customer.email)}</b>.</p>
        <dl class="kv">
          <dt>תאריך</dt><dd>${longDay(w.date)}</dd>
          <dt>שעה</dt><dd>${w.time} עד ${endOf(w.time)}</dd>
          <dt>משתתפים</dt><dd>${w.n}</dd>
          <dt>שולם</dt><dd>${money(w.amount)}</dd>
          <dt>מיקום</dt><dd>${esc(S.content.address)}</dd>
        </dl>
        <button class="btn primary block" data-act="ics" data-id="${w.id}">הוספה ליומן</button>
        <a class="btn ghost block" href="${PORTAL ? `?b=${w.k}#/client/booking` : `#/client/booking/${w.id}`}">ניהול ההזמנה</a>
        <button class="btn ghost block" data-act="bkRestart">חזרה לאתר</button>`, 'done');
    }
    return bookLayout(top + `<div class="step-body" data-step="${bk.step}">${body}</div>`);
  }

  /* ================= ההזמנה שלי: קישור אישי של לקוח מהמייל ================= */
  function myBooking(param) {
    if (PORTAL) return PORTAL.b ? S.workshops.find(w => w.k === PORTAL.b && !['pending', 'expired'].includes(w.status)) : null;
    return workshop(param) || [...S.workshops].reverse().find(w => isOwn(w) && w.invoice);
  }
  const waLink = text => { const d = normPhone(S.settings.whatsapp); return `https://wa.me/${d.startsWith('0') ? '972' + d.slice(1) : d}?text=${encodeURIComponent(text)}`; };
  function myBookingView(param) {
    const w = myBooking(param);
    if (!w) return `<h1 class="display">ההזמנה שלי</h1>${card(ui.portalWait ? '<p class="center">טוען את ההזמנה...</p>' : '<h2>הקישור לא זמין</h2><p>הקישור לא תקין, או שההזמנה לא נמצאה. אפשר לפנות לתמימה.</p>')}`;
    if (!ui.cb || ui.cb.id !== w.id) ui.cb = { id: w.id, mode: '', date: null, time: null, msg: '' };
    const f = ui.cb;
    const H = S.settings.workshopCancelHours;
    const hrs = hoursTo(w), early = hrs >= H;
    const details = `<dl class="kv"><dt>תאריך</dt><dd>${longDay(w.date)}</dd><dt>שעה</dt><dd>${w.time} עד ${endOf(w.time)}</dd><dt>משתתפים</dt><dd>${w.n}</dd><dt>שולם</dt><dd>${money(w.amount)}</dd><dt>מיקום</dt><dd>${esc(S.content.address)}</dd></dl>
      ${w.invoice ? `<div class="pay-row"><span>חשבונית מס קבלה מס׳ ${w.invoice}</span>${pdfBtn(w.invoice, 'פתיחת החשבונית')}${refundLines(w.invoice)}</div>` : ''}`;
    const msg = f.msg ? `<p class="ok-line" role="status">${esc(f.msg)}</p>` : '';
    let act = '';
    if (w.status === 'cancelled') act = `<p>${openRefundCases().some(x => x.wsId === w.id) ? 'הביטול התקבל. תמימה תעדכן אותך לגבי ההחזר.' : 'ההזמנה בוטלה.'}</p>`;
    else if (hrs <= 0) act = '<p>הסדנה כבר התקיימה. תודה שהגעתם!</p>';
    else if (f.mode === 'move' && early) {
      const days = [];
      for (let i = 0; i <= G.channels.get(HOME).horizonDays; i++) {
        const d = iso(addDays(startOfToday(), i));
        const sl = freeSlots(d).filter(t => at(d, t) - now() >= H * 36e5);
        if (sl.length) days.push({ date: d, slots: sl });
      }
      if (!f.date || !days.some(x => x.date === f.date)) { f.date = days.length ? days[0].date : null; f.time = null; }
      const cur = days.find(x => x.date === f.date);
      act = `<h2>הזזה למועד אחר</h2>${dayPlan(days.map(x => x.date), f.date, 'cbDate')}
        ${cur ? `<h3>שעה, ${longDay(cur.date)}</h3><div class="slots">${cur.slots.map(t => `<button class="slot ${t === f.time ? 'on' : ''}" data-act="cbTime" data-t="${t}">${t} עד ${endOf(t)}</button>`).join('')}</div>` : empty('אין כרגע מועדים פנויים.')}
        <button class="btn primary block" data-act="cbMoveDo" ${f.time ? '' : 'disabled'}>הזזה למועד הזה</button><button class="btn ghost block" data-act="cbMode" data-m="">חזרה</button>`;
    } else if (f.mode === 'cancel' && early) {
      act = `<h2>לבטל את ההזמנה?</h2><p>המועד יתפנה, ותמימה תעדכן אותך לגבי ההחזר.</p>
        <button class="btn danger block" data-act="cbCancelDo">ביטול ההזמנה</button><button class="btn ghost block" data-act="cbMode" data-m="">השארת ההזמנה</button>`;
    } else if (f.mode === 'late' && !early) {
      const text = `היי תמימה, אני ${w.customer.name}, הזמנתי סדנה ב-${dmy(w.date)}.${parse(w.date).getFullYear()} בשעה ${w.time} ורוצה לבדוק אפשרות ביטול.`;
      act = `<div class="policy warn">ביטול בפחות מ-${H} שעות אינו כולל החזר. לבירור אפשרויות, דברו עם תמימה.</div>
        ${w.lateRequest ? '<p class="ok-line" role="status">הפנייה נשלחה לתמימה. ההזמנה נשארת בתוקף עד שתמימה תחליט.</p>' : ''}<a class="btn primary block" href="${esc(waLink(text))}" target="_blank" rel="noopener" data-act="cbLateSend">שליחת הודעה לתמימה בוואטסאפ</a>
        <p class="muted small">ההזמנה נשארת בתוקף עד שתמימה תחליט.</p><button class="btn ghost block" data-act="cbMode" data-m="">חזרה</button>`;
    } else if (early) {
      act = `<p class="muted small">ביטול או שינוי מועד עד ${H} שעות לפני הסדנה. ביטול מאוחר יותר אינו כולל החזר.</p>
        <button class="btn primary block" data-act="cbMode" data-m="move">הזזה למועד אחר</button><button class="btn ghost block" data-act="cbMode" data-m="cancel">ביטול ההזמנה</button>`;
    } else {
      act = `<p class="muted small">שינוי מועד אפשרי עד ${H} שעות לפני הסדנה.</p><button class="btn ghost block" data-act="cbMode" data-m="late">ביטול</button>`;
    }
    return `<h1 class="display">ההזמנה שלי</h1>${card(`<h2>סדנת קרמיקה${w.status === 'cancelled' ? ' · בוטלה' : ''}</h2>${details}`)}${card(msg + act)}`;
  }

  function courseView() {
    const c = S.content;
    const groupsHtml = activeGroups().map(g => {
      const free = Math.max(0, g.max - groupStudents(g.id).length);
      return `<div class="group-card">
        <div class="gday"><span>${DAYS_SHORT[g.day]}</span></div><div class="ginfo"><b>יום ${DAYS[g.day]}</b><small>${g.start} עד ${g.end}</small></div>
        ${free ? chip(free === 1 ? 'נשאר מקום אחד' : `נשארו ${free} מקומות`, 'ok') : chip('הקבוצה מלאה כרגע', 'muted')}
      </div>`;
    }).join('');
    const form = lead.sent
      ? card(`<div class="done-ic">✓</div><h2 class="center">תודה, ${esc(lead.name.split(' ')[0])}!</h2><p class="center">תמימה תחזור אליכם בהקדם.</p><button class="btn ghost block" data-act="leadReset">חזרה</button>`, 'done')
      : card(`<h2>השאירו פרטים ותמימה תחזור אליכם</h2>
        <label class="field"><span>שם מלא</span><input data-bind="lead.name" value="${esc(lead.name)}" autocomplete="name" required aria-required="true" ${lead.errField === 'name' ? 'aria-invalid="true" aria-describedby="lead-err"' : ''}></label>
        <label class="field"><span>טלפון</span><input data-bind="lead.phone" value="${esc(lead.phone)}" type="tel" inputmode="tel" autocomplete="tel" placeholder="050-0000000" required aria-required="true" ${lead.errField === 'phone' ? 'aria-invalid="true" aria-describedby="lead-err"' : ''}></label>
        <label class="field"><span>מייל <small class="hint-inline">לכאן יישלחו פרטי הקורס</small></span><input data-bind="lead.email" value="${esc(lead.email)}" type="email" inputmode="email" autocomplete="email" placeholder="name@example.com" required aria-required="true" ${lead.errField === 'email' ? 'aria-invalid="true" aria-describedby="lead-err"' : ''}></label>
        <label class="field"><span>קבוצה מועדפת</span>
          <select data-bind="lead.group"><option value="">לא משנה</option>${activeGroups().map(g => `<option value="${g.id}" ${lead.group === g.id ? 'selected' : ''}>יום ${DAYS[g.day]}</option>`).join('')}</select></label>
        ${lead.err ? `<p class="err" id="lead-err" role="alert">${esc(lead.err)}</p>` : ''}
        ${consentBlock('lead', lead, 'נשתמש בפרטים רק כדי לחזור אליך לגבי הקורס.')}
        <button class="btn primary block" data-act="leadSend">שליחה</button>`);
    return `<a class="back" href="#/client">חזרה לאתר</a>
      <section class="page-banner" data-photo-bg="0.66"><img src="${IMG(c.courseImage)}" alt=""><div><span class="eyebrow light">כל שבוע, אותה קבוצה</span><h1 class="display">${esc(c.courseTitle)}</h1><p>${esc(c.courseText)} מחיר הכרטיסייה: ${money(S.settings.cardPrice)}.</p></div></section>
      <div class="course-grid"><div>${card(`<h2>הקבוצות</h2>${groupsHtml}`)}</div><div>${form}</div></div>`;
  }

  Object.assign(A, {
    // לקוח
    startBooking() { releaseHold(bk.hold); bk = { hold: null, step: 'slot', n: bk.n || 2, date: null, time: null, name: '', phone: '', email: '', err: '', errField: '', marketing: false, done: null }; },
    bkN(d) { bk.n = Math.min(6, Math.max(2, bk.n + Number(d.d))); render(); },
    bkGo(d) {
      if (d.s === 'slot') { releaseHold(bk.hold); bk.hold = null; }
      // "להמשך" לפרטים: המועד נשמר ללקוח, ותמימה רואה אותו ביומן כ"בתהליך הזמנה"
      if (d.s === 'details' && !pendingOrder(bk.hold)) {
        if (!freeSlots(bk.date, bk.hold).includes(bk.time)) { bk.time = null; bk.err = 'המועד שבחרתם נתפס בינתיים. בחרו מועד אחר.'; render(); return; }
        bk.hold = createOrder({ date: bk.date, time: bk.time, n: bk.n, customer: { name: '', phone: '', email: '' } }, bk.hold).id;
      }
      touchHold(bk.hold);
      bk.err = ''; bk.step = d.s; render(); scrollTop();
    },
    bkDate(d) { bk.date = d.date; bk.time = null; render(); },
    bkTime(d) { bk.time = d.t; render(); },
    bkDetails() {
      const phone = bk.phone.replace(/[\s-]/g, '');
      bk.errField = '';
      if (bk.name.trim().length < 2) { bk.err = 'נא למלא שם מלא.'; bk.errField = 'name'; }
      else if (!/^0\d{8,9}$/.test(phone)) { bk.err = 'נא למלא מספר טלפון תקין, למשל 050-1234567.'; bk.errField = 'phone'; }
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bk.email.trim())) { bk.err = 'נא למלא כתובת מייל תקינה, למשל name@example.com.'; bk.errField = 'email'; }
      else { bk.err = ''; bk.step = 'summary'; }
      if (bk.errField) ui.focusSel = `[data-bind="bk.${bk.errField}"]`;
      render(); if (!bk.errField) scrollTop();
    },
    // "לתשלום": נוצרת הזמנה בסטטוס "ממתין לתשלום", ונוצר דף תשלום בסאמיט
    bkToPay() {
      const w = pendingOrder(bk.hold);
      if (!w) return A.bkExpire();
      Object.assign(w.customer, { name: bk.name.trim(), phone: bk.phone.trim(), email: bk.email.trim() });
      touchHold(w.id);
      // קופון: הסכום של ההזמנה עצמה משתנה, כך שהסליקה, הקבלה, המיילים וכרטיס הלקוח מראים את מה ששולם
      const cp = bkCoupon();
      w.amount = bkTotal();
      if (cp) w.coupon = { code: cp.code, off: price(w.n) - w.amount }; else delete w.coupon;
      // לקוח מוכר (לפי טלפון) נשלח עם המזהה שלו בסאמיט, כדי שהקבלה תירשם על אותו כרטיס
      const known = (S.customers || []).find(k => k.phones.includes(normPhone(w.customer.phone)));
      // סליקה אמיתית: דף תשלום להזמנה הזו נפתח בלשונית חדשה, וההזמנה מתעדכנת לבד כשהתשלום מאומת
      if (PAY.live) {
        if (!stillBookable(w)) { expireOrder(w.id, true); bk.hold = null; bk.step = 'slot'; bk.time = null; bk.err = 'המועד כבר לא זמין, ולא בוצע חיוב. בחרו מועד אחר.'; render(); scrollTop(); return; }
        bk.live = {};
        bk.err = ''; bk.step = 'pay';
        livePayStart({ id: w.id, customer: w.customer, amount: w.amount, desc: wsDesc(w), coupon: cp ? cp.code : '' }, 'workshop', w.n, bk.live)
          .then(() => { render(); livePoll(bk.live, id => { touchHold(w.id); A.bkFinish(id, ['check']); }, () => { touchHold(w.id); render(); }); })
          .catch(() => render());
        render(); scrollTop();
        return;
      }
      sumitBeginRedirect({ id: w.id, customer: w.customer, sumitId: sumitIdOf(known), amount: w.amount, desc: wsDesc(w) });
      bk.err = ''; bk.step = 'pay';
      render(); scrollTop();
    },
    bkCouponApply() {
      const code = String(bk.couponIn || '').trim().toUpperCase();
      const c = (S.settings.coupons || []).find(x => x.code === code);
      if (!code) { bk.coupon = null; bk.couponMsg = ''; }
      else if (!c) { bk.couponOk = false; bk.couponMsg = 'הקוד לא תקין.'; }
      else { bk.coupon = c.code; bk.couponIn = c.code; bk.couponOk = true; bk.couponMsg = `הקופון הופעל. לתשלום: ${money(bkTotal())}.`; }
      render();
    },
    bkPayBack() { livePollStop(); bk.live = null; bk.err = ''; bk.step = 'summary'; render(); },
    // עברו 10 דקות בלי פעילות: ההזמנה פגה, המועד משתחרר, והלקוח חוזר לבחירת מועד
    bkExpire() {
      expireOrder(bk.hold); bk.hold = null;
      bk.step = 'slot'; bk.time = null; bk.err = `עברו ${HOLD_MIN} דקות, והמועד שוחרר. אפשר לבחור מועד שוב.`;
      render(); scrollTop();
    },
    // תשלום שנכשל או בוטל בדף של סאמיט: ההזמנה נשארת "ממתין לתשלום", ואפשר לנסות שוב
    bkPayFail() {
      const w = pendingOrder(bk.hold);
      if (!w) return A.bkExpire();
      sumitCustomerFailed({ desc: wsDesc(w) });
      bk.err = 'התשלום לא עבר. ההזמנה עדיין שמורה, ואפשר לנסות שוב.';
      render();
    },
    bkPay() {
      const w0 = pendingOrder(bk.hold);
      if (!w0) return A.bkExpire();
      // בדיקה חוזרת רגע לפני החיוב: אם המועד כבר לא זמין, הלקוח לא מחויב
      if (!stillBookable(w0)) {
        expireOrder(w0.id, true); bk.hold = null; bk.step = 'slot'; bk.time = null;
        bk.err = 'המועד כבר לא זמין, ולא בוצע חיוב. בחרו מועד אחר.'; render(); scrollTop(); return;
      }
      // הלקוח משלם בדף של סאמיט. סאמיט מפיק חשבונית מס קבלה, שולח הודעת שרת (IPN), ומחזיר את הלקוח לאתר עם og-paymentid
      const known = (S.customers || []).find(k => k.phones.includes(normPhone(w0.customer.phone)));
      const back = sumitCustomerPaid({ id: w0.id, amount: w0.amount, sumitId: sumitIdOf(known) });
      bk.err = ''; bk.step = 'confirming'; render(); scrollTop();
      // "שולם" רק אחרי אימות מול סאמיט. שתי הדרכים מגיעות לאותו אישור, ומה שמגיע שני מקבל "כבר אושר"
      setTimeout(() => {
        const order = sumitStore().ipnFirst ? ['ipn', 'return'] : ['return', 'ipn'];
        sumitStore().ipnFirst = false;
        A.bkFinish(back['og-paymentid'], order);
      }, 1200);
    },
    /* אחרי תשלום: אישור מול הספק, ואז מייל אחד ללקוח, הודעה לתמימה ומסך "ההזמנה אושרה".
       vias: הדרכים שהגיעו לאישור (בדמו: החזרה לאתר והודעת השרת). בסליקה האמיתית: הבדיקה של השרת מול הספק */
    bkFinish(paymentId, order = ['return']) {
      {
        const res = order.map(via => confirmPayment(paymentId, via));
        if (res.some(x => x.result === 'already')) log('sumit', 'אישור כפול נעצר', `${order[1] === 'ipn' ? 'הודעת השרת מסאמיט' : 'החזרה לאתר'} הגיעה אחרי שההזמנה כבר אושרה. לא נוצרה הזמנה שנייה, ולא נשלח מייל שני.`);
        const w = (res.find(x => x.result === 'confirmed') || {}).w;
        if (!w) { bk.step = 'pay'; bk.err = 'לא הצלחנו לאמת את התשלום. אפשר לנסות שוב.'; render(); return; }
        bk.live = null;
        bk.hold = null;
        email('booking', toCustomer(w), `הסדנה נקבעה: ${shortDay(w.date)} ${w.time}`, [`שלום ${w.customer.name.split(' ')[0]},`, `הסדנה שלכם נקבעה ל${longDay(w.date)}, ${w.time} עד ${endOf(w.time)}.`, `${w.n} משתתפים · שולם ${money(w.amount)}.`, `הכתובת: ${S.content.address}.`, `חשבונית מס קבלה מס׳ ${w.invoice} מצורפת.`, `ביטול או שינוי מועד עד ${S.settings.workshopCancelHours} שעות לפני הסדנה, בקישור למטה. ביטול מאוחר יותר אינו כולל החזר.`, 'נתראה, תמימה'], { extra: receiptMailHtml(w.invoice, w.customer.name, wsDesc(w), w.amount, w.paidAt) + receiptLinkHtml(w.receiptUrl), cta: ['לניהול ההזמנה', bookingUrl(w)] });
        email('newBooking', toStudio(), `הזמנה חדשה: ${w.customer.name}, ${shortDay(w.date)} ${w.time}`, [`${w.customer.name}: הזמנת סדנה מהאתר.`, `${longDay(w.date)}, ${w.time} · ${w.n} משתתפים · ${money(w.amount)}.`, `טלפון: ${w.customer.phone}`], { cta: ['לסדנאות', siteUrl('#/tamima/workshops')] });
        log('notify', 'הזמנה חדשה נכנסה לדשבורד', `סדנה מהאתר, ${w.customer.name}, ${w.n} משתתפים, ${shortDay(w.date)} ${w.time}.`);
        // הסכמה לדיוור: נשמרת בכרטיס הלקוח עם התאריך
        if (bk.marketing) { const cu = customerOf(w); if (cu) Object.assign(cu, { marketing: true, marketingAt: todayIso() }); }
        bk.done = w.id; bk.step = 'done';
        render(); scrollTop();
        toast('הזמנה חדשה מהאתר', `${w.customer.name}, ${w.n} משתתפים, ${shortDay(w.date)} ${w.time}`);
      }
    },
    // ההזמנה שלי
    cbLateSend() {
      const w = workshop(ui.cb.id);
      if (!w || (w.lateRequest && w.lateRequest.status === 'open')) return;
      w.lateRequest = { at: new Date().toISOString(), status: 'open' };
      email('lateRequest', toStudio(), `פנייה מאוחרת: ${w.customer.name}`, ['שלום תמימה,', `פנייה בוואטסאפ מ${w.customer.name} לגבי ביטול הסדנה ב${longDay(w.date)}, ${w.time}.`, `טלפון: ${w.customer.phone}`, 'ההזמנה בתוקף עד ההחלטה שלך.'], { cta: ['להחלטה', siteUrl('#/tamima/home')] });
      log('notify', `פנייה מאוחרת: ${w.customer.name}`, `${shortDay(w.date)} ${w.time}. מופיעה ב"ממתין לך עכשיו", עם 0 ₪ מוצע והזזה חד פעמית.`);
      toast('פנייה מאוחרת לביטול', `${w.customer.name}, ${shortDay(w.date)} ${w.time}`);
      render();
    },
    cbMode(d) { ui.cb.mode = d.m; ui.cb.msg = ''; ui.cb.date = null; ui.cb.time = null; render(); },
    cbDate(d) { ui.cb.date = d.date; ui.cb.time = null; render(); },
    cbTime(d) { ui.cb.time = d.t; render(); },
    // הזזה בזמן: לא נפתח זיכוי, החשבונית נשארת, וההזזה החד פעמית לא מסומנת
    cbMoveDo() {
      const w = workshop(ui.cb.id), f = ui.cb;
      if (!w || hoursTo(w) < S.settings.workshopCancelHours || !freeSlots(f.date).includes(f.time)) { f.msg = 'המועד כבר לא פנוי. אפשר לבחור מועד אחר.'; render(); return; }
      const from = shiftWorkshop(w, f.date, f.time);
      log('notify', `${w.customer.name}: הסדנה הוזזה מ"ההזמנה שלי"`, `מ${from} ל${shortDay(w.date)} ${w.time}. החשבונית נשארת, ולא נפתח זיכוי.`);
      toast('סדנה הוזזה מ"ההזמנה שלי"', `${w.customer.name}: ${shortDay(w.date)} ${w.time}`);
      Object.assign(f, { mode: '', date: null, time: null, msg: `המועד עודכן ל${longDay(w.date)}, ${w.time}. אישור נשלח למייל.` });
      render();
    },
    // ביטול בזמן: ההזמנה מתבטלת, ונפתח אצל תמימה "זיכוי ממתין להחלטה" עם החזר מלא מוצע. שום החזר לא יוצא לבד
    cbCancelDo() {
      const w = workshop(ui.cb.id);
      if (!w || hoursTo(w) < S.settings.workshopCancelHours) return;
      dropWorkshop(w);
      if (w.invoice) openRefundCase({ inv: w.invoice, reason: 'customer', wsId: w.id, suggested: w.amount - refundedOf(w.invoice), why: `ביטול יותר מ-${S.settings.workshopCancelHours} שעות לפני הסדנה: מוצע החזר מלא.` });
      email('customerCancel', toStudio(), `ביטול סדנה: ${w.customer.name}`, ['שלום תמימה,', `הסדנה של ${w.customer.name} ב${longDay(w.date)}, ${w.time} בוטלה מ"ההזמנה שלי".`, 'המועד התפנה. הזיכוי ממתין להחלטה שלך.'], { cta: ['להחלטה', siteUrl('#/tamima/home')] });
      toast('ביטול סדנה מ"ההזמנה שלי"', `${w.customer.name}, ${shortDay(w.date)} ${w.time}. הזיכוי ממתין להחלטה.`);
      Object.assign(ui.cb, { mode: '', msg: 'הביטול התקבל. תמימה תעדכן אותך לגבי ההחזר.' });
      render();
    },
    bkRestart() { A.startBooking(); location.hash = '#/client'; },
    ics(d) {
      const w = workshop(d.id);
      const f = (dt, t) => dt.replace(/-/g, '') + 'T' + t.replace(':', '') + '00';
      const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tamima Studio//Demo//HE', 'BEGIN:VEVENT', `UID:${w.id}@tamima-demo`, `DTSTAMP:${stamp}`,
        `DTSTART;TZID=Asia/Jerusalem:${f(w.date, w.time)}`, `DTEND;TZID=Asia/Jerusalem:${f(w.date, endOf(w.time))}`,
        'SUMMARY:סדנת קרמיקה בסטודיו של תמימה', `LOCATION:${S.content.address.replace(/[,;]/g, m => '\\' + m)}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
      a.download = 'sadna-tamima.ics';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    leadSend() {
      lead.errField = '';
      if (lead.name.trim().length < 2) { lead.err = 'נא למלא שם.'; lead.errField = 'name'; }
      else if (!/^0\d{8,9}$/.test(lead.phone.replace(/[\s-]/g, ''))) { lead.err = 'נא למלא מספר טלפון תקין, למשל 050-1234567.'; lead.errField = 'phone'; }
      else if (!lead.email.trim() || !EMAIL_OK(lead.email)) { lead.err = 'נא למלא כתובת מייל תקינה, למשל name@example.com.'; lead.errField = 'email'; }
      else {
        lead.err = ''; lead.sent = true;
        S.leads.push({ id: uid('ld'), name: lead.name.trim(), phone: lead.phone.trim(), email: lead.email.trim(), group: lead.group, handled: false, status: 'new', at: todayIso(), marketing: !!lead.marketing, marketingAt: lead.marketing ? todayIso() : '' });
        email('newLead', toStudio(), `פנייה חדשה לקורס: ${lead.name.trim()}`, [`${lead.name.trim()}: פרטים הושארו באתר.`, `טלפון: ${lead.phone.trim()}`, `מייל: ${lead.email.trim()}`, lead.group ? `קבוצה מועדפת: ${group(lead.group).name}.` : 'כל קבוצה מתאימה.'], { cta: ['לבית', siteUrl('#/tamima/home')] });
        toast('פנייה חדשה לקורס', `${lead.name.trim()}, ${lead.phone.trim()}`);
      }
      if (lead.errField) ui.focusSel = `[data-bind="lead.${lead.errField}"]`;
      render();
    },
    leadReset() { lead = { name: '', phone: '', email: '', group: '', sent: false, err: '', errField: '', marketing: false }; render(); },

  });
