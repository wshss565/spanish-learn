import fs from 'fs';
const src = fs.readFileSync('js/data/books.js', 'utf8');
const marks = []; const re = /level:\s*'([A-Z][0-9])'/g; let m;
while ((m = re.exec(src))) marks.push({ lv: m[1], at: m.index });
const sets = {}, lists = {};
marks.forEach((x, i) => {
  const end = i + 1 < marks.length ? marks[i + 1].at : src.length;
  const seg = src.slice(x.at, end);
  const reE = /\{\s*es:\s*'((?:[^'\\]|\\.)*)'([^}]*)\}/g; let mm; const es = [];
  while ((mm = reE.exec(seg))) es.push(mm[1]);
  sets[x.lv] = new Set(es); lists[x.lv] = es;
});
const out = [];
['A1', 'A2', 'B1', 'B2', 'C2'].forEach(lv => {
  const inter = lists['C1'].filter(w => sets[lv] && sets[lv].has(w));
  out.push('C1 与 ' + lv + ' 重叠 ' + inter.length + ' 个：' + inter.slice(0, 15).join(', '));
});
// C1 内部是否有长段重复（相邻 20 词窗口重复出现）
const c1 = lists['C1'];
const seen = new Map(); const dupWin = [];
for (let i = 0; i + 20 <= c1.length; i++) {
  const key = c1.slice(i, i + 20).join('|');
  if (seen.has(key)) dupWin.push('窗口重复 @' + i + ' 与 @' + seen.get(key));
  else seen.set(key, i);
}
out.push('C1 相邻20词窗口重复: ' + (dupWin.length ? dupWin.slice(0, 5).join('; ') : '无'));
fs.writeFileSync('_diagoverlap.txt', out.join('\n') + '\n', 'utf8');
