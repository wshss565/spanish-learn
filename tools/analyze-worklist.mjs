// 解析 X待补例句.txt：① 构成统计 ② 待删除候选清单（只出清单，绝不写盘改数据）。
// 用法：node analyze-worklist.mjs B2
//
// 信号分三档“把握度”，全部是启发式，清单一律需人工过目：
//   高把握：专名名单 / 外文词名单 / 粗俗词 / 明显拼错(名词类)
//   较有把握：将来时 / 过去时3sg / 副动词 / 代词黏着（均带白名单防误伤真实名词）
//   需确认：含 w·k（可能误伤 kilo/kiosco/web 等外借词）、缺重音变位
import fs from 'fs';
import path from 'path';

// 工作单与清单统一在 docs/reports/ 下（与 data-lint.mjs 保持一致）
const REPORTS = path.resolve('docs/reports');
fs.mkdirSync(REPORTS, { recursive: true });
const LEVEL = (process.argv[2] || 'B2').toUpperCase();
const FILE = path.join(REPORTS, LEVEL + '待补例句.txt');
if (!fs.existsSync(FILE)) { console.error('缺少 ' + FILE); process.exit(1); }
const rows = [];
for (const ln of fs.readFileSync(FILE, 'utf8').split(/\r?\n/)) {
  const m = /^NEW\s+(\S+)\s*\|\s*([^|]*?)\s*\|\s*(.*)$/.exec(ln);
  if (m) rows.push({ w: m[1], pos: m[2], zh: m[3] });
}

// —— 信号（已收紧，避免误伤真实名词）——
// —— 用 books.js 里的真实词形做“反查”，避免启发式误伤（cuernos/obreros/modernos/caramelo…）——
const books = (await import('../js/data/books.js?v=' + Date.now())).WORD_BOOKS;
const INF = new Set(); // 全部不定式（含重音）——必须是动词，排除 mar/lugar/taller 这类 -ar/-er/-ir 名词
for (const b of books) for (const w of b.words) if (w.pos === 'v' && /(ar|er|ir)$/.test(w.es)) INF.add(w.es);
const inInf = s => INF.has(s);

// —— 信号（每条都用 INF 反查，命中才算）——
const FUT  = /(é|ás|á|éis|án)$/;
const PRET = /ó$/;
const GER  = /(ando|iendo|yendo)$/;
const CLITS = ['me','te','se','lo','la','le','nos','os','los','las','les'];
const stripAcc = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const isFut = w => FUT.test(w) && inInf(stripAcc(w.replace(/(é|ás|á|éis|án)$/, '')) + '');
const isPret = w => PRET.test(w) && ['ar', 'er', 'ir'].some(e => inInf(stripAcc(w.slice(0, -1)) + e));
function isGer(w) {
  if (!GER.test(w)) return false;
  for (const [suf, inf] of [['ando', 'ar'], ['iendo', 'er'], ['iendo', 'ir'], ['yendo', 'er'], ['yendo', 'ir']])
    if (w.endsWith(suf) && inInf(stripAcc(w.slice(0, -suf.length)) + inf)) return true;
  return false;
}
function isCliticForm(w) {
  // 两个代词只允许「与格 + 宾格」顺序：me/te/se/nos/os + lo/la/los/las（如 dárselo、habérmelo）
  const m2 = w.match(/^(.*?)(me|te|se|nos|os)(lo|la|los|las)$/);
  if (m2 && m2[1].length >= 2 && inInf(stripAcc(m2[1]))) return true;
  const m1 = w.match(/^(.*?)(me|te|se|lo|la|le|nos|os|los|las|les)$/);
  if (m1 && m1[1].length >= 2 && inInf(stripAcc(m1[1]))) return true;
  return false;
}
// 自复动词（vengarse/marcharse/irse…）：去掉 se 是不定式。教学里常作独立词条，不能当垃圾删，
// 单独成「需确认」桶，不要混进"较有把握"。
function isReflexive(w) {
  return /se$/.test(w) && w.length > 4 && inInf(stripAcc(w.slice(0, -2)));
}
const ENG = new Set(['is','so','all','your','white','black','long','may','little','one','rob','walker','stone','hall','bang','island','box','well','ohh','shh','up','dr','kit','jazz','hockey','suite','flash','castle','booth','min','meg','bud','gene','gay','gays','ii','hare','pis','miss','hey','ok','okay','bo','hasta','young','porter','stand']);
const NAME = new Set(['poli','pedro','reyes','angela','dennis','berlín','malcolm','virginia','holly','jonathan','quinn','zoe','elliot','lane','césar','hill','watson','harris','stanley','miguel','pablo','lincoln','liam','travis','raymond','mason','santos','wendy','canadá','penny','gabriel','vietnam','batman','kitty','ford','maya','nelson','earl','isabel','corea','sandy','kent','aaron','debbie','mitch','pierre','daisy','gina','kang','superman','collins','wade','israel','clay','pat','australia','mario','manhattan','kennedy','brooklyn','lawrence','curtis','tokio','vanessa','franklin','halloween','donald','turner','crane','simpson','anderson','angel','brasil','freddie','guerrero','duke','hunter','cameron','sydney','rory','torres','trevor','seattle','jung','troy','alison','cleveland','brooke','drake','kirk','madison','eve','víctor','alexander','suiza','adams','becky','ruby','harvard','georgia','valentín','reed','bell','moscú','shakespeare','wallace','doyle','houston','jesus','cuba','irak','hans','beverly','romeo','alfred','stark','isaac','daphne','sebastian','pierce','lydia','noah','damon','blair','caleb','eeuu','afganistán','escocia','egipto','marte','winston','rocky','tucker','kansas','broadway','monk','buck','sherlock','dwight','stewart']);
const VULG = new Set(['jodida','jodidamente','jodan','jodas','jódete','jodidos','jodido','bastardos','bastardo','maricón','imbéciles','imbécil','putos','puto','puta','cabrones','cabrón','mierda','hostia','coño','polla','verga','pendejo','gilipollas','cretino','capullo','zorra']);
const TYPO_NOUN = new Set(['policia','dificil','quizas','numero','ultima','alle','razon','alla','linea','dolares','aqui','asi','despues','algun','ningun','vamonos','rapido','increible']); // 名词/形容词缺重音（可能应改拼而非删）
const TYPO_VERB = new Set(['sera','queria','deberia','estabamos','fuí','fué','vió','huyo','temia','sufrio','corto','tiro','caso','golpeo']); // 变位缺重音 → 本质是变位

