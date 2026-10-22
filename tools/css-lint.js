// CSS 静态检查：找出「被后续基类反超」的死声明。
//
// 背景：本文件里媒体查询不改变特异性，同特异度靠「后出现」胜出。所以
// 若某断点（@media (max-width:899px) / (min-width:1240px)）内写了某选择器的某属性，
// 而同一选择器 + 同一属性在文件更靠后的顶层规则里又出现一次，则该断点声明**永远不生效**。
//
// 这类死规则在本项目已咬过两次：
//   1) @media (min-width:1240px){ .cw{display:none} } 被后面的 .cw{display:flex} 反超
//      → 宽屏下右栏时长卡与右下角气泡同时出现
//   2) @media (max-width:899px){ .rate{padding:0 4px} } 被后面的 .rate{padding:12px 8px} 反超
//      → 三档评级按钮的手机端收窄从未生效
//
// 用法：node css-lint.js      （读取 css/styles.css；无问题时 exit 0）
//
// 两个实现细节（都踩过）：
//   - 媒体块的选择器前缀常带注释，必须先剥注释再比较，否则选择器字符串对不上、全部漏判
//   - 位置必须用 r.bodyStart + inner.start（bodyStart 是 `{` 之后的下标）

const fs = require('fs');
const path = require('path');

const file = process.argv[2] || path.join(__dirname, '../css/styles.css');
let css;
try {
  css = fs.readFileSync(file, 'utf8');
} catch (e) {
  console.error('读不到 ' + file + '：' + e.message);
  process.exit(2);
}

const BREAKPOINTS = [/@media \(max-width:899px\)/, /@media \(min-width:1240px\)/];

function splitRules(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const start = i;
    let j = i;
    while (j < src.length && src[j] !== '{' && src[j] !== ';') j++;
    if (j >= src.length) break;
    if (src[j] === ';') { i = j + 1; continue; }
    const prelude = src.slice(start, j).replace(/\/\*[\s\S]*?\*\//g, '').trim();
    let k = j + 1, d = 1;
    while (k < src.length && d > 0) { if (src[k] === '{') d++; else if (src[k] === '}') d--; k++; }
    out.push({ prelude, bodyStart: j + 1, body: src.slice(j + 1, k - 1), start, end: k });
    i = k;
  }
  return out;
}
const propsOf = body => body.split(';').map(s => s.split(':')[0].trim().toLowerCase()).filter(Boolean);

const decls = [];
let bpBlocks = 0;

splitRules(css).forEach(r => {
  const isBp = r.prelude.startsWith('@') && BREAKPOINTS.some(re => re.test(r.prelude));
  if (isBp) {
    bpBlocks++;
    splitRules(r.body).forEach(inner => {
      propsOf(inner.body).forEach(p => decls.push({
        sel: inner.prelude, prop: p, pos: r.bodyStart + inner.start, bp: true, at: r.prelude,
      }));
    });
  } else if (!r.prelude.startsWith('@')) {
    propsOf(r.body).forEach(p => decls.push({ sel: r.prelude, prop: p, pos: r.start, bp: false }));
  }
});

const lineOf = p => css.slice(0, p).split('\n').length;
const seen = new Set();
const dead = [];
decls.filter(d => d.bp).forEach(d => {
  const key = d.sel + '|' + d.prop;
  if (seen.has(key)) return;
  const later = decls.find(x => !x.bp && x.sel === d.sel && x.prop === d.prop && x.pos > d.pos);
  if (later) { seen.add(key); dead.push({ ...d, killedAt: later.pos }); }
});

const inBp = decls.filter(d => d.bp).length;
console.log('检查 ' + file);
console.log('  断点块 ' + bpBlocks + ' 个 / 断点内声明 ' + inBp + ' 条 / 顶层声明 ' + decls.filter(d => !d.bp).length + ' 条');
if (!dead.length) {
  console.log('  未发现被后续基类反超的死声明 ✓');
  process.exit(0);
}
console.log('  发现 ' + dead.length + ' 条失效声明（写了但不生效）:');
dead.forEach(d => console.log(
  '    [' + d.sel + '] ' + d.prop + '  ' + d.at + '  L' + lineOf(d.pos) + '  → 被 L' + lineOf(d.killedAt) + ' 的顶层规则反超'
));
process.exit(1);
