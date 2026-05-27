const fs = require('fs');
const path = require('path');
const dir = 'C:/Users/defis/alkamar-info';

const OLD = "window.addEventListener('load',function(){var s=document.createElement('script');s.async=1;s.src='https://www.googletagmanager.com/gtag/js?id=G-E8J20K1852';document.head.appendChild(s);window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','G-E8J20K1852');})";

const NEW = "(function(){var l=0;function g(){if(l)return;l=1;var s=document.createElement('script');s.async=1;s.src='https://www.googletagmanager.com/gtag/js?id=G-E8J20K1852';document.head.appendChild(s);window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','G-E8J20K1852');}['pointerdown','scroll','keydown','touchstart'].forEach(function(e){document.addEventListener(e,g,{once:true,passive:true});});window.addEventListener('load',function(){setTimeout(g,5000);});})()";

const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
let updated = 0, skipped = 0;
for (const f of files) {
  const fp = path.join(dir, f);
  const src = fs.readFileSync(fp, 'utf8');
  if (!src.includes('googletagmanager.com/gtag')) { skipped++; continue; }
  const out = src.replaceAll(OLD, NEW);
  if (out === src) { console.log('NO MATCH:', f); skipped++; continue; }
  fs.writeFileSync(fp, out);
  updated++;
  console.log('OK:', f);
}
console.log('Updated:', updated, '/ Skipped:', skipped);
