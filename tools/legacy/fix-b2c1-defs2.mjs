// B2/C1 收尾：人工修正剩余「释义可疑」（含数字/语义错误）。表里词必须存在，否则中止不写盘。
import fs from 'fs';
const FILE = 'js/data/books.js';
const FIX = {
  carecer: { zh: '缺乏；需要' }, propuesta: { zh: '提案' }, infancia: { zh: '童年' }, marchar: { zh: '行进；离开' },
  conspiración: { zh: '阴谋' }, euros: { zh: '欧元（复数）' }, bloque: { zh: '街区；块' }, tiburones: { zh: '鲨鱼（复数）' },
  disponibles: { zh: '可用的（复数）', pos: 'adj' }, salidas: { zh: '出口（复数）' }, millonario: { zh: '百万富翁' },
  residente: { zh: '居民；住院医师' }, doscientos: { zh: '二百' }, centros: { zh: '中心（复数）' },
  órgano: { zh: '器官；机关' }, veinticinco: { zh: '二十五' }, quinientos: { zh: '五百' },
  mediados: { zh: '中期' }, instituciones: { zh: '机构（复数）' }, trescientos: { zh: '三百' },
  sindicatos: { zh: '工会（复数）' }, veinticuatro: { zh: '二十四' }, subdirector: { zh: '副主管' },
  materna: { zh: '母亲的（阴性）', pos: 'adj' }, reembolso: { zh: '退款' }, veintidós: { zh: '二十二' },
  anfetaminas: { zh: '安非他明（复数）' }, cuatrocientos: { zh: '四百' },
};
const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, c => '\\' + c);
const countAll = t => (t.match(/\{\s*es:\s*'/g) || []).length;
const src = fs.readFileSync(FILE, 'utf8');
const present = new Set(); { const reE = /\{\s*es:\s*'((?:[^'\\]|\\.)*)'([^}]*)\}/g; let mm; while ((mm = reE.exec(src))) present.add(mm[1]); }
const errs = Object.keys(FIX).filter(k => !present.has(k)).map(k => '表里有但词书里没有: ' + k);
if (errs.length) { fs.writeFileSync('_b2c1defs2.txt', '中止（未写盘）：\n' + errs.join('\n') + '\n', 'utf8'); process.exit(1); }

const beforeAll = countAll(src);
const reE = /\{\s*es:\s*'((?:[^'\\]|\\.)*)'([^}]*)\}/g;
let changed = 0;
const out = src.replace(reE, (full, es, body) => {
  const f = FIX[es]; if (!f) return full;
  let nb = body;
  if (f.zh != null) nb = /\bzh:\s*'/.test(nb) ? nb.replace(/\bzh:\s*'(?:[^'\\]|\\.)*'/, "zh: '" + f.zh + "'") : nb.replace(/\s+$/, '') + ", zh: '" + f.zh + "'";
  if (f.pos != null) nb = /\bpos:\s*'/.test(nb) ? nb.replace(/\bpos:\s*'(?:[^'\\]|\\.)*'/, "pos: '" + f.pos + "'") : nb.replace(/\s+$/, '') + ", pos: '" + f.pos + "'";
  changed++; return "{ es: '" + es + "'" + nb + " }";
});
const afterAll = countAll(out);
const ok = beforeAll === afterAll;
fs.writeFileSync(FILE, ok ? out : src, 'utf8');
let imp = '未写盘（守恒失败）';
if (ok) { try { await import('../../js/data/books.js?v=' + Date.now()); imp = '通过'; } catch (e) { fs.writeFileSync(FILE, src, 'utf8'); imp = '失败，已回滚 ' + String(e && e.message); } }
fs.writeFileSync('_b2c1defs2.txt', '改写 ' + changed + ' / 全文件 ' + beforeAll + ' → ' + afterAll + '\n守恒：' + (ok ? '通过' : '失败') + '\nimport 校验：' + imp + '\n', 'utf8');
