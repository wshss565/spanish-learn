// 把例句数据写回 js/data/books.js，并做自校验。
// 用法：node tools/add-examples.mjs A1 data/examples/examples-b2-1.mjs ...
//
// 校验项：
//   1) 目标词条确实存在于该等级，且每个都拿到了新例句
//   2) 每个例句都**原样包含**该词（大小写不敏感、重音敏感）——否则完形挖空与点词查义会静默失效
//   3) 各等级词条数不变（防止正则误伤）
//   4) 产物能被 import（语法/引号没写坏）
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const LEVEL = (process.argv[2] || 'A1').toUpperCase();
const dataFiles = process.argv.slice(3);
if (!dataFiles.length) { console.error('用法: node add-examples.mjs A1 _ex1.mjs ...'); process.exit(1); }

const map = new Map();
for (const f of dataFiles) {
  const mod = await import(pathToFileURL(path.resolve(f)).href);
  (mod.EX || []).forEach(([es, ex, exZh]) => {
    if (!es || !ex || !exZh) throw new Error(f + ' 里有不完整条目: ' + JSON.stringify([es, ex, exZh]));
    if (map.has(es)) throw new Error('重复词条: ' + es + '（' + f + '）');
    map.set(es, { ex, exZh });
  });
}

const FILE = 'js/data/books.js';
const src = fs.readFileSync(FILE, 'utf8');
const marks = [];
const re = /level:\s*'([A-Z][0-9])'/g;
let m;
while ((m = re.exec(src))) marks.push({ lv: m[1], at: m.index });
marks.forEach((x, i) => x.end = i + 1 < marks.length ? marks[i + 1].at : src.length);
const seg = marks.find(x => x.lv === LEVEL);
if (!seg) throw new Error('找不到等级 ' + LEVEL);

const escRe = s => String(s).replace(/[.*+^$()|[\]\\]/g, c => '\\' + c);
const wordIn = (s, w) => new RegExp(`(^|[^\\p{L}\\p{N}])(${escRe(w)})([^\\p{L}\\p{N}]|$)`, 'iu').test(s);

const reE = /\{\s*es:\s*'((?:[^'\\]|\\.)*)'([^}]*)\}/g;
const applied = new Set();
let replaced = 0, inserted = 0;

const newSeg = src.slice(seg.at, seg.end).replace(reE, (full, es, body) => {
  const hit = map.get(es);
  if (!hit) return full;
  applied.add(es);
  let nb = body;
  if (/\bex:\s*'/.test(nb)) {
    nb = nb.replace(/\bex:\s*'(?:[^'\\]|\\.)*'/, "ex: '" + hit.ex + "'")
           .replace(/\bexZh:\s*'(?:[^'\\]|\\.)*'/, "exZh: '" + hit.exZh + "'");
    replaced++;
  } else {
    nb = nb.replace(/\s+$/, '') + ", ex: '" + hit.ex + "', exZh: '" + hit.exZh + "'";
    inserted++;
  }
  return "{ es: '" + es + "'" + nb + " }";
});

const missing = [...map.keys()].filter(k => !applied.has(k));
const out = src.slice(0, seg.at) + newSeg + src.slice(seg.end);
fs.writeFileSync(FILE, out, 'utf8');

// —— 校验 ——
const errs = [];
missing.forEach(k => errs.push('未在 ' + LEVEL + ' 找到词条: ' + k));
const reread = await import('../js/data/books.js?v=' + Date.now());
const books = reread.WORD_BOOKS;
const a1 = books.find(b => b.level === LEVEL);
if (!a1) errs.push('重新导入后找不到 ' + LEVEL);
else {
  const beforeCount = (src.slice(seg.at, seg.end).match(reE) || []).length;
  if (a1.words.length !== beforeCount) errs.push('词条数变了: ' + beforeCount + ' → ' + a1.words.length);
  let checked = 0;
  [...map.keys()].forEach(k => {
    a1.words.filter(w => w.es === k).forEach(w => {
      checked++;
      if (!w.ex || !w.exZh) errs.push(k + ' 缺少例句字段');
      else if (!wordIn(w.ex, k)) errs.push(k + ' 的例句不含原词: ' + w.ex);
    });
  });
  if (!checked) errs.push('校验时没匹配到任何词条');
  fs.writeFileSync('_addlog.txt',
    LEVEL + ' 打补丁：替换 ' + replaced + ' 条 / 新增 ' + inserted + ' 条 / 数据源 ' + map.size + ' 条\n' +
    '校验通过 ' + (map.size - errs.length) + '/' + map.size + '\n' +
    (errs.length ? '问题：\n' + errs.join('\n') + '\n' : '无问题\n'), 'utf8');
}
