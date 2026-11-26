/* Баланс и формулы «Стартап с нуля». Общий файл: его подключает игра (app/index.html)
   и симуляция (tools/simulate.js). Меняешь цифры здесь — меняется и игра, и прогон.

   Клетка сетки хранится одним числом: уровень + 10 × редкость.
   0 — пусто, 3 — обычный 3-го уровня, 13 — редкий 3-го, 25 — эпический 5-го, 38 — легендарный 8-го. */
(function (root) {
  'use strict';

  var B = {
    START_MONEY: 110,         // деньги на старте — хватает на 2 найма (обучение)
    HIRE_BASE: 50,            // цена первого найма
    HIRE_GROWTH: 1.17,        // ×1.17 за каждый найм
    INCOME_BASE: 0.05,        // ₽/сек у сотрудника 1 уровня (= 180 ₽/час)
    INCOME_GROWTH: 2.2,       // ×2.2 за уровень
    MAX_LEVEL: 8,
    COLS: 4,
    TAP_SECONDS: 10,          // тап = 10 секунд дохода сотрудника
    TAP_COOLDOWN: 5,          // кулдаун тапа, сек
    TAP_MIN: 1,               // но не меньше 1 ₽ за тап — в первые минуты тап заметен, дальше не важен
    OFFLINE_MIN_SEC: 60,      // меньше минуты — окно не показываем
    OFFLINE_CAP_HOURS: [8, 12, 24], // по уровню «Удобных кресел»
    HOLDING_UNLOCK_LEVEL: 5,  // задел под вариант 05: 2-й бизнес на 5-м уровне сотрудника

    // Ступени офиса (общие числа для всех бизнесов, названия — в content.js).
    // mult — множитель дохода (итоговый, не накопительный), rows — рядов по 4 места; переезд — нужен сотрудник уровня needLevel и needMoney ₽ (деньги сгорают)
    ROOMS: [
      { rows: 3, mult: 1,   needLevel: 0, needMoney: 0 },
      { rows: 3, mult: 1.4, needLevel: 5, needMoney: 200000 },
      { rows: 4, mult: 1.9, needLevel: 5, needMoney: 800000 },
      { rows: 4, mult: 2.6, needLevel: 6, needMoney: 2000000 },
      { rows: 4, mult: 3.5, needLevel: 6, needMoney: 6000000 },
      { rows: 5, mult: 4.8, needLevel: 7, needMoney: 18000000 },
      { rows: 5, mult: 6.5, needLevel: 7, needMoney: 50000000 },
      { rows: 5, mult: 9,   needLevel: 8, needMoney: 150000000 }
    ],
    // Старые сохранения (до 8 ступеней): помещение 0/1/2 (×1 4×3, ×3 4×4, ×10 4×5) → ближайшая новая ступень
    ROOM_FROM_V2: [0, 3, 7],

    // Дополнительные места в помещении (сверх 4×N): общие для всех бизнесов игрока
    SLOT_FRIENDS: [1, 3, 10],  // +1 место за 1, за 3 и за 10 засчитанных друзей (до +3)
    SLOT_STARS: [50, 100],     // +1 место за ⭐ 50 и ещё +1 за ⭐ 100 (оплата — позже, пока «скоро»)
    SLOT_STREAK_DAYS: 7,       // +1 место за 7 дней подряд в календаре наград
    SLOT_MAX: 6,

    // Стили — КОМПЛЕКТЫ «оформление + сотрудники»: main — основной, бесплатно; остальные — за друзей и/или ⭐ (оплата ⭐ — позже, пока «скоро»)
    // friends и stars вместе — открывается любым из двух способов
    SKINS: [
      { id: 'main',       n: 'Основной',    d: 'Сочный офис и мультяшная команда',       free: true },
      { id: 'neon',       n: 'Ночной неон', d: 'Ночь, дождь, неон и золото',              friends: 3, stars: 75 },
      { id: 'collection', n: 'Коллекция',   d: 'Витрина коллекционера и 3D-фигурки',      stars: 150 }
    ],
    // старые стили (до 0.6) → комплект, в который их переводим
    SKIN_OLD: { mix: 'main', ca: 'main', cb: 'main', cc: 'main', k: 'neon', m: 'neon', b: 'collection', c: 'collection' },

    // Улучшения
    UPGRADES: {
      boost:  { base: 2000,  growth: 2.0, max: 25 },  // +10% дохода за уровень
      chairs: { base: 25000, growth: 16,  max: 2 },   // офлайн 8 → 12 → 24 ч
      pr:     { base: 1500,  growth: 2.6, max: 10 }   // найм −5% за уровень
    },

    // ---------- Редкость ----------
    // 0 обычный, 1 редкий, 2 эпический, 3 легендарный
    RARITY_MULT: [1, 1.5, 2, 5],
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
      { type: 'money', minutes: 60, min: 100 },
      { type: 'shards', n: 1 },
      { type: 'money', minutes: 120, min: 300 },
      { type: 'pack', pack: 'standard' },
      { type: 'shards', n: 2 },
      { type: 'money', minutes: 240, min: 800 },
      { type: 'pack', pack: 'premium' }
    ],

    // ---------- Задания дня ----------
    QUEST_COUNT: 3,
    CHEST_PACK: 'free',       // сундук за все три — пачка (2 резюме) + 1 осколок; «Стандарт» разгонял игру в ~1,5 раза
    QUEST_REWARD_MIN: 30,     // каждое задание — 30 минут дохода (не меньше 150 ₽)
    QUEST_REWARD_FLOOR: 150,
    // need — сколько нужно в начале игры; «найм» и «слияния» дальше подстраиваются под доход (B.questNeed),
    // потому что найм дорожает ×1.17 и через пару дней 40 наймов за день уже невозможны
    QUESTS: [
      { id: 'merge', need: 12 },
      { id: 'hire', need: 15 },
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

  B.hireCost = function (biz) { return B.hireCostAt(biz, biz.hires); };
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

  // Цена найма номер h (0 — первый) с учётом скидки «пиара»
  B.hireCostAt = function (biz, h) {
    var disc = 1 - 0.05 * (biz.upgrades.pr || 0);
    return Math.round(B.HIRE_BASE * Math.pow(B.HIRE_GROWTH, h) * disc);
  };
  // Тап по сотруднику v: TAP_SECONDS его дохода (×аврал), но не меньше TAP_MIN ₽
  B.tapGain = function (biz, v, rush) {
    return Math.max(B.TAP_MIN, B.cellIncome(v) * B.incomeMult(biz) * B.TAP_SECONDS * (rush ? B.RUSH_MULT : 1));
  };

  // Задание дня: сколько нужно сделать (0 — сегодня такое задание не даём, оно невыполнимо).
  // Найм и слияния: в начале (меньше 30 наймов) — как в QUESTS, дальше — сколько наймов покупают 2 часа дохода.
  // Улучшения: сколько самых дешёвых покупают 3 часа дохода (до 3).
  B.questNeed = function (id, biz, now) {
    var base = 0;
    for (var i = 0; i < B.QUESTS.length; i++) if (B.QUESTS[i].id === id) base = B.QUESTS[i].need;
    if (!base) return 0;
    var perH = B.baseIncome(biz) * 3600;
    if (id === 'hire' || id === 'merge') {
      if ((biz.hires || 0) < 30) return base;
      var budget = perH * 2, k = 0, h = biz.hires || 0;
      while (k < base) { var c = B.hireCostAt(biz, h + k); if (c > budget) break; budget -= c; k++; }
      if (id === 'hire') return k >= 2 ? k : 0;
      return Math.max(1, k); // слияния бывают и из пачек (бесплатная — раз в 8 ч)
    }
    if (id === 'upgrade') {
      var lv = {}, money = perH * 3, n = 0;
      Object.keys(B.UPGRADES).forEach(function (u) { lv[u] = biz.upgrades[u] || 0; });
      while (n < base) {
        var best = null, bc = Infinity;
        Object.keys(B.UPGRADES).forEach(function (u) { if (lv[u] < B.UPGRADES[u].max) { var c = B.upgradeCost(u, lv[u]); if (c < bc) { bc = c; best = u; } } });
        if (!best || bc > money) break;
        money -= bc; lv[best]++; n++;
      }
      return n;
    }
    return base;
  };

  B.offlineCapSec = function (biz) {
    return B.OFFLINE_CAP_HOURS[biz.upgrades.chairs || 0] * 3600;
  };

  B.minutesIncome = function (biz, minutes, floor, now) {
    return Math.round(Math.max(floor || 0, B.incomePerSec(biz, now) * 60 * minutes));
  };

  // ---------- Стили (скины) ----------
  // открыт ли стиль: бесплатный, за друзей (counted — засчитанные друзья) или куплен за ⭐ (bought — список id)
  B.skinOpen = function (sk, counted, bought) {
    if (!sk) return false;
    if (sk.free) return true;
    if (sk.friends && (counted || 0) >= sk.friends) return true;
    return !!(bought && bought.indexOf(sk.id) >= 0);
  };
  B.skin = function (id) {
    for (var i = 0; i < B.SKINS.length; i++) if (B.SKINS[i].id === id) return B.SKINS[i];
    return null;
  };

  // ---------- Дополнительные места ----------
  // slots —{ friends: 0..3, stars: 0..2, streak: true/false } (state.slots)
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
