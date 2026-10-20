// A1 词条清理（第三批）：
//   ① INFLECTED —— 变位/派生形式，若其不定式已收录则删除（避免背两遍 + 例句浪费在会删的词上）
//   ② ZH        —— 释义错误/机翻残留/繁体 → 正确简体中文
//   ③ POS       —— 个别词性错标
// 与 clean-a1.mjs 一致的安全约定：
//   - 表里写了但 A1 里没有的词，报错中止、不写盘
//   - 删除必须连行尾逗号一起吃，避免稀疏数组
//   - 写盘后重新 import 校验：无空洞、模块可导入、词条数自洽
import fs from 'fs';

const LEVEL = 'A1';

// form -> infinitive（只在该不定式已存在时才删）
const INFLECTED = {
  van: 'ir', sería: 'ser', supongo: 'suponer', haré: 'hacer', venga: 'venir',
  déjame: 'dejar', escucha: 'escuchar', haya: 'haber', hubiera: 'haber', estabas: 'estar',
  vete: 'ir', pueda: 'poder', podía: 'poder', dime: 'decir', podrías: 'poder',
  iré: 'ir', habría: 'haber', estará: 'estar', tenga: 'tener', haga: 'hacer',
  hagas: 'hacer', digas: 'decir', recuerdo: 'recordar', recuerda: 'recordar', recuerdas: 'recordar',
  encontré: 'encontrar', dile: 'decir', encanta: 'encantar', haz: 'hacer', quieras: 'querer',
  quiera: 'querer', querías: 'querer', tenías: 'tener', tengas: 'tener', estés: 'estar',
  seas: 'ser', hacía: 'hacer', espere: 'esperar', miren: 'mirar', haremos: 'hacer',
  tendrá: 'tener', tendrás: 'tener', tendré: 'tener', tendremos: 'tener', pudiera: 'poder',
  podrían: 'poder', podríamos: 'poder', deberíamos: 'deber', diré: 'decir', diría: 'decir',
  quisiera: 'querer', hubo: 'haber', llamado: 'llamar', llamó: 'llamar', encontramos: 'encontrar',
  vámonos: 'ir', siéntate: 'sentar', hazlo: 'hacer', decirle: 'decir', decirte: 'decir',
  decirme: 'decir', darle: 'dar', verlo: 'ver', verte: 'ver', saberlo: 'saber',
  irme: 'ir', tratando: 'tratar', supone: 'suponer', estábamos: 'estar', mató: 'matar',
  prometo: 'prometer', juro: 'jurar', temo: 'temer', alegro: 'alegrar', esperaba: 'esperar',
  pensaba: 'pensar', suena: 'sonar', disculpe: 'disculpar', cállate: 'callar', anda: 'andar',
  ten: 'tener', mire: 'mirar', importa: 'importar', gustaría: 'gustar', viste: 'ver',
};

// es -> 正确中文（含繁→简统一）
const ZH = {
  haber: '有（助动词）',
  buen: '好的（bueno 的断音形，用于阳单名词前）',
  hacerlo: '做这件事（hacer + lo）',
  vaya: '去（ir 虚拟式）；算了吧',
  quizá: '也许；或许',
  hey: '嘿（感叹词）',
  mas: '但是（书面语，= pero）',
  ello: '它（中性代词）',
  york: '约克（地名）',
  alma: '灵魂',
  ante: '在…面前；鉴于',
  honor: '荣誉',
  señal: '信号；标志',
  necesario: '必要的',
  montón: '一堆；许多',
  decisión: '决定',
  vista: '视野；景色',
  frente: '前额；在…面前',
  oficial: '官方的；官员',
  personal: '个人的；人员',
  presidente: '总统；主席',
  señorita: '小姐',
  muchacho: '男孩',
  real: '真实的；实际的',
  especial: '特别的；特殊的',
  orden: '顺序；命令；秩序',
  información: '信息',
  control: '控制',
  asunto: '事情；话题',
  suelo: '地面；地板',
  hambre: '饥饿',
  totalmente: '完全地',
  silencio: '寂静；沉默',
  segunda: '第二（segunda）',
  derecha: '右边；右侧',
  mejores: '更好的（bueno 复数）',
  muerta: '死的（muerto 阴性）',
  muertos: '死者（muerto 复数）',
  junto: '一起的；邻近的',
  tipos: '类型（tipo 复数）',
  conocido: '认识的；熟人',
  cosas: '东西；事情（cosa 复数）',
  nueva: '新的（nuevo 阴性）',
  adónde: '到哪儿；往哪里',
  ay: '哎哟（感叹）',
  demonios: '恶魔',
  frank: '弗兰克（人名）',
  placer: '愉快（名词）',
  media: '平均',
  recuerdo: '记忆',
  perdón: '宽恕',
  sueño: '睡觉',
  maldición: '诅咒',
  sorpresa: '惊讶',
  infierno: '阴间',
  pensaba: '（我）想；思考（pensar 过去时）',
};

