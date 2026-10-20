// A2 释义 / 词性修正（二次清理的第 3 步）
// 词书里大量真实单词被机器翻译塞进了错义或乱码（cargo=受扶养配偶. / hechos=艾哈迈德·阿布·盖特 /
// sacar=外卖 / salvar=保存 …），还有整批把形容词、代词标成 n 的词性错误。
// 这里按人工核对的表就地改写 zh / pos；表里写了但词书里没有的词一律报错中止、不写盘。
import fs from 'fs';

const FILE = 'js/data/books.js';
const src = fs.readFileSync(FILE, 'utf8');
const marks = [];
const re = /level:\s*'([A-Z][0-9])'/g;
let m; while ((m = re.exec(src))) marks.push({ lv: m[1], at: m.index });
const iA2 = marks.findIndex(x => x.lv === 'A2');
const start = marks[iA2].at, end = marks[iA2 + 1] ? marks[iA2 + 1].at : src.length;
let seg = src.slice(start, end);

// —— 要删除的（本身不是词条；注意 pos='v' 且以 er/ir 结尾的专名/脏词会骗过"是不是不定式"的判定）——
const DEL = ['joder', 'walter', 'tengan'];

// —— es → { zh?, pos? } ——
const FIX = {
  // 明显错义 / 乱码
  embargar: { zh: '查封；扣押' }, sacar: { zh: '取出；拿出' }, salvar: { zh: '挽救；拯救' },
  coger: { zh: '拿；抓；乘坐' }, pesar: { zh: '称重；使难过' }, aceptar: { zh: '接受' },
  crear: { zh: '创造' }, funcionar: { zh: '运转；起作用' }, manejar: { zh: '操作；驾驶' },
  recuperar: { zh: '恢复；找回' }, recoger: { zh: '拾起；收拾' }, sobrevivir: { zh: '幸存' },
  conducir: { zh: '驾驶' }, proteger: { zh: '保护' }, resolver: { zh: '解决' },
  cargo: { zh: '职位；负荷；费用' }, tema: { zh: '主题；话题' }, zona: { zh: '区域；地带' },
  destino: { zh: '命运；目的地' }, corte: { zh: '切；切口' },
  vidas: { zh: '生命（复数）' }, juicio: { zh: '审判；判断' }, radio: { zh: '收音机；半径' },
  pista: { zh: '线索；跑道' }, sueños: { zh: '梦（复数）' }, miles: { zh: '数千' },
  hermanos: { zh: '兄弟姐妹' }, vistazo: { zh: '一瞥' }, nena: { zh: '小女孩' },
  cielos: { zh: '天空（复数）' }, reglas: { zh: '规则（复数）' }, principal: { zh: '主要的' },
  bomba: { zh: '炸弹；泵' }, pistola: { zh: '手枪' }, marcha: { zh: '行进；离开' },
  humanos: { zh: '人类' }, mentira: { zh: '谎言' }, flores: { zh: '花（复数）' },
  enemigo: { zh: '敌人' }, luces: { zh: '灯（复数）' }, embarazada: { zh: '怀孕的' },
  pantalones: { zh: '裤子' }, defensa: { zh: '防御；辩护' }, testigo: { zh: '证人' },
  metros: { zh: '米（复数）' }, cuántas: { zh: '多少（阴性复数）' }, ridículo: { zh: '可笑的' },
  damas: { zh: '女士们' }, copa: { zh: '酒杯；一杯' }, espíritu: { zh: '精神；灵魂' },
  asuntos: { zh: '事务（复数）' }, memoria: { zh: '记忆' }, estrellas: { zh: '星星（复数）' },
  red: { zh: '网；网络' }, cuentas: { zh: '账目；账单（复数）' }, dientes: { zh: '牙齿' },
  encantado: { zh: '很高兴（认识你）' }, momentos: { zh: '时刻（复数）' }, señoría: { zh: '阁下' },
  nervioso: { zh: '紧张的' }, emergencia: { zh: '紧急情况' }, bala: { zh: '子弹' },
  tiro: { zh: '射击；投掷' }, pelear: { zh: '打斗；争吵' }, echar: { zh: '扔；投；赶走' },
  princesa: { zh: '公主' }, casas: { zh: '房子（复数）' }, paseo: { zh: '散步' },
  llamadas: { zh: '电话（复数）' }, ministro: { zh: '部长' }, borracho: { zh: '醉汉；醉的' },
  contrato: { zh: '合同' }, hechos: { zh: '事实（复数）' }, enamorado: { zh: '恋爱中的；恋人' },
  profesional: { zh: '专业的；专业人士' }, jurado: { zh: '陪审团' }, casos: { zh: '案件（复数）' },
  piedra: { zh: '石头' }, intención: { zh: '意图' }, víctimas: { zh: '受害者（复数）' },
  asesinado: { zh: '被谋杀的；遇害者' }, compañeros: { zh: '同伴（复数）' }, oscuridad: { zh: '黑暗' },
  mirada: { zh: '目光；一瞥', pos: 'n' }, demonio: { zh: '恶魔' }, cuesta: { zh: '坡；斜坡' },
  marca: { zh: '品牌；标记' }, sexual: { zh: '性的' }, dueño: { zh: '主人；所有者' },
  fantasma: { zh: '鬼；幽灵' }, responsabilidad: { zh: '责任' }, dedo: { zh: '手指' },
  razones: { zh: '原因（复数）' }, cinta: { zh: '带子；胶带' }, polvo: { zh: '灰尘' },
  campamento: { zh: '营地' }, valiente: { zh: '勇敢的' }, extra: { zh: '额外的；临时演员' },
  números: { zh: '数字（复数）' }, niñas: { zh: '女孩（复数）' }, genio: { zh: '天才；脾气' },
  deprisa: { zh: '快速地', pos: 'adv' }, talento: { zh: '才能；天赋' }, gas: { zh: '气体；煤气' },
  gloria: { zh: '荣耀' }, disparo: { zh: '射击；枪声' }, gracia: { zh: '恩惠；幽默；谢谢' },
  cuerpos: { zh: '身体（复数）' }, amigas: { zh: '女性朋友（复数）' }, original: { zh: '最初的；原创的' },
  pedazo: { zh: '块；片' }, salón: { zh: '客厅；大厅' }, visión: { zh: '视觉；视野' },
  libras: { zh: '磅（复数）' }, probable: { zh: '可能的', pos: 'adj' }, corta: { zh: '短的（阴性）', pos: 'adj' },
  completa: { zh: '完整的（阴性）', pos: 'adj' }, antigua: { zh: '古老的（阴性）', pos: 'adj' },
  // 词性错标修正（形容词/代词/名词被标成 n 或 v）
  hogar: { zh: '家；家庭', pos: 'n' }, listos: { zh: '准备好的', pos: 'adj' },
  lindo: { zh: '漂亮的；可爱的', pos: 'adj' }, humanos: { zh: '人类的', pos: 'adj' },
  apenas: { zh: '几乎不；刚刚', pos: 'adv' }, cuántos: { zh: '多少（阳性复数）', pos: 'det' },
  excepto: { zh: '除…之外', pos: 'prep' }, lleno: { zh: '满的', pos: 'adj' },
  alta: { zh: '高的（阴性）', pos: 'adj' }, completo: { zh: '完整的', pos: 'adj' },
  diferentes: { zh: '不同的', pos: 'adj' }, molesta: { zh: '烦人的（阴性）', pos: 'adj' },
  común: { zh: '共同的；普通的', pos: 'adj' }, ojalá: { zh: '但愿', pos: 'interj' },
  repente: { zh: '突然（de repente）', pos: 'n' }, doble: { zh: '双倍的', pos: 'adj' },
  acaso: { zh: '也许', pos: 'adv' }, exacto: { zh: '准确的', pos: 'adj' },
  jóvenes: { zh: '年轻人（复数）', pos: 'adj' }, fantástico: { zh: '极好的', pos: 'adj' },
  paciente: { zh: '病人；耐心的', pos: 'n' }, equivocado: { zh: '错误的', pos: 'adj' },
  suyo: { zh: '他的；她的', pos: 'pron' }, suya: { zh: '他的；她的', pos: 'pron' },
  vuestra: { zh: '你们的', pos: 'det' }, vuestro: { zh: '你们的', pos: 'det' },
  ése: { zh: '那个', pos: 'pron' }, ésa: { zh: '那个', pos: 'pron' },
  llena: { zh: '满的（阴性）', pos: 'adj' }, absoluto: { zh: '绝对的', pos: 'adj' },
  brillante: { zh: '明亮的；出色的', pos: 'adj' }, estupendo: { zh: '极好的', pos: 'adj' },
  tanta: { zh: '这么多（阴性）', pos: 'det' }, tantas: { zh: '这么多（阴性复数）', pos: 'det' },
  tantos: { zh: '这么多（阳性复数）', pos: 'det' }, varios: { zh: '几个', pos: 'det' },
  menor: { zh: '较小的；年幼的', pos: 'adj' }, dura: { zh: '硬的（阴性）', pos: 'adj' },
  abierta: { zh: '打开的（阴性）', pos: 'adj' }, negra: { zh: '黑的（阴性）', pos: 'adj' },
  roja: { zh: '红的（阴性）', pos: 'adj' }, bella: { zh: '美丽的', pos: 'adj' },
  varias: { zh: '几个（阴性复数）', pos: 'det' }, guapa: { zh: '漂亮的（阴性）', pos: 'adj' },
  viejos: { zh: '旧的（复数）', pos: 'adj' }, nuevos: { zh: '新的（复数）', pos: 'adj' },
  perfecta: { zh: '完美的', pos: 'adj' }, extraña: { zh: '奇怪的（阴性）', pos: 'adj' },
  felices: { zh: '幸福的（复数）', pos: 'adj' }, locos: { zh: '疯狂的（复数）', pos: 'adj' },
  total: { zh: '总的；总数', pos: 'adj' }, solos: { zh: '独自的（复数）', pos: 'adj' },
  aquellos: { zh: '那些', pos: 'pron' }, pocos: { zh: '少的（复数）', pos: 'det' },
  enferma: { zh: '生病的（阴性）', pos: 'adj' }, bienvenidos: { zh: '欢迎（复数）', pos: 'adj' },
  impresionante: { zh: '令人印象深刻的', pos: 'adj' }, malos: { zh: '坏的（复数）', pos: 'adj' },
  primeros: { zh: '最初的（复数）', pos: 'adj' }, tercera: { zh: '第三（阴性）', pos: 'adj' },
  asustado: { zh: '害怕的', pos: 'adj' }, importantes: { zh: '重要的（复数）', pos: 'adj' },
  pequeñas: { zh: '小的（阴性复数）', pos: 'adj' }, pequeños: { zh: '小的（复数）', pos: 'adj' },
  amenaza: { zh: '威胁' }, preciosa: { zh: '珍贵的；美丽的', pos: 'adj' },
  gratis: { zh: '免费的', pos: 'adj' }, directo: { zh: '直接的；直播', pos: 'adj' },
  inmediato: { zh: '立即的', pos: 'adj' }, privado: { zh: '私人的', pos: 'adj' },
  fuente: { zh: '来源；喷泉', pos: 'n' }, sonido: { zh: '声音', pos: 'n' },
  pasada: { zh: '一次；经过', pos: 'n' }, alguno: { zh: '某个', pos: 'pron' },
  familiar: { zh: '家庭的；熟悉的', pos: 'adj' }, líder: { zh: '领袖', pos: 'n' },
  militar: { zh: '军事的；军人', pos: 'adj' }, tribunal: { zh: '法庭', pos: 'n' },
  dispuesto: { zh: '愿意的；准备好的', pos: 'adj' }, cadáver: { zh: '尸体', pos: 'n' },
  temporada: { zh: '季节；时期', pos: 'n' }, tercer: { zh: '第三', pos: 'adj' },
  propios: { zh: '自己的（复数）', pos: 'adj' }, complicado: { zh: '复杂的', pos: 'adj' },
  americano: { zh: '美洲的；美国人', pos: 'adj' }, material: { zh: '材料', pos: 'n' },
  cáncer: { zh: '癌症', pos: 'n' }, funeral: { zh: '葬礼', pos: 'n' },
  favorito: { zh: '最喜欢的', pos: 'adj' }, menudo: { zh: '小的', pos: 'adj' },
  hermoso: { zh: '漂亮的', pos: 'adj' }, limpiar: { zh: '打扫；清洁' },
};

