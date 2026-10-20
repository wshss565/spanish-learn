// 校验 books.js：各等级词条数、同等级内重复 es、空洞
import fs from 'fs';
const src = fs.readFileSync('js/data/books.js', 'utf8');
const marks = []; const re = /level:\s*'([A-Z][0-9])'/g; let m;
while ((m = re.exec(src))) marks.push({ lv: m[1], at: m.index });
const out = [];
for (let i = 0; i < marks.length; i++) {
  const t = src.slice(marks[i].at, marks[i + 1] ? marks[i + 1].at : src.length);
  const reE = /\{\s*es:\s*'((?:[^'\\]|\\.)*)'([^}]*)\}/g; let mm;
  const es = [];
  while ((mm = reE.exec(t))) es.push(mm[1]);
  const dup = {}; es.forEach(x => dup[x] = (dup[x] || 0) + 1);
  const dups = Object.keys(dup).filter(k => dup[k] > 1);
  out.push(marks[i].lv + ': ' + es.length + ' 词' + (dups.length ? '，重复 ' + dups.length + ' → ' + dups.slice(0, 12).join(',') : '，无重复'));
}
fs.writeFileSync('_validate.txt', out.join('\n') + '\n', 'utf8');
