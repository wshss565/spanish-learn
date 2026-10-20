// 单模块整合：学习 / 测评 / 复习 / 语法 / 统计（FSRS 调度）
// 设计：外壳只挂载这唯一一个模块；模块内部用 subnav 在五个子视图间切换。
// 学习子视图为「每日固定流程」：看卡片+跟写 → 默写 → 自测，按词书 + 每日词量取词。
import { WORD_BOOKS } from '../data/books.js';
import { shuffle, sample, norm } from '../core/util.js';
import { esIpa } from '../core/ipa.js';
import { conjugate, PRON_SHORT, articleFor, genderGuess, pluralOf, adjForms, grammarKind } from '../core/conj.js';
import { EVT } from '../core/bus.js';

const SUBVIEWS = [
  { k: 'words', label: '学习' },
  { k: 'assessment', label: '测评' },
  { k: 'review', label: '复习' },
  { k: 'grammar', label: '语法' },
  { k: 'stats', label: '统计' },
];

/* ---------- 西语重音输入条 ---------- */
/* 手机上打出 á / ñ 要长按字母，多数用户根本不知道这招；
   而跟写和默写又明确要求练拼写与重音 ñ —— 等于让人做题却不给笔。
   所以每个需要拼写西语的输入框上方都放一排符号键，点了直接插到光标处。 */
const ES_KEYS = ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', '¿', '¡'];

function esKeysHtml(targetId) {
  return `<div class="es-keys" role="group" aria-label="西语特殊符号">${
    ES_KEYS.map(k => `<button type="button" class="es-key" data-target="${targetId}" aria-label="插入 ${k}">${k}</button>`).join('')
  }</div><div class="es-keys-tip">点符号可插入到光标处</div>`;
}

function bindEsKeys(scope) {
  scope.querySelectorAll('.es-key').forEach(btn => {
    const input = scope.querySelector('#' + btn.dataset.target);
    if (!input) return;
    btn.onclick = () => {
      const ch = btn.textContent.trim();
      const s = input.selectionStart ?? input.value.length;
      const e = input.selectionEnd ?? input.value.length;
      input.value = input.value.slice(0, s) + ch + input.value.slice(e);
      input.focus();
      const pos = s + ch.length;
      try { input.setSelectionRange(pos, pos); } catch { /* 少数输入类型不支持光标定位 */ }
      input.dispatchEvent(new Event('input', { bubbles: true }));  // 触发实时校验重绘
    };
  });
}

const DAY = 86400000;

// ===== 单词子视图：每日固定流程（①认词 ②记词 ③自测 ④默写）=====
// 朋友实测反馈驱动：抄写不算学会、例句别剧透中文、要能自评「我会/我不会」
const FLOW_STAGES = [
  { k: 'intro', label: '认词', desc: '看词听音，例句点词可查释义' },
  { k: 'recall', label: '记词', desc: '凭记忆选「我会 / 我不会」，不会的等会儿再来' },
  { k: 'test', label: '自测', desc: '选择题快速检验，只考今天这组词' },
  { k: 'dict', label: '默写', desc: '看中文写出西语；想练拼写可切换「拼写练习」' },
];
const MODE_LABEL = { intro: '认词', recall: '记词', test: '自测', dict: '默写', trace: '拼写练习' };

