// 从 B2 / C1 词书里筛出「非西班牙语词汇」：专名 / 英文词 / 拼写错误 / 命令式+代词 / 粗俗词。
// 只输出清单供人工核对，不落盘。
import fs from 'fs';
const src = fs.readFileSync('js/data/books.js', 'utf8');
const marks = []; const re = /level:\s*'([A-Z][0-9])'/g; let m;
while ((m = re.exec(src))) marks.push({ lv: m[1], at: m.index });
const segOf = lv => { const i = marks.findIndex(x => x.lv === lv); return i < 0 ? '' : src.slice(marks[i].at, marks[i + 1] ? marks[i + 1].at : src.length); };

const NAMES = new Set(('alan albert alex alice amy andrew anna anne anthony arthur barbara ben beth betty bill bob brian bruce carl carlos carol catherine charlie chris christopher claire clark daniel dave david deborah diana dick donna dorothy edward elizabeth emma eric frank fred george gordon greg harry harvey helen henry howard jack jacob jake james jane jason jean jeff jenny jessica jim joe john johnny johnson jones jordan jose joseph josh juan julia julie justin karen kate katherine kevin laura leo lewis linda lisa louis lucas lucy luis luke margaret maria mark martin mary matt max megan michael michelle mike miller morgan nancy nate nick nicole oliver oscar patrick paul peter philip rachel ralph rebecca richard rick robert roger ronald rose ross ruth ryan sally sam samuel sandra sara sarah scott sharon simon smith sophie stephen steve sue susan taylor teddy terry thomas tim tom tony victor vincent vince walter wayne william wilson jesucristo jesús cristo jacob abby anna eva adan abraham moisés david samuel josé ramón carmen lucía diego javier álvaro sergio raúl andrés álvaro').split(/\s+/).filter(Boolean));
const PLACES = new Set(('florida miami texas vegas chicago boston hollywood londres parís roma europa américa inglaterra china india méxico italia alemania rusia japón áfrica españa jersey jersey').split(/\s+/).filter(Boolean));
const ENGLISH = new Set(('that this the street web west east north south team ok okay hey hello hi bye please thanks thank sorry yes no love like want need know think go come get make take see look say tell give find work play live feel try leave call night day time year way man woman boy girl life world hand part place case week company system program question government number point home water room mother father friend area money story fact month lot right study book eye job word business issue side kind head house service power hour game line end member law car city community name president minute idea kid body information back parent face level office door health person art war history party result change morning reason research guy moment air teacher force education foot age policy process music market sense nation plan college interest death experience effect use class control care field development role effort rate heart drug show leader light voice wife police mind price report decision son view relationship town road arm difference value building action model season society tax director position player record paper space ground form event official matter center couple site project activity star table court oil situation cost industry figure image phone data picture practice piece land product doctor wall patient worker news test movie personal simply third technology catch step baby computer type attention draw film tree source red nearly organization choose cause hair century evidence window difficult listen soon culture billion chance brother energy period course summer less realize hundred available plant likely opportunity term short letter condition choice single rule daughter administration husband congress floor campaign material population economy medical hospital church close thousand risk current fire future wrong involve defense anyone increase security bank myself certainly sport board seek subject officer private rest behavior deal performance fight throw top quickly past goal second bed order author fill represent focus foreign drop blood upon agency push nature color recently store reduce sound note fine near movement page enter share than common poor natural race concern series significant similar hot language usually response dead rise animal factor decade article shoot save seven artist away scene stock career despite central eight thus treatment beyond happy exactly protect approach lie size dog fund serious occur media ready sign thought list individual simple quality pressure accept answer resource identify left meeting determine prepare disease whatever success argue cup particularly amount ability staff recognize indicate character growth loss degree wonder attack herself region television box training pretty trade election everybody physical lay general feeling standard bill message fail outside arrive analysis benefit sex forward lawyer present section environmental glass skill sister professor operation financial crime stage compare authority miss design sort act ten knowledge gun station blue state strategy clearly discuss indeed truth song example democratic check environment leg dark various rather laugh guess executive set prove hang entire rock forget claim remove manager enjoy network legal religious cold final main science green memory card above seat cell establish nice trial expert spring firm radio visit management avoid imagine tonight huge ball finish yourself theory impact respond statement maintain charge popular traditional onto reveal direction weapon employee cultural contain peace base hurt').split(/\s+/).filter(Boolean));
const VULGAR = new Set(('putas puta porno coño joder mierda cabrón zorra perra gilipollas cojones tetas pene polla verga culo cagar mierdas hostia jodido marica pito chingar chingada puto vergas').split(/\s+/).filter(Boolean));

const strip = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const infSet = new Set();
for (const lv of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
  const t = segOf(lv); let mm; const reE = /\{\s*es:\s*'((?:[^'\\]|\\.)*)'([^}]*)\}/g;
  while ((mm = reE.exec(t))) { const b = mm[2]; if ((b.match(/\bpos:\s*'([^']*)'/) || [])[1] === 'v' && /(ar|er|ir)$/.test(mm[1]) && mm[1].length >= 2) infSet.add(strip(mm[1])); }
}
const CLITICS = ['me', 'te', 'se', 'nos', 'os', 'lo', 'la', 'le', 'los', 'las', 'les'];
function imperClitic(es) {
  if (es.endsWith('rse')) return false;
  const low = strip(es);
  for (const c of CLITICS) {
    if (low.endsWith(c) && low.length > c.length + 2) {
      const b = low.slice(0, -c.length);
      if (!/[ae]$/.test(b)) continue;
      const stem = b.slice(0, -1);
      if (infSet.has(stem + 'ar') || infSet.has(stem + 'er') || infSet.has(stem + 'ir')) return true;
    }
  }
  return false;
}

const out = { B2: [], C1: [] };
for (const lv of ['B2', 'C1']) {
  const t = segOf(lv); const reE = /\{\s*es:\s*'((?:[^'\\]|\\.)*)'([^}]*)\}/g; let mm;
  while ((mm = reE.exec(t))) {
    const es = mm[1], b = mm[2];
    const zh = (b.match(/\bzh:\s*'((?:[^'\\]|\\.)*)'/) || [])[1] || '';
    const pos = (b.match(/\bpos:\s*'([^']*)'/) || [])[1] || '';
    let why = '';
    if (NAMES.has(es)) why = '人名';
    else if (PLACES.has(es)) why = '地名';
    else if (ENGLISH.has(es)) why = '英文词';
    else if (VULGAR.has(es)) why = '粗俗词';
    else if (imperClitic(es)) why = '命令式+代词';
    if (why) out[lv].push(es + ' | ' + pos + ' | ' + zh + ' | ' + why);
  }
}
try {
for (const lv of ['B2', 'C1']) {
  fs.writeFileSync('_nonword_' + lv + '.txt', lv + ' 非词条候选 ' + out[lv].length + '\n' + out[lv].join('\n') + '\n', 'utf8');
  console.log(lv, out[lv].length);
}
} catch (e) { fs.writeFileSync('_flag_err.txt', String(e && (e.stack || e)), 'utf8'); }
