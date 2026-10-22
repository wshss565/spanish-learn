// 冒烟测试：用 jsdom 加载 standalone.html，走一遍 ①认词 ②记词 ③自测 ④默写
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '../standalone.html'), 'utf8');

// 输出落盘：Windows 上若用 `node smoke.js *> log.txt` 捕获，PowerShell 会按 GBK 解码
// node 的 UTF-8 输出，把 ✓/✗ 变成乱码、判定信息全丢。所以自己写一份 UTF-8 结果文件，
// 跑完直接看 smoke_result.txt，不依赖外层怎么重定向。
const report = [];
const _write = process.stdout.write.bind(process.stdout);
process.stdout.write = (s) => {
  const t = typeof s === 'string' ? s : Buffer.from(s).toString('utf8');
  report.push(t);
  return _write(t);
};
process.on('exit', () => {
  try { fs.writeFileSync(path.join(__dirname, '../smoke_result.txt'), report.join(''), 'utf8'); } catch (e) { /* 忽略 */ }
});

const vc = new VirtualConsole();
const errs = [];
vc.on('jsdomError', e => errs.push('jsdomError: ' + e.message));
vc.on('error', (...a) => errs.push('console.error: ' + a.join(' ')));

const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/', virtualConsole: vc, pretendToBeVisual: true, beforeParse: preParse(null, false) });
const { window } = dom;
const doc = window.document;
const q = s => doc.querySelector(s);
const txt = () => (q('#mvBody') || doc.body).textContent.replace(/\s+/g, ' ');
const click = el => { if (!el) throw new Error('no element'); el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); };
// 模拟键盘：从 #mvBody 上发（等同于「焦点不在按钮/输入框上」，走模块级委托快捷键；各子视图通用）
const key = (el, k) => { if (!el) throw new Error('no element'); el.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); };
const keyCard = k => key(q('#mvBody'), k);
const log = (...a) => console.log(...a);

function step(name, fn) { try { fn(); log('  ✓ ' + name); } catch (e) { log('  ✗ ' + name + ' -> ' + e.message); process.exitCode = 1; } }

// jsdom 的 matchMedia 不完整（缺 addEventListener，且永远 matches:false）。
// 装一个可控替身，让「窄屏浮层」和「宽屏右栏」两条渲染路径都能被测到。
// wide=false 模拟手机（右下角气泡）；wide=true 模拟 ≥1240px（右栏卡片）。
function preParse(seed, wide, opts) {
  return (w) => {
    w.scrollTo = () => {};
    // jsdom 的 matchMedia 不完整（缺 addEventListener，且永远 matches:false）。
    // 装一个可控替身，让「窄屏浮层」和「宽屏右栏」两条渲染路径都能被测到。
    // wide=false 模拟手机（右下角气泡）；wide=true 模拟 ≥1240px（右栏卡片）。
    w.matchMedia = (mq) => ({
      media: String(mq),
      matches: /min-width:\s*1240px/.test(String(mq)) ? !!wide : false,
      onchange: null,
      addEventListener() {}, removeEventListener() {},
      addListener() {}, removeListener() {},
      dispatchEvent() { return false; },
    });
    if (seed) { try { w.localStorage.setItem('es_mvp_v1', JSON.stringify(seed)); } catch (e) { /* 忽略 */ } }
    // 模拟写盘失败（配额满 / Safari 无痕）：用于验证 save() 的异常兜底
    if (opts && opts.failWrites) {
      try {
        Object.defineProperty(Object.getPrototypeOf(w.localStorage), 'setItem', {
          configurable: true, writable: true,
          value: function () { throw new Error('simulated quota exceeded'); },
        });
      } catch (e) { /* 打不上补丁时该用例会自行跳过 */ }
    }
  };
}

// 构造一份「预置存储 + 指定断点」的独立 DOM，用来验状态相关分支
function newDom(seed, wide, opts) {
  return new JSDOM(html, {
    runScripts: 'dangerously', url: 'http://localhost/',
    virtualConsole: new VirtualConsole(), pretendToBeVisual: true,
    beforeParse: preParse(seed, wide, opts),
  });
}
function seeded(ms, limitMin, extraUsed) {
  const d = new Date();
  const dk = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  return {
    words: [], assessments: [], streak: 0, log: [],
    settings: { theme: 'nocturno', dailyLimitMin: limitMin },
    time: { [dk]: { ms, sessions: 1, extraUsed: extraUsed || 0 } },
  };
}

