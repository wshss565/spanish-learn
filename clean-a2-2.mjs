// 通用词书清理 · 第 1 遍（仅报告，不落盘；加 --delete 才写盘）
// 用法：node clean-a2-2.mjs [等级] [--delete]      等级默认 A2（A1/A2/B1/B2/C1/C2）
//
// 用 js/core/conj.js 的现在时 + 自写的其他时态生成器，把 A1+A2+本等级所有动词的常用变位形式都算出来，
// 找出本等级里「是变位形式但不是不定式本身」的词条（即重复收录的变位），以及动词+代词组合、专名等非词条。
// 同形名词/形容词（visita=拜访 / compra=购买 / cuesta=坡 …）用 HOMO 白名单保留。
import fs from 'fs';
import { conjugate } from './js/core/conj.js';

const LEVEL = (process.argv.slice(2).find(a => !a.startsWith('--')) || 'A2').toUpperCase();
const FILE = 'js/data/books.js';
const src = fs.readFileSync(FILE, 'utf8');
const marks = [];
const re = /level:\s*'([A-Z][0-9])'/g;
let m;
while ((m = re.exec(src))) marks.push({ lv: m[1], at: m.index });
const segOf = lv => {
  const i = marks.findIndex(x => x.lv === lv);
  if (i < 0) return '';
  return src.slice(marks[i].at, marks[i + 1] ? marks[i + 1].at : src.length);
};

function parse(t) {
  const out = [];
  const reE = /\{\s*es:\s*'((?:[^'\\]|\\.)*)'([^}]*)\}/g;
  let mm;
  while ((mm = reE.exec(t))) {
    const b = mm[2];
    out.push({
      es: mm[1],
      pos: (b.match(/\bpos:\s*'([^']*)'/) || [])[1] || '',
      zh: (b.match(/\bzh:\s*'((?:[^'\\]|\\.)*)'/) || [])[1] || '',
    });
  }
  return out;
}
const a1 = parse(segOf('A1'));
const a2 = parse(segOf(LEVEL));       // 目标等级（旧字段名沿用）

// —— 动词不定式（A1 + A2 + 本等级 合并）——
// 注意：早期版本用 length>3 过滤，把 ir / ser / ver / dar / oír 这类两三个字母的不定式排除了，
// 导致 irá / serás / vea / dé / oí 等变位漏网。这里放宽到 length>=2。
const BOOK_INFS = [...parse(segOf('A1')), ...parse(segOf('A2')), ...parse(segOf(LEVEL))]
  .filter(e => e.pos === 'v' && /(ar|er|ir)$/.test(e.es) && e.es.length >= 2).map(e => e.es);
// 书名里没收录、但变位形式出现在 A2 垃圾里的常见动词（人工按工作单挑）
const COMMON_VERBS = ['suceder', 'ocurrir', 'existir', 'soler', 'conseguir', 'caer', 'matar', 'desaparecer', 'pertenecer',
  'oler', 'mentir', 'acordar', 'interesar', 'referir', 'alegrar', 'encantar', 'desear', 'pelear', 'echar', 'lograr',
  'evitar', 'notar', 'colocar', 'mejorar', 'tratar', 'guardar', 'cuidar', 'enviar', 'buscar', 'seguir', 'morir', 'sentir',
  'vestir', 'pedir', 'servir', 'dormir', 'repetir', 'elegir', 'corregir', 'reír', 'sonreír', 'freír', 'traer', 'conducir',
  'traducir', 'producir', 'parecer', 'conocer', 'agradecer', 'ofrecer', 'nacer', 'crecer', 'merecer', 'aparecer',
  'volver', 'devolver', 'resolver', 'contar', 'recordar', 'encontrar', 'costar', 'probar', 'aprobar', 'soñar', 'sonar',
  'jugar', 'pensar', 'empezar', 'comenzar', 'perder', 'entender', 'preferir', 'divertir', 'leer', 'creer', 'construir',
  'mover', 'poder', 'querer', 'saber', 'estar', 'andar', 'caber', 'valer', 'tener', 'hacer', 'haber', 'decir', 'venir',
  'poner', 'ser', 'ir', 'ver', 'dar', 'oír'];
