// B1 释义 / 词性修正（与 fix-a2-def.mjs 同构，B1 专用表）
// 表里写了但词书里没有的词一律报错中止、不写盘（防止我凭印象写错 key 而静默失效）。
import fs from 'fs';

const FILE = 'js/data/books.js';
const LEVEL = 'B1';
const src = fs.readFileSync(FILE, 'utf8');
const marks = [];
const re = /level:\s*'([A-Z][0-9])'/g;
let m; while ((m = re.exec(src))) marks.push({ lv: m[1], at: m.index });
const iL = marks.findIndex(x => x.lv === LEVEL);
const start = marks[iL].at, end = marks[iL + 1] ? marks[iL + 1].at : src.length;
let seg = src.slice(start, end);

const DEL = ['cia', 'dudo'];

const FIX = {
  entrevista: { zh: '采访；面试' }, pintura: { zh: '绘画；油漆' }, destruir: { zh: '破坏；摧毁' },
  felicidades: { zh: '恭喜；祝贺' }, camioneta: { zh: '小货车' }, móvil: { zh: '手机' },
  equivocada: { zh: '错误的（阴性）' }, clara: { zh: '清澈的；明亮的（阴性）' }, solución: { zh: '解决办法' },
  mundial: { zh: '世界的；全球的' }, famoso: { zh: '著名的' }, ambas: { zh: '两者（阴性）' },
  tecnología: { zh: '技术' }, rápidamente: { zh: '快速地' }, mensajes: { zh: '消息（复数）' },
  sujeto: { zh: '主体；家伙；主语' }, molesto: { zh: '烦人的；令人讨厌的', pos: 'adj' },
  fortuna: { zh: '运气；财富' }, presencia: { zh: '存在；出席' }, aventura: { zh: '冒险；奇遇' },
  gira: { zh: '巡演；游览' }, social: { zh: '社会的', pos: 'adj' }, cero: { zh: '零' },
  convertido: { zh: '转变的', pos: 'adj' }, legal: { zh: '合法的', pos: 'adj' }, reino: { zh: '王国' },
  esfuerzo: { zh: '努力' }, tesoro: { zh: '宝藏' }, cirugía: { zh: '外科手术' }, clave: { zh: '钥匙；关键' },
  bravo: { zh: '勇敢的；好极了', pos: 'adj' }, controlar: { zh: '控制' }, mostrar: { zh: '展示' },
  respirar: { zh: '呼吸' }, campaña: { zh: '运动；战役' }, huesos: { zh: '骨头（复数）' },
  ritmo: { zh: '节奏' }, socio: { zh: '合伙人；会员' }, caído: { zh: '倒下的；阵亡的', pos: 'adj' },
  motor: { zh: '发动机；马达' }, mono: { zh: '猴子' }, poquito: { zh: '一点点' },
  útil: { zh: '有用的', pos: 'adj' }, bola: { zh: '球' }, asistente: { zh: '助手', pos: 'n' },
  correcta: { zh: '正确的（阴性）', pos: 'adj' }, tirar: { zh: '扔；掷' }, carro: { zh: '车；购物车' },
  compromiso: { zh: '承诺；约定' }, ira: { zh: '愤怒' }, compras: { zh: '购买（复数）；购物' },
  personalmente: { zh: '亲自' }, desgracia: { zh: '不幸；灾难' }, artículo: { zh: '文章；物品' },
  cola: { zh: '尾巴；队列' }, taza: { zh: '杯子' }, interesado: { zh: '感兴趣的', pos: 'adj' },
  atrapado: { zh: '被困住的', pos: 'adj' }, obvio: { zh: '明显的', pos: 'adj' },
  últimas: { zh: '最后的（阴性复数）', pos: 'adj' }, dioses: { zh: '神（复数）' }, vueltas: { zh: '圈；转弯（复数）' },
  cobarde: { zh: '胆小的；懦夫', pos: 'adj' }, secundaria: { zh: '中学；次要的' }, celular: { zh: '手机', pos: 'n' },
  veinte: { zh: '二十' }, vivos: { zh: '活着的（复数）', pos: 'adj' }, alemanes: { zh: '德国人（复数）' },
  milagro: { zh: '奇迹' }, moda: { zh: '时尚' }, despacho: { zh: '办公室；书房' }, poderes: { zh: '权力（复数）' },
  regla: { zh: '尺子；规则' }, copia: { zh: '副本；复制' }, meter: { zh: '放进；插入' },
  contenta: { zh: '高兴的（阴性）', pos: 'adj' }, maneras: { zh: '方式（复数）' }, encantador: { zh: '迷人的', pos: 'adj' },
  cuantos: { zh: '多少（阳性复数）' }, homicidio: { zh: '凶杀' }, tratamiento: { zh: '治疗；处理' },
  anterior: { zh: '以前的；前面的', pos: 'adj' }, comisario: { zh: '警长；专员' }, millas: { zh: '英里（复数）' },
  lío: { zh: '麻烦；混乱' }, guardias: { zh: '警卫（复数）' }, leyes: { zh: '法律（复数）' },
  salvaje: { zh: '野生的', pos: 'adj' }, mentiroso: { zh: '爱撒谎的；骗子', pos: 'adj' },
  libres: { zh: '自由的（复数）', pos: 'adj' }, medios: { zh: '手段；媒体（复数）' }, conocimiento: { zh: '知识' },
  uniforme: { zh: '制服；统一的' }, suave: { zh: '柔软的；温和的', pos: 'adj' },
  propias: { zh: '自己的（阴性复数）', pos: 'adj' }, balas: { zh: '子弹（复数）' }, equipos: { zh: '团队；设备（复数）' },
  licencia: { zh: '执照；许可' }, espejo: { zh: '镜子' }, marina: { zh: '海军；码头' }, seres: { zh: '生物（复数）' },
  mover: { zh: '移动' }, coincidencia: { zh: '巧合' }, ocasión: { zh: '场合；机会' }, revisar: { zh: '检查；复习' },
  heridas: { zh: '伤口（复数）' }, posibilidades: { zh: '可能性（复数）' }, registros: { zh: '记录（复数）' },
  abogados: { zh: '律师（复数）' }, americanos: { zh: '美洲人（复数）' }, alemán: { zh: '德国的；德语' },
  alerta: { zh: '警报；警觉' }, regalos: { zh: '礼物（复数）' }, señales: { zh: '信号（复数）' },
  imágenes: { zh: '图像（复数）' }, canal: { zh: '频道；运河' }, vigilancia: { zh: '监视' },
  gobernador: { zh: '州长；总督' }, sección: { zh: '部分；栏目' }, trabajos: { zh: '工作（复数）' },
  oso: { zh: '熊', pos: 'n' }, impresión: { zh: '印象；印刷' }, torre: { zh: '塔' }, mentir: { zh: '说谎' },
  ricos: { zh: '富有的（复数）', pos: 'adj' }, sencillo: { zh: '简单的；单曲', pos: 'adj' },
  apuesta: { zh: '打赌；赌注' }, perdida: { zh: '丢失的；损失' }, identidad: { zh: '身份；特性' },
  aviso: { zh: '通知；警告' }, caza: { zh: '狩猎' }, reales: { zh: '实际的；真实的', pos: 'adj' },
  cuantas: { zh: '多少（阴性复数）' }, fácilmente: { zh: '容易地' }, criatura: { zh: '生物；婴儿', pos: 'n' },
  precisamente: { zh: '精确地' }, máximo: { zh: '最大的；最大值', pos: 'adj' }, ilegal: { zh: '非法的', pos: 'adj' },
  casualidad: { zh: '巧合' }, excusa: { zh: '借口' }, cruel: { zh: '残忍的', pos: 'adj' }, sofá: { zh: '沙发' },
  encantadora: { zh: '迷人的' }, encantada: { zh: '很高兴（阴性）', pos: 'adj' }, escritorio: { zh: '书桌；桌面' },
  muñeca: { zh: '娃娃；手腕' }, rastro: { zh: '踪迹' }, gigante: { zh: '巨人；巨大的', pos: 'n' },
  condición: { zh: '条件' }, actor: { zh: '演员' }, personaje: { zh: '人物；角色' }, cambios: { zh: '变化（复数）' },
  votos: { zh: '选票（复数）' }, suficientes: { zh: '足够的', pos: 'adj' }, comercial: { zh: '商业的；广告', pos: 'adj' },
  tribu: { zh: '部落' }, pura: { zh: '纯的（阴性）', pos: 'adj' }, voto: { zh: '选票；誓言' },
  asesinatos: { zh: '凶杀（复数）' }, orgullosa: { zh: '自豪的（阴性）', pos: 'adj' },
  difíciles: { zh: '困难的（复数）', pos: 'adj' }, campeón: { zh: '冠军' }, ciego: { zh: '瞎的；盲人', pos: 'adj' },
  episodio: { zh: '一集；事件' }, celda: { zh: '牢房；单元格' }, montañas: { zh: '山（复数）' },
  pensamientos: { zh: '想法（复数）' }, sesión: { zh: '会议；场次' }, identificación: { zh: '身份证明' },
  veneno: { zh: '毒' }, súper: { zh: '超级的', pos: 'adj' }, vuestros: { zh: '你们的', pos: 'det' },
  aquello: { zh: '那个' }, virgen: { zh: '处女；圣母' }, socorro: { zh: '救命；救助' }, castigo: { zh: '惩罚' },
  límite: { zh: '界限' }, junta: { zh: '会议；董事会' }, líneas: { zh: '行；线路（复数）' },
  audiencia: { zh: '听众；庭审' }, jugador: { zh: '玩家；球员' }, popular: { zh: '受欢迎的', pos: 'adj' },
  nación: { zh: '国家；民族' }, tropas: { zh: '部队' }, explicación: { zh: '解释' }, misterio: { zh: '谜；神秘', pos: 'n' },
  ganador: { zh: '获胜者' }, favorita: { zh: '最喜欢的（阴性）', pos: 'adj' }, patio: { zh: '院子' },
  tontería: { zh: '蠢事' }, pecado: { zh: '罪；罪过', pos: 'n' }, preparada: { zh: '准备好的', pos: 'adj' },
  rescate: { zh: '救援；赎金' }, título: { zh: '标题；头衔' }, adivina: { zh: '猜猜看' }, pánico: { zh: '恐慌', pos: 'n' },
  exterior: { zh: '外部的；外面' }, tierras: { zh: '土地（复数）' }, demostrar: { zh: '证明' },
  elegante: { zh: '优雅的', pos: 'adj' }, cabezas: { zh: '头（复数）' }, impuestos: { zh: '税（复数）' },
  distinto: { zh: '不同的', pos: 'adj' }, ron: { zh: '朗姆酒', pos: 'n' }, marcas: { zh: '品牌（复数）' },
  adecuado: { zh: '适当的', pos: 'adj' }, abandonar: { zh: '抛弃；放弃' }, apesta: { zh: '发臭；糟透了' },
  periódicos: { zh: '报纸（复数）' }, asco: { zh: '厌恶' }, cuán: { zh: '多么', pos: 'adv' },
  escalera: { zh: '楼梯' }, terapia: { zh: '治疗' }, terreno: { zh: '土地；场地' }, roca: { zh: '岩石' },
  superficie: { zh: '表面' }, cubierta: { zh: '覆盖物；甲板' }, mental: { zh: '精神的', pos: 'adj' },
  extranjero: { zh: '外国人；外国的' }, chino: { zh: '中文；中国的' }, suelta: { zh: '松开（命令）；放松' },
  despedida: { zh: '告别' }, pasta: { zh: '面条；糊状物' }, cristal: { zh: '玻璃；水晶', pos: 'n' },
  peces: { zh: '鱼（复数）' }, literalmente: { zh: '字面上' }, aprecio: { zh: '欣赏；感激' },
  patrón: { zh: '老板；模式' }, esposas: { zh: '妻子（复数）；手铐' }, desafío: { zh: '挑战' },
  asombroso: { zh: '惊人的', pos: 'adj' }, pedazos: { zh: '块（复数）' }, clínica: { zh: '诊所' },
  experto: { zh: '专家' }, medida: { zh: '措施；尺寸' }, desagradable: { zh: '令人不快的', pos: 'adj' },
  custodia: { zh: '监护；保管' }, desgraciado: { zh: '不幸的；可怜人', pos: 'adj' },
  habilidades: { zh: '技能（复数）' }, sentimiento: { zh: '感情' }, golpes: { zh: '打击（复数）' },
  operaciones: { zh: '操作（复数）' }, templo: { zh: '寺庙' }, bombas: { zh: '炸弹（复数）' },
  paredes: { zh: '墙（复数）' }, amén: { zh: '阿门' }, civil: { zh: '民事的；平民', pos: 'adj' },
  fantasmas: { zh: '鬼（复数）' }, conferencia: { zh: '讲座；会议' }, delito: { zh: '罪行' },
  objeto: { zh: '物体；对象' }, disparos: { zh: '枪声（复数）' }, ruedas: { zh: '轮子（复数）' },
  recientemente: { zh: '最近' }, violación: { zh: '强奸；违反' }, tina: { zh: '浴缸' }, habilidad: { zh: '技能' },
  pastillas: { zh: '药片（复数）' }, cable: { zh: '电缆', pos: 'n' }, alquiler: { zh: '租金', pos: 'n' },
  incidente: { zh: '事件', pos: 'n' }, condado: { zh: '县', pos: 'n' }, piezas: { zh: '件（复数）' },
  ladrones: { zh: '小偷（复数）' }, actuación: { zh: '演出；表演' }, refugio: { zh: '避难所' },
  harto: { zh: '受够了的', pos: 'adj' }, reacción: { zh: '反应' }, paliza: { zh: '殴打' },
  quitar: { zh: '拿走；去掉' }, amanecer: { zh: '天亮；黎明' }, corazones: { zh: '心（复数）' },
  celoso: { zh: '嫉妒的', pos: 'adj' }, pública: { zh: '公共的（阴性）', pos: 'adj' },
  collar: { zh: '项链', pos: 'n' }, montar: { zh: '骑；组装' }, grados: { zh: '度（复数）' },
  moto: { zh: '摩托车' }, adonde: { zh: '去哪里' }, cigarrillo: { zh: '香烟' }, secreta: { zh: '秘密的（阴性）', pos: 'adj' },
  mortal: { zh: '凡人的；致命的', pos: 'adj' }, metal: { zh: '金属', pos: 'n' }, puro: { zh: '纯粹的；雪茄', pos: 'adj' },
  cierre: { zh: '关闭；闭幕' }, colores: { zh: '颜色（复数）' }, tono: { zh: '音调；语气' },
  empleados: { zh: '员工（复数）' }, detalle: { zh: '细节' }, rusos: { zh: '俄罗斯人（复数）' },
  flota: { zh: '舰队' }, platos: { zh: '盘子；菜肴（复数）' }, crímenes: { zh: '罪行（复数）' },
  golpear: { zh: '打；敲' }, serpiente: { zh: '蛇', pos: 'n' }, romántico: { zh: '浪漫的', pos: 'adj' },
  peores: { zh: '更差的（复数）', pos: 'adj' }, restos: { zh: '残余；遗骸' }, placa: { zh: '板；牌照' },
  rata: { zh: '老鼠' }, afortunado: { zh: '幸运的', pos: 'adj' }, puestos: { zh: '职位（复数）' },
  división: { zh: '分部；除法' }, entradas: { zh: '门票（复数）' }, vuestras: { zh: '你们的（阴性复数）', pos: 'det' },
  espacial: { zh: '太空的', pos: 'adj' }, comisaría: { zh: '警察局', pos: 'n' }, sincero: { zh: '真诚的', pos: 'adj' },
  centavos: { zh: '分（货币，复数）' }, recursos: { zh: '资源（复数）' }, personales: { zh: '个人的', pos: 'adj' },
  almacén: { zh: '仓库；商店' }, sabor: { zh: '味道' }, unión: { zh: '联合；联盟' }, aviones: { zh: '飞机（复数）' },
  calidad: { zh: '质量' }, punta: { zh: '尖端；点' }, cinturón: { zh: '腰带' }, cuales: { zh: '那些（复数）' },
  chiste: { zh: '笑话', pos: 'n' }, consecuencias: { zh: '后果（复数）' }, sinceramente: { zh: '真诚地' },
  vaca: { zh: '牛' }, prisionero: { zh: '囚犯' }, investigar: { zh: '调查' }, apellido: { zh: '姓氏', pos: 'n' },
  actual: { zh: '当前的', pos: 'adj' }, instante: { zh: '瞬间' }, sentada: { zh: '坐着的（阴性）', pos: 'adj' },
  emociones: { zh: '情绪（复数）' }, dormitorio: { zh: '卧室' }, frase: { zh: '句子' },
  partida: { zh: '一局；出发；批次' }, moral: { zh: '道德的；士气', pos: 'adj' }, asalto: { zh: '袭击' },
  médica: { zh: '女医生；医疗的' }, combustible: { zh: '燃料', pos: 'n' }, discusión: { zh: '讨论；争论' },
  pata: { zh: '腿（动物）' }, antiguos: { zh: '古老的（复数）', pos: 'adj' }, comunicación: { zh: '交流；通讯' },
  joyas: { zh: '珠宝（复数）' }, noble: { zh: '高贵的；贵族', pos: 'adj' }, letra: { zh: '字母；歌词' },
  sacerdote: { zh: '神父' }, efectos: { zh: '效果（复数）' }, resistencia: { zh: '抵抗；耐力' },
  desconocido: { zh: '未知的；陌生人', pos: 'adj' }, mínimo: { zh: '最小的；最小值', pos: 'adj' },
  bandera: { zh: '旗帜' }, demasiada: { zh: '过多的（阴性）', pos: 'det' }, imperio: { zh: '帝国' },
  enfadada: { zh: '生气的（阴性）', pos: 'adj' }, levantar: { zh: '举起' }, importar: { zh: '进口；重要' },
  depósito: { zh: '押金；仓库' }, forense: { zh: '法医的', pos: 'adj' }, tensión: { zh: '紧张；电压' },
  involucrado: { zh: '卷入的', pos: 'adj' }, vacía: { zh: '空的（阴性）', pos: 'adj' }, círculo: { zh: '圆；圈子' },
  gritos: { zh: '喊叫（复数）' }, campos: { zh: '田野；领域（复数）' }, divertida: { zh: '有趣的（阴性）', pos: 'adj' },
  pinta: { zh: '外表；迹象' }, entregar: { zh: '交付' }, limpieza: { zh: '清理' }, magnífico: { zh: '宏伟的', pos: 'adj' },
  trabajadores: { zh: '工人（复数）' }, caída: { zh: '跌落' }, lealtad: { zh: '忠诚' }, alas: { zh: '翅膀（复数）' },
  enojada: { zh: '生气的（阴性）', pos: 'adj' }, leyenda: { zh: '传说；图例' }, cabaña: { zh: '小屋' },
  secretaria: { zh: '女秘书；秘书处', pos: 'n' }, lentamente: { zh: '缓慢地' }, ensayo: { zh: '排练；论文' },
  negativo: { zh: '负的；负数', pos: 'adj' }, león: { zh: '狮子' }, oídos: { zh: '耳朵（复数）' },
  espaldas: { zh: '背部（复数）' }, apuestas: { zh: '赌注（复数）' }, pelotas: { zh: '球（复数）' },
  dragón: { zh: '龙' }, aguantar: { zh: '忍受；坚持' }, primeras: { zh: '最初的（阴性复数）', pos: 'adj' },
  generación: { zh: '一代；世代' }, sexuales: { zh: '性的（复数）', pos: 'adj' }, máquinas: { zh: '机器（复数）' },
  sistemas: { zh: '系统（复数）' }, solitario: { zh: '孤独的', pos: 'adj' }, sonar: { zh: '发出声音；响' },
  atractivo: { zh: '有吸引力的；魅力', pos: 'adj' }, barra: { zh: '酒吧；棍' }, movimientos: { zh: '动作（复数）' },
  cubierto: { zh: '遮盖的；餐具' }, producto: { zh: '产品' }, demanda: { zh: '需求；诉讼' },
  construcción: { zh: '建筑；建设' }, criaturas: { zh: '生物（复数）' }, perfil: { zh: '个人资料；侧影' },
  pistas: { zh: '线索（复数）' }, razonable: { zh: '合理的', pos: 'adj' }, gerente: { zh: '经理', pos: 'n' },
  sensible: { zh: '敏感的', pos: 'adj' }, izquierdo: { zh: '左边的', pos: 'adj' }, secretario: { zh: '秘书', pos: 'n' },
  rueda: { zh: '轮子' }, super: { zh: '超级的', pos: 'adj' }, militares: { zh: '军人；军事的' },
  ciudadanos: { zh: '公民（复数）' }, escándalo: { zh: '丑闻' }, nervios: { zh: '神经；紧张' },
  rumbo: { zh: '航向；方向' }, gorda: { zh: '胖的（阴性）', pos: 'adj' }, preocupación: { zh: '担忧' },
  desnudo: { zh: '裸露的', pos: 'adj' }, carreras: { zh: '职业；赛跑（复数）' }, ratas: { zh: '老鼠（复数）' },
  heroína: { zh: '女英雄；海洛因' }, contestar: { zh: '回答' }, alternativa: { zh: '替代方案' },
  verdaderamente: { zh: '真正地' }, ánimo: { zh: '精神；鼓励', pos: 'n' }, lujo: { zh: '奢侈' },
  despejado: { zh: '晴朗的', pos: 'adj' }, hierro: { zh: '铁' }, corona: { zh: '王冠' },
  grabación: { zh: '录音' }, producción: { zh: '生产；产量' }, nuclear: { zh: '核的', pos: 'adj' },
  puesta: { zh: '上菜；比赛；日落' }, carácter: { zh: '性格；字符', pos: 'n' }, máscara: { zh: '面具' },
};