// 例句点词查义：全词库倒排索引（等级词书 7790 词，已含原主题词表全部 46 词）
const WORD_INDEX = (() => {
  const m = new Map();
  const put = w => { if (w && w.es && !m.has(w.es)) m.set(w.es, w); };
  WORD_BOOKS.forEach(b => b.words.forEach(put));
  return m;
})();
function lookupWord(raw) {
  const key = String(raw || '').replace(/[.,;:!?¿¡"'()]/g, '').trim();
  if (!key) return null;
  const hit = WORD_INDEX.get(key) || WORD_INDEX.get(key.toLowerCase()) || WORD_INDEX.get(key.charAt(0).toUpperCase() + key.slice(1).toLowerCase());
  return hit ? { es: hit.es, zh: hit.zh } : { es: key, zh: '' };
}

const ALL_WORDS = (() => {
  const a = [];
  WORD_BOOKS.forEach(b => b.words.forEach(w => a.push(w)));
  return a;
})();

// ===== 语法块：动词变位 / 名词冠词 / 形容性数 =====
// 中文母语者最容易在「变位」和「阴阳性」上翻车，这里让它们在每张卡片上直接可见
function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

function grammarHtml(w, compact) {
  if (!w) return '';
  const kind = grammarKind(w.pos);
  if (kind === 'verb') {
    const c = conjugate(w.es);
    if (!c.forms || !c.forms.length) return '';
    const rows = c.forms.map((f, i) => f
      ? `<div class="gj-row${compact && i > 2 ? ' more' : ''}"><span class="gj-p">${esc(PRON_SHORT[i])}</span><button class="gj-f" data-say="${esc(f)}">${esc(f)}</button></div>`
      : '').join('');
    return `
      <div class="gj${compact ? ' compact' : ''}">
        <div class="gj-h">现在时变位 <span class="gj-tag">presente</span>${compact ? '<button class="gj-more" id="gjMore">展开 6 人称</button>' : ''}</div>
        <div class="gj-grid">${rows}</div>
        <p class="gj-note">${esc(c.note)}</p>
        ${c.tip ? `<p class="gj-tip">${esc(c.tip)}</p>` : ''}
      </div>`;
  }
  if (kind === 'noun') {
    const g = w.gender || genderGuess(w.es).g;
    const a = articleFor(w.es, g);
    const pl = pluralOf(w.es);
    return `
      <div class="gj">
        <div class="gj-h">冠词与性 <span class="gj-tag ${g === 'f' ? 'f' : 'm'}">${g === 'f' ? '阴性' : '阳性'}</span></div>
        <div class="gj-art">
          <button class="gj-f big" data-say="${esc(a.art + ' ' + w.es)}">${esc(a.art)} ${esc(w.es)}</button>
          <span class="gj-plus">复数</span>
          <button class="gj-f" data-say="${esc((a.art === 'el' ? 'los ' : 'las ') + pl)}">${esc((a.art === 'el' ? 'los ' : 'las ') + pl)}</button>
        </div>
        <p class="gj-note">${esc(a.note || genderGuess(w.es).why)}</p>
      </div>`;
  }
  if (kind === 'adj') {
    const fs = adjForms(w.es);
    if (!fs.length) return '';
    return `
      <div class="gj">
        <div class="gj-h">形容词性数变化</div>
        <div class="gj-grid">
          ${fs.map(f => `<div class="gj-row"><span class="gj-p">${esc(f.tag)}</span><button class="gj-f" data-say="${esc(f.v)}">${esc(f.v)}</button></div>`).join('')}
        </div>
        <p class="gj-note">形容词要和所修饰的名词保持性数一致</p>
      </div>`;
  }
  return '';
}
function bindGrammar(scope, speech) {
  scope.querySelectorAll('.gj-f[data-say]').forEach(el => {
    el.onclick = () => speech.speak(el.dataset.say, 0.9);
  });
  scope.querySelectorAll('.gj-more').forEach(btn => {
    btn.onclick = () => {
      const box = btn.closest('.gj');
      const open = box.classList.toggle('open');
      btn.textContent = open ? '收起' : '展开 6 人称';
    };
  });
}

// 测评常量
const TYPES = ['meaning', 'listen', 'fill', 'cloze'];
const ENC = ['漂亮！', '稳了！', '就是这样！', '记牢了！', '干得好！'];

// 计时内核引用（unmount 时要用）：外壳通过 ctx.clock 注入
let clockRef = null;

export default {
  id: 'learn', name: '西语', short: '西语', icon: 'ES',
  hint: '每日学习·测评·复习·语法·统计，一个模块全搞定',

  mount(ctx) {
    const { root } = ctx;
    const ck = clockRef = ctx.clock;   // 计时内核（时间管控）；外壳未注入时全程静默跳过
    root.innerHTML = `
      <div class="subnav" id="subnav">
        ${SUBVIEWS.map(v => `<button data-v="${v.k}">${v.label}</button>`).join('')}
      </div>
      <div id="mvBody"></div>`;
    const subnav = root.querySelector('#subnav');
    const body = root.querySelector('#mvBody');
    let cleanup = null;
    let view = null;

    subnav.querySelectorAll('button').forEach(b => b.onclick = () => show(b.dataset.v));

    // 「下一个 / 下一题 / 继续」类主按钮的通用快捷键：回车 或 空格
    // 按钮只在真正可点时才带 data-next（各视图动态挂/摘），所以写错被锁住时不会被这条绕过。
    // 输入框里打字时不抢：回车归输入框（确认/提交），空格照常输入空格。
    root.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      const t = e.target;
      if (t) {
        const tag = t.tagName;
        if ((tag === 'INPUT' || tag === 'TEXTAREA') && !t.disabled) return;  // 打字中
        if (tag === 'BUTTON' && !t.disabled) return;                          // 焦点在可用按钮上：交给原生
      }
      const btn = root.querySelector('button[data-next]');
      if (!btn || btn.disabled || btn.hidden) return;
      e.preventDefault();
      btn.click();
    });

    function show(v) {
      if (!SUBVIEWS.some(x => x.k === v)) v = 'words';
      if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
      view = v;
      subnav.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
      body.innerHTML = '';
      const lctx = { ...ctx, root: body, nav: { go: show }, mountAgain: () => show(v) };
      if (v === 'words') renderWords(lctx);
      else if (v === 'assessment') renderAssessment(lctx);
      else if (v === 'review') renderReview(lctx);
      else if (v === 'grammar') renderGrammar(lctx);
      else if (v === 'stats') renderStats(lctx);
      reportPhase();
    }

    // ---------- 跨 show 保留的子视图状态 ----------
    // 单词（词源只有「等级词书」一种：主题词表 46 词已 100% 被覆盖，砍掉）
    let cardIdx = 0, recording = false, lastUrl = null;
    let mode = 'learn';
    let sessionWords = null, sessionMode = null;
    let wIdx = 0, wCorrect = 0, wWrong = 0, wChecked = false;
    let bookOpen = null;
    // 四步流程进度：必须跨子视图保留，切到测评/复习再回「学习」才能原地续上
    let flowOn = false, flowExtra = false, flowStage = 0, flowWords = [], flowStats = [];

    // ---------- 时间管控：向计时内核上报当前处境 ----------
    // answering = 正在答题。答题过程中到上限不弹阻断卡（只把挂件变红），
    // 等这一轮走完再拦；已进最后一步「默写」则本轮直接放行。
    let answering = false;
    function reportPhase() {
      if (!ck) return;
      const step = (view === 'words' && flowOn) ? flowStage : -1;
      const busy = view === 'words' ? (flowOn && answering)
        : (view === 'assessment' || view === 'review');
      ck.setPhase({ view, busy, step });
    }
    let sq = [], sIdx = 0, sOK = 0, sNO = 0, requeued = null, exShown = false;
    let dictMode = 'recall', dictRetries = 0;     // dictRetries：默写写错后的重默次数（写对或换词才清零）
    let pickInfo = { src: 0, picked: 0, topped: 0 };

    // ================= 单词 =================
    function renderWords(ctx) {
      const { root, store, speech, actions, bus, nav } = ctx;

      // ===== 每日固定流程设置 =====
      const GOALS = [5, 10, 15, 20, 30];
      let goal = 10;            // 每日词量（从 store 恢复）
      const autoSpeak = true;   // 自动发音常开，不再让用户切
      // 其余流程状态（flowOn/flowStage/sq/sIdx/dictMode/...）见 mount 顶部，跨子视图保留

      root.innerHTML = `
        <div class="mod-head">
          <div>
            <h2 class="mod-title">每日学习</h2>
            <p class="mod-sub">固定流程：① 认词 → ② 记词 → ③ 自测 → ④ 默写，每天走一遍才算过关</p>
          </div>
        </div>
        <div class="card daily-card">
          <div class="daily-row">
            <span class="daily-label">每日单词量</span>
            <div class="seg goal-seg" id="goalSeg">
              ${GOALS.map(g => `<button data-g="${g}">${g}</button>`).join('')}
            </div>
          </div>
          <p class="hint" id="dailyInfo"></p>
        </div>
        <div id="body"></div>
        <div class="row-end">
          <button class="btn ghost" id="toReview">去复习</button>
          <button class="btn soft" id="toAssess">去词汇测评</button>
        </div>`;

      root.querySelector('#toReview').onclick = () => nav.go('review');
      root.querySelector('#toAssess').onclick = () => nav.go('assessment');

      // 恢复上次选择的词书 / 每日词量
      // 兼容：老用户存过 srcKind='topic'（主题词表已砍），一律回退到 A1 词书
      const cfg = store.getDaily();
      goal = cfg.goal || 10;
      bookOpen = (cfg.srcId && WORD_BOOKS.some(b => b.id === cfg.srcId))
        ? cfg.srcId
        : (WORD_BOOKS[0] ? WORD_BOOKS[0].id : null);
      function saveSrc() { store.setDaily({ srcKind: 'book', srcId: bookOpen || '' }); }
      function bindGoal() {
        root.querySelectorAll('#goalSeg button').forEach(b => {
          b.classList.toggle('on', +b.dataset.g === goal);
          b.onclick = () => {
            goal = +b.dataset.g; store.setDaily({ goal });
            bindGoal(); renderDailyInfo(); if (!flowOn) renderHome();
          };
        });
      }
      function bindAutoSpk() { /* 自动发音常开，不再提供开关 */ }
      function renderDailyInfo() {
        const el = root.querySelector('#dailyInfo');
        if (!el) return;
        const d = store.getDaily();
        const words = pickDailyWords(goal);
        let note = '';
        if (words.length < goal) {
          note = ` · <span class="brand">⚠ 该词源只有 ${pickInfo.src} 词，已全部取用</span>`;
        } else if (pickInfo.topped > 0) {
          note = ` · 已自动从其他主题补 ${pickInfo.topped} 词`;
        }
        el.innerHTML = `每天从「<b>${activeLabel()}</b>」学 <b>${words.length}</b> 个词（词源共 ${pickInfo.src} 词）${d.done ? ' · <span class="brand">今日已完成 ✅</span>' : ''}${note}`;
      }

      render();

      function resetSession() { sessionMode = null; sessionWords = null; wChecked = false; }
      function activeWords() {
        const b = WORD_BOOKS.find(x => x.id === bookOpen);
        return b ? b.words : (WORD_BOOKS[0] ? WORD_BOOKS[0].words : []);
      }
      function activeLabel() {
        const b = WORD_BOOKS.find(x => x.id === bookOpen);
        return b ? `${b.level} · ${b.name}` : '未选择词书';
      }
      // 当前词书里「真正学过」（learnedAt 有值）的词数——比 inStore 诚实，
      // 因为「开始学习」会一次性把整本入池，inStore 会瞬间涨到整本量。
      function learnedInBook() {
        const b = WORD_BOOKS.find(x => x.id === bookOpen);
        if (!b) return 0;
        const learned = new Set(store.getWords().filter(w => w.learnedAt).map(w => w.word));
        return b.words.filter(w => learned.has(w.es || w.word)).length;
      }
      function inStore(es) { return store.getWords().some(x => x.word === es); }
      function ensureWord(w) {
        if (!inStore(w.es)) actions.addWord({ word: w.es, zh: w.zh, pos: w.pos, gender: w.gender || '' });
      }
      function shuffle(a) {
        a = a.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      }
      function distractors(w, n) {
        const same = ALL_WORDS.filter(x => x !== w && x.pos === w.pos && x.es !== w.es);
        const pool = same.length >= n ? same : ALL_WORDS.filter(x => x !== w && x.es !== w.es);
        return shuffle(pool).slice(0, n).map(x => x.es);
      }

      function render() {
        bindGoal(); bindAutoSpk(); renderDailyInfo();
        if (!bookOpen) renderBookList();
        else renderBookView();
      }
      // ===== 固定流程：按词书+词量取词 → ①看卡片+跟写 → ②默写 → ③自测 =====
      function dateSeed() { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
      function seededShuffle(arr, seed) {
        let s = (seed >>> 0) || 1;
        const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
        return a;
      }
      // 按「新词 → 到期复习 → 已掌握」三档取词。
      // 新词保持词书原序（词书按词频排列，从最高频开始学，前面的词也才有例句）；
      // 到期与已掌握两档用日期种子打乱，避免每天都是同一个顺序。
      function pickDailyWords(n) {
        let base = activeWords();
        if (!base || !base.length) { pickInfo = { src: 0, picked: 0, topped: 0 }; return []; }
        const all = store.getWords(), now = Date.now();
        const g = [[], [], []];
        base.forEach(w => {
          const rec = all.find(x => x.word === w.es);
          let p = 2;
          if (!rec) p = 0;
          else if (rec.due && rec.due <= now) p = 1;
          g[p].push(w);
        });
        const seed = dateSeed();
        const ordered = [].concat(g[0], seededShuffle(g[1], seed + 31), seededShuffle(g[2], seed + 97));
        const picked = ordered.slice(0, n);
        pickInfo = { src: base.length, picked: picked.length, topped: 0 };
        return picked;
      }
      function startFlow(extra) {
        const words = pickDailyWords(goal);
        if (!words.length) return;
        flowOn = true; flowExtra = !!extra; flowStage = 0; flowWords = words; flowStats = [];
        runStage();
      }
      // 切到别的子视图再回「学习」时，原地续上当前这步的当前词（不重开首页）
      function resumeFlow() {
        if (!flowOn) return;
        const st = FLOW_STAGES[flowStage];
        if (!st) { flowOn = false; renderHome(); return; }
        mode = st.k;
        if (st.k === 'recall') renderSelfEval();
        else { sessionMode = mode; renderPractice(); }
      }
      function runStage() {
        answering = true;               // 进入答题轮次
        const st = FLOW_STAGES[flowStage];
        mode = st.k;
        wChecked = false;
        if (st.k === 'recall') {
          // 记词：单独队列，「我不会」的词排到队尾，本轮稍后再来
          sq = shuffle(flowWords.slice()); sIdx = 0; sOK = 0; sNO = 0;
          requeued = new Set(); exShown = false;
          renderSelfEval();
          reportPhase();
          return;
        }
        dictMode = 'recall';
        // 认词按取词顺序走；自测/默写打乱顺序考
        sessionWords = (st.k === 'intro') ? flowWords.slice() : shuffle(flowWords.slice());
        sessionMode = mode; wIdx = 0; wCorrect = 0; wWrong = 0;
        renderPractice();
        reportPhase();
      }
      function renderPractice() {
        const words = sessionWords;
        if (!words || !words.length) return;
        if (wIdx >= words.length) { onStageEnd(); return; }
        const w = words[wIdx];
        if (mode === 'intro') renderIntro(w);
        else if (mode === 'test') renderTest(w);
        else renderTyping(w, dictMode);
      }
      function onStageEnd() {
        if (!flowOn) { renderHome(); return; }
        if (FLOW_STAGES[flowStage].k === 'recall') flowStats[flowStage] = { ok: sOK, no: sNO };
        else flowStats[flowStage] = { ok: wCorrect, no: wWrong };
        if (flowStage < FLOW_STAGES.length - 1) renderStageGate();
        else finishFlow();
      }
      function doNext() { wIdx++; wChecked = false; dictRetries = 0; renderPractice(); }

      function practiceKey(e) {
        if (!sessionWords) return;
        // 隐藏的按钮不该被快捷键触发（默写未写对时无任何前进出口）
        const hit = id => { const b = root.querySelector(id); if (b && !b.hidden && b.style.display !== 'none') b.click(); };
        if (e.key === 'Tab') { e.preventDefault(); hit('#tskip'); }
        else if (e.key === '`') { e.preventDefault(); hit('#tmaster'); }
        else if (e.key === 'Escape') { e.preventDefault(); hit('#treveal'); }
      }

      // 今日任务首页（首屏引导 Hero）
      function renderHome() {
        const slot = root.querySelector('#cardSlot');
        if (!slot) return;
        const d = store.getDaily();
        const st = store.streakInfo();
        // —— 连击徽章：留存引擎，而非角落小字 ——
        let streakBadge;
        if (st.isNew) {
          streakBadge = `<div class="streak-badge new"><span class="streak-flame">🔥</span><span class="streak-num">0</span><span class="streak-unit">天</span><span class="streak-msg">开始你的连续打卡第一天</span></div>`;
        } else if (st.broke) {
          streakBadge = `<div class="streak-badge broke"><span class="streak-flame">🔥</span><span class="streak-msg">昨天断了 · 今天<b>重新开始</b></span></div>`;
        } else if (st.done) {
          streakBadge = `<div class="streak-badge done"><span class="streak-flame">🔥</span><span class="streak-num">${st.streak}</span><span class="streak-unit">天连续</span><span class="streak-msg">今天已打卡 ✓ 保持住</span></div>`;
        } else if (st.atRisk) {
          streakBadge = `<div class="streak-badge risk"><span class="streak-flame">🔥</span><span class="streak-num">${st.streak}</span><span class="streak-unit">天连续</span><span class="streak-msg">今天还没学，别让 ${st.streak} 天断了！</span></div>`;
        } else {
          streakBadge = `<div class="streak-badge"><span class="streak-flame">🔥</span><span class="streak-num">${st.streak}</span><span class="streak-unit">天连续</span></div>`;
        }

        // 防御分支：挂载时已默认选中 A1，正常只在有词书时进入；若 bookOpen 意外为空给引导而非空白。
        if (!bookOpen) {
          slot.innerHTML = `<div class="card center flow-home hero">
            ${streakBadge}
            <div class="hero-kicker">每日学习</div>
            <h3 class="hero-title">四步拿下西语高频词</h3>
            <p class="hero-sub">认词 → 记词 → 自测 → 默写，每天滚动复习，按 FSRS 间隔重复自动安排节奏。</p>
            <div class="flow-steps">
              ${FLOW_STAGES.map((s, i) => `<span class="flow-step" title="${esc(s.desc)}"><b>${i + 1}</b> ${s.label}${i < FLOW_STAGES.length - 1 ? '<i>→</i>' : ''}</span>`).join('')}
            </div>
            <div class="row-center" style="margin-top:12px">
              <button class="btn btn-lg" id="fhBooks">挑一本词书开始 →</button>
            </div>
          </div>`;
          const books = slot.querySelector('#fhBooks'); if (books) books.onclick = () => { bookOpen = null; render(); };
          return;
        }
        const label = activeLabel();
        const words = pickDailyWords(goal);
        const lvl = label.split(' ')[0];   // 「A1 · 西语最核心…」→ A1，用作 CTA 标签
        // —— 终点感进度：词书总量 / 已学 / 按当前词量还要多少天 ——
        const bk = WORD_BOOKS.find(b => b.id === bookOpen);
        const total = bk ? bk.words.length : 0;
        const learned = learnedInBook();
        const remain = Math.max(0, total - learned);
        const daysLeft = goal > 0 ? Math.ceil(remain / goal) : 0;
        const pct = total ? Math.round(learned / total * 100) : 0;
        const a1Total = WORD_BOOKS.find(b => b.level === 'A1');
        const goalTrack = `
          <div class="goal-track">
            <div class="gt-row"><b>《${esc(label)}》${total} 词</b><span class="gt-learned">已学 ${learned} 词</span></div>
            <div class="bar slim gt-bar"><i style="width:${pct}%"></i></div>
            <p class="gt-day">按每天 ${goal} 词，还要约 <b>${daysLeft}</b> 天学完这本</p>
          </div>`;
        slot.innerHTML = `
          <div class="card center flow-home hero">
            ${streakBadge}
            <div class="hero-time" id="heroTime"></div>
            <div class="hero-kicker">每日学习</div>
            <h3 class="hero-title">四步拿下西语高频词</h3>
            <p class="hero-sub">认词 → 记词 → 自测 → 默写，每天 ${goal} 词滚动复习，按 FSRS 间隔重复自动安排节奏。</p>
            <div class="flow-steps">
              ${FLOW_STAGES.map((s, i) => `<span class="flow-step" title="${esc(s.desc)}"><b>${i + 1}</b> ${s.label}${i < FLOW_STAGES.length - 1 ? '<i>→</i>' : ''}</span>`).join('')}
            </div>
            ${goalTrack}
            <p class="hint">今日从「<b>${esc(label)}</b>」取 ${words.length} 词：${words.slice(0, 8).map(w => esc(w.es)).join('、')}${words.length > 8 ? ' …' : ''}</p>
            ${words.length < goal ? `<div class="post-hint">「${esc(label)}」只剩 ${pickInfo.src} 词没学了，已经全给你。想每天 ${goal} 词，去下面「词书库」换一本更厚的（A1 共 ${a1Total ? a1Total.words.length : '近千'} 词）。</div>` : ''}
            ${d.done ? `
              <div class="post-hint">🎉 今天的四步流程已经走完</div>
              <div class="row-center" style="margin-top:12px">
                <button class="btn soft" id="fhAgain">再练一轮（额外）</button>
                <button class="btn ghost" id="fhReview">去复习今天的词</button>
              </div>
              <button class="link-btn" id="fhBooks">或挑一本词书 ↓</button>` : `
              <div class="row-center" style="margin-top:14px">
                <button class="btn btn-lg" id="fhStart">开始今日学习 · ${esc(lvl)} · ${goal} 词 →</button>
              </div>
              <button class="link-btn" id="fhBooks">或挑一本词书 ↓</button>`}
          </div>`;
        if (d.done) {
          const a = slot.querySelector('#fhAgain'); if (a) a.onclick = () => startFlow(true);
          const r = slot.querySelector('#fhReview'); if (r) r.onclick = () => nav.go('review');
        } else {
          const s = slot.querySelector('#fhStart'); if (s) s.onclick = () => startFlow(false);
        }
        const books = slot.querySelector('#fhBooks');
        if (books) books.onclick = () => { bookOpen = null; render(); };   // 不持久化，仅本次浏览词书库
      }

      function renderBookList() {
        const body = root.querySelector('#body');
        const total = WORD_BOOKS.reduce((n, b) => n + b.words.length, 0);
        body.innerHTML = `
          <p class="book-tip">共 ${WORD_BOOKS.length} 本词书、${total} 词。加入后按 FSRS 间隔重复自动出现在「复习」里。</p>
          <div id="bkMsg"></div>
          <div class="book-grid">
            ${WORD_BOOKS.map(b => {
              const p = store.bookProgress(b.words);
              const pct = p.total ? Math.round(p.inStore / p.total * 100) : 0;
              return `
                <div class="book-card">
                  <div class="bk-top"><span class="lvl lvl-${b.level}">${b.level}</span><span class="hint">${b.words.length} 词</span></div>
                  <b class="bk-name">${b.name}</b>
                  <p class="bk-desc">${b.desc}</p>
                  <div class="bar slim"><i style="width:${pct}%"></i></div>
                  <p class="hint">${p.inStore ? `已加入 ${p.inStore}/${p.total} · ${p.scheduled} 已排期` : '尚未加入复习计划'}</p>
                  <div class="bk-actions">
                    <button class="btn btn-sm" data-learn="${b.id}">开始学习</button>
                    ${p.inStore ? `<button class="btn soft btn-sm" data-enroll="${b.id}">补充加入</button>` : ''}
                  </div>
                </div>`;
            }).join('')}
          </div>`;
        // 「开始学习」：选中这本词书后直接开跑①认词，不再停在详情页让用户再点一次
        body.querySelectorAll('[data-learn]').forEach(btn => btn.onclick = () => {
          const b = WORD_BOOKS.find(x => x.id === btn.dataset.learn);
          if (!b) return;
          bookOpen = b.id;
          resetSession(); flowOn = false; cardIdx = 0; saveSrc();
          // 没加入复习计划的先自动加入，保证学过的词能进复习队列
          if (!store.bookProgress(b.words).inStore) {
            store.enrollWords(b.words, b.id);
            bus.emit(EVT.VOCAB_CHANGED, store.getSummary());
          }
          render();
          startFlow(!!(store.getDaily().done));
        });
        body.querySelectorAll('[data-enroll]').forEach(btn => btn.onclick = () => {
          const b = WORD_BOOKS.find(x => x.id === btn.dataset.enroll);
          const r = store.enrollWords(b.words, b.id);
          bus.emit(EVT.VOCAB_CHANGED, store.getSummary());
          render();
          showMsg(`已把《${b.name}》加入复习计划（新增 ${r.added} 词），现在可以去「复习」开始第一轮。`);
        });
      }
      function showMsg(text) {
        const msg = root.querySelector('#bkMsg');
        if (msg) { msg.className = 'bk-msg'; msg.textContent = text; }
      }
      function renderBookView() {
        const b = WORD_BOOKS.find(x => x.id === bookOpen);
        if (!b) { bookOpen = null; render(); return; }
        const p = store.bookProgress(b.words);
        const body = root.querySelector('#body');
        body.innerHTML = `
          <div class="book-head">
            <button class="btn ghost btn-sm" id="bkBack">← 词书库</button>
            <div class="book-head-info"><span class="lvl lvl-${b.level}">${b.level}</span><b>${b.name}</b><span class="hint">${b.words.length} 词</span></div>
            <button class="btn ${p.inStore ? 'soft' : ''}" id="bkEnroll">${p.inStore ? '已加入复习' : '加入复习计划'}</button>
          </div>
          <div id="bkMsg"></div>
          <div id="cardSlot"></div>`;
        root.querySelector('#bkBack').onclick = () => { bookOpen = null; resetSession(); flowOn = false; saveSrc(); render(); };
        root.querySelector('#bkEnroll').onclick = () => {
          const r = store.enrollWords(b.words, b.id);
          bus.emit(EVT.VOCAB_CHANGED, store.getSummary());
          render();
          showMsg(r.added ? `已加入 ${r.added} 词，去「复习」开始第一轮。` : '这本词书的词都已在复习计划里了。');
        };
        if (flowOn) resumeFlow(); else renderHome();
      }

      // ① 认词：自动发音；例句不配中文（点词查义）；一屏只做一件事
      function renderIntro(w) {
        const slot = root.querySelector('#cardSlot');
        if (!slot) return;
        const ent = findEntry(w.es) || {};
        const src = w.ex ? w : ent;              // 例句和它的中文翻译必须来自同一条记录
        const ex = src.ex || '';
        const exZh = src.exZh || '';
        slot.innerHTML = `
          <div class="card word-card learn-card">
            <div class="wc-top">
              <span class="hint">① 认词 · ${activeLabel()} · ${wIdx + 1}/${sessionWords.length}</span>
              <span class="hint">下一步：记词</span>
            </div>
            <div class="wc-word">${esc(w.es)}</div>
            <div class="ipa">${ipaOf(w)}</div>
            <div class="wc-zh"><span class="zh">${esc(w.zh)}</span></div>
            <div class="wc-meta">${posLabel(w.pos, w.gender)}</div>
            ${grammarHtml(w, true)}
            <div class="action-bar">
              <button class="ab" id="playN">常速</button>
              <button class="ab" id="playS">慢速</button>
            </div>
            ${ex ? `
              <div class="type-divider"><span>例句</span></div>
              ${exBoxHtml(ex, exZh, 'exPlay')}` : `
              <div class="type-divider"><span>怎么读</span></div>
              <div class="ex-box"><p class="hint">${esc(pronTip(w.es))}</p></div>`}
            <div class="row-between" style="margin-top:var(--s4)">
              <button class="btn ghost" id="iSkip">跳过</button>
              <button class="btn" id="iKnow" data-next>认识了，下一个 →</button>
            </div>
            <div class="kb-hint"><span class="kbd">Enter</span> 或 <span class="kbd">空格</span> 下一个</div>
          </div>`;
        slot.querySelector('#playN').onclick = () => speech.speak(w.es, 0.9);
        slot.querySelector('#playS').onclick = () => speech.speak(w.es, 0.5);
        const exPlay = slot.querySelector('#exPlay');
        if (exPlay) exPlay.onclick = () => speech.speak(ex, 0.85);
        bindEx(slot, speech);
        // 「认识了」= 已学且计对；「跳过」= 只是翻页，不标记已学、不计正确率（否则虚高且把不熟的词标成已学）
        const know = () => { ensureWord(w); store.markLearned(w.es); wCorrect++; wIdx++; renderPractice(); };
        const skip = () => { wIdx++; renderPractice(); };
        slot.querySelector('#iKnow').onclick = know;
        slot.querySelector('#iSkip').onclick = skip;
        bindGrammar(slot, speech);
        if (autoSpeak) setTimeout(() => speech.speak(w.es, 0.9), 250);
      }

      function exSentHtml(sent) {
        return String(sent).split(/\s+/).map(tok => `<span class="ex-w" data-t="${esc(tok)}">${esc(tok)}</span>`).join(' ');
      }
      function escAttr(s) { return esc(s).replace(/"/g, '&quot;'); }

      // 例句块：中文默认收起，点「看中文」才展开——先自己猜一遍，卡住了再看
      function exBoxHtml(ex, exZh, playId) {
        if (!ex) return '';
        return `
          <div class="ex-box">
            <div class="ex-sent">${exSentHtml(ex)}</div>
            <div class="row-start" style="margin-top:8px">
              <button class="btn soft btn-sm" id="${playId}">朗读例句</button>
              ${exZh ? `<button class="btn soft btn-sm ex-zh-btn" data-exzh="${escAttr(exZh)}">看中文</button>` : ''}
            </div>
            ${exZh ? `<div class="ex-zh" hidden></div>` : ''}
            <p class="hint" style="margin-top:6px">点句子里任意单词可查释义${exZh ? ' · 中文默认收起，先自己猜一遍' : ''}</p>
          </div>`;
      }
      // 绑定例句块：点词查义 + 中文折叠
      function bindEx(scope, speech) {
        scope.querySelectorAll('.ex-w').forEach(el => { el.onclick = () => showWordPopup(el.dataset.t); });
        scope.querySelectorAll('.ex-zh-btn').forEach(btn => {
          const box = btn.closest('.ex-box').querySelector('.ex-zh');
          if (!box) return;
          btn.onclick = () => {
            const open = box.hidden;
            box.hidden = !open;
            box.innerHTML = open ? `<span class="zh">${esc(btn.dataset.exzh)}</span>` : '';
            btn.textContent = open ? '收起中文' : '看中文';
          };
        });
      }

      // 例句点词 → 底部弹卡释义
      function showWordPopup(raw) {
        const info = lookupWord(raw);
        root.querySelectorAll('.backdrop, .sheet').forEach(el => el.remove());
        const backdrop = document.createElement('div');
        const sheet = document.createElement('div');
        backdrop.className = 'backdrop';
        sheet.className = 'sheet';
        sheet.innerHTML = `
          <div class="lk-word">${esc(info.es)}</div>
          <div class="lk-zh">${info.zh ? esc(info.zh) : '词库暂无这条释义'}</div>
          ${grammarHtml(info)}
          <div class="row-start" style="margin-top:12px">
            <button class="btn soft btn-sm" id="lkPlay">朗读</button>
            <button class="btn soft btn-sm" id="lkClose">关闭</button>
          </div>`;
        root.appendChild(backdrop);
        root.appendChild(sheet);
        const close = () => { backdrop.remove(); sheet.remove(); };
        backdrop.onclick = close;
        sheet.querySelector('#lkClose').onclick = close;
        sheet.querySelector('#lkPlay').onclick = () => speech.speak(info.es, 0.9);
        bindGrammar(sheet, speech);
      }

      // ② 记词：遮住中文 → 我会 / 我不会；不会的排到队尾本轮再来
      function renderSelfEval() {
        const slot = root.querySelector('#cardSlot');
        if (!slot) return;
        if (sIdx >= sq.length) { onStageEnd(); return; }
        const w = sq[sIdx];
        const isRetry = requeued.has(w.es);
        const entEval = findEntry(w.es) || {};
        const srcEval = w.ex ? w : entEval;
        const ex = srcEval.ex || '';
        const exZh = srcEval.exZh || '';
        slot.innerHTML = `
          <div class="card word-card learn-card center">
            <div class="wc-top">
              <span class="hint">② 记词 · ${activeLabel()} · ${sIdx + 1}/${sq.length}${isRetry ? ' · 刚才不会，再来一次' : ''}</span>
              <span class="hint">会 ${sOK} · 不会 ${sNO}</span>
            </div>
            <div class="wc-word">${esc(w.es)}</div>
            <div class="ipa">${ipaOf(w)}</div>
            <div class="wc-meta">${posLabel(w.pos, w.gender)}</div>
            ${esKeysHtml('evType')}
            <div class="type-input" style="width:100%;max-width:340px;margin:0 auto">
              <input class="input" id="evType" type="text" autocomplete="off" placeholder="照着打一遍…" />
            </div>
            <div class="type-fb" id="evFb"></div>
            <div class="wc-zh" id="zhBox"></div>
            <div id="exBox" style="display:none"></div>
            <div class="row-center" id="evalBtns" style="margin-top:var(--s4)">
              <button class="btn ghost" id="evNo">我不会</button>
              <button class="btn" id="evYes">我会</button>
            </div>
            <div class="row-between" id="afterBtns" style="display:none;margin-top:var(--s4)">
              <button class="btn ghost" id="evEx">${ex ? '看例句' : '再听一次'}</button>
              <button class="btn" id="evNext">下一个 →</button>
            </div>
            <div class="kb-hint" id="evKh" style="display:none"><span class="kbd">Enter</span> 或 <span class="kbd">空格</span> 下一个</div>
          </div>`;
        if (autoSpeak) setTimeout(() => speech.speak(w.es, 0.9), 250);

        // 跟写：看词照着打一遍（不显示中文翻译，先靠记忆拼）
        bindEsKeys(slot);
        const evType = slot.querySelector('#evType');
        const evFb = slot.querySelector('#evFb');
        const paintEv = () => {
          const val = evType.value;
          if (!val) { evFb.innerHTML = ''; return; }
          if (checkEs(val, w.es).correct) { evFb.innerHTML = '<span class="cm">✓ 拼对了</span>'; return; }
          evFb.innerHTML = paintCompare(val, w.es, true).html;
        };
        evType.addEventListener('input', paintEv);

        const zhBox = slot.querySelector('#zhBox');
        const exBox = slot.querySelector('#exBox');
        const eb = slot.querySelector('#evalBtns');
        const ab = slot.querySelector('#afterBtns');
        const answer = yes => {
          ensureWord(w); store.markLearned(w.es); store.bumpMastery(w.es, yes);
          if (yes) sOK++;
          else {
            sNO++;
            if (!requeued.has(w.es)) { requeued.add(w.es); sq.push(w); }
          }
          eb.style.display = 'none';
          ab.style.display = 'flex';
          // 答过之后「下一个」才成为主操作，这一步才挂快捷键
          slot.querySelector('#evNext').setAttribute('data-next', '');
          const evKh = slot.querySelector('#evKh'); if (evKh) evKh.style.display = 'block';
          zhBox.innerHTML = `<span class="zh">${esc(w.zh)}</span>`;
          if (autoSpeak) speech.speak(w.es, 0.9);
        };
        slot.querySelector('#evYes').onclick = () => answer(true);
        slot.querySelector('#evNo').onclick = () => answer(false);
        slot.querySelector('#evNext').onclick = () => { sIdx++; renderSelfEval(); };
        slot.querySelector('#evEx').onclick = () => {
          if (!ex) { speech.speak(w.es, 0.9); return; }
          exShown = !exShown;
          if (exShown) {
            exBox.innerHTML = exBoxHtml(ex, exZh, 'exPlay2');
            bindEx(exBox, speech);
            const bp = exBox.querySelector('#exPlay2'); if (bp) bp.onclick = () => speech.speak(ex, 0.85);
            exBox.style.display = 'block';
            slot.querySelector('#evEx').textContent = '收起例句';
          } else {
            exBox.style.display = 'none';
            slot.querySelector('#evEx').textContent = '看例句';
          }
        };
      }

      function renderTyping(w, m) {
        const slot = root.querySelector('#cardSlot');
        if (!slot) return;
        const isTrace = m === 'trace';
        const stageLabel = (mode === 'dict') ? (isTrace ? '④ 拼写练习' : '④ 默写') : MODE_LABEL[m];
        const promptHtml = isTrace
          ? `<div class="big-es">${esc(w.es)}</div><div class="ipa">${ipaOf(w)}</div><p class="hint">照着打出来，练拼写与重音/ñ</p>`
          : m === 'dict'
            ? `<button class="type-audio" id="tplay" aria-label="播放这个单词的西语发音">🔊</button><p class="hint">听发音，写出西语单词</p>`
            : `<div class="type-prompt">${esc(w.zh)}</div><div class="wc-meta">${posLabel(w.pos, w.gender)} · 用西语作答</div><p class="hint">凭记忆写出这个单词的西语写法</p>`;
        slot.innerHTML = `
          <div class="type-card card">
            <div class="wc-top">
              <span class="hint">${stageLabel} · ${activeLabel()} · ${wIdx + 1}/${sessionWords.length}</span>
              <span class="dots">对 ${wCorrect} · 错 ${wWrong}</span>
            </div>
            ${mode === 'dict' ? `
            <div class="type-dir">
              <button class="mini ${dictMode === 'recall' ? 'on' : ''}" id="dmRecall">默写：凭记忆写</button>
              <button class="mini ${dictMode === 'trace' ? 'on' : ''}" id="dmTrace">拼写练习：照着打</button>
            </div>` : ''}
            ${promptHtml}
            ${esKeysHtml('tinput')}
            <div class="type-input">
              <input class="input" id="tinput" type="text" autocomplete="off" placeholder="写出西班牙语…" />
              <button class="btn soft" id="tplay2" title="听发音" aria-label="播放这个单词的西语发音">🔊</button>
              <button class="btn" id="tcheck">确认</button>
            </div>
            <div class="type-fb" id="tfb"></div>
            <div class="feedback" id="tmsg"></div>
            <div class="kb-hint" id="tkh"><span class="kbd">Tab</span> 跳过 · <span class="kbd">\`</span> 标记掌握 · <span class="kbd">Enter</span> 确认 · <span class="kbd">Esc</span> 看答案</div>
            <div class="row-between">
              <button class="btn ghost" id="tskip">跳过</button>
              <button class="btn soft" id="tmaster">标记掌握</button>
              <button class="btn ghost" id="treveal">看答案</button>
            </div>
          </div>`;

        bindEsKeys(slot);
        const input = slot.querySelector('#tinput');
        const fb = slot.querySelector('#tfb');
        const msg = slot.querySelector('#tmsg');
        const tcheck = slot.querySelector('#tcheck');
        const tskip = slot.querySelector('#tskip');
        const tmaster = slot.querySelector('#tmaster');
        const treveal = slot.querySelector('#treveal');
        const dirBox = slot.querySelector('.type-dir');
        const tkh = slot.querySelector('#tkh');
        const KH_ASK = '<span class="kbd">Tab</span> 跳过 · <span class="kbd">`</span> 标记掌握 · <span class="kbd">Enter</span> 确认 · <span class="kbd">Esc</span> 看答案';
        const KH_NEXT = '<span class="kbd">Enter</span> 或 <span class="kbd">空格</span> 下一个 · <span class="kbd">Tab</span> 跳过';
        // 挂/摘「下一个」的快捷键：只有作答完成、真的能前进时才挂
        const markForward = () => { tcheck.setAttribute('data-next', ''); tskip.setAttribute('data-next', ''); };
        const clearForward = () => { tcheck.removeAttribute('data-next'); tskip.removeAttribute('data-next'); };
        const hideAux = () => {
          tmaster.style.display = 'none'; treveal.style.display = 'none';
          tskip.hidden = false; tskip.textContent = '下一个';
          if (dirBox) dirBox.style.display = 'none';
          markForward();
          if (tkh) tkh.innerHTML = KH_NEXT;
        };
        // 写错：收起一切「前进出口」，逼用户留在当前词上重默
        const lockForward = () => {
          tskip.hidden = true;
          tmaster.style.display = 'none'; treveal.style.display = 'none';
          if (dirBox) dirBox.style.display = 'none';
          clearForward();
          if (tkh) tkh.innerHTML = KH_ASK;
        };
        const finishRight = () => {
          wCorrect++; ensureWord(w); store.bumpMastery(w.es, true);
          const tried = dictRetries > 0 ? `　第 ${dictRetries + 1} 次写完` : '';
          msg.className = 'feedback ok'; msg.innerHTML = `✓ 正确！<b>${esc(w.es)}</b> <span class="ipa">${ipaOf(w)}</span>${tried}`;
          input.disabled = true; tcheck.textContent = '下一个 →'; wChecked = true; hideAux();
        };
        const finishWrong = () => {
          wWrong++; if (inStore(w.es)) store.bumpMastery(w.es, false);
          if (!isTrace) {
            // 默写：写错 → 退回同一个词继续默，写对前不提供任何「下一个」
            // 答案就显示在屏幕上，用户照着写必然能通过，所以不存在卡死
            dictRetries++;
            msg.className = 'feedback no';
            msg.innerHTML = `✗ 答案：<b>${esc(w.es)}</b> <span class="ipa">${ipaOf(w)}</span>`
              + `<div class="hint">照着答案再默一遍（第 ${dictRetries + 1} 次）—— 写对了才会出现「下一个」</div>`;
            // 保持作答态：wChecked 不置 true，输入框清空后继续可写，Enter/确认即再判一次
            input.disabled = false; input.value = ''; fb.innerHTML = '';
            tcheck.textContent = '确认';
            lockForward();
            setTimeout(() => input.focus(), 30);
            return;
          }
          // 拼写练习（trace）：词已摆在屏幕上，重打意义不大，照旧显示答案后放行
          msg.className = 'feedback no';
          msg.innerHTML = `✗ 答案：<b>${esc(w.es)}</b> <span class="ipa">${ipaOf(w)}</span>`;
          input.disabled = true; tcheck.textContent = '下一个 →'; wChecked = true; hideAux();
        };

        const paint = () => {
          const r = paintCompare(input.value, w.es, isTrace);
          fb.innerHTML = r.html;
          if (r.accentNote && !wChecked) { msg.className = 'feedback'; msg.textContent = '⚠ 重音符号 / ñ 可能有误，注意核对'; }
        };
        input.addEventListener('input', paint);

        function doCheck() {
          if (wChecked) { doNext(); return; }
          const val = input.value.trim();
          if (!val) { msg.className = 'feedback'; msg.textContent = '先写点什么～'; return; }
          if (checkEs(val, w.es).correct) finishRight();
          else finishWrong();
        }

        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doCheck(); } });
        // #cardSlot 是同一个节点，重默/换词会重复渲染 → 先摘再挂，避免监听器叠加（否则一次 Tab 会连跳数词）
        slot.removeEventListener('keydown', practiceKey);
        slot.addEventListener('keydown', practiceKey);
        tcheck.onclick = doCheck;
        tskip.onclick = () => { if (wChecked) doNext(); else finishWrong(); };
        tmaster.onclick = () => { if (wChecked) { doNext(); return; } ensureWord(w); store.bumpMastery(w.es, true); wCorrect++; msg.className = 'feedback ok'; msg.textContent = '✓ 已标记掌握'; input.disabled = true; tcheck.textContent = '下一个 →'; wChecked = true; hideAux(); };
        treveal.onclick = () => { if (wChecked) doNext(); else finishWrong(); };
        slot.querySelector('#tplay2').onclick = () => speech.speak(w.es, 0.9);
        const tplay = slot.querySelector('#tplay'); if (tplay) tplay.onclick = () => speech.speak(w.es, 0.9);
        const dmR = slot.querySelector('#dmRecall'), dmT = slot.querySelector('#dmTrace');
        if (dmR) dmR.onclick = () => { dictMode = 'recall'; renderTyping(w, 'recall'); };
        if (dmT) dmT.onclick = () => { dictMode = 'trace'; renderTyping(w, 'trace'); };
        if (m === 'dict') speech.speak(w.es, 0.9);

        if (!isTrace) paint();
        setTimeout(() => input.focus(), 30);
      }

      function renderTest(w) {
        const slot = root.querySelector('#cardSlot');
        if (!slot) return;
        const opts = shuffle([w.es, ...distractors(w, 3)]);
        slot.innerHTML = `
          <div class="type-card card">
            <div class="wc-top">
              <span class="hint">自测 · ${activeLabel()} · ${wIdx + 1}/${sessionWords.length}</span>
              <span class="dots">对 ${wCorrect} · 错 ${wWrong}</span>
            </div>
            <div class="type-prompt">${esc(w.zh)}</div>
            <div class="wc-meta">${posLabel(w.pos, w.gender)} · 选出正确西语</div>
            <div class="opts" id="opts">
              ${opts.map(o => `<button class="opt" data-es="${esc(o)}">${esc(o)}</button>`).join('')}
            </div>
            <div class="feedback" id="tmsg"></div>
            <div class="kb-hint" id="tkh"><span class="kbd">Tab</span> 跳过 · <span class="kbd">\`</span> 标记掌握</div>
            <div class="row-between">
              <button class="btn ghost" id="tskip">跳过</button>
              <button class="btn soft" id="tmaster">标记掌握</button>
            </div>
          </div>`;
        const msg = slot.querySelector('#tmsg');
        const tskip = slot.querySelector('#tskip');
        const tmaster = slot.querySelector('#tmaster');
        const tkh = slot.querySelector('#tkh');
        const hideAux = () => {
          tmaster.style.display = 'none'; tskip.textContent = '下一个';
          tskip.setAttribute('data-next', '');   // 作答完成才放出回车/空格快捷键
          if (tkh) tkh.innerHTML = '<span class="kbd">Enter</span> 或 <span class="kbd">空格</span> 下一个 · <span class="kbd">Tab</span> 跳过';
        };
        const optEls = slot.querySelectorAll('#opts .opt');
        const reveal = () => optEls.forEach(x => { x.disabled = true; if (x.dataset.es === w.es) x.classList.add('ok'); });
        optEls.forEach(b => b.onclick = () => {
          if (wChecked) return;
          wChecked = true;
          const ok = b.dataset.es === w.es;
          optEls.forEach(x => { x.disabled = true; if (x.dataset.es === w.es) x.classList.add('ok'); else if (x === b) x.classList.add('no'); });
          if (ok) { wCorrect++; ensureWord(w); store.bumpMastery(w.es, true); msg.className = 'feedback ok'; msg.textContent = '✓ 正确！'; }
          else { wWrong++; if (inStore(w.es)) store.bumpMastery(w.es, false); msg.className = 'feedback no'; msg.innerHTML = `✗ 正确：<b>${esc(w.es)}</b>`; }
          hideAux();
        });
        tskip.onclick = () => { if (wChecked) { doNext(); return; } wWrong++; if (inStore(w.es)) store.bumpMastery(w.es, false); msg.className = 'feedback no'; msg.innerHTML = `答案：<b>${esc(w.es)}</b>`; wChecked = true; hideAux(); reveal(); };
        tmaster.onclick = () => { if (wChecked) { doNext(); return; } ensureWord(w); store.bumpMastery(w.es, true); wCorrect++; msg.className = 'feedback ok'; msg.textContent = '✓ 已标记掌握'; wChecked = true; hideAux(); reveal(); };
        // #cardSlot 是同一个节点，重默/换词会重复渲染 → 先摘再挂，避免监听器叠加（否则一次 Tab 会连跳数词）
        slot.removeEventListener('keydown', practiceKey);
        slot.addEventListener('keydown', practiceKey);
      }

      // 阶段之间的「必经关卡」：只能点继续下一步，保证每天走完整套流程
      function renderStageGate() {
        const slot = root.querySelector('#cardSlot');
        if (!slot) return;
        const done = FLOW_STAGES[flowStage], next = FLOW_STAGES[flowStage + 1];
        const st = flowStats[flowStage] || { ok: 0, no: 0 };
        const total = st.ok + st.no;
        const acc = total ? Math.round(st.ok / total * 100) : 0;
        slot.innerHTML = `
          <div class="card center">
            <div class="bignum">${st.ok}/${total}</div>
            <p class="encourage">第 ${flowStage + 1} 步「${done.label}」完成${total ? `，正确率 ${acc}%` : ''}</p>
            <p class="hint">会/对 ${st.ok} · 不会/错 ${st.no} · 本轮共 ${flowWords.length} 词</p>
            <div class="post-hint">接着第 ${flowStage + 2} 步：<b>${next.label}</b> — ${next.desc}</div>
            <div class="row-center" style="margin-top:14px">
              <button class="btn" id="fgNext" data-next>继续第 ${flowStage + 2} 步 →</button>
            </div>
            <div class="kb-hint"><span class="kbd">Enter</span> 或 <span class="kbd">空格</span> 继续</div>
          </div>`;
        slot.querySelector('#fgNext').onclick = () => { flowStage++; runStage(); };
        // 关卡不是答题：这一步是拦「要不要继续下一步」的最佳时机
        answering = false;
        reportPhase();
      }

      // 四步全部走完：记一次今日完成，并维护连续天数
      function finishFlow() {
        const slot = root.querySelector('#cardSlot');
        if (!slot) return;
        flowOn = false;   // 流程已结束：再回「学习」应看到今日完成页/首页，而非续上
        let ok = 0, no = 0;
        flowStats.forEach(s => { ok += (s && s.ok) || 0; no += (s && s.no) || 0; });
        const total = ok + no;
        const acc = total ? Math.round(ok / total * 100) : 0;
        const d = flowExtra ? store.getDaily() : store.markTodayDone();
        slot.innerHTML = `
          <div class="card center">
            <div class="bignum">${ok}/${total}</div>
            <p class="encourage">🎉 今日四步流程全部完成（${flowWords.length} 词 × 4 步），总正确率 ${acc}%</p>
            <p class="hint">${FLOW_STAGES.map((s, i) => `${i + 1}. ${s.label} ${flowStats[i] ? flowStats[i].ok + '✓ / ' + flowStats[i].no + '✗' : ''}`).join(' · ')}</p>
            <div class="post-hint">这 ${flowWords.length} 个词已经进入复习计划，明天会自动安排回炉。连续学习 <b>${d.streak || 0}</b> 天${flowExtra ? '（本轮为额外练习，未计入今日）' : ''}</div>
            <div class="row-center" style="margin-top:14px">
              <button class="btn soft" id="ffHome">返回今日任务</button>
              <button class="btn ghost" id="ffReview">去复习今天的词</button>
            </div>
          </div>`;
        slot.querySelector('#ffHome').onclick = () => { flowOn = false; renderHome(); renderDailyInfo(); };
        slot.querySelector('#ffReview').onclick = () => nav.go('review');
        answering = false;
        reportPhase();
      }
    }

    // ================= 测评 =================
    function renderAssessment(ctx) {
      const { root, store, speech, corpus, actions, nav } = ctx;

      // 只考学过的词：优先今天学的，不足再从更早学过的补；题量跟随每日词量
      const goal = store.getDaily().goal || 10;
      const dayStart = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
      const learned = store.getLearned().map(w => {
        const e = findEntry(w.word) || {};
        return { word: w.word, zh: w.zh, pos: w.pos || e.pos, gender: w.gender || e.gender, ex: e.ex || '', learnedAt: w.learnedAt || 0 };
      });
      const todayOnes = learned.filter(w => w.learnedAt >= dayStart);
      const olderOnes = learned.filter(w => w.learnedAt < dayStart);

      let srcNote = '';
      let base = [];
      if (learned.length) {
        base = [].concat(shuffle(todayOnes), olderOnes);
        srcNote = `已学 ${learned.length} 词 · 今天学的 ${todayOnes.length} 词优先考`;
      } else {
        base = store.getWords().map(w => ({ ...w, ex: (findEntry(w.word) || {}).ex || '', learnedAt: 0 }));
        srcNote = '还没走过今日流程，先拿生词本里的词测一下';
      }

      if (!base.length) {
        root.innerHTML = `
          <div class="mod-head">
            <div>
              <h2 class="mod-title">词汇量测评</h2>
              <p class="mod-sub">只考你真正学过的词，不拿没见过的词糊弄你</p>
            </div>
          </div>
          <div class="card center">
            <div class="bignum">0</div>
            <p class="encourage">还没有学过任何单词</p>
            <p class="hint">测评的题库来自你走过的「认词 / 记词」流程。先去每日学习走一遍（① 认词 → ② 记词），回来就能测了。</p>
            <div class="row-center" style="margin-top:var(--s4)">
              <button class="btn" id="asGo">去每日学习</button>
            </div>
          </div>`;
        root.querySelector('#asGo').onclick = () => nav.go('words');
        return;
      }

      // 题量 = 每日词量（最少 5 题，最多不超过题库）
      const Q = Math.max(5, Math.min(goal, base.length));
      const questions = base.slice(0, Q).map((w, i) => makeQuestion(TYPES[i % 4], w, base, corpus));

      let idx = 0, score = 0, combo = 0, comboMax = 0, correct = 0, vocabGain = 0, t0 = 0, canAdvance = false;
      // 测评只考「学过的词」，所以 addWord 分支几乎不会走 —— 老逻辑里 vocabGain 恒为 0。
      // 改为：先快照每题作答前是否已掌握，答对后若跨过掌握线才算「新掌握」。
      const MASTER_AT = 5;
      const isMastered = wd => {
        const r = store.getWords().find(x => x.word === wd);
        return !!r && ((r.mastery || 0) >= MASTER_AT || r.mastered === true);
      };
      const wasMastered = new Map(questions.map(q => [q.word, isMastered(q.word)]));
      const correctWords = [];

      root.innerHTML = `
        <div class="mod-head">
          <div>
            <h2 class="mod-title">词汇量测评</h2>
            <p class="mod-sub">${srcNote} · 本次 ${questions.length} 题 · 答错不扣分，只影响复习排期</p>
          </div>
        </div>
        <div class="card">
          <div class="as-top">
            <span class="hint" id="idx">1 / ${questions.length}</span>
            <span class="combo" id="combo"></span>
          </div>
          <div class="bar slim"><i id="prog" style="width:0%"></i></div>
          <div id="qBox"></div>
          <div class="feedback" id="fb"></div>
          <div class="row-end" id="navRow"></div>
          <div class="kb-hint" id="navKh"></div>
        </div>`;

      renderQ();

      function onKey(e) {
        if (e.target.tagName === 'INPUT') {
          // 填空：回车先提交，答完再按回车就进下一题（输入框里空格仍是空格）
          if (e.key === 'Enter') {
            e.preventDefault();
            if (canAdvance) advance(); else root.querySelector('#submitFill')?.click();
          }
          return;
        }
        if (canAdvance && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); advance(); return; }
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= 4) {
          const opts = root.querySelectorAll('#optBox .opt');
          if (opts[n - 1] && !opts[n - 1].disabled) opts[n - 1].click();
        }
      }
      document.addEventListener('keydown', onKey);
      cleanup = () => document.removeEventListener('keydown', onKey);

      function renderQ() {
        const q = questions[idx];
        const box = root.querySelector('#qBox');
        root.querySelector('#idx').textContent = `${idx + 1} / ${questions.length}`;
        root.querySelector('#prog').style.width = (idx / questions.length * 100) + '%';
        root.querySelector('#combo').textContent = combo >= 2 ? `连对 ×${comboMul(combo)}` : '';
        root.querySelector('#fb').textContent = '';
        root.querySelector('#fb').className = 'feedback';
        root.querySelector('#navRow').innerHTML = '';
        root.querySelector('#navKh').innerHTML = '';
        canAdvance = false;
        t0 = Date.now();

        if (q.type === 'fill') {
          box.innerHTML = `<div class="hint">根据中文写出西语词（忽略重音/大小写）</div>
            <div class="big-word">${q.prompt.zh}</div>
            <div class="hint">${q.prompt.hint}</div>
            <input class="input" id="fillIn" placeholder="输入西语词" autocomplete="off">
            <div class="row-end"><button class="btn" id="submitFill">提交</button></div>`;
          const inp = box.querySelector('#fillIn');
          inp.focus();
          box.querySelector('#submitFill').onclick = () => answer(norm(inp.value), q, null);
          return;
        }

        let head = '';
        if (q.type === 'meaning') head = `<div class="big-word">${q.prompt.word}</div><div class="hint">选正确中文释义</div>`;
        if (q.type === 'listen') {
          // 无可发声能力时降级为「按释义选」：否则题面只有「听发音」，用户毫无线索
          const canPlay = !speech.canSpeak || speech.canSpeak();
          head = canPlay
            ? `<div class="hint">听发音，选对应词 <button class="btn soft btn-sm" id="replay">重听</button></div>`
            : `<div class="hint">设备暂时无法发音，改为按释义选择</div><div class="big-word sm">${esc(q.zh)}</div>`;
        }
        if (q.type === 'cloze') head = `<div class="hint">完形填空（用这个词的例句）</div><div class="big-word sm">${q.prompt.sentence}</div>`;

        box.innerHTML = head + `<div class="opts" id="optBox"></div>`;
        if (q.type === 'listen') {
          speech.speak(q.prompt.word, 0.9);
          const rp = box.querySelector('#replay');
          if (rp) rp.onclick = () => speech.speak(q.prompt.word, 0.9);
        }
        const ob = box.querySelector('#optBox');
        q.options.forEach(o => {
          const b = document.createElement('button');
          b.className = 'opt'; b.textContent = o;
          b.onclick = () => {
            ob.querySelectorAll('button').forEach(x => x.disabled = true);
            const ok = norm(o) === norm(q.answer);
            b.classList.add(ok ? 'ok' : 'no');
            if (!ok) ob.querySelector(`[data-w="${cssEsc(q.answer)}"]`)?.classList.add('ok');
            answer(norm(o), q, ok);
          };
          b.dataset.w = o;
          ob.appendChild(b);
        });
      }

      function answer(userAns, q, uiOk) {
        if (canAdvance) return;   // 已作答：防止重复 Enter/空格把同一题算两次
        const ok = norm(userAns) === norm(q.answer);
        const rt = Date.now() - t0;
        const fb = root.querySelector('#fb');
        if (ok) {
          correct++; combo++; comboMax = Math.max(comboMax, combo);
          const mul = comboMul(combo);
          score += Math.round((10 + (rt < 3000 ? 2 : 0)) * mul);
          correctWords.push(q.word);
          if (!store.getWords().find(w => w.word === q.word)) {
            actions.addWord({ word: q.word, zh: q.zh, pos: q.pos, gender: q.gender });
            vocabGain++;
          } else store.bumpMastery(q.word, true);
          fb.textContent = `✓ ${ENC[Math.floor(Math.random() * ENC.length)]}` + (combo >= 2 ? `　连对 ×${mul}` : '');
          fb.className = 'feedback ok';
        } else {
          combo = 0;
          store.bumpMastery(q.word, false);
          const zhTip = (q.zh && q.zh !== q.answer) ? `（${q.zh}）` : '';
          fb.textContent = `✗ 正确答案：${q.answer}${zhTip} — 记住了，复习里会再排给你`;
          fb.className = 'feedback no';
        }
        canAdvance = true;
        const b = document.createElement('button');
        b.className = 'btn';
        b.textContent = idx === questions.length - 1 ? '看结果' : '下一题';
        b.onclick = advance;
        root.querySelector('#navRow').appendChild(b);
        const nk = root.querySelector('#navKh');
        if (nk) nk.innerHTML = '<span class="kbd">Enter</span> 或 <span class="kbd">空格</span> ' + (idx === questions.length - 1 ? '看结果' : '下一题');
      }

      function advance() {
        if (!canAdvance) return;
        idx++;
        if (idx >= questions.length) return finish();
        renderQ();
      }

      function finish() {
        const s = store.getSummary();
        // 真正的新掌握 = 答对了 + 作答前没掌握 + 现在跨过掌握线
        const newly = [...new Set(correctWords)].filter(wd => isMastered(wd) && !wasMastered.get(wd)).length;
        store.recordAssessment({ score, correct, total: questions.length, comboMax, vocabGain, newlyMastered: newly });
        const before = s.total - vocabGain;
        const milestones = [100, 500, 1000].filter(m => before < m && s.total >= m);
        root.innerHTML = `
          <div class="card summary">
            <h2 class="mod-title center">本次测评完成</h2>
            <div class="bignum">${correct}</div>
            <div class="encourage">答对 ${correct}/${questions.length} 词 · 累计 ${s.total} 词</div>
            ${newly ? `<div class="encourage">本次新掌握 ${newly} 词</div>` : ''}
            <div class="hint">得分 ${score} · 最高连对 ${comboMax} · 正确率 ${Math.round(correct / questions.length * 100)}%</div>
            <div class="bar"><i style="width:${s.pct}%"></i></div>
            <div>当前段位：<b class="brand">${s.level}</b>（${s.pct}% · 估算值）</div>
            ${milestones.map(m => `<div class="milestone">掌握词汇突破 ${m} 词</div>`).join('')}
            <div class="encourage">${s.total < 30 ? '好的开始，明天再来一组就稳了' : '保持节奏，词汇量正在稳步上涨'}</div>
            <div class="row-center" style="margin-top:var(--s4)">
              <button class="btn soft" id="again">再做一次</button>
              <button class="btn" id="back">去每日学习</button>
            </div>
          </div>`;
        root.querySelector('#again').onclick = () => nav.go('assessment');
        root.querySelector('#back').onclick = () => nav.go('words');
      }
    }

    // ================= 复习（FSRS） =================
    function renderReview(ctx) {
      const { root, store, speech, nav } = ctx;
      let queue = [], idx = 0, revealed = false, finished = false;
      let rated = [];
      const CAPS = [10, 20, 30, 50];
      let cap = store.getSettings().revCap || 20;

      cleanup = () => { document.onkeydown = null; };

      root.innerHTML = `
        <div class="mod-head">
          <div>
            <h2 class="mod-title">复习</h2>
            <p class="mod-sub">复习你每天学过的词：今天学的明天来，认得就拉长间隔直到掌握，不认得就立刻加回来</p>
          </div>
        </div>
        <div id="rvSlot"></div>`;

      const slot = root.querySelector('#rvSlot');
      renderHome();

      function renderHome() {
        // 复习内容 = 每天学过的词（今天新学的 + 往日学过到期该回来的）
        const st = store.getStudyStats();
        const q = store.getReviewQueue(cap, Math.min(10, Math.round(cap / 2)));
        if (!st.learned) {
          slot.innerHTML = `
            <div class="card center empty">
              <div class="empty-ic">↻</div>
              <p class="encourage">还没有学过单词</p>
              <p class="hint">复习的内容来自你每天学的词：今天学 → 明天来复习 → 认得就拉长间隔直到掌握，不认得就立刻加回来。先去走一遍今日学习吧。</p>
              <div class="row-center" style="margin-top:16px">
                <button class="btn" id="goBooks">去每日学习</button>
              </div>
            </div>`;
          slot.querySelector('#goBooks').onclick = () => nav.go('words');
          return;
        }

        slot.innerHTML = `
          <div class="card review-hero">
            <div class="rv-num">${q.review + q.fresh}</div>
            <div class="rv-num-label">今日待复习</div>
            <p class="hint" style="margin-top:6px">往日学的 ${q.review} · 今天新学 ${q.fresh}　（每天最多练 ${cap} 张）</p>
            <div class="upcoming">
              <div class="up-item"><b>${st.today}</b><span>今天新学</span></div>
              <div class="up-item"><b>${st.pending}</b><span>待复习</span></div>
              <div class="up-item"><b>${st.mastered}</b><span>已掌握</span></div>
            </div>
            <div class="daily-row" style="justify-content:center;margin-top:12px">
              <span class="daily-label">每日上限</span>
              <div class="seg goal-seg" id="capSeg">
                ${CAPS.map(c => `<button data-c="${c}">${c}</button>`).join('')}
              </div>
            </div>
            <div class="row-center" style="margin-top:18px">
              <button class="btn" id="rvStart">${q.review || q.fresh ? '开始复习' : '提前练几张'}</button>
              <button class="btn soft" id="rvBooks">去每日学习</button>
            </div>
          </div>
          ${statsCard()}`;

        slot.querySelectorAll('#capSeg button').forEach(b => {
          b.classList.toggle('on', +b.dataset.c === cap);
          b.onclick = () => { cap = +b.dataset.c; store.setSettings({ revCap: cap }); renderHome(); };
        });
        slot.querySelector('#rvStart').onclick = start;
        slot.querySelector('#rvBooks').onclick = () => nav.go('words');
      }

      function statsCard() {
        const all = store.getWords().filter(w => w.learnedAt);
        const now = Date.now();
        let d0 = 0, d1 = 0, d7 = 0;
        all.forEach(w => {
          if (!w.due) return;
          const d = (w.due - now) / DAY;
          if (d <= 0) d0++; else if (d <= 1) d1++; else if (d <= 7) d7++;
        });
        const rows = WORD_BOOKS.filter(b => all.some(w => w.book === b.id)).map(b => {
          const p = store.bookProgress(b.words);
          const pct = p.total ? Math.round(p.scheduled / p.total * 100) : 0;
          return `
            <div class="stat-row">
              <span class="lvl lvl-${b.level}">${b.level}</span>
              <span class="stat-name">${b.name}</span>
              <span class="stat-bar"><i style="width:${pct}%"></i></span>
              <span class="hint">${p.scheduled}/${p.total}</span>
            </div>`;
        }).join('');

        return `
          <div class="card">
            <div class="wc-top"><b style="font-size:14px">复习节奏</b><span class="hint">已学 ${all.length} 词</span></div>
            <div class="upcoming">
              <div class="up-item"><b>${d0}</b><span>今天</span></div>
              <div class="up-item"><b>${d1}</b><span>明天</span></div>
              <div class="up-item"><b>${d7}</b><span>7 天内</span></div>
            </div>
            ${rows ? `<div class="stat-list">${rows}</div>` : ''}
          </div>`;
      }

      function start() {
        const r = store.getReviewQueue(cap, Math.min(10, Math.round(cap / 2)));
        queue = r.queue;
        if (!queue.length) {
          const all = store.getWords().filter(w => w.due).sort((a, b) => a.due - b.due);
          queue = all.slice(0, Math.min(cap, 10));
          if (!queue.length) { renderHome(); return; }
        }
        idx = 0; revealed = false; finished = false; rated = [];
        renderCard();
      }

      function renderCard() {
        if (idx >= queue.length) { renderDone(); return; }
        const w = queue[idx];
        const entry = findEntry(w.word);
        const ipa = entry && entry.ipa ? entry.ipa : '';
        const meta = entry ? posLabel(entry.pos, entry.gender) : (w.pos ? posLabel(w.pos, w.gender) : '');
        const mastery = w.mastery || 0;

        slot.innerHTML = `
          <div class="card rv-card">
            <div class="wc-top">
              <span class="hint">复习 ${idx + 1}/${queue.length}</span>
              <span class="dots" title="熟练度">${'●'.repeat(mastery)}${'○'.repeat(5 - mastery)}</span>
            </div>
            <div class="rv-word">${w.word}</div>
            ${ipa ? `<div class="ipa">${ipa}</div>` : ''}
            ${meta ? `<div class="rv-meta">${meta}</div>` : ''}
            <div class="rv-zh">${revealed
              ? `<span class="zh">${w.zh || (entry && entry.zh) || ''}</span>`
              : `<button class="btn soft btn-sm" id="rvShow">显示释义</button>`}</div>
            ${revealed ? grammarHtml(entry || { es: w.word, zh: w.zh, pos: w.pos, gender: w.gender }) : ''}
            ${revealed ? `
              <div class="rate-bar">
                <button class="rate no" data-g="0">忘记了</button>
                <button class="rate hard" data-g="1">有点难</button>
                <button class="rate ok" data-g="2">记住了</button>
              </div>
              <div class="hint rv-hint">快捷键：1 忘记 · 2 模糊 · 3 记住</div>`
              : `<div class="hint rv-hint">先回想一下，再点开释义（空格也可）</div>`}
          </div>
          <div class="row-between">
            <button class="btn ghost" id="rvPlay">🔊 听发音</button>
            <button class="btn soft" id="rvQuit">结束本轮</button>
          </div>`;

        slot.querySelector('#rvPlay').onclick = () => speech.speak(w.word, 0.9);
        slot.querySelector('#rvQuit').onclick = renderHome;

        if (!revealed) {
          slot.querySelector('#rvShow').onclick = () => { revealed = true; renderCard(); };
        } else {
          slot.querySelectorAll('.rate').forEach(b => b.onclick = () => rate(+b.dataset.g));
        }
        bindGrammar(slot, speech);
        bindKeys();
      }

      function bindKeys() {
        document.onkeydown = (e) => {
          if (finished) return;
          if (!revealed) {
            if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); revealed = true; renderCard(); }
            return;
          }
          if (e.key === '1') rate(0);
          else if (e.key === '2') rate(1);
          else if (e.key === '3') rate(2);
        };
      }

      function rate(g) {
        const w = queue[idx];
        const r = store.scheduleWord(w.word, g);
        rated.push(g);
        const label = g === 0 ? `没认出来，明天再来（${r.iv} 天后）`
          : (g === 1 ? `有点难，${r.iv} 天后再复习`
            : (r.iv >= 21 ? `差不多掌握了，${r.iv} 天后再见` : `记住了，${r.iv} 天后再复习`));
        const tone = g === 0 ? 'no' : (g === 1 ? 'hard' : 'ok');
        slot.querySelector('.rv-card').insertAdjacentHTML('beforeend',
          `<div class="feedback ${tone} rv-fb">${label}</div>`);
        slot.querySelectorAll('.rate').forEach(b => b.disabled = true);
        setTimeout(() => {
          idx++; revealed = false;
          if (idx >= queue.length) renderDone();
          else renderCard();
        }, 900);
      }

      function renderDone() {
        finished = true;
        document.onkeydown = null;
        const good = rated.filter(g => g === 2).length;
        const hard = rated.filter(g => g === 1).length;
        const again = rated.filter(g => g === 0).length;
        const left = store.getDueCount();
        slot.innerHTML = `
          <div class="card center">
            <div class="bignum">${rated.length}</div>
            <p class="encourage">本轮复习完成</p>
            <div class="rv-sum">
              <span class="pill ok">记住 ${good}</span>
              <span class="pill hard">模糊 ${hard}</span>
              <span class="pill no">忘记 ${again}</span>
            </div>
            <p class="hint">${left ? `还有 ${left} 张等着复习，可以再来一轮` : '今天的复习全部完成，明天见'}</p>
            <div class="row-center" style="margin-top:16px">
              ${left ? `<button class="btn" id="again">再来一轮</button>` : ''}
              <button class="btn soft" id="home">返回</button>
            </div>
          </div>`;
        if (left) slot.querySelector('#again').onclick = start;
        slot.querySelector('#home').onclick = renderHome;
      }
    }

    // ================= 统计：热力图 + 掌握 + 错词重练 =================
    function renderStats(ctx) {
      const { root, store, speech } = ctx;
      // 错词重练会挂 document.onkeydown；离开「统计」子视图时必须摘掉，否则在别的页面按 1/2/3 会误触发
      cleanup = () => { document.onkeydown = null; };
      const stats = store.getStudyStats();
      const activity = store.getActivity(30);
      const dist = store.getMasteryDist();
      const wrongs = store.getWrongWords(10);
      const maxAct = Math.max(1, ...activity.map(a => a.learned + a.reviewed));
      const maxBar = Math.max(1, ...dist);
      // 热力图色阶交给 CSS 类（.hm-0..4，跟随主题），不再写死浅色十六进制——否则夜色主题下空格很突兀
      const cellLv = d => {
        if (!d.learned && !d.reviewed) return 0;
        const t = (d.learned + d.reviewed) / maxAct;
        if (t < 0.2) return 1;
        if (t < 0.5) return 2;
        if (t < 0.8) return 3;
        return 4;
      };
      const cells = activity.map(d => {
        const tip = `${new Date(d.date).toLocaleDateString()} · 学${d.learned} 复${d.reviewed}${d.acc != null ? ' · 正确 ' + d.acc + '%' : ''}`;
        return `<div class="hm hm-${cellLv(d)}" title="${esc(tip)}" aria-label="${esc(tip)}"></div>`;
      }).join('');

      root.innerHTML = `
        <div class="mod-head">
          <div>
            <h2 class="mod-title">学习统计</h2>
            <p class="mod-sub">连续 30 天的活跃、掌握分布、错词本</p>
          </div>
        </div>
        <div class="stat-grid">
          <div class="stat-card"><div class="stat-n">${stats.learned}</div><div class="stat-l">学过</div></div>
          <div class="stat-card"><div class="stat-n">${stats.today}</div><div class="stat-l">今日新学</div></div>
          <div class="stat-card"><div class="stat-n">${stats.pending}</div><div class="stat-l">待复习</div></div>
          <div class="stat-card"><div class="stat-n">${stats.mastered}</div><div class="stat-l">已掌握</div></div>
        </div>

        <div class="card">
          <div class="type-divider"><span>30 天活跃</span><span class="hint">颜色越深代表当天学的 / 复习的越多</span></div>
          <div class="hm-grid">${cells}</div>
          <div class="hm-range"><span>30 天前</span><span>今天</span></div>
          <div class="hm-legend">
            <span>少</span>
            <span class="hm hm-0"></span><span class="hm hm-1"></span><span class="hm hm-2"></span><span class="hm hm-3"></span><span class="hm hm-4"></span>
            <span>多</span>
          </div>
        </div>

        <div class="card">
          <div class="type-divider"><span>掌握分布</span><span class="hint">熟练度 0 → 5，越右越熟</span></div>
          <div class="md-bars">
            ${dist.map((n, i) => {
              const h = n === 0 ? 4 : Math.max(10, Math.round(n / maxBar * 100));
              return `<div class="md-col">
                <div class="md-n">${n}</div>
                <div class="md-bar" style="height:${h}%"></div>
                <div class="md-l">${['刚学', '还生', '眼熟', '较熟', '熟练', '掌握'][i] || i}</div>
              </div>`;
            }).join('')}
          </div>
        </div>

        <div class="card">
          <div class="type-divider"><span>错词本</span><span class="hint">${wrongs.length ? wrongs.length + ' 个待巩固' : '目前没有错词，多棒'}</span></div>
          ${wrongs.length ? `
            <div class="ww-list">
              ${wrongs.map((w, i) => `<div class="ww-row" data-w="${esc(w.word)}"><span class="ww-i">${i + 1}</span><span class="ww-es">${esc(w.word)}</span><span class="ww-zh">${esc(w.zh || '')}</span><span class="ww-lap">错 ×${w.wrongs}</span></div>`).join('')}
            </div>
            <div class="row-center" style="margin-top:14px"><button class="btn" id="wwDrill">开始错词重练</button></div>
          ` : `<p class="hint" style="margin-top:6px">复习时按「忘记了」的词会自动进来</p>`}
        </div>

        <div id="drillSlot"></div>`;

      root.querySelectorAll('.ww-row').forEach(r => {
        r.onclick = () => {
          const info = findEntry(r.dataset.w) || { es: r.dataset.w, zh: '' };
          showWordPopup(info.es);
        };
      });
      const drillBtn = root.querySelector('#wwDrill');
      if (drillBtn) drillBtn.onclick = startWrongDrill;

      function startWrongDrill() {
        const list = store.getWrongWords(10);
        const slot = root.querySelector('#drillSlot');
        if (!list.length) { slot.innerHTML = '<p class="hint" style="margin-top:12px">已经没有可重练的错词，去复习时按住「记住了」+1 巩固它</p>'; return; }
        let i = 0, hits = 0, revealed = false;
        function draw() {
          if (i >= list.length) {
            slot.innerHTML = `
              <div class="card center">
                <div class="bignum">${hits}/${list.length}</div>
                <p class="encourage">${hits >= list.length * 0.8 ? '这轮错词被清掉了不少' : '再来一次，把不熟的彻底拿下'}</p>
                <div class="row-center" style="margin-top:14px">
                  <button class="btn" id="wwAgain">再来一次</button>
                  <button class="btn soft" id="wwBack">返回统计</button>
                </div>
              </div>`;
            document.onkeydown = null;
            slot.querySelector('#wwAgain').onclick = startWrongDrill;
            slot.querySelector('#wwBack').onclick = () => { document.onkeydown = null; slot.innerHTML = ''; };
            return;
          }
          const w = list[i];
          slot.innerHTML = `
            <div class="card">
              <div class="wc-top"><span class="hint">错词重练 ${i + 1}/${list.length}</span><span class="hint">命中 ${hits}</span></div>
              <div class="rv-word">${esc(w.word)}</div>
              <div class="ipa">${esc(ipaOf({ es: w.word }))}</div>
              <div class="rv-zh">${revealed
                ? `<span class="zh">${esc(w.zh || '')}</span>`
                : `<button class="btn soft btn-sm" id="wwShow">显示释义</button>`}</div>
              ${revealed ? `
                <div class="rate-bar">
                  <button class="rate no" data-g="0">忘记了</button>
                  <button class="rate hard" data-g="1">有点难</button>
                  <button class="rate ok" data-g="2">记住了</button>
                </div>
                <div class="hint rv-hint">快捷键：1 忘记 · 2 模糊 · 3 记住</div>` : `<div class="hint rv-hint">先回想一下，再点开释义</div>`}
              <div class="row-between" style="margin-top:14px">
                <button class="btn ghost" id="wwPlay">🔊 听发音</button>
                <button class="btn soft" id="wwQuit">结束本轮</button>
              </div>
            </div>`;
          slot.querySelector('#wwPlay').onclick = () => speech.speak(w.word, 0.9);
          slot.querySelector('#wwQuit').onclick = () => { slot.innerHTML = ''; document.onkeydown = null; };
          if (!revealed) {
            slot.querySelector('#wwShow').onclick = () => { revealed = true; draw(); };
            document.onkeydown = e => {
              if (!slot.isConnected) { document.onkeydown = null; return; }
              if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); revealed = true; draw(); }
            };
          } else {
            slot.querySelectorAll('.rate').forEach(b => b.onclick = () => {
              const g = +b.dataset.g;
              if (g === 2) hits++;
              store.scheduleWord(w.word, g);
              if (g === 2) store.reduceLapse(w.word);
              i++; revealed = false; draw();
            });
            document.onkeydown = e => {
              if (!slot.isConnected) { document.onkeydown = null; return; }
              if (e.key === '1') slot.querySelector('.rate.no')?.click();
              else if (e.key === '2') slot.querySelector('.rate.hard')?.click();
              else if (e.key === '3') slot.querySelector('.rate.ok')?.click();
            };
          }
          if (revealed) setTimeout(() => speech.speak(w.word, 0.9), 200);
        }
        draw();
      }
    }

    // ================= 语法：变位 + 冠词速练 =================
    function renderGrammar(ctx) {
      const { root, store, speech } = ctx;
      const REF = [
        { t: '-ar 动词（hablar）', d: 'hablo · hablas · habla · hablamos · habláis · hablan' },
        { t: '-er 动词（comer）', d: 'como · comes · come · comemos · coméis · comen' },
        { t: '-ir 动词（vivir）', d: 'vivo · vives · vive · vivimos · vivís · viven' },
        { t: '靴型词干变化', d: 'e→ie / o→ue / e→i，只变 yo、tú、él、ellos，nosotros 和 vosotros 不变' },
        { t: '名词冠词', d: '-o 多为阳性 el，-a 多为阴性 la；-ción / -dad / -umbre 几乎必为阴性' },
        { t: '阳性但 -a 结尾', d: 'el día · el mapa · el problema · el sistema · el programa' },
        { t: '阴性却用 el', d: 'el agua · el alma · el hambre（首音节重读的 a- 开头，复数恢复 las）' },
        { t: '阴性但 -o 结尾', d: 'la mano · la foto · la moto · la radio（少数例外，单独记）' },
      ];

      let mode = 'verb';       // verb | noun
      let qs = [], qi = 0, score = 0, answered = null;

      root.innerHTML = `
        <div class="mod-head">
          <div>
            <h2 class="mod-title">语法速练</h2>
            <p class="mod-sub">西语真正的两个坑：动词变位、名词冠词性别。练到不假思索为止</p>
          </div>
        </div>
        <div class="seg" id="gSeg">
          <button data-m="verb">动词变位</button>
          <button data-m="noun">名词冠词</button>
        </div>
        <div id="gBody"></div>
        <div class="card" id="gRef">
          <div class="type-divider"><span>规则速查</span></div>
          ${REF.map(r => `<div class="rf-row"><span class="rf-t">${esc(r.t)}</span><span class="rf-d">${esc(r.d)}</span></div>`).join('')}
        </div>`;

      root.querySelectorAll('#gSeg button').forEach(b => {
        b.onclick = () => { mode = b.dataset.m; bindSeg(); start(); };
      });
      function bindSeg() {
        root.querySelectorAll('#gSeg button').forEach(b => b.classList.toggle('on', b.dataset.m === mode));
      }

      function pool() {
        const learned = (store.getWords() || []).filter(w => w.learnedAt);
        const src = learned.length
          ? learned.map(w => Object.assign({ es: w.word }, findEntry(w.word) || {}, w))
          : WORD_BOOKS[0].words.slice(0, 120);
        return src.filter(w => mode === 'verb' ? w.pos === 'v' : w.pos === 'n');
      }

      function build() {
        const p = pool();
        const out = [];
        shuffle(p).forEach(w => {
          if (out.length >= 10) return;
          if (mode === 'verb') {
            const c = conjugate(w.es);
            const idxs = c.forms.map((f, i) => f ? i : -1).filter(i => i >= 0);
            if (idxs.length < 4) return;
            const pick = idxs[Math.floor(Math.random() * idxs.length)];
            const right = c.forms[pick];
            const others = shuffle(idxs.filter(i => i !== pick)).slice(0, 3).map(i => c.forms[i]);
            if (others.length < 3) return;
            out.push({
              w, kind: 'verb', pick, right,
              options: shuffle([right, ...others]),
              prompt: `${PRON_SHORT[pick]}（${['我', '你', '他/她/您', '我们', '你们', '他们'][pick]}）`,
            });
          } else {
            const g = w.gender || genderGuess(w.es).g;
            const a = articleFor(w.es, g);
            const pl = pluralOf(w.es);
            const wrong = a.art === 'el' ? 'la' : 'el';
            const plArt = a.art === 'el' ? 'los' : 'las';
            const wrongPl = plArt === 'los' ? 'las' : 'los';
            const right = `${a.art} ${w.es}`;
            const cand = [right, `${wrong} ${w.es}`, `${plArt} ${pl}`, `${wrongPl} ${pl}`];
            const uniq = [];
            cand.forEach(c => { if (c && !uniq.includes(c)) uniq.push(c); });
            if (uniq.length < 4) return;
            out.push({ w, kind: 'noun', right, options: shuffle(uniq), prompt: `${w.zh || w.es}` , note: a.note });
          }
        });
        return out;
      }

      function start() {
        qs = build(); qi = 0; score = 0; answered = null;
        render();
      }

      function render() {
        const box = root.querySelector('#gBody');
        if (!qs.length) {
          box.innerHTML = `<div class="card center"><p class="hint">${mode === 'verb' ? '还没有学过的动词' : '还没有学过的名词'}，先去「学习」走一轮再来</p>
            <div class="row-center" style="margin-top:12px"><button class="btn" id="gGo">去学习</button></div></div>`;
          box.querySelector('#gGo').onclick = () => show('words');
          return;
        }
        if (qi >= qs.length) {
          box.innerHTML = `
            <div class="card center">
              <div class="bignum">${score}/${qs.length}</div>
              <p class="encourage">${score >= qs.length * 0.8 ? '很稳，这两个坑踩不动你了' : '再练两轮，形成肌肉记忆'}</p>
              <div class="row-center" style="margin-top:16px">
                <button class="btn" id="gAgain">再来一轮</button>
                <button class="btn soft" id="gBack">换一种</button>
              </div>
            </div>`;
          box.querySelector('#gAgain').onclick = start;
          box.querySelector('#gBack').onclick = () => { mode = mode === 'verb' ? 'noun' : 'verb'; bindSeg(); start(); };
          return;
        }
        const q = qs[qi];
        box.innerHTML = `
          <div class="card">
            <div class="wc-top">
              <span class="hint">${mode === 'verb' ? '动词变位' : '名词冠词'} ${qi + 1}/${qs.length}</span>
              <span class="hint">已对 ${score}</span>
            </div>
            <div class="gq-p">${esc(q.prompt)}</div>
            <div class="gq-sub">${esc(mode === 'verb' ? q.w.es + ' · ' + (q.w.zh || '') : q.w.es)}</div>
            <div class="opt-list">
              ${q.options.map((o, i) => `<button class="opt" data-i="${i}">${esc(o)}</button>`).join('')}
            </div>
            <div id="gFb"></div>
          </div>`;
        box.querySelectorAll('.opt').forEach(b => {
          b.onclick = () => pick(q, +b.dataset.i, box);
        });
        if (mode === 'verb') setTimeout(() => speech.speak(q.right, 0.9), 200);
      }

      function pick(q, i, box) {
        const val = q.options[i];
        const ok = val === q.right;
        if (ok) score++;
        box.querySelectorAll('.opt').forEach((b, bi) => {
          if (q.options[bi] === q.right) b.classList.add('right');
          else if (bi === i) b.classList.add('wrong');
          b.disabled = true;
        });
        const c = mode === 'verb' ? conjugate(q.w.es) : null;
        box.querySelector('#gFb').innerHTML = `
          <div class="fb ${ok ? 'ok' : 'no'}">${ok ? '对了' : '正确答案是 ' + esc(q.right)}</div>
          ${mode === 'verb' && c ? `
            <div class="gj">
              <div class="gj-h">${esc(q.w.es)} 现在时变位</div>
              <div class="gj-grid">
                ${c.forms.map((f, k) => f ? `<div class="gj-row ${k === q.pick ? 'hl' : ''}"><span class="gj-p">${esc(PRON_SHORT[k])}</span><button class="gj-f" data-say="${esc(f)}">${esc(f)}</button></div>` : '').join('')}
              </div>
              <p class="gj-note">${esc(c.note)}</p>
            </div>` : `<p class="gj-note">${esc(q.note || '')}</p>`}
          <div class="row-center" style="margin-top:12px">
            <button class="btn" id="gNext" data-next>${qi + 1 >= qs.length ? '看结果' : '下一题'}</button>
          </div>
          <div class="kb-hint"><span class="kbd">Enter</span> 或 <span class="kbd">空格</span> 下一题</div>`;
        bindGrammar(box, speech);
        box.querySelector('#gNext').onclick = () => { qi++; render(); };
        if (!ok) setTimeout(() => speech.speak(q.right, 0.85), 120);
      }

      bindSeg();
      start();
    }

    // ---------- 公共工具 ----------
    // 音标：手写的优先，没有就用规则生成，保证每个词都有读音参考
    function ipaOf(w) { return (w && (w.ipa || (findEntry(w.es) || {}).ipa)) || esIpa(w.es); }
    // 完形填空挖空：不能用 \b —— JS 的 \b 以 ASCII 为准，á é í ó ú ñ 会被当成非单词字符，
    // 导致 café / está 这类重音词匹配失败、答案原样留在句子里。改用 \p{L} 词边界（u 标志）。
    function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, c => '\\' + c); }
    function blankWord(sent, word) {
      if (!word) return sent;
      try {
        const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${escRe(word)})([^\\p{L}\\p{N}]|$)`, 'iu');
        return String(sent).replace(re, (m, a, b, c) => a + '_____' + c);
      } catch { return String(sent); }
    }
    function esc(s) { return (s == null ? '' : String(s)).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
    function normAcc(s) { return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    function checkEs(val, target) {
      const a = (val || '').trim().toLowerCase(), b = (target || '').trim().toLowerCase();
      if (a === b) return { correct: true, accent: false };
      if (normAcc(a) === normAcc(b)) return { correct: true, accent: true };
      return { correct: false };
    }
    function paintCompare(val, target, reveal) {
      const v = val || '', t = target || '';
      const n = Math.max(v.length, t.length);
      let html = '', accentNote = false;
      for (let i = 0; i < n; i++) {
        const inC = v[i], tgC = t[i];
        if (inC === undefined) {
          if (reveal) html += `<span class="cd">${esc(tgC)}</span>`;
          else break;
        } else if (tgC === undefined) {
          html += `<span class="cw">${esc(inC)}</span>`;
        } else if (inC === tgC) {
          html += `<span class="cm">${esc(inC)}</span>`;
        } else if (normAcc(inC) === normAcc(tgC)) {
          html += `<span class="ca">${esc(tgC)}</span>`; accentNote = true;
        } else {
          html += `<span class="cw">${esc(tgC)}</span>`;
        }
      }
      return { html, accentNote };
    }
    function posLabel(pos, gender) {
      if (pos === 'n') return `名词 · ${gender === 'f' ? '阴性' : '阳性'}`;
      const map = { v: '动词', adj: '形容词', adv: '副词', conj: '连词', intj: '感叹词', prep: '介词' };
      return map[pos] || pos || '';
    }
    function pronTip(s) {
      if (s.includes('rr')) return 'rr 是大舌颤音，舌尖轻抵上颚快速颤动（多练 tr/dr 带动）';
      if (/[áéíóú]/.test(s)) return '带重音符号，重音就落在该音节上，务必重读';
      if (s.includes('ñ')) return 'ñ 发音似「捏」，舌面抬向硬腭，别读成 n';
      if (s.includes('ll')) return 'll 现代口语多发「y」音（yeísmo）';
      if (s.includes('j')) return 'j 发舌根摩擦音，像汉语「喝」；h 不发音';
      if (s.includes('z')) return 'z 在西班牙读 θ（似英语 th），拉美读 s';
      return '西语元音纯净固定，每个音节都读清楚，不要吞音';
    }
    // 取词条：优先返回「带例句」的那一份（同一词可能出现在多本词书里）
    function findEntry(word) {
      let fallback = null;
      for (const b of WORD_BOOKS) { const w = b.words.find(x => x.es === word); if (w) { if (w.ex) return w; fallback = fallback || w; } }
      return fallback;
    }
    function makeQ(pack, type) {
      const item = sample(pack.items, 1)[0];
      const others = pack.items.filter(x => x.word !== item.word);
      const options = shuffle([item, ...sample(others, 3)]);
      const label = { picword: '看图选词', listenpic: '听音选图', picspeak: '看图跟读' }[type];
      return { type, item, options, label };
    }
    function comboMul(c) { return c >= 4 ? 2.0 : c === 3 ? 1.5 : c === 2 ? 1.2 : 1.0; }
    function cssEsc(s) { return String(s).replace(/"/g, '&quot;'); }
    // 选项不够时从全词库补齐，避免出现只有 1 个选项的题
    function pickOpts(list, right, n, field) {
      const seen = new Set([right]); const out = [];
      const push = v => { if (v && !seen.has(v)) { seen.add(v); out.push(v); } };
      shuffle(list.filter(Boolean)).forEach(push);
      if (out.length < n) {
        shuffle(ALL_WORDS).forEach(x => { if (out.length < n) push(field === 'zh' ? x.zh : x.es); });
      }
      return shuffle([right, ...out.slice(0, n)]);
    }
    function makeQuestion(type, w, pool, corpus) {
      const field = type === 'meaning' ? 'zh' : 'word';
      const right = w[field];
      const others = (pool || []).filter(x => x.word !== w.word).map(o => o[field]);
      if (type === 'meaning' || type === 'listen') {
        return { type, word: w.word, zh: w.zh, pos: w.pos, gender: w.gender,
          prompt: { word: w.word },
          options: pickOpts(others, right, 3, field), answer: right };
      }
      if (type === 'fill') {
        return { type, word: w.word, zh: w.zh, pos: w.pos, gender: w.gender,
          prompt: { zh: w.zh, hint: '首字母 ' + (w.word[0] || '') + '…' }, options: [], answer: w.word };
      }
      // 完形：优先用这个单词自己的例句，其次语料库，最后兜底造句
      const own = w.ex || ((findEntry(w.word) || {}).ex) || '';
      const sent = own || (corpus.sentenceWith(w.word) || {}).es || '';
      const src = sent || `${w.word} es una palabra.`;
      return { type, word: w.word, zh: w.zh, pos: w.pos, gender: w.gender,
        prompt: { sentence: blankWord(src, w.word) },
        options: pickOpts(others, right, 3, field), answer: right };
    }

    const initial = (location.hash || '').replace('#', '');
    show(SUBVIEWS.some(v => v.k === initial) ? initial : 'words');
  },

  // 离开模块时停止上报：计时内核据此判定「不在练习视图」，立即暂停计时并落盘
  unmount() {
    if (clockRef) clockRef.setPhase({ view: null, busy: false, step: -1 });
  },
};
