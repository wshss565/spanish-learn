// 按 _nonword_B2.txt / _nonword_C1.txt 清单删除非词条。
// 相对上一版的三处加固：
//   1) 每个等级都**重读文件、重算 marks**，绝不复用旧偏移量（旧版会错位插入，踩过坑）；
//   2) 写盘前后做**全文件词条数守恒**校验：减少量必须等于删除量，否则不写盘；
//   3) 写盘后再 import 一次，失败回滚。
import fs from 'fs';
const FILE = 'js/data/books.js';
const KEEP = new Set(['correos', 'generales', 'iniciales', 'morales', 'rivales', 'leales', 'fieles', 'metales', 'rodeos',
  'comete', 'debate', 'factor', 'series', 'cultural', 'individual',
  'postales', 'paseos', 'remate', 'liberales', 'paganos', 'estela']);

const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, c => '\\' + c);
const countAll = t => (t.match(/\{\s*es:\s*'/g) || []).length;
const log = []; const errs = [];

for (const lv of ['C1', 'B2']) {
  const f = '_nonword_' + lv + '.txt';
  if (!fs.existsSync(f)) { errs.push('缺清单 ' + f); continue; }
  const words = fs.readFileSync(f, 'utf8').split('\n').slice(1).filter(l => l.includes('|'))
    .map(l => l.split('|')[0].trim()).filter(w => w && !KEEP.has(w));

  // 每次都重新读 + 重新定位该等级（关键：不复用旧偏移量）
  const src = fs.readFileSync(FILE, 'utf8');
  const marks = []; const re = /level:\s*'([A-Z][0-9])'/g; let m;
  while ((m = re.exec(src))) marks.push({ lv: m[1], at: m.index });
  const i = marks.findIndex(x => x.lv === lv);
  const start = marks[i].at, end = i + 1 < marks.length ? marks[i + 1].at : src.length;
  let seg = src.slice(start, end);

  const beforeAll = countAll(src);
  const beforeLv = countAll(seg);
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
  const out = src.slice(0, start) + seg + src.slice(end);
  const afterAll = countAll(out);

  const ok = (beforeLv - afterLv === del) && (beforeAll - afterAll === del);
  if (!ok) {
    errs.push(lv + ' 守恒校验失败，已跳过：等级内 ' + beforeLv + '→' + afterLv + '（删 ' + del + '），全文件 ' + beforeAll + '→' + afterAll);
    log.push(lv + ' 已跳过（未写盘）');
    continue;
  }
  fs.writeFileSync(FILE, out, 'utf8');
  let importOk = true, importErr = '';
  try {
    const bug = await import('./js/data/books.js?v=' + Date.now());
    const b = bug.WORD_BOOKS.find(x => x.level === lv);
    if (!b) { importOk = false; importErr = '导入后找不到 ' + lv; }
    else if (b.words.length !== afterLv) { importOk = false; importErr = '导入后词条数 ' + b.words.length + ' ≠ ' + afterLv; }
  } catch (e) { importOk = false; importErr = String(e && (e.message || e)); }
  if (!importOk) { fs.writeFileSync(FILE, src, 'utf8'); errs.push(lv + ' import 校验失败，已回滚：' + importErr); log.push(lv + ' 已回滚'); continue; }
  log.push(lv + ' 清单 ' + words.length + ' / 删除 ' + del + ' / 等级词条 ' + beforeLv + ' → ' + afterLv + '；全文件 ' + beforeAll + ' → ' + afterAll);
}

const fin = fs.readFileSync(FILE, 'utf8');
const marks2 = []; const re2g = /level:\s*'([A-Z][0-9])'/g; let m2;
while ((m2 = re2g.exec(fin))) marks2.push({ lv: m2[1], at: m2.index });
const cnt = marks2.map((x, i) => {
  const e = i + 1 < marks2.length ? marks2[i + 1].at : fin.length;
  const seg = fin.slice(x.at, e);
  const reE = /\{\s*es:\s*'((?:[^'\\]|\\.)*)'([^}]*)\}/g; let mm; const es = [];
  while ((mm = reE.exec(seg))) es.push(mm[1]);
  const dup = es.length !== new Set(es).size;
  return x.lv + ' ' + es.length + (dup ? '（有重复!）' : '');
}).join(' / ');

fs.writeFileSync('_cleannonword.txt', [...log, '最终各级: ' + cnt,
  errs.length ? '问题：\n' + errs.join('\n') : '无问题'].join('\n') + '\n', 'utf8');
