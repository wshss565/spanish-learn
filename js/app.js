// 应用外壳：只负责「导航 + 全局进度 + 挂载模块」，不含任何业务逻辑
import { MODULES } from './modules/index.js';
import { bus, EVT } from './core/bus.js';
import * as store from './core/store.js';
import * as speech from './core/speech.js';
import * as corpus from './core/corpus.js';
import * as util from './core/util.js';
import * as clock from './core/clock.js';

const root = document.getElementById('view');
let currentId = null;
let currentMod = null;

// iOS/Safari 需要一次真实手势才能出声：第一次触摸/点击时解锁音频通道
['touchend', 'click', 'keydown'].forEach(ev =>
  document.addEventListener(ev, () => speech.unlock(), { once: true, capture: true }));

// 模块上下文：模块只能通过这些服务与外部交互（互不 import、互不直接调用）
function ctxFor() {
  return {
    root,
    bus, store, speech, corpus, util, clock,
    actions: {
      addWord(w) {
        store.addWord(w);
        bus.emit(EVT.VOCAB_CHANGED, store.getSummary());
      },
    },
    nav: { go },
    mountAgain() { mount(currentId); },
  };
}

function go(id) {
  if (!MODULES.some(m => m.id === id)) return;
  bus.emit(EVT.NAV_GO, id);
  mount(id);
}

function mount(id) {
  // 离开上一个模块时给它一次清理机会（如取消全局键盘监听）
  if (currentMod && typeof currentMod.unmount === 'function') {
    try { currentMod.unmount(); } catch (e) { /* 清理失败不影响导航 */ }
  }
  currentId = id;
  document.querySelectorAll('.sheet,.popup,.backdrop').forEach(n => n.remove());
  root.innerHTML = '';
  currentMod = MODULES.find(m => m.id === id);
  currentMod.mount(ctxFor());
  syncNav(id);
  renderProgress();
  renderRail();
  if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
  window.scrollTo(0, 0);
}

function syncNav(id) {
  document.querySelectorAll('[data-mod]').forEach(b =>
    b.classList.toggle('on', b.dataset.mod === id));
}

function renderProgress() {
  const s = store.getSummary();
  const chip = document.getElementById('progressChip');
  if (!chip) return;
  // 连击那格挂 .pc-streak：窄屏按类名精确隐藏（原来用 span:last-child，连击为 0 时会误藏「N 词」）
  chip.innerHTML = `<b>${s.level}</b><span>${s.total} 词</span>${s.streak ? `<span class="pc-streak">连学 ${s.streak} 天</span>` : ''}`;
}

// ===== 宽屏右栏「今日概览」=====
// 跳到模块内某个子视图：直接点已有的 subnav 按钮，不新增导航 API
function navToSubview(v) {
  const target = document.querySelector(`#subnav button[data-v="${v}"]`);
  if (target) target.click();
  else mount(currentId);            // 子导航尚未渲染时兜底
}

// 只在 ≥1240px 由 CSS 显示；窄屏元素存在但不可见，所以这里渲染也不影响手机。
// 窄屏要的进度信息已在首屏卡片里，不重复占位。
const railEl = document.getElementById('rail');
function renderRail() {
  if (!railEl) return;
  const st = store.getStudyStats();
  const si = store.streakInfo();
  const daily = store.getDaily();
  const goal = Math.max(1, daily.goal || 10);
  const pct = Math.min(100, Math.round(st.today / goal * 100));

  const note = si.done ? '今天已打卡，明天见'
    : si.atRisk ? '昨天打过卡，今天还没学'
    : si.broke ? '连击断了，今天重新开始'
    : '连续学习会累积连击';

  railEl.innerHTML = `
    <div class="card">
      <div class="rail-k">今日概览</div>
      <div class="rail-row"><span class="rail-name">连续学习</span><span class="rail-v">${si.streak}<i>天</i></span></div>
      <div class="rail-row"><span class="rail-name">今日进度</span><span class="rail-v">${st.today}<i>/ ${goal} 词</i></span></div>
      <span class="rail-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="今日学习进度"><i style="width:${pct}%"></i></span>
      <div class="rail-row"><span class="rail-name">待复习</span><span class="rail-v">${st.pending}<i>词</i></span></div>
      <div class="rail-row"><span class="rail-name">已掌握</span><span class="rail-v">${st.mastered}<i>词</i></span></div>
      <p class="rail-note" style="margin-top:var(--s3)">${note}</p>
    </div>
    <div class="rail-acts">
      <button class="btn" data-v="words">继续学习 →</button>
      <button class="btn soft" data-v="review">去复习</button>
    </div>
    <div class="rail-time" id="railTime"></div>`;

  // 右栏按钮复用模块内子导航
  railEl.querySelectorAll('[data-v]').forEach(b => {
    b.onclick = () => navToSubview(b.dataset.v);
  });

  // innerHTML 刚被整体重写，#railTime 是空的：立刻补上时长卡，避免闪一帧
  railShape = null;
  renderClockRail(clock.state());
}

