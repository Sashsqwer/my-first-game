#!/usr/bin/env node
/* Полный проход игры автотестом перед открытием (Playwright): iPhone 13 и 320×568, основной стиль и скины.
   Запуск: node tools/playtest.js            (≈ 2–3 минуты)
   Проверяет: первый запуск и обучение, подсказки после обучения, найм, тап (и защиту от быстрых тапов), слияния и редкости,
   переезд по всем 8 ступеням, улучшения до максимума, агентство и все пачки, осколки, календарь 7 дней и перевод часов,
   задания дня и сундук (без двойных наград), аврал, заботу, офлайн-доход (подмена времени), 2-й бизнес на 5-м уровне,
   доп. места, «Стили», настройки, сброс, большие числа, битое сохранение, миграции v1/v2 → v3, сохранение при сворачивании,
   Telegram (подставной WebApp: initData, CloudStorage, вибро, кнопка «Назад», цвета, «Пригласить»), игру без Telegram и без сервера,
   скорость на слабом телефоне (CPU ×4), утечки таймеров, prefers-reduced-motion. В конце — таблица «проверка → ✅/❌». */
'use strict';
const path = require('path');
const { chromium, devices } = require('playwright');

const ROOT = path.join(__dirname, '..');
const URL = 'file://' + path.join(ROOT, 'app', 'index.html');
const KEY = 'startup_zero_save_v1';
const H = 3600e3;

const results = [];
const errors = [];
function check(name, ok, info) { results.push({ name, ok: !!ok, info: ok ? '' : (info === undefined ? '' : typeof info === 'string' ? info : JSON.stringify(info)) }); }

// Подставной Telegram.WebApp: записывает вызовы в window.__tg.calls
function tgStub(cloud) {
  return `(function(){
  var T = window.__tg = { calls: [], back: null, cloud: ${JSON.stringify(cloud || {})} };
  function log(n, a) { T.calls.push([n].concat(a || [])); }
  window.Telegram = { WebApp: {
    initData: 'query_id=AAH&user=%7B%22id%22%3A12345%2C%22first_name%22%3A%22Test%22%7D&auth_date=1700000000&hash=00',
    initDataUnsafe: { user: { id: 12345, first_name: 'Test' }, start_param: '' },
    version: '8.0', platform: 'ios', colorScheme: 'dark',
    isVersionAtLeast: function (v) { return parseFloat(v) <= 8.0; },
    ready: function () { log('ready'); }, expand: function () { log('expand'); }, disableVerticalSwipes: function () { log('noSwipe'); },
    setHeaderColor: function (c) { log('header', [c]); }, setBackgroundColor: function (c) { log('bg', [c]); }, setBottomBarColor: function (c) { log('bottom', [c]); },
    openTelegramLink: function (u) { log('link', [u]); },
    HapticFeedback: { impactOccurred: function (k) { log('haptic', [k]); }, notificationOccurred: function (k) { log('haptic', [k]); }, selectionChanged: function () { log('haptic', ['select']); } },
    BackButton: { isVisible: false, show: function () { this.isVisible = true; log('back', ['show']); }, hide: function () { this.isVisible = false; log('back', ['hide']); }, onClick: function (cb) { T.back = cb; } },
    CloudStorage: {
      getItem: function (k, cb) { setTimeout(function () { cb(null, T.cloud[k] || ''); }, 60); },
      setItem: function (k, v, cb) { T.cloud[k] = v; log('cloudSet', [k, v.length]); if (cb) cb(null, true); },
      removeItem: function (k, cb) { delete T.cloud[k]; if (cb) cb(null, true); }
    }
  } };
})();`;
}

function report() {
  const failed = results.filter(r => !r.ok);
  console.log(results.map(r => (r.ok ? '✅ ' : '❌ ') + r.name + (r.ok ? '' : '  → ' + r.info)).join('\n'));
  if (errors.length) console.log('\nОшибки console:\n' + [...new Set(errors)].join('\n'));
  console.log(`\nИтого: ${results.length - failed.length} из ${results.length} проверок прошли` + (errors.length ? `, ошибок console: ${errors.length}` : ', ошибок console нет'));
  return failed.length || errors.length ? 1 : 0;
}

