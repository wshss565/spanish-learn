// A1 词条清理（第四批，补漏）：
//   ① INFLECTED —— 仍漏网的变位/派生形式，若不定式已收录则删除
//   ② ZH        —— 仍残留的机翻/错译/繁体 → 正确简体
//   ③ POS       —— 名词/形容词词性误标修正
// 安全约定同 clean-a1-3.mjs：不定式不存在则保留；写盘后重新 import 校验无空洞。
import fs from 'fs';

const LEVEL = 'A1';

const INFLECTED = {
  iba: 'ir', toma: 'tomar', eras: 'ser', habrá: 'haber',
  estaría: 'ser', haría: 'hacer', encuentra: 'encontrar', preocupes: 'preocupar',
};

const ZH = {
  gobierno: '政府',
  primer: '第一（primero 的断音形，用于阳单名词前）',
  cuanto: '多少；至于',
  duro: '硬的；艰难的',
  afuera: '外面；户外',
  falta: '缺少；缺席',
  sino: '但是；而是（sino）',
  mató: '（他/她）杀了',
  alegro: '（我）高兴',
  suena: '（它）响；听起来',
  importa: '（它）重要；有关系（no importa 没关系）',
  recuerda: '（你）记得',
  medio: '中间；一半；方式',
  secreto: '秘密',
};

const POS = {
  sola: 'adj', única: 'adj', segura: 'adj', correcto: 'adj', mala: 'adj',
  agente: 'n', capitán: 'n', teniente: 'n', frente: 'n', sentido: 'n',
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

const segSrc = src.slice(seg.at, seg.end);
const allEs = new Set();
const reScan = /\{\s*es:\s*'((?:[^'\\]|\\.)*)'/g;
let sm;
while ((sm = reScan.exec(segSrc))) allEs.add(sm[1]);

const reE = /(\{\s*es:\s*'((?:[^'\\]|\\.)*)'([^}]*)\})([ \t]*,[ \t]*\r?\n?)?/g;
const before = (segSrc.match(reE) || []).length;
const seen = new Set();
let deleted = 0, posFixed = 0, zhFixed = 0, keptInflected = 0;

const newSeg = segSrc.replace(reE, (full, obj, es, body, tail) => {
  seen.add(es);
  const inf = INFLECTED[es];
  if (inf) {
    if (allEs.has(inf)) { deleted++; return ''; }
    keptInflected++;
  }
  let nb = body;
  const wantPos = POS[es];
  if (wantPos) {
    if (/\bpos:\s*'/.test(nb)) nb = nb.replace(/\bpos:\s*'[^']*'/, "pos: '" + wantPos + "'");
    else nb = nb.replace(/\s+$/, '') + ", pos: '" + wantPos + "'";
    posFixed++;
  }
  const wantZh = ZH[es];
  if (wantZh) {
    if (/\bzh:\s*'/.test(nb)) nb = nb.replace(/\bzh:\s*'(?:[^'\\]|\\.)*'/, "zh: '" + wantZh + "'");
    else nb = nb.replace(/\s+$/, '') + ", zh: '" + wantZh + "'";
    zhFixed++;
  }
  return nb === body ? full : "{ es: '" + es + "'" + nb + " }" + (tail || '');
});

const errs = [];
[...Object.keys(ZH), ...Object.keys(POS)]
  .filter(w => !seen.has(w))
  .forEach(w => errs.push('ZH/POS 表里不存在于 A1: ' + w));
if (errs.length) { fs.writeFileSync('_cleanlog4.txt', '中止，未写盘：\n' + errs.join('\n') + '\n', 'utf8'); process.exit(1); }

const out = src.slice(0, seg.at) + newSeg + src.slice(seg.end);
fs.writeFileSync(FILE, out, 'utf8');

const reread = await import('./js/data/books.js?v=' + Date.now());
const a1 = reread.WORD_BOOKS.find(b => b.level === LEVEL);
const after = a1.words.length;
const stillInflected = Object.keys(INFLECTED).filter(w => a1.words.some(x => x.es === w));
const holes = a1.words.filter(w => !w || !w.es).length;
fs.writeFileSync('_cleanlog4.txt',
  LEVEL + ' 第四批清理完成\n' +
  '  删除 ' + deleted + ' / 修词性 ' + posFixed + ' / 修释义 ' + zhFixed + '\n' +
  '  保留（不定式缺失） ' + keptInflected + ' 条\n' +
  '  词条数 ' + before + ' → ' + after + '\n' +
  '  稀疏空洞 ' + holes + ' 个' + (holes === 0 ? ' ✓' : ' ✗') + '\n' +
  '  删除后仍残留: ' + (stillInflected.length ? stillInflected.join(',') : '无 ✓') + '\n' +
  '  模块可导入 ✓\n', 'utf8');
