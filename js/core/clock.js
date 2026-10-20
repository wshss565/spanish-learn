// 学习计时内核（时间管控）
//
// 只有「活跃三条件」同时满足才累加学习时长：
//   A 处于练习视图（学习 / 测评 / 复习 / 语法）—— 看「统计」不算学习
//   B 页面可见（切标签页 / 最小化立即暂停）
//   C 距上次交互 < IDLE_MS（默认 90 秒，超过判定为离开）
//
// 为什么不用「记录进出两个时间戳、退出时做差」：那样无法实时显示、也无法在到达上限的
// 那一刻触达，且浏览器崩溃或被强杀时整段时长全丢。这里每秒 tick 累加，每 30 秒或页面
// 隐藏时落盘，最坏只丢最后一次落盘间隔（≤30 秒）。
//
// 性能：state() 每秒被调用一次，所以今日时长与设置一律走内存缓存，只在落盘 / 跨天 /
// 外部改动时刷新，避免每秒 JSON.parse 整个 state（词库有近千条记录）。

const IDLE_MS = 90000;
const TICK_MS = 1000;
const FLUSH_MS = 30000;
const EXTRA_MS = 5 * 60000;
export const MAX_EXTRA = 2;             // 每日「再学 5 分钟」次数上限
const LAST_STEP = 3;                    // 四步流程最后一步（默写）的下标
const WARN_RATIO = 0.75;                // 用掉 75% 额度即进入提示态
const NO_LIMIT_RING_MS = 60 * 60000;    // 未设上限时圆环的软刻度：60 分钟走满

const PRACTICE = new Set(['words', 'assessment', 'review', 'grammar']);

let store = null;
let onChange = null;
let timer = null;
let booted = false;

let pendingMs = 0;        // 尚未落盘的毫秒
let lastFlushAt = 0;
let lastTickAt = 0;
let lastActAt = 0;
let visible = true;
let phase = { view: null, busy: false, step: -1 };

// 内存缓存（避免每秒读存储）
let cacheDay = '';
let dayMsBase = 0;
let extraUsedCache = 0;
let limitMinCache = 0;

const mono = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
function dayKeyOf(ts) {
  const d = new Date(ts);
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

function refreshCache() {
  if (!store) return;
  const t = store.getTodayTime();
  dayMsBase = t.ms || 0;
  extraUsedCache = t.extraUsed || 0;
  const st = store.getSettings();
  limitMinCache = st.dailyLimitMin || 0;
  cacheDay = dayKeyOf(Date.now());
}

// 是否有正在进行的答题轮次：有则「到上限」先不弹卡，等这一轮走完再弹
function busyNow() { return !!phase.busy; }

function active() {
  return PRACTICE.has(phase.view) && visible && (mono() - lastActAt) < IDLE_MS;
}

function emit() {
  if (!onChange) return;
  try { onChange(state()); } catch (e) { /* 渲染失败不该拖垮计时 */ }
}

function flush(force) {
  if (pendingMs <= 0) { lastFlushAt = Date.now(); return; }
  if (!force && Date.now() - lastFlushAt < FLUSH_MS) return;
  const ms = Math.round(pendingMs);
  if (!store || ms <= 0) { pendingMs = 0; lastFlushAt = Date.now(); return; }
  // 关键顺序：**先写盘、写成功再扣减待写队列**。
  // 原实现先 `pendingMs = 0` 再写，一旦 localStorage 写失败（配额满 / Safari 无痕），
  // 这段时长就凭空消失且无任何痕迹；现在失败则保留，下个周期重试。
  if (store.addStudyMs(ms, cacheDay) === false) {
    lastFlushAt = Date.now();   // 失败也推进时间戳，避免配额已满时每秒重试一次
    return;
  }
  dayMsBase += ms;
  pendingMs = 0;
  lastFlushAt = Date.now();
}

function tick() {
  const t = mono();
  const dt = t - lastTickAt;
  lastTickAt = t;

  // 跨天：先把属于昨天的那一笔落掉，再换到新的一天重新计
  const dk = dayKeyOf(Date.now());
  if (dk !== cacheDay) { flush(true); refreshCache(); }

  if (!active()) { flush(true); emit(); return; }

  // 后台被节流后回来时不要一次性补一大段
  pendingMs += Math.min(dt, TICK_MS * 2);
  flush(false);
  emit();
}

export function initClock(opts = {}) {
  store = opts.store;
  onChange = opts.onChange || null;
  if (booted) return;
  booted = true;

  lastActAt = mono();
  lastTickAt = mono();
  lastFlushAt = Date.now();
  refreshCache();

  // 交互节流到 1 秒一次写入，pointermove 每帧都触发也不会有额外开销
  const bump = () => { const t = mono(); if (t - lastActAt > 1000) lastActAt = t; };
  ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'].forEach(ev =>
    document.addEventListener(ev, bump, { passive: true, capture: true }));

  document.addEventListener('visibilitychange', () => {
    visible = document.visibilityState !== 'hidden';
    if (!visible) flush(true);      // 切走立刻落盘
    else lastActAt = mono();
    emit();
  });
  window.addEventListener('pagehide', () => flush(true));
  window.addEventListener('beforeunload', () => flush(true));

  timer = setInterval(tick, TICK_MS);
  emit();
}

