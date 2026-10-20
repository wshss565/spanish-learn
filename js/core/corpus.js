// 语料服务：对外提供句子查询（测评模块不再直接 import 阅读模块的 BOOK 数据，解耦）
import { BOOK, DEMO_WORDS } from '../data/content.js';
import { norm } from './util.js';

export function sentenceWith(word) {
  return BOOK.sentences.find(s => norm(s.es).includes(norm(word))) || null;
}

export function allSentences() { return BOOK.sentences; }

export function fallbackWords() { return DEMO_WORDS.map(w => ({ ...w })); }

export function glossaryOf(term) { return BOOK.glossary[term] || null; }
