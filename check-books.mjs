import fs from 'fs';
try {
  const m = await import('./js/data/books.js');
  fs.writeFileSync('_checkbooks.txt', 'OK 词书数=' + m.WORD_BOOKS.length + '\n', 'utf8');
} catch (e) {
  fs.writeFileSync('_checkbooks.txt', 'ERR:\n' + String(e && (e.stack || e.message || e)) + '\n', 'utf8');
}
