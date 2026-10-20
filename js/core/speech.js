// 语音服务：TTS 发音 + 麦克风录音/回放（模块不直接操作 SpeechSynthesis / MediaRecorder）
import { bus, EVT } from './bus.js';

// 在浏览器自带的所有西语音色里，挑最自然的一个：
// 1) Google / 系统"在线/神经"语音最自然；2) 西语女声次之；3) 避开明显机械的男声
function scoreVoice(v) {
  const n = (v.name || '') + ' ' + (v.lang || '');
  let s = 0;
  if (/google/i.test(n)) s += 100;            // Google 神经语音，质感最好
  if (/online/i.test(n)) s += 80;             // 系统在线神经语音（Win11 等）
  if (/neural|natural/i.test(n)) s += 70;     // 标注 neural/natural
  if (/español|espanol|sabina|helena|paulina|sofía|sofia/i.test(n)) s += 20; // 西语女声
  if (/male|hombre/i.test(n)) s -= 10;
  if (/microsoft/i.test(n)) s += 5;
  return s;
}

let cachedVoices = null;
function refreshVoices() { try { cachedVoices = window.speechSynthesis.getVoices() || []; } catch { cachedVoices = []; } }

function pickVoice() {
  if (!cachedVoices || !cachedVoices.length) refreshVoices();
  if (!cachedVoices || !cachedVoices.length) return null;
  const es = cachedVoices.filter(v => /^es(-|_|$)/i.test(v.lang) || /spanish/i.test(v.name));
  const pool = es.length ? es : cachedVoices;
  return pool.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] || null;
}

if ('speechSynthesis' in window) {
  refreshVoices();
  window.speechSynthesis.onvoiceschanged = refreshVoices;
}

/* ---------- 语音可用性检测 ---------- */
/* 修复：设备没装西语语音包时，speakLocal 默默失败、调用方又忽略返回值，
   结果用户点发音毫无反应，也不知道是设备缺语音包而不是网站坏了。 */
let voiceWarned = false;

function voiceState() {
  if (!('speechSynthesis' in window)) return 'no-api';
  refreshVoices();
  const list = cachedVoices || [];
  if (!list.length) return 'unknown';   // 语音列表可能还在异步加载
  return list.some(v => /^es(-|_|$)/i.test(v.lang) || /spanish/i.test(v.name)) ? 'yes' : 'no';
}

function warnVoiceOnce(msg) {
  if (voiceWarned) return;
  voiceWarned = true;
  bus.emit(EVT.TOAST, { kind: 'err', msg, ttl: 6500 });
}

// 供调用方判断「现在能不能出声」：听音题在无法出声时要降级，否则用户无任何线索作答
export function canSpeak() {
  if (ttsCfg.onlineTTS && ttsCfg.ttsKey) return true;
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function checkVoiceSupport() {
  const st = voiceState();
  if (st === 'no-api') {
    warnVoiceOnce('当前浏览器不支持语音朗读，建议换用 Chrome / Edge / Safari');
  } else if (st === 'no') {
    warnVoiceOnce('系统没装西语语音包，发音可能无声或读不准。Windows：设置 → 时间和语言 → 语言 → 添加「西班牙语」');
  } else if (st === 'unknown') {
    // 列表可能尚未加载完，稍后复查一次再决定是否提示，避免误报
    setTimeout(() => {
      if (voiceState() === 'unknown') warnVoiceOnce('没有检测到任何系统语音，发音可能无声，请检查系统语音包是否安装');
    }, 1200);
  }
}

// ================= 在线神经 TTS（云端，更自然） =================
// 配置来自设置：{ onlineTTS, ttsProvider:'azure'|'eleven', ttsKey, ttsRegion, ttsVoice }
// 密钥只存本机浏览器，直接请求云端；未配置/请求失败自动回退本地语音。
let ttsCfg = { onlineTTS: false };
export function configure(c) { ttsCfg = Object.assign({ onlineTTS: false }, c || {}); }

function escXml(s) { return String(s).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m])); }

function playBlob(blob) {
  const url = URL.createObjectURL(blob);
  const a = new Audio(url);
  a.onended = () => URL.revokeObjectURL(url);
  a.play().catch(() => {});
}