const infs = [...new Set([...BOOK_INFS, ...COMMON_VERBS])];
const infSet = new Set(infs);

// ============ 其他时态生成器（规则 + 常见不规则） ============
const END = { ar: ['o', 'as', 'a', 'amos', 'áis', 'an'], er: ['o', 'es', 'e', 'emos', 'éis', 'en'], ir: ['o', 'es', 'e', 'imos', 'ís', 'en'] };
const stem = v => v.slice(0, -2), end = v => v.slice(-2);
const IRREG_PRESENT = {
  ser: ['soy', 'eres', 'es', 'somos', 'sois', 'son'], estar: ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'],
  tener: ['tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen'], ir: ['voy', 'vas', 'va', 'vamos', 'vais', 'van'],
  dar: ['doy', 'das', 'da', 'damos', 'dais', 'dan'], saber: ['sé', 'sabes', 'sabe', 'sabemos', 'sabéis', 'saben'],
  haber: ['he', 'has', 'ha', 'hemos', 'habéis', 'han'], ver: ['veo', 'ves', 've', 'vemos', 'veis', 'ven'],
  hacer: ['hago', 'haces', 'hace', 'hacemos', 'hacéis', 'hacen'], poder: ['puedo', 'puedes', 'puede', 'podemos', 'podéis', 'pueden'],
  querer: ['quiero', 'quieres', 'quiere', 'queremos', 'queréis', 'quieren'], venir: ['vengo', 'vienes', 'viene', 'venimos', 'venís', 'vienen'],
  poner: ['pongo', 'pones', 'pone', 'ponemos', 'ponéis', 'ponen'], salir: ['salgo', 'sales', 'sale', 'salimos', 'salís', 'salen'],
  traer: ['traigo', 'traes', 'trae', 'traemos', 'traéis', 'traen'], decir: ['digo', 'dices', 'dice', 'decimos', 'decís', 'dicen'],
  oír: ['oigo', 'oyes', 'oye', 'oímos', 'oís', 'oyen'], caer: ['caigo', 'caes', 'cae', 'caemos', 'caéis', 'caen'],
};
const STEM_PRESENT = {
  entender: 'entiend', perder: 'pierd', sentir: 'sient', preferir: 'prefier', cerrar: 'cierr', empezar: 'empiez',
  comenzar: 'comienz', pensar: 'piens', nevar: 'niev', mentir: 'mient', divertir: 'diviert', dormir: 'duerm',
  volver: 'vuelv', morir: 'muer', contar: 'cuent', jugar: 'jueg', soler: 'suel', encontrar: 'encuentr',
  recordar: 'recuerd', mostrar: 'muestr', costar: 'cuest', almorzar: 'almuerz', pedir: 'pid', servir: 'sirv',
  repetir: 'repit', seguir: 'sig', vestir: 'vist', medir: 'mid', reír: 'rí', sonreír: 'sonrí', freír: 'frí', teñir: 'tiñ',
};
const IRREG_IMPERFECT = { ser: ['era', 'eras', 'era', 'éramos', 'erais', 'eran'], ir: ['iba', 'ibas', 'iba', 'íbamos', 'ibais', 'iban'], ver: ['veía', 'veías', 'veía', 'veíamos', 'veíais', 'veían'], haber: ['había', 'habías', 'había', 'habíamos', 'habíais', 'habían'] };
const PRET_SPECIAL = { ser: ['fui', 'fuiste', 'fue', 'fuimos', 'fueron'], ir: ['fui', 'fuiste', 'fue', 'fuimos', 'fueron'], dar: ['di', 'diste', 'dio', 'dimos', 'dieron'], ver: ['vi', 'viste', 'vio', 'vimos', 'vieron'], haber: ['hubo', 'hubiste', 'hubo', 'hubimos', 'hubieron'] };
const PRET_STEM = { estar: 'estuv', tener: 'tuv', poder: 'pud', querer: 'quis', venir: 'vin', poner: 'pus', saber: 'sup', salir: 'sal', traer: 'traj', decir: 'dij', hacer: 'hic', oír: 'oí', leer: 'ley', creer: 'crey', andar: 'anduv', caber: 'cup', haber: 'hub' };
const FUT_IRREG = { poder: 'podr', querer: 'querr', saber: 'sabr', salir: 'saldr', venir: 'vendr', tener: 'tendr', poner: 'pondr', hacer: 'har', decir: 'dir', haber: 'habr', ir: 'ir' };
const PART_IRREG = { abrir: 'abierto', cubrir: 'cubierto', escribir: 'escrito', morir: 'muerto', romper: 'roto', ver: 'visto', volver: 'vuelto', poner: 'puesto', hacer: 'hecho', decir: 'dicho', resolver: 'resuelto', freír: 'frito', imprimir: 'impreso', descubrir: 'descubierto' };
const GER_IRREG = { ir: 'yendo', poder: 'pudiendo', querer: 'quiriendo', poner: 'poniendo', salir: 'saliendo', traer: 'trayendo', venir: 'viniendo', decir: 'diciendo', hacer: 'haciendo', oír: 'oyendo', dormir: 'durmiendo', morir: 'muriendo', pedir: 'pidiendo', servir: 'siriendo', seguir: 'siguiendo', vestir: 'vistiendo', reír: 'riendo', sonreír: 'sonriendo', leer: 'leyendo', creer: 'creyendo', caer: 'cayendo' };
const IRREG_SUBJ = {
  ser: ['sea', 'seas', 'sea', 'seamos', 'seáis', 'sean'], ir: ['vaya', 'vayas', 'vaya', 'vayamos', 'vayáis', 'vayan'],
  estar: ['esté', 'estés', 'esté', 'estemos', 'estéis', 'estén'], haber: ['haya', 'hayas', 'haya', 'hayamos', 'hayáis', 'hayan'],
  dar: ['dé', 'des', 'dé', 'demos', 'deis', 'dén'], saber: ['sepa', 'sepas', 'sepa', 'sepamos', 'sepáis', 'sepan'],
  poder: ['pueda', 'puedas', 'pueda', 'podamos', 'podáis', 'puedan'], querer: ['quiera', 'quieras', 'quiera', 'queramos', 'queráis', 'quieran'],
  venir: ['venga', 'vengas', 'venga', 'vengamos', 'vengáis', 'vengan'], poner: ['ponga', 'pongas', 'ponga', 'pongamos', 'pongáis', 'pongan'],
  salir: ['salga', 'salgas', 'salga', 'salgamos', 'salgáis', 'salgan'], traer: ['traiga', 'traigas', 'traiga', 'traigamos', 'traigáis', 'traigan'],
  decir: ['diga', 'digas', 'diga', 'digamos', 'digáis', 'digan'], hacer: ['haga', 'hagas', 'haga', 'hagamos', 'hagáis', 'hagan'], oír: ['oiga', 'oigas', 'oiga', 'oigamos', 'oigáis', 'oigan'],
};
function present(inf) {
  if (IRREG_PRESENT[inf]) return IRREG_PRESENT[inf].slice();
  const e = end(inf), s = stem(inf), ch = STEM_PRESENT[inf], a = ch || s, b = s;
  if (e === 'ar') return [a + 'o', a + 'as', a + 'a', b + 'amos', b + 'áis', a + 'an'];
  if (e === 'er') return [a + 'o', a + 'es', a + 'e', b + 'emos', b + 'éis', a + 'en'];
  return [a + 'o', a + 'es', a + 'e', b + 'imos', b + 'ís', a + 'en'];
}
function imperfect(inf) { if (IRREG_IMPERFECT[inf]) return IRREG_IMPERFECT[inf].slice(); const e = end(inf), s = stem(inf); if (e === 'ar') return [s + 'aba', s + 'abas', s + 'aba', s + 'ábamos', s + 'abais', s + 'aban']; return [s + 'ía', s + 'ías', s + 'ía', s + 'íamos', s + 'íais', s + 'ían']; }
function preterite(inf) {
  if (PRET_SPECIAL[inf]) return PRET_SPECIAL[inf].slice();
  if (PRET_STEM[inf]) { const st = PRET_STEM[inf]; const third = st === 'hic' ? 'hizo' : st + 'o'; return [st + 'e', st + 'iste', third, st + 'imos', st + 'ieron']; }
  const e = end(inf), s = stem(inf);
  if (e === 'ar') return [s + 'é', s + 'aste', s + 'ó', s + 'amos', s + 'asteis', s + 'aron'];
  return [s + 'í', s + 'iste', s + 'ió', s + 'imos', s + 'isteis', s + 'ieron'];
}
function future(inf) { if (FUT_IRREG[inf]) { const st = FUT_IRREG[inf]; return [st + 'é', st + 'ás', st + 'á', st + 'emos', st + 'éis', st + 'án']; } const e = end(inf), s = stem(inf); if (e === 'ar') return [s + 'aré', s + 'arás', s + 'ará', s + 'aremos', s + 'aréis', s + 'arán']; return [s + 'eré', s + 'erás', s + 'erá', s + 'eremos', s + 'eréis', s + 'erán']; }
function cond(inf) { if (FUT_IRREG[inf]) { const st = FUT_IRREG[inf]; return [st + 'ía', st + 'ías', st + 'ía', st + 'íamos', st + 'íais', st + 'ían']; } const e = end(inf), s = stem(inf); if (e === 'ar') return [s + 'aría', s + 'arías', s + 'aría', s + 'aríamos', s + 'aríais', s + 'arían']; return [s + 'ería', s + 'erías', s + 'ería', s + 'eríamos', s + 'eríais', s + 'erían']; }
function part(inf) { if (PART_IRREG[inf]) return [PART_IRREG[inf]]; const e = end(inf), s = stem(inf); return [e === 'ar' ? s + 'ado' : s + 'ido']; }
function ger(inf) { if (GER_IRREG[inf]) return [GER_IRREG[inf]]; const e = end(inf), s = stem(inf); return [e === 'ar' ? s + 'ando' : s + 'iendo']; }
function subj(inf) {
  if (IRREG_SUBJ[inf]) return IRREG_SUBJ[inf].slice();
  const e = end(inf), s = stem(inf), ch = STEM_PRESENT[inf], a = ch || s, b = s;
  if (e === 'ar') return [a + 'e', a + 'es', a + 'e', b + 'emos', b + 'éis', a + 'en'];
  return [a + 'a', a + 'as', a + 'a', b + 'amos', b + 'áis', a + 'an'];
}
// 过去未完成虚拟式（-ra / -se），规则 + 不规则词干，用来兜住 fuese / hubiera / éramos 这类
function imperfSubjBase(inf) {
  if (PRET_STEM[inf]) return PRET_STEM[inf];
  if (inf === 'ser' || inf === 'ir') return 'fu';
  if (inf === 'dar') return 'di';
  if (inf === 'ver') return 'vi';
  if (inf === 'haber') return 'hub';
  if (inf === 'hacer') return 'hic';
  if (inf === 'oír') return 'oy';
  if (inf === 'leer') return 'ley';
  if (inf === 'creer') return 'crey';
  return null; // 规则
}
function imperfSubj(inf) {
  const e = end(inf), s = stem(inf), b = imperfSubjBase(inf);
  const ra = b ? ['iera', 'ieras', 'iera', 'iéramos', 'ierais', 'ieran'] : (e === 'ar' ? ['ara', 'aras', 'ara', 'áramos', 'arais', 'aran'] : ['iera', 'ieras', 'iera', 'iéramos', 'ierais', 'ieran']);
  const se = b ? ['iese', 'ieses', 'iese', 'iésemos', 'ieseis', 'iesen'] : (e === 'ar' ? ['ase', 'ases', 'ase', 'ásemos', 'aseis', 'asen'] : ['iese', 'ieses', 'iese', 'iésemos', 'ieseis', 'iesen']);
  return [...ra.map(x => (b || s) + x), ...se.map(x => (b || s) + x)];
}
function allForms(inf) {
  const set = new Set();
  [present(inf), subj(inf), imperfect(inf), preterite(inf), future(inf), cond(inf), part(inf), ger(inf), imperfSubj(inf)].forEach(arr => arr.forEach(f => f && set.add(f)));
  // 现在时也借 conj.js（覆盖其更完整的 Stem-change / -cer / -uir 处理）
  const c = conjugate(inf);
  (c.forms || []).forEach(f => { if (f && !/\s/.test(f)) set.add(f); });
  return set;
}

