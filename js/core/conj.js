// 西语语法内核：现在时变位（规则 + 不规则表）、名词冠词、形容词性数、复数
// 目标：让「动词变位」和「名词冠词性别」这两个中文母语者最易错的点，在卡片上直接可见

export const PRONOUNS = ['yo', 'tú', 'él / ella / usted', 'nosotros', 'vosotros', 'ellos / ellas'];
export const PRON_SHORT = ['yo', 'tú', 'él', 'nosotros', 'vosotros', 'ellos'];
export const REFLEXIVE = ['me', 'te', 'se', 'nos', 'os', 'se'];

const END = {
  ar: ['o', 'as', 'a', 'amos', 'áis', 'an'],
  er: ['o', 'es', 'e', 'emos', 'éis', 'en'],
  ir: ['o', 'es', 'e', 'imos', 'ís', 'en'],
};

// 完全不规则（现在时陈述式 6 人称）
const IRREGULAR = {
  ser: ['soy', 'eres', 'es', 'somos', 'sois', 'son'],
  estar: ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'],
  haber: ['he', 'has', 'ha', 'hemos', 'habéis', 'han'],
  ir: ['voy', 'vas', 'va', 'vamos', 'vais', 'van'],
  irse: ['me voy', 'te vas', 'se va', 'nos vamos', 'os vais', 'se van'],
  dar: ['doy', 'das', 'da', 'damos', 'dais', 'dan'],
  ver: ['veo', 'ves', 've', 'vemos', 'veis', 'ven'],
  saber: ['sé', 'sabes', 'sabe', 'sabemos', 'sabéis', 'saben'],
  tener: ['tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen'],
  venir: ['vengo', 'vienes', 'viene', 'venimos', 'venís', 'vienen'],
  decir: ['digo', 'dices', 'dice', 'decimos', 'decís', 'dicen'],
  hacer: ['hago', 'haces', 'hace', 'hacemos', 'hacéis', 'hacen'],
  poder: ['puedo', 'puedes', 'puede', 'podemos', 'podéis', 'pueden'],
  querer: ['quiero', 'quieres', 'quiere', 'queremos', 'queréis', 'quieren'],
  oír: ['oigo', 'oyes', 'oye', 'oímos', 'oís', 'oyen'],
  traer: ['traigo', 'traes', 'trae', 'traemos', 'traéis', 'traen'],
  caer: ['caigo', 'caes', 'cae', 'caemos', 'caéis', 'caen'],
  poner: ['pongo', 'pones', 'pone', 'ponemos', 'ponéis', 'ponen'],
  salir: ['salgo', 'sales', 'sale', 'salimos', 'salís', 'salen'],
  valer: ['valgo', 'vales', 'vale', 'valemos', 'valéis', 'valen'],
  reír: ['río', 'ríes', 'ríe', 'reímos', 'reís', 'ríen'],
  sonreír: ['sonrío', 'sonríes', 'sonríe', 'sonreímos', 'sonreís', 'sonríen'],
  leer: ['leo', 'lees', 'lee', 'leemos', 'leéis', 'leen'],
  creer: ['creo', 'crees', 'cree', 'creemos', 'creéis', 'creen'],
  // 无人称 / 特殊搭配
  llover: [null, null, 'llueve', null, null, null],
  nevar: [null, null, 'nieva', null, null, null],
};

// -cer / -cir 中第一人称要加 -zco 的一批（其余走 c→z，如 vencer→venzo）
const ZCO = new Set(['conocer', 'desconocer', 'reconocer', 'agradecer', 'aparecer', 'desaparecer',
  'parecer', 'crecer', 'nacer', 'merecer', 'obedecer', 'ofrecer', 'padecer', 'permanecer',
  'pertenecer', 'establecer', 'conducir', 'traducir', 'producir', 'reducir', 'introducir',
  'deducir', 'seducir', 'inducir', 'reproducir']);

// -iar / -uar 中重音落在 i/u 上的一批（enviar→envío，continuar→continúo）
const ACCENT_IAR = new Set(['enviar', 'criar', 'guiar', 'liar', 'fiar', 'vaciar', 'ampliar',
  'desafiar', 'resfriar', 'desviar', 'confiar', 'espiar', 'porfiar', 'enviarse']);
