// 串行跑 build / css-lint / smoke，把输出（含 exit code）写文件，避开 PowerShell 编码坑
import { spawnSync } from 'child_process';
import fs from 'fs';
const NODE = 'C:/Users/15040/.workbuddy/binaries/node/versions/22.22.2-3/node.exe';
const NP = 'C:/Users/15040/.workbuddy/binaries/node/workspace/node_modules';
const CWD = 'D:/vibecoding/site';
function run(script) {
  const r = spawnSync(NODE, [script], { env: { ...process.env, NODE_PATH: NP }, cwd: CWD });
  const out = (r.stdout ? r.stdout.toString('utf8') : '') + (r.stderr ? r.stderr.toString('utf8') : '');
  return out + '\n[exit ' + (r.status == null ? r.signal : r.status) + ']\n';
}
let out = '';
out += '=== build-standalone ===\n' + run('build-standalone.js');
out += '=== css-lint ===\n' + run('css-lint.js');
out += '=== smoke ===\n' + run('smoke.js');
fs.writeFileSync('D:/vibecoding/site/_pipeline.txt', out, 'utf8');
