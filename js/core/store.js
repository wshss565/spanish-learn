// 存储服务：统一词库 / 进度 / 段位（模块只通过此服务读写，不直接碰 localStorage）
// ts-fsrs 走仓库内置的浏览器原生 ESM 产物（js/vendor/ts-fsrs.js，MIT）。
// 原来写的是裸模块名 'ts-fsrs'，浏览器解析不了裸模块名 → 模块图加载失败 → 整站白屏；
// esbuild 构建单文件版时能解析，所以只有"源码版直接在浏览器跑"这条路径会挂。
import { FSRS, Rating, createEmptyCard, default_w } from '../vendor/ts-fsrs.js';

const KEY = 'es_mvp_v1';
const DEFAULT = { words: [], assessments: [], streak: 0, log: [], time: {}, settings: { rate: 0.9 } };

export function getState() {
  try { return { ...DEFAULT, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; }
  catch { return { ...DEFAULT }; }
}
// 写盘可能失败：iOS Safari 配额约 5MB，无痕模式下 localStorage 也可能直接抛错。
// 这里吞掉异常但**如实返回结果**，让调用方（计时内核）能决定是重试还是放弃，
// 而不是写失败后被当成成功、把数据静默丢掉。
function save(s) {
  if (Array.isArray(s.log)) s.log = pruneLog(s.log);   // 日志在唯一出口统一修剪，今后新增写入点也不会漏
  try { localStorage.setItem(KEY, JSON.stringify(s)); return true; }
  catch (e) { return false; }
}

export function getWords() { return getState().words; }

export function addWord(w) {
  const s = getState();
  const ex = s.words.find(x => x.word === w.word);
  if (ex) { ex.lastSeen = Date.now(); }
  else { s.words.push({ ...w, mastery: 0, correct_streak: 0, wrong: 0, lastSeen: Date.now() }); }
  save(s);
  return s.words.length;
}

export function bumpMastery(word, ok) {
  const s = getState();
  const w = s.words.find(x => x.word === word);
  if (!w) return;
  if (ok) { w.mastery = Math.min(5, (w.mastery || 0) + 1); w.correct_streak = (w.correct_streak || 0) + 1; }
  else { w.wrong = (w.wrong || 0) + 1; w.correct_streak = 0; w.mastery = Math.max(0, (w.mastery || 0) - 1); }
  w.lastSeen = Date.now();
  save(s);
}

// ===== SRS 间隔重复（FSRS-5，官方算法 ts-fsrs）=====
// 词记录 FSRS 字段：
//   s 稳定性(天) / d 难度(1–10) / lapses 遗忘次数 / reps 复习次数 /
//   state 状态(0新/1学中/2复习/3重学) / due 下次到期(ms) /
//   lastReview 上次复习(ms) / scheduled_days / elapsed_days
const DAY = 86400000;
const fsrs = new FSRS({ w: default_w, request_retention: 0.9 });
// UI 3 档映射：忘记→Again(1) / 模糊→Hard(2) / 记住→Good(3)
const RATING = [Rating.Again, Rating.Hard, Rating.Good];

// 把存储词记录转成 ts-fsrs 的 Card；缺失的 FSRS 字段由空卡种子补齐（兼容旧数据 / 新词）
function toCard(w, now) {
  const c = createEmptyCard(now);
  if (typeof w.s === 'number') c.stability = w.s;
  if (typeof w.d === 'number') c.difficulty = w.d;
  if (typeof w.reps === 'number') c.reps = w.reps;
  if (typeof w.lapses === 'number') c.lapses = w.lapses;
  if (typeof w.state === 'number') c.state = w.state;
  if (typeof w.due === 'number') c.due = new Date(w.due);
  if (typeof w.lastReview === 'number') c.last_review = new Date(w.lastReview);
  if (typeof w.scheduled_days === 'number') c.scheduled_days = w.scheduled_days;
  if (typeof w.elapsed_days === 'number') c.elapsed_days = w.elapsed_days;
  return c;
}

// 把某本词书的词条加入复习计划（按词去重，已存在的不重复加入）
export function enrollWords(list, bookId) {
  const s = getState();
  const now = Date.now();
  let added = 0;
  for (const w of list) {
    const word = w.es || w.word;
    let rec = s.words.find(x => x.word === word);
    if (!rec) {
      s.words.push({
        word, zh: w.zh || '', pos: w.pos || '', gender: w.gender || '',
        book: bookId || '', mastery: 0, correct_streak: 0, wrong: 0,
        due: now, lastSeen: now,
      });
      added++;
    } else if (!rec.due) {
      rec.book = rec.book || bookId || '';
      rec.due = now;
      added++;
    }
  }
  save(s);
  return { added, total: s.words.length };
}

// 今日到期待复习队列
export function getDueWords(limit = 30) {
  const now = Date.now();
  return getWords()
    .filter(w => w.due && w.due <= now)
    .sort((a, b) => a.due - b.due)
    .slice(0, limit);
}
export function getDueCount() {
  const now = Date.now();
  return getWords().filter(w => w.due && w.due <= now).length;
}

// 按评级排下次复习：grade 0=忘记 1=模糊 2=记住（FSRS-5 调度）
export function scheduleWord(word, grade) {
  const s = getState();
  const w = s.words.find(x => x.word === word);
  if (!w) return null;
  const now = new Date();
  const card = toCard(w, now);
  const record = fsrs.repeat(card, now);
  const rated = record[RATING[grade]] || record[Rating.Good];
  const c = rated.card;
  w.s = c.stability;
  w.d = c.difficulty;
  w.lapses = c.lapses;
  w.reps = c.reps;
  w.state = c.state;
  w.scheduled_days = c.scheduled_days;
  w.elapsed_days = c.elapsed_days;
  w.lastReview = c.last_review ? c.last_review.getTime() : now.getTime();
  w.due = c.due.getTime();

  if (grade === 2) {
    if (!s.log) s.log = [];
    s.log.push({ at: now, kind: 'review', ok: true, word: word });
  } else if (grade === 0) {
    // FSRS 的 lapses 只在「复习态(Review)」评 Again 时才 +1；
    // 新词/学习态点「忘记」lapses 恒为 0，会导致错词本永远收不进来。
    // 所以这里单独维护一个 forgot 计数，作为「用户主动标记忘记」的可靠依据。
    w.forgot = (w.forgot || 0) + 1;
    if (!s.log) s.log = [];
    s.log.push({ at: now, kind: 'review', ok: false, word: word });
  } else {
    if (!s.log) s.log = [];
    s.log.push({ at: now, kind: 'review', ok: null, word: word });
  }
  w.lastSeen = now.getTime();

  // 按「天」对齐：FSRS 原生会给新词/忘记 0 天（当天就回来），不适合「每天学、次日复习」的节奏。
  // 第一次评级统一 1 天 —— 保证今天学的词明天一定回来；
  // 之后按评级给下限：忘记→明天必来，模糊→2 天，记住→3 天起（再往后交给 FSRS 越拉越长）。
  const FLOOR = [1, 2, 3];
  const first = (w.reps || 0) <= 1;
  let iv = (c.due.getTime() - now.getTime()) / DAY;
  iv = first ? 1 : Math.max(FLOOR[grade] != null ? FLOOR[grade] : 1, Math.round(iv));
  iv = Math.min(365, iv);
  w.due = now.getTime() + iv * DAY;
  if (iv >= 21) w.mastered = true; else w.mastered = false;

  save(s);
  return { iv, due: w.due, grade };
}

// 某本词书的加入进度
export function bookProgress(bookWords) {
  const all = getWords();
  const now = Date.now();
  let inStore = 0, scheduled = 0;
  for (const w of bookWords) {
    const rec = all.find(x => x.word === (w.es || w.word));
    if (rec) { inStore++; if (rec.due && rec.due > now) scheduled++; }
  }
  return { inStore, scheduled, total: bookWords.length };
}

// 段位映射（CEFR 词汇量估算，仅作激励）
const LEVELS = [
  { min: 0, max: 1500, level: 'A1', base: 0, span: 20 },
  { min: 1500, max: 3000, level: 'A2', base: 20, span: 20 },
  { min: 3000, max: 5000, level: 'B1', base: 40, span: 20 },
  { min: 5000, max: 8000, level: 'B2', base: 60, span: 20 },
  { min: 8000, max: 10000, level: 'C1', base: 80, span: 12 },
  { min: 10000, max: Infinity, level: 'C2', base: 92, span: 8 },
];
export function levelFor(v) {
  for (const L of LEVELS) {
    if (v < L.max) {
      const pct = L.base + (v - L.min) / (L.max - L.min) * L.span;
      return { level: L.level, pct: Math.min(100, Math.round(pct)) };
    }
  }
  return { level: 'C2', pct: 100 };
}

export function getSummary() {
  const s = getState();
  const total = s.words.length;
  const { level, pct } = levelFor(total);
  return { total, level, pct, streak: s.streak || 0 };
}

export function recordAssessment(res) {
  const s = getState();
  s.streak = (s.streak || 0) + 1;
  s.assessments.push({ at: Date.now(), ...res });
  if (!s.log) s.log = [];
  s.log.push({ at: Date.now(), kind: 'assess', ok: res.passed, score: res.score });
  save(s);
  return getSummary();
}

// ===== 每日学习（固定流程：看卡片+跟写 → 默写 → 自测）=====
export function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
function shiftDayKey(offsetDays) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
export function getDaily() {
  const s = getState();
  const d = s.daily || {};
  const today = todayKey();
  return {
    goal: d.goal || 10,
    srcKind: d.srcKind || '',
    srcId: d.srcId || '',
    srcIdx: typeof d.srcIdx === 'number' ? d.srcIdx : null,
    lastDate: d.lastDate || '',
    // 只有「今天」走过完整流程才算 done
    done: d.lastDate === today && !!d.done,
    streak: d.streak || 0,
    totalDone: d.totalDone || 0,
  };
}
export function setDaily(patch) {
  const s = getState();
  s.daily = { ...(s.daily || {}), ...patch };
  save(s);
  return s.daily;
}
// 走完当天三步流程：记一次完成并维护连续天数
export function markTodayDone() {
  const s = getState();
  const d = { ...(s.daily || {}) };
  const today = todayKey();
  if (d.lastDate === today && d.done) return d;
  const streak = (d.lastDate === shiftDayKey(-1)) ? ((d.streak || 0) + 1) : 1;
  s.daily = { ...d, lastDate: today, done: true, streak, totalDone: (d.totalDone || 0) + 1 };
  save(s);
  return s.daily;
}

// 连续天数「有效状态」：补齐 markTodayDone 只在完成时更新、断更当天不归零的显示缺口
//   done    今天已完成流程（连击存活且已打卡）
//   atRisk  昨天完成、今天还没学 → 连击还活着，但今天不学就断（最该催的时机）
//   broke   超过 1 天没学 → 有效连击已归零（下次完成会从 1 起算）
//   isNew   从未学习过（lastDate 为空）
export function streakInfo() {
  const d = getDaily();
  if (d.done) return { streak: d.streak, done: true, atRisk: false, broke: false, isNew: false, lastDate: d.lastDate };
  if (!d.lastDate) return { streak: 0, done: false, atRisk: false, broke: false, isNew: true, lastDate: '' };
  if (d.lastDate === shiftDayKey(-1)) return { streak: d.streak, done: false, atRisk: true, broke: false, isNew: false, lastDate: d.lastDate };
  return { streak: 0, done: false, atRisk: false, broke: true, isNew: false, lastDate: d.lastDate };
}

// ===== 学过标记：只有真正「认过」的词才进测评/统计范围 =====
// （加入词书只是入池，不算学过——否则测评会从整本书里乱抽）
export function markLearned(word) {
  const s = getState();
  const w = s.words.find(x => x.word === word);
  if (!w) return false;
  const now = Date.now();
  w.learnedAt = now;
  // 学过的词立刻进入复习计划（只排真正学过的，不会像「加入词书」那样一次排几百个）
  if (!w.due) w.due = now;
  if (!s.log) s.log = [];
  s.log.push({ at: now, kind: 'learn', word });
  save(s);
  return true;
}
// 学过的词，按最近学的时间倒序
export function getLearned() {
  return getWords().filter(w => w.learnedAt).sort((a, b) => b.learnedAt - a.learnedAt);
}

// ===== 复习队列：只复习「每天学过的词」（复习模块链接每日学习）=====
// 取词范围限定为 learnedAt 有值的词——加入词书只是入池，不学就不考。
// 于是节奏是：今天学的 → 明天来复习 → 认得就拉长间隔 → 直到掌握；不认得就回到 1 天。
export function getReviewQueue(cap = 30, newCap = 10) {
  const now = Date.now();
  const all = getWords().filter(w => w.learnedAt);
  const due = all
    .filter(w => w.due && w.due <= now && (w.reps || 0) > 0)
    .sort((a, b) => a.due - b.due)
    .slice(0, cap);
  const remain = Math.max(0, cap - due.length);
  const fresh = all
    .filter(w => w.due && w.due <= now && !(w.reps > 0))
    .sort((a, b) => (a.lastSeen || 0) - (b.lastSeen || 0))
    .slice(0, Math.min(newCap, remain));
  return { queue: due.concat(fresh), review: due.length, fresh: fresh.length };
}

// 学习/复习概览：今天新学了多少、有多少等着复习、已经掌握多少
export function getStudyStats() {
  const now = Date.now();
  const d = new Date(); d.setHours(0, 0, 0, 0);
  const dayStart = d.getTime();
  const learned = getWords().filter(w => w.learnedAt);
  return {
    learned: learned.length,
    today: learned.filter(w => w.learnedAt >= dayStart).length,
    pending: learned.filter(w => w.due && w.due <= now).length,
    upcoming: learned.filter(w => w.due && w.due > now).length,
    mastered: learned.filter(w => w.mastered).length,
  };
}

// ===== 活动日志（按天聚合） =====
function dayKey(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
// 过去 N 天的每日活动：返回顺序的数组（最早的在前）
export function getActivity(days = 30) {
  const s = getState();
  const log = s.log || [];
  const map = new Map();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY);
    map.set(d.getTime(), { date: d.getTime(), learned: 0, reviewed: 0, acc: null, hits: 0, total: 0 });
  }
  log.forEach(e => {
    if (!e || !e.at) return;
    const k = dayKey(e.at);
    const row = map.get(k);
    if (!row) return;
    if (e.kind === 'learn') row.learned++;
    if (e.kind === 'review') {
      row.reviewed++;
      if (e.ok === true) row.hits++;
      if (e.ok === true || e.ok === false) row.total++;
    }
  });
  map.forEach(r => { r.acc = r.total ? Math.round(r.hits / r.total * 100) : null; });
  return [...map.values()];
}

