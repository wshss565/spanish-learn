<h1 align="center">Hola Español · 西语学习网站</h1>

<p align="center">
纯前端离线 PWA ｜ 认词 → 记词 → 自测 → 默写 四步闭环 ｜ 无需注册、无后端、学习数据只存本机
</p>

<p align="center">
  <a href="https://wshss565.github.io/spanish-learn/"><b>🚀 在线体验 →</b></a>
  &nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="#-功能">功能</a>
  &nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="#-快速开始">本地运行</a>
  &nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="#-目录结构">目录</a>
  &nbsp;&nbsp;|&nbsp;&nbsp;
  <a href="#-词库现状与已知问题">数据现状</a>
</p>

---

## 🚀 在线体验

### **[→ 打开 Hola Español](https://wshss565.github.io/spanish-learn/)**

由 GitHub Pages 部署，打开即用，无需安装。支持「添加到主屏幕」当 App 用（PWA），断网也能继续学。

> 建议优先体验 **A1 / A2 / B1** 三本词书——它们的例句覆盖率在 97% 以上，学习闭环完整。
> C1 / C2 正在内容治理中，原因见[词库现状](#-词库现状与已知问题)。

---

## ✨ 功能

**学习闭环（4 步）**

| 步骤 | 说明 |
|---|---|
| ① 认词 | 自动发音、词性、释义、例句；例句中任意单词可点查 |
| ② 记词 | 主动拼写回忆 + FSRS 间隔重复排期 |
| ③ 自测 | 选择 / 填空 / 听写等题型混合出题 |
| ④ 默写 | 完形填空挖空 + 打字默写 |

**其他能力**

- **发音**：优先使用云端神经语音（Azure / ElevenLabs，可在设置里自填密钥），无密钥时用本地语音兜底
- **音标**：内置「正字法 → 国际音标」规则生成器，无需逐词标注也能显示音标
- **语法速练**：动词变位等语法专项练习
- **学习统计**：进度、正确率、连续天数
- **时间管控**：可设每日上限，到点提醒收手
- **4 套玻璃主题**：caliente / aurora / luz / nocturno，跟随系统或手动切换
- **离线优先**：Service Worker 缓存外壳，断网可用
- **进度可迁移**：设置里「导出备份 / 导入备份」JSON

**隐私**：没有账号、没有服务端、没有埋点。学习记录只存在浏览器的 localStorage（键名 `es_mvp_v1`），密钥也只存本机。

---

## 🛠 技术栈

- 纯原生 ES Modules，无框架、无打包器（源码直接跑）
- 构建时用 esbuild 产出**单文件版**（CSS/JS 全部内联）
- jsdom 做冒烟回归（128 项断言）
- Service Worker + Web App Manifest 做 PWA
- localStorage 做持久化，FSRS 算法做间隔重复

---

## 🚀 快速开始

### 直接用（无需构建）

仓库根目录就是可运行站点，用任意静态服务器托管即可：

```bash
# 任选其一，在仓库根目录执行
npx serve .
python -m http.server 8080
```

然后打开 `http://localhost:8080`。

> 用 `file://` 直接打开 `index.html` **不行**——项目使用 ES Modules，受浏览器同源策略限制。

### 构建单文件版

产出一个可单文件分发的 `standalone.html`，并同步到 `share/`：

```bash
node build-standalone.js
```

### 回归与静态检查

```bash
node smoke.js        # jsdom 冒烟回归，结果写入 smoke_result.txt
node css-lint.js     # 检查媒体查询里的声明是否被后续规则反超
node validate-books.mjs   # 校验各等级词书的重复与结构
node data-lint.mjs [等级]  # 生成该等级的待补例句工作单与质量报告
```

> Windows 下若 `node` 不在 PATH，可用托管版本：
> `C:\Users\15040\.workbuddy\binaries\node\versions\22.22.2-6\node.exe`
> （版本号会随环境升级变化，跑之前先确认路径是否存在）

---

## 📁 目录结构

```
.
├── index.html              # 源码版入口（多文件）
├── css/styles.css          # 全部样式，含 4 套主题变量
├── js/
│   ├── app.js              # 应用装配：路由、设置、模块注入
│   ├── modules/
│   │   ├── index.js        # 首页 / 词书库
│   │   └── learn.js        # 4 步学习闭环主逻辑
│   ├── core/
│   │   ├── store.js        # localStorage 持久化 + FSRS 排期
│   │   ├── speech.js       # 发音（云端 + 本地兜底）
│   │   ├── ipa.js          # 正字法 → 音标规则生成
│   │   ├── conj.js         # 动词变位表
│   │   ├── corpus.js       # 例句语料
│   │   ├── clock.js        # 学习计时
│   │   ├── bus.js          # 模块间事件总线
│   │   └── util.js
│   └── data/
│       ├── books.js        # 六级词库（唯一的词条数据源）
│       ├── content.js      # 文案与配置
│       └── words.js
├── sw.js                   # Service Worker
├── manifest.webmanifest
├── share/                  # 构建输出（单文件版 + PWA 资源）
└── *.mjs                   # 构建、校验、词库维护脚本
```

架构约定：模块之间**只通过 `bus` 通信，不得互相 import**；共享服务由 `app.js` 的 `ctxFor()` 注入。

---

## 📊 词库现状与已知问题

> 以下数字由 `validate-books.mjs` / `_cov_now.mjs` 实测得出，**不是目标值，是当前真实状态**。

| 等级 | 词条 | 有例句 | 例句覆盖率 | 释义异常 |
|---|---|---|---|---|
| A1 入门核心 | 750 | 733 | 97.7% | 0 |
| A2 日常进阶 | 916 | 894 | 97.6% | 0 |
| B1 独立表达 | 802 | 802 | 100.0% | 0 |
| B2 流畅论述 | 6,300 | 4,361 | 69.2% | 33 |
| C1 高级运用 | 7,051 | 159 | 2.3% | 18 |
| C2 母语级精微 | 17,433 | 12 | 0.1% | 33 |
| **合计** | **33,252** | **6,961** | **20.9%** | **84** |

### ⚠️ 已知问题（正在治理）

1. **C1 / C2 含大量非词条**。这两本的绝大部分词条由早期脚本用机器翻译批量灌入，
   其中包含英文词（`six`、`beacon`）、动词变位（`creará`、`anunciando`）、
   命令式+代词（`cuídalo`）和专名，并非都是可学习的西语词条。
   C2 手写的优质词条目前只有 12 条。
2. **分级口径是词频段，不是 CEFR 等级**。B2/C1/C2 对应的是词频排名区间
   （B2 ≈ 3801–14000，C1 ≈ 14001–26000，C2 ≈ 26001–50000），
   所以"C2"实际含义是"极低频词"，与母语级精微的定位并不完全吻合。
3. **无例句的词会让完形填空退化**。系统对这类词会用 `<词> es una palabra.` 兜底，
   题目信息量为零。因此 C1/C2 的自测环节目前体验较差。
4. **84 条释义存在乱码或非中文残留**，正在逐条修复。

治理路线见 [`docs/wrap-up-plan.md`](docs/wrap-up-plan.md)（收尾方案）与
[`docs/quality-review.md`](docs/quality-review.md)（第四轮质量体检）。

---

## 📜 说明

- 本项目为个人学习工具，词库内容仅供学习使用。
- 欢迎提 Issue 指出释义错误、错别字或内容质量问题，这对内容治理帮助很大。
