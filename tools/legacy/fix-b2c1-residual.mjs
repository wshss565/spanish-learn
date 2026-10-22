// B2/C1 残余清理：删掉生成器漏网的不规则变位 + 专名 / 英文词 / 拼错。
// 护栏：全文件词条数守恒 + 写盘后 import 校验（任一失败即回滚）。
import fs from 'fs';
const FILE = 'js/data/books.js';
const BAN = {
  B2: ['siguió', 'creyó', 'sintió', 'trajeron', 'sintiendo', 'creído', 'comencé', 'busqué', 'pagué', 'pidieron',
    'queriendo', 'toqué', 'sirvió', 'leyó', 'durmió', 'siguieron', 'creyeron', 'sirviendo', 'jugué', 'creímos',
    'viviremos', 'implica', 'comprueba', 'concuerda', 'utilizado', 'estimado', 'arrastrado', 'aplastado', 'vistos',
    'realizado', 'april', 'mrs', 'mumbai', 'mozart', 'ano'],
  C1: ['repitiendo', 'sintieron', 'sirvieron', 'intentémoslo', 'resumiendo', 'decidirá', 'aterrizó', 'consideramos',
    'comprenden', 'incluyen', 'comprenderá', 'lineas', 'deposito', 'felicia', 'bach', 'cher', 'aaah', 'fulana'],
};
const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, c => '\\' + c);
const countAll = t => (t.match(/\{\s*es:\s*'/g) || []).length;
const src = fs.readFileSync(FILE, 'utf8');
let out = src; const log = []; const errs = [];
for (const [lv, words] of Object.entries(BAN)) {
  const marks = []; const re = /level:\s*'([A-Z][0-9])'/g; let m;
  while ((m = re.exec(out))) marks.push({ lv: m[1], at: m.index });
  const i = marks.findIndex(x => x.lv === lv);
  const start = marks[i].at, end = i + 1 < marks.length ? marks[i + 1].at : out.length;
  let seg = out.slice(start, end);
  const beforeAll = countAll(out), beforeLv = countAll(seg);
  let del = 0;
  for (const w of words) {
    const e = esc(w);
    const re1 = new RegExp("\\{\\s*es:\\s*'" + e + "'[^}]*\\}[ \\t]*,[ \\t]*\\r?\\n?", 'g');
    const re2 = new RegExp(",[ \\t]*\\r?\\n?[ \\t]*\\{\\s*es:\\s*'" + e + "'[^}]*\\}", 'g');
    if (re1.test(seg)) { seg = seg.replace(re1, ''); del++; }
    else if (re2.test(seg)) { seg = seg.replace(re2, ''); del++; }
    else errs.push('未匹配 ' + lv + ': ' + w);
  }
  const afterLv = countAll(seg);
  const cand = out.slice(0, start) + seg + out.slice(end);
  const afterAll = countAll(cand);
  if (beforeLv - afterLv !== del || beforeAll - afterAll !== del) {
    errs.push(lv + ' 守恒校验失败，跳过：' + beforeAll + '→' + afterAll + ' 删 ' + del);
    log.push(lv + ' 跳过（未写盘）');
    continue;
  }
  out = cand;
  log.push(lv + ' 删除 ' + del + ' / 等级 ' + beforeLv + ' → ' + afterLv + ' / 全文件 ' + beforeAll + ' → ' + afterAll);
}
fs.writeFileSync(FILE, out, 'utf8');
let ok = true, err = '';
try { await import('../../js/data/books.js?v=' + Date.now()); }
catch (e) { ok = false; err = String(e && (e.message || e)); fs.writeFileSync(FILE, src, 'utf8'); }
fs.writeFileSync('_residual.txt', [...log, ok ? 'import 校验：通过' : 'import 校验：失败，已回滚 ' + err,
  errs.length ? '未匹配/问题：\n' + errs.join('\n') : '无未匹配'].join('\n') + '\n', 'utf8');
