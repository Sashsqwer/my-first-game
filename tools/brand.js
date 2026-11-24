#!/usr/bin/env node
/* Аватарка и баннер Telegram-бота: картинки из нейросети (docs/brand/src, GPT Image 1.5 через GenAPI)
   + надписи и обрезка кодом. Запуск: node tools/brand.js
   → docs/brand/avatar-1..3.png (640×640), banner-1..2.png (640×360), sheet.png (сводный лист). */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const DIR = path.join(__dirname, '..', 'docs', 'brand');
const src = n => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(DIR, 'src', n + '.jpg')).toString('base64');
const FONT = "Inter, 'DejaVu Sans', Arial, sans-serif";
const GOLD = 'background:linear-gradient(180deg,#FFF1C4,#F3D27D 40%,#C9962F);-webkit-background-clip:text;color:transparent';
const page0 = (w, h, body) => `<html><body style="margin:0;width:${w}px;height:${h}px;overflow:hidden;background:#07090f;font-family:${FONT};position:relative">${body}</body></html>`;
// картинка-фон: масштаб s, сдвиг x,y (в пикселях результата)
const bg = (img, s, x, y) => `<img src="${img}" style="position:absolute;left:${x}px;top:${y}px;width:${s}px">`;
const vignette = '<div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,transparent 55%,rgba(5,7,12,.55) 75%)"></div>';

const AV1 = src('av1'), AV2 = src('av2'), B1 = src('b1');

const avatars = [
  // 1 — основатель в худи с кофе и ноутбуком (рамку нейросети обрезаем)
  bg(AV1, 640 * 1024 / 830, -95 * 640 / 830, -85 * 640 / 830) + vignette,
  // 2 — ларёк, который вырастает в неоновый небоскрёб с короной
  bg(AV2, 640 * 1024 / 960, -32 * 640 / 960, -10 * 640 / 960) + vignette,
  // 3 — крупный план основателя + неоновое кольцо
  bg(AV1, 640 * 1024 / 600, -230 * 640 / 600, -105 * 640 / 600) +
    '<div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,transparent 60%,rgba(5,7,12,.7) 72%)"></div>' +
    '<div style="position:absolute;inset:14px;border-radius:50%;border:6px solid #5CE1E6;box-shadow:0 0 22px #5CE1E6,inset 0 0 22px rgba(92,225,230,.6)"></div>'
];

const title = (size, align) => `
  <div style="font-size:${size}px;font-weight:900;line-height:.95;letter-spacing:-1.5px;color:#fff;text-align:${align};
    text-shadow:0 3px 14px rgba(0,0,0,.7)">Стартап<br><span style="${GOLD};text-shadow:none;filter:drop-shadow(0 3px 10px rgba(0,0,0,.7))">с нуля</span></div>`;
const sub = (size, align) => `<div style="margin-top:10px;font-size:${size}px;font-weight:700;color:#8af3ff;text-align:${align};
    text-shadow:0 0 12px rgba(92,225,230,.55),0 2px 6px #000">Построй бизнес с нуля</div>`;

const banners = [
  // 1 — надпись слева над небом, сотрудники справа
  bg(B1, 640, 0, -10) +
    '<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,9,15,.75),rgba(7,9,15,.25) 45%,transparent 65%)"></div>' +
    `<div style="position:absolute;left:28px;top:22px">${title(52, 'left')}${sub(18, 'left').replace('margin-top:10px', 'margin-top:6px')}</div>`,
  // 2 — надпись по центру сверху, сотрудники снизу
  bg(B1, 700, -42, -20) +
    '<div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,9,15,.85),rgba(7,9,15,.35) 42%,transparent 60%)"></div>' +
    `<div style="position:absolute;left:0;right:0;top:20px;display:flex;flex-direction:column;align-items:center">
      <div style="font-size:46px;font-weight:900;letter-spacing:-1px;color:#fff;text-shadow:0 3px 14px rgba(0,0,0,.7)">Стартап <span style="${GOLD}">с нуля</span></div>
      ${sub(17, 'center').replace('margin-top:10px', 'margin-top:4px')}</div>`
];

(async () => {
  const browser = await chromium.launch();
  const shot = async (w, h, html, file) => {
    const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await p.setContent(page0(w, h, html));
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(DIR, file) });
    await p.close();
  };
  for (let i = 0; i < avatars.length; i++) await shot(640, 640, avatars[i], `avatar-${i + 1}.png`);
  for (let i = 0; i < banners.length; i++) await shot(640, 360, banners[i], `banner-${i + 1}.png`);

  // сводный лист
  const f = n => 'data:image/png;base64,' + fs.readFileSync(path.join(DIR, n)).toString('base64');
  const avNames = ['1 · Основатель с кофе', '2 · Ларёк → небоскрёб', '3 · Крупный план'];
  const cell = (inner, cap) => `<div style="display:flex;flex-direction:column;align-items:center;gap:10px">${inner}<div style="color:#c9cfe2;font-size:20px;font-weight:600">${cap}</div></div>`;
  const sheet = `<div style="padding:34px 40px;color:#fff">
    <div style="font-size:34px;font-weight:800">Стартап с нуля — аватарка и баннер бота @startup_zero_bot</div>
    <div style="color:#8a93ad;font-size:19px;margin:6px 0 26px">Картинки: GPT Image 1.5 (GenAPI), надписи — кодом (tools/brand.js). Аватарка 640×640, баннер 640×360.</div>
    <div style="font-size:24px;font-weight:700;margin-bottom:14px">Аватарка — как в Telegram (круг) и исходник</div>
    <div style="display:flex;gap:40px">${[1, 2, 3].map(i => cell(`<div style="display:flex;gap:14px;align-items:center">
        <img src="${f(`avatar-${i}.png`)}" style="width:220px;height:220px;border-radius:50%">
        <div style="display:flex;flex-direction:column;gap:10px;align-items:center">
          <img src="${f(`avatar-${i}.png`)}" style="width:64px;height:64px;border-radius:50%">
          <img src="${f(`avatar-${i}.png`)}" style="width:40px;height:40px;border-radius:50%">
          <img src="${f(`avatar-${i}.png`)}" style="width:150px;height:150px;border-radius:10px;opacity:.9">
        </div></div>`, avNames[i - 1])).join('')}</div>
    <div style="font-size:24px;font-weight:700;margin:34px 0 14px">Баннер описания (BotFather → Edit Description Picture)</div>
    <div style="display:flex;gap:40px">${[1, 2].map(i => cell(`<img src="${f(`banner-${i}.png`)}" style="width:640px;height:360px;border-radius:14px">`,
      ['1 · Надпись слева', '2 · Надпись по центру'][i - 1])).join('')}</div>
  </div>`;
  const p = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
  await p.setContent(`<html><body style="margin:0;background:#0b0f1a;font-family:${FONT}">${sheet}</body></html>`);
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(DIR, 'sheet.png'), fullPage: true });
  await browser.close();
  console.log('ok → docs/brand/');
})();
