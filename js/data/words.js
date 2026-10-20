// ⚠️ 已停用（2026-09-09）—— 全项目不再 import 本文件，因此不会打进 standalone.html。
// 停用原因：这 46 词经核对 100% 已被 js/data/books.js 的等级词书覆盖，0 个独有词；
// 且每个主题只有 6–8 词，撑不起「每日 5/10/15/20/30 词」，曾被迫加「跨主题补足」补丁。
// 学习页现已统一用等级词书（A1 980 词起）。
// 数据保留仅作备份：若日后要做「场景词表」，需要先补到每主题 50+ 词再启用。
// 原：单词学习：主题词表（含音标、词性/阴阳性、例句）
export const WORD_TOPICS = [
  {
    id: 'core', name: 'A1 高频', words: [
      { es: 'hola', ipa: '/ˈo.la/', zh: '你好', pos: 'intj', ex: '¡Hola! ¿Cómo estás?', exZh: '你好！你好吗？' },
      { es: 'gracias', ipa: '/ˈɡɾa.θjas/', zh: '谢谢', pos: 'intj', ex: 'Muchas gracias.', exZh: '非常感谢。' },
      { es: 'casa', ipa: '/ˈka.sa/', zh: '房子', pos: 'n', gender: 'f', ex: 'Mi casa es grande.', exZh: '我的房子很大。' },
      { es: 'libro', ipa: '/ˈli.βɾo/', zh: '书', pos: 'n', gender: 'm', ex: 'Leo un libro.', exZh: '我在读一本书。' },
      { es: 'agua', ipa: '/ˈa.ɣwa/', zh: '水', pos: 'n', gender: 'f', ex: 'Bebo agua fría.', exZh: '我喝冷水。' },
      { es: 'comida', ipa: '/koˈmi.ða/', zh: '食物', pos: 'n', gender: 'f', ex: 'La comida está lista.', exZh: '饭做好了。' },
      { es: 'tiempo', ipa: '/ˈtjem.po/', zh: '时间；天气', pos: 'n', gender: 'm', ex: 'No tengo tiempo.', exZh: '我没有时间。' },
      { es: 'amigo', ipa: '/aˈmi.ɣo/', zh: '朋友', pos: 'n', gender: 'm', ex: 'Él es mi amigo.', exZh: '他是我的朋友。' },
    ]
  },
  {
    id: 'animals', name: '动物', words: [
      { es: 'gato', ipa: '/ˈɡa.to/', zh: '猫', pos: 'n', gender: 'm', ex: 'El gato duerme.', exZh: '猫在睡觉。' },
      { es: 'perro', ipa: '/ˈpe.ro/', zh: '狗', pos: 'n', gender: 'm', ex: 'El perro corre.', exZh: '狗在跑。' },
      { es: 'pájaro', ipa: '/ˈpa.xa.ɾo/', zh: '鸟', pos: 'n', gender: 'm', ex: 'El pájaro canta.', exZh: '鸟在唱歌。' },
      { es: 'caballo', ipa: '/kaˈβa.ʎo/', zh: '马', pos: 'n', gender: 'm', ex: 'El caballo es rápido.', exZh: '马很快。' },
      { es: 'pez', ipa: '/peθ/', zh: '鱼', pos: 'n', gender: 'm', ex: 'El pez nada.', exZh: '鱼在游。' },
      { es: 'vaca', ipa: '/ˈba.ka/', zh: '奶牛', pos: 'n', gender: 'f', ex: 'La vaca come hierba.', exZh: '奶牛在吃草。' },
      { es: 'gallina', ipa: '/ɡaˈʎi.na/', zh: '母鸡', pos: 'n', gender: 'f', ex: 'La gallina pone un huevo.', exZh: '母鸡下了一个蛋。' },
      { es: 'oso', ipa: '/ˈo.so/', zh: '熊', pos: 'n', gender: 'm', ex: 'El oso es grande.', exZh: '熊很大。' },
    ]
  },
  {
    id: 'food', name: '食物', words: [
      { es: 'pan', ipa: '/pan/', zh: '面包', pos: 'n', gender: 'm', ex: 'Compro pan.', exZh: '我买面包。' },
      { es: 'leche', ipa: '/ˈle.tʃe/', zh: '牛奶', pos: 'n', gender: 'f', ex: 'Bebo leche.', exZh: '我喝牛奶。' },
      { es: 'manzana', ipa: '/manˈθa.na/', zh: '苹果', pos: 'n', gender: 'f', ex: 'La manzana es roja.', exZh: '苹果是红色的。' },
      { es: 'arroz', ipa: '/aˈroθ/', zh: '米饭', pos: 'n', gender: 'm', ex: 'Me gusta el arroz.', exZh: '我喜欢米饭。' },
      { es: 'huevo', ipa: '/ˈwe.βo/', zh: '蛋', pos: 'n', gender: 'm', ex: 'Un huevo, por favor.', exZh: '请给我一个蛋。' },
      { es: 'queso', ipa: '/ˈke.so/', zh: '奶酪', pos: 'n', gender: 'm', ex: 'El queso es salado.', exZh: '奶酪是咸的。' },
      { es: 'pollo', ipa: '/ˈpo.ʎo/', zh: '鸡肉', pos: 'n', gender: 'm', ex: 'Como pollo.', exZh: '我吃鸡肉。' },
      { es: 'uva', ipa: '/ˈu.βa/', zh: '葡萄', pos: 'n', gender: 'f', ex: 'La uva es dulce.', exZh: '葡萄很甜。' },
    ]
  },
  {
    id: 'colors', name: '颜色', words: [
      { es: 'rojo', ipa: '/ˈro.xo/', zh: '红色', pos: 'adj', ex: 'El coche es rojo.', exZh: '车是红色的。' },
      { es: 'azul', ipa: '/aˈθul/', zh: '蓝色', pos: 'adj', ex: 'El cielo es azul.', exZh: '天空是蓝色的。' },
      { es: 'amarillo', ipa: '/a.maˈɾi.ʎo/', zh: '黄色', pos: 'adj', ex: 'El sol es amarillo.', exZh: '太阳是黄色的。' },
      { es: 'verde', ipa: '/ˈbeɾ.ðe/', zh: '绿色', pos: 'adj', ex: 'La hierba es verde.', exZh: '草是绿色的。' },
      { es: 'negro', ipa: '/ˈne.ɣɾo/', zh: '黑色', pos: 'adj', ex: 'El gato es negro.', exZh: '猫是黑色的。' },
      { es: 'blanco', ipa: '/ˈblan.ko/', zh: '白色', pos: 'adj', ex: 'La nieve es blanca.', exZh: '雪是白色的。' },
    ]
  },
  {
    id: 'daily', name: '日常', words: [
      { es: 'sol', ipa: '/sol/', zh: '太阳', pos: 'n', gender: 'm', ex: 'Hace sol.', exZh: '出太阳。' },
      { es: 'luna', ipa: '/ˈlu.na/', zh: '月亮', pos: 'n', gender: 'f', ex: 'La luna brilla.', exZh: '月亮在发光。' },
      { es: 'puerta', ipa: '/ˈpweɾ.ta/', zh: '门', pos: 'n', gender: 'f', ex: 'Abre la puerta.', exZh: '打开门。' },
      { es: 'mesa', ipa: '/ˈme.sa/', zh: '桌子', pos: 'n', gender: 'f', ex: 'La mesa es de madera.', exZh: '桌子是木头的。' },
      { es: 'silla', ipa: '/ˈsi.ʎa/', zh: '椅子', pos: 'n', gender: 'f', ex: 'Siéntate en la silla.', exZh: '坐在椅子上。' },
      { es: 'ventana', ipa: '/benˈta.na/', zh: '窗户', pos: 'n', gender: 'f', ex: 'Cierra la ventana.', exZh: '关上窗。' },
      { es: 'cama', ipa: '/ˈka.ma/', zh: '床', pos: 'n', gender: 'f', ex: 'Estoy en la cama.', exZh: '我在床上。' },
      { es: 'reloj', ipa: '/reˈlox/', zh: '钟/表', pos: 'n', gender: 'm', ex: 'El reloj marca las tres.', exZh: '钟指向三点。' },
    ]
  },
  {
    id: 'verbs', name: '常用动词', words: [
      { es: 'ser', ipa: '/seɾ/', zh: '是（本质）', pos: 'v', ex: 'Yo soy estudiante.', exZh: '我是学生。' },
      { es: 'estar', ipa: '/esˈtaɾ/', zh: '在/处于（状态）', pos: 'v', ex: 'Estoy cansado.', exZh: '我累了。' },
      { es: 'tener', ipa: '/teˈneɾ/', zh: '有', pos: 'v', ex: 'Tengo un libro.', exZh: '我有一本书。' },
      { es: 'comer', ipa: '/koˈmeɾ/', zh: '吃', pos: 'v', ex: 'Quiero comer.', exZh: '我想吃饭。' },
      { es: 'beber', ipa: '/beˈβeɾ/', zh: '喝', pos: 'v', ex: 'Voy a beber agua.', exZh: '我要喝水。' },
      { es: 'hablar', ipa: '/aˈβlaɾ/', zh: '说', pos: 'v', ex: 'Hablo español.', exZh: '我说西班牙语。' },
      { es: 'ir', ipa: '/iɾ/', zh: '去', pos: 'v', ex: 'Voy a casa.', exZh: '我回家。' },
      { es: 'hacer', ipa: '/aˈθeɾ/', zh: '做', pos: 'v', ex: '¿Qué haces?', exZh: '你在做什么？' },
    ]
  },
];
