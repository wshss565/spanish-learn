// B2/C1 释义净化：繁体→简体、去尾标点（。：？）、去前导编号/引号、折叠空格。
// 只做**安全的机械清理**；数字型/语义错误的释义留给人工表（本轮不动）。
// 护栏：全文件计数守恒 + 写盘后 import。
import fs from 'fs';
const FILE = 'js/data/books.js';
const T = '氣戰長說識險讀語誰銀數頁館藥療興會軍貝視覺藝親電執話獎針蟲時監節聽門島隊現鐵窮計惡鏈總錢聲髮記腦鏡問郵輪財產維禮職試畫線網兒誠實號預風護種詞藍調觀頰詳舉馬較遠場頂談書農籃紀歡裝東詩賽縮龍櫃靜議斷敵訂費懷舊強貴間設過乾選類貓見從盤軟顯責鳥確證輸編轉論顏戶達與級織圖該隱資飛礙寫項決臉態響';
const S = '气战长说识险读语谁银数页馆药疗兴会军贝视觉艺亲电执话奖针虫时监节听门岛队现铁穷计恶链总钱声发记脑镜问邮轮财产维礼职试画线网儿诚实号预风护种词蓝调观颊详举马较远场顶谈书农篮纪欢装东诗赛缩龙柜静议断敌订费怀旧强贵间设过干选类猫见从盘软显责鸟确证输编转论颜户达与级织图该隐资飞碍写项决脸态响';
const MAP = {};
for (let i = 0; i < T.length; i++) MAP[T[i]] = S[i];
if (T.length !== S.length) { fs.writeFileSync('_defhygiene.txt', 'ERR 映射长度不一致 ' + T.length + '/' + S.length + '\n', 'utf8'); process.exit(1); }

const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, c => '\\' + c);
const countAll = t => (t.match(/\{\s*es:\s*'/g) || []).length;
const conv = s => [...s].map(c => MAP[c] || c).join('');
function clean(zh) {
  let z = zh;
  z = conv(z);
  z = z.replace(/&#\d+;?/g, '').replace(/&[a-z]+;/gi, ' ');
  z = z.replace(/^[\s"'“”‘’「」【】]+/, '').replace(/^[（(]\s*\d+\s*[）)]\s*/, '');
  z = z.replace(/^(\d+\s*[\.、）)\]]\s*)+/, '');
  z = z.replace(/[\s"'“”‘’]+$/, '');
  z = z.replace(/[。：？!；，、]+$/, '');
  z = z.replace(/\s{2,}/g, ' ').trim();
  return z;
}

const src = fs.readFileSync(FILE, 'utf8');
const marks = []; const re = /level:\s*'([A-Z][0-9])'/g; let m;
while ((m = re.exec(src))) marks.push({ lv: m[1], at: m.index });
let out = src; const log = []; const errs = [];
for (const lv of ['B2', 'C1']) {
  const mk = []; const r2 = /level:\s*'([A-Z][0-9])'/g; let m2;
  while ((m2 = r2.exec(out))) mk.push({ lv: m2[1], at: m2.index });
  const i = mk.findIndex(x => x.lv === lv);
  const start = mk[i].at, end = i + 1 < mk.length ? mk[i + 1].at : out.length;
  const seg0 = out.slice(start, end);
  const beforeAll = countAll(out), beforeLv = countAll(seg0);
  let changed = 0, touched = 0;
  const reE = /\{\s*es:\s*'((?:[^'\\]|\\.)*)'([^}]*)\}/g;
  const seg = seg0.replace(reE, (full, es, body) => {
    const mz = body.match(/\bzh:\s*'((?:[^'\\]|\\.)*)'/);
    if (!mz) return full;
    const nz = clean(mz[1]);
    if (!nz || nz === mz[1]) return full;
    touched++; if (nz !== mz[1]) changed++;
    return "{ es: '" + es + "'" + body.replace(/\bzh:\s*'(?:[^'\\]|\\.)*'/, "zh: '" + nz + "'") + " }";
  });
  const cand = out.slice(0, start) + seg + out.slice(end);
  const afterAll = countAll(cand), afterLv = countAll(seg);
  if (beforeLv !== afterLv || beforeAll !== afterAll) { errs.push(lv + ' 守恒校验失败，跳过'); continue; }
  out = cand;
  log.push(lv + ' 释义净化 ' + changed + ' 条 / 等级 ' + beforeLv + ' → ' + afterLv);
}
fs.writeFileSync(FILE, out, 'utf8');
let ok = true, err = '';
try { await import('./js/data/books.js?v=' + Date.now()); }
catch (e) { ok = false; err = String(e && (e.message || e)); fs.writeFileSync(FILE, src, 'utf8'); }
fs.writeFileSync('_defhygiene.txt', [...log, ok ? 'import 校验：通过' : 'import 校验：失败，已回滚 ' + err,
  errs.length ? '问题：\n' + errs.join('\n') : '无问题'].join('\n') + '\n', 'utf8');
