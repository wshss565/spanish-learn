// B1 最后：修同形名词释义（tira/entrega/guarda/muestras/salto）
import fs from 'fs';
const FILE = 'js/data/books.js';
const LEVEL = 'B1';
const src = fs.readFileSync(FILE, 'utf8');
const marks = []; const re = /level:\s*'([A-Z][0-9])'/g; let m;
while ((m = re.exec(src))) marks.push({ lv: m[1], at: m.index });
const iL = marks.findIndex(x => x.lv === LEVEL);
const start = marks[iL].at, end = marks[iL + 1] ? marks[iL + 1].at : src.length;
let seg = src.slice(start, end);
const FIX = {
  tira: { zh: '条；带子' }, entrega: { zh: '交付；交货' }, guarda: { zh: '守卫；看守' },
  muestras: { zh: '样本（复数）' }, salto: { zh: '跳跃' },
};
const reE = /\{\s*es:\s*'((?:[^'\\]|\\.)*)'([^}]*)\}/g;
const present = new Set(); let mm; while ((mm = reE.exec(seg))) present.add(mm[1]);
const errs = Object.keys(FIX).filter(k => !present.has(k)).map(k => '表里有但词书里没有: ' + k);
if (errs.length) { fs.writeFileSync('_fixb1final2.txt', '中止（未写盘）：\n' + errs.join('\n') + '\n', 'utf8'); process.exit(1); }
let changed = 0;
seg = seg.replace(reE, (full, es, body) => {
  const f = FIX[es]; if (!f) return full;
  let nb = /\bzh:\s*'/.test(body) ? body.replace(/\bzh:\s*'(?:[^'\\]|\\.)*'/, "zh: '" + f.zh + "'") : body.replace(/\s+$/, '') + ", zh: '" + f.zh + "'";
  changed++; return "{ es: '" + es + "'" + nb + " }";
});
fs.writeFileSync(FILE, src.slice(0, start) + seg + src.slice(end), 'utf8');
const after = (seg.match(reE) || []).length;
const b1 = (await import('../../js/data/books.js?v=' + Date.now())).WORD_BOOKS.find(b => b.level === LEVEL);
fs.writeFileSync('_fixb1final2.txt', ['改写 ' + changed, '词条数 ' + after + '（导入 ' + b1.words.length + '）',
  '空洞数 ' + b1.words.filter(w => !w || !w.es).length, errs.length ? errs.join('\n') : '无错误'].join('\n'), 'utf8');