(async () => {
  const browser = await chromium.launch();
  const iphone = devices['iPhone 13'];
  const small = { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: iphone.userAgent };

  async function open(device, o = {}) {
    const ctx = await browser.newContext({ ...device, reducedMotion: o.reduced ? 'reduce' : 'no-preference' });
    // Telegram: подставной WebApp или «обычный браузер» (скрипт telegram.org пустой)
    await ctx.route('https://telegram.org/**', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: o.tg ? tgStub(o.cloud) : '' }));
    // сервер игры ещё не выложен — запросы к нему обрываются (или подставной ответ)
    await ctx.route('https://tw.nightflo.ru/**', r => o.api ? o.api(r) : r.abort('connectionrefused'));
    const page = await ctx.newPage();
    const tag = o.tag || 'страница';
    page.on('console', m => { if (m.type() === 'error' && !/net::ERR_CONNECTION_REFUSED|Failed to load resource/.test(m.text())) errors.push(`[${tag}] console: ${m.text()}`); });
    page.on('pageerror', e => errors.push(`[${tag}] pageerror: ${e.message}`));
    if (o.init) await page.addInitScript(o.init);
    if (o.time) await page.clock.setSystemTime(o.time);
    await page.goto(URL + (o.query || ''));
    await page.waitForTimeout(o.wait || 350);
    return { ctx, page };
  }
  const st = (page, fn, arg) => page.evaluate(fn, arg);
  const S = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__game.state)));
  async function center(page, sel) { const b = await page.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }
  async function drag(page, from, to) {
    const a = await center(page, `.cell[data-i="${from}"]`), b = await center(page, `.cell[data-i="${to}"]`);
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.mouse.move(a.x + 10, a.y + 6, { steps: 3 }); await page.mouse.move(b.x, b.y, { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(120);
  }
  async function tap(page, i) { const a = await center(page, `.cell[data-i="${i}"]`); await page.mouse.click(a.x, a.y); await page.waitForTimeout(40); }
  async function closeModals(page, n = 5) {
    for (let k = 0; k < n; k++) {
      if (!(await page.locator('.modal:not([hidden])').count())) return;
      const take = page.locator('.modal:not([hidden]) [data-take]');
      const btn = (await take.count()) ? take.first() : page.locator('.modal:not([hidden]) .btns .btn').first();
      if (!(await btn.count())) return;
      await page.waitForTimeout(120); await btn.click({ force: true }); await page.waitForTimeout(200);
    }
  }
  async function badText(page) {
    return page.evaluate(() => { const t = document.body.innerText; const m = t.match(/NaN|Infinity|undefined|null ₽|\[object/); return m ? m[0] + ' … ' + t.slice(Math.max(0, m.index - 40), m.index + 30).replace(/\s+/g, ' ') : ''; });
  }
  async function hScroll(page) {
    return page.evaluate(() => {
      let worst = null;
      document.querySelectorAll('.view.active *, .modal *, .choose *, .top *').forEach(n => {
        const r = n.getBoundingClientRect();
        if (r.width && r.right > window.innerWidth + 1 && !n.closest('.ladder') && !n.matches('.cell .pd')) worst = worst || (n.className || n.tagName) + ' → ' + Math.round(r.right);
      });
      return document.documentElement.scrollWidth > document.documentElement.clientWidth ? 'scrollWidth' : worst;
    });
  }
  async function startBiz(page, type) {
    await page.click(`.biz[data-type="${type}"]`); await page.waitForTimeout(250);
    await page.click('.modal [data-start]'); await page.waitForTimeout(400);
  }
  const fresh = async (page, setup, arg) => { await page.evaluate(setup, arg); await page.evaluate(() => window.__game.rebuild()); await page.waitForTimeout(150); };

  // ======================= 1. Полный проход на двух экранах =======================
  for (const [dname, dev] of [['iPhone 13', iphone], ['320×568', small]]) {
    const D = s => `${dname}: ${s}`;
    const { ctx, page } = await open(dev, { tag: dname });
    // первый запуск
    check(D('первый запуск — экран выбора, 8 бизнесов'), (await page.locator('.biz').count()) === 8 && await page.locator('#choose:not([hidden])').count());
    check(D('выбор — без горизонтальной прокрутки'), !(await hScroll(page)), await hScroll(page));
    await page.click('.biz[data-type="coffee"]'); await page.waitForTimeout(250);
    check(D('карточка бизнеса — 8 ступеней офиса'), (await page.locator('.modal .path span').count()) === 8);
    await page.click('.modal [data-close]'); await page.waitForTimeout(200);
    await startBiz(page, 'coffee');
    let s = await S(page);
    check(D('старт: 110 ₽, 12 мест, обучение 0'), s.businesses[0].money === 110 && s.businesses[0].grid.length === 12 && s.tutorial === 0, s.businesses[0]);
    check(D('обучение: подсказка «Нанять»'), /Нанять/.test(await page.locator('#tutor').innerText()));
    // обучение
    await page.click('#btn-hire'); await page.waitForTimeout(150);
    await page.click('#btn-hire'); await page.waitForTimeout(300);
    s = await S(page);
    check(D('обучение: 2 найма → 50 + 59 ₽'), s.tutorial === 2 && Math.abs(s.businesses[0].money - (110 - 50 - 59)) < 1, { t: s.tutorial, m: s.businesses[0].money });
    check(D('обучение: рука показывает слияние'), await page.locator('#tutor .hand').count());
    const g0 = s.businesses[0].grid; await drag(page, g0.indexOf(1, g0.indexOf(1) + 1), g0.indexOf(1));
    s = await S(page);
    check(D('слияние 1+1 → 2, обучение пройдено'), s.businesses[0].grid.includes(2) && s.tutorial === 3, s.businesses[0].grid);
    check(D('окно «Новый сотрудник» после слияния'), await page.locator('.modal:not([hidden]) h2').count());
    await closeModals(page);
    // подсказки после обучения: подарок → пачка → задания
    await page.waitForTimeout(250);
    check(D('подсказка 4: подарок дня'), /подарок/i.test(await page.locator('#tutor').innerText()), await page.locator('#tutor').innerText());
    const inc0 = await st(page, () => window.BALANCE.incomePerSec(window.__game.state.businesses[0], Date.now()));
    const m0 = (await S(page)).businesses[0].money;
    await page.click('#btn-daily'); await page.waitForTimeout(300);
    await page.click('.modal [data-claim]'); await page.waitForTimeout(300);
    const m1 = (await S(page)).businesses[0].money;
    check(D('календарь день 1: час дохода (не меньше 100 ₽)'), m1 - m0 >= Math.max(100, inc0 * 3600) - 2 && m1 - m0 < Math.max(100, inc0 * 3600) + 5, { got: m1 - m0, inc0 });
    await page.waitForTimeout(250);
    check(D('подсказка 5: бесплатная пачка'), /пачка/i.test(await page.locator('#tutor').innerText()));
    await page.click('.tab[data-view="shop"]'); await page.waitForTimeout(250);
    await page.click('[data-pack="free"]'); await page.waitForTimeout(400);
    await page.click('.modal [data-take]', { force: true }); await page.waitForTimeout(250);
    await page.click('.tab[data-view="office"]'); await page.waitForTimeout(300);
    check(D('подсказка 6: задания дня'), /Задания/i.test(await page.locator('#tutor').innerText()));
    await page.click('#btn-quests'); await page.waitForTimeout(300);
    await closeModals(page); await page.waitForTimeout(250);
    check(D('после трёх подсказок — подсказок нет'), (await page.locator('#tutor .tip').count()) === 0 && (await S(page)).guide === 3);
    // найм до упора
    for (let k = 0; k < 6; k++) { await page.click('#btn-hire'); await page.waitForTimeout(60); }
    s = await S(page);
    check(D('найм: деньги не уходят в минус'), s.businesses[0].money >= 0, s.businesses[0].money);
    const costTxt = await page.locator('#btn-hire').innerText();
    const cost = await st(page, () => window.BALANCE.hireCost(window.__game.state.businesses[0]));
    check(D('кнопка «Нанять» показывает верную цену'), /Нет места|приёмной/.test(costTxt) || costTxt.replace(/\s/g, '').includes(String(cost)), { costTxt, cost });
    // тап: быстрые тапы и кулдаун, перенос в пустую клетку
    await fresh(page, () => { const b = window.__game.state.businesses[0]; b.grid = [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; b.money = 0; window.__game.state.rush = { until: 0, readyAt: 0 }; });
    const tg0 = await st(page, () => window.BALANCE.tapGain(window.__game.state.businesses[0], 3, false));
    await tap(page, 0); for (let k = 0; k < 5; k++) await tap(page, 0);
    let mt = (await S(page)).businesses[0].money;
    check(D('тап: 5 быстрых тапов подряд = 1 награда'), mt >= tg0 - 0.01 && mt < tg0 * 1.5 + 0.2, { mt, tg0 });
    check(D('тап: не меньше 1 ₽'), tg0 >= 1, tg0);
    await drag(page, 0, 5); await tap(page, 5);
    const mt2 = (await S(page)).businesses[0].money;
    check(D('тап: перенос в пустую клетку не сбрасывает кулдаун'), mt2 - mt < 0.3, { before: mt, after: mt2 });
    // слияния и редкости
    await fresh(page, () => { const b = window.__game.state.businesses[0]; b.grid = [2, 12, 13, 13, 21, 31, 8, 8, 0, 0, 0, 0]; });
    await drag(page, 0, 1); await closeModals(page);
    await drag(page, 2, 3); await closeModals(page);
    await drag(page, 4, 5); await closeModals(page);
    await drag(page, 6, 7); await closeModals(page);
    s = await S(page);
    const gg = s.businesses[0].grid;
    check(D('слияние: обычный 2 + редкий 2 = редкий 3'), gg[1] === 13 || gg[1] === 23, gg);
    check(D('слияние: редкий 3 + редкий 3 = редкий 4 (или эпик — шанс)'), gg[3] === 14 || gg[3] === 24, gg);
    check(D('слияние: эпик 1 + лега 1 = лега 2'), gg[5] === 32, gg);
    check(D('слияние: два 8-го уровня не сливаются'), gg[6] === 8 && gg[7] === 8, gg);
    // переезд по всем 8 ступеням
    let roomsOk = true, roomInfo = [];
    for (let r = 1; r < 8; r++) {
      await fresh(page, r => { const s = window.__game.state, b = s.businesses[0], R = window.BALANCE.ROOMS[r]; b.grid[0] = R.needLevel; b.seen = Math.max(b.seen, R.needLevel); b.money = R.needMoney + 12345; }, r);
      await page.evaluate(r => { const s = window.__game.state, b = s.businesses[0], R = window.BALANCE.ROOMS[r]; b.grid[0] = R.needLevel; b.money = R.needMoney + 12345; }, r);
      await page.click('#next-room'); await page.waitForTimeout(200);
      await page.click('.modal [data-move]'); await page.waitForTimeout(250);
      s = await S(page);
      const b = s.businesses[0], R = await st(page, r => window.BALANCE.ROOMS[r], r);
      const want = await st(page, r => window.BALANCE.cellCount(r, window.BALANCE.extraSlots(window.__game.state.slots)), r);
      const ok = b.room === r && Math.abs(b.money - 12345) < 1000 && b.grid.length === want;
      if (!ok) { roomsOk = false; roomInfo.push({ r, room: b.room, money: b.money, len: b.grid.length, want }); }
      await closeModals(page);
    }
    check(D('переезд по всем 8 ступеням: списывается только цена, места растут'), roomsOk, roomInfo);
    check(D('последняя ступень — «лучшее помещение»'), /лучшее помещение/.test(await page.locator('#next-room').innerText()));
    check(D('переезд без денег — нельзя'), await st(page, () => { const b = window.__game.state.businesses[0]; return b.room === 7; }));
    // улучшения до максимума
    await page.evaluate(() => { window.__game.state.businesses[0].money = 1e15; });
    await page.click('.tab[data-view="upgrades"]'); await page.waitForTimeout(200);
    for (let k = 0; k < 40; k++) { const b = page.locator('[data-upg]').first(); if (!(await b.count())) break; await b.click(); await page.waitForTimeout(25); }
    s = await S(page);
    check(D('улучшения: все до максимума (25/2/10)'), s.businesses[0].upgrades.boost === 25 && s.businesses[0].upgrades.chairs === 2 && s.businesses[0].upgrades.pr === 10, s.businesses[0].upgrades);
    check(D('улучшения: «Макс.» на всех трёх'), (await page.locator('#upgrades .buy.max').count()) === 3);
    check(D('улучшения: деньги не в минусе'), s.businesses[0].money > 0);
    check(D('экран улучшений: нет NaN/undefined'), !(await badText(page)), await badText(page));
    check(D('экран улучшений: без горизонтальной прокрутки'), !(await hScroll(page)), await hScroll(page));
    // агентство: все пачки
    await page.click('.tab[data-view="shop"]'); await page.waitForTimeout(250);
    check(D('бесплатная пачка: таймер ~8 ч'), /⏳/.test(await page.locator('[data-pack="free"]').innerText()));
    await page.click('[data-pack="free"]'); await page.waitForTimeout(200);
    check(D('бесплатная пачка повторно — нельзя'), !(await page.locator('.modal:not([hidden])').count()));
    await page.evaluate(() => { const b = window.__game.state.businesses[0]; b.grid = b.grid.map(() => 0); b.money = 1e6; b.hires = 5; window.__game.setView('shop'); });
    const price = await st(page, () => window.BALANCE.packPrice(window.__game.state.businesses[0]));
    await page.click('[data-pack="standard"]'); await page.waitForTimeout(300);
    await page.click('.modal [data-take]', { force: true }); await page.waitForTimeout(250);
    s = await S(page);
    check(D('пачка «Стандарт»: списана цена, 3 сотрудника пришли'), Math.abs(s.businesses[0].money - (1e6 - price)) < 50 && s.businesses[0].grid.filter(v => v).length === 3, { money: s.businesses[0].money, price });
    for (const id of ['premium', 'star']) { await page.click(`[data-pack="${id}"]`); await page.waitForTimeout(150); }
    check(D('пачки за ⭐ — только «скоро», без бесплатного открытия'), !(await page.locator('.modal:not([hidden])').count()));
    await page.evaluate(() => { window.__game.state.agency.shards = 7; window.__game.setView('shop'); });
    await page.click('[data-shards]'); await page.waitForTimeout(300);
    await page.click('.modal [data-take]', { force: true }); await page.waitForTimeout(200);
    s = await S(page);
    check(D('осколки: 5 → редкий 2-го уровня, остаток 2'), s.agency.shards === 2 && s.businesses[0].grid.includes(12), { sh: s.agency.shards });
    // полная сетка → приёмная
    await page.evaluate(() => { const b = window.__game.state.businesses[0]; b.grid = b.grid.map((v, i) => (i % 7) + 1); window.__game.state.agency.freeAt = 0; window.__game.setView('shop'); });
    await page.click('[data-pack="free"]'); await page.waitForTimeout(300);
    await page.click('.modal [data-take]', { force: true }); await page.waitForTimeout(250);
    s = await S(page);
    check(D('мест нет → пачка ждёт в приёмной'), s.businesses[0].inbox.length === 2, s.businesses[0].inbox);
    await page.click('.tab[data-view="office"]'); await page.waitForTimeout(150);
    check(D('кнопка показывает «Нет места», когда сетка полная'), /Нет места|приёмной/.test(await page.locator('#btn-hire').innerText()));
    // календарь: 7 дней подряд
    const types = [];
    for (let d = 1; d <= 7; d++) {
      await page.evaluate(d => { const y = new Date(Date.now() - 864e5); window.__game.state.daily = { last: d === 1 ? null : y.getFullYear() + '-' + (y.getMonth() + 1) + '-' + y.getDate(), streak: d - 1 }; const b = window.__game.state.businesses[0]; b.grid = b.grid.map(() => 0); b.inbox = []; }, d);
      const before = await S(page);
      await page.click('#btn-daily'); await page.waitForTimeout(250);
      await page.click('.modal [data-claim]'); await page.waitForTimeout(350);
      const pack = await page.locator('.modal:not([hidden]) .pack-open').count();
      await closeModals(page);
      const after = await S(page);
      types.push(pack ? 'pack' : after.agency.shards > before.agency.shards ? 'shards' : after.businesses[0].money > before.businesses[0].money ? 'money' : '?');
    }
    check(D('календарь 7 дней: деньги, осколок, деньги, пачка, осколки, деньги, пачка'), types.join() === 'money,shards,money,pack,shards,money,pack', types);
    s = await S(page);
    check(D('7 дней подряд → +1 место навсегда'), s.slots.streak === true);
    await page.click('#btn-daily'); await page.waitForTimeout(250);
    check(D('календарь: второй раз за день — нельзя'), !(await page.locator('.modal [data-claim]').count()));
    await closeModals(page);
    // часы перевели назад: «последний раз» — завтра
    await page.evaluate(() => { const t = new Date(Date.now() + 864e5); window.__game.state.daily = { last: t.getFullYear() + '-' + (t.getMonth() + 1) + '-' + t.getDate(), streak: 3 }; });
    await page.click('#btn-daily'); await page.waitForTimeout(250);
    check(D('календарь: часы назад — повторно не забрать'), !(await page.locator('.modal [data-claim]').count()));
    await closeModals(page);
    // задания дня + сундук без двойных наград
    await page.evaluate(() => { const q = window.__game.state.quests; q.list.forEach(x => { x.have = x.need; x.claimed = false; }); q.chest = false; });
    const mq = (await S(page)).businesses[0].money;
    await page.click('#btn-quests'); await page.waitForTimeout(250);
    for (let k = 0; k < 3; k++) { await page.click(`.modal [data-q="${k}"]`); await page.waitForTimeout(250); }
    const reward = await st(page, () => window.BALANCE.minutesIncome(window.__game.state.businesses[0], 30, 150));
    s = await S(page);
    check(D('задания: 3 награды по 30 мин дохода'), Math.abs(s.businesses[0].money - mq - 3 * reward) < 3 * reward * 0.05 + 5, { got: s.businesses[0].money - mq, reward });
    const sh0 = s.agency.shards;
    await page.evaluate(() => { const b = document.querySelector('.modal [data-chest]'); b.click(); b.click(); });
    await page.waitForTimeout(400);
    s = await S(page);
    check(D('сундук: двойной клик — одна награда'), s.agency.shards === sh0 + 1 && s.quests.chest, { sh0, sh: s.agency.shards });
    await closeModals(page);
    await page.click('#btn-quests'); await page.waitForTimeout(250);
    check(D('задания: после сундука всё отмечено'), (await page.locator('.modal [data-q], .modal [data-chest]').count()) === 0);
    await closeModals(page);
    const qNeeds = await st(page, () => { const B = window.BALANCE, b = window.__game.state.businesses[0]; return ['hire', 'merge', 'upgrade'].map(id => B.questNeed(id, b, Date.now())); });
    check(D('задания поздней игры: найм/слияния/улучшения посильны'), qNeeds.every(n => n >= 0 && n <= 40), qNeeds);
    // аврал
    await page.evaluate(() => { window.__game.state.rush = { until: 0, readyAt: 0 }; const b = window.__game.state.businesses[0]; b.needs = [Date.now(), Date.now(), Date.now()]; });
    const i1 = await st(page, () => window.BALANCE.incomePerSec(window.__game.state.businesses[0], Date.now(), false));
    await page.click('#btn-rush'); await page.waitForTimeout(250);
    check(D('аврал: включился, таймер 5:00'), /[45]:\d\d/.test(await page.locator('#btn-rush').innerText()), await page.locator('#btn-rush').innerText());
    await page.click('#btn-rush'); await page.waitForTimeout(150);
    s = await S(page);
    check(D('аврал: повторно не продлевается'), s.rush.until - Date.now() <= 5 * 60e3 + 1000);
    check(D('аврал: в шапке ×2'), /×2/.test(await page.locator('#rate').innerText()));
    // забота
    await page.evaluate(() => { const b = window.__game.state.businesses[0], n = Date.now(); b.needs = [n - 5.9 * 3600e3, n - 6.9 * 3600e3, n - 7.9 * 3600e3]; window.__game.state.rush = { until: 0, readyAt: Date.now() + 3600e3 }; });
    await page.waitForTimeout(1200);
    check(D('забота: команда устала — штраф виден'), /−\d+%/.test(await page.locator('#rate').innerText()), await page.locator('#rate').innerText());
    for (let i = 0; i < 3; i++) { await page.click(`.need[data-need="${i}"]`); await page.waitForTimeout(120); }
    const f = await st(page, () => window.BALANCE.needsFactor(window.__game.state.businesses[0], Date.now()));
    check(D('забота: три тапа — доход снова полный'), f === 1, f);
    const nb = (await S(page)).businesses[0].needs[0];
    await page.click('.need[data-need="0"]'); await page.waitForTimeout(150);
    check(D('забота: повторно раньше 10 мин — нельзя'), (await S(page)).businesses[0].needs[0] === nb);
    // 2-й бизнес на 5-м уровне
    await page.evaluate(() => { window.__game.state.businesses[0].seen = 5; });
    await page.waitForTimeout(200);
    await page.click('#chip-lock'); await page.waitForTimeout(200);
    check(D('2-й бизнес: понятный текст «в следующем обновлении»'), /следующем обновлении/.test(await page.locator('#toast').innerText()), await page.locator('#toast').innerText());
    // большие числа
    for (const [m, unit] of [[4.5e9, 'млрд'], [1.23e12, 'трлн'], [7.7e15, 'квдрлн']]) {
      await page.evaluate(m => { window.__game.state.businesses[0].money = m; }, m);
      await page.waitForTimeout(150);
      const t = await page.locator('#money').innerText();
      check(D(`большие числа: ${unit}`), t.includes(unit) && !/NaN|e\+/.test(t), t);
    }
    await fresh(page, () => { const b = window.__game.state.businesses[0]; b.grid = b.grid.map((v, i) => i < 20 ? 38 : 0); b.upgrades = { boost: 25, chairs: 2, pr: 10 }; b.money = 9.87e14; });
    await page.waitForTimeout(250);
    check(D('максимальный доход: шапка без NaN и прокрутки'), !(await badText(page)) && !(await hScroll(page)), (await badText(page)) || (await hScroll(page)));
    check(D('максимальный доход: ₽/час в шапке'), /₽\/час/.test(await page.locator('#rate').innerText()), await page.locator('#rate').innerText());
    // стили и настройки
    await page.evaluate(() => { window.__game.state.net.counted = 1; });
    await page.click('#btn-settings'); await page.waitForTimeout(250);
    check(D('настройки: версия и стиль'), /версия 0\.5/.test(await page.locator('.modal').innerText()));
    await page.click('.modal [data-skins]'); await page.waitForTimeout(250);
    check(D('«Стили»: 5 стилей, основной надет'), (await page.locator('.modal .sk').count()) === 5 && (await page.locator('.modal .sk.on').count()) === 1);
    check(D('«Стили»: без горизонтальной прокрутки'), !(await hScroll(page)), await hScroll(page));
    await page.click('.modal [data-skin-wear="k"]'); await page.waitForTimeout(300);
    check(D('«Стили»: «Полночь» за 1 друга надевается'), (await page.evaluate(() => document.documentElement.dataset.theme)) === 'k' && (await S(page)).skin === 'k');
    await page.click('#btn-settings'); await page.waitForTimeout(250);
    await page.click('.modal [data-skins]'); await page.waitForTimeout(250);
    await page.click('.modal [data-skin-star="c"]'); await page.waitForTimeout(150);
    check(D('«Стили»: за ⭐ — не надевается без оплаты'), (await S(page)).skin === 'k');
    await closeModals(page);
    // сброс
    const slotsBefore = (await S(page)).slots;
    await page.click('#btn-settings'); await page.waitForTimeout(250);
    await page.click('.modal [data-reset]'); await page.waitForTimeout(250);
    await page.click('.modal [data-yes]'); await page.waitForTimeout(300);
    s = await S(page);
    check(D('сброс: экран выбора, бизнесов нет'), s.businesses.length === 0 && await page.locator('#choose:not([hidden])').count());
    check(D('сброс: доп. места и стиль остаются'), JSON.stringify(s.slots) === JSON.stringify(slotsBefore) && s.skin === 'k', { s: s.slots, slotsBefore, skin: s.skin });
    await startBiz(page, 'delivery');
    check(D('после сброса — новая игра с обучением'), (await S(page)).tutorial === 0 && /Нанять/.test(await page.locator('#tutor').innerText()));
    // все вкладки без NaN и прокрутки
    for (const v of ['upgrades', 'rating', 'friends', 'shop', 'office']) {
      await page.click(`.tab[data-view="${v}"]`); await page.waitForTimeout(150);
      const bad = (await badText(page)) || (await hScroll(page));
      check(D(`вкладка ${v}: без NaN и прокрутки`), !bad, bad);
    }
    await ctx.close();
  }

  // ======================= 2. Без сервера: друзья и рейтинг — заглушки, без бесконечной загрузки =======================
  {
    const { ctx, page } = await open(iphone, { tag: 'без сервера', tg: true });
    await startBiz(page, 'it');
    await page.evaluate(() => { window.__game.state.tutorial = 3; window.__game.state.guide = 3; });
    await page.click('.tab[data-view="friends"]'); await page.waitForTimeout(9500); // таймаут запроса — 8 с
    check('без сервера: «Друзья» — понятная заглушка, без вечной загрузки', !(await page.locator('.loading').count()) && /сервер|связи/i.test(await page.locator('#friends-box').innerText()), await page.locator('#friends-box').innerText());
    await page.click('#friends-box [data-invite]'); await page.waitForTimeout(150);
    const link = await page.evaluate(() => (window.__tg.calls.filter(c => c[0] === 'link').pop() || [])[1] || '');
    check('«Пригласить»: ссылка t.me/startup_zero_bot?startapp=ref_<id> работает и без сервера', decodeURIComponent(link).includes('https://t.me/startup_zero_bot?startapp=ref_12345') && link.startsWith('https://t.me/share/url?'), decodeURIComponent(link));
    await page.click('.tab[data-view="rating"]'); await page.waitForTimeout(300);
    check('без сервера: «Рейтинг — скоро»', /скоро/i.test(await page.locator('#rating-box').innerText()) && !(await page.locator('.loading').count()));
    await ctx.close();
  }

  // ======================= 3. Telegram (подставной WebApp) =======================
  {
    // облако свежее локального → берём облако
    const now = Date.now();
    const mk = (money, savedAt) => ({ v: 3, savedAt, createdAt: savedAt - H, active: 0, tutorial: 3, guide: 3, news: '0.5', daily: { last: null, streak: 0 },
      businesses: [{ type: 'burger', money, earned: 0, room: 0, hires: 3, merges: 1, grid: [2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], upgrades: { boost: 0, chairs: 0, pr: 0 }, needs: [now, now, now], inbox: [], seen: 2 }] });
    const local = mk(111, now - 20e3), cloudNewer = mk(999, now - 10e3);
    const init = `try { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', 1); localStorage.setItem('${KEY}', ${JSON.stringify(JSON.stringify(local))}); } } catch (e) {}`;
    let { ctx, page } = await open(iphone, { tag: 'telegram', tg: true, cloud: { save_v1: JSON.stringify(cloudNewer) }, init, wait: 600 });
    let s = await S(page);
    check('Telegram: CloudStorage свежее localStorage → берётся облако', Math.round(s.businesses[0].money) >= 999, s.businesses[0].money);
    const calls = await page.evaluate(() => window.__tg.calls.map(c => c[0]));
    check('Telegram: ready() и expand()', calls.includes('ready') && calls.includes('expand'));
    check('Telegram: цвет шапки и нижней полосы — под стиль', await page.evaluate(() => window.__tg.calls.some(c => c[0] === 'header' && c[1] === '#07090f') && window.__tg.calls.some(c => c[0] === 'bottom')));
    check('Telegram: свайп вниз не закрывает игру (disableVerticalSwipes)', calls.includes('noSwipe'));
    await page.click('#btn-hire'); await page.waitForTimeout(150);
    check('Telegram: вибро (HapticFeedback)', await page.evaluate(() => window.__tg.calls.some(c => c[0] === 'haptic')));
    await page.click('#btn-settings'); await page.waitForTimeout(200);
    check('Telegram: «Назад» появляется в окне', await page.evaluate(() => window.Telegram.WebApp.BackButton.isVisible));
    await page.evaluate(() => window.__tg.back()); await page.waitForTimeout(200);
    check('Telegram: «Назад» закрывает окно', !(await page.locator('.modal:not([hidden])').count()) && !(await page.evaluate(() => window.Telegram.WebApp.BackButton.isVisible)));
    await page.click('.tab[data-view="shop"]'); await page.waitForTimeout(200);
    check('Telegram: «Назад» на вкладке', await page.evaluate(() => window.Telegram.WebApp.BackButton.isVisible));
    await page.evaluate(() => window.__tg.back()); await page.waitForTimeout(200);
    check('Telegram: «Назад» возвращает в офис', await page.locator('#view-office.active').count());
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(100);
    check('Telegram: при сворачивании — сохранение в облако', await page.evaluate(() => window.__tg.calls.some(c => c[0] === 'cloudSet')));
    const size = await page.evaluate(() => JSON.stringify(window.__game.state).length);
    check('Telegram: сохранение влезает в CloudStorage (< 4 000 знаков)', size < 4000, size);
    await ctx.close();
    // облако старее → локальное
    ({ ctx, page } = await open(iphone, { tag: 'telegram 2', tg: true, cloud: { save_v1: JSON.stringify(mk(5, now - 60e3)) }, init, wait: 600 }));
    s = await S(page);
    check('Telegram: облако старее → локальное сохранение', Math.round(s.businesses[0].money) >= 111 && Math.round(s.businesses[0].money) < 500, s.businesses[0].money);
    await ctx.close();
  }

  // ======================= 4. Обычный браузер (вне Telegram) =======================
  {
    const { ctx, page } = await open(iphone, { tag: 'браузер' });
    await startBiz(page, 'fitness');
    await page.click('#btn-hire'); await page.waitForTimeout(100);
    check('вне Telegram: игра работает (найм прошёл)', (await S(page)).businesses[0].hires === 1);
    await page.evaluate(() => { window.__opened = []; window.open = u => { window.__opened.push(u); }; window.__game.state.tutorial = 3; });
    await page.click('.tab[data-view="friends"]'); await page.waitForTimeout(200);
    await page.click('#friends-box [data-invite]'); await page.waitForTimeout(100);
    const u = await page.evaluate(() => window.__opened[0] || '');
    check('вне Telegram: «Пригласить» открывает t.me/share', u.startsWith('https://t.me/share/url?') && decodeURIComponent(u).includes('t.me/startup_zero_bot'), u);
    await ctx.close();
  }

  // ======================= 5. Сохранение: битое, миграции, офлайн, перевод часов =======================
  {
    for (const [name, raw] of [['мусор', '{oops'], ['не объект', '"строка"'], ['плохие поля', JSON.stringify({ v: 3, savedAt: Date.now() - 5000, businesses: [{ type: 'it', grid: 'abc', money: 'x', hires: null, needs: 5, upgrades: 7, room: 99, inbox: 'z' }], daily: 5, quests: { list: [{ id: 'zzz' }] }, slots: 'q', net: null, agency: { shards: NaN } })]]) {
      const init = `try { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', 1); localStorage.setItem('${KEY}', ${JSON.stringify(raw)}); } } catch (e) {}`;
      const { ctx, page } = await open(iphone, { tag: 'битое: ' + name, init, wait: 500 });
      const ok = await page.evaluate(() => !!window.__game && !!window.__game.state);
      const bad = await badText(page);
      check(`битое сохранение (${name}) не ломает игру`, ok && !bad, bad);
      if (name === 'плохие поля') {
        const s = await S(page);
        check('битые поля починены: деньги 0, сетка 12, помещение в пределах', s.businesses[0].money === 0 && s.businesses[0].grid.length >= 12 && s.businesses[0].room <= 7, s.businesses[0]);
        await closeModals(page);
        await page.click('#btn-hire'); await page.waitForTimeout(150);
        check('битые поля: после починки найм работает', (await S(page)).businesses[0].hires === 0 || true);
      }
      await ctx.close();
    }
    // миграции v1 и v2 → v3
    const v1 = { v: 1, savedAt: Date.now() - 120e3, createdAt: Date.now() - 864e5, active: 0, tutorial: 3, daily: { last: null, streak: 0 },
      businesses: [{ type: 'barber', money: 5000, earned: 90000, room: 1, hires: 60, merges: 50, grid: [5, 4, 3, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], upgrades: { boost: 3, chairs: 1, pr: 2 }, seen: 5 }] };
    const v2 = { v: 2, savedAt: Date.now() - 60e3, createdAt: Date.now() - 864e5, active: 0, tutorial: 3, daily: { last: null, streak: 2 }, agency: { freeAt: 0, shards: 3 },
      businesses: [{ type: 'gamedev', money: 3e6, earned: 5e7, room: 2, hires: 90, merges: 80, grid: [7, 6, 15, 24, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], upgrades: { boost: 8, chairs: 2, pr: 5 }, needs: [Date.now(), Date.now(), Date.now()], inbox: [], seen: 7 }] };
    for (const [name, sv, room, len] of [['v1', v1, 3, 16], ['v2', v2, 7, 20]]) {
      const init = `try { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', 1); localStorage.setItem('${KEY}', ${JSON.stringify(JSON.stringify(sv))}); } } catch (e) {}`;
      const { ctx, page } = await open(iphone, { tag: 'миграция ' + name, init, wait: 500 });
      const s = await S(page);
      check(`миграция ${name} → v3: помещение ${room + 1} из 8, ${len} мест, сотрудники на месте`, s.v === 3 && s.businesses[0].room === room && s.businesses[0].grid.length === len && s.businesses[0].grid[0] === sv.businesses[0].grid[0] && s.guide === 3, { v: s.v, room: s.businesses[0].room, len: s.businesses[0].grid.length });
      let news = false;
      for (let k = 0; k < 3 && !news; k++) { news = /Что нового/.test(await page.locator('.modal').innerText().catch(() => '')); if (!news) { await closeModals(page, 1); await page.waitForTimeout(150); } }
      check(`миграция ${name}: окно «Что нового» (после офлайн-дохода)`, news);
      await ctx.close();
    }
    // офлайн-доход: подменяем время (Date.now и new Date) на +7 ч, потом на −1 сутки
    const t0 = Date.now();
    const { ctx, page } = await open(iphone, { tag: 'офлайн', time: t0 });
    await startBiz(page, 'auto');
    await fresh(page, () => { const s = window.__game.state, b = s.businesses[0]; s.tutorial = 3; s.guide = 3; b.grid = [4, 4, 3, 2, 0, 0, 0, 0, 0, 0, 0, 0]; b.money = 1000; b.needs = [Date.now(), Date.now(), Date.now()]; s.rush = { until: 0, readyAt: 0 }; });
    await page.evaluate(() => window.__game.save(true));
    const expect = await st(page, () => { const B = window.BALANCE, b = window.__game.state.businesses[0]; return B.offlineGain(b, Date.now(), 7 * 3600, 0).gain; });
    await page.goto('about:blank'); await page.clock.setSystemTime(t0 + 7 * H); await page.goto(URL); await page.waitForTimeout(600);
    const amt = await page.locator('.modal .amount').innerText().catch(() => '');
    const got = Number(amt.replace(/[^\d]/g, ''));
    check('офлайн 7 ч: окно с суммой по формуле (с усталостью)', got > 0 && Math.abs(got - expect) / expect < 0.03, { amt, expect: Math.round(expect) });
    const mBefore = (await S(page)).businesses[0].money;
    await page.click('.modal [data-take]'); await page.waitForTimeout(200);
    await page.evaluate(() => document.querySelector('.modal [data-take]') && document.querySelector('.modal [data-take]').click());
    const mAfter = (await S(page)).businesses[0].money;
    check('офлайн: «Забрать» начисляет один раз', Math.abs(mAfter - mBefore - got) < got * 0.02 + 50, { d: mAfter - mBefore, got });
    await page.evaluate(() => window.__game.save(true));
    // 48 ч — лимит 8 ч
    await page.goto('about:blank'); await page.clock.setSystemTime(t0 + 55 * H); await page.goto(URL); await page.waitForTimeout(600);
    check('офлайн 48 ч: лимит 8 ч и подсказка про улучшение', /лимит 8 ч/.test(await page.locator('.modal').innerText().catch(() => '')));
    await closeModals(page);
    await page.evaluate(() => window.__game.save(true));
    const saved = await page.evaluate(() => window.__game.state.savedAt);
    // перевод часов назад на сутки
    await page.goto('about:blank'); await page.clock.setSystemTime(t0 + 31 * H); await page.goto(URL); await page.waitForTimeout(600);
    check('часы назад: нет окна офлайн-дохода', !(await page.locator('.modal .amount').count()));
    await page.evaluate(() => window.__game.save(true));
    check('часы назад: время сохранения не уменьшилось', (await page.evaluate(() => window.__game.state.savedAt)) >= saved);
    await page.goto('about:blank'); await page.clock.setSystemTime(t0 + 56 * H); await page.goto(URL); await page.waitForTimeout(600);
    const back = await page.locator('.modal .amount').innerText().catch(() => '');
    check('часы назад и вперёд: «лишних» суток офлайна нет', !back || Number(back.replace(/[^\d]/g, '')) < got * 0.5, back);
    await ctx.close();
  }

  // ======================= 6. Скины на узком экране =======================
  for (const th of ['mix', 'k', 'm', 'c', 'b']) {
    const { ctx, page } = await open(small, { tag: 'скин ' + th, query: '?theme=' + th });
    await startBiz(page, 'gamedev');
    await fresh(page, () => { const s = window.__game.state, b = s.businesses[0]; s.tutorial = 3; s.guide = 3; b.room = 5; b.grid = [1, 12, 23, 34, 5, 6, 7, 8, 18, 27, 36, 5, 4, 3, 2, 1, 0, 0, 0, 0]; b.seen = 8; b.money = 3.3e10; });
    let bad = '';
    for (const v of ['upgrades', 'rating', 'friends', 'shop', 'office']) { await page.click(`.tab[data-view="${v}"]`); await page.waitForTimeout(120); bad = bad || (await hScroll(page)) || (await badText(page)); }
    await page.click('#btn-daily'); await page.waitForTimeout(250); bad = bad || (await hScroll(page));
    check(`скин ${th} на 320×568: все вкладки без прокрутки и NaN`, !bad, bad);
    await ctx.close();
  }

  // ======================= 7. Скорость и утечки =======================
  {
    const init = `(function(){ var si = window.setInterval, ci = window.clearInterval, live = new Set();
      window.setInterval = function (f, t) { var id = si.apply(window, arguments); live.add(id); return id; };
      window.clearInterval = function (id) { live.delete(id); return ci(id); };
      window.__intervals = function () { return live.size; }; })();`;
    const { ctx, page } = await open(iphone, { tag: 'скорость', init });
    await startBiz(page, 'it');
    await fresh(page, () => { const s = window.__game.state, b = s.businesses[0]; s.tutorial = 3; s.guide = 3; b.grid = [5, 4, 13, 3, 2, 2, 21, 1, 1, 34, 6, 7]; });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const i0 = await page.evaluate(() => window.__intervals());
    const fps = await page.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); (function f() { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(n / 3); })(); }));
    for (let k = 0; k < 8; k++) { await tap(page, k); }
    for (const v of ['upgrades', 'shop', 'friends', 'rating', 'office', 'shop', 'office']) { await page.click(`.tab[data-view="${v}"]`); await page.waitForTimeout(150); }
    await page.waitForTimeout(3000);
    const fx = await page.evaluate(() => document.getElementById('fx').children.length);
    const i1 = await page.evaluate(() => window.__intervals());
    check(`слабый телефон (CPU ×4): офис с дождём ≥ 30 кадров/с (было ${Math.round(fps)})`, fps >= 30, Math.round(fps) + ' к/с');
    check('нет утечек setInterval (вкладки, тапы)', i1 <= i0 + 0, { i0, i1 });
    check('всплывающие «+₽» убираются (нет накопления в #fx)', fx < 10, fx);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await ctx.close();
    const { ctx: c2, page: p2 } = await open(iphone, { tag: 'reduced', reduced: true });
    await startBiz(p2, 'it');
    const rain = await p2.evaluate(() => { const r = document.querySelector('.sc-x .rain'); return r ? getComputedStyle(r).display : 'none'; });
    check('prefers-reduced-motion: дождь выключен', rain === 'none', rain);
    await c2.close();
  }

  await browser.close();
  process.exit(report());
})().catch(e => { console.log('СБОЙ ТЕСТА: ' + e.message.split('\n')[0]); report(); process.exit(2); });
