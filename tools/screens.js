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
const TOUT = path.join(OUT, 'themes');
const URL = 'file://' + path.join(ROOT, 'app', 'index.html');
const HAS_NET = fs.existsSync(path.join(ROOT, 'app', 'net.js'));
const KEY = 'startup_zero_save_v1';
fs.mkdirSync(TOUT, { recursive: true });

// Подставной сервер для проверки вкладок «Друзья» и «Рейтинг»
const MOCK_NET = `Object.defineProperty(window, 'GameNet', { configurable: true, set() {}, get() { return window.__mockNet; } });
window.__mockNet = {
  ready: () => true, user: () => ({ id: 1, name: 'Саша' }), invite: () => { window.__invited = (window.__invited || 0) + 1; },
  friends: () => new Promise(r => setTimeout(() => r({ invited: 4, counted: 3, list: [
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
    await page.goto(URL + (opts.query || ''));
    await page.waitForTimeout(400);
    return { ctx, page };
  }
  async function noHScroll(page, label) {
    const w = await page.evaluate(() => {
      let worst = null;
      document.querySelectorAll('.view.active *, .modal *, .choose *').forEach(n => {
        const r = n.getBoundingClientRect();
        if (r.width && r.right > window.innerWidth + 1 && !n.closest('.ladder') && !n.matches('.cell .pd')) worst = worst || (n.className || n.tagName) + ' → ' + Math.round(r.right);
      });
      return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, worst };
    });
    if (w.sw > w.cw) problems.push(`[layout] горизонтальный скролл на «${label}»: ${w.sw} > ${w.cw}`);
    if (w.worst) problems.push(`[layout] вылезает за экран на «${label}»: ${w.worst}`);
  }
  async function center(page, sel) {
    const b = await page.locator(sel).first().boundingBox();
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
    const fs4 = await p4.evaluate(() => ({ f: window.__game.state.slots.friends, len: window.__game.state.businesses[0].grid.length }));
    if (fs4.f !== 2 || fs4.len !== 14) problems.push('[logic] доп. места за 3 засчитанных друзей: ' + JSON.stringify(fs4));
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
  for (const th of ['mix', 'k', 'm', 'c', 'b']) for (const w of [320, 390, 430]) {
    const { ctx: c2, page: p2 } = await newPage({ viewport: { width: w, height: w === 320 ? 568 : 760 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, { query: '?theme=' + th });
    const w0 = w; { const w = (th ? th + ' ' : '') + w0;
    await noHScroll(p2, `выбор ${w}px`);
    await p2.click('.biz[data-type="delivery"]'); await p2.waitForTimeout(250);
    await noHScroll(p2, `детали ${w}px`);
    await p2.click('.modal [data-start]'); await p2.waitForTimeout(300);
    await p2.evaluate(() => { const s = window.__game.state, b = s.businesses[0]; s.tutorial = 3; b.room = 2; b.grid = [1, 2, 13, 4, 25, 6, 37, 8, 1, 12, 3, 4, 5, 26, 7, 0, 0, 0, 0, 0]; b.seen = 8; b.money = 2.5e7; window.__game.rebuild(); });
    for (const v of ['upgrades', 'rating', 'friends', 'shop', 'office']) { await p2.click(`.tab[data-view="${v}"]`); await p2.waitForTimeout(120); await noHScroll(p2, `${v} ${w}px`); }
    if (!th && w0 === 320) await shot(p2, '20-narrow-320.png');
    if (th && w0 === 320) await p2.screenshot({ path: path.join(TOUT, th + '-9-narrow-320.jpg'), type: 'jpeg', quality: 82 });
    await p2.click('#btn-daily'); await p2.waitForTimeout(300); await noHScroll(p2, `календарь ${w}px`);
    if (!th && w0 === 320) await shot(p2, '21-narrow-320-calendar.png');
    await c2.close();
  } }

  // 10. Доп. места: замки в сетке, друзья, серия 7 дней, окно «Больше мест»
  {
    const { ctx: c5, page: p5 } = await newPage(iphone);
    await p5.click('.biz[data-type="it"]'); await p5.waitForTimeout(250);
    await p5.click('.modal [data-start]'); await p5.waitForTimeout(300);
    const st0 = await p5.evaluate(() => ({ len: window.__game.state.businesses[0].grid.length, locks: document.querySelectorAll('.cell.locked').length, row: document.querySelector('.grid').classList.contains('lockrow') }));
    if (st0.len !== 12 || st0.locks !== 4 || !st0.row) problems.push('[logic] замки на старте: ' + JSON.stringify(st0));
    await p5.evaluate(() => { window.__game.state.tutorial = 3; window.__game.applyFriendCount(1); });
    await p5.waitForTimeout(200);
    const st1 = await p5.evaluate(() => ({ len: window.__game.state.businesses[0].grid.length, locks: document.querySelectorAll('.cell.locked').length }));
    if (st1.len !== 13 || st1.locks !== 3) problems.push('[logic] +1 место за 1 друга: ' + JSON.stringify(st1));
    await p5.evaluate(() => window.__game.applyFriendCount(0)); // сервер недоступен — открытое не отнимаем
    const st2 = await p5.evaluate(() => window.__game.state.businesses[0].grid.length);
    if (st2 !== 13) problems.push('[logic] место за друга пропало: ' + st2);
    // серия: вчера был 6-й день → сегодня 7-й → +1 место
    await p5.evaluate(() => { const d = new Date(Date.now() - 864e5); window.__game.state.daily = { last: d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(), streak: 6 }; });
    await p5.click('#btn-daily'); await p5.waitForTimeout(300);
    await p5.click('.modal [data-claim]'); await p5.waitForTimeout(500);
    const st3 = await p5.evaluate(() => ({ s: window.__game.state.slots.streak, len: window.__game.state.businesses[0].grid.length }));
    if (!st3.s || st3.len !== 14) problems.push('[logic] +1 место за 7 дней: ' + JSON.stringify(st3));
    await closeModals(p5);
    await p5.click('.cell.locked >> nth=0'); await p5.waitForTimeout(300);
    if (!(await p5.locator('.modal:not([hidden]) [data-star-slot]').count())) problems.push('[logic] окно «Больше мест» не открылось');
    await shot(p5, '22-slots.png');
    await noHScroll(p5, 'больше мест');
    await p5.click('.modal [data-star-slot]'); await p5.waitForTimeout(200);
    if ((await p5.evaluate(() => window.__game.state.slots.stars)) !== 0) problems.push('[logic] место за ⭐ открылось без оплаты');
    await p5.click('.modal [data-go-friends]'); await p5.waitForTimeout(300);
    if (!(await p5.locator('#view-friends.active').count())) problems.push('[logic] «Позвать» не перевёл в Друзья');
    // перетаскивание на замок ничего не ломает
    await p5.click('.tab[data-view="office"]'); await p5.waitForTimeout(200);
    await p5.evaluate(() => { const b = window.__game.state.businesses[0]; b.grid = b.grid.map((v, i) => i === 0 ? 3 : 0); window.__game.rebuild(); });
    const lockSel = '.cell.locked';
    const a = await center(p5, '.cell[data-i="0"]'), lb = await center(p5, lockSel);
    await p5.mouse.move(a.x, a.y); await p5.mouse.down(); await p5.mouse.move(a.x + 10, a.y + 6, { steps: 3 }); await p5.mouse.move(lb.x, lb.y, { steps: 8 }); await p5.mouse.up();
    await p5.waitForTimeout(200);
    const g5 = await p5.evaluate(() => window.__game.state.businesses[0].grid);
    if (g5[0] !== 3 || g5.length !== 14) problems.push('[logic] перетаскивание на замок: ' + g5.join(','));
    await c5.close();
  }
  // старое сохранение с серией ≥ 7 — место за серию даётся при миграции
  {
    const v2 = { v: 2, savedAt: Date.now() - 30e3, createdAt: Date.now() - 864e5, active: 0, tutorial: 3, daily: { last: null, streak: 9 },
      businesses: [{ type: 'coffee', money: 500, earned: 900, room: 0, hires: 10, merges: 5, grid: [3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0], upgrades: { boost: 0, chairs: 0, pr: 0 }, seen: 3, needs: [Date.now(), Date.now(), Date.now()], inbox: [] }] };
    const { ctx: c6, page: p6 } = await newPage(iphone, { init: `try { if (!sessionStorage.getItem('m')) { sessionStorage.setItem('m', 1); localStorage.setItem('${KEY}', ${JSON.stringify(JSON.stringify(v2))}); } } catch (e) {}` });
    const st = await p6.evaluate(() => ({ s: window.__game.state.slots, len: window.__game.state.businesses[0].grid.length }));
    if (!st.s.streak || st.len !== 13) problems.push('[logic] миграция доп. мест: ' + JSON.stringify(st));
    await c6.close();
  }

  // 11. Стили: основной (mix) и скины K, M, C, B — скриншоты в docs/screens/themes/ + коллаж final-style.png
  const OFFICE = {
    it: [25, 4, 13, 3, 12, 2, 2, 31, 1, 1, 0, 0],
    coffee: [5, 14, 3, 23, 2, 2, 12, 1, 1, 34, 0, 0],
    barber: [26, 5, 4, 14, 3, 3, 2, 22, 1, 1, 11, 0]
  };
  for (const th of ['mix', 'k', 'm', 'c', 'b']) {
    const { ctx: ct, page: pt } = await newPage(iphone, { query: '?theme=' + th });
    const ts = name => pt.screenshot({ path: path.join(TOUT, th + '-' + name + '.jpg'), type: 'jpeg', quality: 82 });
    await ts('1-choose');
    await noHScroll(pt, th + ' выбор');
    for (const [bz, grid] of Object.entries(OFFICE)) {
      await pt.evaluate(([bz, grid]) => {
        const B = window.BALANCE, s = window.__game.state, now = Date.now();
        const b = B.newBusiness(bz, now, 0);
        b.grid = grid.slice(); b.seen = 6; b.money = 12480; b.hires = 34; b.needs = [now - 4.8 * 3600e3, now - 1.5 * 3600e3, now - 1 * 3600e3];
        s.businesses = [b]; s.active = 0; s.tutorial = 3; s.slots = { friends: 0, stars: 0, streak: false }; s.net.claimed = []; s.net.invited = 1;
      }, [bz, grid]);
      if (bz === 'it') await pt.evaluate(() => { window.__game.state.slots.friends = 1; });
      await pt.evaluate(() => window.__game.setView('office'));
      await pt.evaluate(() => window.__game.rebuild());
      // экран выбора скрыт — показываем игру (как после входа)
      await pt.evaluate(() => { document.getElementById('choose').hidden = true; document.getElementById('app').hidden = false; window.__game.rebuild(); });
      await pt.waitForTimeout(500);
      await ts('2-office-' + bz);
      await noHScroll(pt, th + ' офис ' + bz);
    }
    // слияние: вспышка и частицы (снимок посреди эффекта)
    {
      const g = await pt.evaluate(() => window.__game.state.businesses[0].grid);
      const i1 = g.indexOf(1), i2 = g.indexOf(1, i1 + 1);
      if (i1 >= 0 && i2 >= 0) {
        const a = await center(pt, `.cell[data-i="${i1}"]`), b = await center(pt, `.cell[data-i="${i2}"]`);
        await pt.mouse.move(a.x, a.y); await pt.mouse.down(); await pt.mouse.move(a.x + 10, a.y + 6, { steps: 3 }); await pt.mouse.move(b.x, b.y, { steps: 6 }); await pt.mouse.up();
        await pt.waitForTimeout(140);
        await ts('3-merge');
        await pt.waitForTimeout(900);
        await closeModals(pt);
      }
    }
    await pt.click('.cell.locked >> nth=0'); await pt.waitForTimeout(350);
    await ts('4-slots');
    await closeModals(pt);
    if (true) {
      // аврал в характере темы (в I — «синий экран»), окно настроек с выбором оформления
      await pt.evaluate(() => { window.__game.state.rush = { until: 0, readyAt: 0 }; });
      await pt.click('#btn-rush'); await pt.waitForTimeout(320);
      await ts('10-rush');
      await pt.waitForTimeout(2900);
      await pt.click('#btn-settings'); await pt.waitForTimeout(350);
      await ts('11-settings');
      await noHScroll(pt, th + ' настройки');
      await pt.evaluate(() => { window.__game.state.net.counted = 1; });
      await pt.click('.modal [data-skins]'); await pt.waitForTimeout(400);
      await ts('12-skins');
      await noHScroll(pt, th + ' стили');
      await closeModals(pt);
    }
    await pt.click('.tab[data-view="shop"]'); await pt.waitForTimeout(400);
    await ts('5-agency');
    await noHScroll(pt, th + ' агентство');
    await pt.evaluate(() => { window.__game.state.agency.freeAt = 0; window.__game.setView('shop'); });
    await pt.click('[data-pack="free"]'); await pt.waitForTimeout(2300);
    await ts('6-pack-open');
    await pt.click('.modal [data-take]'); await pt.waitForTimeout(300);
    await pt.click('.tab[data-view="office"]'); await pt.waitForTimeout(300);
    await pt.evaluate(() => { const d = new Date(Date.now() - 864e5); window.__game.state.daily = { last: d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(), streak: 3 }; });
    await pt.click('#btn-daily'); await pt.waitForTimeout(450);
    await ts('7-calendar');
    await noHScroll(pt, th + ' календарь');
    await closeModals(pt, 3);
    await pt.click('.tab[data-view="upgrades"]'); await pt.waitForTimeout(400);
    await ts('8-upgrades');
    await ct.close();
  }
  // итоговый коллаж: основной стиль (6 экранов) + 4 скина (офис IT)
  {
    const ctx = await browser.newContext({ viewport: { width: 1980, height: 1220 }, deviceScaleFactor: 1.25 });
    const pg = await ctx.newPage();
    const img = n => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(TOUT, n + '.jpg')).toString('base64');
    const fig = (n, c) => `<figure><figcaption>${c}</figcaption><img src="${img(n)}"></figure>`;
    const main = [['mix-2-office-it', 'Офис IT'], ['mix-2-office-coffee', 'Кофейня'], ['mix-2-office-barber', 'Барбершоп'], ['mix-3-merge', 'Слияние'], ['mix-5-agency', 'Агентство'], ['mix-12-skins', 'Экран «Стили»']].map(x => fig(...x)).join('');
    const skins = [['k', 'K · Полночь — 1 друг'], ['m', 'M · Ночной Токио — 3 друга'], ['c', 'C · Кибер-комикс — ⭐ 50'], ['b', 'B · Премиум-золото — ⭐ 100']].map(([t, c]) => fig(t + '-2-office-it', c)).join('');
    await pg.setContent(`<html><body style="margin:0;background:#0b0c12;font:700 22px -apple-system,Segoe UI,Roboto,sans-serif;color:#fff">
      <style>.r{display:grid;grid-template-columns:repeat(6,300px);gap:20px;padding:0 20px 18px}figure{margin:0}figcaption{padding:8px 2px;text-align:center}img{width:300px;border-radius:22px;display:block;box-shadow:0 8px 30px rgba(0,0,0,.6)}
      h1{font-size:26px;margin:0;padding:18px 20px 6px}h2{font-size:18px;color:#9aa3bb;margin:0;padding:4px 20px 0;font-weight:600}</style>
      <h1>Стартап с нуля — основной стиль и скины</h1><h2>Основной (у всех, бесплатно)</h2><div class="r">${main}</div><h2>Скины (открываются в ⚙️ → Стили)</h2><div class="r">${skins}</div></body></html>`);
    await pg.waitForTimeout(400);
    const h = await pg.evaluate(() => document.body.scrollHeight);
    await pg.setViewportSize({ width: 1980, height: h });
    await pg.screenshot({ path: path.join(OUT, 'final-style.png') });
    await ctx.close();
  }
  // лист всех 64 сотрудников (8 бизнесов × 8 уровней) + проверка, что все SVG разные
  {
    const ctx = await browser.newContext({ viewport: { width: 1240, height: 900 }, deviceScaleFactor: 1.5 });
    const pg = await ctx.newPage();
    pg.on('pageerror', e => problems.push('[pageerror] лист: ' + e.message));
    await pg.goto(URL + '?theme=mix'); await pg.waitForTimeout(300);
    const dup = await pg.evaluate(() => {
      const C = window.CONTENT, A = window.GameAvatars, seen = {}, d = [];
      document.body.innerHTML = '<div id="s"></div>'; document.body.style.overflow = 'visible';
      const s = document.getElementById('s');
      s.style.cssText = 'display:grid;grid-template-columns:118px repeat(8,132px);gap:6px;padding:16px;background:#151a26;color:#fff;font:600 12px -apple-system,Segoe UI,Roboto,sans-serif';
      s.insertAdjacentHTML('beforeend', '<div style="grid-column:1/-1;font-size:20px;padding:0 0 8px">Стартап с нуля — все сотрудники (рисованные кодом, app/avatars.js)</div>');
      for (const bz of C.ORDER) {
        s.insertAdjacentHTML('beforeend', `<div style="align-self:center;font-size:14px">${C.BIZ[bz].icon} ${C.BIZ[bz].name}</div>`);
        C.BIZ[bz].staff.forEach((st, i) => {
          const svg = A.svg(bz, i + 1, 0); if (seen[svg]) d.push(bz + '-' + (i + 1)); seen[svg] = 1;
          s.insertAdjacentHTML('beforeend', `<div style="background:#232a3d;border-radius:12px;text-align:center;padding:6px 4px"><div style="height:104px;display:flex;justify-content:center">${A.avatar(bz, i + 1, 0)}</div><div style="min-height:2.4em">${i + 1}. ${st.n}</div></div>`);
        });
      }
      s.insertAdjacentHTML('beforeend', '<div style="align-self:center;font-size:14px">Редкость</div>' + [0, 1, 2, 3].map(r => `<div style="background:#232a3d;border-radius:12px;text-align:center;padding:6px 4px"><div style="height:104px;display:flex;justify-content:center">${A.avatar('coffee', 5, r)}</div>${['обычный', 'редкий', 'эпик', 'лега'][r]}</div>`).join(''));
      document.querySelectorAll('.av').forEach(i => { i.style.height = '104px'; });
      return d;
    });
    if (dup.length) problems.push('[avatars] одинаковые сотрудники: ' + dup.join(', '));
    await pg.waitForTimeout(300);
    const h = await pg.evaluate(() => document.getElementById('s').scrollHeight);
    await pg.setViewportSize({ width: 1240, height: h });
    await pg.screenshot({ path: path.join(OUT, 'avatars-sheet.png') });
    await ctx.close();
  }

  await browser.close();
  const real = problems.filter(p => !/telegram\.org/.test(p));
  console.log(real.length ? 'ПРОБЛЕМЫ:\n' + real.join('\n') : 'OK: ошибок console нет, горизонтального скролла нет, логика на месте');
  if (!HAS_NET) console.log('(app/net.js пока нет — его ошибку загрузки пропустили)');
  if (problems.length !== real.length) console.log('(пропущено сетевых сообщений telegram.org: ' + (problems.length - real.length) + ')');
  process.exit(real.length ? 1 : 0);
})();
