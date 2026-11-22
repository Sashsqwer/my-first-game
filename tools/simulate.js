#!/usr/bin/env node
/* Прогон «разумного игрока» по формулам из app/balance.js — в реальном времени, с заходами в игру.
   Запуск: node tools/simulate.js [--days=45] [--sessions=9,13,18,22] [--len=10] [--taps=0.3] [--runs=20] [--seed=1]
           [--extra=0] [--balance=tools/balance-old.js] [--log]
   Игрок заходит в игру несколько раз в день (--sessions — часы заходов, --len — минут в каждом заходе).
   В заходе каждую секунду: забирает офлайн-доход, заботится о команде, включает аврал, открывает бесплатную пачку,
   забирает календарь и задания дня, переезжает, если может; объединяет пары (редких — с редкими); нанимает;
   покупает улучшения, которые окупаются примерно за час; тапает (--taps — тапов в секунду).
   Между заходами — офлайн-доход по формуле игры (лимит часов, усталость команды).
   --balance — другой файл баланса (например старый, tools/balance-old.js), чтобы сравнить «было/стало».
   --extra=N — сразу N дополнительных мест (за друзей, ⭐, серию в календаре), 0..6.
   --log — подробный журнал первого прогона. В конце — сводка по --runs прогонам с разными случайностями. */
'use strict';
const path = require('path');
const arg = (name, def) => { const a = process.argv.find(x => x.startsWith('--' + name + '=')); return a ? a.split('=')[1] : def; };
const B = require(path.resolve(arg('balance', path.join(__dirname, '../app/balance.js'))));

const DAYS = Number(arg('days', 45));
const SESSIONS = String(arg('sessions', '9,13,18,22')).split(',').map(Number);
const LEN_MIN = Number(arg('len', 10));
const TAP_RATE = Number(arg('taps', 0.3));
const SEED = Number(arg('seed', 1));
const RUNS = Number(arg('runs', 20));
const EXTRA = Number(arg('extra', 0));
const LOG = process.argv.includes('--log');
const H = 3600, DAY = 86400;

function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + ' млн' : n >= 1e4 ? (n / 1e3).toFixed(1) + ' тыс.' : Math.round(n).toLocaleString('ru-RU');
// время с начала игры: «45 с», «12 мин», «3 ч 10 мин», «2 дн 4 ч»
function when(s) {
  if (s == null) return '—';
  if (s < 60) return Math.round(s) + ' с';
  if (s < H) return Math.round(s / 60) + ' мин';
  if (s < DAY) { const h = Math.floor(s / H), m = Math.round(s % H / 60); return h + ' ч' + (m ? ' ' + m + ' мин' : ''); }
  const d = Math.floor(s / DAY), h = Math.round(s % DAY / H); return d + ' дн' + (h ? ' ' + h + ' ч' : '');
}
const RN = ['о', 'Р', 'Э', 'Л'];
const gridStr = g => g.map(v => v ? B.lvl(v) + (B.rar(v) ? RN[B.rar(v)] : '') : '·').join(' ');
const roomMult = i => (B.ROOMS[i] || B.ROOMS[0]).mult;

