// 西语「正字法 → 国际音标」规则化生成
// 说明：西语拼写与读音高度对应，可以按规则推导。生成结果用于给没有手写音标的词兜底，
// 手写的 w.ipa 永远优先。风格对齐现有数据：/.../ 包裹、音节用 . 分隔、ˈ 标重音、
// 拉美 seseo（c/z 在 e,i 前读 s）、并体现 β/ð/ɣ 等元音间的弱化音。

const STRONG = 'aeoáéó';
const WEAK = 'iuíúü';
const VOWELS = STRONG + WEAK;
const ACC = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u' };
// 「浊塞音 + l/r」这类可整体作声母的复辅音
const CLUSTER = ['bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr', 'tl', 'tr'];

function isV(ch) { return !!ch && VOWELS.indexOf(ch) >= 0; }
function isStrong(ch) { return !!ch && STRONG.indexOf(ch) >= 0; }
function oneOf(ch, set) { return !!ch && set.indexOf(ch) >= 0; }

// 把词切成书写音节（够用即可，不追求 100% 语言学严谨）
function syllabify(word) {
  const w = word.toLowerCase().replace(/[^a-záéíóúñü ]/g, '');
  const n = w.length;
  // 1) 先找元音核（连续元音里，强强相邻要断开；强弱/弱强/弱弱合并成 diphthong）
  const nuclei = [];
  let i = 0;
  while (i < n) {
    if (!isV(w[i])) { i++; continue; }
    let j = i;
    while (j + 1 < n && isV(w[j + 1])) {
      const a = w[j], b = w[j + 1];
      const accentedBreak = /[íú]/.test(b);      // 弱元音带重音 → 断开（如 día）
      if ((isStrong(a) && isStrong(b)) || accentedBreak) break;
      j++;
      if (j - i >= 1 && (isStrong(w[j]) || isStrong(w[j - 1]))) {
        // 强弱 / 弱强 成 diphthong 后结束
        if (j + 1 < n && isV(w[j + 1]) && !isStrong(w[j]) && !isStrong(w[j + 1])) j++; // iu/ui
        break;
      }
    }
    nuclei.push([i, j]);
    i = j + 1;
  }
  if (!nuclei.length) return [w];

  // 2) 把辅音分配到音节：优先让「辅音+辅音」里的合法复辅音留在一起做声母
  const cuts = [];   // 每个元音核之前的音节起点
  for (let k = 0; k < nuclei.length; k++) {
    const [vs, ve] = nuclei[k];
    if (k === 0) { cuts.push(0); continue; }
    const prevEnd = nuclei[k - 1][1];
    let cons = w.slice(prevEnd + 1, vs);
    // split = 留在前一个音节做韵尾的辅音个数（其余给后一个音节做声母）
    let split = 0;
    if (cons.length >= 2) {
      const last2 = cons.slice(-2);
      split = (CLUSTER.indexOf(last2) >= 0) ? cons.length - 2 : cons.length - 1;
    }
    let cut = prevEnd + 1 + split;
    // ll / rr / ch 是不可拆的二合字母，别把它们切到两个音节里（billete → bi.lle.te）
    const pair = w.slice(cut - 1, cut + 1);
    if (pair === 'll' || pair === 'rr' || pair === 'ch') cut -= 1;
    cuts.push(cut);
  }
  // 3) 组音节
  const out = [];
  for (let k = 0; k < nuclei.length; k++) {
    const end = (k + 1 < nuclei.length) ? cuts[k + 1] : n;
    out.push(w.slice(cuts[k], end));
  }
  return out;
}

