// B1 收尾小修 2：删非词条 + 修剩余 pos 错标（v → n）
import fs from 'fs';
const FILE = 'js/data/books.js';
const LEVEL = 'B1';
const src = fs.readFileSync(FILE, 'utf8');
const marks = []; const re = /level:\s*'([A-Z][0-9])'/g; let m;
while ((m = re.exec(src))) marks.push({ lv: m[1], at: m.index });
const iL = marks.findIndex(x => x.lv === LEVEL);
const start = marks[iL].at, end = marks[iL + 1] ? marks[iL + 1].at : src.length;
let seg = src.slice(start, end);

const DEL = ['haberse', 'dejame'];
const FIX = {
  sistemas: { pos: 'n' }, escándalo: { pos: 'n' }, corona: { pos: 'n' }, máscara: { pos: 'n' },
  criaturas: { pos: 'n' }, resistencia: { pos: 'n' }, tontería: { pos: 'n' },
};

const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, c => '\\' + c);
const reE = /\{\s*es:\s*'((?:[^'\\]|\\.)*)'([^}]*)\}/g;
const present = new Set(); let mm; while ((mm = reE.exec(seg))) present.add(mm[1]);
const errs = [];
[...Object.keys(FIX), ...DEL].forEach(k => { if (!present.has(k)) errs.push('表里有但词书里没有: ' + k); });
if (errs.length) { fs.writeFileSync('_fixb1def3.txt', '中止（未写盘）：\n' + errs.join('\n') + '\n', 'utf8'); process.exit(1); }

const before = (seg.match(reE) || []).length;
let changed = 0, deleted = 0;
for (const k of DEL) {
  const e = esc(k);
  const re1 = new RegExp("\\{\\s*es:\\s*'" + e + "'[^}]*\\}[ \\t]*,[ \\t]*\\r?\\n?", 'g');
  const re2 = new RegExp(",[ \\t]*\\r?\\n?[ \\t]*\\{\\s*es:\\s*'" + e + "'[^}]*\\}", 'g');
  if (re1.test(seg)) { seg = seg.replace(re1, ''); deleted++; }
  else if (re2.test(seg)) { seg = seg.replace(re2, ''); deleted++; }
  else errs.push('删除失败: ' + k);
}
seg = seg.replace(reE, (full, es, body) => {
  const f = FIX[es]; if (!f) return full;
  let nb = body;
  if (f.pos != null) nb = /\bpos:\s*'/.test(nb) ? nb.replace(/\bpos:\s*'(?:[^'\\]|\\.)*'/, "pos: '" + f.pos + "'") : nb.replace(/\s+$/, '') + ", pos: '" + f.pos + "'";
  changed++; return "{ es: '" + es + "'" + nb + " }";
});
fs.writeFileSync(FILE, src.slice(0, start) + seg + src.slice(end), 'utf8');
const after = (seg.match(reE) || []).length;
const b1 = (await import('../../js/data/books.js?v=' + Date.now())).WORD_BOOKS.find(b => b.level === LEVEL);
fs.writeFileSync('_fixb1def3.txt', [
  'B1 收尾小修 2', '改写 ' + changed + ' / 删除 ' + deleted,
  'B1 词条数 ' + before + ' → ' + after + '（实际导入 ' + b1.words.length + '）',
  '空洞数（必须 0）' + b1.words.filter(w => !w || !w.es).length,
  errs.length ? '问题：\n' + errs.join('\n') : '无错误',
].join('\n'), 'utf8');