const ACCENT_UAR = new Set(['continuar', 'actuar', 'graduar', 'situar', 'acentuar',
  'efectuar', 'insinuar', 'evaluar', 'habituar', 'menstruar']);

// 词干变化：原形 → [原元音, 变化元音]（靴型：一二人称复数不变）
const STEM_CHANGE = {
  pensar: ['e', 'ie'], empezar: ['e', 'ie'], comenzar: ['e', 'ie'], cerrar: ['e', 'ie'],
  despertar: ['e', 'ie'], despertarse: ['e', 'ie'], entender: ['e', 'ie'], perder: ['e', 'ie'],
  querer: ['e', 'ie'], preferir: ['e', 'ie'], sentir: ['e', 'ie'], sentar: ['e', 'ie'],
  sentarse: ['e', 'ie'], sentirse: ['e', 'ie'], mentir: ['e', 'ie'], divertir: ['e', 'ie'],
  sugerir: ['e', 'ie'], negar: ['e', 'ie'], confesar: ['e', 'ie'], atravesar: ['e', 'ie'],
  calentar: ['e', 'ie'], recomendar: ['e', 'ie'], pensarse: ['e', 'ie'],
  encender: ['e', 'ie'], defender: ['e', 'ie'], ascender: ['e', 'ie'],
  poder: ['o', 'ue'], dormir: ['o', 'ue'], dormirse: ['o', 'ue'], morir: ['o', 'ue'],
  volver: ['o', 'ue'], encontrar: ['o', 'ue'], recordar: ['o', 'ue'], contar: ['o', 'ue'],
  costar: ['o', 'ue'], almorzar: ['o', 'ue'], mostrar: ['o', 'ue'], probar: ['o', 'ue'],
  probarse: ['o', 'ue'], acostarse: ['o', 'ue'], acostar: ['o', 'ue'], soñar: ['o', 'ue'],
  resolver: ['o', 'ue'], devolver: ['o', 'ue'], mover: ['o', 'ue'], llover: ['o', 'ue'],
  nevar: ['e', 'ie'], sonar: ['o', 'ue'], aprobar: ['o', 'ue'], contarse: ['o', 'ue'],
  jugar: ['u', 'ue'],
  pedir: ['e', 'i'], servir: ['e', 'i'], repetir: ['e', 'i'], vestir: ['e', 'i'],
  vestirse: ['e', 'i'], seguir: ['e', 'i'], conseguir: ['e', 'i'], perseguir: ['e', 'i'],
  elegir: ['e', 'i'], corregir: ['e', 'i'], competir: ['e', 'i'], medir: ['e', 'i'],
  reír: ['e', 'í'], sonreír: ['e', 'í'],
};

const TENSE_LABEL = '现在时 · presente de indicativo';

// 「东西作主语、人作间接宾语」的一类动词（gustar / encantar / doler …）
const GUSTAR_LIKE = new Set(['gustar', 'encantar', 'fascinar', 'interesar', 'importar',
  'molestar', 'doler', 'faltar', 'sobrar', 'quedar_']);

function lastVowelReplace(stem, from, to) {
  const i = stem.lastIndexOf(from);
  if (i < 0) return stem;
  return stem.slice(0, i) + to + stem.slice(i + 1);
}

function accentEndings(kind, base) {
  // 给 -iar / -uar 重音动词换一套带重音的词尾
  if (kind === 'iar') return ['ío', 'ías', 'ía', 'iamos', 'iáis', 'ían'];
  if (kind === 'uar') return ['úo', 'úas', 'úa', 'uamos', 'uáis', 'úan'];
  return base;
}

/**
 * 现在时变位
 * @returns {{verb:string, reflexive:boolean, type:string, forms:(string|null)[], note:string}}
 */
