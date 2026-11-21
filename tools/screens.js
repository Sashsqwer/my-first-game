#!/usr/bin/env node
/* Проверка в браузере (Playwright, iPhone 13): скриншоты в docs/screens/, ошибки console, горизонтальный скролл.
   Запуск: node tools/screens.js
   Если app/net.js ещё нет — ошибка его загрузки не считается проблемой (игра работает без сервера). */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium, devices } = require('playwright');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'screens');
const URL = 'file://' + path.join(ROOT, 'app', 'index.html');
const HAS_NET = fs.existsSync(path.join(ROOT, 'app', 'net.js'));
const KEY = 'startup_zero_save_v1';
fs.mkdirSync(OUT, { recursive: true });

// Подставной сервер для проверки вкладок «Друзья» и «Рейтинг»
const MOCK_NET = `Object.defineProperty(window, 'GameNet', { configurable: true, set() {}, get() { return window.__mockNet; } });
window.__mockNet = {
  ready: () => true, user: () => ({ id: 1, name: 'Саша' }), invite: () => { window.__invited = (window.__invited || 0) + 1; },
  friends: () => new Promise(r => setTimeout(() => r({ invited: 4, list: [
    { name: 'Маша', business: 'coffee', level: 6, income: 820 }, { name: 'Дима', business: 'auto', level: 4, income: 95 },
    { name: 'Олег', business: 'gamedev', level: 3, income: 31 }, { name: 'Катя', business: 'fitness', level: 5, income: 240 }],
    rewards: [{ need: 1, title: '💰 Деньги на развитие', claimed: true, ready: false }, { need: 3, title: 'Редкий сотрудник', claimed: false, ready: true },
      { need: 5, title: '📄 Пачка резюме', claimed: false, ready: false }, { need: 10, title: 'Эпический сотрудник', claimed: false, ready: false },
      { need: 25, title: 'Легендарный сотрудник', claimed: false, ready: false }] }), 300)),
  claimFriendReward: need => Promise.resolve({ ok: true, reward: { type: 'rare', rarity: 'rare' } }),
  leaderboard: scope => window.__netFail ? Promise.reject(new Error('offline')) : Promise.resolve([
    { place: 1, name: 'Маша', value: 18400000 }, { place: 2, name: 'Саша', value: 2350000, me: true }, { place: 3, name: 'Катя', value: 940000 }, { place: 4, name: 'Дима', value: 120000 }]),
  sync: s => { window.__synced = s; return Promise.resolve(); },
  onReferralBonus: cb => { window.__refCb = cb; }
};`;