// 掌握等级分布：返回 mastery 0..5 的词数（mastery 字段来自老数据，新词用 reps/lapses 推算）
export function getMasteryDist() {
  const dist = [0, 0, 0, 0, 0, 0];
  getWords().filter(w => w.learnedAt).forEach(w => {
    let m = w.mastery;
    if (typeof m !== 'number') {
      // 兜底：用 reps/lapses 估算
      if (w.mastered) m = 5;
      else if (w.lapses) m = Math.max(0, 3 - w.lapses);
      else m = Math.min(5, (w.reps || 0));
    }
    if (m < 0) m = 0; if (m > 5) m = 5;
    dist[m]++;
  });
  return dist;
}

// 错词本：只要「主动点过忘记(forgot)」或「FSRS 记过遗忘(lapses)」就收进来
// 排序按总错次倒序，再按最近复习时间倒序，取前 N 个
export function getWrongWords(limit = 10) {
  return getWords()
    .filter(w => w.learnedAt && ((w.forgot || 0) > 0 || (w.lapses || 0) > 0))
    .map(w => ({
      word: w.word, zh: w.zh, pos: w.pos, gender: w.gender,
      wrongs: (w.forgot || 0) + (w.lapses || 0),
      forgot: w.forgot || 0,
      lapses: w.lapses || 0,
      reps: w.reps || 0, lastReview: w.lastReview || 0,
    }))
    .sort((a, b) => b.wrongs - a.wrongs || b.lastReview - a.lastReview)
    .slice(0, limit);
}

