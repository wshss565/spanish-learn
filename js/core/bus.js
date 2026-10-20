// 事件总线：模块之间唯一的通信方式（禁止模块互相 import 或调用）
const listeners = {};

function on(evt, fn) {
  (listeners[evt] ||= []).push(fn);
  return () => off(evt, fn);
}

function off(evt, fn) {
  if (!listeners[evt]) return;
  listeners[evt] = listeners[evt].filter(f => f !== fn);
}

function emit(evt, payload) {
  (listeners[evt] || []).slice().forEach(fn => {
    try { fn(payload); } catch (e) { console.error(`[bus] ${evt}`, e); }
  });
}

// 对外暴露单例：bus.on / bus.off / bus.emit
export const bus = { on, off, emit };

// 约定事件
export const EVT = {
  NAV_GO: 'nav:go',           // 请求切换模块
  VOCAB_CHANGED: 'vocab:changed', // 词库变化（驱动全局进度刷新）
  ASSESS_DONE: 'assessment:done', // 一次测评完成
  TOAST: 'ui:toast',          // 轻量提示
};
