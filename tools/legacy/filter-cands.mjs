// 从候选清单里筛出「释义不像动词变位注解」的条目 —— 这些最可能是同形名词/形容词（需保留）
import fs from 'fs';
const MARKS = ['我', '你', '您', '他', '她', '它', '们', '已', '正在', '将', '会', '被', '请', '（', '：', '。', '？', '！', '!', '?', '_', '：'];
for (const lv of ['B2', 'C1']) {
  const f = '_' + lv + '_conj_candidates.txt';
  if (!fs.existsSync(f)) continue;
  const lines = fs.readFileSync(f, 'utf8').split('\n').slice(1).filter(l => l.includes('|'));
  const susp = lines.filter(l => {
    const zh = (l.split('|')[2] || '');
    return !MARKS.some(m => zh.includes(m));
  });
  fs.writeFileSync('_susp_' + lv + '.txt', lv + ' 疑似同形词候选 ' + susp.length + ' / 总候选 ' + lines.length + '\n' + susp.join('\n') + '\n', 'utf8');
  console.log(lv, susp.length, '/', lines.length);
}