const formToInf = new Map();
infs.forEach(inf => {
  allForms(inf).forEach(f => { if (f && !formToInf.has(f)) formToInf.set(f, inf); });
});

const HOMO = new Set([
  // ① data-lint 原有白名单（同形异义的名词/形容词/分词，必须保留）
  'trabajo', 'camino', 'nada', 'paso', 'vino', 'dado', 'toma', 'cuanto', 'como', 'sé', 've', 'sea',
  'estado', 'vivo', 'hecho', 'dicho', 'visto', 'ido', 'serio', 'seguro', 'medio', 'sentido', 'justo', 'gran', 'primera', 'cargo', 'puesto', 'orden', 'mando',
  // ② clean-a2-1 已确认保留的同形名词/形容词
  'visita', 'compra', 'cambio', 'pasado', 'pedido', 'pago', 'robo', 'cura', 'pelea', 'regreso', 'descanso', 'abierto', 'dormido', 'cerrado', 'sabido', 'roto',
  // ③ 其他本身是常用词、与变位同形的（人工逐条核对候选清单后加入）
  'sal', 'paga', 'peso',
  'almuerzo', 'baile', 'cena', 'cocina', 'comienzo', 'cuenta', 'cuentas', 'cuento', 'desayuno', 'disculpas',
  'factura', 'ganado', 'ganas', 'invitado', 'limpio', 'nieve', 'odio', 'partido', 'pesado', 'presente',
  'prima', 'primo', 'recibo', 'sentado', 'tomo', 'uso', 'viaje',
  // ④ 本轮把检测扩到 ir/ser/ver/dar 等短不定式后再核对出的同形词
  'cuesta', 'divertido', 'encantado', 'frío', 'nota', 'primeros',
  // ⑤ B1 核对候选清单后补的同形名词/形容词
  'alegre', 'amado', 'coma', 'compras', 'encanto', 'firme', 'fría', 'guarda', 'interesado', 'intereses',
  'metas', 'millas', 'miras', 'muestras', 'pasas', 'reserva', 'saco', 'salto', 'tira', 'viajes', 'visitas', 'tratado',
  'cierre', 'entrega', 'corte', 'orden', 'cargo', 'mando', 'puesto', 'deseo', 'duda', 'nota', 'obra', 'marca',
  'copia', 'prueba', 'gasto', 'grito', 'llanto', 'pelea', 'compra', 'venta', 'caza', 'pesca', 'baile', 'despierto',
  // ⑩ B2 / C1 同形名词（人工核对候选清单后加入）
  'aborto', 'activa', 'activo', 'alimento', 'alivio', 'altas', 'amplia', 'amplio', 'apuntes', 'arreglo', 'ajuste',
  'ajustes', 'agarre', 'auxilio', 'brillo', 'cobre', 'cojo', 'cultivo', 'dibujo', 'encaje', 'envío', 'escala',
  'experimento', 'fabrica', 'facturas', 'falla', 'fallo', 'fija', 'funciones', 'giro', 'guardas', 'ingreso', 'inicio',
  'intercambio', 'invento', 'liga', 'lanzas', 'logro', 'manejo', 'marchas', 'mates', 'mezcla', 'mudo', 'nieves', 'ola',
  'olas', 'ordenes', 'orina', 'paro', 'parto', 'pases', 'pesas', 'pilas', 'plantas', 'polo', 'protesta', 'pulgas',
  'rango', 'rechazo', 'reemplazo', 'relleno', 'reparto', 'reporte', 'reportes', 'reservas', 'retiro', 'rezo', 'saludo',
  'secuestro', 'sospecha', 'venda', 'vendas', 'viola', 'vista', 'vistas', 'cobra', 'canto', 'causas', 'consulta',
  'conquista', 'conserva', 'costado', 'denuncia', 'descarga', 'desperdicio', 'dobles', 'enteras', 'estaciones', 'honra',
  'impresiones', 'lanza', 'pila', 'pipa', 'acorde', 'acordes', 'ahorro', 'aparente', 'buceo', 'centeno', 'claves',
  'cobras', 'desmayo', 'frena', 'gozo', 'impreso', 'incremento', 'lame', 'mercadería', 'mienta', 'mezclas', 'porte',
  'pose', 'prenda', 'prendas', 'reclutas', 'recorte', 'remo', 'soles', 'suela', 'soplo', 'sumas', 'susurro', 'tapas',
  'tejas', 'torturas', 'vacio', 'andes', 'suelo', 'cura', 'toma',
  'corte', 'corta', 'sello', 'resto', 'resta', 'sobra', 'mando', 'cargo', 'carga', 'caza', 'tasa',
  'sino', 'orden', 'serie', 'fondo', 'frente', 'lado', 'lados', 'juego', 'juega',
]);

