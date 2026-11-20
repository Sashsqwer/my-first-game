#!/usr/bin/env node
/* Проверка в браузере (Playwright, iPhone 13): скриншоты в docs/screens/, ошибки console, горизонтальный скролл.
   Запуск: node tools/screens.js */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium, devices } = require('playwright');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'screens');
const URL = 'file://' + path.join(ROOT, 'app', 'index.html');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const problems = [];
  async function newPage(device) {
    const ctx = await browser.newContext({ ...device });
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') problems.push(`[${m.type()}] ${m.text()}`); });
    page.on('pageerror', e => problems.push('[pageerror] ' + e.message));
    await page.goto(URL);
    await page.waitForTimeout(400);
    return { ctx, page };
  }
  async function noHScroll(page, label) {
    const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    if (w.sw > w.cw) problems.push(`[layout] горизонтальный скролл на «${label}»: ${w.sw} > ${w.cw}`);
  }
  async function center(page, sel) {
    const b = await page.locator(sel).boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }
  async function dragCell(page, from, to) {
    const a = await center(page, `.cell[data-i="${from}"]`), b = await center(page, `.cell[data-i="${to}"]`);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x + 10, a.y + 6, { steps: 3 });
    await page.mouse.move(b.x, b.y, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(150);
  }
  const grid = page => page.evaluate(() => window.__game.state.businesses[0].grid.slice());

  const iphone = devices['iPhone 13'];
  const { ctx, page } = await newPage(iphone);

  // 1. Выбор бизнеса
  await page.screenshot({ path: path.join(OUT, '1-choose.png') });
  await noHScroll(page, 'выбор бизнеса');

  // 2. Обучение + найм + слияние
  await page.click('.biz:nth-child(2) .btn'); // IT-стартап
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, '2-tutorial.png') });
  await page.click('#btn-hire'); await page.waitForTimeout(200);
  await page.click('#btn-hire'); await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, '3-tutorial-drag.png') });
  await dragCell(page, 1, 0);
  let g = await grid(page);
  if (g[0] !== 2 || g[1] !== 0) problems.push('[logic] слияние 1+1 не сработало: ' + g.join(''));
  await page.waitForTimeout(300);
  await page.click('.modal .btn'); // «Круто!» — новый сотрудник
  // накинем денег и наймём ещё, соберём пару слияний
  await page.evaluate(() => { window.__game.state.businesses[0].money += 900; });
  for (let i = 0; i < 6; i++) { await page.click('#btn-hire'); await page.waitForTimeout(80); }
  g = await grid(page);
  const ones = g.map((v, i) => v === 1 ? i : -1).filter(i => i >= 0);
  await dragCell(page, ones[0], ones[1]);
  await dragCell(page, ones[2], ones[3]);
  for (let k = 0; k < 4; k++) { if (await page.locator('.modal:not([hidden]) .btn').count()) await page.click('.modal .btn'); await page.waitForTimeout(150); }
  g = await grid(page);
  const twos = g.map((v, i) => v === 2 ? i : -1).filter(i => i >= 0);
  if (twos.length >= 2) await dragCell(page, twos[0], twos[1]);
  await page.waitForTimeout(200);
  for (let k = 0; k < 3; k++) { if (await page.locator('.modal:not([hidden]) .btn').count()) await page.click('.modal .btn'); await page.waitForTimeout(150); }
  // перемещение на пустую клетку и тап
  g = await grid(page);
  const empty = g.indexOf(0), any = g.findIndex(v => v > 0);
  await dragCell(page, any, empty);
  g = await grid(page);
  const top = g.indexOf(Math.max(...g));
  await page.click(`.cell[data-i="${top}"]`);
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, '4-office.png') });
  await noHScroll(page, 'офис');

  // 3. Улучшения
  await page.evaluate(() => { window.__game.state.businesses[0].money += 400; });
  await page.click('.tab[data-view="upgrades"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, '5-upgrades.png') });
  await noHScroll(page, 'улучшения');
  for (const v of ['rating', 'friends', 'shop']) { await page.click(`.tab[data-view="${v}"]`); await page.waitForTimeout(100); await noHScroll(page, v); }
  await page.click('.tab[data-view="friends"]');
  await page.screenshot({ path: path.join(OUT, '7-friends.png') });
  await page.click('.tab[data-view="office"]');

  // 4. Бонус дня
  await page.click('#btn-daily'); await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, '8-daily.png') });
  await page.click('.modal [data-claim]'); await page.waitForTimeout(200);

  // 5. Офлайн-доход: сдвигаем время сохранения на 3 часа назад и перезагружаем
  await page.evaluate(() => {
    window.__game.save(true);
    const key = 'startup_zero_save_v1';
    const s = JSON.parse(localStorage.getItem(key));
    s.savedAt = Date.now() - 3 * 3600 * 1000;
    localStorage.setItem(key, JSON.stringify(s));
  });
  // чтобы автосохранение не перезаписало подменённое время до перезагрузки
  await page.evaluate(() => { window.__game.save = () => {}; Storage.prototype.setItem = () => {}; });
  await page.reload();
  await page.waitForTimeout(700);
  const offTxt = await page.locator('.modal .amount').textContent().catch(() => '');
  if (!offTxt) problems.push('[logic] окно офлайн-дохода не появилось');
  await page.screenshot({ path: path.join(OUT, '6-offline.png') });
  await page.click('.modal .btn');

  // 6. Настройки → сброс
  await page.click('#btn-settings'); await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, '9-settings.png') });
  await ctx.close();

  // 7. Узкий и широкий экраны: нет горизонтального скролла
  for (const w of [320, 430]) {
    const { ctx: c2, page: p2 } = await newPage({ viewport: { width: w, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await noHScroll(p2, `выбор ${w}px`);
    await p2.click('.biz:nth-child(1) .btn');
    await p2.waitForTimeout(300);
    await p2.evaluate(() => { const b = window.__game.state.businesses[0]; b.room = 2; b.grid = [1,2,3,4,5,6,7,8,1,2,3,4,5,6,7,0,0,0,0,0]; b.seen = 8; window.__game.state.tutorial = 3; window.__game.rebuild(); });
    await p2.click('.tab[data-view="upgrades"]'); await p2.click('.tab[data-view="office"]');
    await noHScroll(p2, `офис ${w}px`);
    if (w === 320) await p2.screenshot({ path: path.join(OUT, '10-narrow-320.png') });
    await c2.close();
  }

  await browser.close();
  const real = problems.filter(p => !/telegram\.org/.test(p));
  console.log(real.length ? 'ПРОБЛЕМЫ:\n' + real.join('\n') : 'OK: ошибок console нет, горизонтального скролла нет');
  if (problems.length !== real.length) console.log('(пропущено сетевых сообщений telegram.org: ' + (problems.length - real.length) + ')');
  process.exit(real.length ? 1 : 0);
})();
