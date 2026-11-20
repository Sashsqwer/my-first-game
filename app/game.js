/* «Стартап с нуля» — этап 1: клиент без сервера. */
(function () {
  'use strict';
  var B = window.BALANCE;
  var SAVE_KEY = 'startup_zero_save_v1';
  var CLOUD_KEY = 'save_v1';
  var VERSION = 1;

  // ---------- Telegram ----------
  var tg = window.Telegram && window.Telegram.WebApp;
  var inTg = !!(tg && tg.initData);
  function tgAtLeast(v) { try { return inTg && tg.isVersionAtLeast(v); } catch (e) { return false; } }
  function haptic(kind) {
    if (!tgAtLeast('6.1') || !tg.HapticFeedback) return;
    try {
      if (kind === 'success') tg.HapticFeedback.notificationOccurred('success');
      else if (kind === 'error') tg.HapticFeedback.notificationOccurred('error');
      else if (kind === 'select') tg.HapticFeedback.selectionChanged();
      else tg.HapticFeedback.impactOccurred(kind || 'light');
    } catch (e) { /* ничего */ }
  }
  if (inTg) {
    try { tg.ready(); tg.expand(); } catch (e) {}
    try { if (tgAtLeast('6.1')) { tg.setHeaderColor('#0D0F14'); tg.setBackgroundColor('#0D0F14'); } } catch (e) {}
    try { if (tgAtLeast('7.7')) tg.disableVerticalSwipes(); } catch (e) {}
    try { if (tgAtLeast('7.7') && tg.setBottomBarColor) tg.setBottomBarColor('#0D0F14'); } catch (e) {}
  }
  var cloud = tgAtLeast('6.9') && tg.CloudStorage ? tg.CloudStorage : null;

  // ---------- Данные бизнесов ----------
  var BIZ = {
    coffee: {
      name: 'Кофейня', icon: '☕',
      desc: 'Начни с ларька у остановки и дорасти до сети кофеен по всему городу.',
      staff: [
        { e: '🙋', n: 'Стажёр', s: 'Стажёр', j: 'Капучино — это который с пенкой или с собачкой?' },
        { e: '☕', n: 'Бариста', s: 'Бариста', j: 'Как вас записать? Ладно, будете «Олег».' },
        { e: '🧑‍🍳', n: 'Старший бариста', s: 'Ст. бариста', j: 'Помню заказы всех постоянных. Имена — нет.' },
        { e: '🔥', n: 'Обжарщик', s: 'Обжарщик', j: 'Это не подгорело. Это тёмная обжарка.' },
        { e: '🎨', n: 'Шеф-бариста', s: 'Шеф-бариста', j: 'Сердечко на пенке? Я рисую «Мону Лизу».' },
        { e: '📋', n: 'Управляющий', s: 'Управляющий', j: 'Кто опять поставил молоко на кассу?!' },
        { e: '🚗', n: 'Региональный директор', s: 'Рег. директор', j: 'Двенадцать кофеен за день. Сам пью чай.' },
        { e: '👑', n: 'Владелец сети', s: 'Владелец сети', j: 'Начинал с ларька. Ларёк, кстати, тоже мой.' }
      ],
      rooms: [
        { e: '🥤', n: 'Ларёк у остановки', s: 'Ларёк' },
        { e: '🚇', n: 'Кофейня у метро', s: 'У метро' },
        { e: '🏙️', n: 'Сеть кофеен', s: 'Сеть' }
      ],
      boost: { e: '⚙️', n: 'Кофемашина-ракета' }
    },
    it: {
      name: 'IT-стартап', icon: '💻',
      desc: 'Гараж, ноутбук и мечта о единороге. Найми стажёров — дальше сами.',
      staff: [
        { e: '🧑‍🎓', n: 'Стажёр', s: 'Стажёр', j: 'Где тут кнопка «сделать сайт»?' },
        { e: '🧑‍💻', n: 'Джун', s: 'Джун', j: 'Работает — не трогай.' },
        { e: '👨‍💼', n: 'Мидл', s: 'Мидл', j: 'Это не баг, это фича.' },
        { e: '🧔', n: 'Сеньор', s: 'Сеньор', j: 'Видел и не такое в 2019-м.' },
        { e: '🧠', n: 'Тимлид', s: 'Тимлид', j: 'Давайте созвонимся. Минут на пять. На час.' },
        { e: '⚙️', n: 'CTO', s: 'CTO', j: 'Перепишем всё на микросервисы. Опять.' },
        { e: '📈', n: 'Product', s: 'Product', j: 'Пользователи хотят не это.' },
        { e: '🦄', n: 'Сооснователь', s: 'Сооснователь', j: 'Мы меняем мир. Нужен ещё один раунд.' }
      ],
      rooms: [
        { e: '🏚️', n: 'Гараж', s: 'Гараж' },
        { e: '🛋️', n: 'Коворкинг', s: 'Коворкинг' },
        { e: '🏢', n: 'Свой офис', s: 'Свой офис' }
      ],
      boost: { e: '🖥️', n: 'Мощные ноутбуки' }
    },
    barber: {
      name: 'Барбершоп', icon: '💇',
      desc: 'Одно кресло в чужом салоне — а впереди свой бренд и сеть барбершопов.',
      staff: [
        { e: '🧹', n: 'Ученик', s: 'Ученик', j: 'Подмёл зал. Нашёл три расчёски и чью-то бороду.' },
        { e: '💇‍♂️', n: 'Барбер', s: 'Барбер', j: '«Чуть-чуть по бокам» — это сколько в миллиметрах?' },
        { e: '✂️', n: 'Старший барбер', s: 'Ст. барбер', j: 'Сделаю как у Бекхэма. Ну, как у его брата.' },
        { e: '🧔‍♂️', n: 'Топ-барбер', s: 'Топ-барбер', j: 'Запись на три месяца вперёд. Себя стригу сам.' },
        { e: '🎨', n: 'Колорист', s: 'Колорист', j: 'Это не зелёный. Это «мятный блонд».' },
        { e: '🕶️', n: 'Арт-директор', s: 'Арт-директор', j: 'Фейд — это не стрижка. Это философия.' },
        { e: '📊', n: 'Управляющий сетью', s: 'Упр. сетью', j: 'Пять салонов, сто кресел и ни одной свободной минуты.' },
        { e: '👑', n: 'Владелец бренда', s: 'Влад. бренда', j: 'Моя борода есть на вывеске. И на кружках.' }
      ],
      rooms: [
        { e: '💺', n: 'Кресло в салоне', s: 'Кресло' },
        { e: '💈', n: 'Свой барбершоп', s: 'Барбершоп' },
        { e: '🏙️', n: 'Сеть барбершопов', s: 'Сеть' }
      ],
      boost: { e: '✂️', n: 'Японские ножницы' }
    }
  };
  var BIZ_ORDER = ['coffee', 'it', 'barber'];

  // ---------- Форматирование ----------
  function group(n) {
    var s = String(Math.floor(n)), out = '';
    while (s.length > 3) { out = ' ' + s.slice(-3) + out; s = s.slice(0, -3); }
    return s + out;
  }
  function fmt(n) {
    if (!isFinite(n)) n = 0;
    if (n < 0) return '−' + fmt(-n);
    if (n < 1e6) return group(n);
    var units = ['млн', 'млрд', 'трлн', 'квдрлн', 'квинтлн'], i = 0;
    n /= 1e6;
    while (n >= 1000 && i < units.length - 1) { n /= 1000; i++; }
    var t = n < 100 ? (Math.floor(n * 10) / 10).toFixed(1) : String(Math.floor(n));
    return t.replace(/\.0$/, '').replace('.', ',') + ' ' + units[i];
  }
  function fmtRate(n) {
    if (n < 100 && n % 1 !== 0) return (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, '').replace('.', ',');
    return fmt(n);
  }
  function rub(n) { return fmt(n) + ' ₽'; }
  function plural(n, a, b, c) {
    n = Math.abs(n) % 100; var m = n % 10;
    if (n > 10 && n < 20) return c; if (m > 1 && m < 5) return b; if (m === 1) return a; return c;
  }
  function fmtDur(sec) {
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
    if (h > 0) return h + ' ч' + (m ? ' ' + m + ' мин' : '');
    if (m > 0) return m + ' мин';
    return Math.max(1, Math.floor(sec)) + ' сек';
  }

  // ---------- Состояние и сохранение ----------
  function freshState() {
    return { v: VERSION, savedAt: Date.now(), createdAt: Date.now(), active: 0, businesses: [], daily: { last: null, streak: 0 }, tutorial: 0 };
  }
  function valid(s) {
    return s && s.v === VERSION && Array.isArray(s.businesses) && typeof s.savedAt === 'number';
  }
  function normalize(s) {
    s.daily = s.daily || { last: null, streak: 0 };
    s.businesses.forEach(function (b) {
      b.upgrades = b.upgrades || { boost: 0, chairs: 0, pr: 0 };
      var need = B.COLS * B.ROOMS[b.room].rows;
      while (b.grid.length < need) b.grid.push(0);
      b.seen = Math.max(b.seen || 1, B.maxLevel(b));
      if (!isFinite(b.money)) b.money = 0;
    });
    if (!(s.active >= 0 && s.active < s.businesses.length)) s.active = 0;
    return s;
  }
  function readLocal() {
    try { var s = JSON.parse(localStorage.getItem(SAVE_KEY)); return valid(s) ? s : null; } catch (e) { return null; }
  }
  function readCloud(cb) {
    if (!cloud) return cb(null);
    var done = false;
    var timer = setTimeout(function () { if (!done) { done = true; cb(null); } }, 2000);
    try {
      cloud.getItem(CLOUD_KEY, function (err, val) {
        if (done) return; done = true; clearTimeout(timer);
        if (err || !val) return cb(null);
        try { var s = JSON.parse(val); cb(valid(s) ? s : null); } catch (e) { cb(null); }
      });
    } catch (e) { if (!done) { done = true; clearTimeout(timer); cb(null); } }
  }
  var state = null, lastCloud = 0;
  function save(toCloud) {
    if (!state) return;
    state.savedAt = Date.now();
    var json = JSON.stringify(state);
    try { localStorage.setItem(SAVE_KEY, json); } catch (e) { /* приватный режим и т. п. */ }
    if (cloud && (toCloud || Date.now() - lastCloud > 30000) && json.length < 4000) {
      lastCloud = Date.now();
      try { cloud.setItem(CLOUD_KEY, json, function () {}); } catch (e) {}
    }
  }
  function biz() { return state.businesses[state.active]; }
  function def() { return BIZ[biz().type]; }
  function staff(lvl) { return def().staff[lvl - 1]; }

  // ---------- DOM ----------
  function $(id) { return document.getElementById(id); }
  var el = {
    app: $('app'), choose: $('choose'), money: $('money'), rate: $('rate'), chipRoom: $('chip-room'), chipLock: $('chip-lock'),
    grid: $('grid'), board: $('board'), nextRoom: $('next-room'), hint: $('hint'), hire: $('btn-hire'), daily: $('btn-daily'),
    dailyDot: $('daily-dot'), fx: $('fx'), modal: $('modal'), toast: $('toast'), tutor: $('tutor'), tabbar: $('tabbar')
  };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var toastTimer;
  function toast(text) {
    el.toast.textContent = text;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove('show'); }, 2200);
  }

  // Окна — по одному, остальные ждут в очереди
  var modalQueue = [], modalOpen = false;
  function modal(html, bind, sticky) {
    modalQueue.push({ html: html, bind: bind, sticky: !!sticky });
    if (!modalOpen) nextModal();
  }
  function nextModal() {
    var m = modalQueue.shift();
    if (!m) { modalOpen = false; el.modal.hidden = true; el.modal.innerHTML = ''; return; }
    modalOpen = true;
    el.modal.innerHTML = '<div class="sheet">' + m.html + '</div>';
    el.modal.hidden = false;
    var close = function () { nextModal(); };
    el.modal.onclick = function (e) { if (e.target === el.modal && !m.sticky) close(); };
    if (m.bind) m.bind(el.modal.firstChild, close);
  }

  // ---------- Выбор бизнеса ----------
  function showChoose() {
    el.app.hidden = true; el.choose.hidden = false;
    var list = $('choose-list'); list.innerHTML = '';
    BIZ_ORDER.forEach(function (type) {
      var d = BIZ[type];
      var card = document.createElement('div');
      card.className = 'biz';
      card.innerHTML = '<div class="bi">' + d.icon + '</div><h3>' + d.name + '</h3><p>' + d.desc + '</p>' +
        '<div class="ladder" title="Лестница сотрудников">' + d.staff.map(function (s) { return s.e; }).join(' ') + '</div>' +
        '<button class="btn btn-primary">Открыть ' + d.icon + '</button>';
      card.querySelector('button').onclick = function () { startBusiness(type); };
      list.appendChild(card);
    });
  }
  function startBusiness(type) {
    state.businesses = [B.newBusiness(type)];
    state.active = 0;
    state.tutorial = 0;
    save(true);
    haptic('medium');
    showGame();
  }

  // ---------- Сетка ----------
  var cells = [];
  var tapCd = {}; // индекс клетки → время окончания кулдауна
  function buildGrid() {
    var b = biz();
    el.grid.innerHTML = ''; cells = [];
    for (var i = 0; i < b.grid.length; i++) {
      var c = document.createElement('div');
      c.className = 'cell'; c.dataset.i = i;
      el.grid.appendChild(c); cells.push(c);
    }
    renderCells();
  }
  function cellHtml(lvl) {
    var s = staff(lvl);
    return '<span class="lv">' + lvl + '</span><span class="em">' + s.e + '</span><span class="nm">' + esc(s.s) + '</span>';
  }
  function renderCell(i) {
    var lvl = biz().grid[i], c = cells[i];
    if (!c) return;
    c.classList.toggle('empty', !lvl);
    c.innerHTML = lvl ? cellHtml(lvl) : '';
    c.setAttribute('aria-label', lvl ? staff(lvl).n + ', уровень ' + lvl : 'Пустая клетка');
  }
  function renderCells() {
    for (var i = 0; i < cells.length; i++) renderCell(i);
    markPairs();
  }
  function markPairs() {
    var g = biz().grid, count = {};
    g.forEach(function (l) { if (l && l < B.MAX_LEVEL) count[l] = (count[l] || 0) + 1; });
    cells.forEach(function (c, i) { c.classList.toggle('pair', !!(g[i] && count[g[i]] >= 2)); });
  }
  function anim(c, cls) {
    c.classList.remove(cls); void c.offsetWidth; c.classList.add(cls);
    setTimeout(function () { c.classList.remove(cls); }, 650);
  }
  function floatAt(node, text, cls) {
    var r = node.getBoundingClientRect();
    var f = document.createElement('div');
    f.className = 'float' + (cls ? ' ' + cls : '');
    f.textContent = text;
    f.style.left = (r.left + r.width / 2) + 'px';
    f.style.top = (r.top + r.height * 0.35) + 'px';
    el.fx.appendChild(f);
    setTimeout(function () { f.remove(); }, 1000);
  }
  var bubbleEl = null;
  function bubbleAt(node, text) {
    if (bubbleEl) bubbleEl.remove();
    var r = node.getBoundingClientRect();
    var bub = document.createElement('div');
    bub.className = 'bubble';
    bub.textContent = text;
    var x = Math.min(Math.max(r.left + r.width / 2, 124), window.innerWidth - 124);
    bub.style.left = x + 'px';
    bub.style.top = (r.top - 8) + 'px';
    el.fx.appendChild(bub);
    bubbleEl = bub;
    setTimeout(function () { if (bubbleEl === bub) bubbleEl = null; bub.remove(); }, 2400);
  }

  function freeCell() { return biz().grid.indexOf(0); }

  function hire() {
    var b = biz(), i = freeCell(), cost = B.hireCost(b);
    if (i < 0) { toast('Нет свободного места — объедини одинаковых'); haptic('error'); return; }
    if (b.money < cost) { toast('Не хватает ' + rub(cost - b.money)); haptic('error'); return; }
    b.money -= cost; b.hires++; b.grid[i] = 1;
    renderCell(i); markPairs(); anim(cells[i], 'spawn');
    haptic('light');
    if (state.tutorial < 2) { state.tutorial++; tutorial(); }
    updateUi(true);
  }

  function tapCell(i) {
    var b = biz(), lvl = b.grid[i];
    if (!lvl) return;
    var c = cells[i], now = Date.now();
    anim(c, 'tapped');
    bubbleAt(c, '«' + staff(lvl).j + '»');
    if ((tapCd[i] || 0) > now) return;
    tapCd[i] = now + B.TAP_COOLDOWN * 1000;
    var gain = B.levelIncome(lvl) * B.incomeMult(b) * B.TAP_SECONDS;
    b.money += gain; b.earned += gain;
    floatAt(c, '+' + fmtRate(gain));
    var bar = document.createElement('i'); bar.className = 'cd';
    c.appendChild(bar);
    setTimeout(function () { bar.remove(); }, B.TAP_COOLDOWN * 1000);
    haptic('light');
    updateUi();
  }

  function drop(from, to) {
    var b = biz(), g = b.grid;
    if (from === to || to == null) return;
    var a = g[from], t = g[to];
    if (!t) {
      g[to] = a; g[from] = 0; delete tapCd[from];
      haptic('select');
    } else if (t === a && a < B.MAX_LEVEL) {
      g[to] = a + 1; g[from] = 0; b.merges++;
      delete tapCd[from];
      renderCell(from); renderCell(to);
      anim(cells[to], 'pop');
      floatAt(cells[to], '+1 уровень', 'lvl');
      haptic('success');
      if (state.tutorial === 2) { state.tutorial = 3; tutorial(); toast('Так и растёт компания! Дальше — сам 🚀'); }
      if (a + 1 > b.seen) { b.seen = a + 1; newLevel(a + 1); }
      markPairs(); updateUi(true);
      return;
    } else {
      if (t === a) toast('Это уже максимальный уровень 👑');
      g[to] = a; g[from] = t;
      var tmp = tapCd[from]; tapCd[from] = tapCd[to]; tapCd[to] = tmp;
      haptic('select');
    }
    renderCell(from); renderCell(to); markPairs(); updateUi(true);
  }

  function newLevel(lvl) {
    var s = staff(lvl), b = biz();
    modal('<div class="big-ico">' + s.e + '</div><h2>Новый сотрудник: ' + esc(s.n) + '</h2>' +
      '<p>Уровень ' + lvl + ' · приносит ' + fmtRate(B.levelIncome(lvl) * B.incomeMult(b)) + ' ₽/сек</p>' +
      '<div class="quote">«' + esc(s.j) + '»</div>' +
      (lvl === B.HOLDING_UNLOCK_LEVEL ? '<p>🏗️ Ты дорос до 5-го уровня — второй бизнес появится в следующем обновлении.</p>' : '') +
      '<div class="btns"><button class="btn btn-primary">Круто!</button></div>',
      function (root, close) { root.querySelector('button').onclick = close; });
  }

  // Перетаскивание: pointer events (палец и мышь)
  var drag = null;
  function cellIndexAt(x, y) {
    var t = document.elementFromPoint(x, y);
    var c = t && t.closest ? t.closest('.cell') : null;
    return c && c.parentNode === el.grid ? Number(c.dataset.i) : null;
  }
  el.grid.addEventListener('pointerdown', function (e) {
    if (drag || (e.button && e.button !== 0)) return;
    var c = e.target.closest('.cell');
    if (!c) return;
    var i = Number(c.dataset.i);
    if (!biz().grid[i]) return;
    e.preventDefault();
    drag = { from: i, id: e.pointerId, x0: e.clientX, y0: e.clientY, started: false, ghost: null, over: null };
    try { el.grid.setPointerCapture(e.pointerId); } catch (err) {}
  });
  el.grid.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.started) {
      if (dx * dx + dy * dy < 64) return;
      drag.started = true;
      var src = cells[drag.from], r = src.getBoundingClientRect();
      var gh = src.cloneNode(true);
      gh.classList.remove('pair', 'pop', 'tapped', 'spawn');
      gh.classList.add('ghost');
      var cd = gh.querySelector('.cd'); if (cd) cd.remove();
      gh.style.width = r.width + 'px'; gh.style.height = r.height + 'px';
      drag.w = r.width; drag.h = r.height; drag.ghost = gh;
      document.body.appendChild(gh);
      src.classList.add('lift');
      if (bubbleEl) bubbleEl = null;
    el.fx.innerHTML = '';
    }
    drag.ghost.style.left = (e.clientX - drag.w / 2) + 'px';
    drag.ghost.style.top = (e.clientY - drag.h / 2) + 'px';
    var over = cellIndexAt(e.clientX, e.clientY);
    if (over !== drag.over) {
      if (drag.over != null) cells[drag.over].classList.remove('over', 'can-merge');
      drag.over = over;
      if (over != null && over !== drag.from) {
        var g = biz().grid;
        cells[over].classList.add(g[over] === g[drag.from] && g[over] < B.MAX_LEVEL ? 'can-merge' : 'over');
      }
    }
  });
  function endDrag(e, cancel) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag; drag = null;
    if (d.ghost) d.ghost.remove();
    cells[d.from] && cells[d.from].classList.remove('lift');
    if (d.over != null && cells[d.over]) cells[d.over].classList.remove('over', 'can-merge');
    if (cancel) return;
    if (!d.started) tapCell(d.from);
    else drop(d.from, cellIndexAt(e.clientX, e.clientY));
  }
  el.grid.addEventListener('pointerup', function (e) { endDrag(e, false); });
  el.grid.addEventListener('pointercancel', function (e) { endDrag(e, true); });
  el.grid.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // ---------- Помещения ----------
  function roomStatus(idx) {
    var b = biz(), r = B.ROOMS[idx];
    var lvlOk = B.maxLevel(b) >= r.needLevel, moneyOk = b.money >= r.needMoney;
    return { room: r, lvlOk: lvlOk, moneyOk: moneyOk, ok: lvlOk && moneyOk };
  }
  function roomReqHtml(idx) {
    var st = roomStatus(idx), s = staff(st.room.needLevel);
    return '<div class="req"><span class="' + (st.lvlOk ? 'ok' : '') + '">' + (st.lvlOk ? '✅' : '⏳') + ' ' + s.e + ' ' + esc(s.n) + ' (ур. ' + st.room.needLevel + ')</span> · ' +
      '<span class="' + (st.moneyOk ? 'ok' : '') + '">' + (st.moneyOk ? '✅' : '⏳') + ' ' + rub(st.room.needMoney) + '</span></div>';
  }
  function showRooms() {
    var b = biz(), d = def();
    var html = '<div class="big-ico">' + d.rooms[b.room].e + '</div><h2>Помещения</h2><p>Переезд: деньги сгорают, сотрудники едут с тобой. Места больше, доход — в разы выше.</p><div class="list left">';
    d.rooms.forEach(function (r, i) {
      var R = B.ROOMS[i];
      html += '<div class="card ' + (i === b.room ? 'cur' : i > b.room + 1 ? 'locked' : '') + '"><div class="ico">' + r.e + '</div><div class="txt">' +
        '<div class="t">' + esc(r.n) + ' <small>×' + R.mult + '</small></div>' +
        '<div class="d">' + (B.COLS * R.rows) + ' мест (' + B.COLS + '×' + R.rows + ')' + (i === b.room ? ' · ты здесь' : i < b.room ? ' · пройдено' : '') + '</div>' +
        (i > b.room ? roomReqHtml(i) : '') + '</div>' +
        (i === b.room + 1 ? '<button class="buy ' + (roomStatus(i).ok ? '' : 'poor') + '" data-move="' + i + '">Переехать</button>' : '') +
        '</div>';
    });
    html += '</div><div class="btns" style="margin-top:14px"><button class="btn btn-dark" data-close>Закрыть</button></div>';
    modal(html, function (root, close) {
      root.querySelector('[data-close]').onclick = close;
      var mv = root.querySelector('[data-move]');
      if (mv) mv.onclick = function () {
        var idx = Number(mv.dataset.move), st = roomStatus(idx);
        if (!st.ok) { toast(!st.lvlOk ? 'Нужен ' + staff(st.room.needLevel).n + ' — объединяй сотрудников' : 'Не хватает ' + rub(st.room.needMoney - biz().money)); haptic('error'); return; }
        close(); moveRoom(idx);
      };
    });
  }
  function moveRoom(idx) {
    var b = biz(), R = B.ROOMS[idx], r = def().rooms[idx];
    b.money = 0; b.room = idx;
    while (b.grid.length < B.COLS * R.rows) b.grid.push(0);
    tapCd = {};
    buildGrid(); updateUi(true); save(true);
    haptic('success');
    modal('<div class="big-ico">' + r.e + '</div><h2>Переезд: ' + esc(r.n) + '!</h2><p>Теперь ' + (B.COLS * R.rows) + ' мест и доход ×' + R.mult + '. Команда уже раскладывает вещи.</p>' +
      '<div class="btns"><button class="btn btn-primary">Работаем!</button></div>', function (root, close) { root.querySelector('button').onclick = close; });
  }

  // ---------- Улучшения ----------
  var UPG_ORDER = ['boost', 'chairs', 'pr'];
  function upgInfo(id) {
    var b = biz(), lvl = b.upgrades[id] || 0, U = B.UPGRADES[id];
    var info = { lvl: lvl, max: lvl >= U.max, cost: B.upgradeCost(id, lvl) };
    if (id === 'boost') { info.e = def().boost.e; info.n = def().boost.n; info.d = '+10% к доходу за уровень · сейчас +' + (lvl * 10) + '%'; }
    if (id === 'chairs') {
      info.e = biz().type === 'barber' ? '💺' : '🛋️'; info.n = 'Удобные кресла';
      info.d = 'Офлайн-доход копится ' + B.OFFLINE_CAP_HOURS[lvl] + ' ч' + (info.max ? '' : ' → ' + B.OFFLINE_CAP_HOURS[lvl + 1] + ' ч');
    }
    if (id === 'pr') { info.e = '📢'; info.n = 'Пиар'; info.d = 'Найм дешевле на 5% за уровень · сейчас −' + (lvl * 5) + '%'; }
    return info;
  }
  function renderUpgrades() {
    var b = biz(), box = $('upgrades');
    box.innerHTML = UPG_ORDER.map(function (id) {
      var u = upgInfo(id);
      return '<div class="card"><div class="ico">' + u.e + '</div><div class="txt"><div class="t">' + esc(u.n) + ' <small>ур. ' + u.lvl + '</small></div><div class="d">' + u.d + '</div></div>' +
        (u.max ? '<button class="buy max">Макс.</button>' : '<button class="buy ' + (b.money >= u.cost ? '' : 'poor') + '" data-upg="' + id + '">' + rub(u.cost) + '</button>') + '</div>';
    }).join('');
    var d = def(), rl = $('rooms-list');
    rl.innerHTML = d.rooms.map(function (r, i) {
      var R = B.ROOMS[i];
      return '<div class="card ' + (i === b.room ? 'cur' : '') + '"><div class="ico">' + r.e + '</div><div class="txt"><div class="t">' + esc(r.n) + ' <small>×' + R.mult + '</small></div>' +
        '<div class="d">' + (B.COLS * R.rows) + ' мест' + (i === b.room ? ' · ты здесь' : i < b.room ? ' · пройдено' : '') + '</div>' + (i > b.room ? roomReqHtml(i) : '') + '</div>' +
        (i === b.room + 1 ? '<button class="buy ' + (roomStatus(i).ok ? '' : 'poor') + '" data-rooms>Переезд</button>' : '') + '</div>';
    }).join('');
    $('team').innerHTML = d.staff.map(function (s, i) {
      var lvl = i + 1, known = lvl <= b.seen;
      return '<div class="card team-card ' + (known ? '' : 'locked') + '"><div class="ico">' + (known ? s.e : '❔') + '</div><div class="txt">' +
        '<div class="t">' + (known ? esc(s.n) : '???') + ' <small>ур. ' + lvl + '</small></div>' +
        '<div class="d">' + fmtRate(B.levelIncome(lvl)) + ' ₽/сек × бонусы</div>' +
        '<div class="joke">' + (known ? '«' + esc(s.j) + '»' : 'Объедини двух «' + esc(d.staff[i - 1].n) + '», чтобы познакомиться') + '</div></div></div>';
    }).join('');
  }
  $('view-upgrades').addEventListener('click', function (e) {
    var t = e.target.closest('[data-upg]');
    if (t) {
      var id = t.dataset.upg, b = biz(), u = upgInfo(id);
      if (u.max) return;
      if (b.money < u.cost) { toast('Не хватает ' + rub(u.cost - b.money)); haptic('error'); return; }
      b.money -= u.cost; b.upgrades[id] = u.lvl + 1;
      haptic('medium'); toast(u.e + ' ' + u.n + ' — уровень ' + (u.lvl + 1));
      renderUpgrades(); updateUi(true); save();
      return;
    }
    if (e.target.closest('[data-rooms]')) showRooms();
  });

  // ---------- Бонус дня ----------
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function dayNum(key) { var p = key.split('-').map(Number); return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000); }
  function dailyState() {
    var today = dayKey(), dl = state.daily;
    if (dl.last === today) return { claimed: true, streak: dl.streak };
    var cont = dl.last && dayNum(today) - dayNum(dl.last) === 1;
    return { claimed: false, streak: cont ? Math.min(dl.streak + 1, 7) : 1, lost: !!dl.last && !cont && dl.streak > 1 };
  }
  function showDaily() {
    var ds = dailyState(), b = biz();
    var cur = ds.claimed ? ds.streak : ds.streak;
    var row = '';
    for (var i = 1; i <= 7; i++) {
      var cls = i < cur || (ds.claimed && i === cur) ? 'done' : (!ds.claimed && i === cur ? 'today' : '');
      row += '<div class="' + cls + '"><b>' + (i === 7 ? '💎' : i < cur || (ds.claimed && i === cur) ? '✓' : '🎁') + '</b>' + i + ' д</div>';
    }
    var reward = B.dailyReward(b, ds.streak);
    var html = '<div class="big-ico">🎁</div><h2>Бонус дня</h2>' +
      '<p>Заходи каждый день — награда растёт до 7-го дня. Пропустишь день — серия начнётся заново.</p>' +
      '<div class="streak">' + row + '</div>';
    if (ds.claimed) {
      var nextReward = B.dailyReward(b, Math.min(ds.streak + 1, 7));
      html += '<p>Сегодня уже забрал ✅<br>Завтра — день ' + Math.min(ds.streak + 1, 7) + ': примерно ' + rub(nextReward) + '</p>' +
        '<div class="btns"><button class="btn btn-dark" data-close>Ок</button></div>';
    } else {
      html += (ds.lost ? '<p>Серия прервалась — начинаем с 1-го дня.</p>' : '') +
        '<div class="amount">+' + rub(reward) + '</div><div class="btns"><button class="btn btn-primary" data-claim>Забрать</button></div>';
    }
    modal(html, function (root, close) {
      var c = root.querySelector('[data-close]'); if (c) c.onclick = close;
      var cl = root.querySelector('[data-claim]');
      if (cl) cl.onclick = function () {
        var d2 = dailyState();
        if (d2.claimed) return close();
        var r2 = B.dailyReward(biz(), d2.streak);
        biz().money += r2; biz().earned += r2;
        state.daily = { last: dayKey(), streak: d2.streak };
        haptic('success'); floatAt(el.money, '+' + rub(r2));
        close(); updateUi(true); save(true);
      };
    });
  }

  // ---------- Офлайн-доход ----------
  function offline(sec) {
    var b = biz(), cap = B.offlineCapSec(b), t = Math.min(sec, cap), inc = B.incomePerSec(b);
    var gain = inc * t;
    if (gain < 1) return;
    modal('<div class="big-ico">💼</div><h2>Пока тебя не было</h2>' +
      '<p>Команда работала ' + fmtDur(t) + (sec > cap ? ' (больше не влезло — лимит ' + fmtDur(cap) + ', прокачай «Удобные кресла»)' : '') + '</p>' +
      '<div class="amount">+' + rub(gain) + '</div><div class="btns"><button class="btn btn-primary">Забрать</button></div>',
      function (root, close) {
        root.querySelector('button').onclick = function () {
          biz().money += gain; biz().earned += gain;
          haptic('success'); close(); updateUi(true); save(true);
          floatAt(el.money, '+' + rub(gain));
        };
      }, true); // окно не закрывается мимо кнопки — иначе деньги потеряются
  }

  // ---------- Обучение ----------
  function tutorial() {
    var t = el.tutor;
    el.hire.classList.remove('glow');
    if (state.tutorial >= 3 || !state.businesses.length) { t.hidden = true; t.innerHTML = ''; return; }
    t.hidden = false;
    var step = state.tutorial, text, html, r;
    if (step < 2) {
      text = step === 0 ? 'Нажми «Нанять» — придёт первый ' + staff(1).n.toLowerCase() : 'Отлично! Найми ещё одного';
      el.hire.classList.add('glow');
      r = el.hire.getBoundingClientRect();
      t.innerHTML = '<div class="tip down"><span class="n">' + (step + 1) + '</span>' + text + '</div>';
      var tip = t.firstChild;
      tip.style.top = (r.top - tip.offsetHeight - 16) + 'px';
      styleArrow(tip, r.left + r.width / 2 - tip.getBoundingClientRect().left); // стрелка — на кнопку «Нанять»
    } else {
      var g = biz().grid, a = -1, bIdx = -1;
      for (var i = 0; i < g.length; i++) if (g[i] === 1) { if (a < 0) a = i; else if (bIdx < 0) bIdx = i; }
      if (a < 0 || bIdx < 0) { t.innerHTML = ''; return; }
      var ra = cells[a].getBoundingClientRect(), rb = cells[bIdx].getBoundingClientRect();
      html = '<div class="tip up" style="top:' + (ra.bottom + 18) + 'px"><span class="n">3</span>Перетащи одного ' + staff(1).n.toLowerCase() + 'а на другого — получишь: ' + staff(2).e + ' ' + staff(2).n + '</div>' +
        '<div class="hand move" style="left:' + (ra.left + ra.width / 2) + 'px;top:' + (ra.top + ra.height / 2) + 'px;--dx:' + (rb.left - ra.left) + 'px;--dy:' + (rb.top - ra.top) + 'px">👆</div>';
      t.innerHTML = html;
      styleArrow(t.firstChild, ra.left + ra.width / 2 - t.firstChild.getBoundingClientRect().left);
    }
  }
  function styleArrow(tip, x) {
    var id = 'tip-arrow-style', st = document.getElementById(id);
    if (!st) { st = document.createElement('style'); st.id = id; document.head.appendChild(st); }
    x = Math.max(20, Math.min(x, tip.offsetWidth - 20));
    st.textContent = '.tip::after{left:' + x + 'px !important}';
  }

  // ---------- Интерфейс ----------
  var lastBtnState = '';
  function updateUi(force) {
    var b = biz(); if (!b) return;
    var d = def(), inc = B.incomePerSec(b);
    el.money.innerHTML = fmt(b.money) + ' <span>₽</span>';
    el.rate.innerHTML = '<b>+' + fmtRate(inc) + ' ₽/сек</b> · пока тебя нет, тоже';
    var cost = B.hireCost(b), full = freeCell() < 0;
    var bs = (full ? 'full' : b.money < cost ? 'poor' : 'ok') + cost;
    if (bs !== lastBtnState || force) {
      lastBtnState = bs;
      el.hire.className = 'btn btn-primary' + (full ? ' full' : b.money < cost ? ' poor' : '') + (state.tutorial < 2 ? ' glow' : '');
      el.hire.textContent = full ? '➕ Нет места' : '➕ Нанять · ' + rub(cost);
    }
    var ds = dailyState();
    el.dailyDot.classList.toggle('on', !ds.claimed);
    // следующий переезд
    var next = B.ROOMS[b.room + 1];
    if (next) {
      var st = roomStatus(b.room + 1), r = d.rooms[b.room + 1], need = staff(next.needLevel);
      var p = Math.min(1, b.money / next.needMoney);
      el.nextRoom.hidden = false;
      el.nextRoom.classList.toggle('ready', st.ok);
      el.nextRoom.innerHTML = st.ok
        ? '<b>' + r.e + ' Можно переезжать: ' + esc(r.n) + ' · ×' + next.mult + '</b> — нажми'
        : 'Дальше: <b>' + r.e + ' ' + esc(r.n) + ' · ×' + next.mult + '</b><br>' + (st.lvlOk ? '✅ ' : '⏳ ') + need.e + ' ' + esc(need.n) + ' · ' + (st.moneyOk ? '✅ ' : '⏳ ') + rub(next.needMoney) +
          '<div class="bar"><i style="width:' + (p * 100).toFixed(1) + '%"></i></div>';
    } else {
      el.nextRoom.hidden = false; el.nextRoom.classList.remove('ready');
      el.nextRoom.innerHTML = '🏁 Это лучшее помещение на сегодня. Новые — в следующих обновлениях.';
    }
    el.chipRoom.textContent = d.rooms[b.room].e + ' ' + d.rooms[b.room].s + ' · ×' + B.ROOMS[b.room].mult;
    var open = b.seen >= B.HOLDING_UNLOCK_LEVEL;
    el.chipLock.classList.toggle('open', open);
    el.chipLock.innerHTML = open ? '<span>🏗️ 2-й бизнес — скоро</span>' : '<span>🔒 2-й бизнес — откроется на 5-м уровне сотрудника</span>';
    // подсказка
    var hint;
    if (full && !hasPair()) hint = next ? 'Мест нет и пар нет — копи на переезд в ' + d.rooms[b.room + 1].s.toLowerCase() : 'Мест нет — объединяй, когда появятся пары';
    else if (hasPair()) hint = 'Перетащи двух одинаковых друг на друга — уровень выше';
    else hint = 'Тапни по сотруднику — +2 секунды его дохода сразу';
    if (el.hint.textContent !== hint) el.hint.textContent = hint;
    if (force && activeView === 'upgrades') renderUpgrades();
    if (activeView === 'rating') $('earned').textContent = rub(b.earned);
  }
  function hasPair() {
    var g = biz().grid, seen = {};
    for (var i = 0; i < g.length; i++) { var l = g[i]; if (l && l < B.MAX_LEVEL) { if (seen[l]) return true; seen[l] = 1; } }
    return false;
  }

  var activeView = 'office';
  el.tabbar.addEventListener('click', function (e) {
    var t = e.target.closest('.tab'); if (!t) return;
    setView(t.dataset.view);
  });
  function setView(v) {
    activeView = v;
    if (bubbleEl) { bubbleEl.remove(); bubbleEl = null; }
    document.querySelectorAll('.tab').forEach(function (x) { x.classList.toggle('active', x.dataset.view === v); });
    document.querySelectorAll('.view').forEach(function (x) { x.classList.toggle('active', x.id === 'view-' + v); });
    el.tutor.style.display = v === 'office' ? '' : 'none';
    if (v === 'upgrades') renderUpgrades();
    if (v === 'rating') $('earned').textContent = rub(biz().earned);
    haptic('select');
  }

  el.hire.addEventListener('click', hire);
  el.daily.addEventListener('click', showDaily);
  el.chipRoom.addEventListener('click', showRooms);
  el.nextRoom.addEventListener('click', showRooms);
  el.chipLock.addEventListener('click', function () {
    toast(biz().seen >= B.HOLDING_UNLOCK_LEVEL ? 'Холдинг из нескольких бизнесов — в следующем обновлении' : 'Получи сотрудника 5-го уровня — откроется второй бизнес');
  });
  $('btn-invite').addEventListener('click', function () {
    var url = 'https://t.me/share/url?url=' + encodeURIComponent('https://t.me/startup_zero_bot') +
      '&text=' + encodeURIComponent('Строю стартап с нуля 🚀 Заходи — обгони меня!');
    if (inTg) { try { tg.openTelegramLink(url); return; } catch (e) {} }
    window.open(url, '_blank');
  });
  $('btn-settings').addEventListener('click', function () {
    var b = biz(), d = def();
    modal('<div class="big-ico">⚙️</div><h2>Настройки</h2>' +
      '<p>' + d.icon + ' ' + d.name + ' · ' + d.rooms[b.room].n + '<br>Наймов: ' + b.hires + ' · объединений: ' + b.merges + '<br>Сохранение: на этом устройстве' + (cloud ? ' и в облаке Telegram' : '') + '</p>' +
      '<div class="btns"><button class="btn btn-dark" data-close>Закрыть</button><button class="btn btn-ghost" data-reset>Сбросить прогресс</button></div>' +
      '<p style="margin:12px 0 0;font-size:12px;color:var(--dim)">Стартап с нуля · версия 0.1 (этап 1)</p>',
      function (root, close) {
        root.querySelector('[data-close]').onclick = close;
        root.querySelector('[data-reset]').onclick = function () { close(); confirmReset(); };
      });
  });
  function confirmReset() {
    modal('<div class="big-ico">⚠️</div><h2>Сбросить прогресс?</h2><p>Пропадут деньги, сотрудники, помещения и улучшения. Это нельзя отменить.</p>' +
      '<div class="btns"><button class="btn btn-danger" data-yes>Да, начать заново</button><button class="btn btn-dark" data-no>Отмена</button></div>',
      function (root, close) {
        root.querySelector('[data-no]').onclick = close;
        root.querySelector('[data-yes]').onclick = function () {
          close();
          try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
          if (cloud) { try { cloud.removeItem(CLOUD_KEY, function () {}); } catch (e) {} }
          state = freshState(); tapCd = {};
          el.tutor.hidden = true;
          save(true);
          showChoose();
        };
      });
  }

  // ---------- Игровой цикл ----------
  var lastTick = Date.now(), lastUi = 0, lastSave = Date.now();
  function frame() { tick(); requestAnimationFrame(frame); }
  function tick() {
    var now = Date.now();
    if (state && state.businesses.length && !el.app.hidden) {
      var dt = (now - lastTick) / 1000;
      if (dt > 5) {
        // вкладка была скрыта / телефон спал — считаем как офлайн
        save();
        if (dt >= B.OFFLINE_MIN_SEC) offline(dt);
        else { var g0 = B.incomePerSec(biz()) * dt; biz().money += g0; biz().earned += g0; }
      } else if (dt > 0) {
        var g = B.incomePerSec(biz()) * dt;
        biz().money += g; biz().earned += g;
      }
      if (now - lastUi > 100) { lastUi = now; updateUi(); }
      if (now - lastSave > 5000) { lastSave = now; save(); }
    }
    lastTick = now;
  }
  // запасной таймер: если кадры не рисуются (окно видно, но rAF стоит) — деньги всё равно идут
  setInterval(function () { if (document.visibilityState === 'visible' && Date.now() - lastTick > 1000) tick(); }, 1000);

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') save(true);
  });
  window.addEventListener('pagehide', function () { save(true); });
  window.addEventListener('resize', function () { if (state && state.tutorial < 3 && state.businesses.length) tutorial(); });

  function showGame() {
    el.choose.hidden = true; el.app.hidden = false;
    buildGrid();
    setView('office');
    lastTick = Date.now();
    updateUi(true);
    requestAnimationFrame(tutorial);
  }

  // ---------- Старт ----------
  function boot(loaded) {
    state = loaded ? normalize(loaded) : freshState();
    if (!state.businesses.length) { showChoose(); }
    else {
      var away = (Date.now() - state.savedAt) / 1000;
      showGame();
      if (away >= B.OFFLINE_MIN_SEC) offline(away);
    }
    requestAnimationFrame(frame);
  }
  var local = readLocal();
  if (cloud) {
    readCloud(function (remote) {
      var best = local;
      if (remote && (!best || remote.savedAt > best.savedAt)) best = remote;
      boot(best);
    });
  } else boot(local);

  // для отладки и тестов
  window.__game = { get state() { return state; }, save: save, fmt: fmt, rebuild: function () { buildGrid(); updateUi(true); tutorial(); } };
})();
