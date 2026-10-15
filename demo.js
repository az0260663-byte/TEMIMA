/* demo.js: שכבת ההצגה בלבד. פס המעבר בין המבטים, הדגמה מודרכת ומסך "תאימות ואבטחה". */
'use strict';

  /* ================= מסך "תאימות ואבטחה" (למציג בלבד) ================= */
  // status: met = מתקיים בדמו, partial = חלקי או דורש השלמת פרטים, server = דורש שרת בגרסה האמיתית, external = דורש גורם חיצוני
  const REQS = [
    // נגישות: תקנות הנגישות לשירות ות"י 5568 (WCAG 2.0 AA)
    ['a11y', '1.1.1', 'טקסט חלופי לתמונות', 'לכל תמונה תיאור. תמונות קישוטיות מסומנות alt="" ומוסתרות מקוראי מסך.', '#/client', 'met'],
    ['a11y', '1.3.1', 'מבנה ותוויות', 'כותרת ראשית אחת בכל מסך, כותרות משנה לפי הסדר, אזורים (header, nav, main, footer), ותווית לכל שדה.', '#/client/workshop', 'met'],
    ['a11y', '1.4.1', 'לא רק צבע', 'סטטוסים ופריטי יומן כוללים גם טקסט ("פתוח · אתר", "לא זמין"), לא רק צבע.', '#/tamima/calendar', 'met'],
    ['a11y', '1.4.3', 'ניגודיות 4.5:1', 'צבעי הטקסט והתגיות הוכהו כך שיעמדו ביחס 4.5:1. נבדק בבדיקה החיה למטה.', '', 'met'],
    ['a11y', '1.4.4', 'הגדלת טקסט עד 200%', 'גדלים ביחידות יחסיות, בלי גלילה לצדדים גם ברוחב 320 פיקסלים.', '', 'met'],
    ['a11y', '2.1.1', 'הכל במקלדת', 'כל פעולה נגישה במקלדת. ביומן, לחיצה על זמן ריק עם עכבר, וגם טופס "מועד חדש" למקלדת ולקוראי מסך.', '#/tamima/calendar', 'met'],
    ['a11y', '2.1.2', 'בלי מלכודת מקלדת', 'חלונות נסגרים ב-Esc או בכפתור סגירה, והמיקוד חוזר למקום שממנו נפתחו.', '', 'met'],
    ['a11y', '2.2.2', 'עצירת תוכן נע', 'כפתור עצירה לגלריה הנעה בדף הבית. בנוסף, האתר מכבד את הגדרת הפחתת התנועה של המכשיר.', '#/client', 'met'],
    ['a11y', '2.4.1', 'דילוג לתוכן', 'קישור "דלג לתוכן הראשי" הוא הדבר הראשון שמקבל מיקוד בכל עמוד.', '', 'met'],
    ['a11y', '2.4.2', 'כותרת לכל מסך', 'כותרת הדפדפן משתנה בכל מעבר מסך.', '', 'met'],
    ['a11y', '2.4.3', 'סדר מיקוד', 'במעבר מסך המיקוד עובר לכותרת הראשית. בחלון שנפתח המיקוד נשאר בתוכו.', '', 'met'],
    ['a11y', '2.4.7', 'מיקוד נראה', 'טבעת מיקוד כפולה (כהה ובהירה), שנראית גם על רקע כהה וגם על רקע בהיר.', '', 'met'],
    ['a11y', '3.1.1', 'שפת הדף', 'lang="he" ו-dir="rtl".', '', 'met'],
    ['a11y', '3.3.1', 'זיהוי שגיאות', 'שגיאה מוסברת במילים, מסומנת aria-invalid, מוקראת (role="alert"), והמיקוד עובר לשדה.', '#/client/workshop', 'met'],
    ['a11y', '3.3.2', 'תוויות והוראות', 'שדות חובה מסומנים, ויש הסבר על פורמט (למשל טלפון).', '#/client/course', 'met'],
    ['a11y', '4.1.2', 'שם, תפקיד וערך', 'כפתורי מצב מסומנים aria-pressed או role="radio", וחלון מסומן role="dialog" ו-aria-modal.', '', 'met'],
    ['a11y', 'תקנה 35', 'הצהרת נגישות', 'עמוד הצהרת נגישות עם מה נעשה, מה לא נגיש עדיין, ודרך פנייה.', '#/client/accessibility', 'met'],
    ['a11y', 'תקנה 35', 'רכז נגישות ופרטי קשר', 'רכזת הנגישות מוגדרת (תמימה). טלפון ומייל ישירים יושלמו לפני העלייה לאוויר.', '#/client/accessibility', 'partial'],
    ['a11y', 'תקנה 35', 'בדיקת מורשה נגישות שירות', 'נדרשת בדיקה של מורשה נגישות לפני העלייה לאוויר. הדמו לא מחליף אותה.', '', 'external'],
    // פרטיות: חוק הגנת הפרטיות (כולל תיקון 13) וחוק התקשורת
    ['privacy', 'סעיף 11', 'הודעה בעת איסוף מידע', 'ליד כל טופס: למה אוספים, שאין חובה חוקית למסור, וקישור למדיניות.', '#/client/course', 'met'],
    ['privacy', 'שקיפות', 'מדיניות פרטיות', 'מה נאסף, למה, מי מקבל, כמה זמן, זכויות ואבטחה.', '#/client/privacy', 'met'],
    ['privacy', 'צמצום מידע', 'אוספים ומציגים רק מה שצריך', 'ערוצים שותפים מקבלים רק מועדים פנויים. מהיומן האישי נקרא רק "תפוס". סטודנט רואה רק את שלו.', '#/tamima/calendar', 'met'],
    ['privacy', 'חוק התקשורת 30א', 'הסכמה לדיוור', 'תיבת הסכמה נפרדת, לא מסומנת מראש, ולא חובה להמשך.', '#/client/workshop', 'met'],
    ['privacy', 'סעיפים 13, 14', 'עיון, תיקון ומחיקה', 'הזכויות מוסברות במדיניות. בגרסה האמיתית צריך תהליך מתועד לטיפול בבקשות.', '#/client/privacy', 'partial'],
    ['privacy', 'שמירת מידע', 'תקופת שמירה', 'במדיניות: לפי הצורך ולפי דין. צריך לקבוע תקופות מדויקות מול רואה החשבון.', '#/client/privacy', 'partial'],
    ['privacy', 'העברה לחו"ל', 'שירותי ענן', 'גוגל וסאמיט מפורטים במדיניות, כולל אפשרות לשרתים מחוץ לישראל.', '#/client/privacy', 'met'],
    ['privacy', 'תיקון 13', 'בדיקת חובות המאגר', 'לבדוק מול יועץ פרטיות אם נדרש רישום מאגר או מינוי ממונה, לפי היקף המידע.', '', 'external'],
    // אבטחת מידע: תקנות אבטחת מידע ועקרונות OWASP
    ['security', 'OWASP A03', 'מניעת הזרקת קוד (XSS)', 'כל טקסט שמשתמש הקליד עובר ניקוי לפני הצגה. נבדק בבדיקה החיה למטה.', '', 'met'],
    ['security', 'CSP', 'מדיניות אבטחת תוכן', 'הדפדפן מריץ קוד רק מהאתר עצמו ומההתחברות של גוגל. אין סקריפטים מוטבעים ואין eval.', '', 'met'],
    ['security', 'פרטיות בכתובת', 'אין מידע אישי ב-URL', 'כתובות המסכים לא כוללות שמות, טלפונים או מיילים.', '', 'met'],
    ['security', 'PCI DSS', 'פרטי אשראי', 'פרטי כרטיס לא נשמרים ולא נשלחים מהמערכת. בגרסה האמיתית, התשלום בעמוד המאובטח של סאמיט.', '#/client/workshop', 'met'],
    ['security', 'צמצום הרשאות', 'הרשאות מינימליות לגוגל', 'ארבע הרשאות בלבד: אירועים, יומנים שהאפליקציה יצרה, רשימת יומנים (קריאה), וזמינות.', '#/tamima/more', 'met'],
    ['security', 'ניהול סודות', 'אסימון הגישה בזיכרון בלבד', 'לא נשמר בדפדפן. בניתוק ההרשאה מבוטלת גם בגוגל.', '#/tamima/more', 'met'],
    ['security', 'Referrer', 'מדיניות הפניה', 'referrer="no-referrer": כתובות פנימיות לא נשלחות לאתרים אחרים.', '', 'met'],
    ['security', 'הפרדת תפקידים', 'כל אחד רואה רק את שלו', 'במסכים: לקוח, תמימה וסטודנט מופרדים. אכיפה אמיתית של הרשאות צריכה שרת.', '', 'partial'],
    ['security', 'HTTPS', 'הצפנה בתעבורה', 'GitHub Pages מספק HTTPS. צריך לסמן "Enforce HTTPS" בהגדרות.', '', 'partial'],
    // דורש שרת בגרסה האמיתית
    ['server', 'תקנות אבטחת מידע', 'התחברות מאובטחת', 'סיסמה חזקה ואימות דו שלבי לתמימה, והתחברות לסטודנטים.', '', 'server'],
    ['server', 'תקנות אבטחת מידע', 'בקרת הרשאות בשרת', 'השרת בודק בכל בקשה שהמשתמש רשאי לראות את המידע.', '', 'server'],
    ['server', 'תקנות אבטחת מידע', 'תיעוד גישה', 'יומן פעולות: מי ראה ומי שינה מידע אישי, ומתי.', '', 'server'],
    ['server', 'תקנות אבטחת מידע', 'גיבוי ושחזור', 'גיבוי קבוע של המידע ובדיקת שחזור.', '', 'server'],
    ['server', 'תקנות אבטחת מידע', 'נוהל אבטחה ומסמך הגדרות מאגר', 'מסמכים שנדרשים לפי רמת האבטחה של המאגר.', '', 'server'],
    ['server', 'כותרות אבטחה', 'HSTS ומניעת הטמעה במסגרת', 'כותרות שנשלחות מהשרת (GitHub Pages לא מאפשר להגדיר אותן).', '', 'server'],
    ['server', 'יומן גוגל', 'סנכרון ברקע', 'קליטת הזמנות מערוצים גם כשתמימה לא מחוברת (התראות events.watch).', '', 'server']
  ];
  const AREA = { a11y: 'נגישות', privacy: 'פרטיות', security: 'אבטחת מידע', server: 'דורש שרת' };
  const STATUS = { met: ['מתקיים', 'paid'], partial: ['חלקי', 'requested'], server: ['דורש שרת', 'muted'], external: ['דורש גורם חיצוני', 'muted'] };

  // ---------- בדיקות חיות ----------
  const AUDIT_SCREENS = [
    ['client', '', 'אתר: בית'], ['client', 'workshop', 'אתר: הזמנת סדנה'], ['client', 'course', 'אתר: קורס'],
    ['client', 'accessibility', 'אתר: הצהרת נגישות'], ['client', 'privacy', 'אתר: מדיניות פרטיות'],
    ['tamima', 'home', 'תמימה: בית'], ['tamima', 'calendar', 'תמימה: יומן'], ['tamima', 'classes', 'תמימה: חוגים'],
    ['tamima', 'workshops', 'תמימה: סדנאות'], ['tamima', 'student', 'תמימה: כרטיס סטודנט'], ['tamima', 'receipts', 'תמימה: קבלות'], ['tamima', 'more', 'תמימה: עוד'],
    ['student', 'home', 'סטודנט: בית'], ['student', 'lessons', 'סטודנט: שיעורים'], ['student', 'payments', 'סטודנט: תשלומים']
  ];
  function rgbOf(c) { const m = String(c).match(/[\d.]+/g); return m ? m.map(Number) : null; }
  function lumOf([r, g, b]) { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
  // צבע הרקע האמיתי מאחורי אלמנט (מיזוג שקיפויות). null = רקע תמונה או מעבר צבע, לא ניתן לחשב
  // מחזיר את צבעי הרקע האפשריים מאחורי הטקסט (בודקים את הגרוע מביניהם), או null אם לא ניתן לחשב
  function effectiveBg(el) {
    const layers = [];
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (n.dataset && n.dataset.photoBg) {
        const a = +n.dataset.photoBg;
        let out = [255 * (1 - a) + 28 * a, 255 * (1 - a) + 19 * a, 255 * (1 - a) + 12 * a];
        for (let i = layers.length - 1; i >= 0; i--) { const [r, g, b, al = 1] = layers[i]; out = [r * al + out[0] * (1 - al), g * al + out[1] * (1 - al), b * al + out[2] * (1 - al)]; }
        return [out];
      }
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        if (/url\(/.test(cs.backgroundImage)) return null;
        // מעבר צבע: כל עצירת צבע היא מועמדת, ושקופה חלקית מחושבת גם על לבן וגם על שחור
        // עצירה שקופה לגמרי חושפת את השכבה שמתחת (עצירה אחרת), ולכן לא נחשבת בעצמה
        const stops = (cs.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(rgbOf).filter(c => c[3] == null || c[3] > 0.05);
        if (!stops.length) return null;
        const solid = stops.filter(c => c[3] == null || c[3] >= 1);
        const under = solid.length ? solid : [[255, 255, 255], [0, 0, 0]];
        return stops.flatMap(([r, g, b, a = 1]) => a >= 1 ? [[r, g, b]] : under.map(([ur, ug, ub]) => [r * a + ur * (1 - a), g * a + ug * (1 - a), b * a + ub * (1 - a)]));
      }
      if (n.tagName === 'IMG' || n.tagName === 'SVG') return null;
      const c = rgbOf(cs.backgroundColor);
      if (c && (c[3] == null || c[3] > 0)) { layers.push(c); if (c[3] == null || c[3] >= 1) break; }
    }
    let out = [255, 253, 249];
    for (let i = layers.length - 1; i >= 0; i--) { const [r, g, b, a = 1] = layers[i]; out = [r * a + out[0] * (1 - a), g * a + out[1] * (1 - a), b * a + out[2] * (1 - a)]; }
    return [out];
  }
  function auditDom(root) {
    const vis = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[aria-hidden="true"], .sr-only');
    const res = {};
    const imgs = [...root.querySelectorAll('img')].filter(i => !i.hasAttribute('alt'));
    res.alt = { fail: imgs.length, sample: imgs.slice(0, 2).map(i => i.getAttribute('src')) };
    const names = [...root.querySelectorAll('button, a[href], [role="button"], [role="radio"], [role="tab"]')].filter(vis).filter(b => !(b.innerText.trim() || b.getAttribute('aria-label') || b.getAttribute('title')));
    res.names = { fail: names.length, sample: names.slice(0, 2).map(b => b.className) };
    const fields = [...root.querySelectorAll('input:not([type="hidden"]), select, textarea')].filter(vis).filter(i => !(i.closest('label') || i.getAttribute('aria-label') || i.getAttribute('aria-labelledby') || (i.id && root.querySelector(`label[for="${i.id}"]`))));
    res.labels = { fail: fields.length, sample: fields.slice(0, 2).map(i => i.outerHTML.slice(0, 60)) };
    const mouseOnly = [...root.querySelectorAll('[data-act], [data-go]')].filter(e => !['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL'].includes(e.tagName) && !e.hasAttribute('data-kbd-alt') && !e.hasAttribute('tabindex'));
    res.keyboard = { fail: mouseOnly.length, sample: mouseOnly.slice(0, 2).map(e => e.className) };
    const h1 = root.querySelectorAll('h1').length;
    res.h1 = { fail: h1 === 1 ? 0 : 1, sample: [`${h1} כותרות ראשיות`] };
    const levels = [...root.querySelectorAll('h1, h2, h3, h4')].map(h => +h.tagName[1]);
    const skip = levels.some((l, i) => i && l - levels[i - 1] > 1);
    res.headings = { fail: skip ? 1 : 0, sample: skip ? ['דילוג בין רמות כותרת'] : [] };
    const ids = [...root.querySelectorAll('[id]')].map(e => e.id);
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    res.ids = { fail: dup.length, sample: dup.slice(0, 2) };
    let low = 0, checked = 0, skipped = 0;
    const lowSamples = [];
    [...root.querySelectorAll('*')].filter(e => vis(e) && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())).forEach(e => {
      if (e.closest('button:disabled, [disabled], .dim, .cg-past, .past') || +getComputedStyle(e).opacity < 1) return; // רכיבים לא פעילים פטורים
      let op = 1; for (let n = e; n; n = n.parentElement) op *= +getComputedStyle(n).opacity; if (op < 0.99) return;
      const bg = effectiveBg(e);
      if (!bg) { skipped++; return; }
      const cs = getComputedStyle(e);
      const fg = rgbOf(cs.color);
      const fa = fg[3] == null ? 1 : fg[3];
      const ratio = Math.min(...bg.map(c => {
        const f = [0, 1, 2].map(i => fg[i] * fa + c[i] * (1 - fa));
        const L1 = lumOf(f), L2 = lumOf(c);
        return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      }));
      const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
      const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
      checked++;
      if (ratio < need) { low++; if (lowSamples.length < 3) lowSamples.push(`"${e.innerText.trim().slice(0, 18)}" ${ratio.toFixed(2)}:1`); }
    });
    res.contrast = { fail: low, sample: lowSamples, note: `${checked} טקסטים נבדקו${skipped ? `, ${skipped} על רקע שלא ניתן לחשב` : ''}` };
    return res;
  }
  function runAudit() {
    const box = document.createElement('div');
    box.className = 'audit-box';
    box.inert = true; // לא aria-hidden: הבדיקות מדלגות על תוכן מוסתר, ואז לא היה נבדק כלום
    document.body.appendChild(box);
    const screens = AUDIT_SCREENS.map(([role, page, name]) => {
      box.innerHTML = viewFor({ role, page, param: '' });
      box.querySelectorAll('.reveal').forEach(e => e.classList.add('in'));
      return { name, hash: `#/${role}${page ? '/' + page : ''}`, res: auditDom(box) };
    });
    box.remove();
    // בדיקת הזרקת קוד: טקסט זדוני עובר דרך אותה פונקציית ניקוי שכל המסכים משתמשים בה
    const payload = '<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>';
    const probe = document.createElement('div');
    probe.innerHTML = `<b>${esc(payload)}</b>`;
    const xssOk = !probe.querySelector('img, script') && probe.textContent.includes('<img');
    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    const cspVal = csp ? csp.getAttribute('content') : '';
    const scripts = [...document.scripts];
    const hashes = Object.keys(PAGE_NAMES).map(k => `#/${k}`);
    let ls = [];
    try { ls = Object.keys(localStorage); } catch (e) { /* חסום */ }
    const global = [
      ['שפה וכיוון', document.documentElement.lang === 'he' && document.documentElement.dir === 'rtl', `lang="${document.documentElement.lang}" dir="${document.documentElement.dir}"`],
      ['קישור דילוג לתוכן', !!document.querySelector('.skip-link'), 'דלג לתוכן הראשי'],
      ['כותרת לכל מסך', Object.keys(PAGE_NAMES).length >= 14, `${Object.keys(PAGE_NAMES).length} כותרות מוגדרות`],
      ['מדיניות אבטחת תוכן (CSP)', !!cspVal && /script-src 'self'/.test(cspVal) && !/unsafe-eval/.test(cspVal), cspVal ? 'script-src מוגבל, בלי unsafe-eval' : 'חסרה'],
      ['אין סקריפטים מוטבעים', scripts.every(s => s.src), `${scripts.filter(s => !s.src).length} סקריפטים מוטבעים`],
      ['סקריפטים רק ממקורות מאושרים', scripts.every(s => !s.src || s.src.startsWith(location.origin) || s.src.startsWith('https://accounts.google.com/')), scripts.map(s => (s.src || 'inline').replace(location.origin + '/', '')).join(', ')],
      ['אין מאזיני אירועים בתוך ה-HTML', !document.querySelector('[onclick], [onload], [onerror], [onmouseover]'), 'onclick וכדומה'],
      ['מניעת הזרקת קוד', xssOk, xssOk ? 'טקסט זדוני הוצג כטקסט ולא הורץ' : 'נכשל'],
      ['מדיניות הפניה', !!document.querySelector('meta[name="referrer"][content="no-referrer"]'), 'no-referrer'],
      ['אין מידע אישי בכתובות', hashes.every(h => !/@|\d{9,}/.test(h)), 'נבדקו כל כתובות המסכים'],
      ['אין עוגיות', !document.cookie, document.cookie ? document.cookie : 'אין עוגיות'],
      ['אחסון בדפדפן: רק הגדרות', ls.every(k => k === 'tamima.gcal.v1'), ls.length ? ls.join(', ') : 'ריק'],
      ['פרטי אשראי לא נשמרים', !JSON.stringify(S).match(/\b\d{13,19}\b/), 'אין מספרי כרטיס במצב המערכת']
    ];
    ui.audit = { at: new Date(), screens, global };
  }

  function complianceView() {
    const tab = ui.compTab || 'a11y';
    const list = REQS.filter(r => r[0] === tab);
    const count = k => REQS.filter(r => r[5] === k).length;
    const rows = list.map(([, ref, title, how, where, status]) => `<li class="req-row">
        <div class="req-main"><span class="req-ref" dir="auto">${esc(ref)}</span><b>${esc(title)}</b><p>${esc(how)}</p></div>
        <div class="req-side">${chip(STATUS[status][0], STATUS[status][1])}${where ? `<a class="linkish" href="${where}">לצפייה</a>` : ''}</div>
      </li>`).join('');
    const a = ui.audit;
    const CHECKS = [['alt', 'טקסט חלופי'], ['names', 'שם לכפתורים'], ['labels', 'תוויות לשדות'], ['keyboard', 'מקלדת'], ['h1', 'כותרת ראשית'], ['headings', 'סדר כותרות'], ['ids', 'מזהים ייחודיים'], ['contrast', 'ניגודיות']];
    let auditHtml = `<p class="muted">הבדיקות רצות על כל ${AUDIT_SCREENS.length} המסכים של הדמו, במצב הנוכחי שלהם.</p>`;
    if (a) {
      const fails = a.screens.reduce((n, s) => n + CHECKS.filter(([k]) => s.res[k].fail).length, 0) + a.global.filter(g => !g[1]).length;
      auditHtml = `<p class="audit-sum ${fails ? 'bad' : 'good'}" role="status">${fails ? (fails === 1 ? 'נמצאה בעיה אחת' : `נמצאו ${fails} בעיות`) : 'כל הבדיקות עברו'} · ${a.screens.length} מסכים · ${clock(a.at)}</p>
        <div class="audit-scroll" tabindex="0" role="region" aria-label="תוצאות בדיקה לפי מסך"><table class="audit">
          <caption class="sr-only">תוצאות בדיקות הנגישות לפי מסך</caption>
          <thead><tr><th scope="col">מסך</th>${CHECKS.map(([, l]) => `<th scope="col">${l}</th>`).join('')}</tr></thead>
          <tbody>${a.screens.map(s => `<tr><th scope="row"><a href="${s.hash}">${esc(s.name)}</a></th>${CHECKS.map(([k]) => {
            const r = s.res[k];
            return `<td class="${r.fail ? 'f' : 'p'}" title="${esc((r.sample || []).join(' · ') + (r.note ? ' · ' + r.note : ''))}">${r.fail ? `✕ ${r.fail}` : '✓'}<span class="sr-only">${r.fail ? ' נכשל' : ' עבר'}</span></td>`;
          }).join('')}</tr>`).join('')}</tbody>
        </table></div>
        <p class="muted small">ניגודיות: ${a.screens.reduce((n, x) => n + (+x.res.contrast.note.match(/\d+/)[0]), 0)} טקסטים נבדקו בכל המסכים. טקסט על תמונה נבדק במקרה הגרוע: פיקסל לבן מתחת לשכבה הכהה. מעבר צבע נבדק בכל אחד מהצבעים שלו.</p>
        <h3>בדיקות כלליות ואבטחה</h3>
        <ul class="audit-global">${a.global.map(([name, ok, det]) => `<li class="${ok ? 'p' : 'f'}"><span aria-hidden="true">${ok ? '✓' : '✕'}</span><b>${esc(name)}</b><span class="sr-only">${ok ? 'עבר' : 'נכשל'}</span><small dir="auto">${esc(det)}</small></li>`).join('')}</ul>`;
    }
    return `<div class="appshell comp">
      <header class="comp-head"><div class="wrap wide">
        <span class="eyebrow light">למציג בלבד</span>
        <h1>תאימות ואבטחה</h1>
        <p>איך הדמו עומד בתקנות הנגישות לשירות (ת"י 5568), בחוק הגנת הפרטיות ובתקנות אבטחת מידע.</p>
        <div class="comp-stats">${Object.entries(STATUS).map(([k, [l]]) => `<div><b>${count(k)}</b><span>${l}</span></div>`).join('')}</div>
      </div></header>
      <main id="main" class="wrap wide">
        <section class="card" aria-labelledby="audit-h">
          <div class="row-between"><h2 id="audit-h">בדיקות חיות</h2><button class="btn primary small" data-act="runAudit">${a ? 'הרצה מחדש' : 'הרצת הבדיקות'}</button></div>
          ${auditHtml}
        </section>
        <h2 class="sec">דרישות</h2>
        <div class="tabs" role="tablist" aria-label="תחום">${Object.entries(AREA).map(([k, l]) => `<button role="tab" aria-selected="${tab === k}" class="${tab === k ? 'on' : ''}" data-act="compTab" data-t="${k}">${l} (${REQS.filter(r => r[0] === k).length})</button>`).join('')}</div>
        <ul class="req-list" role="tabpanel" aria-label="${AREA[tab]}">${rows}</ul>
        <p class="note">הדמו בנוי לפי הדרישות ומראה אותן, אבל הוא לא תעודת תאימות. לפני העלייה לאוויר נדרשות בדיקה של מורשה נגישות שירות ובדיקה מול יועץ פרטיות.</p>
      </main></div>`;
  }

  /* ================= שכבת הדגמה מודרכת ================= */
  const KIND = { api: 'Google Calendar API', 'mail-client': 'מייל ללקוח', 'mail-student': 'הודעה לסטודנט', notify: 'התראה לתמימה', sync: 'סנכרון יומן', sumit: 'סאמיט', whatsapp: 'וואטסאפ' };

  function guideInfo(r) {
    const key = `${r.role}/${r.page || 'home'}`;
    const q = [];
    const G = {
      'client/home': ['האתר הציבורי', ['באתר מוצג רק מה שרלוונטי: סדנה או קורס.', '"כלי קרמיקה" (חנות) לא מופיע, הוא מתוכנן לשלב הבא.'], []],
      'client/workshop': ['הזמנת סדנה', {
        slot: ['המחיר מחושב מהמחירון שתמימה מגדירה במסך "עוד", ומתעדכן מיד כשמשנים את מספר המשתתפים.', 'האתר מציע רק משבצות ששייכות לערוץ האתר, ושפנויות גם ביומן הסטודיו וגם ביומן האישי.', 'משבצות שמשויכות לערוץ שותף (למשל "בסלון") לא מופיעות כאן, עד שהן משתחררות.', 'סדנה של שעתיים מוצעת רק כשיש שעתיים פנויות. למשל בימים ראשון עד שלישי אין 18:00, בגלל החוג.'],
        details: ['הפרטים נדרשים לפני התשלום כדי לשלוח אישור וחשבונית.'],
        summary: ['אין כאן טקסט על "שמירת מקום": מוצג רק מה שחשוב להזמנה.'],
        pay: ['"לתשלום" יצר הזמנה בסטטוס "ממתין לתשלום", ודף תשלום בסאמיט (beginredirect, עם כתובת IPN וחשבונית מס קבלה). המועד נשמר כבר מהמעבר לפרטים, ל-10 דקות שמתחדשות כל עוד ממלאים את ההזמנה. תמימה רואה אותו ביומן כ"בתהליך הזמנה", בלי פרטים אישיים.', 'תשלום שנכשל משאיר את ההזמנה "ממתין לתשלום", ואפשר לנסות שוב.', 'הסטטוס משתנה ל\'שולם\' רק אחרי הודעת שרת מסאמיט (IPN), לא מדף התודה.', 'מסך סאמיט מדומה. באמת: התשלום בכרטיס אשראי בעמוד המאובטח של סאמיט.', 'אחרי החיוב, סאמיט מפיק חשבונית מס קבלה ושולח אותה למערכת, לא ללקוח. בהגדרות סאמיט כבויה השליחה האוטומטית ללקוח, כדי שהקבלה לא תישלח פעמיים.'],
        confirming: ['סאמיט שולח למערכת אישור תשלום (הודעת שרת). רק האישור הזה סוגר את המועד ביומן, ולא דף התודה.', 'המערכת שומרת את הקבלה בכרטיס הלקוח, ואז שולחת ללקוח מייל אחד: פרטי הסדנה והקבלה.'],
        done: ['למטה: המייל שנשלח וההזמנה שנכנסה לדשבורד של תמימה. אפשר לעבור ל"תמימה" ולראות אותה ביומן ובסדנאות.']
      }[bk.step] || [], ['מחירון הסדנאות (בדמו: זוג 680 ₪, 3 עד 6: 300 ₪ למשתתף).', 'מדיניות ביטול לסדנה (בדמו: 48 שעות).']],
      'client/course': ['קורס שיעורים', ['מספר המקומות הפנויים מחושב מ"מקסימום מקומות" שתמימה מגדירה לכל קבוצה, לא ממספר האובניים.', 'פנייה שנשלחת כאן מופיעה אצל תמימה ב"ממתין לך עכשיו".'], ['הרשמה ישירה או השארת פרטים (בדמו: השארת פרטים).', 'כמה סטודנטים בסך הכל או ליום.', 'קבוצת "שני בבוקר 9:30" (בדמו: לא קיימת).']],
      'tamima/home': ['בית', ['"ממתין לך עכשיו" מציג רק דברים שדורשים פעולה ממך. כל השאר קורה לבד.', 'המדדים מחושבים מהנתונים עצמם: תשלומי כרטיסיות וסדנאות החודש.'], ['התראה על כל הזמנה חדשה, או שמספיק שזה מופיע בדשבורד (בדמו: הודעה קופצת במצב הדגמה בלבד).']],
      'tamima/calendar': ['יומן מאוחד, מחובר ליומן גוגל', [
        'המערכת קוראת וכותבת רק דרך Google Calendar API v3. בחלון "קריאות API בשלב הזה" רואים כל קריאה.',
        'יומנים: הסטודיו (הכל), האישי של תמימה (נקרא רק כתפוס או פנוי), ויומן נפרד לכל ערוץ שיווק.',
        'משבצות בלעדיות: כל משבצת פנויה שייכת לערוץ אחד (extendedProperties.private.channel) ונכתבת רק ליומן שלו. הזמנה בכל ערוץ מוחקת אותה מכל היומנים.',
        'שחרור אוטומטי: משבצת שלא נמכרה בערוץ שותף יורדת ממנו כמה ימים לפני המועד (ברירת מחדל 5), וממתינה (ברירת מחדל 24 שעות) לפני שהיא נפתחת באתר.',
        'נסו: "פתיחת מועדים", בחרו ערוץ וכמה זמנים ברשת. או לחצו "קדם זמן" כמה פעמים וראו משבצת של "בסלון" משתחררת, ממתינה ונפתחת באתר.',
        'מעבר בין שבועות לא שולח קריאות חדשות לגוגל: הנתונים נקראים פעם אחת לטווח ונשמרים עד הכתיבה הבאה.',
        'זמינות מחושבת עם freebusy.query על יומן הסטודיו וגם על היומן האישי. אירוע אישי חוסם משבצת בכל הערוצים.',
        'חוגים הם אירוע חוזר אחד לכל קבוצה (RRULE שבועי). שינויים מערוץ נקלטים בסנכרון מצטבר (syncToken).'
      ], ['איך ערוץ מסמן הזמנה: עריכת האירוע ביומן המשותף, או הודעה לתמימה (בדמו: עריכת האירוע).', 'האם לשחרר משבצת בשעה קבועה ביום (למשל 9:00), או בדיוק X ימים לפני המועד (בדמו: בדיוק).'],
      '<button class="btn demo block" data-act="addPersonal">הדגמה: תמימה הוסיפה אירוע ביומן האישי</button>'],
      'tamima/classes': ['חוגים ונוכחות', ['הזרימה האוטומטית: סימון נוכחות בשיעור 3 בכרטיסייה שולח דרישת תשלום בסאמיט. תשלום מסמן "שולם" ומפיק חשבונית מס קבלה.', 'לא שולם עד שיעור 4: עובר ל"דורש טיפול" בבית, עם כפתור תזכורת.', 'נסו: הוסיפו סטודנט, וסמנו "הגעה" בשלושה שיעורים. אחרי השלישי נשלחת דרישת תשלום.', '"ביטול בזמן" מזכה אוטומטית בהשלמה אחת בחודש.'], []],
      'tamima/workshops': ['סדנאות', ['סדנה מהאתר תמיד שולמה מראש וקיבלה קבלה אוטומטית.', 'בלשונית "לקוחות": כרטיס לכל לקוח, עם הסדנאות והקבלות. הזמנה חוזרת מאותו טלפון נכנסת לאותו כרטיס.', 'סדנה מ"בסלון" שולמה ב"בסלון", וצריך להפיק לה קבלה ידנית.', 'מייל משוב יוצא אוטומטית אחרי הסדנה. אפשר לשלוח ידנית, או בוואטסאפ כאופציה שנייה.'], []],
      'tamima/receipts': ['קבלות', ['הטופס מתמלא מראש מההזמנה, ולחיצה אחת מפיקה חשבונית מס קבלה בסאמיט ושולחת ללקוח.'], ['איזה סכום נכנס לקבלה: מחיר מלא או אחרי עמלת "בסלון" (בדמו: מחיר מלא). לאמת מול רואה החשבון.']],
      'tamima/student': ['כרטיס סטודנט', ['כל מה שקשור לסטודנט במקום אחד: פרטים, כרטיסייה, תשלומים, השלמות ושיעורים.', 'כל שינוי כאן מופיע מיד גם אצל הסטודנט, ברשימת הנוכחות ובבית של תמימה.'], []],
      'tamima/more': ['ערוצים והגדרות', ['ערוץ חדש יוצר יומן גוגל חדש (calendars.insert). משבצות שמשויכות אליו נכתבות רק ליומן הזה.', 'ערוץ לא נמחק: הוא מסומן "לא פעיל", היומן וההיסטוריה נשמרים, ומשבצות עתידיות חוזרות לאתר.', 'שינוי מחירון משתקף מיד באתר ההזמנות.'], ['שיתוף יומן הערוץ עם השותף (acl.insert): הרשאת צפייה או עריכה?']],
      'client/accessibility': ['הצהרת נגישות', ['עמוד חובה לפי תקנות הנגישות לשירות.', 'טופס הפנייה נגיש: תוויות, שדות חובה, והודעת שגיאה שמוקראת.'], ['פרטי הקשר הישירים של רכזת הנגישות.', 'נגישות פיזית של הסטודיו (גישה, חניה, שירותים).']],
      'client/privacy': ['מדיניות פרטיות', ['מבוססת על מה שהמערכת באמת אוספת ועושה.'], ['תקופות שמירה מדויקות, מול רואה החשבון.', 'בדיקה של יועץ פרטיות לפני העלייה לאוויר.']],
      'compliance/home': ['תאימות ואבטחה', ['מסך למציג: הדרישות מכל תקן, והבדיקות החיות.'], []],
      'student/home': ['בית הסטודנט', ['באזור האישי מוצג רק המידע של בעל/ת הקישור: השיעור הבא לפי הקבוצה, כרטיסייה, השלמות ותשלום.'], []],
      'student/lessons': ['ביטול והשלמה', ['יותר מ-24 שעות לפני: השלמה בתוקף לחודש. מוגבל להשלמה אחת בחודש.', 'פחות מ-24 שעות: ביטול מאוחר, נספר כשיעור שנוצל. ההודעה מוצגת לפני האישור.', 'כל ביטול מסומן מיד גם אצל תמימה ברשימת הנוכחות.'], ['ביטול בזמן כשכבר נוצלה השלמה החודש: האם נספר בכרטיסייה? (בדמו: לא נספר).']],
      'student/makeup': ['קביעת השלמה', ['מוצגות רק קבוצות אחרות שיש בהן מקום, עד תום תוקף ההשלמה. המקום נתפס מיד גם ברשימה של תמימה.'], []],
      'student/payments': ['תשלומים', ['דרישת תשלום נשלחת אוטומטית אחרי השיעור השלישי בכרטיסייה.', 'תשלום בכרטיס אשראי בלבד, בקישור סאמיט. לא בהעברה בנקאית.', 'הסטטוס משתנה ל"שולם" רק אחרי הודעת שרת מסאמיט (IPN), לא מדף התודה.'], []],
      'student/pay': ['תשלום', ['אחרי התשלום: הסטטוס מתעדכן אצל תמימה ל"שולם" וחשבונית מס קבלה נשלחת לסטודנט.'], []]
    };
    const [title, points, questions, extra] = G[key] || ['', [], []];
    return { title, points, questions: questions.concat(q), extra: extra || '' };
  }

  function renderGuide(r) {
    const el = $('#guide');
    document.body.classList.toggle('guided', ui.guided);
    document.body.classList.toggle('guide-open', ui.guided && ui.guideOpen);
    if (!ui.guided) { el.innerHTML = ''; return; }
    const info = guideInfo(r);
    const sec = (k, title, count, body, openByDefault) => {
      const open = ui.gsec[k] != null ? ui.gsec[k] : openByDefault;
      return `<section class="gsec${open ? ' open' : ''}">
        <button class="gsec-h" data-act="gsecToggle" data-k="${k}" aria-expanded="${open}">${title}${count ? ` <i>${count}</i>` : ''}<span aria-hidden="true">${open ? '−' : '+'}</span></button>
        ${open ? `<div class="gsec-b">${body}</div>` : ''}
      </section>`;
    };
    const logs = S.log.slice(0, 6).map(e => `<div class="log log-${e.kind}">
        <div class="log-k">${KIND[e.kind] || ''} · ${clock(e.at)}</div><b>${esc(e.title)}</b>${e.body ? `<p>${esc(e.body)}</p>` : ''}</div>`).join('');
    const notes = complNotes(r);
    el.innerHTML = `<button class="guide-handle" data-act="guideToggle" aria-expanded="${ui.guideOpen}">מאחורי הקלעים ${S.log.length ? `<i>${S.log.length}</i>` : ''}</button>
      <div class="guide-body" role="region" aria-label="הדגמה מודרכת">
        <div class="guide-top"><span class="guide-tag">הדגמה מודרכת</span><button class="guide-x" data-act="guideToggle" aria-label="סגירת חלונית ההדגמה">×</button></div>
        <h2>${info.title || 'מה קורה מאחורי הקלעים'}</h2>
        <ul class="guide-points">${info.points.map(p => `<li>${p}</li>`).join('')}</ul>
        ${info.extra}
        ${notes ? sec('notes', 'נגישות ופרטיות ללקוח', 0, notes, false) : ''}
        ${info.questions.length ? sec('q', '❓ לאמת מול תמימה', info.questions.length, `<ul>${info.questions.map(p => `<li>${p}</li>`).join('')}</ul>`, false) : ''}
        ${sec('log', 'מה נשלח ועודכן', S.log.length, logs || '<p class="empty small">עדיין לא נשלח דבר. בצעו פעולה באחד המסכים.</p>', S.log.length > 0)}
        ${sec('api', 'קריאות ליומן בשלב הזה', trace.calls.length, traceHtml(), false)}
      </div>`;
  }

  $('#guidedToggle').addEventListener('change', e => { beginStep('הפעלת ההדגמה המודרכת'); ui.guided = e.target.checked; ui.guideOpen = ui.guided && window.innerWidth >= 900; render(); });
  $('#resetBtn').addEventListener('click', () => {
    closeTools();
    beginStep('איפוס הדמו');
    if (gsLive()) GS.disconnect(false); // לא מעלים את נתוני הדמו מחדש ליומן אמיתי
    reset(); location.hash = '#/client'; render();
  });
  $('#failRefundBtn').addEventListener('click', () => { closeTools(); sumitStore().failNextRefund = true; snack('הזיכוי הבא שתמימה תבצע ייכשל בסאמיט, כדי לראות מה קורה.'); });
  $('#advBtn').addEventListener('click', () => { closeTools(); beginStep('קדם זמן: יום אחד'); A.advance({ h: 24 }); });
  // תפריט הכלים של הדמו: נסגר ב-X, ב-Esc, בלחיצה מחוץ לו, ואחרי בחירה
  const toolsBtn = $('#toolsBtn'), toolsMenu = $('#toolsMenu');
  function closeTools(focusBack) { if (toolsMenu.hidden) return; toolsMenu.hidden = true; toolsBtn.setAttribute('aria-expanded', 'false'); if (focusBack) toolsBtn.focus(); }
  toolsBtn.addEventListener('click', e => { e.stopPropagation(); const open = toolsMenu.hidden; toolsMenu.hidden = !open; toolsBtn.setAttribute('aria-expanded', String(open)); if (open) toolsMenu.querySelector('a, button:not(.x-btn)').focus(); });
  toolsMenu.querySelector('.x-btn').addEventListener('click', () => closeTools(true));
  toolsMenu.querySelector('a').addEventListener('click', () => closeTools());
  document.addEventListener('click', e => { if (!e.target.closest('.tools')) closeTools(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !toolsMenu.hidden) { e.stopImmediatePropagation(); closeTools(true); } }, true);

