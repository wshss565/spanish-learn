// A1 收尾：删除重复的 así 条目（保留 pos=adv / zh=这样 的那条）
import fs from 'fs';
const FILE = 'D:/vibecoding/site/js/data/books.js';
const src = fs.readFileSync(FILE, 'utf8');
const reDup = /[ \t]*\{\s*es:\s*'así',\s*zh:\s*'因此',\s*pos:\s*'n',\s*ex:\s*'Así es\.',\s*exZh:\s*'就是这样。'\s*\},?[ \t]*\r?\n?/;
const n = (src.match(reDup) || []).length;
const out = src.replace(reDup, '');
const countAll = t => (t.match(/\{\s*es:\s*'/g) || []).length;
const before = countAll(src), after = countAll(out);
const ok = n === 1 && before - after === 1;
let imp = '未写盘';
if (ok) {
  fs.writeFileSync(FILE, out, 'utf8');
  try { await import('../../js/data/books.js?v=' + Date.now()); imp = '通过'; }
  catch (e) { fs.writeFileSync(FILE, src, 'utf8'); imp = '失败，已回滚 ' + String(e && e.message); }
}
fs.writeFileSync('D:/vibecoding/site/_a1fix.txt', '命中 ' + n + ' / 词条 ' + before + ' → ' + after + '\n守恒：' + (ok ? '通过' : '失败') + '\nimport：' + imp + '\n', 'utf8');
