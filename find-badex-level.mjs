// 通用版：找某等级里「有 ex 但 ex 不含原词」的词条
import fs from 'fs';
const LEVEL = (process.argv[2] || 'A1').toUpperCase();
const FILE = 'D:/vibecoding/site/js/data/books.js';
const src = fs.readFileSync(FILE, 'utf8');
const re = /level:\s*'([A-Z][0-9])'/g;
let m, marks = [];
while ((m = re.exec(src))) marks.push({ lv: m[1], at: m.index });
const i0 = marks.findIndex(x => x.lv === LEVEL);
if (i0 < 0) { fs.writeFileSync('D:/vibecoding/site/_badex.txt', 'NO ' + LEVEL, 'utf8'); process.exit(1); }
const t = src.slice(marks[i0].at, marks[i0 + 1] ? marks[i0 + 1].at : src.length);
const wordIn = (s, w) => {
  const esc = x => String(x).replace(/[.*+?^${}()|[\]\\]/g, c => '\\' + c);
  try { return new RegExp(`(^|[^\\p{L}\\p{N}])(${esc(w)})([^\\p{L}\\p{N}]|$)`, 'iu').test(s); } catch { return false; }
};
const reE = /\{\s*es:\s*'((?:[^'\\]|\\.)*)'([^}]*)\}/g;
let mm; const bad = [];
while ((mm = reE.exec(t))) {
  const b = mm[2]; const es = mm[1];
  const ex = (b.match(/\bex:\s*'((?:[^'\\]|\\.)*)'/) || [])[1] || '';
  if (ex && !wordIn(ex, es)) bad.push({ es, ex });
}
fs.writeFileSync('D:/vibecoding/site/_badex.txt', JSON.stringify(bad, null, 2), 'utf8');
