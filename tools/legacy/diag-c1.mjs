import fs from 'fs';
const src = fs.readFileSync('js/data/books.js', 'utf8');
const marks = []; const re = /level:\s*'([A-Z][0-9])'/g; let m;
while ((m = re.exec(src))) marks.push({ lv: m[1], at: m.index });
const out = ['等级标记 ' + marks.length + ' 个：' + marks.map(x => x.lv).join(',')];
marks.forEach((x, i) => {
  const end = i + 1 < marks.length ? marks[i + 1].at : src.length;
  const seg = src.slice(x.at, end);
  const reE = /\{\s*es:\s*'((?:[^'\\]|\\.)*)'([^}]*)\}/g; let mm; const es = [];
  while ((mm = reE.exec(seg))) es.push(mm[1]);
  out.push(x.lv + ': ' + es.length + ' 词; 首=' + es.slice(0, 3).join('/') + '; 末=' + es.slice(-3).join('/') +
    '; 有ipa的=' + (seg.match(/ipa:/g) || []).length + '; 有ex的=' + (seg.match(/\bex:/g) || []).length);
});
fs.writeFileSync('_diagc1.txt', out.join('\n') + '\n', 'utf8');
