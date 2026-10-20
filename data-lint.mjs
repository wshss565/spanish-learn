// 词书数据体检：找出「变位形式重复收录 / 词性错标 / 释义疑似机翻残留」的词条，
// 并分出「内容可信、可安全补例句」的子集。
// 用法：node data-lint.mjs [等级]      默认 A1，结果写 A1词条待清理清单.md / A1词条补例句清单.md
//
// 判据来源与两个踩过的坑：
//   - conj.js 的 conjugate() 返回 {forms:[...]}，不是数组（当数组处理会得到 0 命中，静默误判）
//   - 它只覆盖现在时，所以过去时/分词/副动词用人工补表 EXTRA 兜住
//   - 同形异义词（trabajo=工作/nada=没有什么/camino=路/vino=酒）必须白名单排除，否则误报
import fs from 'fs';

const LEVEL = (process.argv[2] || 'A1').toUpperCase();
let md = '', text = '', cleanMd = '';
try {
  const { conjugate } = await import('./js/core/conj.js');
  ({ md, text, cleanMd } = run(conjugate));
} catch (e) {
  md = text = 'ERR: ' + (e && (e.stack || e.message) || e);
}
fs.writeFileSync(LEVEL + '词条待清理清单.md', md, 'utf8');
fs.writeFileSync(LEVEL + '词条补例句清单.md', cleanMd, 'utf8');
fs.writeFileSync('_quality.txt', text, 'utf8');

