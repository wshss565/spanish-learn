// A1 清理第二轮：清掉第一轮漏网的变位形式，并修正剩余的错误释义。
// 与 clean-a1.mjs 同构（同一套校验：条目不存在即中止、删除连逗号一起吃掉、查空洞）。
import fs from 'fs';

const LEVEL = 'A1';
const DELETE = ['parece', 'queda', 'ido', 'decía'];

const ZH = {
  jamás: '从未；决不', servicio: '服务', embargo: '禁运（sin embargo 然而）', fotos: '照片（复数）',
  broma: '玩笑；开玩笑', permiso: '许可；允许', rato: '一会儿', unos: '一些（阳复）',
  unas: '一些（阴复）', caballeros: '先生们；诸位', caballero: '先生；绅士',
  minutos: '分钟（复数）', carrera: '职业生涯；专业', señor: '先生', del: '的（de + el）',
};

const FILE = 'js/data/books.js';
const src = fs.readFileSync(FILE, 'utf8');
const marks = [];
const re = /level:\s*'([A-Z][0-9])'/g;
let m;
while ((m = re.exec(src))) marks.push({ lv: m[1], at: m.index });
marks.forEach((x, i) => x.end = i + 1 < marks.length ? marks[i + 1].at : src.length);
const seg = marks.find(x => x.lv === LEVEL);
if (!seg) throw new Error('找不到等级 ' + LEVEL);

const reE = /(\{\s*es:\s*'((?:[^'\\]|\\.)*)'([^}]*)\})([ \t]*,[ \t]*\r?\n?)?/g;
const before = (src.slice(seg.at, seg.end).match(reE) || []).length;
const seen = new Set();
let deleted = 0, zhFixed = 0;

const newSeg = src.slice(seg.at, seg.end).replace(reE, (full, obj, es, body, tail) => {
  seen.add(es);
  if (DELETE.includes(es)) { deleted++; return ''; }
  let nb = body;
  const wantZh = ZH[es];
  if (wantZh) {
    if (/\bzh:\s*'/.test(nb)) nb = nb.replace(/\bzh:\s*'(?:[^'\\]|\\.)*'/, "zh: '" + wantZh + "'");
    else nb = nb.replace(/\s+$/, '') + ", zh: '" + wantZh + "'";
    zhFixed++;
  }
  return nb === body ? full : "{ es: '" + es + "'" + nb + " }" + (tail || '');
});

const errs = [];
DELETE.filter(w => seen.has(w) === false).forEach(w => errs.push('DELETE 表中 A1 不存在: ' + w));
// 释义表里的词如果不存在，只是空转，不算错误（同一批数据可能跨等级复用）
if (errs.length) { fs.writeFileSync('_cleanlog2.txt', '中止，未写盘：\n' + errs.join('\n') + '\n', 'utf8'); process.exit(1); }

fs.writeFileSync(FILE, src.slice(0, seg.at) + newSeg + src.slice(seg.end), 'utf8');

const reread = await import('../../js/data/books.js?v=' + Date.now());
const a1 = reread.WORD_BOOKS.find(b => b.level === LEVEL);
const after = a1.words.length;
const holes = a1.words.filter(w => !w || !w.es).length;
const stillThere = DELETE.filter(w => a1.words.some(x => x.es === w));
fs.writeFileSync('_cleanlog2.txt',
  LEVEL + ' 第二轮清理完成\n' +
  '  删除 ' + deleted + ' 条 / 修释义 ' + zhFixed + ' 条\n' +
  '  词条数 ' + before + ' → ' + after + '（预期 ' + (before - DELETE.length) + '，' + (after === before - DELETE.length ? '一致 ✓' : '不一致 ✗') + '）\n' +
  '  稀疏空洞 ' + holes + ' 个' + (holes === 0 ? ' ✓' : ' ✗') + '\n' +
  '  删除后仍残留: ' + (stillThere.length ? stillThere.join(',') : '无 ✓') + '\n' +
  '  模块可导入 ✓\n', 'utf8');
