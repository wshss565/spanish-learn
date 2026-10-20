// 在 Node 里用 jsdom 提供 DOM，按浏览器的原生 ESM 语义真实加载源码版入口。
// 用途：抓"源码版在浏览器里起不来"这类问题——打包后的单文件版测不出来（esbuild 改变了模块语义）。
//   用法：node check-boot.mjs
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');

const ROOT = path.resolve('.');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const dom = new JSDOM(html, {
  url: 'https://wshss565.github.io/spanish-learn/',
  pretendToBeVisual: true,
  runScripts: 'dangerously',   // 让 index.html 里的内联脚本（错误兜底 / 启动遮罩）真的执行
});

const w = dom.window;
Object.defineProperty(globalThis, 'window', { value: w, configurable: true, writable: true });
// 把 jsdom 窗口的属性整体搬进 Node 全局（Node 22 的 navigator 是只读 getter，要 defineProperty）
const SKIP = new Set(['window', 'self', 'globalThis', 'top', 'parent', 'frames', 'opener', 'closed']);
for (const k of Object.getOwnPropertyNames(w)) {
  if (SKIP.has(k)) continue;
  if (k in globalThis && k !== 'navigator' && k !== 'crypto' && k !== 'fetch') continue;
  try {
    const d = Object.getOwnPropertyDescriptor(w, k);
    if (!d) continue;
    Object.defineProperty(globalThis, k, { get: () => w[k], configurable: true });
  } catch (e) { /* 不可复制的忽略 */ }
}
if (typeof globalThis.matchMedia !== 'function') {
  globalThis.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
}
if (typeof globalThis.requestAnimationFrame !== 'function') {
  globalThis.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 16);
  globalThis.cancelAnimationFrame = id => clearTimeout(id);
}

const out = [];
let ok = false;
try {
  const t0 = Date.now();
  const mod = await import('./js/app.js?v=' + Date.now());
  const tApp = Date.now() - t0;
  ok = true;
  out.push('✓ js/app.js 模块图求值成功');
  out.push('  模块图求值耗时: ' + tApp + ' ms（含解析 2.3MB books.js + 建 3.3 万词索引 + 首次渲染）');
  const t1 = Date.now();
  await import('./js/data/books.js?v=' + Date.now());
  out.push('  其中 books.js 单独求值: ' + (Date.now() - t1) + ' ms');
  // 看看 #view / #bottomNav 有没有被填充
  const view = w.document.querySelector('#view');
  const nav = w.document.querySelector('#bottomNav');
  out.push('  #view 内容长度: ' + (view ? view.innerHTML.length : 'N/A'));
  out.push('  #bottomNav 内容长度: ' + (nav ? nav.innerHTML.length : 'N/A'));
  out.push('  #rail 内容长度: ' + ((w.document.querySelector('#rail') || {}).innerHTML || '').length);
  // 启动遮罩应已在渲染完成后移除（遮罩有 260ms 的淡出动画，这里等够）
  await new Promise(r => setTimeout(r, 400));
  const boot = w.document.querySelector('#boot');
  out.push('  启动遮罩: ' + (boot ? '仍在（class=' + (boot.className || '无') + '）' : '已移除 ✓'));
  out.push('  导出: ' + Object.keys(mod).join(', '));
} catch (e) {
  out.push('✗ 模块求值抛错: ' + (e && e.message));
  out.push((e && e.stack ? String(e.stack).split('\n').slice(0, 8).join('\n') : ''));
}
const txt = out.join('\n');
fs.writeFileSync('_check_boot.txt', txt, 'utf8');
console.log(txt);
// jsdom 的 visual 模式会一直持有 rAF 定时器，事件循环不退出 → 必须显式收尾，
// 否则这个脚本会把后续命令一起卡死（曾导致 build/smoke 根本没跑，产物是旧的）。
try { dom.window.close(); } catch (e) { /* ignore */ }
process.exit(ok ? 0 : 1);