// ===== 「学习时长」时间管控 =====
// 同一份状态（clock.state()）渲染到两个宿主，由 CSS 断点决定谁出现：
//   ≥1240px → 右栏第三块（宽卡片，与「今日概览」并列，一眼能看到）
//   <1240px → 右下角浮层气泡（手机没有右栏，只能浮着）
// 两处共用同一套动作绑定与状态机，避免两份逻辑各自长歪。
// 断点判定：老浏览器 / jsdom 可能没有 matchMedia，降级为「永远窄屏」而不是崩掉
const WIDE_MQ = (typeof window.matchMedia === 'function')
  ? window.matchMedia('(min-width:1240px)')
  : { matches: false, addEventListener() {}, addListener() {} };
function onWideChange(fn) {
  if (typeof WIDE_MQ.addEventListener === 'function') WIDE_MQ.addEventListener('change', fn);
  else if (typeof WIDE_MQ.addListener === 'function') WIDE_MQ.addListener(fn);
}
const CW_LIMITS = [0, 10, 15, 20, 30, 45, 60];
const CW_R = 26;
const CW_CIRC = 2 * Math.PI * CW_R;
const CW_RAIL_R = 23;                          // 右栏卡片里的小圆环
const CW_RAIL_CIRC = 2 * Math.PI * CW_RAIL_R;

let cwEl = null;
let cwOpen = false;        // 卡片是否展开
let cwSuppressed = false;  // 用户手动收起过：本轮不再自动弹（脱离上限态后复位）

function mountClockWidget() {
  cwEl = document.createElement('div');
  cwEl.className = 'cw';
  cwEl.id = 'clockWidget';
  cwEl.dataset.ui = 'normal';
  cwEl.innerHTML = `
    <div class="cw-slot"></div>
    <button class="cw-bubble" id="cwBubble" type="button" aria-label="学习时长">
      <svg class="cw-ring" viewBox="0 0 62 62" aria-hidden="true">
        <circle class="tr" cx="31" cy="31" r="${CW_R}"></circle>
        <circle class="pg" id="cwProg" cx="31" cy="31" r="${CW_R}" stroke-dasharray="0 ${CW_CIRC.toFixed(1)}"></circle>
      </svg>
      <span class="cw-face">
        <span class="cw-val" id="cwVal">0<i>′</i></span>
        <span class="cw-lab" id="cwLab">已学</span>
      </span>
    </button>`;
  document.body.appendChild(cwEl);

  cwEl.querySelector('#cwBubble').onclick = () => {
    cwOpen = !cwOpen;
    cwSuppressed = !cwOpen;      // 手动收起即视为「别烦我」，直到脱离上限态
    renderClockCard(clock.state());
  };

  clock.initClock({ store, onChange: syncClock });
  syncClock();
}

function syncClock() {
  const s = clock.state();
  renderClockRail(s);          // 右栏（宽屏）
  renderClockHero(s);          // 首页 hero（窄屏）
  if (cwEl) syncBubble(s);     // 右下角浮层（窄屏）
}

