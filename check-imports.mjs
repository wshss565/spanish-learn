// 检查源码版的模块图能否被浏览器直接加载。
//   用法：node check-imports.mjs           → 检查本地源码
//         node check-imports.mjs --live <baseUrl> → 顺带检查线上部署
//
// 为什么需要它：源码版要在浏览器里原生跑（GitHub Pages 直接服务仓库根），
// 所以 import 必须全部是相对路径且文件存在。esbuild 构建单文件版时会用
// nodePaths 解析裸模块名，掩盖了这个问题——ts-fsrs 就是这样白屏上线的。
// 这个脚本把"浏览器视角"的约束固定下来。
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('.');
const ENTRY = path.join(ROOT, 'js/app.js');
const problems = [];
const seen = new Set();
const IMPORT_RE = /(?:^|\n)\s*import\s+(?:[\s\S]*?)\s*from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g;

function specifiersOf(code) {
  const out = [];
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(code))) out.push(m[1] || m[2]);
  return out;
}

function walk(file) {
  const key = path.normalize(file);
  if (seen.has(key)) return;
  seen.add(key);
  if (!fs.existsSync(file)) { problems.push('缺少文件: ' + path.relative(ROOT, file)); return; }
  const code = fs.readFileSync(file, 'utf8');
  for (const spec of specifiersOf(code)) {
    if (!spec.startsWith('./') && !spec.startsWith('../')) {
      problems.push('裸模块名（浏览器无法解析）: ' + spec + '  ←  ' + path.relative(ROOT, file));
      continue;
    }
    walk(path.resolve(path.dirname(file), spec));
  }
}

// 1) 从入口走模块图
walk(ENTRY);

// 2) index.html 里的入口脚本必须存在
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const entryRe = /<script[^>]*type="module"[^>]*src="([^"]+)"/g;
let em;
while ((em = entryRe.exec(html))) {
  const p = path.resolve(ROOT, em[1]);
  if (!fs.existsSync(p)) problems.push('index.html 引用的模块入口不存在: ' + em[1]);
}

// 3) 可选：线上巡检
const liveArg = process.argv.indexOf('--live');
if (liveArg > -1 && process.argv[liveArg + 1]) {
  const base = process.argv[liveArg + 1].replace(/\/+$/, '');
  const queue = ['/index.html'];
  const visited = new Set();
  const fetchText = async (u) => {
    const r = await fetch(u);
    return { status: r.status, text: await r.text() };
  };
  (async () => {
    while (queue.length) {
      const u = queue.shift();
      if (visited.has(u)) continue;
      visited.add(u);
      let res;
      try { res = await fetchText(base + u); }
      catch (e) { problems.push('线上请求失败: ' + u + ' ' + e.message); continue; }
      if (res.status !== 200) { problems.push('线上 404/错误: ' + u + ' => ' + res.status); continue; }
      if (!u.endsWith('.js')) continue;
      for (const spec of specifiersOf(res.text)) {
        if (!spec.startsWith('./') && !spec.startsWith('../')) {
          problems.push('线上仍有裸模块名: ' + spec + '  ←  ' + u);
          continue;
        }
        queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(u), spec)));
      }
    }
    report('线上');
  })();
} else {
  report('本地');
}

function report(scope) {
  const lines = [];
  lines.push('== check-imports (' + scope + ') ==');
  lines.push('模块文件数: ' + seen.size);
  if (problems.length) {
    lines.push('问题 ' + problems.length + ' 处:');
    for (const p of problems) lines.push('  ✗ ' + p);
  } else {
    lines.push('✓ 全部 import 均为相对路径且文件存在');
  }
  const out = lines.join('\n');
  fs.writeFileSync('_check_imports.txt', out, 'utf8');
  console.log(out);
  process.exitCode = problems.length ? 1 : 0;
}