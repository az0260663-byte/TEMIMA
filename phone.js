// עמוד הצגה: התאמת גודל הטלפון לחלון, ומעבר בין מסכים בלי לאבד את מצב הדמו
(function () {
  'use strict';
  const frame = document.getElementById('screen');
  const buttons = [...document.querySelectorAll('[data-go]')];

  function fit() {
    const s = Math.min(1, (window.innerHeight - 48) / 868);
    document.documentElement.style.setProperty('--s', s.toFixed(3));
  }
  window.addEventListener('resize', fit);
  fit();

  // שעון בשורת הסטטוס של הטלפון
  const clock = document.getElementById('clock');
  const tick = () => { const d = new Date(); clock.textContent = d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); };
  tick(); setInterval(tick, 30000);

  // מעבר מסך: משנים רק את הכתובת הפנימית, כך שהזמנה שנעשתה באתר מופיעה אצל תמימה
  function mark() {
    let h = '';
    try { h = frame.contentWindow.location.hash; } catch (e) { /* לפני טעינה */ }
    const match = buttons.slice().sort((a, b) => b.dataset.go.length - a.dataset.go.length).find(b => h.startsWith(b.dataset.go));
    buttons.forEach(b => b.classList.toggle('on', b === match));
  }
  buttons.forEach(b => b.addEventListener('click', () => {
    frame.contentWindow.location.hash = b.dataset.go;
    frame.contentWindow.scrollTo(0, 0);
    mark();
  }));
  frame.addEventListener('load', () => {
    // כמו בטלפון: פס גלילה שקוף שלא תופס רוחב (הגלילה עצמה עובדת כרגיל)
    const st = frame.contentDocument.createElement('style');
    st.textContent = 'html, * { scrollbar-width: none; } ::-webkit-scrollbar { width: 0; height: 0; }';
    frame.contentDocument.head.appendChild(st);
    frame.contentWindow.addEventListener('hashchange', mark);
    mark();
  });
  document.getElementById('resetDemo').addEventListener('click', () => {
    frame.src = 'demo-app.html#/client';
  });
})();