// 子视图 / 答题轮次 / 四步流程步骤由模块上报（模块不认识 clock 的内部逻辑）
export function setPhase(p = {}) {
  const prev = phase;
  phase = {
    view: ('view' in p) ? p.view : prev.view,
    busy: ('busy' in p) ? !!p.busy : prev.busy,
    step: ('step' in p) ? p.step : prev.step,
  };
  const was = PRACTICE.has(prev.view);
  const now = PRACTICE.has(phase.view);
  if (now && !was && store) store.addSession();    // 记一次「进入练习」
  if (!now && was) { flush(true); emit(); }        // 离开练习立刻落盘
  else emit();
}

// 外部改动（导入备份 / 清空数据 / 改设置）后手动刷新缓存
export function refresh() { refreshCache(); emit(); }

export function setLimit(min) {
  if (!store) return;
  store.setSettings({ dailyLimitMin: Math.max(0, Math.round(min) || 0) });
  refreshCache();
  emit();
}

// 用掉一次「再学 5 分钟」
export function extend() {
  if (!store) return false;
  if (extraUsedCache >= MAX_EXTRA) return false;
  flush(true);
  store.useExtra(MAX_EXTRA);
  refreshCache();
  emit();
  return true;
}

export function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  booted = false;
}

// 对外唯一的数据出口：一次算出界面要的全部状态
export function state() {
  const todayMs = dayMsBase + pendingMs;
  const todayMin = Math.floor(todayMs / 60000);
  const enabled = limitMinCache > 0;
  const limitMs = limitMinCache * 60000;
  const extraMs = extraUsedCache * EXTRA_MS;
  const effMs = limitMs + extraMs;
  const over = enabled && todayMs >= effMs;
  const warn = enabled && !over && todayMs >= limitMs * WARN_RATIO;
  const pct = enabled
    ? (effMs > 0 ? Math.min(1, todayMs / effMs) : 1)
    : Math.min(1, todayMs / NO_LIMIT_RING_MS);

  // 豁免：已进四步流程最后一步（默写）→ 本轮放行，只变色不弹卡
  const exempt = over && phase.step >= LAST_STEP;
  // 轮次进行中（且没到最后一步）→ 先不弹阻断卡，等这一轮走完
  const defer = over && !exempt && busyNow();

  let ui = 'normal';
  if (!enabled) ui = 'off';
  else if (over) ui = 'over';
  else if (warn) ui = 'warn';

  return {
    enabled,
    limitMin: limitMinCache,
    todayMs,
    todayMin,
    remainMin: enabled ? Math.ceil(Math.max(0, effMs - todayMs) / 60000) : 0,
    pct,
    warn,
    over,
    exempt,
    defer,
    showBlock: over && !exempt && !defer,
    ui,
    active: active(),
    visible,
    extraUsed: extraUsedCache,
    extraLeft: Math.max(0, MAX_EXTRA - extraUsedCache),
  };
}
