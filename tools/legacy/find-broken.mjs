import fs from 'fs';
const src = fs.readFileSync('js/data/books.js', 'utf8');
const lines = src.split(/\r?\n/);
const out = [];

// 1) 全局花括号
const openAll = (src.match(/\{/g) || []).length, closeAll = (src.match(/\}/g) || []).length;
out.push('全文件 { ' + openAll + ' / } ' + closeAll + (openAll === closeAll ? ' 平衡' : ' 不平衡！'));

// 2) 逐行累计深度：找出第一个变负的行
let depth = 0, firstNeg = -1;
lines.forEach((l, i) => {
  const o = (l.match(/\{/g) || []).length, c = (l.match(/\}/g) || []).length;
  depth += o - c;
  if (depth < 0 && firstNeg < 0) firstNeg = i + 1;
});
out.push('累计深度最终 = ' + depth + (firstNeg > 0 ? ' ；首个变负行 = ' + firstNeg : ''));

// 3) 单引号奇偶（奇数＝引号没闭合）
const odd = [];
lines.forEach((l, i) => { const q = (l.match(/'/g) || []).length; if (q % 2) odd.push(i + 1); });
out.push('引号数为奇数的行：' + (odd.length ? odd.slice(0, 10).join(',') : '无'));

// 4) 条目行形态检查
const bad = [];
lines.forEach((l, i) => {
  if (!l.includes("es: '")) return;
  const t = l.trim().replace(/,$/, '');
  const ok = /^\{\s*es:\s*'([^']|\\')*'.*\}$/.test(t);
  if (!ok) bad.push((i + 1) + ': ' + t.slice(0, 240));
});
out.push('形态异常条目行 ' + bad.length + ' 条：');
out.push(...bad.slice(0, 12));

fs.writeFileSync('_broken.txt', out.join('\n') + '\n', 'utf8');