// ===== 手机端：首页 hero 内的「今日时长」条 =====
// 为什么需要它：右下角气泡在 ≤899px 只有 52px，实测被用户反馈「不仔细都没发现」；
// 而 hero 是手机上唯一必然被看到的位置。≥1240px 由右栏卡片承担，CSS 里隐藏此条避免重复。
let heroTimeSig = '';
function renderClockHero(s) {
  const host = document.getElementById('heroTime');
  if (!host) { heroTimeSig = ''; return; }
  if (WIDE_MQ.matches) return;              // 宽屏交给右栏

  const total = s.limitMin + s.extraUsed * 5;
  const sig = [s.ui, s.enabled ? 1 : 0, s.todayMin, s.remainMin, s.extraUsed, s.exempt ? 1 : 0].join('|');
  // host 会在每次 renderHome 时被整体重建（内容清空），所以「内容空了」也要重画
  if (sig === heroTimeSig && host.childElementCount) return;
  heroTimeSig = sig;

  let inner, aria;
  if (s.enabled && s.over) {
    inner = `<span class="ht-k">今日已学满</span><span class="ht-v">${s.todayMin}<i>/${total}′</i></span>`
      + `<span class="ht-n">${s.exempt ? '这一轮放行走完' : '明天见'}</span>`;
    aria = `今日学习时长已用满 ${total} 分钟`;
  } else if (s.enabled) {
    inner = `<span class="ht-k">今日还剩</span><span class="ht-v">${s.remainMin}<i>′</i></span>`
      + `<span class="ht-n">已学 ${s.todayMin} 分钟</span>`;
    aria = `今日剩余 ${s.remainMin} 分钟，已学 ${s.todayMin} 分钟`;
  } else {
    inner = `<span class="ht-k">今日已学</span><span class="ht-v">${s.todayMin}<i>′</i></span>`
      + `<span class="ht-n">未设上限 · 点这里设置</span>`;
    aria = `今日已学 ${s.todayMin} 分钟，尚未设置每日上限`;
  }

  host.className = 'hero-time' + (s.over ? ' over' : s.warn ? ' warn' : '');
  host.innerHTML = inner;
  host.setAttribute('role', 'button');
  host.setAttribute('tabindex', '0');
  host.setAttribute('aria-label', aria + '，点击调整每日上限');
  const openSet = () => {
    const p = document.getElementById('settingsPanel');
    if (p) p.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  host.onclick = openSet;
  host.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSet(); } };
}

function syncBubble(s) {
  cwEl.dataset.ui = s.ui;

  const ring = cwEl.querySelector('#cwProg');
  if (ring) ring.setAttribute('stroke-dasharray', `${(CW_CIRC * s.pct).toFixed(1)} ${CW_CIRC.toFixed(1)}`);

  const val = cwEl.querySelector('#cwVal');
  const lab = cwEl.querySelector('#cwLab');
  if (val && lab) {
    if (s.enabled && s.over) {
      val.textContent = '已满';
      lab.textContent = s.exempt ? '本轮放行' : (s.defer ? '这轮之后' : '今日');
    } else if (s.enabled) {
      val.innerHTML = `${s.remainMin}<i>′</i>`;
      lab.textContent = '剩余';
    } else {
      val.innerHTML = `${s.todayMin}<i>′</i>`;
      lab.textContent = '已学';
    }
  }

  if (!s.over) cwSuppressed = false;               // 脱离上限态后恢复自动提示
  if (s.showBlock && !cwSuppressed) cwOpen = true; // 到点自动展开阻断卡

  const bub = cwEl.querySelector('#cwBubble');
  if (bub) bub.setAttribute('aria-label', s.enabled
    ? (s.over ? '今日学习时长已达上限' : `今日剩余 ${s.remainMin} 分钟`)
    : `今日已学 ${s.todayMin} 分钟`);

  renderClockCard(s);
}

function renderClockCard(s) {
  const slot = cwEl && cwEl.querySelector('.cw-slot');
  if (!slot) return;
  if (!cwOpen) { slot.innerHTML = ''; return; }

  const total = s.limitMin + s.extraUsed * 5;
  const head = `<div class="cw-head"><h4>${s.over ? '今天已学满' : '今日学习时长'}</h4>` +
    `<button class="cw-x" id="cwX" type="button" aria-label="收起">−</button></div>`;

  let body;
  if (s.over && s.showBlock) {
    body = `
      <div class="cw-block">
        <div class="ic">⏳</div>
        <h5>今天就到这里</h5>
        <p class="cw-note">已学满 ${total} 分钟${s.extraUsed ? `（含续时 ${s.extraUsed * 5} 分钟）` : ''}。别用力过猛 —— 明天再来同样有效。</p>
      </div>
      <div class="cw-acts">
        <button class="btn soft" id="cwStop" type="button">结束今天</button>
        ${s.extraLeft > 0 ? `<button class="btn ghost" id="cwMore" type="button">再学 5 分钟 · 今日还剩 ${s.extraLeft} 次</button>` : ''}
      </div>`;
  } else {
    const note = s.exempt ? '正在最后一步「默写」—— 走完这一轮再收手。'
      : s.defer ? '正在这一轮练习中 —— 做完就提醒你收手。'
      : s.over ? '今天的额度用完了（本轮结束后收手）。'
      : s.enabled ? `还剩 ${s.remainMin} 分钟 · 学完这一组刚好`
      : '未设上限。想控时长，去设置里挑一个。';
    body = `
      <div class="cw-big"><b>${s.todayMin}</b><span>${s.enabled ? `/ ${total} 分钟` : '分钟'}</span></div>
      <div class="cw-bar"><i style="width:${Math.round(s.pct * 100)}%"></i></div>
      <p class="cw-note${(s.warn || s.over) ? ' warn' : ''}">${note}</p>
      <div class="cw-acts">
        <button class="btn soft" id="cwSet" type="button">调整上限</button>
        <button class="btn soft" id="cwReview" type="button">去复习</button>
      </div>`;
  }

  slot.innerHTML = `<div class="cw-card${s.over ? ' over' : s.warn ? ' warn' : ''}">${head}${body}</div>`;
  bindClockActions(slot, '');
}

