// 内容数据：音标课、示例读物（A1 公版短篇）、辨音对、测评兜底词
export const PHONETICS = [
  {
    section: '元音（5 个，西语元音纯净固定）',
    items: [
      { sym: 'a', word: 'casa', ipa: '/kasa/', zh: '开口大，类似中文"啊"', tip: '西语 a 永远发"阿"，不因位置变音。' },
      { sym: 'e', word: 'mesa', ipa: '/mesa/', zh: '介于"唉"和"诶"，嘴角展开', tip: '比中文"饿"更靠前、更紧。' },
      { sym: 'i', word: 'libro', ipa: '/liβɾo/', zh: '类似"衣"，短促', tip: '不要拖长。' },
      { sym: 'o', word: 'rojo', ipa: '/roχo/', zh: '类似"哦"，圆唇', tip: '张口度比 a 小。' },
      { sym: 'u', word: 'luna', ipa: '/luna/', zh: '类似"乌"，圆唇', tip: '与 o 区分在唇形更圆更紧。' },
    ]
  },
  {
    section: '辅音（重点几个）',
    items: [
      { sym: 'p / t / k', word: 'papá / tipo / casa', ipa: '', zh: '清塞音，不送气', tip: '别像英语加一股气（如汉语"怕"的送气要去掉）。' },
      { sym: 'b / v', word: 'vaca / blanco', ipa: '', zh: '浊音，轻', tip: '词中常弱化为近"w"；不必死磕。' },
      { sym: 'r（单击）', word: 'pero', ipa: '/peɾo/', zh: '词中/词尾轻弹一下', tip: '与 rr 区别：r 弹 1 下，rr 弹多下。' },
      { sym: 's / m / n / l', word: 'sol / mal', ipa: '', zh: '与中文相近', tip: '直接按中文习惯读即可。' },
    ]
  },
  {
    section: '特殊音（西语特色，重点练）',
    items: [
      { sym: 'rr（大舌音）', word: 'perro', ipa: '/ˈpe.ro/', zh: '舌尖抵上颚快速颤动', tip: '西语第一难点。练法：含水仰头"嘟噜"，或先练 tr/dr 带动舌头。' },
      { sym: 'ñ', word: 'niño', ipa: '/ˈni.ɲo/', zh: '类似"ny"（捏）', tip: '区别于 n，舌面抬向硬腭。' },
      { sym: 'll', word: 'llave', ipa: '/ˈʎa.βe/', zh: '多数地区发"y"（yeísmo）', tip: '现代口语常与 y 同音。' },
      { sym: 'ch', word: 'leche', ipa: '/ˈle.tʃe/', zh: '像"七"', tip: '清塞擦音。' },
      { sym: 'j / h', word: 'jardín', ipa: '/xaɾˈðin/', zh: 'j 像"喝"，h 不发音', tip: 'j 是舌根摩擦（似汉语 h）；h 永远不读。' },
    ]
  },
  {
    section: '重音与音节',
    items: [
      { sym: '重音规则', word: '', ipa: '', zh: '以元音 / n / s 结尾→重音在倒数第二音节；否则在最后', tip: '有重音符号（á/é/í/ó/ú）时以符号为准。' },
      { sym: '音节划分', word: 'pe-rro', ipa: '', zh: '按"辅音+元音"切分', tip: 'rr / ch / ll 当作一个辅音单位。' },
    ]
  }
];

// 辨音小测：最小对立对（听音选词）
export const MINIMAL_PAIRS = [
  ['pero', 'perro'],
  ['casa', 'caza'],
  ['pelo', 'pero'],
  ['tu', 'tú'],
];