// 错词答对时把 lapses 减 1，便于它"走出"错词本
export function reduceLapse(word) {
  const s = getState();
  const w = s.words.find(x => x.word === word);
  if (!w) return false;
  // 先消「主动忘记」的账，再消 FSRS 的 lapses，任一归零即出本
  if ((w.forgot || 0) > 0) w.forgot = Math.max(0, w.forgot - 1);
  else if ((w.lapses || 0) > 0) w.lapses = Math.max(0, w.lapses - 1);
  save(s);
  return true;
}


export function getSettings() { return getState().settings || {}; }
export function setSettings(patch) {
  const s = getState();
  s.settings = { ...(s.settings || {}), ...patch };
  save(s);
  return s.settings;
}

export function resetAll() { localStorage.removeItem(KEY); }

// ===== 学习时长（时间管控）=====
// 按天存：{ "2026-9-13": { ms, sessions, extraUsed, lastAt } }
//   ms        有效学习毫秒（只由 clock 在「活跃」状态下累加，不含空闲/后台）
//   sessions  进入练习视图的次数
//   extraUsed 今日已用「再学 5 分钟」的次数
// 只保留最近 90 天，避免 localStorage 无限膨胀。
const TIME_KEEP_DAYS = 90;

function pruneTime(map) {
  const cut = Date.now() - TIME_KEEP_DAYS * DAY;
  const out = {};
  for (const k in map) {
    const p = String(k).split('-');
    const t = new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1).getTime();
    if (!isNaN(t) && t >= cut) out[k] = map[k];
  }
  return out;
}

