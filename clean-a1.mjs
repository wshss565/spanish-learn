// A1 词条清理：
//   ① DELETE —— 变位形式与不定式重复收录的词条（学习者要背两遍，且释义基本是机翻）
//   ② POS    —— 功能词被误标成 n（会污染语法模块的「名词」池）
//   ③ ZH     —— 释义错误/机翻残留，改为正确中文
// 任何一条在 A1 里找不到都会报错中止，不会静默写坏。
import fs from 'fs';

const LEVEL = 'A1';
const DELETE = [
  // —— ser / estar ——
  'soy', 'eres', 'son', 'somos', 'fui', 'fuiste', 'fue', 'fueron', 'era', 'eran', 'sea', 'sido', 'siendo',
  'estoy', 'estás', 'está', 'estamos', 'están', 'estaba', 'estuve', 'estuvo',
  // —— haber ——
  'ha', 'han', 'hemos',
  // —— tener ——
  'tengo', 'tienes', 'tiene', 'tenemos', 'tienen',
  // —— poder ——
  'puedo', 'puedes', 'puede', 'podemos', 'pueden', 'pude', 'pudo', 'podría',
  // —— querer ——
  'quiero', 'quieres', 'quiere', 'quieren', 'queremos', 'quería', 'querido',
  // —— hacer ——
  'hago', 'haces', 'hace', 'hacemos', 'hacen', 'hice', 'hiciste', 'hicimos', 'hicieron', 'haciendo',
  // —— decir ——
  'digo', 'dices', 'dice', 'dicen', 'dije', 'dijiste', 'dijo', 'dijeron', 'diciendo', 'dicho', 'diga',
  // —— ver / ir / venir / dar / saber / conocer ——
  'veo', 've', 'vemos', 'vio', 'visto', 'voy', 'vas', 'vamos', 'ven', 'viene', 'vine', 'venido',
  'da', 'dan', 'sabes', 'sabe', 'sabemos', 'saben', 'sabía', 'conozco', 'conoces', 'conoce', 'significa',
  // —— deber / pensar / sentir / mirar / esperar / dejar / necesitar / llevar / llamar / tratar ——
  'debo', 'debes', 'debe', 'deben', 'debemos', 'debería', 'deberías',
  'pensé', 'pienso', 'pensando', 'pensado', 'siento', 'sientes', 'siente',
  'mira', 'mirando', 'espera', 'espero', 'esperando',
  'deja', 'dejó', 'dejado', 'necesito', 'necesita', 'necesitas', 'necesitamos',
  'lleva', 'llevo', 'llama', 'llamas', 'trata', 'trato',
  // —— 进行时 / 过去分词 / 其他变位 ——
  'hablando', 'habla', 'hablas', 'pasando', 'pasa', 'pasó', 'buscando', 'trabajando',
  'entiendo', 'entiendes', 'entendido', 'vuelve', 'vuelto', 'salió', 'sale', 'abre',
  'llegó', 'llegado', 'creo', 'crees', 'cree', 'creí', 'vive', 'sigue', 'traje',
  'gusta', 'gustan', 'gusto', 'muerto', 'murió', 'encontrado', 'perdido',
];

const POS = {
  // 限定词 / 代词 / 副词 / 连词
  no: 'adv', más: 'adv', menos: 'adv', esto: 'pron', ese: 'pron', esos: 'pron', estas: 'pron',
  estos: 'pron', aquel: 'pron', algo: 'pron', alguien: 'pron', nadie: 'pron', quien: 'pron',
  otra: 'pron', otras: 'pron', otro2: 'pron', toda: 'pron', todas: 'pron', ninguna: 'pron', ningún: 'pron',
  algún: 'pron', alguna: 'pron', algunas: 'pron', algunos: 'pron', otros: 'pron', tal: 'adj',
  muchas: 'adj', muchos: 'adj', mucha: 'adj', nuestros: 'adj', nuestras: 'adj', nuestra: 'adj', mía: 'adj',
  conmigo: 'adv', contigo: 'adv', luego: 'adv', incluso: 'adv', bastante: 'adv', allá: 'adv', tanto: 'adv',
  cuál: 'pron', tus: 'adj', sus: 'adj', os: 'pron', hay: 'v', mí: 'pron', usted: 'pron', ustedes: 'pron',
  el: 'det', una: 'det', del: 'prep',
};