// 示例读物（A1 公版风格短篇，附句译与词表）
export const BOOK = {
  title: '示例读物：小猫的一天（A1）',
  level: 'A1',
  sentences: [
    { es: 'El gato es pequeño.', zh: '这只猫很小。' },
    { es: 'El gato come pescado.', zh: '猫吃鱼。' },
    { es: 'La casa es roja.', zh: '房子是红色的。' },
    { es: 'Mi madre lee un libro.', zh: '我的妈妈在读一本书。' },
    { es: 'El perro corre en el jardín.', zh: '狗在花园里跑。' },
    { es: 'Yo hablo español con mi amigo.', zh: '我和朋友说西班牙语。' },
    { es: 'El sol es amarillo y caliente.', zh: '太阳是黄色且炎热的。' },
    { es: 'Nosotros bebemos agua fría.', zh: '我们喝冷水。' },
    { es: 'La niña abre la puerta.', zh: '女孩打开门。' },
    { es: 'El pájaro canta una canción.', zh: '鸟唱一首歌。' },
  ],
  glossary: {
    'el': { zh: '（定冠词·阳）', pos: 'art' }, 'la': { zh: '（定冠词·阴）', pos: 'art' },
    'un': { zh: '（不定冠词·阳）', pos: 'art' }, 'una': { zh: '（不定冠词·阴）', pos: 'art' },
    'es': { zh: '是', pos: 'v' }, 'pequeño': { zh: '小的', pos: 'adj' }, 'gato': { zh: '猫', pos: 'n', gender: 'm' },
    'come': { zh: '吃', pos: 'v' }, 'pescado': { zh: '鱼', pos: 'n', gender: 'm' },
    'casa': { zh: '房子', pos: 'n', gender: 'f' }, 'roja': { zh: '红色的', pos: 'adj' },
    'mi': { zh: '我的', pos: 'pron' }, 'madre': { zh: '母亲', pos: 'n', gender: 'f' },
    'lee': { zh: '阅读', pos: 'v' }, 'libro': { zh: '书', pos: 'n', gender: 'm' },
    'perro': { zh: '狗', pos: 'n', gender: 'm' }, 'corre': { zh: '跑', pos: 'v' },
    'en': { zh: '在', pos: 'prep' }, 'jardín': { zh: '花园', pos: 'n', gender: 'm' },
    'yo': { zh: '我', pos: 'pron' }, 'hablo': { zh: '说', pos: 'v' },
    'español': { zh: '西班牙语的', pos: 'adj' }, 'con': { zh: '和', pos: 'prep' },
    'amigo': { zh: '朋友', pos: 'n', gender: 'm' }, 'sol': { zh: '太阳', pos: 'n', gender: 'm' },
    'amarillo': { zh: '黄色的', pos: 'adj' }, 'y': { zh: '和', pos: 'conj' },
    'caliente': { zh: '热的', pos: 'adj' }, 'nosotros': { zh: '我们', pos: 'pron' },
    'bebemos': { zh: '喝', pos: 'v' }, 'agua': { zh: '水', pos: 'n', gender: 'f' },
    'fría': { zh: '冷的', pos: 'adj' }, 'niña': { zh: '女孩', pos: 'n', gender: 'f' },
    'abre': { zh: '打开', pos: 'v' }, 'puerta': { zh: '门', pos: 'n', gender: 'f' },
    'pájaro': { zh: '鸟', pos: 'n', gender: 'm' }, 'canta': { zh: '唱', pos: 'v' },
    'canción': { zh: '歌', pos: 'n', gender: 'f' },
  }
};

// 若用户未读书直接测评，用这套兜底词保证可演示
export const DEMO_WORDS = [
  { word: 'gato', zh: '猫', pos: 'n' }, { word: 'perro', zh: '狗', pos: 'n' },
  { word: 'casa', zh: '房子', pos: 'n' }, { word: 'libro', zh: '书', pos: 'n' },
  { word: 'agua', zh: '水', pos: 'n' }, { word: 'madre', zh: '母亲', pos: 'n' },
  { word: 'amigo', zh: '朋友', pos: 'n' }, { word: 'sol', zh: '太阳', pos: 'n' },
  { word: 'puerta', zh: '门', pos: 'n' }, { word: 'pájaro', zh: '鸟', pos: 'n' },
];
