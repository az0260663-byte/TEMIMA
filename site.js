/* site.js: האתר הציבורי ללקוחות בלבד. דף הבית, הזמנת סדנה, קורס, נגישות ופרטיות. */
'use strict';

  /* ================= עמודי חובה: נגישות, פרטיות, תקנון וביטול עסקה =================
     פרטי העסק (שם משפטי, מספר עוסק, מייל) מוצגים רק כשמולאו בהגדרות. לא ממציאים פרטים. */
  const bizPhone = () => String(S.settings.whatsapp || '');
  const bizEmail = () => String(S.settings.bizEmail || '');
  const legalDate = () => fullDate(S.settings.legalUpdated || todayIso());
  // שורת פרטי העסק: שם, סוג ומספר עוסק, כתובת, טלפון ומייל (סעיף 14ג לחוק הגנת הצרכן)
  function bizDetails() {
    const st = S.settings;
    const name = st.bizLegalName ? esc(st.bizLegalName) + ' (הסטודיו של תמימה)' : 'הסטודיו של תמימה';
    return [name, st.bizType && st.bizId ? esc(st.bizType + ' מס׳ ' + st.bizId) : esc(st.bizType || ''), esc(S.content.address),
      bizPhone() ? 'טלפון <a href="tel:' + esc(bizPhone().replace(/\D/g, '')) + '" dir="ltr">' + esc(bizPhone()) + '</a>' : '',
      bizEmail() ? 'מייל <a href="mailto:' + esc(bizEmail()) + '" dir="ltr">' + esc(bizEmail()) + '</a>' : ''].filter(Boolean).join(' · ');
  }
  const contactLine = () => [bizPhone() ? 'טלפון: <a href="tel:' + esc(bizPhone().replace(/\D/g, '')) + '" dir="ltr">' + esc(bizPhone()) + '</a>' : '', bizEmail() ? 'מייל: <a href="mailto:' + esc(bizEmail()) + '" dir="ltr">' + esc(bizEmail()) + '</a>' : ''].filter(Boolean).join(' · ');

  // הודעה בעת איסוף מידע (סעיף 11 לחוק הגנת הפרטיות): האם חובה, למה, למי מועבר, וזכות עיון. הדיוור בתיבה נפרדת, לא מסומנת מראש
  function consentBlock(root, obj, purpose) {
    return '<p class="notice" id="' + root + '-notice">' + purpose + ' מסירת הפרטים אינה חובה לפי חוק, אבל בלעדיהם לא נוכל לקבוע. הפרטים מועברים רק לספקי השירות שעוזרים לנו (סליקה וחשבונית, יומן ואחסון), ואפשר לעיין בהם ולתקן אותם. <a href="#/client/privacy">מדיניות פרטיות</a></p>'
      + '<label class="consent"><input type="checkbox" data-bind="' + root + '.marketing" ' + (obj.marketing ? 'checked' : '') + '><span>אשמח לקבל עדכונים על סדנאות חדשות במייל. אפשר להפסיק בכל עת.</span></label>';
  }

  function accessibilityPage() {
    const f = ui.accForm;
    const inv = k => (f.errField === k ? 'aria-invalid="true" aria-describedby="acc-err"' : '');
    const form = f.sent
      ? '<p class="ok-line" role="status">תודה. הפנייה התקבלה, ותמימה תחזור אליך בהקדם.</p>'
      : '<div class="acc-form">'
        + '<p class="muted small">כל השדות חובה.</p>'
        + '<label class="field"><span>שם</span><input data-bind="accForm.name" value="' + esc(f.name) + '" required aria-required="true" autocomplete="name" ' + inv('name') + '></label>'
        + '<label class="field"><span>טלפון או מייל לחזרה</span><input data-bind="accForm.contact" value="' + esc(f.contact) + '" required aria-required="true" autocomplete="email" ' + inv('contact') + '></label>'
        + '<label class="field"><span>מה לא עבד?</span><textarea data-bind="accForm.text" rows="3" required aria-required="true" ' + inv('text') + '>' + esc(f.text) + '</textarea></label>'
        + (f.err ? '<p class="err" id="acc-err" role="alert">' + esc(f.err) + '</p>' : '')
        + '<button class="btn primary" data-act="accSend">שליחה</button>'
        + '</div>';
    return '<a class="back" href="#/client">חזרה לאתר</a>'
      + '<article class="doc">'
      + '<span class="eyebrow">נגישות</span>'
      + '<h1 class="display">הצהרת נגישות</h1>'
      + '<p>הסטודיו של תמימה רוצה שכל אחד יוכל להזמין סדנה או להירשם לקורס בקלות, ופועל להנגשת האתר לאנשים עם מוגבלות.</p>'

      + '<h2>רמת הנגישות</h2>'
      + '<p>האתר הונגש לפי תקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), תשע"ג-2013, ולפי התקן הישראלי ת"י 5568, המבוסס על הנחיות WCAG 2.0 ברמה AA.</p>'

      + '<h2>מה הונגש</h2>'
      + '<ul class="doc-list">'
      + '<li>שימוש באתר עם מקלדת בלבד, כולל בחירת מועד, מילוי פרטים ומעבר לתשלום.</li>'
      + '<li>מבנה כותרות, תיאור טקסטואלי לתמונות ותוויות לכל השדות, לעבודה עם קוראי מסך.</li>'
      + '<li>הודעות שגיאה ברורות ליד השדה, והודעות שמוקראות לקורא המסך.</li>'
      + '<li>ניגודיות צבעים לפי התקן, והגדלת טקסט בדפדפן (Ctrl ו-+) בלי שהתוכן נחתך.</li>'
      + '<li>עצירת התמונות הנעות בעמוד הבית.</li>'
      + '<li>זמן שמירת המועד בהזמנה: לפני שהוא נגמר מופיעה הודעה, ואפשר להאריך אותו.</li>'
      + '</ul>'

      + '<h2>היקף הבדיקה</h2>'
      + '<p>האתר נבדק בדפדפנים Chrome ו-Edge במחשב, ובתצוגת טלפון, בבדיקות אוטומטיות של נגישות וניגודיות לכל עמוד. בדיקה ידנית מלאה עם קוראי מסך (NVDA במחשב ו-VoiceOver בטלפון) מתוכננת, ותעודכן כאן כשתושלם.</p>'

      + '<h2>חלקים שאינם בשליטתנו</h2>'
      + '<p>התשלום מתבצע בדף התשלום המאובטח של מערכת הסליקה, שאינו חלק מהאתר. אם יש קושי בתשלום, אפשר לפנות לתמימה, ונסדיר את התשלום בדרך אחרת.</p>'

      + '<h2>הגעה לסטודיו</h2>'
      + '<p>צריכים התאמה בסדנה או בשיעור? ספרו לנו מראש ונשמח לתאם. לפרטים על הגישה לסטודיו, החניה והשירותים, אפשר לפנות לתמימה.</p>'

      + '<h2>פנייה בנושא נגישות</h2>'
      + '<p>נתקלתם בבעיה, או צריכים מידע בדרך אחרת? נשמח לשמוע ולתקן. רכזת הנגישות היא תמימה, בעלת הסטודיו.</p>'
      + (contactLine() ? '<p>' + contactLine() + '</p>' : '')
      + '<p>אפשר גם לכתוב כאן, ונחזור אליך בתוך 5 ימי עבודה:</p>'
      + form
      + '<p class="muted small">עודכן: ' + legalDate() + '</p>'
      + '</article>';
  }

  function privacyPage() {
    return '<a class="back" href="#/client">חזרה לאתר</a>'
      + '<article class="doc">'
      + '<span class="eyebrow">פרטיות</span>'
      + '<h1 class="display">מדיניות פרטיות</h1>'
      + '<p>בקצרה: אנחנו מבקשים רק את מה שצריך כדי לקבוע סדנה או שיעור, ולא מוכרים או מעבירים את הפרטים לאף אחד לצורכי פרסום.</p>'

      + '<h2>מי אנחנו</h2>'
      + '<p>' + bizDetails() + '. האחראית על המידע היא תמימה, בעלת הסטודיו.</p>'

      + '<h2>מה אנחנו אוספים ולמה</h2>'
      + '<ul class="doc-list">'
      + '<li><b>בהזמנת סדנה:</b> שם, טלפון ומייל, כדי לקבוע את הסדנה, לשלוח אישור וחשבונית, ולהודיע על שינויים.</li>'
      + '<li><b>בהרשמה לקורס:</b> שם, טלפון ומייל, כדי שתמימה תחזור אליך. בזמן הקורס נשמרים גם השיעורים, הנוכחות, הכרטיסייה והתשלומים שלך.</li>'
      + '<li><b>בפנייה בנושא נגישות או ביטול עסקה:</b> הפרטים שכתבת, כדי לטפל בפנייה.</li>'
      + '</ul>'
      + '<p>מסירת הפרטים אינה חובה לפי חוק, אבל בלעדיהם לא נוכל לטפל בהזמנה או בפנייה.</p>'
      + '<p><b>מידע שנאסף אוטומטית:</b> האתר לא משתמש בכלי מעקב, פרסום או סטטיסטיקה, ולא בעוגיות שיווקיות. הפונטים באתר נטענים מ-Google Fonts, ולכן Google מקבלת את כתובת ה-IP של הדפדפן.</p>'

      + '<h2>תשלום</h2>'
      + '<p>התשלום מתבצע בדף התשלום המאובטח של מערכת הסליקה, שמפיקה גם את החשבונית. פרטי כרטיס האשראי לא מגיעים אלינו ולא נשמרים אצלנו.</p>'

      + '<h2>עם מי אנחנו משתפים</h2>'
      + '<p>רק עם ספקי שירות שנחוצים לניהול הסטודיו, ורק לצורך זה:</p>'
      + '<ul class="doc-list">'
      + '<li>מערכת הסליקה והחשבוניות (כיום מורנינג), לתשלום ולהפקת חשבונית.</li>'
      + '<li>Google, ליומן הסטודיו ולשליחת מיילים.</li>'
      + '<li>שירותי האחסון של האתר והמערכת (Supabase ו-Render).</li>'
      + '<li>אם הזמנת דרך שותף, למשל "בסלון", הוא מעביר לנו את פרטי ההזמנה.</li>'
      + '</ul>'
      + '<p>חלק מהספקים שומרים מידע בשרתים מחוץ לישראל. נמסור מידע גם אם נידרש לכך לפי דין.</p>'

      + '<h2>שמירה ואבטחה</h2>'
      + '<p>הפרטים נשמרים כל עוד הם נחוצים למטרה שלשמה נמסרו, וחשבוניות נשמרות לפי חובות החשבונאות שבדין. הגישה למידע מוגבלת לתמימה בלבד, בכניסה מאובטחת, והתעבורה באתר מוצפנת. אין אבטחה מושלמת, ואם יקרה אירוע אבטחה נפעל לפי הדין.</p>'

      + '<h2>עדכונים במייל</h2>'
      + '<p>נשלח עדכונים על סדנאות רק אם סימנת שמתאים לך. כל הודעה כזו תסומן כפרסומת, ואפשר להפסיק בכל עת דרך הקישור בהודעה או בפנייה אלינו.</p>'

      + '<h2>הזכויות שלך</h2>'
      + '<p>אפשר לבקש לעיין בפרטים ששמורים עליך, לתקן אותם או למחוק אותם, ולהפסיק לקבל עדכונים. פונים לתמימה' + (contactLine() ? ' (' + contactLine() + ')' : '') + ', ונענה בתוך 30 יום.</p>'
      + '<p class="muted small">עודכן: ' + legalDate() + '</p>'
      + '</article>';
  }

  // תקנון ומדיניות ביטול (חוק הגנת הצרכן, סעיף 14ג). מדיניות הסטודיו מקלה מהחוק: ביטול עד 48 שעות לפני, בהחזר מלא
  function termsPage() {
    const st = S.settings;
    return '<a class="back" href="#/client">חזרה לאתר</a>'
      + '<article class="doc">'
      + '<span class="eyebrow">תנאים</span>'
      + '<h1 class="display">תקנון ומדיניות ביטול</h1>'

      + '<h2>פרטי העסק</h2>'
      + '<p>' + bizDetails() + '.</p>'

      + '<h2>השירותים</h2>'
      + '<ul class="doc-list">'
      + '<li><b>' + esc(S.content.workshopTitle) + ':</b> שעתיים בסטודיו, 2 עד 6 משתתפים, שני כלים לכל משתתף. הכלים מוכנים לאיסוף אחרי הייבוש והשריפה בתנור. לקבוצה של 7 עד 12 משתתפים מתאמים ישירות עם תמימה.</li>'
      + '<li><b>' + esc(S.content.courseTitle) + ':</b> שיעור שבועי קבוע בקבוצה, בתשלום לפי כרטיסייה של ' + st.cardSize + ' שיעורים.</li>'
      + '</ul>'

      + '<h2>מחירים ותשלום</h2>'
      + '<p>כל המחירים באתר כוללים מע"מ. סדנה לזוג: ' + money(price(2)) + '. סדנה ל-3 עד 6 משתתפים: ' + money(st.pricePer) + ' למשתתף. כרטיסייה של ' + st.cardSize + ' שיעורים: ' + money(st.cardPrice) + '. אין תוספות חובה. התשלום בכרטיס אשראי, בדף התשלום המאובטח של מערכת הסליקה.</p>'

      + '<h2>אישור הזמנה</h2>'
      + '<p>אחרי התשלום נשלח אליך מייל עם פרטי ההזמנה, החשבונית, תנאי הביטול וקישור לניהול ההזמנה.</p>'

      + '<h2>ביטול סדנה על ידך</h2>'
      + '<ul class="doc-list">'
      + '<li>אפשר לבטל או לשנות מועד עד ' + st.workshopCancelHours + ' שעות לפני הסדנה, בהחזר מלא וללא דמי ביטול. זה מקל יותר ממה שהחוק מחייב.</li>'
      + '<li>ביטול מאוחר יותר אינו כולל החזר. אפשר להעביר את המקום לאדם אחר, או לפנות לתמימה לבדיקת מועד אחר.</li>'
      + '<li>ההחזר מבוצע בתוך 14 יום מקבלת הודעת הביטול, לאותו כרטיס אשראי.</li>'
      + '<li>לקוחות עם מוגבלות, בני 65 ומעלה ועולים חדשים זכאים לתנאי ביטול מורחבים לפי החוק.</li>'
      + '</ul>'

      + '<h2>איך מבטלים</h2>'
      + '<p>בקישור "ניהול ההזמנה" שבמייל האישור, בעמוד <a href="#/client/cancel">ביטול עסקה</a>' + (contactLine() ? ', או ב' + contactLine() : '') + '.</p>'

      + '<h2>ביטול או שינוי על ידי הסטודיו</h2>'
      + '<p>אם הסטודיו מבטל או משנה מועד, אפשר לבחור מועד אחר או החזר כספי מלא.</p>'

      + '<h2>קורס שבועי</h2>'
      + '<ul class="doc-list">'
      + '<li>אפשר לבטל את ההרשמה לקורס בתוך 14 יום מיום העסקה, לפי חוק הגנת הצרכן. במקרה כזה מחזירים את מה ששולם, בניכוי השיעורים שכבר התקיימו.</li>'
      + '<li>אחרי 14 הימים חלה מדיניות הביטולים של הקורס, שהסטודנט מאשר לפני התשלום הראשון.</li>'
      + '</ul>'

      + '<h2>נגישות ופרטיות</h2>'
      + '<p>מידע על נגישות האתר והסטודיו ב<a href="#/client/accessibility">הצהרת הנגישות</a>. השימוש בפרטים אישיים מוסבר ב<a href="#/client/privacy">מדיניות הפרטיות</a>.</p>'

      + '<h2>דין</h2>'
      + '<p>על התקנון חל הדין הישראלי.</p>'
      + '<p class="muted small">עודכן: ' + legalDate() + '</p>'
      + '</article>';
  }

  // ביטול עסקה: דרך ביטול זמינה מהעמוד הראשי, לא רק מהקישור האישי שבמייל
  function cancelPage() {
    const f = ui.cnlForm;
    const inv = k => (f.errField === k ? 'aria-invalid="true" aria-describedby="cnl-err"' : '');
    const form = f.sent
      ? '<p class="ok-line" role="status">הבקשה התקבלה. תמימה תאשר את הביטול ותחזור אליך בהקדם. ההחזר מבוצע בתוך 14 יום.</p>'
      : '<div class="acc-form">'
        + '<p class="muted small">כל השדות חובה.</p>'
        + '<label class="field"><span>שם מלא</span><input data-bind="cnlForm.name" value="' + esc(f.name) + '" required aria-required="true" autocomplete="name" ' + inv('name') + '></label>'
        + '<label class="field"><span>טלפון</span><input type="tel" dir="ltr" data-bind="cnlForm.phone" value="' + esc(f.phone) + '" required aria-required="true" autocomplete="tel" ' + inv('phone') + '></label>'
        + '<label class="field"><span>מה לבטל?<small class="hint-inline">למשל: סדנה ביום שלישי 4.11 בשעה 10:00</small></span><input data-bind="cnlForm.what" value="' + esc(f.what) + '" required aria-required="true" ' + inv('what') + '></label>'
        + '<p class="notice">הפרטים משמשים רק לטיפול בבקשת הביטול. מסירתם אינה חובה לפי חוק, אבל בלעדיהם לא נוכל לטפל בבקשה. <a href="#/client/privacy">מדיניות פרטיות</a></p>'
        + (f.err ? '<p class="err" id="cnl-err" role="alert">' + esc(f.err) + '</p>' : '')
        + '<button class="btn primary" data-act="cnlSend">שליחת בקשת ביטול</button>'
        + '</div>';
    return '<a class="back" href="#/client">חזרה לאתר</a>'
      + '<article class="doc">'
      + '<span class="eyebrow">ביטול</span>'
      + '<h1 class="display">ביטול עסקה</h1>'
      + '<p>הזמנת סדנה ורוצה לבטל? הדרך המהירה היא הקישור "ניהול ההזמנה" במייל האישור: שם אפשר לבטל או להזיז מועד מיד.</p>'
      + '<p>אפשר גם לשלוח כאן בקשת ביטול' + (contactLine() ? ', או לפנות ב' + contactLine() : '') + '. התנאים המלאים ב<a href="#/client/terms">תקנון ומדיניות הביטול</a>.</p>'
      + form
      + '</article>';
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
    else if (r.page === 'terms') body = termsPage();
    else if (r.page === 'cancel') body = cancelPage();
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
        <p class="foot-biz">${bizDetails()}</p>
        <nav class="foot-links" aria-label="מידע משפטי"><a href="#/client/cancel">ביטול עסקה</a><a href="#/client/terms">תקנון ומדיניות ביטול</a><a href="#/client/accessibility">הצהרת נגישות</a><a href="#/client/privacy">מדיניות פרטיות</a></nav>
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
              <div class="offer-foot"><span class="price">זוג ${money(price(2))} <small>3 עד 6: ${money(S.settings.pricePer)} למשתתף · כולל מע"מ</small></span><span class="arrow">לבחירת מועד</span></div>
            </div>
          </a>
          <a class="offer reveal" href="#/client/course">
            <div class="offer-img"><img src="${IMGS(c.courseImage)}" alt="${esc(PHOTOS[c.courseImage] || '')}" loading="lazy"></div>
            <div class="offer-body">
              <span class="tag olive">כל שבוע</span>
              <h3>${esc(c.courseTitle)}</h3>
              <ul class="facts"><li>${esc(classDaysText())}</li><li>${esc(classHoursText().split(' · ')[1] || 'לפי קבוצה')}</li><li>קבוצות קטנות</li></ul>
              <div class="offer-foot"><span class="price">${money(S.settings.cardPrice)} <small>ל-4 שיעורים · כולל מע"מ</small></span><span class="arrow">לקבוצות</span></div>
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
  /* חזרה מדף התשלום: מורנינג (דרך pay-return.html) מחזיר לכאן עם ?payret=<מזהה ההזמנה>.
     ההזמנה שנשמרה לפני המעבר חוזרת, והשרת בודק מול מורנינג שהתשלום התקבל, כמו תמיד */
  const PAY_RESUME = 'tamima-pay-resume';
  function payResume() {
    const q = new URLSearchParams(location.search);
    const ref = q.get('payret');
    if (!ref) return;
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(PAY_RESUME) || 'null'); sessionStorage.removeItem(PAY_RESUME); } catch (e) { /* אין שמירה */ }
    history.replaceState(null, '', location.pathname + '#/client/workshop');
    if (!saved || saved.ref !== ref || Date.now() - saved.at > 60 * 60e3) return;
    const w = Object.assign({}, saved.w, { status: 'pending', holdUntil: now().getTime() + HOLD_MIN * 6e4 });
    S.workshops = S.workshops.filter(x => x.id !== w.id).concat(w);
    Object.assign(bk, saved.bk, { hold: w.id });
    if (q.get('payfail') === '1') { bk.live = null; bk.step = 'summary'; bk.err = 'התשלום לא הושלם. ההזמנה עדיין שמורה, ואפשר לנסות שוב.'; return; }
    bk.step = 'pay';
    bk.live = { ref, url: '', popup: true, error: '', since: Date.now(), amount: w.amount, desc: wsDesc(w), returned: true };
    log('sumit', 'הלקוח חזר מדף התשלום', `${wsDesc(w)}. השרת בודק מול מערכת הסליקה שהתשלום התקבל.`);
    livePoll(bk.live, id => { touchHold(w.id); A.bkFinish(id, ['check']); }, () => { touchHold(w.id); render(); });
  }
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
      // שתי דקות לפני שהזמן נגמר: הודעה עם אפשרות להאריך (ת"י 5568, כוונון זמן 2.2.1)
      const warn = h.holdUntil - now().getTime() <= 120e3;
      if (warn !== !!bk.holdWarn) { bk.holdWarn = warn; render(); }
    }, 1000);
  }
  // התראת הזמן במסך התשלום
  const holdWarnHtml = () => (bk.holdWarn ? '<div class="policy warn" role="alert"><b>הזמן לשמירת המועד עומד להיגמר</b>צריך עוד זמן? אפשר להאריך ב-10 דקות. <button class="btn small primary" data-act="bkMoreTime">צריך עוד זמן</button></div>' : '');

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
          <p class="price-line">${bk.n === 2 ? `זוג: ${money(price(2))}` : `${bk.n} × ${money(S.settings.pricePer)}`} <b>סה״כ ${money(price(bk.n))}</b> <small class="muted">כולל מע"מ</small></p>
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
        <p class="muted small">המחיר כולל מע"מ. אין תוספות.</p>
        <div class="coupon-row"><label class="field"><span>קוד קופון</span><input class="txt" dir="ltr" data-bind="bk.couponIn" value="${esc(bk.couponIn || '')}" autocomplete="off"></label><button class="btn ghost small" data-act="bkCouponApply">${bkCoupon() ? 'החלפה' : 'הפעלה'}</button></div>${bk.couponMsg ? `<p class="${bk.couponOk ? 'ok-line small' : 'err'}" role="status">${esc(bk.couponMsg)}</p>` : ''}
        <div class="policy">ביטול או שינוי מועד עד ${S.settings.workshopCancelHours} שעות לפני הסדנה, בהחזר מלא. ביטול מאוחר יותר אינו כולל החזר.</div>
        <label class="consent"><input type="checkbox" id="bk-terms" data-bind="bk.terms" ${bk.terms ? 'checked' : ''} aria-required="true" ${bk.errField === 'terms' ? 'aria-invalid="true" aria-describedby="bk-err"' : ''}><span>קראתי ואני מסכים/ה ל<a href="#/client/terms" target="_blank" rel="noopener">תקנון ולמדיניות הביטול</a> (נפתח בלשונית חדשה)</span></label>
        ${err}
        <button class="btn primary block" data-act="bkToPay">לתשלום ${money(bkTotal())}</button>
        <button class="btn ghost block" data-act="bkGo" data-s="details">חזרה</button>`);
    }

    if (bk.step === 'pay') {
      const h = pendingOrder(bk.hold);
      body = (h ? `<p class="hold-note">ההזמנה ממתינה לתשלום. המועד שמור לכם עוד <b id="hold-left">${mmss(h.holdUntil - now().getTime())}</b> דקות</p>` : '') + holdWarnHtml() + err
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
      <section class="page-banner" data-photo-bg="0.66"><img src="${IMG(c.courseImage)}" alt=""><div><span class="eyebrow light">כל שבוע, אותה קבוצה</span><h1 class="display">${esc(c.courseTitle)}</h1><p>${esc(c.courseText)} מחיר הכרטיסייה: ${money(S.settings.cardPrice)}, כולל מע"מ.</p></div></section>
      <div class="course-grid"><div>${card(`<h2>הקבוצות</h2>${groupsHtml}`)}</div><div>${form}</div></div>`;
  }

  Object.assign(A, {
    // לקוח
    startBooking() { releaseHold(bk.hold); bk = { hold: null, step: 'slot', n: bk.n || 2, date: null, time: null, name: '', phone: '', email: '', err: '', errField: '', marketing: false, terms: false, done: null }; },
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
      // הסכמה לתקנון ולמדיניות הביטול לפני התשלום (לא מסומנת מראש, נפרדת מהדיוור)
      if (!bk.terms) { bk.err = 'כדי להמשיך לתשלום צריך לאשר את התקנון ומדיניות הביטול.'; bk.errField = 'terms'; ui.focusSel = '#bk-terms'; render(); return; }
      if (bk.errField === 'terms') { bk.err = ''; bk.errField = ''; }
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
        // דף תשלום להזמנה: באותה לשונית, ומורנינג מחזיר את הלקוח לאתר. ההזמנה נשמרת לרגע החזרה (רק בלשונית הזו)
        const sameTab = !PAY.fixedLink;
        const save = () => { try { sessionStorage.setItem(PAY_RESUME, JSON.stringify({ ref: w.id, w, bk: Object.assign({}, bk, { live: null }), at: Date.now() })); } catch (e) { /* בלי שמירה הלקוח יחזור למסך ההזמנה */ } };
        livePayStart({ id: w.id, customer: w.customer, amount: w.amount, desc: wsDesc(w), coupon: cp ? cp.code : '' }, 'workshop', w.n, bk.live, { sameTab, beforeLeave: save })
          .then(() => { if (sameTab) return; render(); livePoll(bk.live, id => { touchHold(w.id); A.bkFinish(id, ['check']); }, () => { touchHold(w.id); render(); }); })
          .catch(() => render());
        render(); scrollTop();
        return;
      }
      sumitBeginRedirect({ id: w.id, customer: w.customer, sumitId: sumitIdOf(known), amount: w.amount, desc: wsDesc(w) });
      bk.err = ''; bk.step = 'pay';
      render(); scrollTop();
    },
    // פנייה בנושא נגישות מהצהרת הנגישות: מגיעה לתמימה במייל ונרשמת
    accSend() {
      const f = ui.accForm;
      f.err = ''; f.errField = '';
      if (f.name.trim().length < 2) { f.err = 'נא למלא שם.'; f.errField = 'name'; }
      else if (f.contact.trim().length < 5) { f.err = 'נא למלא טלפון או מייל לחזרה.'; f.errField = 'contact'; }
      else if (f.text.trim().length < 5) { f.err = 'נא לתאר בקצרה מה לא עבד.'; f.errField = 'text'; }
      else {
        f.sent = true;
        email('accessibilityRequest', toStudio(), `פנייה בנושא נגישות: ${f.name.trim()}`, ['שלום תמימה,', `פנייה בנושא נגישות מהאתר, מ${f.name.trim()}.`, `לחזרה: ${f.contact.trim()}`, `מה לא עבד: ${f.text.trim()}`, 'כדאי לחזור בתוך 5 ימי עבודה.']);
        log('notify', 'פנייה בנושא נגישות', `${f.name.trim()}: ${f.text.trim()}`);
      }
      if (f.errField) ui.focusSel = `[data-bind="accForm.${f.errField}"]`;
      render();
    },
    // בקשת ביטול עסקה מהעמוד "ביטול עסקה": מגיעה לתמימה במייל ונרשמת
    cnlSend() {
      const f = ui.cnlForm;
      f.err = ''; f.errField = '';
      if (f.name.trim().length < 2) { f.err = 'נא למלא שם מלא.'; f.errField = 'name'; }
      else if (normPhone(f.phone).length < 9) { f.err = 'נא למלא מספר טלפון תקין.'; f.errField = 'phone'; }
      else if (f.what.trim().length < 3) { f.err = 'נא לכתוב מה לבטל, למשל את מועד הסדנה.'; f.errField = 'what'; }
      else {
        f.sent = true;
        email('cancelRequest', toStudio(), `בקשה לביטול עסקה: ${f.name.trim()}`, ['שלום תמימה,', `בקשה לביטול עסקה מהאתר, מ${f.name.trim()}.`, `טלפון: ${f.phone.trim()}`, `מה לבטל: ${f.what.trim()}`, 'לפי החוק, החזר מבוצע בתוך 14 יום מקבלת הודעת הביטול.'], { cta: ['לסדנאות', siteUrl('#/tamima/workshops')] });
        log('notify', 'בקשה לביטול עסקה', `${f.name.trim()}, ${f.phone.trim()}: ${f.what.trim()}`);
      }
      if (f.errField) ui.focusSel = `[data-bind="cnlForm.${f.errField}"]`;
      render();
    },
    bkMoreTime() {
      const h = pendingOrder(bk.hold);
      if (!h) return A.bkExpire();
      h.holdUntil = now().getTime() + HOLD_MIN * 6e4;
      bk.holdWarn = false;
      ui.focusSel = '#hold-left';
      render();
      snack(`המועד שמור לך עוד ${HOLD_MIN} דקות.`);
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
        email('booking', toCustomer(w), `הסדנה נקבעה: ${shortDay(w.date)} ${w.time}`, [`שלום ${w.customer.name.split(' ')[0]},`, `הסדנה שלכם נקבעה ל${longDay(w.date)}, ${w.time} עד ${endOf(w.time)}.`, `${w.n} משתתפים · שולם ${money(w.amount)}.`, `הכתובת: ${S.content.address}.`, `חשבונית מס קבלה מס׳ ${w.invoice} מצורפת.`, `ביטול או שינוי מועד עד ${S.settings.workshopCancelHours} שעות לפני הסדנה, בקישור למטה. ביטול מאוחר יותר אינו כולל החזר.`, `התקנון ומדיניות הביטול המלאים: ${siteUrl('#/client/terms')}`, 'נתראה, תמימה'], { extra: receiptMailHtml(w.invoice, w.customer.name, wsDesc(w), w.amount, w.paidAt) + receiptLinkHtml(w.receiptUrl), cta: ['לניהול ההזמנה', bookingUrl(w)] });
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