async function speakOnline(text, rate) {
  const c = ttsCfg;
  if (!c.ttsKey) throw new Error('no-key');
  if (c.ttsProvider === 'eleven') {
    const vid = c.ttsVoice || 'JFBfpqvG1eE2sjr4i6s9'; // 默认西语声音（可改）
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(vid)}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': c.ttsKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.3, similarity_boost: 0.75 } }),
    });
    if (!r.ok) throw new Error('eleven ' + r.status);
    playBlob(await r.blob());
  } else {
    const region = c.ttsRegion || 'eastasia';
    const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='es-ES'><voice name='es-ES-ElviraNeural'><prosody rate='${rate}'>${escXml(text)}</prosody></voice></speak>`;
    const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': c.ttsKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
      },
      body: ssml,
    });
    if (!r.ok) throw new Error('azure ' + r.status);
    playBlob(await r.blob());
  }
}

function speakLocal(text, rate) {
  checkVoiceSupport();   // 缺西语语音包时明确告诉用户，而不是静默失败
  if (!('speechSynthesis' in window)) return false;
  try {
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    u.lang = (v && v.lang) ? v.lang : 'es-ES';
    if (v) u.voice = v;
    u.rate = rate; u.pitch = 1.02;            // 略微调高音高，语气更自然
    synth.cancel();
    // iOS/Safari：cancel 后立刻 speak 有概率被吞，缓一拍再读
    if (/iP(hone|ad|od)/.test(navigator.userAgent) || (/Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent))) {
      setTimeout(() => { try { synth.speak(u); } catch { /* ignore */ } }, 60);
    } else {
      synth.speak(u);
    }
    return true;
  } catch {
    warnVoiceOnce('朗读失败，可能系统语音不可用');
    return false;
  }
}

export function speak(text, rate = 0.9) {
  if (ttsCfg.onlineTTS && ttsCfg.ttsKey) {
    // 云端发音是网络请求：先通知外壳进入加载态；失败不再静默，明确告知用户已降级到本地语音
    bus.emit(EVT.TOAST, { kind: 'load', msg: '云端发音中…' });
    speakOnline(text, rate)
      .then(() => bus.emit(EVT.TOAST, { kind: 'done' }))
      .catch(() => {
        bus.emit(EVT.TOAST, { kind: 'err', msg: '云端发音失败，已改用本地语音' });
        speakLocal(text, rate);
      });
    return true;
  }
  return speakLocal(text, rate);
}

// ======================= iOS / Safari 手势解锁 =======================
// iPhone 上声音必须由一次真实手势触发；否则 speechSynthesis 和 <audio> 都会被静音拦截。
// 在用户第一次触摸/点击时放一段极短的静音，把「音频通道」解锁，之后的自动发音才有效。
let unlocked = false;
let silentUrl = null;

function silentWavUrl() {
  if (silentUrl) return silentUrl;
  const sr = 8000, n = Math.floor(sr * 0.05);
  const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  ws(36, 'data'); v.setUint32(40, n * 2, true);
  silentUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  return silentUrl;
}

export function unlock() {
  if (unlocked) return;
  unlocked = true;
  try {
    // 1) 解锁 <audio>（云端 TTS 走这条路）
    const a = new Audio(silentWavUrl());
    a.volume = 0;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});
    // 2) 解锁 speechSynthesis
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0; u.lang = 'es-ES';
      window.speechSynthesis.speak(u);
      window.speechSynthesis.resume();
    }
  } catch { /* 解锁失败不影响后续（speak 内部各自兜底） */ }
}

let handle = null;

export async function startRecord() {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream);
    const chunks = [];
    rec.ondataavailable = e => chunks.push(e.data);
    rec.start();
    handle = { rec, stream, chunks };
    return true;
  } catch { return false; }
}

export function stopRecord() {
  return new Promise(res => {
    if (!handle) return res(null);
    handle.rec.onstop = () => {
      const url = URL.createObjectURL(new Blob(handle.chunks, { type: 'audio/webm' }));
      handle.stream.getTracks().forEach(t => t.stop());
      handle = null;
      res(url);
    };
    handle.rec.stop();
  });
}

export function durationOf(url) {
  return new Promise(res => {
    const a = new Audio(url);
    a.onloadedmetadata = () => res(a.duration || 0);
    a.onerror = () => res(0);
  });
}
