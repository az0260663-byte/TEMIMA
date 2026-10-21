/* pay-return.js: מעביר את הלקוח מדף התשלום חזרה לאתר שממנו הגיע, עם מזהה ההזמנה.
   מעביר רק לכתובות של הסטודיו (האתר בגיטהאב, או שרת במחשב המקומי), כדי שאי אפשר יהיה להשתמש בדף להפניה לאתר זר. */
'use strict';
(function () {
  const q = new URLSearchParams(location.search);
  const ref = q.get('ref') || '';
  const to = q.get('to') || '';
  const fail = q.get('fail') === '1';
  const allowed = /^(https:\/\/az0260663-byte\.github\.io\/TEMIMA\/|http:\/\/localhost:\d{2,5}\/)[\w./-]*$/;
  if (!/^[\w-]{4,60}$/.test(ref) || !allowed.test(to)) {
    document.getElementById('msg').textContent = 'אפשר לחזור לאתר של הסטודיו בקישור.';
    return;
  }
  const target = `${to}?payret=${encodeURIComponent(ref)}${fail ? '&payfail=1' : ''}#/client/workshop`;
  document.getElementById('go').href = target;
  location.replace(target);
})();
