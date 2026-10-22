// 修 A2 的 5 条「例句用变位、不含不定式」的动词例句（完形/点词会失效）
import fs from 'fs';
const FILE = 'D:/vibecoding/site/js/data/books.js';
let s = fs.readFileSync(FILE, 'utf8');
const map = [
  ["ex: 'Pago con tarjeta.', exZh: '我用卡支付。'", "ex: 'Quiero pagar con tarjeta.', exZh: '我想用卡支付。'"],
  ["ex: 'Duermo ocho horas.', exZh: '我睡八小时。'", "ex: 'Necesito dormir ocho horas.', exZh: '我需要睡八小时。'"],
  ["ex: 'Me despierto temprano.', exZh: '我醒得很早。'", "ex: 'Es importante despertarse temprano.', exZh: '早起很重要。'"],
  ["ex: 'Te ayudo con eso.', exZh: '这件事我帮你。'", "ex: 'Voy a ayudar a mi madre.', exZh: '我要帮我的妈妈。'"],
  ["ex: 'No encuentro mis llaves.', exZh: '我找不到钥匙。'", "ex: 'Espero encontrar mis llaves.', exZh: '希望找到我的钥匙。'"],
];
const log = [];
for (const [from, to] of map) {
  if (!s.includes(from)) { log.push('NOTFOUND: ' + from); continue; }
  s = s.replace(from, to);
  log.push('OK: ' + to);
}
fs.writeFileSync(FILE, s, 'utf8');
const re = fs.readFileSync(FILE, 'utf8');
const checks = [
  "ex: 'Quiero pagar con tarjeta.'",
  "ex: 'Necesito dormir ocho horas.'",
  "ex: 'Es importante despertarse temprano.'",
  "ex: 'Voy a ayudar a mi madre.'",
  "ex: 'Espero encontrar mis llaves.'",
];
log.push('VERIFY=' + checks.every(c => re.includes(c)));
fs.writeFileSync('D:/vibecoding/site/_fixa2.txt', log.join('\n'), 'utf8');