// 气泡与右栏卡片共用同一套动作（sfx 区分 DOM id，'' = 气泡，'R' = 右栏）
function bindClockActions(root, sfx) {
  const on = (id, fn) => { const n = root.querySelector('#' + id + sfx); if (n) n.onclick = fn; };
  on('cwX', () => { cwOpen = false; cwSuppressed = true; syncClock(); });
  on('cwStop', () => {
    cwOpen = false; cwSuppressed = true; syncClock();
    showToast('今天到这里，明天见');
  });
  on('cwMore', () => { clock.extend(); cwSuppressed = false; syncClock(); showToast('已续 5 分钟，接着练'); });
  on('cwSet', () => {
    const p = document.getElementById('settingsPanel');
    if (p) p.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  on('cwReview', () => navToSubview('review'));
}

// ===== 右栏版：与「今日概览」并列的一张宽卡片 =====
// 形态签名：形态变了才重建结构，否则每秒只改数字（避免焦点丢失与动画重放）
let railShape = null;
function railShapeOf(s) {
  return [s.ui, s.showBlock ? 1 : 0, s.extraLeft, s.enabled ? 1 : 0].join('|');
}

function railCardHTML(s) {
  const cls = s.ui === 'over' ? ' over' : s.ui === 'warn' ? ' warn' : '';
  const top = `
    <div class="rail-cw-top">
      <div class="rail-k">今日学习时长</div>
      <div class="cw-mini">
        <svg class="cw-ring" viewBox="0 0 56 56" aria-hidden="true">
          <circle class="tr" cx="28" cy="28" r="${CW_RAIL_R}"></circle>
          <circle class="pg" cx="28" cy="28" r="${CW_RAIL_R}" stroke-dasharray="0 ${CW_RAIL_CIRC.toFixed(1)}"></circle>
        </svg>
        <span class="cw-mini-face"><span class="cw-mini-v"></span><span class="cw-mini-l"></span></span>
      </div>
    </div>`;

  if (s.showBlock) {
    return `<div class="cw-card rail-cw over">${top}
      <div class="cw-block">
        <div class="ic">⏳</div>
        <h5>今天就到这里</h5>
        <p class="cw-note"></p>
      </div>
      <div class="cw-acts">
        <button class="btn soft" id="cwStopR" type="button">结束今天</button>
        ${s.extraLeft > 0 ? `<button class="btn ghost" id="cwMoreR" type="button">再学 5 分钟 · 今日还剩 ${s.extraLeft} 次</button>` : ''}
      </div>
    </div>`;
  }

  return `<div class="cw-card rail-cw${cls}">${top}
    <div class="cw-big"><b></b><span></span></div>
    <div class="cw-bar"><i style="width:0%"></i></div>
    <p class="cw-note"></p>
    <div class="cw-acts">
      <button class="btn soft" id="cwSetR" type="button">调整上限</button>
      <button class="btn soft" id="cwReviewR" type="button">去复习</button>
    </div>
  </div>`;
}

function renderClockRail(s) {
  if (!railEl || !WIDE_MQ.matches) return;
  const host = railEl.querySelector('#railTime');
  if (!host) return;

  const shape = railShapeOf(s);
  if (shape !== railShape) {
    host.innerHTML = railCardHTML(s);
    railShape = shape;
    bindClockActions(host, 'R');
  }

  const total = s.limitMin + s.extraUsed * 5;
  const pg = host.querySelector('.cw-ring .pg');
  if (pg) pg.setAttribute('stroke-dasharray', `${(CW_RAIL_CIRC * s.pct).toFixed(1)} ${CW_RAIL_CIRC.toFixed(1)}`);

  const mv = host.querySelector('.cw-mini-v');
  const ml = host.querySelector('.cw-mini-l');
  if (mv && ml) {
    if (s.enabled && s.over) {
      mv.textContent = '已满';
      ml.textContent = s.exempt ? '本轮放行' : (s.defer ? '这轮之后' : '今日');
    } else if (s.enabled) {
      mv.innerHTML = `${s.remainMin}<i>′</i>`;
      ml.textContent = '剩余';
    } else {
      mv.innerHTML = `${s.todayMin}<i>′</i>`;
      ml.textContent = '已学';
    }
  }

  const note = host.querySelector('.cw-note');
  if (s.showBlock) {
    if (note) note.textContent = `已学满 ${total} 分钟${s.extraUsed ? `（含续时 ${s.extraUsed * 5} 分钟）` : ''}。别用力过猛 —— 明天再来同样有效。`;
  } else {
    const big = host.querySelector('.cw-big b');
    const unit = host.querySelector('.cw-big span');
    if (big) big.textContent = s.todayMin;
    if (unit) unit.textContent = s.enabled ? `分钟 · 上限 ${total}` : '分钟（未设上限）';
    const bar = host.querySelector('.cw-bar > i');
    if (bar) bar.style.width = Math.round(s.pct * 100) + '%';
    if (note) {
      note.textContent = s.exempt ? '正在最后一步「默写」—— 走完这一轮再收手。'
        : s.defer ? '正在这一轮练习中 —— 做完就提醒你收手。'
        : s.over ? '今天的额度用完了（本轮结束后收手）。'
        : s.enabled ? `还剩 ${s.remainMin} 分钟 · 学完这一组刚好`
        : '还没设上限。想控时长，挑一个档位。';
      note.className = 'cw-note' + ((s.warn || s.over) ? ' warn' : '');
    }
  }
  host.dataset.ui = s.ui;
}

// 设置面板里的「每日上限」分档
function renderLimitChips() {
  const box = document.getElementById('limitChips');
  if (!box) return;
  const cur = store.getSettings().dailyLimitMin || 0;
  box.innerHTML = CW_LIMITS.map(v =>
    `<button class="limit-chip${v === cur ? ' on' : ''}" data-min="${v}" type="button">${v === 0 ? '不限' : v + ' 分钟'}</button>`
  ).join('');
  box.querySelectorAll('.limit-chip').forEach(b => b.onclick = () => {
    clock.setLimit(+b.dataset.min);
    renderLimitChips();
    syncClock();
  });
  const hint = document.getElementById('limitHint');
  if (hint) hint.textContent = cur > 0
    ? `已设 ${cur} 分钟。右下角显示今日剩余时间，到点提醒收手；正在进行的这一轮练习会放行走完（尤其在最后一步「默写」）。`
    : '不限时长。设定后右下角会显示今日剩余时间，到点提醒收手。';
}


// 构建导航（桌面顶部 / 手机底部，同一份模块表驱动）
function buildNav() {
  const top = document.getElementById('topNav');
  const bottom = document.getElementById('bottomNav');
  // 单模块时隐藏外壳导航：模块内部已有 subnav 切换子视图
  if (MODULES.length <= 1) {
    top.hidden = true;
    bottom.hidden = true;
    return;
  }
  top.innerHTML = MODULES.map(m =>
    `<button class="navtab" data-mod="${m.id}">${m.name}</button>`).join('');
  bottom.innerHTML = MODULES.map(m =>
    `<button class="tabitem" data-mod="${m.id}"><i>${m.icon}</i><span>${m.short || m.name}</span></button>`).join('');
  document.querySelectorAll('[data-mod]').forEach(b => b.onclick = () => go(b.dataset.mod));
}

function bindSettings() {
  const btn = document.getElementById('settingsBtn');
  const panel = document.getElementById('settingsPanel');
  btn.onclick = () => panel.hidden = !panel.hidden;
  document.getElementById('resetBtn').onclick = () => {
    if (confirm('确定清空全部学习数据？词库与进度将不可恢复。')) {
      store.resetAll();
      renderProgress();
      clock.refresh();
      mount(currentId);
    }
  };

  // ===== 在线发音（云端神经 TTS）设置 =====
  const ttsToggle = document.getElementById('ttsToggle');
  const ttsOpts = document.getElementById('ttsOpts');
  const ttsProvider = document.getElementById('ttsProvider');
  const ttsKey = document.getElementById('ttsKey');
  const ttsRegion = document.getElementById('ttsRegion');
  const ttsVoice = document.getElementById('ttsVoice');
  const regionRow = document.getElementById('ttsRegionRow');
  const voiceRow = document.getElementById('ttsVoiceRow');

  function syncTtsUI() {
    const s = store.getSettings();
    const on = !!s.onlineTTS;
    ttsToggle.textContent = on ? '开' : '关';
    ttsToggle.classList.toggle('on', on);
    ttsOpts.style.display = on ? 'block' : 'none';
    ttsProvider.value = s.ttsProvider || 'azure';
    ttsKey.value = s.ttsKey || '';
    ttsRegion.value = s.ttsRegion || 'eastasia';
    ttsVoice.value = s.ttsVoice || '';
    regionRow.style.display = (s.ttsProvider || 'azure') === 'azure' ? 'flex' : 'none';
    voiceRow.style.display = (s.ttsProvider || 'azure') === 'eleven' ? 'flex' : 'none';
  }
  function pushTts() {
    const s = {
      onlineTTS: ttsToggle.classList.contains('on'),
      ttsProvider: ttsProvider.value,
      ttsKey: ttsKey.value.trim(),
      ttsRegion: ttsRegion.value.trim() || 'eastasia',
      ttsVoice: ttsVoice.value.trim(),
    };
    store.setSettings(s);
    speech.configure(s);
  }
  syncTtsUI();
  ttsToggle.onclick = () => { ttsToggle.classList.toggle('on'); pushTts(); syncTtsUI(); };
  // 点面板外面自动收起：仅当用户与内容卡片交互时收起，导航/分段/设置按钮区都不应误关
  // .rail / .cw / .hero-time 必须在白名单里：它们都带「调整上限」入口，不排除就会被自己的点击立刻关掉
  document.addEventListener('click', e => {
    if (panel.hidden) return;
    if (panel.contains(e.target) || btn.contains(e.target)) return;
    if (e.target.closest('.subnav, .seg, .tabs, #topNav, #bottomNav, .appbar, .daily-card, .rail, .cw, .hero-time')) return;
    panel.hidden = true;
  });
  ttsProvider.onchange = () => { regionRow.style.display = ttsProvider.value === 'azure' ? 'flex' : 'none'; voiceRow.style.display = ttsProvider.value === 'eleven' ? 'flex' : 'none'; pushTts(); };
  [ttsKey, ttsRegion, ttsVoice].forEach(el => el.oninput = () => pushTts());
  speech.configure(store.getSettings());

  // ===== 学习进度备份：导出 / 导入 =====
  document.getElementById('exportBtn').onclick = () => {
    const data = store.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    a.href = URL.createObjectURL(blob);
    a.download = `hola-es-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const fileInput = document.getElementById('importFile');
  document.getElementById('importBtn').onclick = () => fileInput.click();
  fileInput.onchange = () => {
    const f = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      let data;
      try { data = JSON.parse(r.result); }
      catch { alert('文件读不出来，请选择本站导出的 .json 备份'); return; }
      if (!confirm('导入会与当前进度合并（复习次数取多、到期取早），确认继续？')) return;
      try {
        const res = store.importData(data);
        renderProgress();
        clock.refresh();
        mount(currentId);
        alert(`导入成功，当前共 ${res.words} 个词。`);
      } catch (e) {
        alert('导入失败：' + (e && e.message || e));
      }
    };
    r.readAsText(f);
  };

  document.getElementById('helpBtn').onclick = () => showGuide();

  // ===== 主题：4 套玻璃外观（caliente / aurora / luz / nocturno），默认 nocturno =====
  const themeBtn = document.getElementById('themeBtn');
  const THEMES = [
    { key: 'caliente', name: '暖玻璃', emoji: '🔥', bg: '#FCEBD3',
      swatch: 'linear-gradient(135deg,#E0412A,#E8A33E)' },
    { key: 'aurora',   name: '极光',   emoji: '🌌', bg: '#EEF0FF',
      swatch: 'linear-gradient(135deg,#7C5CFF,#FF9EC4)' },
    { key: 'luz',      name: '晴白',   emoji: '☀️', bg: '#EAF2FB',
      swatch: 'linear-gradient(135deg,#E0613A,#2D9CDB)' },
    { key: 'nocturno', name: '夜色',   emoji: '🌙', bg: '#0B1020',
      swatch: 'linear-gradient(135deg,#1d274a 0%,#F4C430 100%)' },
  ];
  const THEME_BG = Object.fromEntries(THEMES.map(t => [t.key, t.bg]));
  function effectiveTheme() {
    const t = store.getSettings().theme;            // 'caliente'|'aurora'|'luz'|'nocturno'|旧'light'/'dark'|undefined
    if (t === 'caliente' || t === 'aurora' || t === 'luz' || t === 'nocturno') return t;
    if (t === 'light') return 'caliente';            // 兼容旧版浅色
    if (t === 'dark')  return 'nocturno';            // 兼容旧版深色
    return 'nocturno';                               // 默认夜色玻璃
  }
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  function applyTheme() {
    const t = effectiveTheme();
    document.documentElement.dataset.theme = t;
    const meta = THEMES.find(x => x.key === t) || THEMES[3];
    if (themeBtn) {
      themeBtn.textContent = meta.emoji;
      themeBtn.title = '当前主题：' + meta.name + ' · 点击切换下一款';
      themeBtn.setAttribute('aria-label', '切换主题（当前 ' + meta.name + '）');
    }
    if (metaTheme) metaTheme.setAttribute('content', THEME_BG[t] || '#0B1020');
    syncThemeCards();
  }
  function syncThemeCards() {
    const cur = effectiveTheme();
    document.querySelectorAll('.theme-card').forEach(c =>
      c.classList.toggle('on', c.dataset.theme === cur));
  }
  if (themeBtn) {
    themeBtn.onclick = () => {
      const idx = THEMES.findIndex(x => x.key === effectiveTheme());
      const next = THEMES[(idx + 1) % THEMES.length].key;
      store.setSettings({ theme: next });            // 手动选择后记住，不再跟随系统
      applyTheme();
    };
  }
  // 设置面板里的 4 张色卡：点击直接选主题
  const themeCards = document.getElementById('themeCards');
  if (themeCards) {
    themeCards.innerHTML = THEMES.map(t =>
      `<button class="theme-card" data-theme="${t.key}" title="${t.name}" aria-label="选择主题 ${t.name}">` +
        `<span class="theme-swatch" style="background:${t.swatch}"></span>` +
        `<span class="theme-name">${t.name}</span>` +
      `</button>`).join('');
    themeCards.querySelectorAll('.theme-card').forEach(c => c.onclick = () => {
      store.setSettings({ theme: c.dataset.theme });
      applyTheme();
    });
  }
  applyTheme();   // 默认 nocturno（不再跟随系统），首屏即夜色玻璃
  renderLimitChips();
}

/* ---------- 首屏引导 ---------- */
/* 修复：原先是一整段 alert() —— 系统弹窗没法排版、不能跳转，手机上尤其糟糕；
   而且新用户第一次进来面对空白页面没有任何引导，只能自己猜。 */
let guideEls = null;

function closeGuide() {
  if (!guideEls) return;
  guideEls.forEach(el => el.remove());
  guideEls = null;
  document.removeEventListener('keydown', onGuideKey);
}

function dismissGuide() {
  try { store.setSettings({ onboarded: true }); } catch { /* 存储不可用时也不该拦住用户 */ }
  closeGuide();
}

function onGuideKey(e) {
  if (e.key !== 'Escape') return;
  e.stopPropagation();
  dismissGuide();
}

function showGuide() {
  closeGuide();

  const bd = document.createElement('div');
  bd.className = 'backdrop';
  bd.onclick = dismissGuide;

  const sheet = document.createElement('div');
  sheet.className = 'sheet guide-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-modal', 'true');
  sheet.setAttribute('aria-label', '使用说明');
  sheet.innerHTML = `
    <div class="guide-title">每天走完四步就算打卡</div>
    <p class="guide-sub">选好词书和每日词量（5 / 10 / 15 / 20 / 30），按顺序走完下面四步，今日才算完成并记录连续天数。</p>

    <div class="guide-sec">
      <h3>今日四步</h3>
      <div class="guide-steps">
        <div class="guide-step"><b>1</b><span>认词：卡片自动发音，例句不配中文，点句子里的单词可查释义</span></div>
        <div class="guide-step"><b>2</b><span>记词：先自评「我会 / 我不会」，不会的排到队尾本轮再来</span></div>
        <div class="guide-step"><b>3</b><span>自测：选择题，只考今天这一组</span></div>
        <div class="guide-step"><b>4</b><span>默写：看中文写西语，想练拼写可切到「拼写练习」</span></div>
      </div>
    </div>

    <div class="guide-sec">
      <h3>其他模块</h3>
      <p class="guide-kv">
        <b>测评</b>：只考你学过的词（今天学的优先），题量跟随每日词量<br>
        <b>复习</b>：按遗忘曲线排期，可自己设每日上限<br>
        <b>语法</b>：变位 / 冠词 / 性数速练<br>
        <b>统计</b>：连续天数、活跃热力图、错词本
      </p>
    </div>

    <div class="guide-sec">
      <h3>要打 á é í ó ú ñ？</h3>
      <p class="guide-kv">输入框上方有一排西语符号键，点一下就插入到光标处，不用在手机上长按字母。</p>
    </div>

    <div class="guide-sec">
      <h3>键盘快捷键</h3>
      <p class="guide-kv">
        默写 / 拼写：<span class="kbd">Tab</span> 跳过 · <span class="kbd">\`</span> 标记掌握 · <span class="kbd">Enter</span> 确认 · <span class="kbd">Esc</span> 看答案<br>
        复习：<span class="kbd">空格</span> 显示释义，<span class="kbd">1</span> 忘记 / <span class="kbd">2</span> 模糊 / <span class="kbd">3</span> 记住<br>
        测评：<span class="kbd">1</span>–<span class="kbd">4</span> 选择选项，<span class="kbd">空格</span> / <span class="kbd">Enter</span> 下一题
      </p>
    </div>

    <div class="guide-foot">
      <button class="btn ghost" id="guideClose">知道了</button>
      <button class="btn" id="guideStart">开始学习 →</button>
    </div>`;

  document.body.append(bd, sheet);
  guideEls = [bd, sheet];
  document.addEventListener('keydown', onGuideKey);

  sheet.querySelector('#guideClose').onclick = dismissGuide;
  sheet.querySelector('#guideStart').onclick = () => {
    dismissGuide();
    if (currentId !== MODULES[0].id) mount(MODULES[0].id);
  };
}

/* ---------- 全局轻量提示 toast ---------- */
/* 修复：EVT.TOAST 早在 bus 里定义，却既无人 emit 也无人监听，导致云端发音等异步失败全程静默 */
const toastHost = document.createElement('div');
toastHost.className = 'toast-host';
toastHost.id = 'toastHost';
toastHost.setAttribute('aria-live', 'polite');
document.body.appendChild(toastHost);

// Toast 出现期间让右下角挂件退到背景：现 toast 居中且最宽 420px，窄屏会横向压到气泡
new MutationObserver(() =>
  document.body.classList.toggle('toast-open', toastHost.childElementCount > 0)
).observe(toastHost, { childList: true });

function showToast(msg, kind = '', ttl = 2600) {
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' ' + kind : '');
  if (kind === 'load') {
    const sp = document.createElement('span');
    sp.className = 'spinner';
    el.appendChild(sp);
  }
  const t = document.createElement('span');
  t.textContent = msg;
  el.appendChild(t);
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'x';
  x.textContent = '\u00d7';
  x.setAttribute('aria-label', '关闭提示');
  x.onclick = () => el.remove();
  el.appendChild(x);
  toastHost.appendChild(el);
  if (ttl > 0) setTimeout(() => el.remove(), ttl);
  return el;
}

let loadToast = null, loadTimer = null, loadPending = false;
function clearLoadToast() {
  clearTimeout(loadTimer); loadTimer = null; loadPending = false;
  if (loadToast) { loadToast.remove(); loadToast = null; }
}

bus.on(EVT.TOAST, (p = {}) => {
  if (p.kind === 'load') {
    loadPending = true;
    clearTimeout(loadTimer);
    // 请求 350ms 内返回就不提示，避免快速发音时提示一闪而过反而干扰
    loadTimer = setTimeout(() => {
      if (loadPending && !loadToast) loadToast = showToast(p.msg || '处理中…', 'load', 0);
    }, 350);
    return;
  }
  clearLoadToast();
  if (p.kind === 'done') return;
  if (p.kind === 'err') showToast(p.msg || '操作失败', 'err', p.ttl || 3600);
  else if (p.msg) showToast(p.msg, '', p.ttl || 2600);
});

bus.on(EVT.VOCAB_CHANGED, () => { renderProgress(); renderRail(); });

// 子导航切换、右栏按钮点击后都刷新右栏 —— 学习过程中今日进度/待复习会变，
// 而子视图切换不走 mount()，不刷就会停在旧数字。
document.addEventListener('click', e => {
  if (e.target && e.target.closest && e.target.closest('#subnav, .rail')) setTimeout(renderRail, 0);
});

buildNav();
bindSettings();
mountClockWidget();
// 跨 1240px 断点时切换宿主：从手机窗口拉宽，右栏卡片要立刻补上（否则等下一次 tick）
onWideChange(() => { renderRail(); syncClock(); });
const initial = (location.hash || '').replace('#', '');
mount(MODULES.some(m => m.id === initial) ? initial : MODULES[0].id);

// 首次进入自动弹一次引导；关掉后写进设置，之后不再打扰（随时可从顶栏 ? 再打开）
if (!store.getSettings().onboarded) setTimeout(showGuide, 450);