// 动词 + 代词组合（decirles / darme / verme / irnos …）不是独立词条
const CLITICS = ['me', 'te', 'se', 'nos', 'os', 'lo', 'la', 'le', 'los', 'las', 'les'];
function cliticBase(es) {
  if (es.endsWith('rse')) return null;   // 自复动词不定式（acordarse / lavarse / irse…）本身就是合法词条，不能当“动词+代词”删
  for (const c of CLITICS) {
    if (es.length > c.length + 1 && es.endsWith(c)) {
      const b = es.slice(0, -c.length);
      if (infSet.has(b)) return b;
    }
  }
  return null;
}
// 人工确认的非词条（专名 / 拼错 / 命令式+代词 / 残缺分词）
const NONWORD = new Set(['henry', 'jake', 'matt', 'mary', 'maría', 'richard', 'victoria', 'washington', 'adam', 'scott',
  'walter', 'eric', 'anna', 'daniel', 'alex', 'jesús', 'mami', 'londres', 'francia', 'parís', 'roma', 'europa',
  'américa', 'inglaterra', 'china', 'max', 'bill', 'unidos',
  'fué', 'ahi', 'tambien', 'tenia', 'mio', 'tí',
  'mírame', 'déjalo', 'olvídalo', 'llámame', 'dígame', 'déjeme', 'escúchame', 'cálmate', 'levántate', 'relájate',
  'siéntese', 'ponte', 'créeme', 'ayúdame',
  'joder', 'jodido', 'coño', 'perra', 'bastardo', 'imbécil', 'estúpida', 'tonta', 'idiotas', 'gay', 'sexy', 'tonterías',
  'hubieras', 'hubiese', 'hubiera',
  // 生成器漏掉的变位（短/不规则表未覆盖：ver 虚拟、llegar、caer、oír、doler、mentir、oler、ser 的 -se 虚拟、tener 虚拟…）
  'veamos', 'vea', 'llegue', 'cayó', 'oí', 'oyó', 'duele', 'mintiendo', 'huele', 'fuese', 'fueras', 'tengamos',
  'consiguió', 'acuerdas', 'refiero', 'refieres', 'resulta', 'bromeando', 'imagino', 'comprendo', 'metido', 'acabado',
  // ⑥ B1：生成器未覆盖的动词（suponer / mantener / convertir / sorprender / asegurar / rogar…）+ 命令式+代词
  'suponía', 'acabamos', 'muevas', 'muévete', 'disparó', 'ruego', 'aseguro', 'decírselo', 'decírtelo', 'den', 'convirtió',
  'vean', 'convierte', 'sorprende', 'mantiene', 'fueran', 'aléjate', 'dijera', 'oíste', 'refiere', 'preferiría',
  'asegurarme', 'asegúrate', 'prometí', 'veas', 'luchando', 'volando', 'dispara', 'escapó', 'parezca', 'arrestado',
  'sabia', 'muévanse', 'dímelo', 'dilo', 'diles', 'dígale', 'discúlpeme', 'suéltame', 'lárgate', 'quítate', 'mírate',
  'déjenme', 'déjala', 'deme', 'cuéntame', 'cuídate', 'háblame', 'apúrate', 'váyanse', 'váyase', 'adoro', 'sugiero',
  'mueva', 'faltan', 'resultó', 'dispararon', 'cometido', 'morirá', 'requiere', 'apetece', 'incluyendo', 'encerrado',
  'sorprendido', 'actuando', 'disparado', 'asusta', 'atreves', 'opinas', 'podria', 'calla', 'luce',
  // ⑦ B1：人名（非词汇）
  'alan', 'clark', 'carter', 'simon', 'roger', 'alice', 'lucy', 'smith', 'jenny', 'taylor', 'chuck', 'morgan', 'arthur',
  'jones', 'fred', 'sara', 'francisco', 'howard', 'donna', 'abby', 'antonio', 'lucas', 'rick', 'terry', 'juan', 'johnson',
  'sally', 'rose', 'madame', 'cristo', 'ross', 'bruce', 'gordon', 'hitler', 'eva', 'charlotte', 'wilson', 'lewis',
  'vincent', 'justin', 'jordan', 'davis', 'holmes', 'albert', 'harvey', 'blake', 'catherine', 'margaret', 'grant', 'nate',
  'miller', 'jessica',
  // ⑧ B1：地名 / 英文词
  'chicago', 'vegas', 'texas', 'hollywood', 'boston', 'city', 'king', 'lord', 'miss', 'lady', 'monsieur', 'my', 'on',
  'big', 'jean', 'sir',
  // ⑨ B1：拼写错误 / 语气词 / 粗俗词
  'adios', 'despues', 'ésto', 'dias', 'tio', 'mia', 'hmm', 'huh', 'whoa', 'ooh', 'jo', 'okay',
  'cabrón', 'tetas', 'pene', 'zorra', 'cojones', 'gilipollas', 'dick']);

