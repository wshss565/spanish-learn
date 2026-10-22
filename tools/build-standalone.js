// 把站点打包成一个自包含 HTML（CSS + 全部 JS 内联，无外部请求 / 无 module 依赖）
// 用法: node build-standalone.js
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

async function main() {
  // 1) 打包 JS（IIFE，所有模块内联）
  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, 'js/app.js')],
    bundle: true,
    format: 'iife',
    write: false,
    logLevel: 'info',
    // 让 esbuild 能解析安装在隔离工作区的依赖（如 ts-fsrs）
    nodePaths: [path.join(process.env.APPDATA || '', '..', '.workbuddy', 'binaries', 'node', 'workspace', 'node_modules')]
      .concat(process.platform === 'win32'
        ? ['C:/Users/15040/.workbuddy/binaries/node/workspace/node_modules']
        : []),
  });
  const js = result.outputFiles[0].text;

  // 2) 读取 CSS
  const css = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');

  // 3) 读 index.html 取 body 结构（导航壳层），CSS/JS 内联替换
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  // 4) 错误兜底与启动遮罩已经写在 index.html 里（源码版与构建版共用同一段），
  //    这里不再重复注入，否则会出现两个 #errbox。

  // 5) 组装：保留原 shell 的 header/main/nav 结构，CSS 内联，JS 内联（IIFE）
  // 用「函数替换」而非字符串替换：字符串替换里 $& / $` / $' / $1 会被当成特殊模式展开，
  // 一旦内联的 JS/CSS 里出现这些字面量（如 replace(/x/g, '\\$&')），产物就会被写坏。
  let out = html
    .replace('<link rel="stylesheet" href="css/styles.css">', () => '<style>\n' + css + '\n</style>')
    .replace('<script type="module" src="js/app.js"></script>', () => '<script>\n' + js + '\n</script>');

  const outPath = path.join(ROOT, 'standalone.html');
  fs.writeFileSync(outPath, out, 'utf8');
  console.log('WROTE', outPath, '(' + out.length + ' bytes )');

  // 6) 同步到发布目录 share/（含 PWA：manifest / sw / 图标）
  const share = path.join(ROOT, 'share');
  fs.mkdirSync(share, { recursive: true });
  fs.writeFileSync(path.join(share, 'index.html'), out, 'utf8');
  const pwaFiles = ['manifest.webmanifest', 'sw.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/icon-180.png'];
  for (const f of pwaFiles) {
    const src = path.join(ROOT, f);
    if (!fs.existsSync(src)) { console.warn('  skip missing', f); continue; }
    const dst = path.join(share, f);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
  console.log('SYNCED share/ +', pwaFiles.length, 'PWA files');
}

main().catch(e => { console.error(e); process.exit(1); });
