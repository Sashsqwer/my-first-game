#!/usr/bin/env node
/* Прогон «разумного игрока» по формулам из app/balance.js.
   Запуск: node tools/simulate.js [минут=40] [--taps=0.3] [--seed=1] [--runs=30]
   Игрок каждую секунду: переезжает, если может; объединяет пары (редких — с редкими); сажает сотрудников
   из приёмной; нанимает; покупает улучшения, которые окупаются за ~1 минуту; иногда тапает.
   Новое в v2: редкость (×1.5/×2.5/×5, шанс повышения при слиянии), бесплатная пачка резюме сразу после
   обучения, календарь (день 1 — деньги), задания дня, аврал ×2 на 5 минут, потребности (падают со временем,
   игрок восстанавливает, когда можно и шкала ниже 90%).
   Первый прогон печатается подробно, дальше — сводка по --runs прогонам с разными случайностями. */
'use strict';
const B = require('../app/balance.js');

const minutes = Number(process.argv.find(a => /^\d+$/.test(a)) || 40);
const arg = (name, def) => { const a = process.argv.find(x => x.startsWith('--' + name + '=')); return a ? Number(a.split('=')[1]) : def; };
const TAP_RATE = arg('taps', 0.3);
const SEED = arg('seed', 1);
const RUNS = arg('runs', 30);
const NO_EXTRAS = process.argv.includes('--plain'); // без пачек, аврала, заданий — как в этапе 1

function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + ' млн' : Math.round(n).toLocaleString('ru-RU');
const ts = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const RN = ['о', 'Р', 'Э', 'Л'];
const gridStr = g => g.map(v => v ? B.lvl(v) + (B.rar(v) ? RN[B.rar(v)] : '') : '·').join(' ');

