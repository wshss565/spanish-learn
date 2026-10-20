// 找出各级「有 ex 但 ex 不含原词」的词条
import fs from 'fs';
const FILE = 'D:/vibecoding/site/js/data/books.js';
const src = fs.readFileSync(FILE, 'utf8');
const marks = []; const re = /level:\s*'([A-Z][0-9])'/g; let m;
while ((m = re.exec(src))) marks.push({ lv: m[1], at: m.index });
const escRe = x => String(x).replace(/[.*+?^${}()|[\]\\]/g, c => '\\' + c);
const wordIn = (s, w) => { try { return new RegExp(`(^|[^\\p{L}\\p{N}])(${escRe(w)})([^\\p{L}\\p{N}]|$)`, 'iu').test(s); } catch { return false; } };
const out = [];
for (const x of marks) {
  const end = marks.find(y => y.at > x.at)?.at ?? src.length;
  const seg = src.slice(x.at, end);
  const reE = /\{\s*es:\s*'((?:[^'\\]|\\.)*)'([^}]*)\}/g; let mm;
  while ((mm = reE.exec(seg))) {
    const es = mm[1], b = mm[2];
    const ex = (b.match(/\bex:\s*'((?:[^'\\]|\\.)*)'/) || [])[1];
    const zh = (b.match(/\bzh:\s*'((?:[^'\\]|\\.)*)'/) || [])[1] || '';
    if (ex && !wordIn(ex, es)) out.push(x.lv + ' | ' + es + ' | ' + zh + ' | ex=' + ex);
  }
}
fs.writeFileSync('D:/vibecoding/site/_badex.txt', (out.length ? out.join('\n') : '无') + '\n', 'utf8');