(async () => {
  const browser = await chromium.launch();
  const problems = [];
  async function newPage(device, opts = {}) {
    const ctx = await browser.newContext({ ...device });
    const page = await ctx.newPage();
    page.on('console', m => {
      if (m.type() !== 'error' && m.type() !== 'warning') return;
      if (!HAS_NET && /ERR_FILE_NOT_FOUND|net\.js/.test(m.text() + JSON.stringify(m.location()))) return;
      problems.push(`[${m.type()}] ${m.text()}`);
    });
    page.on('pageerror', e => problems.push('[pageerror] ' + e.message));
    if (opts.init) await page.addInitScript(opts.init);
    if (opts.mock) await page.addInitScript(MOCK_NET);
    await page.goto(URL);
    await page.waitForTimeout(400);
    return { ctx, page };
  }
  async function noHScroll(page, label) {
    const w = await page.evaluate(() => {
      let worst = null;
      document.querySelectorAll('.view.active *, .modal *, .choose *').forEach(n => {
        const r = n.getBoundingClientRect();
        if (r.width && r.right > window.innerWidth + 1 && !n.closest('.ladder')) worst = worst || (n.className || n.tagName) + ' → ' + Math.round(r.right);
      });
      return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, worst };
    });
    if (w.sw > w.cw) problems.push(`[layout] горизонтальный скролл на «${label}»: ${w.sw} > ${w.cw}`);
    if (w.worst) problems.push(`[layout] вылезает за экран на «${label}»: ${w.worst}`);
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
  async function closeModals(page, n = 4) {
    for (let k = 0; k < n; k++) {
      const btn = page.locator('.modal:not([hidden]) .btns .btn').first();
      if (!(await btn.count())) break;
      await page.waitForTimeout(150);
      await btn.click(); await page.waitForTimeout(250);
    }
  }
  const grid = page => page.evaluate(() => window.__game.state.businesses[0].grid.slice());
  const shot = (page, name) => page.screenshot({ path: path.join(OUT, name) });

  const iphone = devices['iPhone 13'];
  const { ctx, page } = await newPage(iphone);

  // 1. Выбор бизнеса — 8 плиток
  const tiles = await page.locator('.biz').count();
  if (tiles !== 8) problems.push('[logic] бизнесов на выборе: ' + tiles + ' (ждём 8)');
  await shot(page, '01-choose.png');
  await noHScroll(page, 'выбор бизнеса');
  await page.click('.biz[data-type="burger"]'); await page.waitForTimeout(400);
  await shot(page, '02-choose-details.png');
  await page.click('.modal [data-close]'); await page.waitForTimeout(200);

  // 2. Обучение + найм + слияние (IT-стартап)
  await page.click('.biz[data-type="it"]'); await page.waitForTimeout(300);
  await page.click('.modal [data-start]'); await page.waitForTimeout(500);
  await shot(page, '03-tutorial.png');
  await page.click('#btn-hire'); await page.waitForTimeout(200);
  await page.click('#btn-hire'); await page.waitForTimeout(400);
  await shot(page, '04-tutorial-drag.png');
  await dragCell(page, 1, 0);
  let g = await grid(page);
  if (g[0] % 10 !== 2 || g[1] !== 0) problems.push('[logic] слияние 1+1 не сработало: ' + g.join(','));
  await page.waitForTimeout(300);
  await closeModals(page);
  // проверка правила редкости: обычный 2 + редкий 2 → редкий 3
  const rr = await page.evaluate(() => { const B = window.BALANCE; return [B.mergeResult(2, 12, 0.99).v, B.mergeResult(21, 31, 0).v, B.canMerge(3, 13), B.canMerge(3, 4), B.canMerge(8, 8)]; });
  if (rr[0] !== 13 || rr[1] !== 32 || !rr[2] || rr[3] || rr[4]) problems.push('[logic] правило слияния редкостей: ' + rr.join(','));

  // 3. Офис с потребностями и редкими: подставляем «живую» сетку
  await page.evaluate(() => {
    const s = window.__game.state, b = s.businesses[0], now = Date.now();
    b.grid = [25, 4, 13, 3, 12, 2, 2, 31, 1, 1, 0, 0];
    b.seen = 5; b.money = 8400; b.hires = 30;
    b.needs = [now - 4.6 * 3600e3, now - 1.2 * 3600e3, now - 5.4 * 3600e3]; // кофе и отдых просели
    s.net.invited = 1;
    window.__game.rebuild();
  });
  await page.waitForTimeout(500);
  await shot(page, '05-office.png');
  await noHScroll(page, 'офис');
  const rate1 = await page.locator('#rate').textContent();
  if (!/−\d+%/.test(rate1)) problems.push('[logic] штраф за усталость не виден в доходе: ' + rate1);
  await page.click('.need[data-need="0"]'); await page.waitForTimeout(300);
  await page.click('.need[data-need="2"]'); await page.waitForTimeout(300);
  const lv = await page.evaluate(() => { const B = window.BALANCE, b = window.__game.state.businesses[0]; return B.needsFactor(b, Date.now()); });
  if (lv < 1) problems.push('[logic] забота не вернула доход: ' + lv);
  // слияние разных редкостей в интерфейсе: 2 (обычный) на 12 (редкий)
  g = await grid(page);
  await dragCell(page, g.indexOf(2), g.indexOf(12));
  g = await grid(page);
  if (!g.includes(13) || g.filter(v => v === 13).length < 2) problems.push('[logic] обычный 2 + редкий 2 должен дать редкого 3: ' + g.join(','));
  await closeModals(page);
  // аврал
  await page.click('#btn-rush'); await page.waitForTimeout(300);
  const rushTxt = await page.locator('#btn-rush').textContent();
  if (!/\d:\d\d/.test(rushTxt)) problems.push('[logic] аврал не включился: ' + rushTxt);
  await page.click('.cell[data-i="0"]'); await page.waitForTimeout(300);
  await shot(page, '06-office-rush.png');

  // 4. Агентство + открытие пачки
  await page.click('.tab[data-view="shop"]'); await page.waitForTimeout(300);
  await shot(page, '07-agency.png');
  await noHScroll(page, 'агентство');
  await page.locator('.pack.p-star').scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  await shot(page, '08-agency-paid.png');
  await page.click('[data-pack="premium"]'); await page.waitForTimeout(200); // «скоро — за ⭐» — только подсказка
  if (await page.locator('.modal:not([hidden])').count()) problems.push('[logic] платная пачка открылась без оплаты');
  await page.click('[data-pack="free"]'); await page.waitForTimeout(350);
  await shot(page, '09-pack-opening.png');
  await page.waitForTimeout(1600);
  await shot(page, '10-pack-open.png');
  await noHScroll(page, 'открытие пачки');
  await page.click('.modal [data-take]'); await page.waitForTimeout(300);
  const freeAt = await page.evaluate(() => window.__game.state.agency.freeAt - Date.now());
  if (freeAt < 7.9 * 3600e3) problems.push('[logic] таймер бесплатной пачки не встал на 8 ч');
  // осколки → редкий
  await page.evaluate(() => { window.__game.state.agency.shards = 5; window.__game.setView('shop'); });
  await page.click('[data-shards]'); await page.waitForTimeout(2000);
  await page.click('.modal [data-take]'); await page.waitForTimeout(200);
  await page.evaluate(() => { window.__game.state.businesses[0].money += 5e5; });
  for (const v of ['upgrades', 'rating', 'friends']) { await page.click(`.tab[data-view="${v}"]`); await page.waitForTimeout(150); await noHScroll(page, v); }
  await page.click('.tab[data-view="upgrades"]'); await page.waitForTimeout(200);
  await shot(page, '11-upgrades.png');
  await page.click('.tab[data-view="friends"]'); await page.waitForTimeout(200);
  await shot(page, '12-friends.png');
  await page.click('.tab[data-view="rating"]'); await page.waitForTimeout(200);
  await shot(page, '13-rating.png');
  await page.click('.tab[data-view="office"]');

  // 5. Календарь и задания
  await page.click('#btn-daily'); await page.waitForTimeout(400);
  await shot(page, '14-calendar.png');
  await noHScroll(page, 'календарь');
  await page.click('.modal [data-claim]'); await page.waitForTimeout(300);
  await page.evaluate(() => { const q = window.__game.state.quests; q.list[0].have = q.list[0].need; });
  await page.click('#btn-quests'); await page.waitForTimeout(400);
  await shot(page, '15-quests.png');
  await noHScroll(page, 'задания');
  await page.click('.modal [data-q="0"]'); await page.waitForTimeout(300);
  await closeModals(page);

  // 6. Офлайн-доход: сдвигаем время сохранения на 7 часов назад (и потребности падают)
  await page.evaluate(k => {
    window.__game.save(true);
    const s = JSON.parse(localStorage.getItem(k));
    const shift = 7 * 3600 * 1000;
    s.savedAt -= shift; s.businesses[0].needs = s.businesses[0].needs.map(t => t - shift); s.rush = { until: 0, readyAt: 0 };
    localStorage.setItem(k, JSON.stringify(s));
  }, KEY);
  await page.evaluate(() => { window.__game.save = () => {}; Storage.prototype.setItem = () => {}; });
  await page.reload();
  await page.waitForTimeout(700);
  const offTxt = await page.locator('.modal .amount').textContent().catch(() => '');
  if (!offTxt) problems.push('[logic] окно офлайн-дохода не появилось');
  await shot(page, '16-offline.png');
  await page.click('.modal [data-take]');
  await page.click('#btn-settings'); await page.waitForTimeout(300);
  await shot(page, '17-settings.png');
  await ctx.close();

  // 7. Старое сохранение (этап 1) — миграция
  {
    const v1 = { v: 1, savedAt: Date.now() - 120e3, createdAt: Date.now() - 864e5, active: 0, tutorial: 3, daily: { last: null, streak: 0 },
      businesses: [{ type: 'barber', money: 5000, earned: 90000, room: 1, hires: 60, merges: 50, grid: [5, 4, 3, 3, 2, 1, 0, 0, 0, 0, 0, 0], upgrades: { boost: 3, chairs: 1, pr: 2 }, seen: 5 }] };
    const { ctx: c3, page: p3 } = await newPage(iphone, { init: `try { if (!sessionStorage.getItem('m')) { sessionStorage.setItem('m', 1); localStorage.setItem('${KEY}', ${JSON.stringify(JSON.stringify(v1))}); } } catch (e) {}` });
    const st = await p3.evaluate(() => { const s = window.__game.state; return { v: s.v, len: s.businesses[0].grid.length, g0: s.businesses[0].grid[0], needs: s.businesses[0].needs.length, ag: !!s.agency }; });
    if (st.v !== 2 || st.len !== 16 || st.g0 !== 5 || st.needs !== 3 || !st.ag) problems.push('[logic] миграция v1 → v2: ' + JSON.stringify(st));
    await c3.close();
  }

  // 8. С подставным сервером: друзья, рейтинг, ошибка «нет связи», приветственный бонус
  {
    const { ctx: c4, page: p4 } = await newPage(iphone, { mock: true });
    await p4.click('.biz[data-type="coffee"]'); await p4.waitForTimeout(250);
    await p4.click('.modal [data-start]'); await p4.waitForTimeout(300);
    await p4.evaluate(() => { const s = window.__game.state; s.tutorial = 3; s.businesses[0].grid = [3, 2, 12, 1, 0, 0, 0, 0, 0, 0, 0, 0]; window.__game.rebuild(); });
    await p4.click('.tab[data-view="friends"]'); await p4.waitForTimeout(100);
    if (!(await p4.locator('.loading').count())) problems.push('[logic] нет «загрузки» у друзей');
    await p4.waitForTimeout(500);
    await shot(p4, '18-friends-server.png');
    await noHScroll(p4, 'друзья (сервер)');
    await p4.click('[data-claim-f="3"]'); await p4.waitForTimeout(2200);
    await p4.click('.modal [data-take]'); await p4.waitForTimeout(500);
    const claimed = await p4.evaluate(() => window.__game.state.net.claimed);
    if (!claimed.includes(3)) problems.push('[logic] награда за 3 друзей не записалась');
    await p4.click('.tab[data-view="rating"]'); await p4.waitForTimeout(300);
    await shot(p4, '19-rating-server.png');
    await p4.evaluate(() => { window.__netFail = true; });
    await p4.click('[data-scope="week"]'); await p4.waitForTimeout(300);
    if (!(await p4.locator('.error-box').count())) problems.push('[logic] нет ошибки «нет связи» в рейтинге');
    await p4.evaluate(() => window.__refCb && window.__refCb({}));
    await p4.waitForTimeout(400);
    if (!(await p4.locator('.modal:not([hidden]) .pack-open').count())) problems.push('[logic] приветственный бонус не показан');
    await p4.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await c4.close();
  }

  // 9. Узкий и широкий экраны: нет горизонтального скролла
  for (const w of [320, 390, 430]) {
    const { ctx: c2, page: p2 } = await newPage({ viewport: { width: w, height: w === 320 ? 568 : 760 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await noHScroll(p2, `выбор ${w}px`);
    await p2.click('.biz[data-type="delivery"]'); await p2.waitForTimeout(250);
    await noHScroll(p2, `детали ${w}px`);
    await p2.click('.modal [data-start]'); await p2.waitForTimeout(300);
    await p2.evaluate(() => { const s = window.__game.state, b = s.businesses[0]; s.tutorial = 3; b.room = 2; b.grid = [1, 2, 13, 4, 25, 6, 37, 8, 1, 12, 3, 4, 5, 26, 7, 0, 0, 0, 0, 0]; b.seen = 8; b.money = 2.5e7; window.__game.rebuild(); });
    for (const v of ['upgrades', 'rating', 'friends', 'shop', 'office']) { await p2.click(`.tab[data-view="${v}"]`); await p2.waitForTimeout(120); await noHScroll(p2, `${v} ${w}px`); }
    if (w === 320) await shot(p2, '20-narrow-320.png');
    await p2.click('#btn-daily'); await p2.waitForTimeout(300); await noHScroll(p2, `календарь ${w}px`);
    if (w === 320) await shot(p2, '21-narrow-320-calendar.png');
    await c2.close();
  }

  await browser.close();
  const real = problems.filter(p => !/telegram\.org/.test(p));
  console.log(real.length ? 'ПРОБЛЕМЫ:\n' + real.join('\n') : 'OK: ошибок console нет, горизонтального скролла нет, логика на месте');
  if (!HAS_NET) console.log('(app/net.js пока нет — его ошибку загрузки пропустили)');
  if (problems.length !== real.length) console.log('(пропущено сетевых сообщений telegram.org: ' + (problems.length - real.length) + ')');
  process.exit(real.length ? 1 : 0);
})();
