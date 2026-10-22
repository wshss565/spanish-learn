// 把 clean-a2-2.mjs 里的 HOMO 白名单同步进 data-lint.mjs（两边不同步会让真名词被误判成"变位重复"）
import fs from 'fs';

const cl = fs.readFileSync('clean-a2-2.mjs', 'utf8');
const m = cl.match(/const HOMO = new Set\(\[([\s\S]*?)\]\);/);
if (!m) throw new Error('clean-a2-2.mjs 里没找到 HOMO');
const words = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
const uniq = [...new Set(words)];
if (uniq.length < 200) throw new Error('提取到的白名单过少：' + uniq.length);

const dl = fs.readFileSync('../data-lint.mjs', 'utf8');
const reOld = /const HOMO = new Set\(\[[\s\S]*?\]\);/;
if (!reOld.test(dl)) throw new Error('data-lint.mjs 里没找到 HOMO');
const lines = [];
for (let i = 0; i < uniq.length; i += 8) lines.push('    ' + uniq.slice(i, i + 8).map(w => "'" + w + "'").join(', ') + ',');
const block = 'const HOMO = new Set([\n' + lines.join('\n') + '\n  ]);';
const out = dl.replace(reOld, block);
fs.writeFileSync('../data-lint.mjs', out, 'utf8');

// 校验：替换后语法可解析
try {
  await import('../data-lint.mjs?x=' + Date.now());
  fs.writeFileSync('_synchomo.txt', '同步完成：白名单 ' + uniq.length + ' 条；data-lint.mjs 可正常加载\n', 'utf8');
} catch (e) {
  fs.writeFileSync('_synchomo.txt', 'ERR 替换后无法加载：' + String(e && e.message) + '\n', 'utf8');
}