const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, c => '\\' + c);
const reE = /\{\s*es:\s*'((?:[^'\\]|\\.)*)'([^}]*)\}/g;
const present = new Set();
let mm; while ((mm = reE.exec(seg))) present.add(mm[1]);

const errs = [];
[...Object.keys(FIX), ...DEL].forEach(k => { if (!present.has(k)) errs.push('表里有但词书里没有: ' + k); });
if (errs.length) { fs.writeFileSync('_fixa2def.txt', '中止（未写盘）：\n' + errs.join('\n') + '\n', 'utf8'); process.exit(1); }

const before = (seg.match(reE) || []).length;
let changed = 0, deleted = 0;

for (const k of DEL) {
  const e = esc(k);
  const re1 = new RegExp("\\{\\s*es:\\s*'" + e + "'[^}]*\\}[ \\t]*,[ \\t]*\\r?\\n?", 'g');
  const re2 = new RegExp(",[ \\t]*\\r?\\n?[ \\t]*\\{\\s*es:\\s*'" + e + "'[^}]*\\}", 'g');
  if (re1.test(seg)) { seg = seg.replace(re1, ''); deleted++; }
  else if (re2.test(seg)) { seg = seg.replace(re2, ''); deleted++; }
  else errs.push('删除失败: ' + k);
}

