import fs from 'fs';
const src = fs.readFileSync('js/data/books.js', 'utf8');
const marks = []; const re = /level:\s*'([A-Z][0-9])'/g; let m;
while ((m = re.exec(src))) marks.push({ lv: m[1], at: m.index });
const TRAD = /[圖烏語乾較這們現實運氣鐘嬰兒親頁與島舊書寫讀買賣錢銀髮臉頰醫藥農場櫃檯聽藥錢鐵馬鳥龍貓貝見認識讓說話誰課試記護響題顏願顯風飛館嗎麼幾張強彈從態懷惡慣戰戶執掃損搖擺敵數斷於時曆會東極檢歡歲決沒淨準溫濕牆獎環產畫當療監盤眾確礙禮種積穩窮競爭節範築簡籃紀紙級純線練縮總織繪續網緊維緣編緩縣績聲職聯腦興舉舊藍藝處號蟲補裝規視覺觀計訂討訓訪設許評詞詩該詳誠調談論講謝證議豐負財責貴費資購賽贏趕踐軍軟輕輛輝輩輪輸轉過達違遠適選遺郵鄉釋針鋼錄鋪鏈鏡長門閉問間隊階隨險隱難隻電靜頂項順預類顧]/;
const per = {};
for (const x of marks) {
  const end = marks.find(y => y.at > x.at)?.at ?? src.length;
  const seg = src.slice(x.at, end);
  const reE = /\{\s*es:\s*'((?:[^'\\]|\\.)*)'([^}]*)\}/g; let mm;
  while ((mm = reE.exec(seg))) {
    const zh = (mm[2].match(/\bzh:\s*'((?:[^'\\]|\\.)*)'/) || [])[1] || '';
    for (const ch of zh) if (TRAD.test(ch)) (per[x.lv] ||= new Set()).add(ch);
  }
}
const out = Object.entries(per).map(([lv, s]) => lv + ' 繁体字 ' + s.size + ' 个：' + [...s].join(''));
fs.writeFileSync('_tradscan.txt', out.join('\n') + '\n', 'utf8');
