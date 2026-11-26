#!/usr/bin/env node
/* Пробные мультяшные основные стили A/B/C (?theme=ca|cb|cc): скриншоты iPhone 13 + коллаж docs/screens/cartoon-main-variants*.png.
   Две версии: с мультяшными картинками сотрудников (?preview_staff=1, нарезка tools/staff-preview.py) и с нынешними SVG.
   Плюс проверки: ошибки console, горизонтальная прокрутка на 320/390/430.
   Запуск: node tools/screens-cartoon.js            (только A/B/C: node tools/screens-cartoon.js ca) */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium, devices } = require('playwright');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'screens');
const TOUT = path.join(OUT, 'cartoon');
const URL = 'file://' + path.join(ROOT, 'app', 'index.html');
fs.mkdirSync(TOUT, { recursive: true });
const THEMES = process.argv[2] ? process.argv[2].split(',') : ['ca', 'cb', 'cc'];
const NAMES = { ca: 'A · Солнечный город', cb: 'B · Сочный офис', cc: 'C · Конфетный поп' };
const OFFICE = {
  it: [25, 4, 13, 3, 12, 2, 2, 31, 1, 1, 0, 0],
  coffee: [5, 14, 3, 23, 2, 2, 12, 1, 1, 34, 0, 0]
};

