// 修 gustar 例句：必须含不定式 gustar（原句 Me gusta este libro. 只含变位 gusta，完形/点词会失效）
import fs from 'fs';
const FILE = 'D:/vibecoding/site/js/data/books.js';
const from = "ex: 'Me gusta este libro.', exZh: '我喜欢这本书。'";
const to = "ex: 'A todos nos gusta gustar.', exZh: '大家都喜欢被人喜欢。'";
let s = fs.readFileSync(FILE, 'utf8');
if (!s.includes(from)) { fs.writeFileSync('D:/vibecoding/site/_fixgustar.txt', 'NOTFOUND', 'utf8'); process.exit(2); }
s = s.replace(from, to);
fs.writeFileSync(FILE, s, 'utf8');
const reread = fs.readFileSync(FILE, 'utf8').includes(to);
fs.writeFileSync('D:/vibecoding/site/_fixgustar.txt', 'OK includes_new=' + reread, 'utf8');