const cand = [];
for (const e of a2) {
  if (HOMO.has(e.es)) continue;                    // 同形名词/形容词，保留
  let kind = '';
  // 先判「非词条」：专名/脏词常被错标成 pos='v' 且以 er/ir 结尾，会骗过下面的「是不是不定式」判定
  if (NONWORD.has(e.es)) kind = '非词条';
  else if (infSet.has(e.es)) continue;             // 本身是动词不定式（不删）
  else {
    const inf = formToInf.get(e.es);
    if (inf && inf !== e.es) kind = '→' + inf;
    else { const b = cliticBase(e.es); if (b) kind = '动词+代词(' + b + ')'; }
  }
  if (!kind) continue;
  cand.push({ es: e.es, pos: e.pos, zh: e.zh, inf: kind });
}
cand.sort((a, b) => a.inf.localeCompare(b.inf) || a.es.localeCompare(b.es));
const txt = [
  'A2 疑似变位重复候选（report-only，未落盘）：共 ' + cand.length + ' 条',
  '白名单 HOMO 已排除的同形名词/形容词：' + [...HOMO].join(', '),
  '',
  ...cand.map(c => `${c.es} | ${c.pos} | ${c.zh} | →${c.inf}`),
].join('\n');
fs.writeFileSync('_' + LEVEL + '_conj_candidates.txt', txt, 'utf8');

