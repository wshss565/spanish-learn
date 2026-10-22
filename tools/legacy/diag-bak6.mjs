import fs from 'fs';
const src = fs.readFileSync('js/data/books.js.bak6', 'utf8');
const marks = []; const re = /level:\s*'([A-Z][0-9])'/g; let m;
while ((m = re.exec(src))) marks.push({ lv: m[1], at: m.index });
const out = ['bak6 大小 ' + src.length + ' B'];
marks.forEach((x, i) => {
  const end = i + 1 < marks.length ? marks[i + 1].at : src.length;
  const seg = src.slice(x.at, end);
  const reE = /\{\s*es:\s*'((?:[^'\\]|\\.)*)'([^}]*)\}/g; let mm; const es = [];
  while ((mm = reE.exec(seg))) es.push(mm[1]);
  out.push(x.lv + ': ' + es.length + ' 词; 首=' + es.slice(0, 2).join('/') + '; 末=' + es.slice(-2).join('/'));
});
fs.writeFileSync('_diagbak6.txt', out.join('\n') + '\n', 'utf8');
