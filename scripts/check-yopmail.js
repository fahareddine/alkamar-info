const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto('https://yopmail.com/en/', { waitUntil: 'networkidle', timeout: 30000 });
  await p.screenshot({ path: 'scripts/yopmail-ui.png', fullPage: true });
  // Log tous les inputs et boutons
  const inputs = await p.$$eval('input', els => els.map(e => ({ id: e.id, name: e.name, class: e.className, type: e.type })));
  const btns = await p.$$eval('button,a.button,[type=submit]', els => els.map(e => ({ tag: e.tagName, id: e.id, class: e.className.substring(0,50), text: e.textContent.trim().substring(0,30) })));
  console.log('INPUTS:', JSON.stringify(inputs));
  console.log('BUTTONS:', JSON.stringify(btns));
  await b.close();
})();