// ===== 活动日志修剪 =====
// s.log 在认词 / 复习 / 测评时各追加一条，而唯一消费者 getActivity(30) 只看最近 30 天。
// 不做修剪的话按每天约 50 条估算，一年约 1.8 万条 / 950KB，其中约 92% 永远不会被读到，
// 却每次 save() 都要 JSON.stringify 一遍 —— 既是配额风险也是持续变慢的时延来源。
const LOG_KEEP_DAYS = 90;    // 比消费窗口（30 天）宽 3 倍，留足余量
const LOG_MAX = 4000;        // 条数硬上限，防止单日高频使用把体积拉爆
function pruneLog(log) {
  if (!Array.isArray(log) || log.length === 0) return log;
  const cut = Date.now() - LOG_KEEP_DAYS * DAY;
  // 日志是追加写的，首条即最旧：还没过期且条数没超限时直接返回，避免每次 save 都重建数组
  const oldest = log[0] && log[0].at;
  if (typeof oldest === 'number' && oldest >= cut && log.length <= LOG_MAX) return log;
  let out = log.filter(e => e && typeof e.at === 'number' && e.at >= cut);
  if (out.length > LOG_MAX) out = out.slice(out.length - LOG_MAX);   // 保留最新的
  return out;
}

// 今日时长记录（不含内存中尚未落盘的部分，那部分由 clock 叠加后对外呈现）
export function getTodayTime() {
  const t = (getState().time || {})[todayKey()] || {};
  return { ms: t.ms || 0, sessions: t.sessions || 0, extraUsed: t.extraUsed || 0 };
}

