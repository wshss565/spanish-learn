import fs from 'fs';
const src = fs.readFileSync('js/data/books.js', 'utf8');
const lines = src.split(/\r?\n/);
const out = [];

// A) 一行里出现 ≥2 个条目（可能缺逗号粘在一起）
const multi = [];
lines.forEach((l, i) => {
  const n = (l.match(/\{\s*es:\s*'/g) || []).length;
  if (n > 1) multi.push(i + 1);
});
out.push('一行包含多个条目的行：' + (multi.length ? multi.slice(0, 20).join(',') : '无'));

// B) 全文件里 "} {"（中间只有空白）＝相邻两对象
const adj = [];
lines.forEach((l, i) => { if (/\}\s*\{/.test(l)) adj.push(i + 1); });
out.push('出现 "} {" 的行：' + (adj.length ? adj.slice(0, 20).join(',') : '无'));

// C) 数组结束标记 ] 后面紧跟条目
const afterBracket = [];
lines.forEach((l, i) => { if (/\]\s*,\s*\{\s*es:/.test(l) || /\]\s*\{\s*es:/.test(l)) afterBracket.push(i + 1); });
out.push('"] ... { es:" 的行：' + (afterBracket.length ? afterBracket.slice(0, 20).join(',') : '无'));

// D) 打印 B2 段（大概率出问题处）里所有被我本次加过例句的行之外的可疑行：
//    找出形如 "... }   }" 或 "... }] { es:" 的
const weird = [];
lines.forEach((l, i) => { if (/\}\s{2,}\}/.test(l) || /\}\]\s*\{/.test(l)) weird.push(i + 1); });
out.push('"}  }" 或 "}] {" 的行：' + (weird.length ? weird.slice(0, 20).join(',') : '无'));

fs.writeFileSync('_broken2.txt', out.join('\n') + '\n', 'utf8');
