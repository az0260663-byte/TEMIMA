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
    sumitLog('סאמיט: אימות התשלום', 'POST', '/billing/payments/get/', { PaymentID: id });
    const p = sumitStore().payments[id];
    return p ? { PaymentID: p.id, ValidPayment: p.valid, Amount: p.amount, DocumentNumber: p.doc, DocumentID: p.docId, CustomerID: p.customerId, ExternalIdentifier: p.ref } : null;
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
