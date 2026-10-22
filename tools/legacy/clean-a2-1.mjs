// A2 清理：删变位重复（仅删明确的变位/分词/副动词，保护同形异义名词/形容词）+ 修词性 + 修释义残留
import fs from 'fs';
const FILE = 'D:/vibecoding/site/js/data/books.js';
let s = fs.readFileSync(FILE, 'utf8');

// 取出 A2 块
const re = /level:\s*'([A-Z][0-9])'/g;
let m, marks = [];
while ((m = re.exec(s))) marks.push({ lv: m[1], at: m.index });
const i0 = marks.findIndex(x => x.lv === 'A2');
const t = s.slice(marks[i0].at, marks[i0 + 1] ? marks[i0 + 1].at : s.length);
const a2es = new Set();
const reE = /\{\s*es:\s*'((?:[^'\\]|\\.)*)'/g; let mm;
while ((mm = reE.exec(t))) a2es.add(mm[1]);

// 85 个被 data-lint 标记为变位重复的条目（form: infinitive）
const INFLECTED = {
  cocina:'cocinar', pasado:'pasar', cambio:'cambiar', compra:'comprar', limpio:'limpiar', factura:'facturar',
  viendo:'ver', hablado:'hablar', hablamos:'hablar', pelea:'pelear', quise:'querer', regreso:'regresar',
  dejé:'dejar', pidió:'pedir', podido:'poder', jugando:'jugar', tuvimos:'tener', volvió:'volver',
  teniendo:'tener', tomó:'tomar', empezó:'empezar', escuché:'escuchar', perdí:'perder', traído:'traer',
  dando:'dar', pedido:'pedir', fuimos:'ser', visita:'visitar', tomado:'tomar', salido:'salir',
  tomando:'tomar', dieron:'dar', estuviste:'estar', escrito:'escribir', yendo:'ir', llegamos:'llegar',
  tuviste:'tener', sentí:'sentir', perdió:'perder', quedó:'quedar', pedí:'pedir', sirve:'servir',
  robo:'robar', roto:'romper', descanso:'descansar', abierto:'abrir', viviendo:'vivir', trajo:'traer',
  hablé:'hablar', agradezco:'agradecer', llegué:'llegar', habló:'hablar', paga:'pagar', peso:'pesar',
  termina:'terminar', escuchado:'escuchar', comenzó:'comenzar', regresa:'regresar', cambia:'cambiar',
  tomé:'tomar', dormido:'dormir', quedado:'quedar', escuchando:'escuchar', pago:'pagar', cerrado:'cerrar',
  quiso:'querer', sabido:'saber', perdiendo:'perder', disculpas:'disculpar', durmiendo:'dormir',
  volviendo:'volver', coge:'coger', encuentras:'encontrar', pensó:'pensar', pensamos:'pensar',
  escribió:'escribir', pide:'pedir', saca:'sacar', empezando:'empezar', contado:'contar', vieron:'ver',
  vimos:'ver', pidiendo:'pedir', leído:'leer', cura:'curar',
};

// 同形异义：这些“变位形式”同时也是真实名词/形容词，保留不删
const PROTECT = new Set([
  'cocina','pasado','cambio','compra','pago','paga','robo','cura','peso','visita','factura',
  'limpio','pelea','descanso','cerrado','abierto','roto','dormido','sabido','pedido','disculpas','regreso',
]);

const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, c => '\\' + c);
const log = [];
let deleted = 0, kept = 0;
for (const [form, inf] of Object.entries(INFLECTED)) {
  if (PROTECT.has(form)) { log.push('KEEP(homonym) ' + form); kept++; continue; }
  const rx = new RegExp("\\{\\s*es:\\s*'" + esc(form) + "'[^}]*\\}\\s*,?", 'g');
  const before = s.length;
  s = s.replace(rx, '');
  if (s.length < before) { deleted++; } else { log.push('NOTFOUND ' + form); kept++; }
}
// 清掉可能残留的 ",\n  ]" 悬挂逗号
s = s.replace(/,\s*\]/g, ']');

// 修词性：aquella n -> det
{
  const rx = /(es:\s*'aquella'[^}]*?pos:\s*')([^']*)(')/;
  if (rx.test(s)) { s = s.replace(rx, '$1det$3'); log.push('POS aquella -> det'); }
  else log.push('POS aquella NOTFOUND');
}

// 修释义残留（去尾部标点 / 繁体转简体 / 明显的机翻垃圾）
const ZH = {
  vidas: '命数', finalmente: '最后', vienes: '你来吗', respecto: '关于；至于', duele: '（它）疼；痛',
  veremos: '我们看看再说吧', completo: '完整的；满的', ojalá: '但愿；希望', cartas: '书信',
  especialmente: '尤其是', deberían: '它们应该', posibilidad: '机会', cabello: '头发',
  enferma: '（她）生病的；病态的', bienvenidos: '欢迎你们', proceso: '过程；流程',
  mata: '它夺走生命', valiente: '勇气', números: '数量', enemigos: '敌人', testigos: '见证人', tomo: '卷',
};
for (const [w, zh] of Object.entries(ZH)) {
  const rx = new RegExp("(es:\\s*'" + esc(w) + "'[^}]*?zh:\\s*')([^']*)(')");
  if (rx.test(s)) { s = s.replace(rx, '$1' + zh + '$3'); log.push('ZH ' + w + ' -> ' + zh); }
  else log.push('ZH ' + w + ' NOTFOUND');
}

fs.writeFileSync(FILE, s, 'utf8');
const reread = fs.readFileSync(FILE, 'utf8');
log.push('DELETED=' + deleted + ' KEPT=' + kept + ' TOTAL_INFLECTED=' + Object.keys(INFLECTED).length);
log.push('verify_aquella_det=' + /es:\s*'aquella'[^}]*?pos:\s*'det'/.test(reread));
fs.writeFileSync('D:/vibecoding/site/_cleana2.txt', log.join('\n'), 'utf8');
