/*
 * server/backup.js: גיבוי יומי של כל נתוני הסטודיו.
 *
 * פעם ביום נשמר עותק מלא, מוצפן, בתיקייה backups. נשמרים 30 הימים האחרונים.
 * הקובץ מוצפן באותו מפתח של השרת (TAMIMA_KEY), כי יש בו פרטים אישיים.
 * שחזור: restore(file) מחזיר את הרשומות, ואפשר לשמור אותן חזרה עם store.apply.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const KEEP = 30;
const day = d => d.toISOString().slice(0, 10);

function createBackup({ store, dir, seal, open, now = () => new Date() }) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const files = () => fs.readdirSync(dir).filter(f => /^\d{4}-\d\d-\d\d\.bak$/.test(f)).sort();
  async function run(force) {
    const name = `${day(now())}.bak`;
    if (!force && fs.existsSync(path.join(dir, name))) return null;
    const { rev, rows } = await store.all();
    const tmp = path.join(dir, name + '.tmp');
    fs.writeFileSync(tmp, seal(JSON.stringify({ at: now().toISOString(), rev, rows })), { mode: 0o600 });
    fs.renameSync(tmp, path.join(dir, name));
    const all = files();
    all.slice(0, Math.max(0, all.length - KEEP)).forEach(f => fs.unlinkSync(path.join(dir, f)));
    return name;
  }
  return {
    run,
    list: files,
    restore: file => JSON.parse(open(fs.readFileSync(path.join(dir, path.basename(file)), 'utf8'))),
    // בדיקה כל שעה: אם עוד לא נשמר גיבוי היום, שומרים עכשיו
    start() {
      const tick = () => run().catch(e => console.error('הגיבוי נכשל:', e.message));
      tick();
      const t = setInterval(tick, 60 * 60e3);
      if (t.unref) t.unref();
      return () => clearInterval(t);
    }
  };
}

module.exports = { createBackup };