function run(conjugate) {
  const src = fs.readFileSync('js/data/books.js', 'utf8');
  const marks = [];
  const re = /level:\s*'([A-Z][0-9])'/g;
  let m;
  while ((m = re.exec(src))) marks.push({ lv: m[1], at: m.index });
  const i0 = marks.findIndex(x => x.lv === LEVEL);
  if (i0 < 0) return { md: '找不到等级 ' + LEVEL, text: 'ERR level', cleanMd: '' };
  const t = src.slice(marks[i0].at, marks[i0 + 1] ? marks[i0 + 1].at : src.length);

  const a1 = [];
  const reE = /\{\s*es:\s*'((?:[^'\\]|\\.)*)'([^}]*)\}/g;
  let mm;
  while ((mm = reE.exec(t))) {
    const b = mm[2];
    a1.push({
      es: mm[1],
      pos: (b.match(/\bpos:\s*'([^']*)'/) || [])[1] || '',
      zh: (b.match(/\bzh:\s*'((?:[^'\\]|\\.)*)'/) || [])[1] || '',
      ex: (b.match(/\bex:\s*'((?:[^'\\]|\\.)*)'/) || [])[1] || '',
    });
  }

  // —— 词形 → 不定式 映射 ——
  const infs = a1.filter(e => e.pos === 'v' && /(ar|er|ir)$/.test(e.es) && e.es.length > 2);
  const formToInf = new Map();
  infs.forEach(e => {
    let c;
    try { c = conjugate(e.es); } catch (err) { return; }
    const forms = (c && Array.isArray(c.forms)) ? c.forms : [];
    forms.forEach(f => { if (f && !formToInf.has(f)) formToInf.set(f, e.es); });
  });
  // 引擎只有现在时，补齐常见 A1 动词的过去时 / 分词 / 副动词
  const EXTRA = {
    ser: 'fui fuiste fue fuimos fueron sido siendo', estar: 'estuve estuviste estuvo estuvimos estuvieron estado estando',
    tener: 'tuve tuviste tuvo tuvimos tuvieron tenido teniendo', hacer: 'hice hiciste hizo hicimos hicieron hecho haciendo',
    ir: 'fui fuiste fue fuimos fueron ido yendo', decir: 'dije dijiste dijo dijimos dijeron dicho diciendo',
    ver: 'vi vio vimos vieron visto viendo', dar: 'di dio dimos dieron dado dando',
    poder: 'pude pudo pudimos pudieron podido pudiendo', querer: 'quise quiso quisimos quisieron querido queriendo',
    saber: 'supe supo supimos supieron sabido sabiendo', venir: 'vine vino vinimos vinieron venido viniendo',
    poner: 'puse puso pusimos pusieron puesto poniendo', salir: 'salí salió salimos salieron salido saliendo',
    traer: 'traje trajo trajimos trajeron traído trayendo', leer: 'leí leyó leímos leyeron leído leyendo',
    escribir: 'escribí escribió escribimos escribieron escrito escribiendo', abrir: 'abrí abrió abrimos abrieron abierto abriendo',
    romper: 'rompí rompió rompimos rompieron roto rompiendo', morir: 'morí murió morimos murieron muerto muriendo',
    nacer: 'nací nació nacimos nacieron nacido naciendo', creer: 'creí creyó creímos creyeron creído creyendo',
    sentir: 'sentí sintió sentimos sintieron sentido sintiendo', pensar: 'pensé pensó pensamos pensaron pensado pensando',
    empezar: 'empecé empezó empezamos empezaron empezado empezando', comenzar: 'comencé comenzó comenzamos comenzaron comenzado comenzando',
    volver: 'volví volvió volvimos volvieron vuelto volviendo', perder: 'perdí perdió perdimos perdieron perdido perdiendo',
    contar: 'conté contó contamos contaron contado contando', jugar: 'jugué jugó jugamos jugaron jugado jugando',
    buscar: 'busqué buscó buscamos buscaron buscado buscando', llegar: 'llegué llegó llegamos llegaron llegado llegando',
    pagar: 'pagué pagó pagamos pagaron pagado pagando', tocar: 'toqué tocó tocamos tocaron tocado tocando',
    esperar: 'esperé esperó esperamos esperaron esperado esperando', mirar: 'miré miró miramos miraron mirado mirando',
    escuchar: 'escuché escuchó escuchamos escucharon escuchado escuchando', comer: 'comí comió comimos comieron comido comiendo',
    beber: 'bebí bebió bebimos bebieron bebido bebiendo', vivir: 'viví vivió vivimos vivieron vivido viviendo',
    hablar: 'hablé habló hablamos hablaron hablado hablando', trabajar: 'trabajé trabajó trabajamos trabajaron trabajado trabajando',
    estudiar: 'estudié estudió estudiamos estudiaron estudiado estudiando', comprar: 'compré compró compramos compraron comprado comprando',
    tomar: 'tomé tomó tomamos tomaron tomado tomando', dejar: 'dejé dejó dejamos dejaron dejado dejando',
    pasar: 'pasé pasó pasamos pasaron pasado pasando', quedar: 'quedé quedó quedamos quedaron quedado quedando',
    entender: 'entendí entendió entendimos entendieron entendido entendiendo', seguir: 'seguí siguió seguimos siguieron seguido siguiendo',
    pedir: 'pedí pidió pedimos pidieron pedido pidiendo', dormir: 'dormí durmió dormimos durmieron dormido durmiendo',
    servir: 'serví sirvió servimos sirvieron servido sirviendo', repetir: 'repetí repitió repetimos repitieron repetido repitiendo',
    preferir: 'preferí prefirió preferimos prefirieron preferido prefiriendo', cerrar: 'cerré cerró cerramos cerraron cerrado cerrando',
    perder2: '', entender2: '', empezar2: '', pensar2: '', sentir2: '', herir: '', decir2: '',
  };
  Object.keys(EXTRA).forEach(inf => {
    EXTRA[inf].split(' ').filter(Boolean).forEach(f => { if (!formToInf.has(f)) formToInf.set(f, inf); });
  });

  const HOMO = new Set([
    'trabajo', 'camino', 'nada', 'paso', 'vino', 'dado', 'toma', 'cuanto',
    'como', 'sé', 've', 'sea', 'estado', 'vivo', 'hecho', 'dicho',
    'visto', 'ido', 'serio', 'seguro', 'medio', 'sentido', 'justo', 'gran',
    'primera', 'cargo', 'puesto', 'orden', 'mando', 'visita', 'compra', 'cambio',
    'pasado', 'pedido', 'pago', 'robo', 'cura', 'pelea', 'regreso', 'descanso',
    'abierto', 'dormido', 'cerrado', 'sabido', 'roto', 'sal', 'paga', 'peso',
    'almuerzo', 'baile', 'cena', 'cocina', 'comienzo', 'cuenta', 'cuentas', 'cuento',
    'desayuno', 'disculpas', 'factura', 'ganado', 'ganas', 'invitado', 'limpio', 'nieve',
    'odio', 'partido', 'pesado', 'presente', 'prima', 'primo', 'recibo', 'sentado',
    'tomo', 'uso', 'viaje', 'cuesta', 'divertido', 'encantado', 'frío', 'nota',
    'primeros', 'alegre', 'amado', 'coma', 'compras', 'encanto', 'firme', 'fría',
    'guarda', 'interesado', 'intereses', 'metas', 'millas', 'miras', 'muestras', 'pasas',
    'reserva', 'saco', 'salto', 'tira', 'viajes', 'visitas', 'tratado', 'cierre',
    'entrega', 'corte', 'deseo', 'duda', 'obra', 'marca', 'copia', 'prueba',
    'gasto', 'grito', 'llanto', 'venta', 'caza', 'pesca', 'despierto', 'aborto',
    'activa', 'activo', 'alimento', 'alivio', 'altas', 'amplia', 'amplio', 'apuntes',
    'arreglo', 'ajuste', 'ajustes', 'agarre', 'auxilio', 'brillo', 'cobre', 'cojo',
    'cultivo', 'dibujo', 'encaje', 'envío', 'escala', 'experimento', 'fabrica', 'facturas',
    'falla', 'fallo', 'fija', 'funciones', 'giro', 'guardas', 'ingreso', 'inicio',
    'intercambio', 'invento', 'liga', 'lanzas', 'logro', 'manejo', 'marchas', 'mates',
    'mezcla', 'mudo', 'nieves', 'ola', 'olas', 'ordenes', 'orina', 'paro',
    'parto', 'pases', 'pesas', 'pilas', 'plantas', 'polo', 'protesta', 'pulgas',
    'rango', 'rechazo', 'reemplazo', 'relleno', 'reparto', 'reporte', 'reportes', 'reservas',
    'retiro', 'rezo', 'saludo', 'secuestro', 'sospecha', 'venda', 'vendas', 'viola',
    'vista', 'vistas', 'cobra', 'canto', 'causas', 'consulta', 'conquista', 'conserva',
    'costado', 'denuncia', 'descarga', 'desperdicio', 'dobles', 'enteras', 'estaciones', 'honra',
    'impresiones', 'lanza', 'pila', 'pipa', 'acorde', 'acordes', 'ahorro', 'aparente',
    'buceo', 'centeno', 'claves', 'cobras', 'desmayo', 'frena', 'gozo', 'impreso',
    'incremento', 'lame', 'mercadería', 'mienta', 'mezclas', 'porte', 'pose', 'prenda',
    'prendas', 'reclutas', 'recorte', 'remo', 'soles', 'suela', 'soplo', 'sumas',
    'susurro', 'tapas', 'tejas', 'torturas', 'vacio', 'andes', 'suelo', 'corta',
    'sello', 'resto', 'resta', 'sobra', 'carga', 'tasa', 'sino', 'serie',
    'fondo', 'frente', 'lado', 'lados', 'juego', 'juega',
  ]);
  const dup = a1.filter(e => formToInf.has(e.es) && formToInf.get(e.es) !== e.es && !HOMO.has(e.es));

  const FUNC = new Set(['no', 'sí', 'más', 'menos', 'esto', 'eso', 'algo', 'alguien', 'nadie', 'todo', 'toda', 'todos', 'todas',
    'otro', 'otra', 'otros', 'otras', 'mucho', 'mucha', 'muchos', 'muchas', 'poco', 'poca',
    'yo', 'tú', 'él', 'ella', 'nosotros', 'vosotros', 'ellos', 'ellas', 'usted', 'ustedes', 'mí', 'ti', 'me', 'te', 'se', 'nos', 'os', 'le', 'les', 'lo', 'la', 'los', 'las', 'conmigo', 'contigo',
    'mi', 'tu', 'su', 'mis', 'tus', 'sus', 'nuestro', 'nuestra', 'nuestros', 'nuestras', 'mío', 'mía',
    'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'aquel', 'aquella',
    'qué', 'quién', 'dónde', 'cómo', 'cuánto', 'cuándo', 'cuál', 'quien', 'algún', 'alguna', 'algunos', 'algunas', 'ningún', 'ninguna', 'cada', 'cual', 'tal', 'bastante', 'tan', 'tanto',
    'luego', 'aún', 'también', 'tampoco', 'sólo', 'solo', 'siempre', 'nunca', 'ahora', 'aquí', 'allí', 'allá', 'así', 'bien', 'casi', 'incluso', 'además', 'entonces', 'hay',
    'y', 'o', 'que', 'si', 'pues', 'pero', 'a', 'de', 'en', 'con', 'por', 'para', 'sin', 'sobre', 'entre', 'hasta', 'desde', 'el', 'una', 'del', 'un']);
  const mislabeled = a1.filter(e => FUNC.has(e.es) && e.pos === 'n');

  // 注意：只收**纯繁体**字符。早期版本把「校 / 生 / 院 / 門 / 頭 / 車 / 馬 / 鳥 / 葉」等简繁同形字
  // 也放进来，导致 `escuela=学校`、`cabeza=头`、`mano=手` 全被误判成机翻残留。
  const TRAD = /[圖烏語乾較這們現實運氣鐘嬰兒親頁與島舊書寫讀買賣錢銀髮臉頰醫藥農場櫃檯聽藥]/;
  // 西语括注（全角括号（）内的西语）是合法释义，先剥掉再判拉丁字母，避免把「使喜欢（me gusta 我喜欢）」误报成机翻残留
  const stripParen = s => String(s).replace(/（[^）]*）/g, '');
  const dirtyZh = a1.filter(e => /[0-9A-Za-z\$]/.test(stripParen(e.zh)) || /[。：？]$/.test(e.zh) || TRAD.test(e.zh));

  const wordIn = (s, w) => {
    const escRe = x => String(x).replace(/[.*+?^${}()|[\]\\]/g, c => '\\' + c);
    try { return new RegExp(`(^|[^\\p{L}\\p{N}])(${escRe(w)})([^\\p{L}\\p{N}]|$)`, 'iu').test(s); } catch { return false; }
  };

  const reason = new Map();
  dup.forEach(e => reason.set(e.es, (reason.get(e.es) || []).concat('变位重复(→' + formToInf.get(e.es) + ')')));
  mislabeled.forEach(e => reason.set(e.es, (reason.get(e.es) || []).concat('词性错标(pos=' + e.pos + ')')));
  dirtyZh.forEach(e => reason.set(e.es, (reason.get(e.es) || []).concat('释义可疑')));

  const flagged = [...reason.keys()];
  const clean = a1.filter(e => !reason.has(e.es));

  const md2 = [
    '# ' + LEVEL + ' 词条质量清单（自动判据 v3）',
    '',
    '- ' + LEVEL + ' 共 **' + a1.length + '** 词',
    '- 无例句 **' + a1.filter(e => !e.ex).length + '**，例句不含原词 **' + a1.filter(e => e.ex && !wordIn(e.ex, e.es)).length + '**',
    '- 变位重复 **' + dup.length + '**（引擎覆盖现在时 + 人工补表覆盖过去时/分词/副动词）',
    '- 词性错标 **' + mislabeled.length + '**（功能词被标成 n）',
    '- 释义可疑 **' + dirtyZh.length + '**',
    '- **未被标记、内容可信 ' + clean.length + '**（其中无例句 ' + clean.filter(e => !e.ex).length + '）',
    '',
    '## 待清理清单（' + flagged.length + '）',
    '',
    flagged.map(es => {
      const e = a1.find(x => x.es === es);
      return '| ' + es + ' | ' + reason.get(es).join(' + ') + ' | ' + e.pos + ' | ' + e.zh + ' |';
    }).join('\n'),
  ].join('\n');

  const text2 = [
    'A1 总数 ' + a1.length,
    '无例句 ' + a1.filter(e => !e.ex).length + ' / 例句不含原词 ' + a1.filter(e => e.ex && !wordIn(e.ex, e.es)).length,
    '① 变位重复 ' + dup.length,
    '② 词性错标 ' + mislabeled.length,
    '③ 释义可疑 ' + dirtyZh.length,
    '④ 可信 ' + clean.length + '（无例句 ' + clean.filter(e => !e.ex).length + '，例句不含原词 ' + clean.filter(e => e.ex && !wordIn(e.ex, e.es)).length + '）',
  ].join('\n');

  const cleanMd = [
    '# ' + LEVEL + ' 可安全补例句的词条（' + clean.length + '）',
    '',
    '- 无例句 **' + clean.filter(e => !e.ex).length + '** 条 → 需要新写例句',
    '- 例句不含原词 **' + clean.filter(e => e.ex && !wordIn(e.ex, e.es)).length + '** 条 → 需要替换例句（否则完形挖空与点词查义对不上）',
    '- 合计需处理 **' + clean.filter(e => !e.ex || !wordIn(e.ex, e.es)).length + '** 条',
    '',
    '新写例句的硬性要求：句中必须原样出现该词（大小写不敏感、重音敏感），',
    '因为完形填空靠 blankWord() 挖空、认词卡靠词形匹配高亮，两者匹配不到就静默失效。',
    '动词请用「querer / poder / ir a / tener que + 不定式」等自然结构把不定式带进句子，',
    '而不要写变位形式（本清单里的动词已有变位形式单独成条的问题，见待清理清单）。',
    '',
    '| 词 | 词性 | 释义 | 现状 |',
    '| --- | --- | --- | --- |',
    clean.map(e => '| `' + e.es + '` | ' + (e.pos || '') + ' | ' + e.zh + ' | ' +
      (!e.ex ? '无例句' : (wordIn(e.ex, e.es) ? '已有例句(可用)' : '例句不含原词：' + e.ex)) + ' |').join('\n'),
  ].join('\n');

  const cleanWork = clean.filter(e => !e.ex || !wordIn(e.ex, e.es));
  const workList = cleanWork.map(e => (!e.ex ? 'NEW' : 'FIX') + ' ' + e.es + ' | ' + e.pos + ' | ' + e.zh);
  fs.writeFileSync(LEVEL + '待补例句.txt',
    LEVEL + ' 可信且需例句 ' + cleanWork.length + ' 条（新写 ' + cleanWork.filter(e => !e.ex).length +
    ' / 替换已有例句 ' + cleanWork.filter(e => e.ex).length + '）\n' + workList.join('\n') + '\n', 'utf8');

  return { md: md2, text: text2, cleanMd: cleanMd };
}
