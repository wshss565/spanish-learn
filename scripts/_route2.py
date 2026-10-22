# -*- coding: utf-8 -*-
# Route 2: 用真实翻译 API (MyMemory es->zh-CN) 批量灌入西语词书
# - 选词依据 es_50k.txt（按词频排序），按频段分配到 A1..C2
# - 与现有 books.js 去重（保留手写的 882 条精校词条）
# - 翻译结果缓存到 _trans_cache.json，断点可续
import re, json, time, urllib.request, urllib.parse, urllib.error, concurrent.futures, threading

ROOT = 'js/data'
BOOKS = ROOT + '/books.js'
FREQ = '../_freq/es_50k.txt'
CACHE = '_trans_cache.json'
API = 'https://api.mymemory.translated.net/get?q={q}&langpair=es%7Czh-CN'

TARGET_NEW = 8000          # 本轮新增目标（仅 B2/C1/C2 三本；日额度受限时优雅停，次日续）
WORKERS = 16
SLEEP = 0.02

# 频段 -> CEFR 等级：仅针对 B2/C1/C2 扩容（A1/A2/B1 已精校填满，不再占用每日翻译额度）
# 频段整体向词频更深处拓展，确保每本可达“数千词”量级
# B2 进一步拓宽（3801–14000）以冲到 2k+；C1/C2 相应顺延
# 2026-09-16 调整：C2 提到最前优先攻坚（原 b2→c1→c2 顺序导致 C2 永远排末位、且 MyMemory 对
# rank>26000 生僻词几乎无 es→zh 译文而大批 skipped）。现 C2 频段挖深到 50k 以更多候选抵消高跳过率；
# C1 已破 8k 达标降为次优先收尾；B2 已满仅兜底。翻译源升级(DeepL/Azure)待用户给 key 再接。
BANDS = [
    (26001, 50000, 'c2'),
    (14001, 26000, 'c1'),
    (3801, 14000, 'b2'),
]

cache_lock = threading.Lock()
cache = {}
if __import__('os').path.exists(CACHE):
    try:
        cache = json.load(open(CACHE, encoding='utf-8'))
        print('loaded cache:', len(cache))
    except Exception:
        cache = {}

def clean_word(w):
    w = w.strip().lower()
    if not re.fullmatch(r'[a-záéíóúñü]+', w):
        return None
    if len(w) < 2 or len(w) > 18:
        return None
    return w

def fetch(w):
    if w in cache:
        return cache[w]
    try:
        url = API.format(q=urllib.parse.quote(w))
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        raw = urllib.request.urlopen(req, timeout=25).read().decode('utf-8', 'ignore')
        obj = json.loads(raw)
        if obj.get('quotaFinished'):
            return '__QUOTA__'
        t = obj.get('responseData', {}).get('translatedText', '')
        return t
    except urllib.error.HTTPError as e:
        if e.code == 429:
            # MyMemory 日额度耗尽：返回 429 时立即作为 quota 信号，让主循环提前取消
            return '__QUOTA__'
        return '__ERR__'      # 非 429 的 HTTP 错误：标记瞬时错误，不缓存、下次重试
    except Exception:
        return '__ERR__'

def sanitize(t, src):
    if not t or t == src:
        return None
    # 取第一个中文释义（去掉备选/解释性内容）
    for sep in ['；', ';', '，', ',', '（', '(']:
        if sep in t:
            t = t.split(sep)[0]
    t = t.strip()
    if not t:
        return None
    if len(t) > 12:           # 过长通常是短语/误译，丢弃
        return None
    if re.search(r'[a-zA-Z]', t):  # 仍含拉丁字母，基本是未译出
        return None
    return t

# 解析词频表（按行即排名）
ranked = []
with open(FREQ, encoding='utf-8') as f:
    for line in f:
        parts = line.split()
        if not parts:
            continue
        w = clean_word(parts[0])
        if w:
            ranked.append(w)
print('ranked candidate words:', len(ranked))

src = open(BOOKS, encoding='utf-8').read()
existing = set(re.findall(r"es:\s*'([^']*)'", src))
print('existing in books:', len(existing))

# 选目标词：按排名分配等级，跳过已存在/已缓存，取前 TARGET_NEW 个新词
plan = {}          # book_id -> list of words
for rank, w in enumerate(ranked, 1):
    if sum(len(v) for v in plan.values()) >= TARGET_NEW:
        break
    if w in existing or w in cache:
        continue
    lvl = None
    for lo, hi, b in BANDS:
        if lo <= rank <= hi:
            lvl = b
            break
    if not lvl:
        continue
    plan.setdefault(lvl, []).append(w)