const ZH = {
  // 释义错误 / 机翻残留 → 正确中文
  del: '的（de + el 的缩合）', hay: '有（存在）', más: '更；更多', menos: '更少；更少地',
  esto: '这个（中性）', ese: '那个', esos: '那些', estas: '这些',
  estos: '这些（阳）', aquel: '那个（较远）', algo: '某物；一些东西', alguien: '某人；有人',
  nadie: '没有人', quien: '谁（关系代词）', quien2: '谁', cuál: '哪一个', tus: '你的（复数）',
  sus: '他/她/您的（复数）', os: '你们（宾/与格）', mí: '我（重读宾格）', mía: '我的（阴性）',
  conmigo: '和我一起', contigo: '和你一起', luego: '然后；稍后', incluso: '甚至；包括',
  bastante: '足够；相当', allá: '那边', tanto: '这么多；如此', otra: '另一个（阴）', otras: '另一些',
  toda: '全部（阴）', todas: '全部（阴复）', ninguna: '没有一个（阴）', ningún: '没有一个（阳）',
  algún: '某个（阳）', alguna: '某个（阴）', algunas: '一些（阴复）', algunos: '一些（阳复）',
  otros: '另一些（阳复）', tal: '这样的；如此的', muchas: '很多（阴复）', muchos: '很多（阳复）',
  mucha: '很多（阴）', nuestros: '我们的（阳复）', nuestras: '我们的（阴复）', nuestra: '我们的（阴）',
  favor: '恩惠；帮忙', dios: '上帝；神', hola: '你好', gracias: '谢谢', oh: '哦（感叹）',
  fuera: '外面；在外面', seguro: '安全的；当然', estado: '状态', tipo: '类型；种类',
  vale: '好的；行（口语）', oye: '喂；哎（引起注意）', único: '唯一的', última: '最后的（阴）',
  única: '唯一的（阴）', años: '年（复数）', meses: '月（复数）', minutos: '分钟（复数）',
  problemas: '问题（复数）', dólares: '美元（复数）', millones: '百万（复数）',
  mamá: '妈妈', papá: '爸爸', bebé: '婴儿', suerte: '运气', realidad: '现实',
  increíble: '难以置信的', chicos: '男孩们；小伙子们', chicas: '女孩们', escucha: '听（命令式）',
  hecho: '事实；（已经）做好的', como: '如同；像；怎样', que: '那个；那个（关系代词/连词）',
  que2: '（关系代词/连词）', cariño: '亲爱的；疼爱', genial: '很棒的；极好的',
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

// 注意：删除时必须连同行尾的逗号一起吃掉。只删 `{...}` 会留下 `,\n  ,\n`，
// 数组变成**稀疏数组**（空洞也计入 length 且元素为 undefined），比删除前更糟。
const reE = /(\{\s*es:\s*'((?:[^'\\]|\\.)*)'([^}]*)\})([ \t]*,[ \t]*\r?\n?)?/g;
const before = (src.slice(seg.at, seg.end).match(reE) || []).length;
const seen = new Set();
let deleted = 0, posFixed = 0, zhFixed = 0;

const newSeg = src.slice(seg.at, seg.end).replace(reE, (full, obj, es, body, tail) => {
  seen.add(es);
  if (DELETE.includes(es)) { deleted++; return ''; }
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

// 校验：表里写了但 A1 里没有的词，一律报错（避免误删/误改）
const errs = [];
DELETE.filter(w => !seen.has(w)).forEach(w => errs.push('DELETE 表里不存在于 A1: ' + w));
[...Object.keys(POS), ...Object.keys(ZH)].filter(w => !/\d$/.test(w) && !seen.has(w))
  .forEach(w => errs.push('POS/ZH 表里不存在于 A1: ' + w));
if (errs.length) { fs.writeFileSync('_cleanlog.txt', '中止，未写盘：\n' + errs.join('\n') + '\n', 'utf8'); process.exit(1); }

const out = src.slice(0, seg.at) + newSeg + src.slice(seg.end);
fs.writeFileSync(FILE, out, 'utf8');

const reread = await import('./js/data/books.js?v=' + Date.now());
const a1 = reread.WORD_BOOKS.find(b => b.level === LEVEL);
const after = a1.words.length;
const stillThere = DELETE.filter(w => a1.words.some(x => x.es === w));
const dupEs = {};
a1.words.forEach(w => { dupEs[w.es] = (dupEs[w.es] || 0) + 1; });
const dups = Object.keys(dupEs).filter(k => dupEs[k] > 1);
const holes = a1.words.filter(w => !w || !w.es).length;
fs.writeFileSync('_cleanlog.txt',
  LEVEL + ' 清理完成\n' +
  '  删除 ' + deleted + ' 条 / 修词性 ' + posFixed + ' 条 / 修释义 ' + zhFixed + ' 条\n' +
  '  词条数 ' + before + ' → ' + after + '（预期 ' + (before - DELETE.length) + '，' + (after === before - DELETE.length ? '一致 ✓' : '不一致 ✗') + '）\n' +
  '  稀疏空洞 ' + holes + ' 个' + (holes === 0 ? ' ✓' : ' ✗') + '\n' +
  '  删除后仍残留: ' + (stillThere.length ? stillThere.join(',') : '无 ✓') + '\n' +
  '  重复词条: ' + (dups.length ? dups.join(',') : '无 ✓') + '\n' +
  '  模块可导入 ✓\n', 'utf8');
