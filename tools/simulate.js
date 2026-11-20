#!/usr/bin/env node
/* Прогон «разумного игрока» по формулам из app/balance.js.
   Запуск: node tools/simulate.js [минут=40] [--taps=0.3]
   Игрок каждую секунду: переезжает, если может; объединяет пары; нанимает, если есть место и деньги;
   покупает улучшение, если оно окупается за ~1 минуту дохода; иногда тапает по лучшему сотруднику. */
'use strict';
const B = require('../app/balance.js');

const minutes = Number(process.argv.find(a => /^\d+$/.test(a)) || 40);
const tapArg = process.argv.find(a => a.startsWith('--taps='));
const TAP_RATE = tapArg ? Number(tapArg.split('=')[1]) : 0.3; // доля возможных тапов, которые игрок делает

const biz = B.newBusiness('it');
const log = [];
const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + ' млн' : Math.round(n).toLocaleString('ru-RU');
const ts = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const event = (t, msg) => log.push(`${ts(t)}  ${msg}  | деньги ${fmt(biz.money)}, доход ${fmt(B.incomePerSec(biz))}/с`);

let firstMerge = null, seenMax = 1, lastTapAt = -99;
let dailyTaken = false;

function mergeAll(t) {
  let merged = true;
  while (merged) {
    merged = false;
    for (let lvl = 1; lvl < B.MAX_LEVEL && !merged; lvl++) {
      const idx = [];
      biz.grid.forEach((v, i) => { if (v === lvl) idx.push(i); });
      if (idx.length >= 2) {
        biz.grid[idx[0]] = 0; biz.grid[idx[1]] = lvl + 1; biz.merges++; merged = true;
        if (firstMerge === null) { firstMerge = t; event(t, 'первое слияние'); }
        if (lvl + 1 > seenMax) { seenMax = lvl + 1; event(t, `новый уровень сотрудника: ${seenMax}`); }
      }
    }
  }
}

for (let t = 0; t <= minutes * 60; t++) {
  // доход за секунду
  const inc = B.incomePerSec(biz);
  biz.money += inc;
  // тапы: лучший сотрудник раз в 3 сек, игрок делает долю TAP_RATE
  if (t - lastTapAt >= B.TAP_COOLDOWN && Math.random() < TAP_RATE) {
    lastTapAt = t;
    biz.money += B.levelIncome(B.maxLevel(biz)) * B.incomeMult(biz) * B.TAP_SECONDS;
  }
  if (!dailyTaken && t === 60) { dailyTaken = true; const r = B.dailyReward(biz, 1); biz.money += r; event(t, `бонус дня +${fmt(r)}`); }

  // переезд
  const next = B.ROOMS[biz.room + 1];
  if (next && B.maxLevel(biz) >= next.needLevel && biz.money >= next.needMoney) {
    biz.money = 0; biz.room++;
    const g = new Array(B.COLS * next.rows).fill(0);
    biz.grid.forEach((v, i) => { g[i] = v; });
    biz.grid = g;
    event(t, `ПЕРЕЕЗД в помещение ${biz.room + 1} (×${next.mult}, клеток ${g.length})`);
  }

  mergeAll(t);
  // найм
  let hired = 0;
  while (biz.grid.includes(0) && biz.money >= B.hireCost(biz)) {
    biz.money -= B.hireCost(biz); biz.grid[biz.grid.indexOf(0)] = 1; biz.hires++; hired++;
    if (biz.hires === 1) event(t, 'первый найм');
    mergeAll(t);
  }
  // улучшения: окупается быстро и не мешает копить на переезд слишком сильно
  for (const id of ['boost', 'pr', 'chairs']) {
    const u = B.UPGRADES[id], lvl = biz.upgrades[id];
    if (lvl >= u.max) continue;
    const cost = B.upgradeCost(id, lvl);
    const limit = id === 'chairs' ? inc * 600 : inc * 60;
    if (cost <= biz.money && cost <= limit) { biz.money -= cost; biz.upgrades[id]++; event(t, `улучшение ${id} → ${biz.upgrades[id]}`); }
  }
  if (t > 0 && t % 300 === 0) event(t, `[срез] наймов ${biz.hires}, слияний ${biz.merges}, сетка ${biz.grid.join('')}, цена найма ${fmt(B.hireCost(biz))}`);
}

console.log(`Симуляция ${minutes} мин, доля тапов ${TAP_RATE}\n`);
console.log(log.join('\n'));
console.log(`\nПервое слияние: ${firstMerge}с. Помещение в конце: ${biz.room + 1}.`);