// 单个音节 → 音标（prevEndVowel 用来判断元音间的弱化）
function transSyl(syl, prevEndVowel, nextSylFirst) {
  let out = '';
  let i = 0;
  // 注意：判断「前一个音是不是强元音」统一用 out.slice(-1)，别再单独维护变量（容易忘了更新）
  let prevWasVowelInThisSyl = false;
  const startVowel = prevEndVowel;                // 音节开头是否接在元音后
  while (i < syl.length) {
    const ch = syl[i], nx = syl[i + 1] || '', nx2 = syl[i + 2] || '';
    let vowelCtx = prevWasVowelInThisSyl || (out === '' && startVowel);

    // —— 元音类 ——
    if (isV(ch)) {
      let v = ACC[ch] || ch;
      // 双元音：弱元音 i/u 紧邻强元音时半元音化 → j / w
      const prevVowel = /[aeoáéó]/.test(out.slice(-1));
      if ((ch === 'i' || ch === 'í') && (isStrong(nx) || prevVowel)) v = 'j';
      if ((ch === 'u' || ch === 'ú') && (isStrong(nx) || prevVowel)) v = 'w';
      if (ch === 'ü') v = 'w';
      out += v; prevWasVowelInThisSyl = true; i++;
      continue;
    }
    // gü → ɡw
    if (ch === 'g' && nx === 'ü') {
      out += vowelCtx ? 'ɣw' : 'ɡw'; i += 2; prevWasVowelInThisSyl = true; continue;
    }
    // gu + 元音：e/i → ɡ；a/o → ɡw（后面不是元音时 u 是独立元音，如 gustar /ɡusˈtaɾ/）
    if (ch === 'g' && nx === 'u' && isV(nx2)) {
      if ('ei'.indexOf(nx2) >= 0) { out += vowelCtx ? 'ɣ' : 'ɡ'; i += 2; continue; }
      out += (vowelCtx ? 'ɣ' : 'ɡ') + 'w'; i += 2; prevWasVowelInThisSyl = true; continue;
    }
    if (ch === 'g') {
      out += (nx === 'e' || nx === 'i' || nx === 'é' || nx === 'í') ? 'x' : (vowelCtx ? 'ɣ' : 'ɡ');
      i++; continue;
    }
    if (ch === 'q' && nx === 'u') { out += 'k'; i += 2; continue; }
    if (ch === 'q') { out += 'k'; i++; continue; }
    if (ch === 'c' && nx === 'h') { out += 'tʃ'; i += 2; continue; }   // ch 要在普通 c 之前判断
    if (ch === 'c') {
      out += ('ei'.indexOf(nx) >= 0) ? 's' : 'k'; i++; continue;
    }
    if (ch === 'z') { out += 's'; i++; continue; }
    if (ch === 'j') { out += 'x'; i++; continue; }
    if (ch === 'h') { i++; continue; }              // 不发音
    if (ch === 'v') { out += (vowelCtx ? 'β' : 'b'); i++; continue; }
    if (ch === 'b') { out += (vowelCtx ? 'β' : 'b'); i++; continue; }
    // d 只在「前后都是元音」时才弱化成 ð（词尾 -dad 之类保持 d）
    if (ch === 'd') {
      const nextIsVowel = isV(nx);
      out += (vowelCtx && nextIsVowel) ? 'ð' : 'd'; i++; continue;
    }
    if (ch === 'ñ') { out += 'ɲ'; i++; continue; }
    if (ch === 'y') {
      out += /[aeiouáéíóú]/.test(nx) ? 'ʝ' : 'i'; i++; if (out.slice(-1) === 'i') prevWasVowelInThisSyl = true; continue;
    }
    if (ch === 'l' && nx === 'l') { out += 'ʝ'; i += 2; continue; }
    if (ch === 'l') { out += 'l'; i++; continue; }
    if (ch === 'm') { out += 'm'; i++; continue; }
    if (ch === 'n') {
      // n 可能被下一个音节开头的辅音同化（enfermo → emˈfeɾ.mo）
      const after = syl[i + 1] || nextSylFirst || '';
      if (oneOf(after, 'pbm') || after === 'f') out += 'm';
      else if (oneOf(after, 'kɡx') || after === 'j' || after === 'g') out += 'ŋ';
      else out += 'n';
      i++; continue;
    }
    if (ch === 'p') { out += 'p'; i++; continue; }
    if (ch === 't') { out += 't'; i++; continue; }
    // s 在浊辅音前浊化为 [z]（mismo → ˈmiz.mo）
    if (ch === 's') { out += oneOf(nx, 'bdɡlmnrv') ? 'z' : 's'; i++; continue; }
    if (ch === 'f') { out += 'f'; i++; continue; }
    if (ch === 'x') { out += 'ks'; i++; continue; }
    if (ch === 'r') {
      if (nx === 'r') { out += 'r'; i += 2; continue; }
      const atStart = (i === 0 && out === '' && !startVowel);
      const afterNLS = oneOf(syl[i - 1], 'nls');
      out += (atStart || afterNLS) ? 'r' : 'ɾ';
      i++; continue;
    }
    i++;                                            // 其他字符直接跳过
  }
  return out;
}

const ACCENT_RE = /[áéíóú]/;

/**
 * 生成西语词的国际音标（含 / /）。不确定时返回 ''。
 */
export function esIpa(word) {
  const raw = String(word || '').trim().toLowerCase();
  if (!raw || raw.indexOf(' ') >= 0) return '';      // 词组不处理
  if (!/^[a-záéíóúñü]+$/.test(raw)) return '';
  const syls = syllabify(raw);
  if (syls.length > 8) return '';

  // 重音位置：有重音符 → 该音节；否则以 n/s/元音结尾 → 倒数第二，其他 → 最后
  let stress = -1;
  for (let k = 0; k < syls.length; k++) if (ACCENT_RE.test(syls[k])) { stress = k; break; }
  if (stress < 0) {
    stress = syls.length - 1;
    const last = syls[syls.length - 1];
    if (syls.length > 1 && /[ns]?$/i.test(last) && /[aeiou]$/i.test(last.replace(/[ns]$/i, ''))) stress = syls.length - 2;
  }

  const parts = [];
  let prevEndVowel = false;
  for (let k = 0; k < syls.length; k++) {
    const plain = syls[k].replace(/[áéíóú]/g, c => ACC[c]);
    const nextFirst = (k + 1 < syls.length) ? (syls[k + 1][0] || '') : '';
    let ipa = transSyl(plain, prevEndVowel, nextFirst);
    if (!ipa) { ipa = ''; }
    const lastChar = plain[plain.length - 1] || '';
    prevEndVowel = isV(lastChar);
    if (k === stress && syls.length > 1) ipa = 'ˈ' + ipa;
    parts.push(ipa);
  }
  const body = parts.filter(p => p !== '').join('.');
  return body ? '/' + body + '/' : '';
}