function run(seed, verbose) {
  const rnd = rng(seed);
  const biz = B.newBusiness('it', 0);
  const log = [];
  const res = { firstMerge: null, lvl: {}, room2: null, room3: null, rares: 0 };
  let now = 0, rushUntil = 0, lastTapAt = -99;
  const quests = B.QUESTS.filter(q => ['merge', 'hire', 'care'].includes(q.id)).map(q => ({ id: q.id, need: q.need, have: 0, done: false }));
  const inc = () => B.incomePerSec(biz, now, now < rushUntil);
  const event = (t, msg) => { if (verbose) log.push(`${ts(t)}  ${msg}  | деньги ${fmt(biz.money)}, доход ${fmt(inc())}/с`); };
  const quest = (id, n) => {
    if (NO_EXTRAS) return;
    for (const q of quests) if (q.id === id && !q.done) {
      q.have += n || 1;
      if (q.have >= q.need) { q.done = true; const r = B.minutesIncome(biz, B.QUEST_REWARD_MIN, B.QUEST_REWARD_FLOOR, now); biz.money += r; event(Math.floor(now / 1000), `задание «${id}» +${fmt(r)}`); }
    }
  };
  function mergeAll(t) {
    let merged = true;
    while (merged) {
      merged = false;
      for (let lvl = 1; lvl < B.MAX_LEVEL && !merged; lvl++) {
        const idx = [];
        biz.grid.forEach((v, i) => { if (v && B.lvl(v) === lvl) idx.push(i); });
        if (idx.length >= 2) {
          idx.sort((a, b) => B.rar(biz.grid[b]) - B.rar(biz.grid[a])); // лучших — вместе
          const r = B.mergeResult(biz.grid[idx[0]], biz.grid[idx[1]], rnd());
          biz.grid[idx[1]] = 0; biz.grid[idx[0]] = r.v; biz.merges++; merged = true; quest('merge');
          if (r.up) { res.rares++; event(t, `слияние повысило редкость → ${RN[B.rar(r.v)]}`); }
          if (res.firstMerge === null) { res.firstMerge = t; event(t, 'первое слияние'); }
          if (res.lvl[lvl + 1] == null) { res.lvl[lvl + 1] = t; event(t, `новый уровень сотрудника: ${lvl + 1}`); }
        }
      }
    }
  }
  function place() {
    while (biz.inbox.length && biz.grid.includes(0)) biz.grid[biz.grid.indexOf(0)] = biz.inbox.shift();
  }

  for (let t = 0; t <= minutes * 60; t++) {
    now = t * 1000;
    biz.money += inc(); biz.earned += inc();
    if (t - lastTapAt >= B.TAP_COOLDOWN && rnd() < TAP_RATE) {
      lastTapAt = t;
      const best = biz.grid.reduce((m, v) => B.cellIncome(v) > B.cellIncome(m) ? v : m, 0);
      biz.money += B.cellIncome(best) * B.incomeMult(biz) * B.TAP_SECONDS;
    }
    if (!NO_EXTRAS) {
      if (t === 40) { biz.inbox.push(...B.rollPack('free', rnd)); event(t, `бесплатная пачка: ${biz.inbox.map(v => B.lvl(v) + RN[B.rar(v)]).join(' ')}`); quest('pack'); }
      if (t === 60) { const r = B.minutesIncome(biz, B.CALENDAR[0].minutes, B.CALENDAR[0].min, now); biz.money += r; event(t, `календарь, день 1: +${fmt(r)}`); }
      if (t === 90) { rushUntil = now + B.RUSH_MIN * 60000; event(t, `аврал ×${B.RUSH_MULT} на ${B.RUSH_MIN} мин`); }
      for (let i = 0; i < 3; i++) if (B.needLevel(biz, i, now) < 0.9 && B.canCare(biz, i, now)) { biz.needs[i] = now; quest('care'); }
    }
    const next = B.ROOMS[biz.room + 1];
    if (next && B.maxLevel(biz) >= next.needLevel && biz.money >= next.needMoney) {
      biz.money = 0; biz.room++;
      const g = new Array(B.COLS * next.rows).fill(0);
      biz.grid.forEach((v, i) => { g[i] = v; });
      biz.grid = g;
      res['room' + (biz.room + 1)] = t;
      event(t, `ПЕРЕЕЗД в помещение ${biz.room + 1} (×${next.mult}, клеток ${g.length})`);
    }
    place(); mergeAll(t);
    while (biz.grid.includes(0) && biz.money >= B.hireCost(biz)) {
      biz.money -= B.hireCost(biz); biz.grid[biz.grid.indexOf(0)] = 1; biz.hires++; quest('hire');
      if (biz.hires === 1) event(t, 'первый найм');
      mergeAll(t); place();
    }
    for (const id of ['boost', 'pr', 'chairs']) {
      const u = B.UPGRADES[id], lvl = biz.upgrades[id];
      if (lvl >= u.max) continue;
      const cost = B.upgradeCost(id, lvl);
      const limit = id === 'chairs' ? inc() * 600 : inc() * 60;
      if (cost <= biz.money && cost <= limit) { biz.money -= cost; biz.upgrades[id]++; event(t, `улучшение ${id} → ${biz.upgrades[id]}`); }
    }
    if (verbose && t > 0 && t % 300 === 0) event(t, `[срез] наймов ${biz.hires}, слияний ${biz.merges}, сетка ${gridStr(biz.grid)}`);
  }
  res.log = log; res.biz = biz;
  return res;
}

const first = run(SEED, true);
console.log(`Симуляция ${minutes} мин, доля тапов ${TAP_RATE}${NO_EXTRAS ? ', БЕЗ пачек/аврала/заданий' : ''}, seed ${SEED}\n`);
console.log(first.log.join('\n'));
console.log(`\nПервое слияние: ${first.firstMerge}с. Помещение в конце: ${first.biz.room + 1}.`);

const all = Array.from({ length: RUNS }, (_, k) => run(SEED + k + 1, false));
const med = arr => { const a = arr.filter(x => x != null).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };
const span = key => { const a = all.map(r => key(r)).filter(x => x != null).sort((x, y) => x - y); return a.length ? `${ts(a[0])} … ${ts(a[a.length - 1])} (медиана ${ts(med(a))}, дошли ${a.length}/${RUNS})` : 'не дошли'; };
console.log(`\nСводка по ${RUNS} прогонам:`);
console.log('  первое слияние   ', span(r => r.firstMerge));
for (const l of [3, 5, 6, 7]) console.log(`  ${l}-й уровень       `, span(r => r.lvl[l]));
console.log('  2-е помещение    ', span(r => r.room2));
console.log('  3-е помещение    ', span(r => r.room3));
console.log('  повышений редкости при слиянии (медиана):', med(all.map(r => r.rares)));
