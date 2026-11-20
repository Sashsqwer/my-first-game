/* Баланс и формулы «Стартап с нуля». Общий файл: его подключает игра (app/index.html)
   и симуляция (tools/simulate.js). Меняешь цифры здесь — меняется и игра, и прогон. */
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
      { rows: 4, mult: 3,  needLevel: 5, needMoney: 12000 },
      { rows: 5, mult: 10, needLevel: 7, needMoney: 1500000 }
    ],

    // Улучшения
    UPGRADES: {
      boost:  { base: 150,  growth: 2.2, max: 25 },  // +10% дохода за уровень
      chairs: { base: 2000, growth: 12,  max: 2 },   // офлайн 8 → 12 → 24 ч
      pr:     { base: 300,  growth: 2.6, max: 10 }   // найм −5% за уровень
    },

    // Бонус дня: множитель за серию дней 1..7
    DAILY_MULT: [1, 1.5, 2, 3, 4, 5, 8],
    DAILY_SECONDS: 120,       // бонус = доход за 2 минуты × множитель серии
    DAILY_MIN: 50             // но не меньше 50 ₽ × множитель
  };

  B.levelIncome = function (lvl) {
    return lvl > 0 ? B.INCOME_BASE * Math.pow(B.INCOME_GROWTH, lvl - 1) : 0;
  };

  B.upgradeCost = function (id, lvl) {
    var u = B.UPGRADES[id];
    return Math.round(u.base * Math.pow(u.growth, lvl));
  };

  B.incomeMult = function (biz) {
    var room = B.ROOMS[biz.room] || B.ROOMS[0];
    return room.mult * (1 + 0.1 * (biz.upgrades.boost || 0));
  };

  B.incomePerSec = function (biz) {
    var s = 0;
    for (var i = 0; i < biz.grid.length; i++) s += B.levelIncome(biz.grid[i]);
    return s * B.incomeMult(biz);
  };

  B.hireCost = function (biz) {
    var disc = 1 - 0.05 * (biz.upgrades.pr || 0);
    return Math.round(B.HIRE_BASE * Math.pow(B.HIRE_GROWTH, biz.hires) * disc);
  };

  B.offlineCapSec = function (biz) {
    return B.OFFLINE_CAP_HOURS[biz.upgrades.chairs || 0] * 3600;
  };

  B.dailyReward = function (biz, streak) {
    var m = B.DAILY_MULT[Math.min(Math.max(streak, 1), 7) - 1];
    return Math.round(Math.max(B.DAILY_MIN, B.incomePerSec(biz) * B.DAILY_SECONDS) * m);
  };

  B.maxLevel = function (biz) {
    var m = 0;
    for (var i = 0; i < biz.grid.length; i++) if (biz.grid[i] > m) m = biz.grid[i];
    return m;
  };

  B.newBusiness = function (type) {
    return {
      type: type,
      money: B.START_MONEY,
      earned: 0,
      room: 0,
      hires: 0,
      merges: 0,
      grid: new Array(B.COLS * B.ROOMS[0].rows).fill(0),
      upgrades: { boost: 0, chairs: 0, pr: 0 },
      seen: 1
    };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = B;
  else root.BALANCE = B;
})(this);