# 关键修复（2026-09-17）：翻译/注入顺序必须按 BANDS 优先级（前=先），
# 而不是词频 rank 顺序。否则 C2(高频更靠后) 每轮都落在额度窗口之外、永远填不上。
order = []
for lo, hi, b in BANDS:
    order.extend(plan.get(b, []))
print('new words to translate:', len(order))
for b in ['a1','a2','b1','b2','c1','c2']:
    print('   ', b, len(plan.get(b, [])))

def worker(w):
    t = fetch(w)
    if t == '__QUOTA__':
        return (w, '__QUOTA__')
    if t == '__ERR__':
        return (w, '__ERR__')
    z = sanitize(t, w)
    return (w, z)

quota_hit = False
done = 0
with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as ex:
    futs = [ex.submit(worker, w) for w in order]
    for fut in concurrent.futures.as_completed(futs):
        w, res = fut.result()
        with cache_lock:
            if res == '__QUOTA__':
                quota_hit = True
            elif res == '__ERR__':
                pass  # 网络瞬时错误：不缓存，下次运行重试
            elif res:
                cache[w] = res        # 有效译文
            else:
                cache[w] = ''         # 已知无效译文（MyMemory 未译出/误译）：缓存空值，避免每日重复浪费额度
            done += 1
            if done % 100 == 0:
                json.dump(cache, open(CACHE, 'w', encoding='utf-8'), ensure_ascii=False)
                print(f'  progress {done}/{len(order)} cached={len(cache)}')
        if quota_hit:
            # MyMemory 日额度耗尽：取消剩余任务，优雅退出
            for f in futs:
                f.cancel()
            print('  QUOTA hit — cancelling remaining, will resume next run via cache')
            break

json.dump(cache, open(CACHE, 'w', encoding='utf-8'), ensure_ascii=False)
print('quota_hit:', quota_hit, 'cache size:', len(cache))

# 按等级汇总可注入的词条
to_inject = {b: [] for b in ['a1','a2','b1','b2','c1','c2']}
added_total = 0
skipped_bad = 0
for b in to_inject:
    for w in plan.get(b, []):
        z = cache.get(w)
        if z:
            to_inject[b].append((w, z))
            added_total += 1
        else:
            skipped_bad += 1
print('will inject:', added_total, 'skipped(no good translation):', skipped_bad)

# 安全变位检测：仅匹配极不可能是名词的动词词尾（避免误标名词）
CONJ = re.compile(r'(mos|ste|stes|ron|aba$|abas$|aban$|abamos$|r[íi]a|r[íi]as|r[íi]an|ando$|iendo$|ado$|ido$|aste|asteis|aron|erais|éis|án|ás|rá$|rás|ré$|rés$)')
def pos_for(w):
    if CONJ.search(w):
        return 'v'
    if len(w) > 2 and w.endswith(('ar', 'er', 'ir')):
        return 'v'
    if w.endswith(('ción', 'sión', 'dad', 'tad', 'aje', 'mento', 'nza', 'ía', 'ez', 'umbre', 'sis', 'itis')):
        return 'n'
    if w.endswith('mente'):
        return 'adv'
    if w.endswith(('oso', 'osa', 'able', 'ible', 'al', 'ívo', 'iva', 'án', 'ada', 'ido', 'udo', 'ente')):
        return 'adj'
    return 'n'

def to_js(es, zh):
    es = es.replace("\\", "\\\\").replace("'", "\\'")
    zh = zh.replace("\\", "\\\\").replace("'", "\\'")
    p = pos_for(es)
    return "      { es: '%s', zh: '%s', pos: '%s' }," % (es, zh, p)

def book_region(src, book_id):
    m = re.search(r"id:\s*'" + re.escape(book_id) + r"',", src)
    start = m.end()
    nxt = src.find("\n  {\n    id: '", start)
    if nxt == -1:
        nxt = len(src)
    return start, nxt

def inject_book(src, book_id, entries):
    if not entries:
        return src, 0
    start, nxt = book_region(src, book_id)
    region = src[start:nxt]
    ci = region.rfind('    ],')
    if ci == -1:
        ci = region.rfind('],')
    insert_at = start + ci          # 插在 ']' 之前（数组内，避免错位）
    block = "\n" + "\n".join(to_js(e, z) for e, z in entries)
    return src[:insert_at] + block + src[insert_at:], len(entries)

for b in ['a1','a2','b1','b2','c1','c2']:
    src, n = inject_book(src, b, to_inject[b])
    print('  injected into', b, '=', n)

open(BOOKS, 'w', encoding='utf-8').write(src)
after = len(re.findall(r"es:\s*'", src))
print('TOTAL book words after:', after)