function run(seed, verbose) {
  const rnd = rng(seed);
  const biz = B.newBusiness('it', 0, EXTRA);
  const log = [];
  const res = { firstMerge: null, lvl: {}, room: {}, active: 0, rares: 0 };
  let now = 0, rushUntil = 0, rushReady = 0, freeAt = 0, lastTapAt = -99, day = -1, quests = [];
  const inc = () => B.incomePerSec(biz, now * 1000, now < rushUntil);
  const event = msg => { if (verbose) log.push(`${when(now).padStart(12)}  ${msg}  | деньги ${fmt(biz.money)}, доход ${fmt(inc() * H)}/ч`); };
  const give = r => { biz.money += r; biz.earned += r; };
  const quest = (id, n) => {
    for (const q of quests) if (q.id === id && !q.done) {
      q.have += n || 1;
      if (q.have >= q.need) { q.done = true; give(B.minutesIncome(biz, B.QUEST_REWARD_MIN, B.QUEST_REWARD_FLOOR, now * 1000)); }
    }
  };
  function mergeAll() {
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
          if (r.up) res.rares++;
          if (res.firstMerge === null) res.firstMerge = now;
          if (res.lvl[lvl + 1] == null) { res.lvl[lvl + 1] = now; res['lvlA' + (lvl + 1)] = res.active; event(`новый уровень сотрудника: ${lvl + 1}`); }
        }
      }
    }
  }
  function place() { while (biz.inbox.length && biz.grid.includes(0)) biz.grid[biz.grid.indexOf(0)] = biz.inbox.shift(); }
  function newDay() {
    day++;
    // календарь: 7 дней по кругу
    const c = B.CALENDAR[day % 7];
    if (c.type === 'money') give(B.minutesIncome(biz, c.minutes, c.min, now * 1000));
    else if (c.type === 'pack') biz.inbox.push(...B.rollPack(c.pack, rnd));
    // задания дня — три самых простых для разумного игрока
    quests = B.QUESTS.filter(q => ['merge', 'hire', 'care'].includes(q.id)).map(q => ({ id: q.id, need: q.need, have: 0, done: false }));
  }
  function second(sessionStart) {
    biz.money += inc(); biz.earned += inc();
    if (now - lastTapAt >= B.TAP_COOLDOWN && rnd() < TAP_RATE) {
      lastTapAt = now;
      const best = biz.grid.reduce((m, v) => B.cellIncome(v) > B.cellIncome(m) ? v : m, 0);
      give(B.cellIncome(best) * B.incomeMult(biz) * B.TAP_SECONDS * (now < rushUntil ? B.RUSH_MULT : 1));
    }
    if (now >= freeAt && now - sessionStart >= 30) { freeAt = now + B.PACKS.free.cooldownH * H; biz.inbox.push(...B.rollPack('free', rnd)); quest('pack'); }
    if (now >= rushReady && now - sessionStart >= 60) { rushUntil = now + B.RUSH_MIN * 60; rushReady = now + B.RUSH_COOLDOWN_H * H; }
    for (let i = 0; i < 3; i++) if (B.needLevel(biz, i, now * 1000) < 0.9 && B.canCare(biz, i, now * 1000)) { biz.needs[i] = now * 1000; quest('care'); }
    const next = B.ROOMS[biz.room + 1];
    if (next && B.maxLevel(biz) >= next.needLevel && biz.money >= next.needMoney) {
      biz.money = 0; biz.room++;
      const g = new Array(B.cellCount(biz.room, EXTRA)).fill(0);
      biz.grid.forEach((v, i) => { g[i] = v; });
      biz.grid = g;
      res.room[biz.room] = now; res['roomA' + biz.room] = res.active;
      event(`ПЕРЕЕЗД в помещение ${biz.room + 1} (×${next.mult}, клеток ${g.length})`);
    }
    place(); mergeAll();
    while (biz.grid.includes(0) && biz.money >= B.hireCost(biz)) {
      biz.money -= B.hireCost(biz); biz.grid[biz.grid.indexOf(0)] = 1; biz.hires++; quest('hire');
      mergeAll(); place();
    }
    // улучшения: если окупаются примерно за час (кресла — если стоят не больше 3 часов дохода)
    const perH = B.baseIncome(biz) * H;
    for (const id of ['boost', 'pr', 'chairs']) {
      const u = B.UPGRADES[id], lvl = biz.upgrades[id];
      if (lvl >= u.max) continue;
      const cost = B.upgradeCost(id, lvl);
      const limit = id === 'chairs' ? perH * 3 : perH;
      // накопление на переезд важнее: улучшение — только если после покупки переезд не отодвигается сильно
      if (cost <= biz.money && cost <= limit) { biz.money -= cost; biz.upgrades[id]++; }
    }
  }

  let lastLeave = 0;
  for (let d = 0; d < DAYS; d++) {
    for (const h of SESSIONS) {
      const start = d * DAY + (h - SESSIONS[0]) * H; // игра начата в час первого захода
      if (start < lastLeave) continue;
      if (lastLeave > 0) {
        const gap = start - lastLeave, t = Math.min(gap, B.offlineCapSec(biz));
        const g = B.offlineGain(biz, lastLeave * 1000, t, rushUntil * 1000).gain;
        give(g);
      }
      now = start;
      if (Math.floor(now / DAY) > day) newDay();
      for (let s = 0; s < LEN_MIN * 60; s++) { now = start + s; res.active++; second(start); }
      lastLeave = now;
      if (verbose && h === SESSIONS[SESSIONS.length - 1] && (d < 3 || d % 5 === 4)) event(`[конец дня ${d + 1}] наймов ${biz.hires}, помещение ${biz.room + 1}, улучшения ${biz.upgrades.boost}/${biz.upgrades.pr}/${biz.upgrades.chairs}, сетка ${gridStr(biz.grid)}`);
    }
  }
  res.log = log; res.biz = biz;
  return res;
}

const first = run(SEED, LOG);
console.log(`Симуляция ${DAYS} дн: заходы в ${SESSIONS.join(', ')} ч по ${LEN_MIN} мин, тапов ${TAP_RATE}/с, доп. мест ${EXTRA}, баланс ${path.basename(arg('balance', 'app/balance.js'))}`);
if (LOG) console.log('\n' + first.log.join('\n'));

const all = Array.from({ length: RUNS }, (_, k) => run(SEED + k + 1, false));
const med = arr => { const a = arr.filter(x => x != null).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };
const row = (name, key, akey) => {
  const a = all.map(key).filter(x => x != null).sort((x, y) => x - y);
  if (!a.length) return console.log(`  ${name.padEnd(30)} не дошли за ${DAYS} дн`);
  const act = akey ? med(all.map(akey)) : null;
  console.log(`  ${name.padEnd(30)} ${when(med(a)).padEnd(14)} (${when(a[0])} … ${when(a[a.length - 1])}, дошли ${a.length}/${RUNS})` + (act != null ? `  · в игре ${when(act)}` : ''));
};
console.log(`\nСводка по ${RUNS} прогонам (медиана; в скобках — разброс; «в игре» — сколько из этого времени игрок был в игре):`);
row('первое слияние', r => r.firstMerge);
for (let l = 3; l <= B.MAX_LEVEL; l++) row(`${l}-й уровень сотрудника` + (l === B.HOLDING_UNLOCK_LEVEL ? ' (2-й бизнес)' : ''), r => r.lvl[l], r => r['lvlA' + l]);
for (let i = 1; i < B.ROOMS.length; i++) row(`помещение ${i + 1} (×${roomMult(i)})`, r => r.room[i], r => r['roomA' + i]);
console.log('  доход в конце (медиана):         ', fmt(med(all.map(r => B.baseIncome(r.biz) * H))) + ' ₽/ч');
console.log('  повышений редкости при слиянии (медиана):', med(all.map(r => r.rares)));
