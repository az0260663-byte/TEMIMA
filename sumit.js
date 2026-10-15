/* sumit.js: חיבור מדומה לסאמיט (סליקה דרך Upay, כרטיס אשראי בלבד).
   כל פעולות התשלום יוצאות מהמערכת. תמימה לא נכנסת לסאמיט.
   כל קריאה נרשמת ב"מאחורי הקלעים" בשם ובפרמטרים של ה-API האמיתי, כדי שהמעבר לחיבור האמיתי יהיה החלפה של השכבה הזו בלבד. */
'use strict';

  const SUMIT_IPN = 'https://studio.example/api/sumit/ipn';   // כתובת השרת שמקבל את הודעות התשלום (IPN)
  const sumitLog = (title, method, path, params) => log('sumit', title, `${method} ${path}${params ? '\n' + JSON.stringify(params) : ''}`);
  const sumitCustomer = c => ({ Name: c.name, Phone: c.phone || '', EmailAddress: c.email || '' });
  const newToken = () => `tok_${token().slice(0, 12)}`;

  // תשלומים שסאמיט קיבל (בגרסה האמיתית: נשמרים אצל סאמיט, והמערכת שואלת עליהם)
  function sumitStore() { if (!S.sumit) S.sumit = { payments: {}, failNextRefund: false }; return S.sumit; }

  /* דף תשלום: /billing/payments/beginredirect/
     סאמיט מחזיר כתובת לדף התשלום המאובטח. אחרי תשלום הוא מפיק חשבונית מס קבלה, שומר טוקן של הכרטיס ושולח IPN לכתובת שלנו. */
  function sumitBeginRedirect(order) {
    sumitLog('סאמיט: נוצר דף תשלום', 'POST', '/billing/payments/beginredirect/', {
      Customer: sumitCustomer(order.customer), Items: [{ Item: { Name: order.desc }, Quantity: 1, UnitPrice: order.amount }],
      VATIncluded: true, DocumentType: 'InvoiceAndReceipt', SaveCreditCard: true, ExternalIdentifier: order.id, IPNURL: SUMIT_IPN
    });
    return { RedirectURL: `https://pay.sumit.co.il/${order.id}` };
  }

  // הלקוח שילם בדף של סאמיט (בדמו: הכפתור במסך התשלום המדומה)
  function sumitCustomerPaid(order) {
    const st = sumitStore();
    const id = `pay_${token().slice(0, 10)}`;
    st.payments[id] = { id, ref: order.id, amount: order.amount, valid: true, doc: S.nextInvoice++, token: newToken(), customerId: `C${100000 + Math.floor(Math.random() * 899999)}` };
    log('sumit', `סאמיט: התקבל תשלום ${money(order.amount)}`, `חשבונית מס קבלה מס׳ ${st.payments[id].doc} הופקה, והטוקן של הכרטיס נשמר. סאמיט שולח למערכת הודעת שרת (IPN).`);
    return id;
  }
  // תשלום שנכשל או בוטל בדף של סאמיט: אין הודעת שרת, וההזמנה נשארת "ממתין לתשלום"
  function sumitCustomerFailed(order) {
    log('sumit', 'סאמיט: התשלום לא עבר', `${order.desc}. לא הופקה חשבונית, וההזמנה נשארת "ממתין לתשלום".`);
  }
  // אימות התשלום מול סאמיט לפני שמסמנים "שולם": /billing/payments/get/
  function sumitGetPayment(id) {
    sumitLog('סאמיט: אימות התשלום', 'POST', '/billing/payments/get/', { PaymentID: id });
    const p = sumitStore().payments[id];
    return p ? { ValidPayment: p.valid, Amount: p.amount, DocumentNumber: p.doc, PaymentMethod: { CreditCard_Token: p.token }, CustomerID: p.customerId, ExternalIdentifier: p.ref } : null;
  }

  // מסמך מתוך המערכת (קבלה לסדנה מ"בסלון"): /accounting/documents/create/
  function sumitCreateDocument(customer, desc, amount) {
    const doc = S.nextInvoice++;
    sumitLog(`סאמיט: הופקה חשבונית מס קבלה מס׳ ${doc}`, 'POST', '/accounting/documents/create/', {
      Details: { Type: 'InvoiceAndReceipt', Customer: sumitCustomer(customer) }, Items: [{ Item: { Name: desc }, Quantity: 1, UnitPrice: amount }], VATIncluded: true
    });
    return doc;
  }

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

  /* זיכוי: קריאה אחת ל-/billing/payments/charge/ עם סכום שלילי.
     מחזירה את הכסף לכרטיס ומפיקה חשבונית מס קבלה זיכוי.
     זו הפונקציה היחידה שמבצעת זיכוי, והיא נקראת רק מהכפתור "ביצוע זיכוי" של תמימה. */
  function sumitRefund(o) {
    const st = sumitStore();
    sumitLog(`סאמיט: זיכוי ${money(o.amount)} לחשבונית ${o.invoice}`, 'POST', '/billing/payments/charge/', {
      Customer: sumitCustomer(o.customer), PaymentMethod: { CreditCard_Token: o.token || null },
      Items: [{ Item: { Name: o.desc }, Quantity: 1, UnitPrice: -o.amount }], VATIncluded: true,
      SupportCredit: true, DocumentType: 'CreditInvoiceAndReceipt', DocumentDescription: `זיכוי לחשבונית מס׳ ${o.invoice}`
    });
    if (st.failNextRefund) { st.failNextRefund = false; return { ok: false, error: 'סאמיט דחה את הזיכוי (הדגמת כשל).' }; }
    if (!o.token) return { ok: false, error: 'אין כרטיס אשראי שמור לתשלום הזה, ולכן אי אפשר לזכות דרך סאמיט.' };
    return { ok: true, creditNo: S.nextCredit++ };
  }
