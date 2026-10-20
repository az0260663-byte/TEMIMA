/* boot.js: ניתוב, רינדור ואתחול. נטען אחרון בכל דף. */
'use strict';

  // איזה אזור מוצג, לפי הדף ולפי הכתובת. אזור שלא נטען בדף הזה לא מוצג
  function viewFor(r) {
    // ניהול מול השרת: מסך כניסה או טעינה עד שהנתונים מוכנים
    const gate = typeof backendScreen === 'function' ? backendScreen() : '';
    if (gate) return gate;
    if (r.role === 'tamima' && typeof tamimaView === 'function') return tamimaView(r);
    if (r.role === 'student' && typeof studentView === 'function') return studentView(r);
    if (r.role === 'compliance' && typeof complianceView === 'function') return complianceView();
    return typeof clientView === 'function' ? clientView(r) : '';
  }

  /* ---------- ניתוב ורינדור ---------- */
  function route() {
    const p = location.hash.replace(/^#\/?/, '').split('/');
    return { role: ['client', 'tamima', 'student', 'compliance'].includes(p[0]) ? p[0] : 'client', page: p[1] || '', param: p[2] || '' };
  }
  const trace = { label: 'טעינת הדמו', calls: [], cacheHits: 0 };
  function beginStep(label) { trace.label = label; trace.calls = []; trace.cacheHits = 0; }
  G.onCall = c => { if (trace.calls.length < 500) trace.calls.push(c); };
  const PAGE_NAMES = { 'tamima/student': 'תמימה: כרטיס סטודנט', 'compliance/': 'תאימות ואבטחה', 'client/accessibility': 'אתר: הצהרת נגישות', 'client/privacy': 'אתר: מדיניות פרטיות', 'client/': 'אתר: בית', 'client/workshop': 'אתר: הזמנת סדנה', 'client/booking': 'אתר: ההזמנה שלי', 'client/course': 'אתר: קורס', 'tamima/home': 'תמימה: בית', 'tamima/calendar': 'תמימה: יומן', 'tamima/classes': 'תמימה: חוגים', 'tamima/workshops': 'תמימה: סדנאות', 'tamima/receipts': 'תמימה: קבלות', 'tamima/more': 'תמימה: עוד', 'student/home': 'סטודנט: בית', 'student/lessons': 'סטודנט: שיעורים', 'student/payments': 'סטודנט: תשלומים', 'student/makeup': 'סטודנט: השלמה', 'student/pay': 'סטודנט: תשלום', 'student/leave': 'סטודנט: סיום הקורס', 'student/policy': 'סטודנט: מדיניות' };
  function traceHtml() {
    const groups = [];
    trace.calls.forEach(c => {
      const m = c.path.match(/^\/calendars\/([^/]+)/);
      const cal = m ? G.calendarName(m[1]) : '';
      const last = groups[groups.length - 1];
      if (last && last.name === c.name && last.cal === cal) last.n++;
      else groups.push({ name: c.name, http: c.http, cal, detail: c.detail, path: c.path, remote: c.remote, n: 1 });
    });
    const reads = trace.calls.filter(c => c.http === 'GET' || c.name === 'freebusy.query').length;
    const rows = groups.slice(0, 60).map(g => `<li class="${g.http === 'GET' || g.name === 'freebusy.query' || /freeBusy/.test(g.path) ? 'rd' : 'wr'}">${g.remote ? '<em class="gg">גוגל</em>' : ''}<code>${g.name}</code>${g.n > 1 ? `<i>×${g.n}</i>` : ''}<span>${esc(g.cal || g.detail)}</span>${g.cal && g.detail ? `<small>${esc(g.detail)}</small>` : ''}<small dir="ltr" class="path">${g.http} ${esc(shortPath(g.path))}</small></li>`).join('');
    return `<div class="trace"><div class="trace-h"><b>קריאות API בשלב הזה</b><span>${esc(trace.label)}</span></div>
      ${trace.calls.length ? `<p class="trace-sum">${trace.calls.length} קריאות · ${reads} קריאה · ${trace.calls.length - reads} כתיבה</p><ol>${rows}</ol>${groups.length > 60 ? '<p class="small muted">ועוד...</p>' : ''}` : '<p class="empty small">לא נשלחו קריאות בשלב הזה.</p>'}
      ${trace.cacheHits ? `<p class="trace-cache">נתוני היומן נקראו מהעותק המקומי (${trace.cacheHits} פעמים), בלי קריאה חדשה לגוגל. העותק מתרענן אחרי כל כתיבה.</p>` : ''}</div>`;
  }
  let lastKey = '';
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const revealObs = 'IntersectionObserver' in window
    ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); revealObs.unobserve(e.target); } }), { threshold: 0.12 })
    : null;
  function render() {
    const r = route();
    if (PORTAL) {
      const [role, home] = PORTAL_ROLE[PORTAL.kind];
      if (r.role !== role) { location.replace(home); return; }
    }
    const key = `${r.role}/${r.page}/${r.page === 'workshop' ? bk.step : r.param}`;
    const html = viewFor(r);
    const app = $('#app');
    const gated = typeof backendScreen === 'function' && backendScreen();
    document.title = gated ? 'כניסה לניהול | הסטודיו של תמימה' : `${(PAGE_NAMES[`${r.role}/${r.page}`] || 'הסטודיו של תמימה').replace(': ', ' · ')} | הסטודיו של תמימה`;
    app.innerHTML = html;
    if (key !== lastKey && !reduceMotion) { app.classList.remove('page-enter'); void app.offsetWidth; app.classList.add('page-enter'); }
    lastKey = key;
    document.querySelectorAll('.reveal').forEach(el => (revealObs && !reduceMotion ? revealObs.observe(el) : el.classList.add('in')));
    document.body.dataset.role = r.role;
    document.querySelectorAll('#demobar .roles a').forEach(a => a.classList.toggle('on', a.dataset.role === r.role));
    renderSheet();
    if (typeof renderGuide === 'function') renderGuide(r);
    const lbl = $('#clockLbl');
    if (lbl) lbl.textContent = G.clock.offset ? `${shortDay(todayIso())} ${clock(now())}` : '';
    document.querySelectorAll('#demobar [data-role]').forEach(a => a.toggleAttribute('aria-current', a.dataset.role === r.role));
    focusPending();
    shareState();
    if (typeof backendAfterRender === 'function') backendAfterRender();
  }
  // מיקוד אחרי רינדור: שדה עם שגיאה, או רכיב שביקשו להחזיר אליו מיקוד
  function focusPending() {
    if (!ui.focusSel) return;
    const el = document.querySelector(ui.focusSel);
    ui.focusSel = null;
    if (el) { if (!el.matches('a, button, input, select, textarea, [tabindex]')) el.setAttribute('tabindex', '-1'); el.focus(); }
  }
  // במעבר מסך המיקוד עובר לכותרת הראשית, כך שקורא מסך מקריא איפה המשתמש נמצא
  function focusMain() {
    const h = document.querySelector('#main h1') || $('#main');
    if (!h) return;
    h.setAttribute('tabindex', '-1');
    h.focus({ preventScroll: true });
  }

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (el && A[el.dataset.act]) {
      if (el.tagName !== 'A' || el.getAttribute('href').startsWith('javascript')) e.preventDefault();
      if (!['guideToggle', 'closeSheet'].includes(el.dataset.act)) beginStep(`לחיצה: ${(el.getAttribute('aria-label') || el.innerText || el.dataset.act).replace(/\s+/g, ' ').trim().slice(0, 48)}`);
      e.stopPropagation();
      if (!['gridClick', 'popCh', 'popOpen', 'popBlock', 'popClose', 'guideToggle'].includes(el.dataset.act)) ui.pop = null;
      A[el.dataset.act](el.dataset, el, e);
      return;
    }
    const go = e.target.closest('[data-go]');
    if (go && !e.target.closest('a,button')) location.hash = go.dataset.go;
  });
  document.addEventListener('input', e => {
    const b = e.target.dataset.bind;
    if (!b) return;
    const [root, key] = b.split('.');
    const obj = bindRoot(root);
    if (obj) obj[key] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (root === 'bk' && typeof touchHold === 'function') touchHold(bk.hold);
    // כפתור שמחכה לשדה (למשל "ביצוע זיכוי" עד שיש סכום)
    document.querySelectorAll(`[data-needs="${b}"]`).forEach(x => { x.disabled = !String(e.target.value).trim(); });
    // חיפוש שמתעדכן בזמן ההקלדה, בלי לאבד את מיקום הסמן
    if (e.target.dataset.live === 'page') { const pos = e.target.selectionStart; render(); const el = document.querySelector(`[data-bind="${b}"]`); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (err) { /* סוג שדה בלי סמן */ } } }
  });
  function bindRoot(root) { return { bk, lead, rcpt: ui.rcpt, chf: ui.chf, accForm: ui.accForm, nsf: ui.nsf, gsChoice: ui.gsChoice, stf: ui.stf, gf: ui.gf, wsf: ui.wsf, mvf: ui.mvf, bf: ui.bf, stq: ui.stq, cf: ui.cf, rf: ui.rf, cq: (ui.cq = ui.cq || { q: '' }), pol: (ui.pol = ui.pol || { ok: false }), lv: ui.lv, ld: ui.ld, evf: ui.evf, pr: ui.pr }[root]; }
  document.addEventListener('change', e => {
    if (e.target.matches('select[data-me]')) { ui.meId = e.target.value; render(); return; }
    const k = e.target.dataset.setting;
    if (k) { const v = Number(e.target.value); if (e.target.value !== '' && v >= 0) S.settings[k] = v; render(); }
    const kt = e.target.dataset.settext;
    if (kt) { S.settings[kt] = e.target.value.trim(); snack('נשמר.'); }
    const cs = e.target.dataset.chset;
    if (cs) {
      const [id, field] = cs.split('|');
      beginStep('עדכון הגדרות ערוץ');
      saveChannel(id, { [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
    }
    const ct = e.target.dataset.chtimes;
    if (ct != null) {
      beginStep('עדכון שעות ברירת מחדל');
      const list = e.target.value.split(/[,\s]+/).filter(Boolean).map(t => (/^\d:\d\d$/.test(t) ? '0' + t : t));
      const times = G.channels.slotTimes();
      times[ct] = list;
      saveChannel(HOME, { slotTimes: times }, true);
    }
    if (e.target.dataset.bind) { const [root, key] = e.target.dataset.bind.split('.'); const obj = bindRoot(root); if (obj) obj[key] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; }
    if (e.target.dataset.rerender === 'sheet') renderSheet();
    if (e.target.dataset.rerender === 'page') render();
    // הערות בכרטיס הסטודנט
    if (e.target.dataset.mailauto) { S.mail.auto[e.target.dataset.mailauto] = e.target.checked; snack(e.target.checked ? 'המייל יישלח אוטומטית.' : 'המייל לא יישלח.'); }
    if (e.target.dataset.note) { const st = student(e.target.dataset.note); st.notes = e.target.value; snack('ההערה נשמרה.'); }
    // תוכן האתר
    const ck = e.target.dataset.content;
    if (ck && (e.target.type !== 'radio' || e.target.checked)) {
      beginStep('עדכון תוכן האתר');
      const err = setContent(ck, e.target.value);
      ui.cMsg = err ? { ok: false, text: err } : { ok: true, text: 'נשמר. האתר עודכן.' };
      render();
      clearTimeout(ui.cMsgT); ui.cMsgT = setTimeout(() => { ui.cMsg = null; }, 4000);
    }
    if (e.target.hasAttribute && e.target.hasAttribute('data-gallery')) {
      const list = [...document.querySelectorAll('[data-gallery]:checked')].map(x => x.value);
      const err = setContent('gallery', list);
      ui.cMsg = err ? { ok: false, text: err } : { ok: true, text: 'הגלריה עודכנה.' };
      render();
    }
  });
  window.addEventListener('hashchange', () => {
    ui.sheet = null; ui.pop = null; if (ui.bulk.on && !location.hash.includes('calendar')) ui.bulk = { on: false, ch: ui.bulk.ch, sel: [] }; if (window.innerWidth < 900) ui.guideOpen = false;
    const rr = route();
    beginStep(`מעבר למסך: ${PAGE_NAMES[`${rr.role}/${rr.page}`] || location.hash}`);
    render();
    window.scrollTo(0, 0);
    focusMain();
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (ui.pop) { ui.pop = null; render(); } else if (ui.sheet) closeSheet(); else if (ui.bulk.on) A.bulkOff();
  });
  const hasCal = typeof isMobileCal === 'function';
  let lastMobile = hasCal && isMobileCal();
  window.addEventListener('resize', () => { if (!hasCal) return; const m = isMobileCal(); if (m !== lastMobile) { lastMobile = m; if (route().page === 'calendar') render(); } });
  window.addEventListener('scroll', () => document.body.classList.toggle('scrolled', window.scrollY > 40), { passive: true });

  // כל כתיבה ליומן נרשמת בחלונית ההדגמה, כמו הבקשה שתצא ל-Google Calendar API
  const API_NAME = { POST: 'insert', PATCH: 'patch', DELETE: 'delete' };
  function shortPath(path) { return path.replace(/\/calendars\/([^/]+)/, (m0, id) => `/calendars/{${id === CAL.studio ? 'studio' : id === CAL.classes ? 'classes' : id === CAL.personal ? 'primary' : (G.channels.list().find(c => c.calendarId === id) || { id: id.slice(0, 8) }).id}}`); }
  const API_KEYS = ['id', 'summary', 'start', 'end', 'recurrence', 'transparency', 'visibility', 'colorId', 'extendedProperties'];
  G.onWrite = (method, path, body) => {
    if (!S) return;
    const m = path.match(/^\/calendars\/([^/]+)/);
    const calName = m ? G.calendarName(m[1]) : 'Google Calendar';
    const brief = body ? JSON.stringify(Object.fromEntries(Object.entries(body).filter(([k]) => API_KEYS.includes(k)))) : '';
    const apiName = path === '/calendars' ? 'calendars.insert' : /^\/calendars\/[^/]+$/.test(path) ? 'calendars.patch' : `events.${API_NAME[method]}`;
    log('api', `${apiName} · ${calName}`, `${method} ${shortPath(path)}${brief ? '\n' + brief : ''}`);
  };

  if (GS) {
    // ברגע שהחיבור מושלם (גם אחרי רענון), העבודה המתוזמנת רצה על הנתונים שהגיעו מגוגל
    let wasConnected = false;
    GS.onChange(() => {
      const now = GS.state().status === 'connected';
      if (now && !wasConnected) setTimeout(runSync, 0);
      wasConnected = now;
      scheduleRender();
    });
    if (typeof onRemoteChanges === 'function') GS.onRemote = onRemoteChanges;
    GS.onCall = c => { if (trace.calls.length < 500) trace.calls.push(c); };
  }
  document.querySelector('.skip-link').addEventListener('click', e => { e.preventDefault(); focusMain(); });

  /* שיתוף מצב הדמו בין לשוניות: קישור אישי מהמייל נפתח בלשונית חדשה ומקבל את הנתונים מהלשונית של הדמו.
     תשלום שנעשה שם מופיע מיד אצל תמימה. האתר הציבורי (?p=site) עומד בפני עצמו ולא משתתף בשיתוף. */
  const chan = 'BroadcastChannel' in window ? new BroadcastChannel('tamima-demo') : null;
  // האתר הציבורי עומד בפני עצמו. רק קישור אישי להזמנה ("ההזמנה שלי") מקבל את הנתונים מהלשונית של הדמו
  // ניהול מול השרת לא משתף נתונים בין לשוניות: כל לשונית טוענת ושומרת מול השרת
  const serverOwned = () => typeof backendActive === 'function' && backendActive();
  const shares = !PORTAL || PORTAL.kind !== 'site' || !!PORTAL.b;
  let adopting = false, bcT = null, portalReady = !PORTAL || PORTAL.kind === 'studio';
  function shareState() {
    if (!chan || !shares || adopting || !portalReady || serverOwned()) return;
    clearTimeout(bcT);
    bcT = setTimeout(() => chan.postMessage({ t: 'state', s: JSON.stringify(S) }), 150);
  }
  function adoptState(json) {
    const x = JSON.parse(json);
    (x.log || []).forEach(e => { e.at = new Date(e.at); });
    ((x.mail || {}).outbox || []).forEach(m => { m.at = new Date(m.at); });
    S = x;
    ui.portalWait = false;
    adopting = true;
    try { render(); } finally { adopting = false; }
  }
  if (chan && shares) chan.onmessage = e => {
    if (serverOwned()) return;
    const d = e.data || {};
    if (d.t === 'need' && (!PORTAL || PORTAL.kind === 'studio')) chan.postMessage({ t: 'state', s: JSON.stringify(S) });
    if (d.t === 'state') { portalReady = true; adoptState(d.s); }
  };
  if (PORTAL) {
    document.body.classList.add('portal', `portal-${PORTAL.kind}`);
    ui.guided = false;
  }

  reset();
  if (PORTAL && (PORTAL.kind === 'student' || PORTAL.b)) {
    ui.portalWait = true;
    if (chan) chan.postMessage({ t: 'need' });
    setTimeout(() => { if (!portalReady) { ui.portalWait = false; render(); } }, 1500);
  }
  // בניהול מול השרת, האוטומציות רצות רק אחרי שהנתונים האמיתיים נטענו
  const viaServer = typeof backendBoot === 'function' && backendBoot();
  if (!viaServer) runAutomations();
  render();
  setInterval(() => { if (!serverOwned() || BE.status === 'ready') runAutomations(); }, 60 * 1000);