// 累加有效学习毫秒；key 可指定归属日（跨天时把属于昨天的那一笔记回昨天，不串账）
// 返回写盘是否成功 —— 计时内核据此决定是否从待写队列里扣减这次时长。
export function addStudyMs(ms, key) {
  ms = Math.round(ms);
  if (!(ms > 0)) return true;
  const s = getState();
  if (!s.time) s.time = {};
  const k = key || todayKey();
  const cur = s.time[k] || { ms: 0, sessions: 0, extraUsed: 0 };
  cur.ms = (cur.ms || 0) + ms;
  cur.lastAt = Date.now();
  s.time[k] = cur;
  s.time = pruneTime(s.time);
  return save(s);
}

// 记一次「进入练习」
export function addSession() {
  const s = getState();
  if (!s.time) s.time = {};
  const k = todayKey();
  const cur = s.time[k] || { ms: 0, sessions: 0, extraUsed: 0 };
  cur.sessions = (cur.sessions || 0) + 1;
  s.time[k] = cur;
  s.time = pruneTime(s.time);
  save(s);
}

// 用掉一次「再学 5 分钟」额度；返回已用次数（已达上限则不写盘）
export function useExtra(max) {
  const cur = getTodayTime();
  if (cur.extraUsed >= max) return cur.extraUsed;
  const s = getState();
  if (!s.time) s.time = {};
  const k = todayKey();
  const rec = s.time[k] || { ms: 0, sessions: 0, extraUsed: 0 };
  rec.extraUsed = (rec.extraUsed || 0) + 1;
  s.time[k] = rec;
  s.time = pruneTime(s.time);   // 替换成新对象：避免直接改到 DEFAULT.time 这个共享引用
  save(s);
  return rec.extraUsed;
}

