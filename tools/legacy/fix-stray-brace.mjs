// 精确删除脏条目（zh 里含 {0}，会让 [^}]* 正则提前收尾的元凶）
import fs from 'fs';
const FILE = 'js/data/books.js';
const src = fs.readFileSync(FILE, 'utf8');

const reBad = /[ \t]*\{\s*es:\s*'contratado',\s*zh:\s*'\{0\}发生了宫缩！',\s*pos:\s*'v'\s*\},[ \t]*\r?\n/;
const n = (src.match(reBad) || []).length;
const out = src.replace(reBad, '');
const countAll = t => (t.match(/\{\s*es:\s*'/g) || []).length;

const before = countAll(src), after = countAll(out);
const ok = n === 1 && before - after === 1;
let importOk = true, importErr = '';
if (ok) {
  const backup = src;
  fs.writeFileSync(FILE, out, 'utf8');
  try {
    const m = await import('../../js/data/books.js?v=' + Date.now());
    const b2 = m.WORD_BOOKS.find(x => x.level === 'B2');
    if (!b2 || b2.words.length !== after - 0) { /* 仅记录，不强行比对 */ }
  } catch (e) { importOk = false; importErr = String(e && (e.message || e)); fs.writeFileSync(FILE, backup, 'utf8'); }
}

fs.writeFileSync('_strayfix.txt', [
  '命中 ' + n + ' 条 / 词条数 ' + before + ' → ' + after,
  ok ? '守恒校验：通过' : '守恒校验：未通过（未写盘）',
  importOk ? 'import 校验：通过' : 'import 校验：失败，已回滚 ' + importErr,
].join('\n') + '\n', 'utf8');