// ============ 第二遍：真删（加 --delete 才落盘） ============
const DO = process.argv.includes('--delete');
if (!DO) {
  fs.writeFileSync('_clean-' + LEVEL + '.txt', 'REPORT ONLY：候选 ' + cand.length + ' 条，未落盘\n' +
    cand.map(c => c.es + ' →' + c.inf).join('\n') + '\n', 'utf8');
} else {
  const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, c => '\\' + c);
  const errs = [];
  const deleted = [];
  const a2seg = (() => { const i = marks.findIndex(x => x.lv === LEVEL); return src.slice(marks[i].at, marks[i + 1] ? marks[i + 1].at : src.length); })();
  // 预检：字符串内含花括号（如 zh: '{0}...'）会让 [^}]* 正则提前收尾 → 先修数据再删
  const haz = (a2seg.match(/(?:zh|ex|exZh): '[^']*[{}]/g) || []);
  if (haz.length) errs.push('目标段存在含花括号的脏条目，已拒绝删除：' + haz.slice(0, 5).join(' ｜ '));
  const beforeCount = (a2seg.match(/\{\s*es:\s*'/g) || []).length;

  let seg = a2seg;
  for (const c of cand) {
    const e = esc(c.es);
    const re1 = new RegExp("\\{\\s*es:\\s*'" + e + "'[^}]*\\}[ \\t]*,[ \\t]*\\r?\\n?", 'g'); // 带尾逗号
    const re2 = new RegExp(",[ \\t]*\\r?\\n?[ \\t]*\\{\\s*es:\\s*'" + e + "'[^}]*\\}", 'g'); // 前置逗号
    const n1 = (seg.match(re1) || []).length;
    if (n1) { seg = seg.replace(re1, ''); deleted.push(c.es + '→' + c.inf); continue; }
    const n2 = (seg.match(re2) || []).length;
    if (n2) { seg = seg.replace(re2, ''); deleted.push(c.es + '→' + c.inf); }
    else errs.push('未匹配到词条: ' + c.es);
  }
  const out = src.slice(0, marks.find(x => x.lv === LEVEL).at) + seg + src.slice((() => { const i = marks.findIndex(x => x.lv === LEVEL); return marks[i + 1] ? marks[i + 1].at : src.length; })());

  // 全文件词条数守恒：减少量必须恰好等于删除量，否则绝不写盘（防止错位插入 / 正则漏吃）
  const countAll = t => (t.match(/\{\s*es:\s*'/g) || []).length;
  const beforeAll = countAll(src), afterAll = countAll(out);
  const guardOk = (beforeAll - afterAll === deleted.length);
  if (!guardOk) errs.push('全文件守恒校验失败：' + beforeAll + ' → ' + afterAll + '，但删除 ' + deleted.length + '（未写盘）');

  let importOk = true, importErr = '';
  if (guardOk && !haz.length) {
    fs.writeFileSync(FILE, out, 'utf8');
    // 写盘后立即校验能否 import，失败立刻回滚（防止正则漏吃导致文件损坏，例如残留 "...}发生了宫缩！', pos: 'v' },"）
    try { await import('./js/data/books.js?v=' + Date.now()); }
    catch (e) { importOk = false; importErr = String(e && (e.message || e)); fs.writeFileSync(FILE, src, 'utf8'); }
  } else {
    importOk = false; importErr = '（预检或守恒校验未通过，未写盘）';
  }

  const reE = /\{\s*es:\s*'((?:[^'\\]|\\.)*)'([^}]*)\}/g;
  const after = [];
  let mm; while ((mm = reE.exec(seg))) after.push(mm[1]);
  const afterCount = after.length;
  const holes = after.filter(x => !x || x === undefined).length;
  const stillThere = cand.map(c => c.es).filter(x => after.includes(x));
  const infsStill = [...infSet].filter(x => after.includes(x));

  const log = [
    LEVEL + ' 二次清理（变位重复/非词条删除）',
    '候选 ' + cand.length + ' / 成功删除 ' + deleted.length + ' / 失败 ' + errs.length,
    LEVEL + ' 词条数 ' + beforeCount + ' → ' + afterCount + '（应减少 ' + deleted.length + '）',
    '空洞数（必须 0）' + holes,
    '仍残留的候选（应为 0）：' + stillThere.length + (stillThere.length ? ' → ' + stillThere.join(', ') : ''),
    '保留的同形名词/形容词 ' + HOMO.size + ' 个',
    importOk ? '写盘后 import 校验：通过' : '写盘后 import 校验：失败，已回滚！' + importErr,
    errs.length ? '问题：\n' + errs.join('\n') : '无错误',
  ].join('\n');
  fs.writeFileSync('_clean-' + LEVEL + '.txt', log, 'utf8');
}
