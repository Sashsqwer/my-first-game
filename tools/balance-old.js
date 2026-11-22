/* Баланс и формулы «Стартап с нуля». Общий файл: его подключает игра (app/index.html)
   и симуляция (tools/simulate.js). Меняешь цифры здесь — меняется и игра, и прогон.

   Клетка сетки хранится одним числом: уровень + 10 × редкость.
   0 — пусто, 3 — обычный 3-го уровня, 13 — редкий 3-го, 25 — эпический 5-го, 38 — легендарный 8-го. */
(function (root) {
  'use strict';

  var B = {
    START_MONEY: 110,         // деньги на старте — хватает на 2 найма (обучение)
    HIRE_BASE: 50,            // цена первого найма
    HIRE_GROWTH: 1.07,        // ×1.07 за каждый найм
    INCOME_BASE: 1,           // ₽/сек у сотрудника 1 уровня
    INCOME_GROWTH: 2.2,       // ×2.2 за уровень
    MAX_LEVEL: 8,
    COLS: 4,
    TAP_SECONDS: 2,           // тап = 2 секунды дохода сотрудника
    TAP_COOLDOWN: 3,          // кулдаун тапа, сек
    OFFLINE_MIN_SEC: 60,      // меньше минуты — окно не показываем
    OFFLINE_CAP_HOURS: [8, 12, 24], // по уровню «Удобных кресел»
    HOLDING_UNLOCK_LEVEL: 5,  // задел под вариант 05: 2-й бизнес на 5-м уровне сотрудника

    // Помещения (общие числа для всех бизнесов, названия — в game.js)
    ROOMS: [
      { rows: 3, mult: 1,  needLevel: 0, needMoney: 0 },
      { rows: 4, mult: 3,  needLevel: 5, needMoney: 30000 },
      { rows: 5, mult: 10, needLevel: 7, needMoney: 1800000 }
    ],

    // Дополнительные места в помещении (сверх 4×N): общие для всех бизнесов игрока
    SLOT_FRIENDS: [1, 3, 10],  // +1 место за 1, за 3 и за 10 засчитанных друзей (до +3)
    SLOT_STARS: [50, 100],     // +1 место за ⭐ 50 и ещё +1 за ⭐ 100 (оплата — позже, пока «скоро»)
    SLOT_STREAK_DAYS: 7,       // +1 место за 7 дней подряд в календаре наград
    SLOT_MAX: 6,

    // Улучшения
    UPGRADES: {
      boost:  { base: 150,  growth: 2.2, max: 25 },  // +10% дохода за уровень
      chairs: { base: 2000, growth: 12,  max: 2 },   // офлайн 8 → 12 → 24 ч
      pr:     { base: 300,  growth: 2.6, max: 10 }   // найм −5% за уровень
    },

    // ---------- Редкость ----------
    // 0 обычный, 1 редкий, 2 эпический, 3 легендарный
    RARITY_MULT: [1, 1.5, 2.5, 5],
    // Слияние двух ОДИНАКОВЫХ по редкости: шанс, что результат станет на ступень выше.
    // Разные редкости → результат = лучшая из двух (без шанса).
    MERGE_UP_CHANCE: [0.03, 0.10, 0.05, 0],

    // ---------- Кадровое агентство: пачки резюме ----------
    // chances — шансы редкостей в % (обычный, редкий, эпический, легендарный), lvl — [мин, макс] уровень
    PACKS: {
      free:     { count: 2, lvl: [1, 1], chances: [80, 17, 3, 0], cooldownH: 8 },
      standard: { count: 3, lvl: [1, 2], chances: [70, 24, 5, 1], priceHires: 8 }, // цена = 8 наймов
      premium:  { count: 4, lvl: [2, 3], chances: [0, 70, 25, 5], stars: 49 },
      star:     { count: 5, lvl: [3, 3], chances: [0, 0, 80, 20], stars: 149 }
    },
    SHARDS_FOR_RARE: 5,       // 5 осколков резюме → редкий сотрудник

    // ---------- Забота о сотрудниках ----------
    // Три потребности: бодрость (☕), еда (🍕), отдых (😴). Шкала 100% → 0% за DECAY_H часов.
    NEED_DECAY_H: [6, 7, 8],
    NEED_COOLDOWN_MIN: 10,    // восстановить одну потребность можно раз в 10 минут
    NEED_SAFE: 0.5,           // пока средняя шкала ≥ 50% — доход полный
    NEED_PENALTY: 0.5,        // при средней шкале 0% доход −50%

    // ---------- Аврал ×2 (ускоритель) ----------
    RUSH_MULT: 2,
    RUSH_MIN: 5,              // длится 5 минут
    RUSH_COOLDOWN_H: 4,       // бесплатно раз в 4 часа

    // ---------- Календарь наград (7 дней, дальше по кругу) ----------
    // money — минуты дохода (но не меньше min ₽), shards — осколки, pack — пачка
    CALENDAR: [
      { type: 'money', minutes: 2, min: 100 },
      { type: 'shards', n: 1 },
      { type: 'money', minutes: 5, min: 300 },
      { type: 'pack', pack: 'standard' },
      { type: 'shards', n: 2 },
      { type: 'money', minutes: 10, min: 800 },
      { type: 'pack', pack: 'premium' }
    ],

    // ---------- Задания дня ----------
    QUEST_COUNT: 3,
    QUEST_REWARD_MIN: 2,      // каждое задание — 2 минуты дохода (не меньше 150 ₽)
    QUEST_REWARD_FLOOR: 150,
    QUESTS: [
      { id: 'merge', need: 25 },
      { id: 'hire', need: 40 },
      { id: 'care', need: 3 },
      { id: 'tap', need: 40 },
      { id: 'pack', need: 1 },
      { id: 'upgrade', need: 3 }
    ]
  };

  // ---------- Клетка: уровень и редкость ----------
  B.lvl = function (v) { return v % 10; };
  B.rar = function (v) { return Math.floor(v / 10); };
  B.cell = function (lvl, rar) { return lvl ? lvl + 10 * (rar || 0) : 0; };

  B.levelIncome = function (lvl) {
    return lvl > 0 ? B.INCOME_BASE * Math.pow(B.INCOME_GROWTH, lvl - 1) : 0;
  };
  B.cellIncome = function (v) {
    return v ? B.levelIncome(B.lvl(v)) * B.RARITY_MULT[B.rar(v)] : 0;
  };

  // Слияние: rnd — случайное число 0..1 (передаётся, чтобы симуляция была повторяемой)
  B.canMerge = function (a, b) {
    return !!a && !!b && B.lvl(a) === B.lvl(b) && B.lvl(a) < B.MAX_LEVEL;
  };
  B.mergeResult = function (a, b, rnd) {
    var ra = B.rar(a), rb = B.rar(b), r = Math.max(ra, rb), up = false;
    if (ra === rb && rnd < B.MERGE_UP_CHANCE[ra]) { r = ra + 1; up = true; }
    return { v: B.cell(B.lvl(a) + 1, r), up: up };
  };

  B.upgradeCost = function (id, lvl) {
    var u = B.UPGRADES[id];
    return Math.round(u.base * Math.pow(u.growth, lvl));
  };

  B.incomeMult = function (biz) {
    var room = B.ROOMS[biz.room] || B.ROOMS[0];
    return room.mult * (1 + 0.1 * (biz.upgrades.boost || 0));
  };

  // Доход без учёта потребностей и аврала
  B.baseIncome = function (biz) {
    var s = 0;
    for (var i = 0; i < biz.grid.length; i++) s += B.cellIncome(biz.grid[i]);
    return s * B.incomeMult(biz);
  };

  // ---------- Потребности ----------
  // biz.needs — время (мс) последнего восстановления каждой потребности
  B.needLevel = function (biz, i, now) {
    var t = biz.needs ? biz.needs[i] : now;
    return Math.max(0, Math.min(1, 1 - (now - t) / (B.NEED_DECAY_H[i] * 3600000)));
  };
  B.needsAvg = function (biz, now) {
    var s = 0;
    for (var i = 0; i < 3; i++) s += B.needLevel(biz, i, now);
    return s / 3;
  };
  B.needsFactorFromAvg = function (avg) {
    if (avg >= B.NEED_SAFE) return 1;
    return 1 - B.NEED_PENALTY * (1 - avg / B.NEED_SAFE);
  };
  B.needsFactor = function (biz, now) { return B.needsFactorFromAvg(B.needsAvg(biz, now)); };
  B.canCare = function (biz, i, now) {
    return now - (biz.needs ? biz.needs[i] : 0) >= B.NEED_COOLDOWN_MIN * 60000;
  };

  // Доход в секунду с учётом потребностей (now — мс) и аврала (rush — true/false)
  B.incomePerSec = function (biz, now, rush) {
    if (now == null) now = Date.now();
    return B.baseIncome(biz) * B.needsFactor(biz, now) * (rush ? B.RUSH_MULT : 1);
  };

  // Офлайн-доход: от момента fromMs, sec секунд (уже с учётом лимита). Шкалы падают и офлайн —
  // считаем средний множитель по 60 отрезкам. rushUntil — до какого времени действовал аврал.
  B.offlineGain = function (biz, fromMs, sec, rushUntil) {
    var steps = 60, sum = 0;
    for (var k = 0; k < steps; k++) sum += B.needsFactor(biz, fromMs + (k + 0.5) / steps * sec * 1000);
    var avg = sum / steps, base = B.baseIncome(biz);
    var rushSec = rushUntil ? Math.max(0, Math.min(sec, (rushUntil - fromMs) / 1000)) : 0;
    return { gain: base * avg * (sec + rushSec * (B.RUSH_MULT - 1)), factor: avg };
  };

  B.hireCost = function (biz) {
    var disc = 1 - 0.05 * (biz.upgrades.pr || 0);
    return Math.round(B.HIRE_BASE * Math.pow(B.HIRE_GROWTH, biz.hires) * disc);
  };
  B.packPrice = function (biz) {
    return Math.round(B.hireCost(biz) * B.PACKS.standard.priceHires / 10) * 10;
  };

  // Сотрудники из пачки: массив чисел-клеток
  B.rollPack = function (id, rnd) {
    var p = B.PACKS[id], out = [];
    for (var n = 0; n < p.count; n++) {
      var x = rnd() * 100, r = 0, acc = 0;
      for (var k = 0; k < 4; k++) { acc += p.chances[k]; if (x < acc) { r = k; break; } r = k; }
      while (p.chances[r] === 0 && r < 3) r++;
      var lvl = p.lvl[0] + Math.floor(rnd() * (p.lvl[1] - p.lvl[0] + 1));
      out.push(B.cell(lvl, r));
    }
    // самые ценные — в конце (красивее открывать)
    out.sort(function (a, b) { return (B.rar(a) - B.rar(b)) || (B.lvl(a) - B.lvl(b)); });
    return out;
  };

  B.offlineCapSec = function (biz) {
    return B.OFFLINE_CAP_HOURS[biz.upgrades.chairs || 0] * 3600;
  };

  B.minutesIncome = function (biz, minutes, floor, now) {
    return Math.round(Math.max(floor || 0, B.incomePerSec(biz, now) * 60 * minutes));
  };

  // ---------- Дополнительные места ----------
  // slots — { friends: 0..3, stars: 0..2, streak: true/false } (state.slots)
  B.friendSlots = function (counted) {
    var n = 0;
    for (var i = 0; i < B.SLOT_FRIENDS.length; i++) if ((counted || 0) >= B.SLOT_FRIENDS[i]) n++;
    return n;
  };
  B.extraSlots = function (slots) {
    if (!slots) return 0;
    return Math.min(B.SLOT_MAX, (slots.friends || 0) + (slots.stars || 0) + (slots.streak ? 1 : 0));
  };
  B.cellCount = function (room, extra) {
    return B.COLS * (B.ROOMS[room] || B.ROOMS[0]).rows + (extra || 0);
  };

  B.maxLevel = function (biz) {
    var m = 0;
    for (var i = 0; i < biz.grid.length; i++) { var l = B.lvl(biz.grid[i]); if (l > m) m = l; }
    return m;
  };

  // Оценка компании (для рейтинга): всё заработанное + доход за сутки
  B.valuation = function (biz, now) {
    return Math.round((biz.earned || 0) + B.incomePerSec(biz, now) * 86400);
  };

  B.newBusiness = function (type, now, extra) {
    if (now == null) now = Date.now();
    return {
      type: type,
      money: B.START_MONEY,
      earned: 0,
      room: 0,
      hires: 0,
      merges: 0,
      grid: new Array(B.cellCount(0, extra)).fill(0),
      upgrades: { boost: 0, chairs: 0, pr: 0 },
      needs: [now, now, now],
      inbox: [],
      seen: 1
    };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = B;
  else root.BALANCE = B;
})(this);