(async () => {
  const browser = await chromium.launch();
  const problems = [];
  async function newPage(device, query) {
    const ctx = await browser.newContext({ ...device });
    const page = await ctx.newPage();
    page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/telegram\.org/.test(m.text() + JSON.stringify(m.location()))) problems.push(`[${m.type()}] ${query}: ${m.text()}`); });
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
    if (w.sw > w.cw) problems.push(`[layout] горизонтальный скролл на «${label}»: ${w.sw} > ${w.cw}`);
    if (w.worst) problems.push(`[layout] вылезает за экран на «${label}»: ${w.worst}`);
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
  const iphone = devices['iPhone 13'];

  for (const th of THEMES) for (const pv of [1, 0]) {
    const q = '?theme=' + th + (pv ? '&preview_staff=1' : '');
    const tag = th + (pv ? '-pv' : '-svg');
    const { ctx, page } = await newPage(iphone, q);
    const ts = name => page.screenshot({ path: path.join(TOUT, tag + '-' + name + '.jpg'), type: 'jpeg', quality: 86 });
    await ts('0-choose');
    await noHScroll(page, tag + ' выбор');
    for (const [bz, grid] of Object.entries(OFFICE)) {
      await page.evaluate(([bz, grid]) => {
        const B = window.BALANCE, s = window.__game.state, now = Date.now();
        const b = B.newBusiness(bz, now, 0);
        b.grid = grid.slice(); b.seen = 6; b.money = 12480; b.hires = 34; b.needs = [now - 4.8 * 3600e3, now - 1.5 * 3600e3, now - 1 * 3600e3];
        s.businesses = [b]; s.active = 0; s.tutorial = 3; s.guide = 3; s.slots = { friends: 1, stars: 0, streak: false }; s.net.claimed = []; s.net.invited = 1;
        window.__game.setView('office');
        document.getElementById('choose').hidden = true; document.getElementById('app').hidden = false;
        window.__game.rebuild();
      }, [bz, grid]);
      await page.waitForTimeout(600);
      await ts('1-office-' + bz);
      await noHScroll(page, tag + ' офис ' + bz);
    }
    // слияние: снимок посреди эффекта (кофейня: два 1-го уровня)
    {
      const g = await page.evaluate(() => window.__game.state.businesses[0].grid);
      const i1 = g.indexOf(2), i2 = g.indexOf(2, i1 + 1);
      const a = await center(page, `.cell[data-i="${i1}"]`), b = await center(page, `.cell[data-i="${i2}"]`);
      await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(a.x + 10, a.y + 6, { steps: 3 }); await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up();
      await page.waitForTimeout(140);
      await ts('2-merge');
      await page.waitForTimeout(900);
      await closeModals(page);
    }
    await page.click('.tab[data-view="shop"]'); await page.waitForTimeout(450);
    await ts('3-agency');
    await noHScroll(page, tag + ' агентство');
    if (pv) {
      await page.evaluate(() => { window.__game.state.agency.freeAt = 0; window.__game.setView('shop'); });
      await page.click('[data-pack="free"]'); await page.waitForTimeout(2300);
      await ts('4-pack-open');
      await page.click('.modal [data-take]'); await page.waitForTimeout(300);
      await page.click('.tab[data-view="upgrades"]'); await page.waitForTimeout(400);
      await ts('5-upgrades');
      await page.click('.tab[data-view="office"]'); await page.waitForTimeout(300);
      await page.evaluate(() => { const d = new Date(Date.now() - 864e5); window.__game.state.daily = { last: d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(), streak: 3 }; });
      await page.click('#btn-daily'); await page.waitForTimeout(450);
      await ts('6-calendar');
      await closeModals(page, 3);
    }
    await ctx.close();
  }
  // узкие/широкие экраны
  for (const th of THEMES) for (const w of [320, 390, 430]) {
    const { ctx, page } = await newPage({ viewport: { width: w, height: w === 320 ? 568 : 760 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, '?theme=' + th + '&preview_staff=1');
    await noHScroll(page, `${th} выбор ${w}`);
    await page.click('.biz[data-type="delivery"]'); await page.waitForTimeout(250);
    await page.click('.modal [data-start]'); await page.waitForTimeout(300);
    await page.evaluate(() => { const s = window.__game.state, b = s.businesses[0]; s.tutorial = 3; s.guide = 3; b.room = 2; b.grid = [1, 2, 13, 4, 25, 6, 37, 8, 1, 12, 3, 4, 5, 26, 7, 0, 0, 0, 0, 0]; b.seen = 8; b.money = 2.5e7; window.__game.rebuild(); });
    for (const v of ['upgrades', 'rating', 'friends', 'shop', 'office']) { await page.click(`.tab[data-view="${v}"]`); await page.waitForTimeout(120); await noHScroll(page, `${th} ${v} ${w}`); }
    if (w === 320) await page.screenshot({ path: path.join(TOUT, th + '-pv-7-narrow-320.jpg'), type: 'jpeg', quality: 86 });
    await page.click('#btn-daily'); await page.waitForTimeout(300); await noHScroll(page, `${th} календарь ${w}`);
    await ctx.close();
  }
  // коллажи: строка на вариант (офис IT, кофейня, слияние, агентство)
  if (THEMES.length === 3) for (const pv of [1, 0]) {
    const ctx = await browser.newContext({ viewport: { width: 1340, height: 1200 }, deviceScaleFactor: 1.25 });
    const pg = await ctx.newPage();
    const img = n => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(TOUT, n + '.jpg')).toString('base64');
    const rows = THEMES.map(th => {
      const t = th + (pv ? '-pv' : '-svg');
      return `<div class="row"><div class="lab"><b>${NAMES[th].split(' · ')[0]}</b><span>${NAMES[th].split(' · ')[1]}</span></div>` +
        [['1-office-it', 'Офис IT'], ['1-office-coffee', 'Кофейня'], ['2-merge', 'Слияние'], ['3-agency', 'Агентство']].map(([n, c]) => `<figure><figcaption>${c}</figcaption><img src="${img(t + '-' + n)}"></figure>`).join('') + '</div>';
    }).join('');
    await pg.setContent(`<html><body style="margin:0;background:#14161f;font:700 20px -apple-system,Segoe UI,Roboto,sans-serif;color:#fff">
      <style>.row{display:grid;grid-template-columns:120px repeat(4,280px);gap:18px;padding:6px 20px 22px;align-items:start}figure{margin:0}figcaption{padding:6px 2px;text-align:center;font-size:17px;color:#c9cfdf}
      img{width:280px;border-radius:22px;display:block;box-shadow:0 8px 30px rgba(0,0,0,.6)}.lab{padding-top:40px}.lab b{display:block;font-size:64px;line-height:1}.lab span{display:block;font-size:18px;color:#c9cfdf;margin-top:6px}
      h1{font-size:26px;margin:0;padding:18px 20px 2px}h2{font-size:16px;color:#9aa3bb;margin:0;padding:2px 20px 10px;font-weight:600}</style>
      <h1>Новый основной стиль (мультяшный) — 3 варианта на выбор</h1><h2>${pv ? 'С мультяшными сотрудниками (картинки с пробного листа — только для превью)' : 'С нынешними сотрудниками, нарисованными кодом (SVG)'} · iPhone 13</h2>${rows}</body></html>`);
    await pg.waitForTimeout(400);
    const h = await pg.evaluate(() => document.body.scrollHeight);
    await pg.setViewportSize({ width: 1340, height: h });
    await pg.screenshot({ path: path.join(OUT, pv ? 'cartoon-main-variants.png' : 'cartoon-main-variants-svg.png') });
    await ctx.close();
  }
  await browser.close();
  console.log(problems.length ? 'ПРОБЛЕМЫ:\n' + problems.join('\n') : 'OK: ошибок console нет, горизонтального скролла нет');
  process.exit(problems.length ? 1 : 0);
})();
