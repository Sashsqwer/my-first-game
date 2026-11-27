#!/usr/bin/env node
/* ВРЕМЕННО — выбор варианта «Коллекции» (владелец): скриншоты вариантов collection / collection2 / collection3 рядом с основным
   «Сочным офисом» (все — с пробными картинками сотрудников ?preview_staff=1) + коллаж docs/screens/collection-variants.png.
   Проверяет: ошибки console, горизонтальный скролл на 320 / 390 / 430.
   Запуск: node tools/collection-variants.js [main,collection,collection2,collection3] [папка для jpg] [--no-collage] */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium, devices } = require('playwright');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'screens');
const URL = 'file://' + path.join(ROOT, 'app', 'index.html');
const HAS_NET = fs.existsSync(path.join(ROOT, 'app', 'net.js'));
const THEMES = (process.argv[2] || 'main,collection,collection2,collection3').split(',');
const DIR = process.argv[3] && !process.argv[3].startsWith('--') ? path.resolve(process.argv[3]) : path.join(OUT, 'collection-variants');
const COLLAGE = !process.argv.includes('--no-collage');
fs.mkdirSync(DIR, { recursive: true });

const OFFICE = {
  it: [25, 4, 13, 3, 12, 2, 2, 31, 1, 1, 0, 0],
  coffee: [5, 14, 3, 23, 2, 2, 12, 1, 1, 34, 0, 0],
  barber: [26, 5, 4, 14, 3, 3, 2, 22, 1, 1, 11, 0],
  gamedev: [7, 16, 5, 24, 3, 3, 2, 32, 1, 1, 0, 0],
  delivery: [8, 15, 4, 23, 3, 2, 2, 13, 1, 1, 0, 0]
};
const NAMES = { main: 'Основной «Сочный офис»', collection: '1. «Бутик игрушек»', collection2: '2. «Блайнд-бокс студия»', collection3: '3. «Капсульный автомат»' };