export function conjugate(verb) {
  const raw = String(verb || '').trim().toLowerCase();
  if (!raw) return { verb: raw, reflexive: false, type: '', forms: [], note: '' };

  let reflexive = false, base = raw;
  if (/se$/.test(base) && base.length > 4) { reflexive = true; base = base.slice(0, -2); }

  if (IRREGULAR[raw]) {
    return { verb: raw, reflexive: false, type: 'irregular', forms: IRREGULAR[raw].slice(), note: TENSE_LABEL };
  }
  if (IRREGULAR[base]) {
    const f = IRREGULAR[base].slice();
    return {
      verb: raw, reflexive, type: 'irregular',
      forms: reflexive ? f.map((x, i) => x ? REFLEXIVE[i] + ' ' + x : null) : f,
      note: TENSE_LABEL,
    };
  }

  const type = base.endsWith('ar') ? 'ar' : base.endsWith('er') ? 'er' : base.endsWith('ir') ? 'ir' : '';
  if (!type) return { verb: raw, reflexive, type: '', forms: [], note: '' };

  const stem0 = base.slice(0, -2);
  const change = STEM_CHANGE[base] || STEM_CHANGE[raw];
  // -uir 动词（但 -guir 不算，那是 seguir 类）
  const isUir = /uir$/.test(base) && !/guir$/.test(base);
  const kindAcc = ACCENT_IAR.has(base) ? 'iar' : ACCENT_UAR.has(base) ? 'uar' : '';

  let endings = END[type].slice();
  if (isUir) endings = ['yo', 'yes', 'ye', 'imos', 'ís', 'yen'];
  else if (kindAcc) endings = accentEndings(kindAcc, endings);

  const forms = endings.map((end, i) => {
    if (IRREGULAR[base] && IRREGULAR[base][i] === null) return null;
    // 重音动词（enviar / continuar）词干先去掉末尾的 i / u，重音落在词尾上
    let stem = kindAcc ? stem0.slice(0, -1) : stem0;
    // 靴型：yo / tú / él / ellos 变音，nosotros / vosotros 不变
    if (change && (i === 0 || i === 1 || i === 2 || i === 5)) stem = lastVowelReplace(stem, change[0], change[1]);
    if (i === 0 && !kindAcc) stem = firstPersonStem(stem, base, isUir);
    return stem + end;
  });

  // 无人称动词（llover / nevar 等）只留第三人称
  if (base === 'llover' || base === 'nevar') {
    return { verb: raw, reflexive, type: 'irregular', forms: [null, null, forms[2], null, null, null], note: '无人称动词，只有第三人称' };
  }

  const out = reflexive ? forms.map((x, i) => x ? REFLEXIVE[i] + ' ' + x : null) : forms;
  const notes = [];
  if (change) notes.push(change[0] === change[1] ? '' : `词干变化 ${change[0]}→${change[1]}（nosotros / vosotros 不变）`);
  if (isUir) notes.push('-uir 动词，变位时插入 y');
  if (kindAcc) notes.push('重音落在词干上，要加重音符号');
  if (reflexive) notes.push('代词式动词，变位时要带 me / te / se …');
  let tip = '';
  if (GUSTAR_LIKE.has(base) && !reflexive) {
    tip = `${forms[2]} 是「他/她/它让人喜欢」，人要放在前面：me ${forms[2]} / te ${forms[2]} / le ${forms[2]}`;
  }
  return {
    verb: raw, reflexive, type, forms: out,
    note: notes.filter(Boolean).join(' · ') || TENSE_LABEL,
    tip,
  };
}

// 第一人称单数的拼写 / 增音变化
function firstPersonStem(stem, base, isUir) {
  if (base.endsWith('guir')) return stem.replace(/gu$/, 'g'); // seguir → sigo
  if (base.endsWith('ger') || base.endsWith('gir')) return stem.replace(/g$/, 'j'); // coger → cojo
  if (base.endsWith('cer') || base.endsWith('cir')) {
    // conocer → conozco（去掉 c 再加 zc）；vencer → venzo（c→z）
    return ZCO.has(base) ? stem.replace(/c$/, '') + 'zc' : stem.replace(/c$/, 'z');
  }
  if (isUir) return stem;                                     // construyo：y 已经在词尾里
  if (base.endsWith('aer')) return stem + 'ig';               // caer → caigo
  return stem;                                                // leer / creer → leo / creo
}

/** 只取 yo / tú / él 三个最高频形式，用于卡片速览 */
export function conjShort(verb) {
  const c = conjugate(verb);
  if (!c.forms || !c.forms.length) return [];
  return [0, 1, 2].map(i => ({ pron: PRON_SHORT[i], form: c.forms[i] })).filter(x => x.form);
}

