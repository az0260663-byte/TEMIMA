/* backend.js: חיבור הניהול לשרת של הסטודיו. נטען רק בדף הניהול (studio.html), לפני boot.js.
 *
 * כשהדף מוגש מהשרת: מסך כניסה לתמימה, טעינת הנתונים מהשרת, ושמירה של מה שהשתנה אחרי כל פעולה.
 * כשאין שרת (למשל הדמו בגיטהאב): לא עושה כלום, והדף עובד כדמו כמו קודם.
 *
 * איך נשמר: כל פריט עם מזהה (סטודנט, סדנה, תשלום...) הוא רשומה נפרדת, ולכל רשימה יש רשומת סדר.
 * מידע בלי מזהים (הגדרות, נוכחות) נשמר כרשומה אחת. היומן נשמר כאירוע לכל רשומה.
 * אחרי כל פעולה משווים למה שנשמר בפעם הקודמת, ושולחים רק את ההבדל.
 */
'use strict';

  // off: אין שרת (דמו) · checking: בודקים · signin: מסך כניסה · loading: טוענים · ready: עובדים מול השרת
  const BE = { status: 'off', error: '', account: '', busy: false, saving: 'idle', rev: 0, configured: true };
  let saved = new Map(); // מה שנמצא בשרת: מפתח רשומה -> התוכן בצורה קבועה (מפתחות ממוינים)
  let saveT = null, inflight = null, retryMs = 2000, lastSig = '', lastSaveId = '', resave = false;
  const backendActive = () => BE.status !== 'off';
  const ID_OK = /^[\w.:@-]{1,200}$/;
  const CHUNK_ROWS = 1000, CHUNK_BYTES = 3 * 1024 * 1024; // חלק אחד בשמירה גדולה

  // צורה קבועה להשוואה: אותו תוכן תמיד נותן אותה מחרוזת, בלי קשר לסדר המפתחות
  const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(key => [key, x[key]])) : x));
  const calKey = (calId, evId) => `${calId.replace(/[^\w.-]/g, '-')}:${evId}`.slice(0, 200);

  /* ---------- מהנתונים לרשומות ובחזרה ---------- */
  function rowsOf() {
    const out = new Map();
    const put = (coll, id, data) => { if (data !== undefined) out.set(`${coll}|${id}`, canon(data)); };
    const list = (name, v) => {
      if (Array.isArray(v) && v.every(x => x && typeof x === 'object' && typeof x.id === 'string' && ID_OK.test(x.id))) {
        v.forEach(x => put(name, x.id, x));
        put(name, '_order', v.map(x => x.id));
      } else put(name, '_', v);
    };
    Object.keys(S).forEach(k => {
      if (k === 'mail') { const { outbox, ...rest } = S.mail; put('mail', '_', rest); list('mail.outbox', outbox || []); }
      else list(k, S[k]);
    });
    const cal = G.internal.exportAll();
    cal.calendars.forEach(c => { c.events.forEach(ev => put('calEvent', calKey(c.id, ev.id), { cal: c.id, ev })); c.events = []; });
    put('calendar', '_', cal);
    return out;
  }
  function stateFrom(rows) {
    const by = {};
    rows.forEach((s, k) => { const i = k.indexOf('|'); (by[k.slice(0, i)] = by[k.slice(0, i)] || {})[k.slice(i + 1)] = JSON.parse(s); });
    const val = c => {
      const g = by[c] || {};
      if (!g._order) return g._;
      const items = g._order.filter(id => g[id]).map(id => g[id]);
      Object.keys(g).forEach(id => { if (id !== '_order' && id !== '_' && !g._order.includes(id)) items.push(g[id]); });
      return items;
    };
    const s = {};
    Object.keys(by).forEach(c => { if (!['calEvent', 'calendar', 'mail', 'mail.outbox'].includes(c)) { const v = val(c); if (v !== undefined) s[c] = v; } });
    s.mail = Object.assign({}, val('mail') || {}, { outbox: val('mail.outbox') || [] });
    // תאריכים חוזרים להיות תאריכים
    (s.log || []).forEach(e => { e.at = new Date(e.at); });
    s.mail.outbox.forEach(m => { m.at = new Date(m.at); if (m.sentAt) m.sentAt = new Date(m.sentAt); });
    const cal = val('calendar');
    if (cal) Object.values(by.calEvent || {}).forEach(x => { const c = cal.calendars.find(cc => cc.id === x.cal); if (c) c.events.push(x.ev); });
    return { s, cal };
  }
  function diff() {
    const cur = rowsOf();
    const changes = [];
    cur.forEach((s, k) => { if (saved.get(k) !== s) changes.push([k, s]); });
    saved.forEach((s, k) => { if (!cur.has(k)) changes.push([k, null]); });
    return changes;
  }
  const toChange = ([k, s]) => { const i = k.indexOf('|'); return { coll: k.slice(0, i), id: k.slice(i + 1), data: s === null ? null : JSON.parse(s) }; };

  /* ---------- שרת ---------- */
  async function call(method, path, body, keepalive) {
    let r;
    try {
      r = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store', keepalive: !!keepalive, headers: Object.assign({ 'X-Tamima': '1' }, body ? { 'Content-Type': 'application/json' } : {}), body: body ? JSON.stringify(body) : undefined });
    } catch (e) { const er = new Error('אין חיבור לשרת כרגע.'); er.status = 0; throw er; }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { const er = new Error(d.error || 'שגיאה בשרת.'); er.status = r.status; throw er; }
    return d;
  }
  const newSaveId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('');

  /* ---------- שמירה ---------- */
  let pill = null;
  function setSaving(state) {
    BE.saving = state;
    if (!pill) { pill = document.createElement('div'); pill.className = 'save-pill'; pill.setAttribute('role', 'status'); document.body.appendChild(pill); }
    const text = { saving: 'שומר...', saved: 'נשמר', error: 'לא נשמר, מנסה שוב', idle: '' }[state];
    pill.textContent = text;
    pill.className = `save-pill ${state}`;
    clearTimeout(pill.t);
    if (state === 'saved') pill.t = setTimeout(() => { pill.className = 'save-pill'; pill.textContent = ''; }, 1800);
  }
  function scheduleSave(ms = 500) {
    if (BE.status !== 'ready') return;
    clearTimeout(saveT);
    saveT = setTimeout(() => { saveNow().catch(() => {}); }, ms);
  }
  /* ---------- שני מכשירים ----------
     לפני כל שמירה מביאים את מה שמכשיר אחר שמר בינתיים, ומשלבים:
     רשומה שלא השתנתה כאן: מקבלת את הגרסה החדשה.
     רשומה שהשתנתה בשני המקומות: כל שדה שהשתנה כאן נשאר, ושאר השדות מגיעים מהמכשיר האחר.
     רשימת סדר (למשל יומן הפעולות): מה שנוסף בכל מכשיר נשאר, ומה שנמחק באחד נמחק. */
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  function merge3(base, mine, theirs) {
    if (Array.isArray(base) && Array.isArray(mine) && Array.isArray(theirs)) {
      const out = theirs.filter(id => !(base.includes(id) && !mine.includes(id)));
      mine.forEach((id, i) => { if (!base.includes(id) && !out.includes(id)) out.splice(Math.min(i, out.length), 0, id); });
      return out;
    }
    if (!isObj(base) || !isObj(mine) || !isObj(theirs)) return mine;
    const out = Object.assign({}, theirs);
    new Set([...Object.keys(base), ...Object.keys(mine)]).forEach(k => {
      if (canon(mine[k]) === canon(base[k])) return;
      if (k in mine) out[k] = mine[k]; else delete out[k];
    });
    return out;
  }
  // מחזיר true אם הגיע משהו חדש ממכשיר אחר
  async function syncRemote() {
    const d = await call('GET', `api/data?since=${BE.rev}`);
    BE.rev = Math.max(BE.rev, d.rev || 0);
    const incoming = d.rows.map(r => [`${r.coll}|${r.id}`, r.data === null ? null : canon(r.data)])
      .filter(([k, s]) => (s === null ? saved.has(k) : saved.get(k) !== s));
    if (!incoming.length) return false;
    const cur = rowsOf();
    incoming.forEach(([k, s]) => {
      const base = saved.get(k), mine = cur.get(k);
      if (mine === base) { if (s === null) cur.delete(k); else cur.set(k, s); }
      else if (mine !== undefined && s !== null && base !== undefined) cur.set(k, canon(merge3(JSON.parse(base), JSON.parse(mine), JSON.parse(s))));
      // אחרת (נמחקה כאן או שם): מה שנעשה כאן קובע
      if (s === null) saved.delete(k); else saved.set(k, s);
    });
    adopt(cur);
    return true;
  }

  // שומר עכשיו את כל מה שהשתנה. מחזיר כשהכל בשרת (או זורק שגיאה)
  async function saveNow(keepalive) {
    if (inflight) { resave = true; return inflight; }
    if (!diff().length) return;
    setSaving('saving');
    inflight = (async () => {
      try {
        if (!keepalive && await syncRemote()) render();
        // שמירה גדולה (למשל אחרי חיבור יומן עם הרבה אירועים) נשלחת בחלקים, כל חלק נשמר בפני עצמו
        for (let round = 0; round < 100; round++) {
          const pairs = diff();
          if (!pairs.length) break;
          const chunk = [];
          let size = 0;
          for (const p of pairs) {
            const len = p[0].length + (p[1] ? p[1].length : 4);
            if (chunk.length && (chunk.length >= CHUNK_ROWS || size + len > CHUNK_BYTES)) break;
            chunk.push(p); size += len;
          }
          const sig = canon(chunk);
          // אותה שמירה בדיוק שנכשלה באמצע נשלחת שוב עם אותו מזהה, כדי שהשרת ישמור אותה פעם אחת
          const saveId = sig === lastSig ? lastSaveId : newSaveId();
          lastSig = sig; lastSaveId = saveId;
          await call('POST', 'api/data/save', { saveId, changes: chunk.map(toChange) }, keepalive && size < 60000);
          chunk.forEach(([k, s]) => { if (s === null) saved.delete(k); else saved.set(k, s); });
        }
        retryMs = 2000;
        setSaving('saved');
      } catch (e) {
        if (e.status === 401) { BE.status = 'signin'; BE.error = 'הכניסה פגה. צריך להיכנס שוב. השינויים האחרונים יישמרו אחרי הכניסה.'; BE.resume = true; setSaving('idle'); render(); throw e; }
        setSaving('error');
        clearTimeout(saveT);
        saveT = setTimeout(() => { saveNow().catch(() => {}); }, retryMs);
        retryMs = Math.min(retryMs * 2, 30000);
        throw e;
      } finally {
        inflight = null;
        if (resave) { resave = false; scheduleSave(0); }
      }
    })();
    return inflight;
  }

  /* ---------- טעינה ושינויים ממכשיר אחר ---------- */
  function adopt(rows) {
    const { s, cal } = stateFrom(rows);
    S = s;
    if (cal) G.internal.importAll(cal);
  }
  // ניהול ריק בפעם הראשונה (בהגדרת שרת startData: 'empty'): בלי סטודנטים, סדנאות ונתוני דוגמה
  function emptyStart() {
    ['groups', 'students', 'lessons', 'makeups', 'payments', 'workshops', 'customers', 'leads', 'log', 'refundCases', 'refunds', 'privacyRequests', 'audit'].forEach(k => { S[k] = []; });
    S.attendance = {};
    S.mail.outbox = [];
    G.internal.exportAll().calendars.forEach(c => G.internal.clearCalendar(c.id));
  }
  async function load() {
    BE.status = 'loading';
    render();
    const d = await call('GET', 'api/data');
    if (!d.rows.length) {
      // השרת ריק: מתחילים מנתוני ההתחלה ושומרים את כולם
      reset();
      if (CFG.startData === 'empty') emptyStart();
      saved = new Map();
    } else {
      saved = new Map(d.rows.map(r => [`${r.coll}|${r.id}`, canon(r.data)]));
      adopt(saved);
    }
    BE.rev = d.rev || 0;
    BE.status = 'ready';
    BE.error = '';
    BE.retry = false;
    runAutomations();
    render();
    await saveNow().catch(() => {});
  }
  // בדיקה תקופתית: מה שמכשיר אחר שמר מגיע לכאן. אם יש כאן שינויים, השמירה עצמה משלבת
  async function pull() {
    if (BE.status !== 'ready' || inflight || document.hidden) return;
    if (diff().length) return saveNow().catch(() => {});
    inflight = (async () => {
      try { if (await syncRemote()) render(); }
      catch (e) { if (e.status === 401) { BE.status = 'signin'; render(); } }
      finally { inflight = null; if (resave) { resave = false; scheduleSave(0); } }
    })();
    return inflight;
  }

  /* ---------- כניסה ויציאה ---------- */
  async function signedIn() {
    if (BE.resume && diff().length) await saveNow().catch(() => {});
    BE.resume = false;
    await load();
  }
  // הטעינה נכשלה: כניסה שפגה מחזירה למסך הכניסה. תקלה אחרת (שרת לא זמין) מציעה ניסיון חוזר, בלי חלון גוגל
  function loadFailed(e) {
    BE.status = 'signin';
    BE.retry = e.status !== 401;
    BE.error = BE.retry ? `לא הצלחנו לטעון את הנתונים. ${e.message}` : '';
    render();
  }
  function backendBoot() {
    if (APP_MODE !== 'studio' || CFG.backend === 'demo') return false;
    BE.status = 'checking';
    (async () => {
      let st = null;
      try { const r = await fetch('api/auth/status', { credentials: 'same-origin', cache: 'no-store' }); st = r.ok ? await r.json() : null; } catch (e) { /* אין שרת */ }
      if (!st || !st.data) { BE.status = 'off'; runAutomations(); render(); return; }
      BE.configured = !!st.configured;
      if (!st.connected) { BE.status = 'signin'; render(); return; }
      BE.account = st.account || '';
      try { await load(); } catch (e) { loadFailed(e); }
    })();
    setInterval(() => { if (BE.status === 'ready') scheduleSave(0); }, 4000);
    setInterval(pull, 20000);
    window.addEventListener('focus', () => { pull(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && BE.status === 'ready') saveNow(true).catch(() => {}); else pull(); });
    window.addEventListener('beforeunload', e => { if (BE.status === 'ready' && (inflight || diff().length)) { saveNow(true).catch(() => {}); e.preventDefault(); e.returnValue = ''; } });
    return true;
  }
  const backendAfterRender = () => scheduleSave();

  Object.assign(A, {
    async beRetry() {
      if (BE.busy) return;
      BE.busy = true; BE.error = ''; render();
      try { await signedIn(); } catch (e) { loadFailed(e); } finally { BE.busy = false; }
      if (BE.status !== 'ready') render();
    },
    async beSignIn() {
      if (BE.busy) return;
      BE.error = ''; BE.busy = true; render();
      let cals = null;
      try { cals = await GS.connect(); }
      catch (e) { BE.busy = false; BE.error = e.message; render(); return; }
      BE.busy = false;
      BE.account = GS.state().account || '';
      try { await signedIn(); }
      catch (e) { loadFailed(e); return; }
      // כניסה ראשונה במכשיר בלי יומן שנבחר: ממשיכים ישר לבחירת היומן
      if (GS.state().status === 'authorized') { ui.gsCals = cals; A.gsChoose(); }
    },
    async beSignOut() {
      try { await saveNow(); }
      catch (e) { snack('יש שינויים שעוד לא נשמרו. אפשר לצאת כשהחיבור יחזור.'); return; }
      await call('POST', 'api/auth/disconnect', {}).catch(() => {});
      if (GS) GS.disconnect(false);
      saved = new Map();
      reset();
      BE.status = 'signin'; BE.account = ''; BE.error = '';
      location.hash = '#/tamima/home';
      render();
    }
  });

  // שורת החשבון בתפריט הצד ובמסך "עוד"
  function accountHtml(cls = '') {
    if (BE.status !== 'ready') return '';
    return `<div class="be-account ${cls}"><span>חשבון: <b dir="ltr">${esc(BE.account || 'חשבון הסטודיו')}</b></span><button class="btn ghost small" data-act="beSignOut">יציאה</button></div>`;
  }

  // מסך הכניסה והטעינה. מחזיר מחרוזת ריקה כשהניהול מוכן או כשאין שרת
  function backendScreen() {
    if (BE.status === 'off' || BE.status === 'ready') return '';
    const wrap = inner => `<main id="main" tabindex="-1" class="be-screen"><div class="be-card"><span class="logo" aria-hidden="true">ת</span>${inner}</div></main>`;
    if (BE.status !== 'signin') return wrap('<h1>הסטודיו של תמימה</h1><p class="muted" role="status">טוען את הנתונים...</p>');
    if (BE.retry) return wrap(`<h1>הסטודיו של תמימה</h1>
      <p class="be-err" role="alert">${esc(BE.error)}</p>
      <button class="btn primary" data-act="beRetry"${BE.busy ? ' disabled' : ''}>${BE.busy ? 'טוען...' : 'ניסיון חוזר'}</button>
      <p class="muted small">הכניסה בתוקף. צריך רק לטעון שוב את הנתונים.</p>`);
    const can = BE.configured && GS && GS.available();
    return wrap(`<h1>כניסה לניהול</h1>
      <p>נכנסים עם חשבון הגוגל של הסטודיו. בכל מכשיר נכנסים פעם אחת, ומאז הכניסה נשמרת.</p>
      ${can ? '' : '<p class="be-note">השרת עוד לא מוכן לכניסה: חסרים פרטי החיבור לגוגל בהגדרות השרת.</p>'}
      ${BE.error ? `<p class="be-err" role="alert">${esc(BE.error)}</p>` : ''}
      <button class="btn primary" data-act="beSignIn"${can && !BE.busy ? '' : ' disabled'}>${BE.busy ? 'מתחבר...' : 'כניסה עם חשבון גוגל'}</button>
      <p class="muted small">רק החשבון של הסטודיו יכול להיכנס.</p>`);
  }
