import fs from 'fs';
const FILE = 'D:/vibecoding/site/js/data/books.js';
const src = fs.readFileSync(FILE, 'utf8');
const re = /level:\s*'([A-Z][0-9])'/g; let m, marks = [];
while ((m = re.exec(src))) marks.push({ lv: m[1], at: m.index });
const i0 = marks.findIndex(x => x.lv === 'A2');
const t = src.slice(marks[i0].at, marks[i0 + 1] ? marks[i0 + 1].at : src.length);
const reE = /\{\s*es:\s*'((?:[^'\\]|\\.)*)'([^}]*)\}/g; let mm;
const TRAD = /[圖烏語乾較這們現實運氣分鐘嬰兒親頁與島舊書寫讀買賣錢銀髮臉頰醫藥農場櫃檯聽藥]/;
const out = [];
while ((mm = reE.exec(t))) {
  const b = mm[2]; const es = mm[1];
  const zh = (b.match(/\bzh:\s*'((?:[^'\\]|\\.)*)'/) || [])[1] || '';
  const latin = /[0-9A-Za-z\$]/.test(zh);
  const trail = /[。：？]$/.test(zh);
  const trad = TRAD.test(zh);
  if (latin || trail || trad) {
    out.push({ es, zh, latin, trail, trad, codes: [...zh].map(c => c.codePointAt(0).toString(16)).join(' ') });
  }
}
fs.writeFileSync('D:/vibecoding/site/_debuga2.txt', JSON.stringify(out, null, 2), 'utf8');