(async () => {
  const browser = await chromium.launch();
  const problems = [];
  async function newPage(device, query) {
    const ctx = await browser.newContext({ ...device });
    const page = await ctx.newPage();
    page.on('console', m => {
      if (m.type() !== 'error' && m.type() !== 'warning') return;
      if (!HAS_NET && /ERR_FILE_NOT_FOUND|net\.js/.test(m.text() + JSON.stringify(m.location()))) return;
      if (/telegram\.org/.test(m.text() + JSON.stringify(m.location()))) return;
      problems.push(`[${m.type()}] ${query}: ${m.text()}`);
    });
    page.on('pageerror', e => problems.push('[pageerror] ' + query + ': ' + e.message));
    await page.goto(URL + query);
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
    if (w.sw > w.cw) problems.push(`[layout] горизонтальный скролл «${label}»: ${w.sw} > ${w.cw}`);
    if (w.worst) problems.push(`[layout] вылезает за экран «${label}»: ${w.worst}`);
  }
  async function center(page, sel) {
    const b = await page.locator(sel).first().boundingBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }
  async function closeModals(page, n = 4) {
    for (let k = 0; k < n; k++) {
      const btn = page.locator('.modal:not([hidden]) .btns .btn').first();
      if (!(await btn.count())) break;
      await page.waitForTimeout(150);
      await btn.click(); await page.waitForTimeout(250);
    }
  }
  async function office(pt, bz) {
    await pt.evaluate(([bz, grid]) => {
      const B = window.BALANCE, s = window.__game.state, now = Date.now();
      const b = B.newBusiness(bz, now, 0);
      b.grid = grid.slice(); b.seen = 6; b.money = 12480; b.hires = 34; b.needs = [now - 4.8 * 3600e3, now - 1.5 * 3600e3, now - 1 * 3600e3];
      s.businesses = [b]; s.active = 0; s.tutorial = 3; s.guide = 3; s.slots = { friends: bz === 'it' ? 1 : 0, stars: 0, streak: false }; s.net.claimed = []; s.net.invited = 1;
      window.__game.setView('office');
      document.getElementById('choose').hidden = true; document.getElementById('app').hidden = false; window.__game.rebuild();
    }, [bz, OFFICE[bz]]);
    await pt.waitForTimeout(500);
  }

  for (const th of THEMES) {
    const q = '?theme=' + th + '&preview_staff=1';
    const { ctx, page: pt } = await newPage(devices['iPhone 13'], q);
    // сохраняем только кадры для коллажа (остальные экраны — только проверка), в размере CSS-пикселей — меньше вес
    const KEEP = ['1-office-it', '1-office-coffee', '2-merge', '3-agency', '4-skins'];
    const ts = name => KEEP.includes(name) ? pt.screenshot({ path: path.join(DIR, th + '-' + name + '.jpg'), type: 'jpeg', quality: 84, scale: 'css' }) : null;
    await noHScroll(pt, th + ' выбор');
    await ts('0-choose');
    for (const bz of Object.keys(OFFICE)) {
      await office(pt, bz);
      await noHScroll(pt, th + ' офис ' + bz);
      await ts('1-office-' + bz);
    }
    await office(pt, 'barber');
    const g = await pt.evaluate(() => window.__game.state.businesses[0].grid);
    const i1 = g.indexOf(1), i2 = g.indexOf(1, i1 + 1);
    const a = await center(pt, `.cell[data-i="${i1}"]`), b = await center(pt, `.cell[data-i="${i2}"]`);
    await pt.mouse.move(a.x, a.y); await pt.mouse.down(); await pt.mouse.move(a.x + 10, a.y + 6, { steps: 3 }); await pt.mouse.move(b.x, b.y, { steps: 6 }); await pt.mouse.up();
    await pt.waitForTimeout(140);
    await ts('2-merge');
    await pt.waitForTimeout(900);
    await closeModals(pt);
    await office(pt, 'it');
    await pt.click('.tab[data-view="shop"]'); await pt.waitForTimeout(400);
    await noHScroll(pt, th + ' агентство');
    await ts('3-agency');
    await pt.click('.tab[data-view="upgrades"]'); await pt.waitForTimeout(300);
    await ts('5-upgrades');
    await pt.click('.tab[data-view="office"]'); await pt.waitForTimeout(300);
    await pt.evaluate(() => { window.__game.state.net.counted = 1; });
    await pt.click('#btn-settings'); await pt.waitForTimeout(350);
    await pt.click('.modal [data-skins]'); await pt.waitForTimeout(400);
    await noHScroll(pt, th + ' стили');
    await ts('4-skins');
    await closeModals(pt);
    await ctx.close();
    // узкий и широкий экран
    for (const vp of [{ width: 320, height: 568 }, { width: 430, height: 932 }]) {
      const { ctx: c2, page: p2 } = await newPage({ viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, q);
      await office(p2, 'coffee');
      await noHScroll(p2, th + ' офис ' + vp.width);
      await p2.click('.tab[data-view="shop"]'); await p2.waitForTimeout(300);
      await noHScroll(p2, th + ' агентство ' + vp.width);
      await p2.click('.tab[data-view="office"]'); await p2.waitForTimeout(200);
      await p2.click('#btn-settings'); await p2.waitForTimeout(300);
      await p2.click('.modal [data-skins]'); await p2.waitForTimeout(300);
      await noHScroll(p2, th + ' стили ' + vp.width);
      await c2.close();
    }
  }

  if (COLLAGE) {
    const ctx = await browser.newContext({ viewport: { width: 1660, height: 1200 }, deviceScaleFactor: 1.25 });
    const pg = await ctx.newPage();
    const img = n => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(DIR, n + '.jpg')).toString('base64');
    const cols = [['1-office-it', 'Офис IT'], ['1-office-coffee', 'Кофейня'], ['2-merge', 'Слияние (барбершоп)'], ['3-agency', 'Агентство'], ['4-skins', 'Экран «Стили»']];
    const rows = ['main', 'collection', 'collection2', 'collection3'].map(th =>
      `<h2>${NAMES[th]}${th === 'main' ? ' — бесплатный, для сравнения' : th === 'collection' ? ' — ?theme=collection (сейчас выбран)' : ' — ?theme=' + th}</h2><div class="r">` +
      cols.map(([n, c]) => `<figure><figcaption>${c}</figcaption><img src="${img(th + '-' + n)}"></figure>`).join('') + '</div>').join('');
    await pg.setContent(`<html><body style="margin:0;background:#0b0c12;font:700 22px -apple-system,Segoe UI,Roboto,sans-serif;color:#fff">
      <style>.r{display:grid;grid-template-columns:repeat(5,300px);gap:20px;padding:0 20px 22px}figure{margin:0}figcaption{padding:6px 2px;text-align:center;font-size:17px;color:#cfd5e6}img{width:300px;border-radius:22px;display:block;box-shadow:0 8px 30px rgba(0,0,0,.6)}
      h1{font-size:28px;margin:0;padding:20px 20px 4px}h2{font-size:21px;margin:0;padding:10px 20px 2px}p{font-size:16px;color:#9aa3bb;margin:0;padding:0 20px 8px;font-weight:600}</style>
      <h1>«Коллекция» (⭐ 150) — 3 варианта на выбор</h1><p>Сотрудники — пробные картинки с листов (основной — мультяшные, «Коллекция» — 3D-фигурки). Посмотреть вживую: ?theme=collection | collection2 | collection3 &amp;preview_staff=1</p>${rows}</body></html>`);
    await pg.waitForTimeout(500);
    const h = await pg.evaluate(() => document.body.scrollHeight);
    await pg.setViewportSize({ width: 1660, height: h });
    await pg.screenshot({ path: path.join(OUT, 'collection-variants.png') });
    await ctx.close();
  }
  await browser.close();
  console.log(problems.length ? 'ПРОБЛЕМЫ:\n' + problems.join('\n') : 'OK: ошибок console нет, горизонтального скролла нет (320 / 390 / 430)');
  process.exit(problems.length ? 1 : 0);
})();
