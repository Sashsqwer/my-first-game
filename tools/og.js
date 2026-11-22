#!/usr/bin/env node
/* Обложка для ссылок (og:image 1200×630) и иконки (180 и 512 px) — рисуются кодом, без нейросетей.
   Запуск: node tools/og.js → app/img/og.png, app/img/icon-180.png, app/img/icon-512.png
   Сотрудники — те же SVG, что в игре (app/avatars.js), цвета — основного стиля. */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const IMG = path.join(ROOT, 'app', 'img');
fs.mkdirSync(IMG, { recursive: true });
const URL = 'file://' + path.join(ROOT, 'app', 'index.html') + '?theme=mix';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(URL);
  await page.waitForTimeout(300);
  // берём SVG сотрудников из игры
  const avs = await page.evaluate(() => {
    const A = window.GameAvatars;
    return {
      row: [['it', 4, 1], ['burger', 6, 2], ['barber', 8, 3], ['gamedev', 5, 1]].map(([b, l, r]) => A.uri(b, l, r)),
      icon: A.uri('coffee', 8, 3)
    };
  });
  const city = (() => {
    let x = 0, out = '', s = 7;
    const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    while (x < 1200) {
      const w = 30 + r() * 60, h = 60 + r() * 200;
      out += `<rect x="${x}" y="${330 - h}" width="${w + 1}" height="${h}" fill="#141b36"/>`;
      for (let wy = 340 - h; wy < 320; wy += 16) for (let wx = x + 6; wx < x + w - 8; wx += 12) if (r() < 0.4) out += `<rect x="${wx}" y="${wy}" width="5" height="7" fill="#ffd79a" opacity=".45"/>`;
      x += w + r() * 6;
    }
    return out;
  })();
  const font = "Inter, 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif";
  await page.setContent(`<html><body style="margin:0;width:1200px;height:630px;overflow:hidden;background:#07090f;font-family:${font}">
    <div style="position:absolute;inset:0;background:radial-gradient(ellipse 70% 60% at 70% 10%,rgba(255,77,166,.28),transparent 70%),radial-gradient(ellipse 60% 60% at 10% 90%,rgba(34,184,224,.25),transparent 70%)"></div>
    <svg style="position:absolute;left:0;bottom:120px" width="1200" height="330">${city}</svg>
    <div style="position:absolute;left:0;right:0;bottom:0;height:150px;background:linear-gradient(180deg,#0e1222,#05070c)"></div>
    <div style="position:absolute;left:70px;top:64px;color:#fff">
      <div style="font-size:30px;font-weight:700;color:#8af3ff;letter-spacing:.5px">Игра в Telegram</div>
      <div style="font-size:96px;font-weight:900;line-height:1;margin-top:10px;letter-spacing:-2px">Стартап<br><span style="background:linear-gradient(180deg,#FFF1C4,#F3D27D 40%,#C9962F);-webkit-background-clip:text;color:transparent">с нуля</span></div>
      <div style="font-size:32px;color:#c9cfe2;margin-top:22px;max-width:520px;line-height:1.25;text-shadow:0 2px 8px #000">Нанимай, объединяй одинаковых и вырасти из ларька до империи</div>
    </div>
    <div style="position:absolute;right:36px;bottom:58px;display:flex;align-items:flex-end;gap:0">
      ${avs.row.map((u, i) => `<img src="${u}" style="height:${[160, 195, 255, 175][i]}px;filter:drop-shadow(0 10px 18px rgba(0,0,0,.6))">`).join('')}
    </div>
    <div style="position:absolute;left:70px;bottom:44px;display:flex;gap:14px">
      <span style="padding:14px 28px;border-radius:18px;font-size:30px;font-weight:800;color:#fff;background:linear-gradient(180deg,#ff9a6a,#FF4DA6 55%,#c8167f);box-shadow:0 5px 0 #6a0a44">▶ Играть</span>
      <span style="padding:14px 22px;border-radius:18px;font-size:28px;font-weight:700;color:#06212a;background:linear-gradient(180deg,#8af3ff,#22b8e0)">8 бизнесов</span>
    </div>
  </body></html>`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(IMG, 'og.png') });

  // иконка: тёмный квадрат, сотрудник-легенда и золотая рамка
  for (const size of [180, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;width:${size}px;height:${size}px;overflow:hidden;background:#07090f">
      <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 30%,rgba(243,210,125,.45),transparent 65%),linear-gradient(180deg,#151b33,#07090f)"></div>
      <img src="${avs.icon}" style="position:absolute;left:50%;bottom:${size * 0.04}px;height:${size * 0.9}px;transform:translateX(-50%)">
    </body></html>`);
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(IMG, `icon-${size}.png`) });
  }
  await browser.close();
  console.log('OK: app/img/og.png, icon-180.png, icon-512.png');
})();