// 最近 N 天的时长（最早的在前），缺数据的天补 0
export function getTimeHistory(days = 7) {
  const map = getState().time || {};
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY);
    const k = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    out.push({ date: d.getTime(), ms: (map[k] && map[k].ms) || 0 });
  }
  return out;
}

// ===== 学习进度备份：导出 / 导入（换设备、清缓存都不怕丢进度）=====
export function exportData() {
  const s = getState();
  return { app: 'hola-es', version: 2, exportedAt: new Date().toISOString(), words: s.words, daily: s.daily, assessments: s.assessments, settings: s.settings, time: s.time };
}

export function importData(data) {
  if (!data || data.app !== 'hola-es' || !Array.isArray(data.words)) {
    throw new Error('文件不是本站导出的进度备份');
  }
  const s = getState();
  const map = new Map(s.words.map(w => [w.word, w]));
  for (const w of data.words) {
    const ex = map.get(w.word);
    if (!ex) { map.set(w.word, w); continue; }
    // 两边都有：取更完整的进度（复习次数取大、到期取较早、学过时间取较新）
    map.set(w.word, {
      ...ex, ...w,
      reps: Math.max(ex.reps || 0, w.reps || 0),
      lapses: Math.max(ex.lapses || 0, w.lapses || 0),
      forgot: Math.max(ex.forgot || 0, w.forgot || 0),
      mastery: Math.max(ex.mastery || 0, w.mastery || 0),
      due: Math.min(ex.due || Infinity, w.due || Infinity),
      learnedAt: Math.max(ex.learnedAt || 0, w.learnedAt || 0),
    });
  }
  s.words = [...map.values()];
  if (data.settings) s.settings = { ...(s.settings || {}), ...data.settings };
  if (data.daily) s.daily = { ...(s.daily || {}), ...data.daily };
  // 时长按天合并：同一天取「更长的时长 / 更多的续时次数」，避免导入反而把额度变小
  if (data.time && typeof data.time === 'object') {
    const merged = { ...(s.time || {}) };
    for (const k in data.time) {
      const a = merged[k] || { ms: 0, sessions: 0, extraUsed: 0 };
      const b = data.time[k] || {};
      merged[k] = {
        ms: Math.max(a.ms || 0, b.ms || 0),
        sessions: Math.max(a.sessions || 0, b.sessions || 0),
        extraUsed: Math.max(a.extraUsed || 0, b.extraUsed || 0),
        lastAt: Math.max(a.lastAt || 0, b.lastAt || 0),
      };
    }
    s.time = pruneTime(merged);
  }
  if (Array.isArray(data.assessments) && data.assessments.length) {
    s.assessments = [].concat(data.assessments, s.assessments || []).slice(0, 50);
  }
  save(s);
  return { words: s.words.length };
}