seg = seg.replace(reE, (full, es, body) => {
  const f = FIX[es];
  if (!f) return full;
  let nb = body;
  if (f.zh != null) {
    if (/\bzh:\s*'/.test(nb)) nb = nb.replace(/\bzh:\s*'(?:[^'\\]|\\.)*'/, "zh: '" + f.zh + "'");
    else nb = nb.replace(/\s+$/, '') + ", zh: '" + f.zh + "'";
  }
  if (f.pos != null) {
    if (/\bpos:\s*'/.test(nb)) nb = nb.replace(/\bpos:\s*'(?:[^'\\]|\\.)*'/, "pos: '" + f.pos + "'");
    else nb = nb.replace(/\s+$/, '') + ", pos: '" + f.pos + "'";
  }
  changed++;
  return "{ es: '" + es + "'" + nb + " }";
});

const out = src.slice(0, start) + seg + src.slice(end);
fs.writeFileSync(FILE, out, 'utf8');

const after = (seg.match(reE) || []).length;
const reread = await import('./js/data/books.js?v=' + Date.now());
const a2 = reread.WORD_BOOKS.find(b => b.level === 'A2');
fs.writeFileSync('_fixa2def.txt', [
  'A2 释义/词性修正',
  '改写 ' + changed + ' / 删除 ' + deleted,
  'A2 词条数 ' + before + ' → ' + after + '（实际导入 ' + (a2 ? a2.words.length : '?') + '）',
  '空洞数（必须 0）' + (a2 ? a2.words.filter(w => !w || !w.es).length : '?'),
  errs.length ? '问题：\n' + errs.join('\n') : '无错误',
].join('\n'), 'utf8');
