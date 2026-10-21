/* sumit.js: חיבור מדומה לסאמיט (סליקה דרך Upay, כרטיס אשראי בלבד).
   כלל התשלום: כל תשלום נעשה בלחיצה של הלקוח, בדף התשלום של סאמיט. המערכת לא שומרת כרטיס ולא מחייבת לבד.
   המערכת לא מבצעת זיכויים: תמימה מחזירה כסף בסאמיט או בביט, ורק רושמת את הזיכוי במערכת.
   כל קריאה נרשמת ב"מאחורי הקלעים" בשם ובפרמטרים של ה-API האמיתי, כדי שהמעבר לחיבור האמיתי יהיה החלפה של השכבה הזו בלבד. */
'use strict';

  const SUMIT_IPN = 'https://studio.example/api/sumit/ipn';        // הודעת שרת (IPN) אחרי תשלום מוצלח
  const SUMIT_RETURN = 'https://studio.example/payment-return';     // לכאן הלקוח חוזר, עם og-paymentid ושאר הפרמטרים
  const sumitLog = (title, method, path, params) => log('sumit', title, `${method} ${path}${params ? '\n' + JSON.stringify(params) : ''}`);
  // פרטי הלקוח לסאמיט. לקוח שכבר שילם בעבר נשלח עם המזהה שלו בסאמיט, כדי שהקבלה תירשם על אותו כרטיס
  const sumitCustomer = (c, sumitId) => Object.assign(sumitId ? { ID: sumitId } : {}, { Name: c.name, Phone: c.phone || '', EmailAddress: c.email || '' });

  // תשלומים ומסמכים שסאמיט מחזיק (בגרסה האמיתית: אצל סאמיט, והמערכת שואלת עליהם)
  function sumitStore() { if (!S.sumit) S.sumit = { payments: {}, nextCustomer: 100001, nextDocId: 900001 }; return S.sumit; }
  const newSumitCustomer = () => `C${sumitStore().nextCustomer++}`;

  /* דף תשלום: /billing/payments/beginredirect/
     order: { id (המזהה החיצוני שלנו), customer, sumitId, amount, desc } */
  function sumitBeginRedirect(order) {
    sumitLog('סאמיט: נוצר דף תשלום', 'POST', '/billing/payments/beginredirect/', {
      Customer: sumitCustomer(order.customer, order.sumitId), Items: [{ Item: { Name: order.desc }, Quantity: 1, UnitPrice: order.amount }],
      VATIncluded: true, DocumentType: 'InvoiceAndReceipt', ExternalIdentifier: order.id, RedirectURL: SUMIT_RETURN, IPNURL: SUMIT_IPN
    });
    return { RedirectURL: `https://pay.sumit.co.il/${order.id}` };
  }

  /* הלקוח שילם בדף של סאמיט (בדמו: הכפתור במסך התשלום המדומה).
     סאמיט מפיק חשבונית מס קבלה, שולח הודעת שרת (IPN), ומחזיר את הלקוח לאתר עם הפרמטרים. מחזיר את הפרמטרים של החזרה */
  function sumitCustomerPaid(order) {
    const st = sumitStore();
    const id = `pay_${token().slice(0, 10)}`;
    const p = { id, ref: order.id, amount: order.amount, valid: true, doc: S.nextInvoice++, docId: st.nextDocId++, customerId: order.sumitId || newSumitCustomer() };
    st.payments[id] = p;
    log('sumit', `סאמיט: התקבל תשלום ${money(order.amount)}`, `חשבונית מס קבלה מס׳ ${p.doc} הופקה. סאמיט שולח למערכת הודעת שרת (IPN), ומחזיר את הלקוח לאתר.`);
    return { 'og-paymentid': id, 'og-customerid': p.customerId, 'og-documentnumber': p.doc, 'og-externalidentifier': order.id, 'og-paymenttype': 'CreditCard' };
  }
  // תשלום שנכשל או בוטל בדף של סאמיט: אין הודעת שרת, וההזמנה נשארת "ממתין לתשלום"
  function sumitCustomerFailed(order) {
    log('sumit', 'סאמיט: התשלום לא עבר', `${order.desc}. לא הופקה חשבונית, וההזמנה נשארת "ממתין לתשלום".`);
  }
  // אימות התשלום מול סאמיט לפני שמסמנים "שולם": /billing/payments/get/
  function sumitGetPayment(id) {
    if (!PAY.live) sumitLog('סאמיט: אימות התשלום', 'POST', '/billing/payments/get/', { PaymentID: id });
    const p = sumitStore().payments[id];
    return p ? { PaymentID: p.id, ValidPayment: p.valid, Amount: p.amount, DocumentNumber: p.doc, DocumentID: p.docId, CustomerID: p.customerId, ExternalIdentifier: p.ref, ReceiptUrl: p.receiptUrl || '' } : null;
  }

  /* מסמך מתוך המערכת (קבלה לסדנה מערוץ שיווק): /accounting/documents/create/
     אין כאן חיוב. רק מסמך, עם אמצעי התשלום שהוגדר לערוץ. מחזיר מזהה מסמך, מספר מסמך ומזהה לקוח */
  function sumitCreateDocument(customer, sumitId, desc, amount, payLabel) {
    const st = sumitStore();
    const doc = { DocumentID: st.nextDocId++, DocumentNumber: S.nextInvoice++, CustomerID: sumitId || newSumitCustomer() };
    sumitLog(`סאמיט: הופקה חשבונית מס קבלה מס׳ ${doc.DocumentNumber}`, 'POST', '/accounting/documents/create/', {
      Details: { Type: 'InvoiceAndReceipt', Customer: sumitCustomer(customer, sumitId) }, Items: [{ Item: { Name: desc }, Quantity: 1, UnitPrice: amount }],
      Payments: [{ Amount: amount, Details: payLabel }], VATIncluded: true
    });
    return doc;
  }

  /* ---------- סליקה אמיתית (כשהדף מוגש מהשרת, והשרת מחובר לספק) ----------
     כרגע הספק הוא מורנינג, במחירי בדיקה. בלי שרת (גיטהאב, הדמו המפורסם) הכל נשאר מדומה כמו קודם.
     דף התשלום נפתח בלשונית חדשה, והדף הזה שואל את השרת כל 3 שניות אם התשלום התקבל.
     תשלום שאומת נכנס לאותה נקודת אישור (confirmPayment) כמו כל תשלום, עם הסכום ומספר הקבלה מהספק. */
  const PAY = { live: false, test: false, prices: null, provider: '' };
  const PAY_PROVIDER = { morning: 'מורנינג' };
  function applyPayPrices() { if (PAY.live && PAY.prices && S) Object.assign(S.settings, PAY.prices); }
  async function payDetect() {
    if (!/^https?:$/.test(location.protocol)) return;
    try {
      const r = await fetch('api/pay/config', { cache: 'no-store' });
      const d = r.ok ? await r.json() : null;
      if (!d || !d.live) return;
      Object.assign(PAY, { live: true, test: !!d.test, prices: d.prices, provider: d.provider });
      applyPayPrices();
      render();
    } catch (e) { /* אין שרת: נשארים בדמו */ }
  }
  async function payPost(path, body) {
    let r;
    try { r = await fetch('api/pay/' + path, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'X-Tamima': '1' }, body: JSON.stringify(body) }); }
    catch (e) { throw new Error('אין חיבור לשרת כרגע.'); }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'שגיאה בחיבור לסליקה.');
    return d;
  }
  /* פתיחת דף תשלום להזמנה. חייב לרוץ מתוך הלחיצה: הלשונית נפתחת מיד, והכתובת מגיעה מהשרת אחר כך.
     live: { ref, url, popup, error, since } נשמר אצל מי שקרא, ומוצג ב-liveWaitView */
  function livePayStart(order, kind, n, live) {
    const win = window.open('', '_blank');
    Object.assign(live, { ref: order.id, url: '', popup: !!win, error: '', since: Date.now(), amount: order.amount, desc: order.desc });
    log('sumit', `${PAY_PROVIDER[PAY.provider] || 'סליקה'}: נפתח דף תשלום אמיתי`, `${order.desc}, ${money(order.amount)}. מזהה ההזמנה: ${order.id}.`);
    return payPost('start', { ref: order.id, kind, n, desc: order.desc, client: { name: order.customer.name, email: order.customer.email, phone: order.customer.phone } })
      .then(d => { live.url = d.url; if (win) { try { win.opener = null; } catch (e) { /* לא נתמך */ } win.location.href = d.url; } return d; })
      .catch(e => { if (win) win.close(); live.error = e.message; throw e; });
  }
  /* בדיקה אם ההזמנה שולמה. כשכן: התשלום נרשם כתשלום מאומת, ומוחזר המזהה שלו לאישור */
  async function livePayCheck(ref) {
    const d = await payPost('check', { ref });
    if (!d.paid) { if (d.error) throw new Error(d.error); return null; }
    const id = `mrn_${d.docId}`;
    sumitStore().payments[id] = { id, ref, amount: d.amount, valid: true, doc: d.number, docId: d.docId, customerId: '', receiptUrl: d.receiptUrl };
    log('sumit', `${PAY_PROVIDER[PAY.provider] || 'סליקה'}: התשלום אומת`, `קבלה מס׳ ${d.number} על ${money(d.amount)}. הסכום זהה לסכום ההזמנה.`);
    return id;
  }
  let livePollT = null;
  // שואל כל 3 שניות, עד 15 דקות. onPaid(paymentId) נקרא פעם אחת
  function livePoll(live, onPaid, onChange) {
    clearInterval(livePollT);
    let busy = false;
    livePollT = setInterval(async () => {
      if (busy) return;
      if (Date.now() - live.since > 15 * 60e3) { clearInterval(livePollT); live.error = 'לא התקבל תשלום ב-15 הדקות האחרונות. אפשר לנסות שוב.'; onChange(); return; }
      busy = true;
      try { const id = await livePayCheck(live.ref); if (id) { clearInterval(livePollT); onPaid(id); } else if (live.error) { live.error = ''; onChange(); } }
      catch (e) { if (live.error !== e.message) { live.error = e.message; onChange(); } }
      finally { busy = false; }
    }, 3000);
  }
  const livePollStop = () => clearInterval(livePollT);
  // המסך בזמן שהלקוח משלם בלשונית האחרת
  function liveWaitView(live, backAct) {
    const name = PAY_PROVIDER[PAY.provider] || 'הסליקה';
    return `<div class="sumit live-pay">
      <div class="sumit-head"><div><b>תשלום מאובטח</b><small>בדף של ${name}</small></div>${PAY.test ? '<span class="demo-badge">בדיקה: תשלום אמיתי, במחיר בדיקה</span>' : ''}</div>
      <div class="sumit-amount"><small>${esc(live.desc || '')}</small><b>${money(live.amount || 0)}</b></div>
      ${live.error ? `<p class="err" role="alert">${esc(live.error)}</p>` : `<p class="live-wait" role="status"><span class="spin" aria-hidden="true"></span>${live.url ? 'מחכים לאישור התשלום...' : 'פותחים את דף התשלום...'}</p>`}
      <p class="hint">${live.popup ? 'דף התשלום נפתח בלשונית חדשה. אחרי התשלום חוזרים לכאן, וההזמנה מתעדכנת לבד.' : 'הדפדפן חסם את פתיחת הלשונית. אפשר לפתוח את דף התשלום בכפתור.'}</p>
      ${live.url ? `<a class="btn ${live.popup ? 'ghost' : 'primary'} block" href="${esc(live.url)}" target="_blank" rel="noopener">לפתיחת דף התשלום</a>` : ''}
      <button class="btn ghost block" data-act="${backAct}">חזרה</button>
    </div>`;
  }

  // קישור לקבלה המקורית של הספק (רק בסליקה אמיתית), במייל ללקוח
  const receiptLinkHtml = url => (url ? `<p style="margin:12px 0"><a href="${esc(url)}" style="color:#7d3b1c;font-weight:bold">להורדת הקבלה המקורית (PDF)</a></p>` : '');

  // PDF של מסמך: /accounting/documents/getpdf/
  function sumitPdf(docNumber, html, title) {
    sumitLog(`סאמיט: PDF של מסמך מס׳ ${docNumber}`, 'POST', '/accounting/documents/getpdf/', { DocumentNumber: docNumber, Original: true });
    const page = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title>
      <style>body{font-family:Arial,Helvetica,sans-serif;color:#2a231d;max-width:640px;margin:32px auto;padding:0 16px}.inv-head{display:flex;justify-content:space-between;border-bottom:2px solid #a5552f;padding-bottom:10px;margin-bottom:14px}.inv-head small{color:#6c5f55}dl{display:grid;grid-template-columns:130px 1fr;gap:8px 12px}dt{color:#6c5f55}dd{margin:0}button{margin-top:24px;padding:10px 20px;border-radius:999px;border:0;background:#a5552f;color:#fff;font-weight:bold;cursor:pointer}@media print{button{display:none}}</style>
      </head><body>${html}<button onclick="print()">הדפסה או שמירה כ-PDF</button></body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(page); win.document.close(); return true; }
    return false;
  }