// ============ 名词：冠词 + 性 ============
// 阴性但单数用 el（首音节重读的 a / ha 开头）
const EL_FEM = new Set(['agua', 'águila', 'alma', 'hambre', 'aula', 'arma', 'área', 'hacha',
  'hada', 'ala', 'ave', 'acta', 'alba', 'anca', 'arpa', 'asma', 'alga', 'alza', 'ambición_']);

/** 冠词：返回 el / la，并给出规则说明 */
export function articleFor(word, gender) {
  const w = String(word || '').trim();
  const low = w.toLowerCase();
  if (!w) return { art: '', note: '' };
  if (gender === 'f') {
    if (EL_FEM.has(low)) {
      return { art: 'el', note: '阴性名词，但首音节重读的 a- 开头，单数用 el（复数恢复正常：las aguas）' };
    }
    if (/[oó]$/.test(low)) {
      return { art: 'la', note: '以 -o 结尾却是阴性，属例外，需单独记（la mano / la foto）' };
    }
    return { art: 'la', note: '阴性名词用 la' };
  }
  if (/(ma|ta|pa)$/.test(low) && !/ista$/.test(low)) {
    return { art: 'el', note: '以 -ma / -ta / -pa 结尾多为阳性（el problema / el sistema / el mapa）' };
  }
  if (/[aá]$/.test(low)) {
    return { art: 'el', note: '以 -a 结尾却是阳性，属例外（el día / el mapa）' };
  }
  return { art: 'el', note: '阳性名词用 el' };
}

/** 词尾规则速记（用于没有 gender 字段时的提示） */
export function genderGuess(word) {
  const low = String(word || '').toLowerCase();
  if (/(ción|sión|dad|tad|umbre|ez|eza|ura|tud|ie)$/.test(low)) return { g: 'f', why: '-ción / -dad / -umbre 等结尾几乎都是阴性' };
  if (/(ma|ta|pa)$/.test(low) && !/ista$/.test(low)) return { g: 'm', why: '-ma 结尾多为希腊源阳性词' };
  if (/o$/.test(low)) return { g: 'm', why: '-o 结尾通常是阳性' };
  if (/a$/.test(low)) return { g: 'f', why: '-a 结尾通常是阴性' };
  if (/(or|ente|ante|ismo)$/.test(low)) return { g: 'm', why: '-or / -ente / -ismo 多为阳性' };
  return { g: 'm', why: '默认按阳性处理，遇到再修正' };
}

/** 复数 */
export function pluralOf(word) {
  const w = String(word || '').trim();
  if (!w) return '';
  const low = w.toLowerCase();
  if (/z$/.test(low)) return w.slice(0, -1) + 'ces';                       // lápiz → lápices
  if (/[íú]s$/.test(low)) return w + 'es';                                 // país → países
  if (/[áéó]s$/.test(low)) return w.replace(/([áéó])s$/, (m, v) => deaccent(v) + 'ses'); // inglés → ingleses
  if (/s$/.test(low)) return w;                                            // crisis / lunes → 不变
  if (/[aeiouáéíóú]$/.test(low)) return w + 's';                           // libro → libros
  return w + 'es';                                                          // papel → papeles
}
function deaccent(v) {
  return { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u' }[v] || v;
}

/** 形容词性数变化（-o 结尾四形，-e/-ista 等两形） */
export function adjForms(word) {
  const w = String(word || '').trim();
  if (!w) return [];
  if (/o$/.test(w)) {
    const s = w.slice(0, -1);
    return [
      { tag: '阳性单数', v: s + 'o' },
      { tag: '阴性单数', v: s + 'a' },
      { tag: '阳性复数', v: s + 'os' },
      { tag: '阴性复数', v: s + 'as' },
    ];
  }
  return [
    { tag: '单数（阴阳性同形）', v: w },
    { tag: '复数（阴阳性同形）', v: pluralOf(w) },
  ];
}

/** 判断一个词条该展示哪块语法 */
export function grammarKind(pos) {
  if (pos === 'v') return 'verb';
  if (pos === 'n') return 'noun';
  if (pos === 'adj') return 'adj';
  return '';
}