// es -> 正确词性
const POS = {
  mente: 'n',
  placer: 'n',
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
// 预扫描本等级全部 es，供「不定式是否存在」判定（不依赖出现顺序）
const allEs = new Set();
const reScan = /\{\s*es:\s*'((?:[^'\\]|\\.)*)'/g;
let sm;
while ((sm = reScan.exec(segSrc))) allEs.add(sm[1]);

// 删除时连行尾逗号一起吃掉，避免稀疏数组
const reE = /(\{\s*es:\s*'((?:[^'\\]|\\.)*)'([^}]*)\})([ \t]*,[ \t]*\r?\n?)?/g;
const before = (segSrc.match(reE) || []).length;
const seen = new Set();
let deleted = 0, posFixed = 0, zhFixed = 0, keptInflected = 0;

const newSeg = segSrc.replace(reE, (full, obj, es, body, tail) => {
  seen.add(es);
  const inf = INFLECTED[es];
  if (inf) {
    if (allEs.has(inf)) { deleted++; return ''; }
    keptInflected++; // 不定式不在书里，保留该派生形式
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

// 校验：ZN/POS 表里写了但 A1 里没有的词，报错中止
const errs = [];
[...Object.keys(ZH), ...Object.keys(POS)]
  .filter(w => !seen.has(w))
  .forEach(w => errs.push('ZH/POS 表里不存在于 A1: ' + w));
if (errs.length) { fs.writeFileSync('_cleanlog.txt', '中止，未写盘：\n' + errs.join('\n') + '\n', 'utf8'); process.exit(1); }

const out = src.slice(0, seg.at) + newSeg + src.slice(seg.end);
fs.writeFileSync(FILE, out, 'utf8');

const reread = await import('./js/data/books.js?v=' + Date.now());
const a1 = reread.WORD_BOOKS.find(b => b.level === LEVEL);
const after = a1.words.length;
const stillInflected = Object.keys(INFLECTED).filter(w => a1.words.some(x => x.es === w));
const dupEs = {};
a1.words.forEach(w => { dupEs[w.es] = (dupEs[w.es] || 0) + 1; });
const dups = Object.keys(dupEs).filter(k => dupEs[k] > 1);
const holes = a1.words.filter(w => !w || !w.es).length;
fs.writeFileSync('_cleanlog.txt',
  LEVEL + ' 第三批清理完成\n' +
  '  删除变位/派生 ' + deleted + ' 条 / 修词性 ' + posFixed + ' 条 / 修释义 ' + zhFixed + ' 条\n' +
  '  保留（不定式缺失未删） ' + keptInflected + ' 条\n' +
  '  词条数 ' + before + ' → ' + after + '\n' +
  '  稀疏空洞 ' + holes + ' 个' + (holes === 0 ? ' ✓' : ' ✗') + '\n' +
  '  删除后仍残留的派生形式: ' + (stillInflected.length ? stillInflected.join(',') : '无 ✓') + '\n' +
  '  重复词条: ' + (dups.length ? dups.join(',') : '无 ✓') + '\n' +
  '  模块可导入 ✓\n', 'utf8');