const kinds = ['专名','外文词','粗俗词','拼错(名词类·需确认)','拼错(变位类)','将来时','过去时3sg','副动词','代词黏着','自复动词(需确认)','含 w·k(需确认)'];
const hit = new Map(kinds.map(k => [k, []]));
const ok = [];
function classify(w) {
  if (VULG.has(w)) return '粗俗词';
  if (ENG.has(w))  return '外文词';
  if (NAME.has(w)) return '专名';
  if (TYPO_NOUN.has(w)) return '拼错(名词类·需确认)';
  if (TYPO_VERB.has(w)) return '拼错(变位类)';
  if (isFut(w)) return '将来时';
  if (isReflexive(w)) return '自复动词(需确认)';
  if (isCliticForm(w)) return '代词黏着';
  if (isGer(w)) return '副动词';
  if (isPret(w)) return '过去时3sg';
  if (/[wk]/.test(w)) return '含 w·k(需确认)';
  return null;
}
for (const r of rows) { const k = classify(r.w); if (k) hit.get(k).push(r.w); else ok.push(r.w); }

const HI  = ['专名','外文词','粗俗词'];
const MID = ['将来时','过去时3sg','副动词','代词黏着','拼错(变位类)'];
const CHK = ['拼错(名词类·需确认)','自复动词(需确认)','含 w·k(需确认)'];
const sum = ks => ks.reduce((a, k) => a + hit.get(k).length, 0);
const total = rows.length, hi = sum(HI), mid = sum(MID), chk = sum(CHK);
const removed = hi + mid + chk;

// ① 构成报告
const o = [];
o.push('# ' + LEVEL + ' 待补例句工作单 · 解析（启发式 v2，已收紧判据）');
o.push('');
o.push('- 工作单总条数 **' + total + '**');
o.push('- 高把握非词条 **' + hi + '**（' + (hi / total * 100).toFixed(1) + '%）');
o.push('- 较有把握（变位/黏着）**' + mid + '**（' + (mid / total * 100).toFixed(1) + '%）');
o.push('- 需人工确认（拼错/外借词）**' + chk + '**（' + (chk / total * 100).toFixed(1) + '%）');
o.push('- 合计疑似噪声 **' + removed + '**（' + (removed / total * 100).toFixed(1) + '%）；剩下 **' + ok.length + '** 条待人工判断（仍含噪声）');
o.push('');
o.push('## 位置分布');
o.push('');
{
  const isHit = w => classify(w) !== null;
  const head = rows.slice(0, 500), tail = rows.slice(500);
  const hf = head.filter(r => isHit(r.w)).length, tf = tail.filter(r => isHit(r.w)).length;
  o.push('| 区间 | 条数 | 命中 | 命中率 |');
  o.push('|---|---|---|---|');
  o.push('| 前 500 条 | ' + head.length + ' | ' + hf + ' | **' + (hf / head.length * 100).toFixed(1) + '%** |');
  o.push('| 第 501 条起 | ' + tail.length + ' | ' + tf + ' | ' + (tf / tail.length * 100).toFixed(1) + '% |');
}
o.push('');
o.push('## 分档明细');
o.push('');
o.push('| 类别 | 条数 | 把握 | 示例 |');
o.push('|---|---|---|---|');
for (const k of [...HI, ...MID, ...CHK]) o.push('| ' + k + ' | ' + hit.get(k).length + ' | ' + (HI.includes(k) ? '高' : MID.includes(k) ? '中' : '需确认') + ' | ' + hit.get(k).slice(0, 10).join(', ') + ' |');
fs.writeFileSync(path.join(REPORTS, LEVEL + '工作单解析.md'), o.join('\n') + '\n', 'utf8');

// ② 待删除候选清单（只出清单）
const c = [];
c.push('# ' + LEVEL + ' 待删除候选清单（**未执行**，需人工过目）');
c.push('');
c.push('> 生成自 `analyze-worklist.mjs`，全部为启发式判断。**删前必须逐条确认**，尤其「需确认」档。');
c.push('');
c.push('## 合计');
c.push('');
c.push('- 建议删除（高把握）**' + hi + '** 条');
c.push('- 建议删除（较有把握）**' + mid + '** 条');
c.push('- 需确认 **' + chk + '** 条');
c.push('- 合计 **' + removed + '** 条 / 工作单 ' + total + ' 条');
c.push('');
for (const k of kinds) {
  const arr = hit.get(k);
  if (!arr.length) continue;
  c.push('## ' + k + '（' + arr.length + '）');
  c.push('');
  c.push(arr.join(' '));
  c.push('');
}
fs.writeFileSync(path.join(REPORTS, LEVEL + '待删除清单.md'), c.join('\n') + '\n', 'utf8');
console.log('OK ' + LEVEL + ' total=' + total + ' hi=' + hi + ' mid=' + mid + ' chk=' + chk);