setTimeout(() => {
  log('== 挂载 ==');
  step('模块已挂载', () => { if (!q('#subnav')) throw new Error('no subnav'); });
  step('设置面板默认收起', () => {
    const p = q('#settingsPanel');
    if (!p.hidden) throw new Error('面板默认就开着（hidden 未生效）');
  });
  step('默认在「学习」子视图', () => { if (!/每日学习/.test(txt())) throw new Error(txt().slice(0, 120)); });
  step('音标模块已移除', () => {
    const labels = [...doc.querySelectorAll('#subnav button')].map(b => b.textContent);
    if (labels.some(l => l.includes('音标'))) throw new Error('音标仍在子页签里：' + labels.join('/'));
    log('    子页签：' + labels.join(' / '));
  });

  log('== ① 认词 ==');
  let start = q('#fhStart');
  if (!start) { // 可能默认选中等级词书未选书：用「开始学习」直达认词
    const bookCard = doc.querySelector('[data-learn]');
    if (bookCard) { click(bookCard); start = q('#iKnow'); }
  }
  step('有「开始今日学习」按钮', () => { if (!start) throw new Error('missing #fhStart'); });
  step('首屏有连击徽章（留存引擎，非角落小字）', () => { if (!doc.querySelector('.streak-badge')) throw new Error('缺少 .streak-badge'); });
  step('首屏有终点感进度（还要约 N 天学完）', () => {
    const gt = doc.querySelector('.goal-track .gt-day');
    if (!gt) throw new Error('缺少 .goal-track');
    if (!/还要约/.test(gt.textContent)) throw new Error('进度文案缺「还要约 N 天」：' + gt.textContent);
  });
  click(start);
  step('进入认词卡片', () => { if (!/① 认词/.test(txt())) throw new Error(txt().slice(0, 200)); });
  // 进度保留：切到别模块再回来，应原地续上（不重开首页、不丢词）
  step('学习进度：切走再回来原地续上', () => {
    const wAt = () => (q('.learn-card .wc-word') ? q('.learn-card .wc-word').textContent.trim() : '');
    click(q('#iKnow')); click(q('#iKnow'));        // 推进 2 词
    const wBefore = wAt();
    if (!wBefore) throw new Error('推进后没有当前词');
    click([...doc.querySelectorAll('#subnav button')].find(b => b.textContent === '测评'));
    if (!/词汇量测评/.test(txt())) throw new Error('没切到测评');
    click([...doc.querySelectorAll('#subnav button')].find(b => b.textContent === '学习'));
    if (!/① 认词/.test(txt())) throw new Error('切回后没在认词：' + txt().slice(0, 120));
    const wAfter = wAt();
    if (wAfter !== wBefore) throw new Error('切走再回来词变了：' + wBefore + ' → ' + wAfter);
    if (q('#fhStart')) throw new Error('切走再回来又退回首页（进度丢失）');
    log('    切走再回来仍停在原地（' + wAfter + '）');
  });
  step('认词有中文翻译', () => {
    const zh = q('.learn-card .wc-zh .zh');
    if (!zh || !/[一-龥]/.test(zh.textContent)) throw new Error('认词卡片缺少中文翻译');
    log('    翻译示例：' + zh.textContent.trim());
  });
  step('认词：空格 = 下一个（同时保留按钮）', () => {
    if (!q('#iKnow').hasAttribute('data-next')) throw new Error('「认识了，下一个」没挂快捷键标记');
    const w1 = q('.learn-card .wc-word').textContent.trim();
    keyCard(' ');
    const w2 = q('.learn-card .wc-word') ? q('.learn-card .wc-word').textContent.trim() : '';
    if (!w2) throw new Error('按空格后没停在认词卡：' + txt().slice(0, 120));
    if (w1 === w2) throw new Error('按空格没有换到下一个词（还是 ' + w1 + '）');
    log('    空格：' + w1 + ' → ' + w2);
  });
  step('认词：回车 = 下一个', () => {
    const w1 = q('.learn-card .wc-word').textContent.trim();
    keyCard('Enter');
    const w2 = q('.learn-card .wc-word') ? q('.learn-card .wc-word').textContent.trim() : '';
    if (!w2 || w1 === w2) throw new Error('回车没有换词：' + w1 + ' → ' + w2);
  });

  // 走完认词：统计例句覆盖，并抽查点词弹窗 + 例句不剧透
  let guard = 0, withEx = 0, cards = 0, popupTested = false, tipFallback = 0, zhToggleTested = false;
  while (q('#iKnow') && guard++ < 60) {
    cards++;
    const exBox = q('.ex-box');
    if (!exBox) { click(q('#iKnow')); continue; }
    const exWords = doc.querySelectorAll('.ex-w').length;
    if (exWords) {
      withEx++;
      const sent = exBox.querySelector('.ex-sent');
      if (sent && /[一-龥]/.test(sent.textContent)) {
        log('  ✗ 例句里出现中文：' + sent.textContent); process.exitCode = 1;
      }
      if (!popupTested) {
        popupTested = true;
        click(doc.querySelector('.ex-w'));
        if (!q('.sheet')) { log('  ✗ 点单词没有弹出释义'); process.exitCode = 1; }
        else { log('  ✓ 点单词弹出释义：' + q('.sheet').textContent.replace(/\s+/g, ' ').trim().slice(0, 40)); click(q('#lkClose')); }
      }
      if (!zhToggleTested) {
        zhToggleTested = true;
        const btn = exBox.querySelector('.ex-zh-btn');
        const box = exBox.querySelector('.ex-zh');
        if (btn && box) {
          // 默认必须收起，且例句本身不含中文
          if (!box.hidden) { log('  ✗ 例句中文默认是展开的（应该收起）'); process.exitCode = 1; }
          else if (box.textContent.trim()) { log('  ✗ 例句中文默认就有内容'); process.exitCode = 1; }
          else {
            click(btn);
            if (box.hidden || !/[一-龥]/.test(box.textContent)) { log('  ✗ 点「看中文」没展开'); process.exitCode = 1; }
            else {
              log('  ✓ 例句中文可展开：' + box.textContent.trim());
              click(btn);
              if (!box.hidden) { log('  ✗ 再点一次没收起'); process.exitCode = 1; }
              else log('    （再点一次已收起）');
            }
          }
        }
      }
    } else tipFallback++;
    click(q('#iKnow'));
  }
  log(`    认词 ${cards} 张：有例句 ${withEx} · 发音提示兜底 ${tipFallback}`);
  step('认词走完进入阶段关卡', () => { if (!/继续第 2 步/.test(txt())) throw new Error(txt().slice(0, 200)); });
  click(q('#fgNext'));

  log('== ② 记词 ==');
  step('进入记词自评', () => { if (!/② 记词/.test(txt())) throw new Error(txt().slice(0, 200)); });
  step('自评前不显示中文', () => { const z = q('#zhBox'); if (z && /[一-龥]/.test(z.textContent)) throw new Error('中文提前泄露'); });
  step('有 我会 / 我不会', () => { if (!q('#evYes') || !q('#evNo')) throw new Error('missing eval buttons'); });
  step('记词有跟写输入框', () => { if (!q('#evType')) throw new Error('missing #evType'); });
  step('跟写时不显示中文', () => {
    const zh = q('#zhBox');
    if (zh && /[一-龥]/.test(zh.textContent)) throw new Error('记词阶段提前显示翻译');
  });
  step('跟写输入有实时校验', () => {
    const inp = q('#evType');
    inp.value = 'zzz';
    inp.dispatchEvent(new window.Event('input'));
    const fb = q('#evFb');
    if (!fb || !fb.innerHTML) throw new Error('无逐字反馈');
    inp.value = '';
    inp.dispatchEvent(new window.Event('input'));
  });
  step('看例句后带整体朗读按钮', () => {
    const exBtn = q('#evEx'); if (!exBtn) throw new Error('no #evEx');
    click(exBtn); // 展开例句
    if (!q('#exPlay2')) throw new Error('记词阶段例句缺少朗读按钮');
    const exBtn2 = q('#evEx'); if (exBtn2) click(exBtn2); // 收起
  });
  // 第一次点「我不会」，验证会重新排队
  click(q('#evNo'));
  step('自评后显示中文', () => { const z = q('#zhBox'); if (!z || !/[一-龥]/.test(z.textContent)) throw new Error('未显示中文'); });
  step('记词：答完才放出空格/回车 = 下一个', () => {
    const n = q('#evNext');
    if (!n.hasAttribute('data-next')) throw new Error('答完后「下一个」没挂快捷键标记');
    const before = txt();
    keyCard(' ');
    if (txt() === before) throw new Error('按空格没前进');
  });
  step('记词阶段进度同样保留（切走再回来）', () => {
    // 先回到未答状态，记录当前词
    const wBefore = q('.learn-card .wc-word') ? q('.learn-card .wc-word').textContent.trim() : '';
    if (!wBefore) throw new Error('记词卡没有当前词');
    click([...doc.querySelectorAll('#subnav button')].find(b => b.textContent === '复习'));
    if (!/复习/.test(txt())) throw new Error('没切到复习');
    click([...doc.querySelectorAll('#subnav button')].find(b => b.textContent === '学习'));
    if (!/② 记词/.test(txt())) throw new Error('切回后没在记词：' + txt().slice(0, 120));
    const wAfter = q('.learn-card .wc-word') ? q('.learn-card .wc-word').textContent.trim() : '';
    if (wAfter !== wBefore) throw new Error('记词切走再回来词变了：' + wBefore + ' → ' + wAfter);
    if (q('#fhStart')) throw new Error('记词切走再回来退回首页');
    log('    记词切走再回来仍停在原词（' + wAfter + '）');
  });
  guard = 0;
  while (q('#evYes') && guard++ < 300) { click(q('#evYes')); const n = q('#evNext'); if (n) click(n); }
  step('记词走完进入第 3 步', () => { if (!/继续第 3 步/.test(txt())) throw new Error(txt().slice(0, 200)); });
  step('阶段关卡：「继续」也能用空格/回车', () => {
    const btn = q('#fgNext');
    if (!btn.hasAttribute('data-next')) throw new Error('「继续第 3 步」没挂快捷键标记');
    keyCard('Enter');
    if (/继续第 3 步/.test(txt())) throw new Error('按回车没有进入下一步');
  });

  log('== ③ 自测 ==');
  step('进入自测', () => { if (!/自测/.test(txt())) throw new Error(txt().slice(0, 200)); });
  step('有 4 个选项', () => { const n = doc.querySelectorAll('#opts .opt').length; if (n !== 4) throw new Error('选项数=' + n); });
  step('自测：答完题后 空格 = 下一题', () => {
    const num = () => { const m = txt().match(/(\d+)\/(\d+)/); return m ? m[1] : ''; };
    const n1 = num();
    click(doc.querySelector('#opts .opt:not([disabled])'));
    const sk = q('#tskip');
    if (!sk.hasAttribute('data-next')) throw new Error('答完题后「下一个」没挂快捷键标记');
    keyCard(' ');
    const n2 = num();
    if (!n2 || n1 === n2) throw new Error('按空格没进下一题：' + n1 + ' → ' + n2);
  });
  guard = 0;
  while (q('#opts') && guard++ < 300) {
    const o = doc.querySelector('#opts .opt:not([disabled])');
    if (o) click(o);
    const n = q('#tskip'); if (n) click(n);
  }
  step('自测走完进入第 4 步', () => { if (!/继续第 4 步/.test(txt())) throw new Error(txt().slice(0, 200)); });
  click(q('#fgNext'));

  log('== ④ 默写 ==');
  step('进入默写', () => { if (!/④ 默写/.test(txt())) throw new Error(txt().slice(0, 200)); });
  step('默写输入框上方有西语符号键，点一下就插入（不用长按字母）', () => {
    const input = q('#tinput');
    if (!input) throw new Error('没有默写输入框 #tinput');
    const keys = [...doc.querySelectorAll('.es-key')];
    if (keys.length < 9) throw new Error('符号键数量=' + keys.length);
    input.value = 'zzz';                       // 故意用不可能正确的输入，避免误触发进下一步
    const btn = keys.find(b => b.textContent.trim() === 'ñ');
    if (!btn) throw new Error('没有 ñ 键');
    click(btn);
    if (input.value !== 'zzzñ') throw new Error('插入后 input=' + input.value);
    const acc = keys.find(b => b.textContent.trim() === 'á');
    click(acc);
    if (input.value !== 'zzzñá') throw new Error('连续插入后 input=' + input.value);
    input.value = '';
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    log('    符号键：' + keys.map(b => b.textContent.trim()).join(' '));
  });
  step('默写不显示目标西语词', () => {
    const c = q('.type-card');
    if (q('.big-es')) throw new Error('默写界面直接显示了答案');
    if (!/用西语作答/.test(c.textContent)) throw new Error('no prompt: ' + c.textContent.slice(0, 120));
    if (!/[一-龥]/.test(c.textContent)) throw new Error('默写没有给中文提示');
  });
  step('有拼写练习切换', () => { if (!q('#dmTrace')) throw new Error('missing #dmTrace'); });
  click(q('#dmTrace'));
  step('切到拼写练习后会显示单词', () => { if (!q('.big-es')) throw new Error('拼写练习未显示单词'); });
  click(q('#dmRecall'));
  step('切回默写', () => { if (q('.big-es')) throw new Error('仍显示单词'); });
  step('默写写错：强制退回同一个词重默，写对才出现「下一个」', () => {
    const p1 = q('.type-prompt') ? q('.type-prompt').textContent : '';
    q('#tinput').value = 'zzzzzz';
    click(q('#tcheck'));
    const ansEl = q('#tmsg b');
    if (!ansEl || !ansEl.textContent.trim()) throw new Error('写错后没显示答案');
    const ans = ansEl.textContent.trim();
    // 1) 没写对前，不允许出现任何前进出口
    if (/下一个/.test(q('#tcheck').textContent)) throw new Error('写错就直接给了「下一个」：' + q('#tcheck').textContent);
    if (q('#tretry')) throw new Error('「重默」按钮应已移除（现为强制，不该有可选按钮）');
    const sk = q('#tskip');
    if (sk && !sk.hidden) throw new Error('写错后仍能看到跳过/下一个');
    // 2) 必须退回同一个词
    const p2 = q('.type-prompt') ? q('.type-prompt').textContent : '';
    if (p1 !== p2) throw new Error('写错后换了词：' + p1 + ' → ' + p2);
    // 3) 输入框仍可用，能接着重默
    const inp2 = q('#tinput');
    if (!inp2 || inp2.disabled) throw new Error('输入框被禁用，没法重默');
    // 4) 写对了才放行
    inp2.value = ans;
    click(q('#tcheck'));
    if (!/正确/.test(txt())) throw new Error('写对后没判正确：' + txt().slice(0, 200));
    if (!/下一个/.test(q('#tcheck').textContent)) throw new Error('写对后没出现「下一个」：' + q('#tcheck').textContent);
    log('    写错被拦住 → 同一词重默 → 补对「' + ans + '」后才放行');
  });
  step('默写：写错时快捷键被锁，写对后空格 = 下一个', () => {
    const num = () => { const m = txt().match(/(\d+)\/(\d+)/); return m ? m[1] : ''; };
    // 先确认当前卡的「下一个」是可用的
    if (!q('#tcheck').hasAttribute('data-next')) throw new Error('写对后「下一个」没挂快捷键标记');
    const n1 = num();
    keyCard(' ');
    const n2 = num();
    if (!n2 || n1 === n2) throw new Error('按空格没换词：' + n1 + ' → ' + n2);
    // 新卡是「写错状态」：写错后必须没有任何快捷键出口
    const inp = q('#tinput');
    inp.value = 'zzzzzz';
    click(q('#tcheck'));
    if (q('#tcheck').hasAttribute('data-next')) throw new Error('写错后仍挂着「下一个」快捷键（能绕过强制重默）');
    if (q('#tskip') && q('#tskip').hasAttribute('data-next')) throw new Error('写错后隐藏的跳过仍挂着快捷键');
    const p1 = q('.type-prompt') ? q('.type-prompt').textContent : '';
    keyCard(' ');
    keyCard('Enter');
    const p2 = q('.type-prompt') ? q('.type-prompt').textContent : '';
    if (p1 !== p2) throw new Error('写错后用空格/回车绕过了强制重默');
    log('    写错后空格与回车都推不动，必须写对');
  });
  step('默写：焦点在输入框时，空格不被当成「下一个」', () => {
    const inp = q('#tinput');
    inp.value = '';
    const p1 = q('.type-prompt') ? q('.type-prompt').textContent : '';
    key(inp, ' ');          // 在输入框里按空格
    key(inp, 'a');
    const p2 = q('.type-prompt') ? q('.type-prompt').textContent : '';
    if (p1 !== p2) throw new Error('输入框里按空格被误判成「下一个」');
  });
  // 默写现在是「写错不给过」，所以不能靠狂点跳过来通关 —— 必须真的写对
  guard = 0;
  while (guard++ < 300 && !/今日四步流程全部完成/.test(txt())) {
    const inp = q('#tinput');
    if (inp && !inp.disabled) {
      let ans = q('#tmsg b');                       // 答案已显示（写错过）就直接取
      if (!ans) { inp.value = 'zzz'; click(q('#tcheck')); ans = q('#tmsg b'); }  // 否则先写错以拿到答案
      if (ans) { inp.value = ans.textContent.trim(); click(q('#tcheck')); continue; }
    }
    const sk = q('#tskip');
    if (sk && !sk.hidden) { click(sk); continue; }
    break;
  }
  step('四步走完显示完成页', () => { if (!/今日四步流程全部完成/.test(txt())) throw new Error(txt().slice(0, 240)); });

  log('== 测评 ==');
  click([...doc.querySelectorAll('#subnav button')].find(b => b.textContent === '测评'));
  step('测评只考学过的词', () => {
    const t = txt();
    if (!/已学 \d+ 词/.test(t)) throw new Error(t.slice(0, 200));
  });
  step('题量跟随每日词量', () => { const t = txt(); if (!/本次 (\d+) 题/.test(t)) throw new Error(t.slice(0, 200)); });
  step('有选项', () => { const n = doc.querySelectorAll('#optBox .opt').length; if (n < 2) throw new Error('选项数=' + n); });
  step('测评能走到结算页，且不再恒显示「新掌握 0 词」', () => {
    for (let i = 0; i < 40; i++) {
      if (/本次测评完成/.test(txt())) break;
      const opt = q('#optBox .opt');
      if (opt) click(opt);
      else if (q('#fillIn')) { q('#fillIn').value = 'zzz'; click(q('#submitFill')); }
      const nav = doc.querySelectorAll('#navRow button');
      if (nav.length) click(nav[nav.length - 1]);
    }
    const t = txt();
    if (!/本次测评完成/.test(t)) throw new Error('没走到结算页：' + t.slice(0, 200));
    if (!/答对 \d+\/\d+ 词/.test(t)) throw new Error('结算页没显示答对数：' + t.slice(0, 200));
    if (/新掌握 0 词/.test(t)) throw new Error('仍在显示「新掌握 0 词」');
    log('    ' + (t.match(/答对 \d+\/\d+ 词/) || [])[0]);
  });

  log('== 复习 ==');
  click([...doc.querySelectorAll('#subnav button')].find(b => b.textContent === '复习'));
  step('复习页有每日上限', () => { if (!q('#capSeg')) throw new Error('missing #capSeg'); });
  step('复习页显示今日新学/待复习', () => {
    const t = txt();
    if (!/往日学的 \d+ · 今天新学 \d+/.test(t)) throw new Error(t.slice(0, 240));
  });
  step('今天学的词进入复习队列', () => {
    const t = txt();
    const m = t.match(/今天新学 (\d+)/);
    if (!m || +m[1] < 1) throw new Error('今天学的词没进复习：' + t.slice(0, 200));
    log('    今日待复习 ' + (t.match(/(\d+) 今日待复习/) || [])[1] + ' · 今天新学计入 ' + m[1]);
  });
  click([...doc.querySelectorAll('#capSeg button')].find(b => b.textContent === '50'));
  step('上限可切换', () => { if (!/每天最多练 50 张/.test(txt())) throw new Error(txt().slice(0, 200)); });

  log('== 设置项 ==');
  click([...doc.querySelectorAll('#subnav button')].find(b => b.textContent === '学习'));
  step('自动发音开关已移除（常开）', () => { if (q('#autoSpk')) throw new Error('开关仍在，应已移除'); });
  step('每日词量可选', () => {
    const g = [...doc.querySelectorAll('#goalSeg button')];
    if (g.length !== 5) throw new Error('goalSeg=' + g.length);
    click(g.find(b => b.textContent === '30'));
    if (!/学 30 个词/.test(txt())) throw new Error(txt().slice(0, 200));
  });

  // 主题词表已砍（46 词 100% 被等级词书覆盖，撑不起每日词量）。
  // 这里守住砍掉它的前提：单一词源（A1，980 词）必须能取满 30 词且不再需要「补足」逻辑。
  log('== 每日词量取满 ==');
  step('A1 词书能取满 30 词', () => {
    const t = txt();
    if (!/学 30 个词/.test(t)) throw new Error('没取满：' + t.slice(0, 220));
    if (/自动从其他主题补/.test(t)) throw new Error('还在走已删除的主题补足逻辑：' + t.slice(0, 220));
    log('    ' + (t.match(/每天从[^·]*· 连续[^·]*/) || [''])[0].trim());
  });
  {
    const s = q('#fhStart') || q('#fhAgain');   // 今日已完成后按钮变成「再练一轮」
    if (s) click(s);
    let n = 0;
    while (q('#iKnow') && n < 80) { n++; click(q('#iKnow')); }
    step('认词实际走了 30 张', () => { if (n !== 30) throw new Error('认词张数=' + n); });
    log('    认词实际张数 = ' + n);
  }

  log('== 在线发音设置 ==');
  click(q('#settingsBtn'));
  step('设置面板可打开', () => { if (q('#settingsPanel').hidden) throw new Error('panel hidden'); });
  step('在线发音开关在', () => { if (!q('#ttsToggle')) throw new Error('no ttsToggle'); });
  click(q('#ttsToggle'));
  step('开启后显示密钥输入', () => {
    if (q('#ttsOpts').style.display !== 'block') throw new Error('opts not shown');
    if (q('#ttsToggle').textContent !== '开') throw new Error('toggle label=' + q('#ttsToggle').textContent);
    if (!q('#ttsKey')) throw new Error('no key input');
  });
  // 切到 ElevenLabs 应显示声音 ID、隐藏区域
  q('#ttsProvider').value = 'eleven';
  q('#ttsProvider').dispatchEvent(new window.Event('change'));
  step('ElevenLabs 显示声音 ID', () => {
    if (q('#ttsVoiceRow').style.display !== 'flex') throw new Error('voice row hidden');
    if (q('#ttsRegionRow').style.display === 'flex') throw new Error('region row still shown');
  });
  // 填 key + 切回 azure，确保 speech.configure 被调用且不崩溃
  q('#ttsKey').value = 'test-key';
  q('#ttsKey').dispatchEvent(new window.Event('input'));
  q('#ttsProvider').value = 'azure';
  q('#ttsProvider').dispatchEvent(new window.Event('change'));
  step('配置写入不报错', () => { if (!/test-key/.test(window.localStorage.getItem('es_mvp_v1') || '')) throw new Error('key not persisted'); });

  log('== 语法：变位 / 冠词 ==');
  const gBtn = [...doc.querySelectorAll('#subnav button')].find(b => b.textContent.includes('语法'));
  step('有「语法」子页', () => { if (!gBtn) throw new Error('no grammar tab'); });
  click(gBtn);
  step('进入语法速练', () => { if (!/语法速练/.test(txt())) throw new Error(txt().slice(0, 160)); });
  step('动词变位题能出题', () => {
    const opts = doc.querySelectorAll('.opt-list .opt');
    if (opts.length < 4) throw new Error('选项数 ' + opts.length);
    log('    题干：' + (q('.gq-p') || {}).textContent + ' → ' + [...opts].map(o => o.textContent).join(' | '));
  });
  step('答题后给出变位表', () => {
    click(doc.querySelector('.opt-list .opt'));
    if (!q('.fb')) throw new Error('no feedback');
    if (!q('#gFb .gj-grid')) throw new Error('no conjugation table');
  });
  step('可展开 6 人称 / 收起', () => {
    const btn = q('.gj-more');
    if (!btn) { log('    （已是完整表，跳过）'); return; }
    const box = btn.closest('.gj');
    click(btn);
    if (!box.classList.contains('open')) throw new Error('not expanded');
  });
  step('切换到名词冠词模式', () => {
    const nBtn = [...doc.querySelectorAll('#gSeg button')].find(b => b.dataset.m === 'noun');
    if (!nBtn) throw new Error('no noun seg');
    click(nBtn);
    const opts = [...doc.querySelectorAll('.opt-list .opt')].map(o => o.textContent);
    if (opts.length < 4) throw new Error('选项数 ' + opts.length);
    if (!opts.some(o => /^(el|la) \S/.test(o))) throw new Error('选项里没有带冠词的答案：' + opts.join('|'));
    log('    冠词题：' + (q('.gq-p') || {}).textContent + ' → ' + opts.join(' | '));
  });
  step('冠词题答题给规则说明', () => {
    click(doc.querySelector('.opt-list .opt'));
    if (!q('.fb')) throw new Error('no feedback');
    const note = q('#gFb .gj-note');
    if (!note || !note.textContent.trim()) throw new Error('no rule note');
    log('    规则：' + note.textContent.trim());
  });
  step('规则速查表在', () => { if (!q('#gRef .rf-row')) throw new Error('no ref rows'); if (doc.querySelectorAll('#gRef .rf-row').length < 6) throw new Error('ref rows too few'); });
  step('语法：空格 = 下一题', () => {
    const btn = q('#gNext');
    if (!btn.hasAttribute('data-next')) throw new Error('「下一题」没挂快捷键标记');
    const before = (q('.gq-p') || {}).textContent || '';
    keyCard(' ');
    const after = (q('.gq-p') || {}).textContent || '';
    if (!after || before === after) throw new Error('按空格没进下一题：' + before + ' → ' + after);
  });
  click([...doc.querySelectorAll('#subnav button')].find(b => b.textContent.includes('学习')));

  log('== 学习统计 ==');
  const stBtn = [...doc.querySelectorAll('#subnav button')].find(b => b.textContent.includes('统计'));
  step('有「统计」子页', () => { if (!stBtn) throw new Error('no stats tab'); });
  click(stBtn);
  step('进入学习统计', () => { if (!/学习统计/.test(txt())) throw new Error(txt().slice(0, 160)); });
  step('4 个概览卡 + 热力图 + 掌握柱 + 错词本', () => {
    if (doc.querySelectorAll('.stat-card').length !== 4) throw new Error('stat cards=' + doc.querySelectorAll('.stat-card').length);
    if (doc.querySelectorAll('.hm').length < 30) throw new Error('heat cells=' + doc.querySelectorAll('.hm').length);
    if (doc.querySelectorAll('.md-col').length !== 6) throw new Error('mastery cols=' + doc.querySelectorAll('.md-col').length);
    log('    学过/今日/待复习/已掌握 = ' + [...doc.querySelectorAll('.stat-n')].map(n => n.textContent).join(' / '));
  });
  // 直接喂一条错词记录以验证错词本和重练
  window.localStorage.setItem('es_mvp_v1', JSON.stringify({
    words: [{ word: 'ser', zh: '是', pos: 'v', lapses: 3, reps: 5, mastery: 1, learnedAt: Date.now() - 86400000, due: Date.now(), mastered: false }],
    log: [{ at: Date.now(), kind: 'review', ok: false, word: 'ser' }],
    settings: {}, assessments: [],
  }));
  click(stBtn);  // 重渲染（用之前修改过的状态）
  step('错词本列出来 + 可开始重练', () => {
    if (!q('.ww-row')) throw new Error('no wrong word row');
    log('    错词：' + q('.ww-row .ww-es').textContent);
    if (!q('#wwDrill')) throw new Error('no drill button');
  });
  step('错词重练能走完 1 题', () => {
    click(q('#wwDrill'));
    if (!/错词重练/.test(txt())) throw new Error('not in drill');
    click(q('#wwShow'));
    click(q('.rate.ok'));
    // 只有 1 个错词，答完直接进入结果页
    if (!/(再来一次|清掉|本轮)/.test(txt())) throw new Error('not in finish: ' + txt().slice(0,200));
  });
  // 回归点：新词/学习态点「忘记」时 FSRS 的 lapses 不会 +1，
  // 老逻辑只认 lapses → 这类词永远进不了错词本。现在靠 forgot 计数兜住。
  window.localStorage.setItem('es_mvp_v1', JSON.stringify({
    words: [{ word: 'estar', zh: '在', pos: 'v', lapses: 0, forgot: 2, reps: 1, mastery: 1, learnedAt: Date.now() - 86400000, due: Date.now(), mastered: false }],
    log: [{ at: Date.now(), kind: 'review', ok: false, word: 'estar' }],
    settings: {}, assessments: [],
  }));
  click(stBtn);
  step('点过「忘记」但 FSRS lapses=0 的词也能进错词本', () => {
    if (!q('.ww-row')) throw new Error('forgot 词没进错词本');
    const lap = q('.ww-row .ww-lap') ? q('.ww-row .ww-lap').textContent : '';
    log('    错词：' + q('.ww-row .ww-es').textContent + ' · ' + lap);
    if (!/×\s*[1-9]/.test(lap)) throw new Error('错次显示为 0：' + lap);
  });
  click([...doc.querySelectorAll('#subnav button')].find(b => b.textContent.includes('学习')));

  log('== 备份与 PWA ==');
  // 强制重置面板状态后再测「按钮能开 / 按钮能关」，避免受之前 section 状态影响
  q('#settingsPanel').hidden = true;
  click(q('#settingsBtn'));
  step('设置面板有导出/导入', () => { if (!q('#exportBtn') || !q('#importBtn') || !q('#importFile')) throw new Error('missing backup buttons'); });
  step('manifest 已接入', () => { const l = q('link[rel="manifest"]'); if (!l) throw new Error('no manifest link'); if (!/manifest\.webmanifest$/.test(l.getAttribute('href'))) throw new Error(l.getAttribute('href')); });
  step('有苹果触摸图标', () => { if (!q('link[rel="apple-touch-icon"]')) throw new Error('no apple-touch-icon'); });
  step('导出备份不报错', () => {
    if (typeof window.URL.createObjectURL !== 'function') { log('    （jsdom 不支持 Blob URL，跳过）'); return; }
    try { click(q('#exportBtn')); } catch (e) { if (/not implemented/i.test(e.message)) { log('    （jsdom 不支持，跳过）'); return; } throw e; }
  });
  click(q('#settingsBtn'));
  step('再点一次设置能收起', () => {
    const p = q('#settingsPanel');
    if (!p.hidden) throw new Error('面板关不上');
  });

  log('== 词源只有等级词书 + 「开始学习」直达 ==');
  click([...doc.querySelectorAll('#subnav button')].find(b => b.textContent.includes('学习')));
  step('主题词表已移除（无词源切换）', () => {
    if (q('#srcSeg')) throw new Error('词源切换 #srcSeg 仍在');
    if (/主题词表/.test(doc.body.textContent)) throw new Error('页面仍有「主题词表」字样');
  });
  step('默认落在 A1 词书，点返回词书库可看到卡片', () => {
    const back = q('#bkBack');
    if (back) click(back);           // 当前在词书详情页就先返回列表
    const btns = [...doc.querySelectorAll('[data-learn]')];
    if (!btns.length) throw new Error('no book cards');
    if (!btns.some(b => /开始学习/.test(b.textContent))) throw new Error('label=' + btns[0].textContent);
    if (btns.some(b => /浏览/.test(b.textContent))) throw new Error('旧文案「浏览」仍在');
    log('    按钮：' + btns[0].textContent + ' / ' + btns[0].nextElementSibling.textContent);
  });
  step('点「开始学习」直接进入①认词（不再多一步）', () => {
    click(doc.querySelector('[data-learn]'));
    if (!/① 认词/.test(txt())) throw new Error('没有直达认词：' + txt().slice(0, 200));
  });
  step('直达后仍保留了「加入复习」入口', () => {
    click([...doc.querySelectorAll('#subnav button')].find(b => b.textContent.includes('学习')));
    const back = q('#bkBack');
    if (back) click(back);
    const enroll = doc.querySelector('[data-enroll]');
    if (!enroll) throw new Error('no enroll button after switching back');
  });

  log('\n== 致命问题修复（用户导向） ==');

  step('顶栏有主题切换按钮，点击循环切换主题并记住选择', () => {
    const tb = q('#themeBtn');
    if (!tb) throw new Error('没有主题切换按钮 #themeBtn');
    click(tb);
    const after1 = doc.documentElement.dataset.theme;
    if (after1 === 'nocturno') throw new Error('点击后未切换主题，data-theme=' + after1);
    const raw = JSON.parse(window.localStorage.getItem('es_mvp_v1') || '{}');
    if (!raw.settings || raw.settings.theme !== after1) throw new Error('未持久化主题选择');
    click(tb);
    const after2 = doc.documentElement.dataset.theme;
    if (after2 === after1) throw new Error('再次点击未切换主题');
  });
  step('顶栏 ? 能打开结构化引导面板', () => {
    click(q('#helpBtn'));
    const g = q('.guide-sheet');
    if (!g) throw new Error('没有引导面板');
    if (!g.querySelector('#guideStart')) throw new Error('缺少「开始学习」按钮');
    if (!/四步/.test(g.textContent)) throw new Error('缺少四步说明');
    if (!/á|ñ/.test(g.textContent)) throw new Error('缺少重音符号说明');
  });
  step('引导是分层排版而非一坨 alert 文案', () => {
    const g = q('.guide-sheet');
    if (g.querySelectorAll('.guide-step').length !== 4) throw new Error('分步条目数=' + g.querySelectorAll('.guide-step').length);
    if (!g.querySelector('.guide-title')) throw new Error('没有标题层级');
    if (!g.querySelectorAll('.guide-sec h3').length) throw new Error('没有分区小标题');
  });
  step('关掉引导后记住已读，不再重复打扰', () => {
    click(q('#guideClose'));
    if (q('.guide-sheet')) throw new Error('面板没关掉');
    const all = Object.keys(window.localStorage).map(k => window.localStorage.getItem(k)).join('|');
    if (!/onboarded/.test(all)) throw new Error('未写入 onboarded 标记');
  });

  step('提示容器已挂载（异步失败不再静默）', () => {
    if (!q('#toastHost')) throw new Error('no toast host');
  });
  step('缺少语音能力时明确告知用户，而非毫无反应', () => {
    const t = q('.toast.err');
    if (!t) throw new Error('没有出现语音失败提示');
    if (!/语音/.test(t.textContent)) throw new Error('文案不对：' + t.textContent.slice(0, 60));
    log('    ' + t.textContent.replace(/\s+/g, ' ').slice(0, 70));
  });

  log('\n== 学习时间管控 · 窄屏右下角浮层（<1240px） ==');
  const ls = () => JSON.parse(window.localStorage.getItem('es_mvp_v1') || '{}');
  // 浮层卡片要限定在 .cw-slot 里找：宽屏下右栏也有一张 .cw-card
  const bubbleCard = () => doc.querySelector('.cw-slot .cw-card');

  step('右下角浮层已挂载', () => {
    if (!q('#clockWidget')) throw new Error('缺少 #clockWidget');
    if (!q('#cwBubble')) throw new Error('缺少气泡按钮 #cwBubble');
  });
  step('浮层有环形进度与可读的无障碍标签', () => {
    if (!doc.querySelector('.cw-bubble .cw-ring .pg')) throw new Error('缺少进度环');
    const lab = q('#cwBubble').getAttribute('aria-label');
    if (!lab || !/分钟|上限/.test(lab)) throw new Error('aria-label 不达意：' + lab);
  });
  step('未设上限时显示「已学」而非「剩余」', () => {
    if (q('#cwLab').textContent.trim() !== '已学') throw new Error('标签=' + q('#cwLab').textContent);
  });
  step('点气泡展开详情卡，再点收起', () => {
    click(q('#cwBubble'));
    if (!bubbleCard()) throw new Error('点开没有 .cw-card');
    click(q('#cwX'));
    if (bubbleCard()) throw new Error('收起后卡片仍在');
  });

  step('设置面板有「每日上限」分档（含不限）', () => {
    click(q('#settingsBtn'));
    const chips = [...doc.querySelectorAll('#limitChips .limit-chip')];
    if (chips.length < 5) throw new Error('分档太少：' + chips.length);
    if (chips[0].textContent.trim() !== '不限') throw new Error('第一档不是「不限」：' + chips[0].textContent);
    if (!chips.some(c => /^\d+ 分钟$/.test(c.textContent.trim()))) throw new Error('没有「N 分钟」分档');
  });
  step('选 20 分钟：落盘 + 高亮 + 浮层切到「剩余」', () => {
    const t = [...doc.querySelectorAll('#limitChips .limit-chip')].find(c => c.dataset.min === '20');
    if (!t) throw new Error('没有 20 分钟档');
    click(t);
    if ((ls().settings || {}).dailyLimitMin !== 20) throw new Error('未落盘 dailyLimitMin=' + JSON.stringify(ls().settings));
    const on = doc.querySelector('#limitChips .limit-chip.on');
    if (!on || on.dataset.min !== '20') throw new Error('高亮没落在 20 档：' + (on && on.dataset.min));
    if (q('#cwLab').textContent.trim() !== '剩余') throw new Error('浮层标签未切到「剩余」：' + q('#cwLab').textContent);
    if (!/20 分钟/.test(q('#limitHint').textContent)) throw new Error('提示文案没跟着更新：' + q('#limitHint').textContent);
  });
  step('浮层 aria-label 反映剩余时间', () => {
    const lab = q('#cwBubble').getAttribute('aria-label');
    if (!/剩余 \d+ 分钟/.test(lab)) throw new Error('aria-label=' + lab);
  });
  step('改回「不限」：清零并复位浮层', () => {
    click(doc.querySelector('#limitChips .limit-chip[data-min="0"]'));
    if ((ls().settings || {}).dailyLimitMin !== 0) throw new Error('未清零');
    if (q('#cwLab').textContent.trim() !== '已学') throw new Error('标签没复位：' + q('#cwLab').textContent);
  });
  click(q('#settingsBtn'));   // 收起设置

  // 回归：设置面板有「点面板外自动收起」，而「调整上限」按钮在面板外 —— 不把挂件所在容器
  // 排除掉，点它就会「刚打开又被自己关掉」。
  step('浮层「调整上限」能打开设置面板（不被外部点击逻辑立刻关掉）', () => {
    click(q('#cwBubble'));
    const card = bubbleCard();
    const btn = card && card.querySelector('#cwSet');
    if (!btn) throw new Error('浮层卡片里没有「调整上限」');
    click(btn);
    const p = q('#settingsPanel');
    if (!p || p.hidden) throw new Error('面板被外部点击逻辑立刻关掉了');
    click(q('#settingsBtn'));   // 收起（同时验证是 toggle 而不是只能开）
    if (!q('#settingsPanel').hidden) throw new Error('再点设置按钮没收起');
    click(q('#cwX'));
  });

  step('时长数据结构已落盘（time 字段）', () => {
    // 任意一次 save() 都应带上 time（默认 {}），保证导出/导入备份能覆盖到时长
    const raw = ls();
    if (!raw.time || typeof raw.time !== 'object') throw new Error('存储里没有 time 字段：' + Object.keys(raw).join(','));
  });
  step('切到「统计」等子视图，浮层不报错且保留', () => {
    const nav = v => click([...doc.querySelectorAll('#subnav button')].find(b => b.textContent === v));
    nav('统计');
    if (!/学习统计|热力图/.test(txt())) throw new Error('没切到统计：' + txt().slice(0, 100));
    if (!q('#cwBubble')) throw new Error('切到统计后浮层消失');
    nav('语法');
    if (!q('#cwBubble')) throw new Error('切到语法后浮层消失');
    nav('学习');
  });
  step('右栏承载位 #railTime 已就位（窄屏为空，宽屏填卡）', () => {
    if (!q('#rail')) throw new Error('缺少 #rail');
    if (!q('#railTime')) throw new Error('缺少 #railTime');
  });

  log('\n== 学习时间管控 · 宽屏右栏卡片（≥1240px） ==');
  step('时长卡渲染进右栏，与「今日概览」并列', () => {
    const d = newDom(null, true);
    const dd = d.window.document;
    const host = dd.querySelector('#railTime');
    if (!host) throw new Error('缺少 #railTime');
    if (!host.querySelector('.cw-card.rail-cw')) throw new Error('右栏没有时长卡');
    if (!/今日学习时长/.test(host.textContent)) throw new Error('缺少标题：' + host.textContent.slice(0, 60));
    if (!host.querySelector('.cw-mini .cw-ring .pg')) throw new Error('缺少额度圆环');
    if (!host.querySelector('.cw-big')) throw new Error('缺少已学分钟大字');
    if (!host.querySelector('.cw-bar > i')) throw new Error('缺少额度进度条');
    if (!dd.querySelector('#cwSetR')) throw new Error('缺少「调整上限」');
    if (!dd.querySelector('#cwReviewR')) throw new Error('缺少「去复习」');
    // 关键：这张卡在右栏里（与概览卡同容器），不是浮在页面角落
    if (!dd.querySelector('#rail #railTime .cw-card')) throw new Error('时长卡不在 #rail 内');
    d.window.close();
  });
  step('右栏卡片数值正确（已学 8 / 上限 20 / 剩 12）', () => {
    const d = newDom(seeded(8 * 60000, 20), true);
    const dd = d.window.document;
    const big = dd.querySelector('#railTime .cw-big b');
    const unit = dd.querySelector('#railTime .cw-big span');
    if (!big || big.textContent !== '8') throw new Error('大数字应为 8，实际 ' + (big && big.textContent));
    if (!/上限 20/.test(unit.textContent)) throw new Error('单位行缺少上限：' + unit.textContent);
    const mv = dd.querySelector('#railTime .cw-mini-v');
    if (!/12/.test(mv.textContent)) throw new Error('圆环应显示剩余 12：' + (mv && mv.textContent));
    const bar = dd.querySelector('#railTime .cw-bar > i');
    if (bar.style.width !== '40%') throw new Error('进度条应为 40%，实际 ' + bar.style.width);
    const note = dd.querySelector('#railTime .cw-note');
    if (!/还剩 12 分钟/.test(note.textContent)) throw new Error('提示文案=' + note.textContent);
    d.window.close();
  });
  step('右栏「调整上限」能打开设置并高亮当前档', () => {
    const d = newDom(seeded(8 * 60000, 20), true);
    const dd = d.window.document;
    dd.querySelector('#cwSetR').dispatchEvent(new d.window.MouseEvent('click', { bubbles: true }));
    const p = dd.querySelector('#settingsPanel');
    if (!p || p.hidden) throw new Error('设置面板没打开');
    const on = dd.querySelector('#limitChips .limit-chip.on');
    if (!on || on.dataset.min !== '20') throw new Error('当前档位没高亮：' + (on && on.dataset.min));
    d.window.close();
  });
  step('右栏超上限 → 卡片转阻断态，给两个出口', () => {
    const d = newDom(seeded(20 * 60000, 20), true);
    const dd = d.window.document;
    const card = dd.querySelector('#railTime .cw-card.over');
    if (!card) throw new Error('右栏卡片未进入 over 态');
    if (!dd.querySelector('#cwStopR')) throw new Error('缺少「结束今天」');
    if (!dd.querySelector('#cwMoreR')) throw new Error('缺少「再学 5 分钟」');
    if (!/已学满 20 分钟/.test(card.textContent)) throw new Error('阻断文案=' + card.textContent.slice(0, 90));
    d.window.close();
  });
  step('右栏绑定生效：点「再学 5 分钟」写入 extraUsed', () => {
    const d = newDom(seeded(20 * 60000, 20), true);
    const dd = d.window.document;
    dd.querySelector('#cwMoreR').dispatchEvent(new d.window.MouseEvent('click', { bubbles: true }));
    const raw = JSON.parse(d.window.localStorage.getItem('es_mvp_v1') || '{}');
    const dk = Object.keys(raw.time || {})[0];
    const used = dk ? raw.time[dk].extraUsed : 0;
    if (used !== 1) throw new Error('续时没写盘，extraUsed=' + used);
    // 额度 20+5=25 分钟，此时已学 20 分钟 → 已脱离阻断态
    if (dd.querySelector('#railTime .cw-card.over')) throw new Error('续时后仍停在阻断态');
    d.window.close();
  });
  step('窄屏不渲染右栏卡片，信息走右下角浮层', () => {
    const d = newDom(null, false);
    const dd = d.window.document;
    const host = dd.querySelector('#railTime');
    if (host && host.querySelector('.cw-card')) throw new Error('窄屏不该在右栏渲染时长卡');
    if (!dd.querySelector('#cwBubble')) throw new Error('窄屏缺少右下角浮层');
    d.window.close();
  });
  step('宽屏下浮层仍在 DOM（由 CSS 收起，跨断点可恢复）', () => {
    const d = newDom(null, true);
    const dd = d.window.document;
    if (!dd.querySelector('#cwBubble')) throw new Error('宽屏把浮层整个删了，拉窄窗口就回不来');
    d.window.close();
  });

  log('\n== 学习时间管控 · 到上限的阻断（软阻断 + 续时） ==');
  step('浮层：今日已学超上限 → 自动展开阻断卡', () => {
    const d = newDom(seeded(20 * 60000, 20), false);
    const dd = d.window.document;
    const card = dd.querySelector('.cw-slot .cw-card.over');
    if (!card) throw new Error('未进入阻断态');
    if (!dd.querySelector('#cwStop')) throw new Error('阻断卡没有「结束今天」');
    if (!dd.querySelector('#cwMore')) throw new Error('阻断卡没有「再学 5 分钟」');
    if (!/再学 5 分钟/.test(card.textContent)) throw new Error('阻断卡文案缺续时入口');
    const vl = dd.querySelector('#cwLab');
    if (vl && !/今日|本轮/.test(vl.textContent)) throw new Error('浮层未标示已满：' + (vl && vl.textContent));
    d.window.close();
  });
  step('续时额度计入上限（20 + 5 = 25 分钟），用满后不再给入口', () => {
    const d3 = newDom(seeded(21 * 60000, 20, 1), false);
    if (d3.window.document.querySelector('.cw-slot .cw-card.over')) throw new Error('21 分钟不该再判超限（额度已含 5 分钟续时）');
    d3.window.close();

    const d4 = newDom(seeded(31 * 60000, 20, 2), false);
    const dd4 = d4.window.document;
    if (dd4.querySelector('.cw-slot .cw-card.over') && dd4.querySelector('#cwMore')) throw new Error('续时已用满 2 次仍给入口');
    d4.window.close();
  });

  log('\n== 手机端优化（hover 隔离 / 首页时长条 / 顶栏） ==');

  // 悬停态隔离：jsdom 不会应用 :hover，所以这里做的是「结构断言」——
  // 直接检查内联 CSS，确保除滚动条伪类外没有任何裸 :hover 规则留在媒体查询之外。
  step('所有 :hover 已隔离进 (hover:hover) and (pointer:fine)，触摸设备不再粘住悬停态', () => {
    const style = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
    if (!style) throw new Error('产物里没找到内联 <style>');
    // 媒体块都是单行，按行剔除后统计残留
    const leaked = style.split('\n').filter(l => !/^\s*@media \(hover:hover\)/.test(l)).join('\n');
    const raw = (leaked.match(/:hover/g) || []).length;
    const scrollbar = (leaked.match(/::-webkit-scrollbar-thumb:hover/g) || []).length;
    if (raw - scrollbar !== 0) {
      const offenders = leaked.split('\n').filter(l => /:hover/.test(l) && !/::-webkit-scrollbar/.test(l));
      throw new Error('媒体查询外仍有 ' + (raw - scrollbar) + ' 处 :hover：' + offenders.slice(0, 3).join(' | ').slice(0, 200));
    }
    const blocks = (style.match(/@media \(hover:hover\) and \(pointer:fine\)/g) || []).length;
    if (blocks < 25) throw new Error('隔离块数量异常偏少：' + blocks);
    log('    隔离块 ' + blocks + ' 个，媒体块外仅剩滚动条伪类');
  });
  step('触摸命中区已放大（例句单词 / 时长卡收起键）', () => {
    const style = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
    if (!/@media \(pointer:coarse\)\{/.test(style)) throw new Error('缺少 pointer:coarse 命中区规则');
    if (!/\.ex-w::after\{content:'';position:absolute;inset:-9px -4px/.test(style)) throw new Error('例句单词命中区未放大');
    if (!/\.cw-x::after\{content:'';position:absolute;inset:-9px/.test(style)) throw new Error('时长卡收起键命中区未放大');
  });
  step('底栏避让收敛为 --tabbar-h 单一变量（不再三处魔数）', () => {
    const style = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
    if (!/--tabbar-h:\d+px/.test(style)) throw new Error('缺少 --tabbar-h 令牌');
    if (!/--appbar-h:59px/.test(style)) throw new Error('缺少 --appbar-h 令牌');
    if (/bottom:calc\(78px/.test(style) || /bottom:calc\(76px/.test(style) || /calc\(84px/.test(style)) {
      throw new Error('仍有未变量化的避让魔数');
    }
    if (!/\.subnav\{[^}]*top:var\(--appbar-h\)/.test(style)) throw new Error('子导航未使用 --appbar-h');
  });
  step('引导面板用 dvh（地址栏展开时底部按钮不被切）', () => {
    const style = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
    if (!/\.guide-sheet\{max-height:88vh;max-height:88dvh/.test(style)) throw new Error('未使用 dvh');
  });
  step('连击格改为按类名隐藏（不再用 span:last-child 误藏「N 词」）', () => {
    const style = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
    if (/\.progress-chip span:last-child/.test(style)) throw new Error('旧的 span:last-child 规则仍在');
    if (!/\.progress-chip \.pc-streak\{display:none\}/.test(style)) throw new Error('缺少 .pc-streak 隐藏规则');
    const chip = q('#progressChip');
    if (chip && chip.querySelector('.pc-streak') && !/连学/.test(chip.textContent)) throw new Error('连击格文案异常');
  });
  step('极窄屏顶栏让位规则存在（保证 320px 不横向滚动）', () => {
    const style = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
    if (!/@media \(max-width:360px\)/.test(style)) throw new Error('缺少 ≤360px 顶栏让位规则');
    const seg = (style.match(/@media \(max-width:360px\)\{[\s\S]*?\n\}/) || [''])[0];
    if (!/\.progress-chip\{display:none\}/.test(seg)) throw new Error('≤360px 没有让出进度 chip');
  });

  step('窄屏首页 hero 内有时长条（内容已填充）', () => {
    const host = q('#heroTime');
    if (!host) throw new Error('缺少 #heroTime');
    if (!/今日已学|今日还剩|今日已学满/.test(host.textContent)) {
      throw new Error('时长条未填充：' + host.textContent.slice(0, 60));
    }
    if (!host.querySelector('.ht-v')) throw new Error('缺少数值元素');
    log('    ' + host.textContent.replace(/\s+/g, ' ').trim());
  });
  step('时长条可访问：role/tabindex/aria-label 齐备', () => {
    const host = q('#heroTime');
    if (host.getAttribute('role') !== 'button') throw new Error('role 不是 button');
    if (host.getAttribute('tabindex') !== '0') throw new Error('不可键盘聚焦');
    if (!/分钟/.test(host.getAttribute('aria-label') || '')) throw new Error('aria-label 不达意：' + host.getAttribute('aria-label'));
  });
  step('设上限后时长条从「已学」切到「还剩」，且点击能开设置', () => {
    click(q('#settingsBtn'));
    click([...doc.querySelectorAll('#limitChips .limit-chip')].find(c => c.dataset.min === '20'));
    const host = q('#heroTime');
    if (!/今日还剩/.test(host.textContent)) throw new Error('未切到「还剩」：' + host.textContent.slice(0, 60));
    if (!/剩余 \d+ 分钟/.test(host.getAttribute('aria-label'))) throw new Error('aria-label 未更新');
    click(q('#settingsBtn'));   // 收起设置，避免挡住后续点击
    click(host);
    const p = q('#settingsPanel');
    if (!p || p.hidden) throw new Error('点击时长条没有打开设置面板');
    click(q('#settingsBtn'));
    click(doc.querySelector('#limitChips .limit-chip[data-min="0"]'));
    click(q('#settingsBtn'));
    if (!/今日已学/.test(q('#heroTime').textContent)) throw new Error('改回不限后未复位');
  });
  step('宽屏下时长条不填充（交给右栏卡片，CSS 隐藏避免重复）', () => {
    const d = newDom(null, true);
    const dd = d.window.document;
    const host = dd.querySelector('#heroTime');
    if (host && /今日已学|今日还剩/.test(host.textContent)) throw new Error('宽屏仍在首页渲染时长条，与右栏重复');
    if (!dd.querySelector('#railTime .cw-card')) throw new Error('宽屏右栏卡片缺失');
    d.window.close();
  });

  step('圆环尺寸跟随外框（不再写死 62px 导致溢出与不同心）', () => {
    const style = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
    if (!/\.cw-ring\{display:block;width:100%;height:100%/.test(style)) throw new Error('圆环未改为 100% 跟随');
    if (/<svg class="cw-ring"\s+width=/.test(html)) throw new Error('气泡 SVG 仍写死 width/height，会再次出现尺寸不同心');
    if (!/\.cw-mini \.cw-ring\{width:100%;height:100%\}/.test(style)) throw new Error('右栏小圆环仍写死尺寸');
    // 两个尺寸下的几何自洽：face 半径必须小于环内缘（r - stroke/2），否则数字会压在环带上
    const geo = [
      { box: 62, r: 26, stroke: 4.5, inset: 9 },
      { box: 54, r: 26 * 54 / 62, stroke: 4.5 * 54 / 62, inset: 8 },
    ];
    geo.forEach(g => {
      const inner = g.r - g.stroke / 2;
      const faceR = g.box / 2 - g.inset;
      if (!(faceR < inner)) throw new Error(g.box + 'px 下 face 半径 ' + faceR.toFixed(1) + ' 未小于环内缘 ' + inner.toFixed(1));
    });
    log('    62px: 环内缘 ' + (26 - 2.25).toFixed(2) + ' > face 22 · 54px: 环内缘 ' + (26 * 54 / 62 - 4.5 * 54 / 62 / 2).toFixed(2) + ' > face 19');
  });
  step('手机端留白：两侧 16px、卡片间距与底栏高度已放宽且同源', () => {
    const style = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
    // 注意：文件里有多个 max-width:899px 块，不要用「第一个块」去截取，按声明原文直查更可靠
    if (!/--tabbar-h:68px/.test(style)) throw new Error('--tabbar-h 未同步到 68px（底栏加高后仍未更新）');
    if (!/\.view\{padding:var\(--s4\) var\(--s4\) calc\(var\(--tabbar-h\) \+ 28px \+ env\(safe-area-inset-bottom\)\)\}/.test(style)) {
      throw new Error('移动端 .view 留白未调整');
    }
    if (!/\.card\{padding:18px;margin-bottom:var\(--s4\)\}/.test(style)) throw new Error('卡片留白未调整');
    if (!/padding:8px 6px calc\(8px \+ env\(safe-area-inset-bottom\)\)/.test(style)) throw new Error('底栏内边距未加高');
    if (!/\.appbar-inner\{padding:9px var\(--s4\)\}/.test(style)) throw new Error('顶栏两侧留白未调整');
  });
  step('子导航 sticky 偏移在移动端也走变量（此前移动覆盖写死 54px 把 1px 缝留了回来）', () => {
    const style = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
    if (/top:54px/.test(style) || /top:58px/.test(style)) throw new Error('仍存在写死的 subnav top 值');
    const tops = style.match(/\.subnav\{[^}]*top:var\(--appbar-h\)/g) || [];
    if (tops.length < 2) throw new Error('移动端覆盖未使用 --appbar-h，实际命中 ' + tops.length + ' 处');
  });
  step('统计概览卡在手机端为 2 列（原 4 列每格仅约 78px）', () => {
    const style = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
    if (/\.stat-grid\{grid-template-columns:repeat\(4,1fr\)/.test(style)) throw new Error('仍是 4 列');
    if (!/\.stat-grid\{grid-template-columns:1fr 1fr;gap:var\(--s3\)\}/.test(style)) throw new Error('未改为 2 列');
  });

  step('宽屏隐藏浮层的规则确实排在 .cw 基类之后', () => {
    const style = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
    const base = style.indexOf('.cw{\n  position:fixed');
    const hide = style.indexOf('@media (min-width:1240px){ .cw{display:none} }');
    if (base < 0) throw new Error('找不到 .cw 基类');
    if (hide < 0) throw new Error('找不到宽屏隐藏 .cw 的规则');
    if (hide < base) throw new Error('隐藏规则排在基类之前，宽屏会出现「右栏卡片 + 右下角气泡」重复');
    // 子导航偏移不得再写死（曾经移动端覆盖写死 54px，把 1px 缝留了回来）
    if (/top:5[0-9]px/.test(style)) throw new Error('仍有写死的 subnav top 值');
  });

  log('\n== 健壮性与可访问性（审计轮） ==');
  step('活动日志被修剪：不再随使用时长无限增长', () => {
    const now = Date.now();
    const entries = [];
    for (let i = 0; i < 5000; i++) entries.push({ at: now - i * 1000, kind: 'learn', word: 'x' });
    for (let i = 0; i < 100; i++) entries.push({ at: now - (200 + i) * 86400000, kind: 'learn', word: 'old' });
    const seed = { words: [], assessments: [], streak: 0, log: entries, settings: { theme: 'nocturno' }, time: {} };

    const d = newDom(seed, false);
    const dd = d.window.document;
    const before = JSON.parse(d.window.localStorage.getItem('es_mvp_v1')).log.length;
    if (before !== 5100) { log('    （预置失败：' + before + ' 条，跳过）'); d.window.close(); return; }
    dd.querySelector('#themeBtn').dispatchEvent(new d.window.MouseEvent('click', { bubbles: true }));
    const kept = (JSON.parse(d.window.localStorage.getItem('es_mvp_v1')).log || []);
    if (kept.length > 4000) throw new Error('未被条数上限修剪，仍有 ' + kept.length + ' 条');
    if (kept.some(e => now - e.at > 91 * 86400000)) throw new Error('仍保留超过 90 天的日志');
    log('    5100 条（含 100 条 200 天前）→ 写盘时修剪为 ' + kept.length + ' 条');
    d.window.close();
  });
  step('localStorage 写入失败时不抛未捕获异常（配额满 / Safari 无痕）', () => {
    const vc2 = new VirtualConsole();
    const seen = [];
    vc2.on('jsdomError', e => seen.push(String(e && e.message || e)));
    const d = new JSDOM(html, {
      runScripts: 'dangerously', url: 'http://localhost/', virtualConsole: vc2,
      pretendToBeVisual: true, beforeParse: preParse(null, false, { failWrites: true }),
    });
    const dd = d.window.document;
    // 先确认补丁真的打上了，否则这条用例等于没测
    let patched = false;
    try { d.window.localStorage.setItem('probe', '1'); } catch (e) { patched = true; }
    if (!patched) { log('    （jsdom 不允许替换 localStorage.setItem，跳过）'); d.window.close(); return; }
    if (!dd.querySelector('#subnav')) throw new Error('写入失败导致应用没挂载');
    dd.querySelector('#themeBtn').dispatchEvent(new d.window.MouseEvent('click', { bubbles: true }));
    if (!dd.querySelector('#cwBubble')) throw new Error('写失败后浮层消失');
    const bad = seen.filter(m => /quota|simulated/i.test(m));
    if (bad.length) throw new Error('仍抛出未捕获异常：' + bad[0].slice(0, 90));
    log('    setItem 全程抛错，应用仍完整挂载且无未捕获异常');
    d.window.close();
  });
  step('输入框焦点环在浅色主题下可见（不再用与底色同色的 --brand-bg）', () => {
    const style = (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
    const rule = (style.match(/\.input:focus\{[^}]*\}/) || [''])[0];
    if (!/color-mix\(in srgb, var\(--brand\) 42%, transparent\)/.test(rule)) {
      throw new Error('焦点环未改为品牌色半透明环：' + rule.slice(0, 120));
    }
    if (!/box-shadow:0 0 0 3px var\(--brand-bg\)/.test(rule)) {
      throw new Error('缺少不支持 color-mix 时的回退声明');
    }
    // 三个浅色主题的 --brand-bg 必须仍在（确认我们改的是环，而不是把主题令牌一起改掉）
    ['#FBE7E1', '#ECE9FF', '#FDEAE1'].forEach(c => {
      if (style.indexOf(c) < 0) throw new Error('主题令牌被误改，缺 ' + c);
    });
  });
  step('语音按钮有无障碍名（默写主操作 + 输入框旁小按钮）', () => {
    // 产物里中文被 esbuild 转义成 \uXXXX、引号被转义成 \"，所以只断言「该按钮上带 aria-label」
    const a = html.match(/id=\\?"tplay\\?"([^>]*)>/);
    if (!a) throw new Error('产物里找不到 #tplay');
    if (!/aria-label=/.test(a[1])) throw new Error('#tplay 缺 aria-label');
    const b = html.match(/id=\\?"tplay2\\?"([^>]*)>/);
    if (!b) throw new Error('产物里找不到 #tplay2');
    if (!/aria-label=/.test(b[1])) throw new Error('#tplay2 缺 aria-label');
  });

  log('\n== 运行期错误 ==');
  log(errs.length ? errs.join('\n') : '  （无）');
  if (errs.length) process.exitCode = 1;
  setTimeout(() => process.exit(process.exitCode || 0), 300);
}, 400);