const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, c => '\\' + c);
const reE = /\{\s*es:\s*'((?:[^'\\]|\\.)*)'([^}]*)\}/g;
const present = new Set();
let mm; while ((mm = reE.exec(seg))) present.add(mm[1]);

const errs = [];
[...Object.keys(FIX), ...DEL].forEach(k => { if (!present.has(k)) errs.push('表里有但词书里没有: ' + k); });
if (errs.length) { fs.writeFileSync('_fixb1def.txt', '中止（未写盘）：\n' + errs.join('\n') + '\n', 'utf8'); process.exit(1); }

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
fs.writeFileSync(FILE, src.slice(0, start) + seg + src.slice(end), 'utf8');

const after = (seg.match(reE) || []).length;
const reread = await import('../../js/data/books.js?v=' + Date.now());
const b1 = reread.WORD_BOOKS.find(b => b.level === 'B1');
fs.writeFileSync('_fixb1def.txt', [
  'B1 释义/词性修正',
  '改写 ' + changed + ' / 删除 ' + deleted,
  'B1 词条数 ' + before + ' → ' + after + '（实际导入 ' + (b1 ? b1.words.length : '?') + '）',
  '空洞数（必须 0）' + (b1 ? b1.words.filter(w => !w || !w.es).length : '?'),
  errs.length ? '问题：\n' + errs.join('\n') : '无错误',
].join('\n'), 'utf8');
