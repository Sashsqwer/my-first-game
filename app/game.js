/* «Стартап с нуля» — этап 2: клиент. Сервер (друзья, рейтинг) — через window.GameNet из net.js, если он есть. */
(function () {
  'use strict';
  var B = window.BALANCE, C = window.CONTENT;
  var BIZ = C.BIZ, BIZ_ORDER = C.ORDER, RARITY = C.RARITY;
  var SAVE_KEY = 'startup_zero_save_v1'; // имя ключа оставили прежним, версия — внутри (v)
  var CLOUD_KEY = 'save_v1';
  var VERSION = 2;
  var HOUR = 3600000, MIN = 60000;

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

  // ---------- Сервер (net.js) ----------
  function net() {
    try { var N = window.GameNet; return N && typeof N.ready === 'function' && N.ready() ? N : null; } catch (e) { return null; }
  }

  // ---------- Форматирование ----------
  function group(n) {
    var s = String(Math.floor(n)), out = '';
    while (s.length > 3) { out = '\u00A0' + s.slice(-3) + out; s = s.slice(0, -3); }
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
    return t.replace(/\.0$/, '').replace('.', ',') + '\u00A0' + units[i];
  }
  function fmtRate(n) {
    if (n < 100 && n % 1 !== 0) return (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, '').replace('.', ',');
    return fmt(n);
  }
  function rub(n) { return fmt(n) + '\u00A0₽'; }
  function plural(n, a, b, c) {
    n = Math.abs(n) % 100; var m = n % 10;
    if (n > 10 && n < 20) return c; if (m > 1 && m < 5) return b; if (m === 1) return a; return c;
  }
  function fmtDur(sec) {
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
    if (h > 0) return h + ' ч' + (m ? ' ' + m + ' мин' : '');
    if (m > 0) return m + ' мин';
    return Math.max(1, Math.floor(sec)) + ' сек';
  }
  function fmtClock(sec) {
    sec = Math.max(0, Math.ceil(sec));
    return Math.floor(sec / 60) + ':' + ('0' + sec % 60).slice(-2);
  }

  // ---------- Состояние и сохранение ----------
  function freshState() {
    var now = Date.now();
    return {
      v: VERSION, savedAt: now, createdAt: now, active: 0, businesses: [], tutorial: 0,
      daily: { last: null, streak: 0 },
      agency: { freeAt: 0, shards: 0 },
      quests: { day: null, list: [], chest: false },
      rush: { until: 0, readyAt: 0 },
      net: { invited: 0, claimed: [], refBonus: false }
    };
  }
  function valid(s) {
    return s && (s.v === 1 || s.v === VERSION) && Array.isArray(s.businesses) && typeof s.savedAt === 'number';
  }
  // Миграция и починка: старые сохранения (v1) — без редкости, потребностей, агентства
  function normalize(s) {
    var now = Date.now();
    s.daily = s.daily || { last: null, streak: 0 };
    s.agency = s.agency || { freeAt: 0, shards: 0 };
    if (!isFinite(s.agency.shards)) s.agency.shards = 0;
    s.quests = s.quests || { day: null, list: [], chest: false };
    s.rush = s.rush || { until: 0, readyAt: 0 };
    s.net = s.net || { invited: 0, claimed: [], refBonus: false };
    if (!Array.isArray(s.net.claimed)) s.net.claimed = [];
    s.businesses = s.businesses.filter(function (b) { return b && BIZ[b.type]; });
    s.businesses.forEach(function (b) {
      b.upgrades = b.upgrades || { boost: 0, chairs: 0, pr: 0 };
      if (!(b.room >= 0 && b.room < B.ROOMS.length)) b.room = 0;
      var need = B.COLS * B.ROOMS[b.room].rows;
      b.grid = (b.grid || []).map(function (v) { v = Number(v) || 0; return B.lvl(v) >= 1 && B.lvl(v) <= B.MAX_LEVEL && B.rar(v) <= 3 ? v : 0; });
      while (b.grid.length < need) b.grid.push(0);
      // v1: сохранение было в момент savedAt — шкалы считаем полными на тот момент
      if (!Array.isArray(b.needs) || b.needs.length !== 3) { var t0 = s.savedAt || now; b.needs = [t0, t0, t0]; }
      b.inbox = Array.isArray(b.inbox) ? b.inbox.filter(function (v) { return v > 0; }) : [];
      b.seen = Math.max(b.seen || 1, B.maxLevel(b));
      if (!isFinite(b.money)) b.money = 0;
      if (!isFinite(b.earned)) b.earned = 0;
    });
    if (!(s.active >= 0 && s.active < s.businesses.length)) s.active = 0;
    s.v = VERSION;
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
  function staff(lvl) { return def().staff[B.lvl(lvl) - 1]; }
  function rushOn(now) { return (now || Date.now()) < state.rush.until; }
  function income(now) { return B.incomePerSec(biz(), now || Date.now(), rushOn(now)); }

  // ---------- DOM ----------
  function $(id) { return document.getElementById(id); }
  var el = {
    app: $('app'), choose: $('choose'), money: $('money'), rate: $('rate'), chipRoom: $('chip-room'), chipLock: $('chip-lock'),
    grid: $('grid'), board: $('board'), needs: $('needs'), nextRoom: $('next-room'), hint: $('hint'), hire: $('btn-hire'), rush: $('btn-rush'),
    daily: $('btn-daily'), dailyDot: $('daily-dot'), quests: $('btn-quests'), questsDot: $('quests-dot'), shopDot: $('shop-dot'),
    banner: $('invite-banner'), fx: $('fx'), modal: $('modal'), toast: $('toast'), tutor: $('tutor'), tabbar: $('tabbar')
  };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var toastTimer;
  function toast(text) {
    el.toast.textContent = text;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove('show'); }, 2400);
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

  // ---------- Сотрудник: карточка ----------
  function rarCls(v) { var r = B.rar(v); return r ? ' r' + r : ''; }
  function rarTag(v) { var r = B.rar(v); return r ? '<span class="rt">' + RARITY[r].s + '</span>' : ''; }
  function empName(v, d) { var s = (d || def()).staff[B.lvl(v) - 1]; return s.n + (B.rar(v) ? ' · ' + RARITY[B.rar(v)].n.toLowerCase() : ''); }

  // ---------- Выбор бизнеса ----------
  function showChoose() {
    el.app.hidden = true; el.choose.hidden = false;
    var list = $('choose-list'); list.innerHTML = '';
    BIZ_ORDER.forEach(function (type) {
      var d = BIZ[type];
      var card = document.createElement('button');
      card.className = 'biz'; card.dataset.type = type;
      card.innerHTML = '<div class="bi">' + d.icon + '</div><h3>' + esc(d.name) + '</h3><p>' + esc(d.desc) + '</p>' +
        '<div class="ladder">' + d.staff.map(function (s) { return s.e; }).join('') + '</div>';
      card.onclick = function () { chooseDetails(type); };
      list.appendChild(card);
    });
  }
  function chooseDetails(type) {
    var d = BIZ[type];
    haptic('select');
    modal('<div class="big-ico">' + d.icon + '</div><h2>' + esc(d.name) + '</h2><p>' + esc(d.desc) + '</p>' +
      '<div class="path">' + d.rooms.map(function (r) { return '<span>' + r.e + ' ' + esc(r.s) + '</span>'; }).join('<em>→</em>') + '</div>' +
      '<div class="staff-row">' + d.staff.map(function (s, i) { return '<div><b>' + s.e + '</b><small>' + (i + 1) + '</small></div>'; }).join('') + '</div>' +
      '<p class="small-l">Команда хочет: ' + d.needs.map(function (n) { return n.e + ' ' + esc(n.n.toLowerCase()); }).join(', ') + '</p>' +
      '<div class="btns"><button class="btn btn-primary" data-start>Открыть ' + d.icon + '</button><button class="btn btn-dark" data-close>Посмотреть другие</button></div>',
      function (root, close) {
        root.querySelector('[data-close]').onclick = close;
        root.querySelector('[data-start]').onclick = function () { close(); startBusiness(type); };
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
    fitGrid();
  }
  // Высота клеток подстраивается под экран: сетка влезает без прокрутки, пока клетка не меньше 52px
  function fitGrid() {
    if (el.app.hidden || !cells.length) return;
    var rows = Math.ceil(cells.length / B.COLS);
    var cs = getComputedStyle(el.board);
    var gap = parseFloat(cs.rowGap) || 10;
    var avail = el.board.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - el.needs.offsetHeight - el.nextRoom.offsetHeight - gap * 2;
    var colW = (el.grid.clientWidth - 8 * (B.COLS - 1)) / B.COLS;
    var h = Math.min(colW * 0.94, (avail - 8 * (rows - 1)) / rows);
    h = Math.max(52, Math.floor(h));
    el.grid.style.gridAutoRows = h + 'px';
    el.grid.style.setProperty('--ch', h + 'px');
  }
  function cellHtml(v) {
    var s = staff(v);
    return '<span class="lv">' + B.lvl(v) + '</span>' + rarTag(v) + '<span class="em">' + s.e + '</span><span class="nm">' + esc(s.s) + '</span>';
  }
  function renderCell(i) {
    var v = biz().grid[i], c = cells[i];
    if (!c) return;
    c.className = 'cell' + (v ? rarCls(v) : ' empty');
    c.innerHTML = v ? cellHtml(v) : '';
    c.setAttribute('aria-label', v ? empName(v) + ', уровень ' + B.lvl(v) : 'Пустая клетка');
  }
  function renderCells() {
    for (var i = 0; i < cells.length; i++) renderCell(i);
    markPairs();
  }
  function markPairs() {
    var g = biz().grid, count = {};
    g.forEach(function (v) { var l = B.lvl(v); if (v && l < B.MAX_LEVEL) count[l] = (count[l] || 0) + 1; });
    cells.forEach(function (c, i) { c.classList.toggle('pair', !!(g[i] && count[B.lvl(g[i])] >= 2)); });
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

  // Сотрудники из пачек и наград: сначала в свободные клетки, остальные ждут в «приёмной»
  function placeEmployees(list) {
    var b = biz(), placed = [];
    list.forEach(function (v) {
      var i = b.grid.indexOf(0);
      if (i >= 0) { b.grid[i] = v; placed.push(i); } else b.inbox.push(v);
      if (B.lvl(v) > b.seen) { b.seen = B.lvl(v); }
    });
    placed.forEach(function (i) { renderCell(i); anim(cells[i], 'spawn'); });
    markPairs(); updateUi(true); save();
    return list.length - placed.length;
  }

  function hire() {
    var b = biz(), i = freeCell();
    if (b.inbox.length) {
      if (i < 0) { toast('Нет свободного места — объедини одинаковых'); haptic('error'); return; }
      b.grid[i] = b.inbox.shift();
      renderCell(i); markPairs(); anim(cells[i], 'spawn'); haptic('light');
      updateUi(true); save();
      return;
    }
    var cost = B.hireCost(b);
    if (i < 0) { toast('Нет свободного места — объедини одинаковых'); haptic('error'); return; }
    if (b.money < cost) { toast('Не хватает ' + rub(cost - b.money)); haptic('error'); return; }
    b.money -= cost; b.hires++; b.grid[i] = 1;
    renderCell(i); markPairs(); anim(cells[i], 'spawn');
    haptic('light');
    questProgress('hire');
    if (state.tutorial < 2) { state.tutorial++; tutorial(); }
    updateUi(true);
  }

  function tapCell(i) {
    var b = biz(), v = b.grid[i];
    if (!v) return;
    var c = cells[i], now = Date.now();
    anim(c, 'tapped');
    bubbleAt(c, '«' + staff(v).j + '»');
    if ((tapCd[i] || 0) > now) return;
    tapCd[i] = now + B.TAP_COOLDOWN * 1000;
    var gain = B.cellIncome(v) * B.incomeMult(b) * B.TAP_SECONDS * (rushOn(now) ? B.RUSH_MULT : 1);
    b.money += gain; b.earned += gain;
    floatAt(c, '+' + fmtRate(gain));
    var bar = document.createElement('i'); bar.className = 'cd';
    c.appendChild(bar);
    setTimeout(function () { bar.remove(); }, B.TAP_COOLDOWN * 1000);
    haptic('light');
    questProgress('tap');
    updateUi();
  }

  function drop(from, to) {
    var b = biz(), g = b.grid;
    if (from === to || to == null) return;
    var a = g[from], t = g[to];
    if (!t) {
      g[to] = a; g[from] = 0; delete tapCd[from];
      haptic('select');
    } else if (B.canMerge(a, t)) {
      var res = B.mergeResult(a, t, Math.random());
      g[to] = res.v; g[from] = 0; b.merges++;
      delete tapCd[from];
      renderCell(from); renderCell(to);
      anim(cells[to], 'pop');
      floatAt(cells[to], res.up ? '✨ ' + RARITY[B.rar(res.v)].n + '!' : '+1 уровень', res.up ? 'lvl up r' + B.rar(res.v) : 'lvl');
      haptic('success');
      questProgress('merge');
      if (state.tutorial === 2) { state.tutorial = 3; tutorial(); toast('Так и растёт компания! Дальше — сам 🚀'); }
      if (B.lvl(res.v) > b.seen) { b.seen = B.lvl(res.v); newLevel(res.v); }
      else if (res.up) toast('✨ Повезло: слияние подняло редкость — ' + RARITY[B.rar(res.v)].n.toLowerCase() + ' (доход ×' + String(B.RARITY_MULT[B.rar(res.v)]).replace('.', ',') + ')');
      markPairs(); updateUi(true);
      return;
    } else {
      if (B.lvl(t) === B.lvl(a)) toast('Это уже максимальный уровень 👑');
      g[to] = a; g[from] = t;
      var tmp = tapCd[from]; tapCd[from] = tapCd[to]; tapCd[to] = tmp;
      haptic('select');
    }
    renderCell(from); renderCell(to); markPairs(); updateUi(true);
  }

  function newLevel(v) {
    var s = staff(v), b = biz(), lvl = B.lvl(v);
    modal('<div class="big-ico">' + s.e + '</div><h2>Новый сотрудник: ' + esc(s.n) + '</h2>' +
      '<p>Уровень ' + lvl + ' · приносит ' + fmtRate(B.cellIncome(v) * B.incomeMult(b)) + ' ₽/сек' + (B.rar(v) ? ' · ' + RARITY[B.rar(v)].n.toLowerCase() : '') + '</p>' +
      '<div class="quote">«' + esc(s.j) + '»</div>' +
      (lvl === B.HOLDING_UNLOCK_LEVEL ? '<p>🏗️ Ты дорос до 5-го уровня — второй бизнес холдинга появится в следующем обновлении.</p>' : '') +
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
      gh.style.setProperty('--ch', r.height + 'px');
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
        cells[over].classList.add(B.canMerge(g[over], g[drag.from]) ? 'can-merge' : 'over');
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

  // ---------- Забота о сотрудниках ----------
  function renderNeeds() {
    var b = biz(), d = def(), now = Date.now(), html = '';
    for (var i = 0; i < 3; i++) {
      var lv = B.needLevel(b, i, now), pct = Math.round(lv * 100);
      var cls = lv < 0.25 ? 'bad' : lv < B.NEED_SAFE ? 'low' : '';
      html += '<button class="need ' + cls + (B.canCare(b, i, now) ? ' can' : '') + '" data-need="' + i + '" aria-label="' + esc(d.needs[i].n) + ' ' + pct + '%">' +
        '<span class="ne">' + d.needs[i].e + '</span><span class="nx"><span class="nt">' + esc(d.needs[i].n) + '</span>' +
        '<i class="nb"><b style="width:' + pct + '%"></b></i></span></button>';
    }
    var f = B.needsFactor(b, now);
    if (el.needs.innerHTML !== html) el.needs.innerHTML = html;
    el.needs.classList.toggle('tired', f < 1);
  }
  el.needs.addEventListener('click', function (e) {
    var t = e.target.closest('[data-need]'); if (!t) return;
    var i = Number(t.dataset.need), b = biz(), n = def().needs[i], now = Date.now();
    if (!B.canCare(b, i, now)) {
      var left = (b.needs[i] + B.NEED_COOLDOWN_MIN * MIN - now) / 1000;
      toast(n.e + ' Только что было — ещё раз через ' + fmtDur(left)); haptic('error'); return;
    }
    var was = B.needLevel(b, i, now);
    b.needs[i] = now;
    haptic('success'); toast(n.e + ' ' + n.t);
    floatAt(t, '+' + Math.round((1 - was) * 100) + '%');
    questProgress('care');
    renderNeeds(); updateUi(true); save();
  });

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
    var b = biz(), lvl = b.upgrades[id] || 0, U = B.UPGRADES[id], u = def().upg[id];
    var info = { lvl: lvl, max: lvl >= U.max, cost: B.upgradeCost(id, lvl), e: u.e, n: u.n };
    if (id === 'boost') info.d = '+10% к доходу за уровень · сейчас +' + (lvl * 10) + '%';
    if (id === 'chairs') info.d = 'Офлайн-доход копится ' + B.OFFLINE_CAP_HOURS[lvl] + ' ч' + (info.max ? '' : ' → ' + B.OFFLINE_CAP_HOURS[lvl + 1] + ' ч');
    if (id === 'pr') info.d = 'Найм дешевле на 5% за уровень · сейчас −' + (lvl * 5) + '%';
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
        '<div class="d">' + fmtRate(B.levelIncome(lvl)) + ' ₽/сек × бонусы · редкий ×1,5, эпик ×2,5, лега ×5</div>' +
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
      questProgress('upgrade');
      renderUpgrades(); updateUi(true); save();
      return;
    }
    if (e.target.closest('[data-rooms]')) showRooms();
  });

  // ---------- Кадровое агентство ----------
  var PACK_ORDER = ['free', 'standard', 'premium', 'star'];
  function oddsHtml(chances) {
    var bar = '', lab = '', first = -1, last = -1;
    chances.forEach(function (c, r) {
      if (!c) return;
      if (first < 0) first = r; last = r;
      bar += '<i class="o' + r + '" style="flex:' + c + '"></i>';
      lab += '<span class="l' + r + '">' + ['Обычн.', 'Редк.', 'Эпик', 'Лега'][r] + ' ' + c + '%</span>';
    });
    return '<div class="odds-mm"><span>мин: <b class="l' + first + '">' + RARITY[first].n + '</b></span><span>макс: <b class="l' + last + '">' + RARITY[last].n + '</b></span></div>' +
      '<div class="odds">' + bar + '</div><div class="odds-l">' + lab + '</div>';
  }
  function packBtn(id) {
    var P = B.PACKS[id], now = Date.now();
    if (id === 'free') {
      var left = (state.agency.freeAt - now) / 1000;
      return left > 0 ? '<button class="buy poor" data-pack="free">⏳ ' + fmtDur(left) + '</button>' : '<button class="buy glow" data-pack="free">Открыть</button>';
    }
    if (id === 'standard') { var pr = B.packPrice(biz()); return '<button class="buy ' + (biz().money >= pr ? '' : 'poor') + '" data-pack="standard">' + rub(pr) + '</button>'; }
    return '<button class="buy soon-btn" data-pack="' + id + '">скоро — за ⭐ ' + P.stars + '</button>';
  }
  function renderAgency() {
    var a = state.agency, b = biz(), html = '';
    var sh = Math.min(a.shards, B.SHARDS_FOR_RARE);
    html += '<div class="card shards"><div class="ico">🧩</div><div class="txt"><div class="t">Осколки резюме <small>' + a.shards + '/' + B.SHARDS_FOR_RARE + '</small></div>' +
      '<div class="d">Собери ' + B.SHARDS_FOR_RARE + ' — получишь редкого сотрудника. Осколки — в календаре и заданиях дня.</div>' +
      '<div class="pips">' + Array.from({ length: B.SHARDS_FOR_RARE }, function (_, k) { return '<i class="' + (k < sh ? 'on' : '') + '"></i>'; }).join('') + '</div></div>' +
      (a.shards >= B.SHARDS_FOR_RARE ? '<button class="buy glow" data-shards>Собрать</button>' : '') + '</div>';
    if (b.inbox.length) html += '<div class="note-box">🪑 В приёмной ждут места: <b>' + b.inbox.length + '</b> — освободи клетку и нажми «Из приёмной» в офисе.</div>';
    PACK_ORDER.forEach(function (id) {
      var P = B.PACKS[id], T = C.PACKS[id];
      html += '<div class="pack p-' + id + '"><div class="pack-top"><div class="pack-ico">' + T.e + '</div><div class="txt"><div class="t">' + esc(T.n) + '</div>' +
        '<div class="d">' + P.count + ' ' + plural(P.count, 'резюме', 'резюме', 'резюме') + ' · ур. ' + (P.lvl[0] === P.lvl[1] ? P.lvl[0] : P.lvl[0] + '–' + P.lvl[1]) + ' · ' + esc(T.d) + '</div></div>' +
        packBtn(id) + '</div>' + oddsHtml(P.chances) + '</div>';
    });
    html += '<div class="card info"><div class="txt"><div class="t">Как работает редкость</div><div class="d">' +
      '<span class="l1">Редкий</span> — доход ×1,5, <span class="l2">эпический</span> — ×2,5, <span class="l3">легендарный</span> — ×5.<br>' +
      'Сливать можно двух одного уровня — редкость не мешает. Результат берёт <b>лучшую</b> редкость из двух. ' +
      'Если оба одной редкости, есть шанс, что новый станет на ступень выше: обычные — 3%, редкие — 10%, эпические — 5%.<br>Кнопка «Нанять» даёт обычных.</div></div></div>';
    $('agency').innerHTML = html;
  }
  $('agency').addEventListener('click', function (e) {
    if (e.target.closest('[data-shards]')) {
      if (state.agency.shards < B.SHARDS_FOR_RARE) return;
      state.agency.shards -= B.SHARDS_FOR_RARE;
      reveal([B.cell(2, 1)], '🧩 Из осколков собран сотрудник!', 'shards');
      return;
    }
    var t = e.target.closest('[data-pack]'); if (!t) return;
    var id = t.dataset.pack, now = Date.now();
    if (id === 'free') {
      if (state.agency.freeAt > now) { toast('Следующая бесплатная — через ' + fmtDur((state.agency.freeAt - now) / 1000)); haptic('error'); return; }
      state.agency.freeAt = now + B.PACKS.free.cooldownH * HOUR;
      openPack('free');
    } else if (id === 'standard') {
      var pr = B.packPrice(biz());
      if (biz().money < pr) { toast('Не хватает ' + rub(pr - biz().money)); haptic('error'); return; }
      biz().money -= pr;
      openPack('standard');
    } else {
      toast('⭐ Оплата Telegram Stars появится скоро'); haptic('select');
    }
  });
  function openPack(id) {
    questProgress('pack');
    reveal(B.rollPack(id, Math.random), C.PACKS[id].e + ' ' + C.PACKS[id].n, id);
  }
  // Анимация открытия: пачка трясётся и раскрывается, карточки переворачиваются по одной
  function reveal(list, title, packId) {
    var d = def(), best = 0;
    list.forEach(function (v) { best = Math.max(best, B.rar(v)); });
    var cards = list.map(function (v, k) {
      var s = d.staff[B.lvl(v) - 1];
      return '<div class="rc' + rarCls(v) + '" style="--d:' + (0.75 + k * 0.32) + 's"><div class="rc-in"><div class="rc-back">📄</div>' +
        '<div class="rc-front"><span class="lv">' + B.lvl(v) + '</span>' + rarTag(v) + '<b>' + s.e + '</b><small>' + esc(s.s) + '</small></div></div></div>';
    }).join('');
    var doneAt = 0.75 + list.length * 0.32 + 0.3;
    modal('<div class="pack-open best' + best + '"><div class="po-box">' + (C.PACKS[packId] ? C.PACKS[packId].e : '🎁') + '</div>' +
      '<h2>' + esc(title) + '</h2><div class="reveal n' + list.length + '">' + cards + '</div>' +
      '<p class="po-sum" style="animation-delay:' + doneAt + 's">' + summary(list) + '</p></div>' +
      '<div class="btns"><button class="btn btn-primary" data-take style="animation-delay:' + doneAt + 's">Забрать в офис</button></div>',
      function (root, close) {
        haptic('medium');
        setTimeout(function () { haptic(best >= 2 ? 'success' : 'light'); }, doneAt * 1000);
        root.querySelector('[data-take]').onclick = function () {
          close();
          var waiting = placeEmployees(list);
          if (waiting) toast('🪑 Мест не хватило — ' + waiting + ' ждут в приёмной');
          if (activeView === 'shop') renderAgency();
        };
      }, true);
  }
  function summary(list) {
    var cnt = [0, 0, 0, 0];
    list.forEach(function (v) { cnt[B.rar(v)]++; });
    var parts = [];
    for (var r = 3; r >= 0; r--) if (cnt[r]) parts.push('<span class="l' + r + '">' + RARITY[r].n + ': ' + cnt[r] + '</span>');
    return parts.join(' · ');
  }

  // ---------- Календарь наград ----------
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function dayNum(key) { var p = key.split('-').map(Number); return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000); }
  function dailyState() {
    var today = dayKey(), dl = state.daily;
    if (dl.last === today) return { claimed: true, streak: dl.streak };
    var cont = dl.last && dayNum(today) - dayNum(dl.last) === 1;
    return { claimed: false, streak: cont ? dl.streak + 1 : 1, lost: !!dl.last && !cont && dl.streak > 1 };
  }
  function calDay(streak) { return (Math.max(streak, 1) - 1) % 7; }
  function calInfo(k) {
    var c = B.CALENDAR[k];
    if (c.type === 'money') return { e: '💰', s: 'деньги', big: rub(B.minutesIncome(biz(), c.minutes, c.min)) };
    if (c.type === 'shards') return { e: '🧩', s: '×' + c.n, big: '🧩 ' + c.n + ' ' + plural(c.n, 'осколок', 'осколка', 'осколков') + ' резюме' };
    return { e: C.PACKS[c.pack].e, s: 'пачка', big: C.PACKS[c.pack].e + ' Пачка «' + C.PACKS[c.pack].n + '»' };
  }
  function showDaily() {
    var ds = dailyState(), cur = calDay(ds.streak), week = Math.floor((Math.max(ds.streak, 1) - 1) / 7) + 1;
    var row = '';
    for (var k = 0; k < 7; k++) {
      var inf = calInfo(k);
      var cls = k < cur || (ds.claimed && k === cur) ? 'done' : (!ds.claimed && k === cur ? 'today' : '');
      row += '<div class="' + cls + (k === 6 ? ' d7' : '') + '"><small>Д' + (k + 1) + '</small><b>' + (cls === 'done' ? '✓' : inf.e) + '</b><span>' + inf.s + '</span></div>';
    }
    var html = '<div class="big-ico">🗓️</div><h2>Календарь наград</h2>' +
      '<p>Заходи каждый день подряд — на 7-й день пачка «Премиум», дальше по кругу. Пропустишь день — начнёшь сначала.</p>' +
      '<div class="streak">' + row + '</div>' + (week > 1 ? '<p class="small-l">Серия: ' + ds.streak + ' ' + plural(ds.streak, 'день', 'дня', 'дней') + ' подряд · неделя ' + week + '</p>' : '');
    if (ds.claimed) {
      var nx = calInfo(calDay(ds.streak + 1));
      html += '<p>Сегодня уже забрал ✅<br>Завтра: ' + nx.big + '</p><div class="btns"><button class="btn btn-dark" data-close>Ок</button></div>';
    } else {
      html += (ds.lost ? '<p>Серия прервалась — начинаем с 1-го дня.</p>' : '') +
        '<div class="amount">' + calInfo(cur).big + '</div><div class="btns"><button class="btn btn-primary" data-claim>Забрать</button>' +
        '<button class="btn btn-ghost" data-ad>📺 ×2 за рекламу · скоро</button></div>';
    }
    modal(html, function (root, close) {
      var c = root.querySelector('[data-close]'); if (c) c.onclick = close;
      var ad = root.querySelector('[data-ad]'); if (ad) ad.onclick = function () { toast('Реклама за награду появится позже'); };
      var cl = root.querySelector('[data-claim]');
      if (cl) cl.onclick = function () {
        var d2 = dailyState();
        if (d2.claimed) return close();
        state.daily = { last: dayKey(), streak: d2.streak };
        close();
        giveCalendar(B.CALENDAR[calDay(d2.streak)]);
        haptic('success'); updateUi(true); save(true);
      };
    });
  }
  function giveCalendar(c) {
    if (c.type === 'money') { var r = B.minutesIncome(biz(), c.minutes, c.min); biz().money += r; biz().earned += r; floatAt(el.money, '+' + rub(r)); }
    else if (c.type === 'shards') { addShards(c.n); }
    else openPack(c.pack);
  }
  function addShards(n) {
    state.agency.shards += n;
    toast('🧩 +' + n + ' ' + plural(n, 'осколок', 'осколка', 'осколков') + ' резюме (' + state.agency.shards + '/' + B.SHARDS_FOR_RARE + ')' + (state.agency.shards >= B.SHARDS_FOR_RARE ? ' — собери редкого в агентстве!' : ''));
  }

  // ---------- Задания дня ----------
  function ensureQuests() {
    var today = dayKey(), q = state.quests;
    if (q.day === today) return q;
    var seed = dayNum(today), pool = B.QUESTS.slice(), list = [];
    while (list.length < B.QUEST_COUNT && pool.length) {
      seed = (seed * 9301 + 49297) % 233280;
      var x = pool.splice(seed % pool.length, 1)[0];
      list.push({ id: x.id, need: x.need, have: 0, claimed: false });
    }
    state.quests = { day: today, list: list, chest: false };
    return state.quests;
  }
  function questProgress(id, n) {
    if (!state || state.tutorial < 3) return; // во время обучения не считаем
    var q = ensureQuests(), changed = false;
    q.list.forEach(function (x) { if (x.id === id && x.have < x.need) { x.have = Math.min(x.need, x.have + (n || 1)); changed = true; if (x.have >= x.need) toast('📋 Задание выполнено — забери награду'); } });
    if (changed) updateDots();
  }
  function questReward() { return B.minutesIncome(biz(), B.QUEST_REWARD_MIN, B.QUEST_REWARD_FLOOR); }
  function showQuests() {
    var q = ensureQuests(), r = questReward(), all = q.list.every(function (x) { return x.claimed; });
    var html = '<div class="big-ico">📋</div><h2>Задания дня</h2><p>Каждый день — три новых. За каждое — ' + rub(r) + ', за все три — сундук.</p><div class="list left">';
    q.list.forEach(function (x, k) {
      var Q = C.QUESTS[x.id], done = x.have >= x.need;
      html += '<div class="card q' + (x.claimed ? ' cur' : '') + '"><div class="ico">' + Q.e + '</div><div class="txt"><div class="t">' + esc(Q.n(x.need)) + '</div>' +
        '<div class="qbar"><i style="width:' + Math.round(x.have / x.need * 100) + '%"></i></div><div class="d">' + x.have + ' / ' + x.need + '</div></div>' +
        (x.claimed ? '<button class="buy max">✓</button>' : '<button class="buy ' + (done ? 'glow' : 'poor') + '" data-q="' + k + '">' + (done ? 'Забрать' : rub(r)) + '</button>') + '</div>';
    });
    html += '<div class="card chest' + (q.chest ? ' cur' : '') + '"><div class="ico">🧰</div><div class="txt"><div class="t">Сундук за все три</div><div class="d">📁 пачка «Стандарт» + 🧩 1 осколок</div></div>' +
      (q.chest ? '<button class="buy max">✓</button>' : '<button class="buy ' + (all ? 'glow' : 'poor') + '" data-chest>' + (all ? 'Открыть' : '🔒') + '</button>') + '</div>';
    html += '</div><div class="btns" style="margin-top:14px"><button class="btn btn-dark" data-close>Закрыть</button></div>';
    modal(html, function (root, close) {
      root.querySelector('[data-close]').onclick = close;
      root.querySelectorAll('[data-q]').forEach(function (bt) {
        bt.onclick = function () {
          var x = state.quests.list[Number(bt.dataset.q)];
          if (x.have < x.need) { toast('Ещё ' + (x.need - x.have) + ' — и награда твоя'); return; }
          x.claimed = true;
          var rr = questReward(); biz().money += rr; biz().earned += rr;
          haptic('success'); close(); floatAt(el.money, '+' + rub(rr)); updateUi(true); save(); showQuests();
        };
      });
      var ch = root.querySelector('[data-chest]');
      if (ch) ch.onclick = function () {
        if (!state.quests.list.every(function (x) { return x.claimed; })) { toast('Сначала забери все три задания'); return; }
        state.quests.chest = true; close();
        addShards(1); openPack('standard'); save();
      };
    });
  }

  // ---------- Аврал ×2 ----------
  function rushClick() {
    var now = Date.now(), r = state.rush;
    if (now < r.until) { toast('⚡ Аврал идёт: ещё ' + fmtClock((r.until - now) / 1000)); return; }
    if (now < r.readyAt) { toast('⚡ Команда отдыхает после аврала. Снова — через ' + fmtDur((r.readyAt - now) / 1000) + ' (скоро — сразу за рекламу)'); haptic('error'); return; }
    if (state.tutorial < 3) { toast('Сначала закончи обучение'); return; }
    state.rush = { until: now + B.RUSH_MIN * MIN, readyAt: now + B.RUSH_COOLDOWN_H * HOUR };
    haptic('success'); toast('⚡ Аврал! Доход ×' + B.RUSH_MULT + ' на ' + B.RUSH_MIN + ' минут');
    anim(el.rush, 'pop'); updateUi(true); save();
  }

  // ---------- Офлайн-доход ----------
  function offline(sec, fromMs) {
    var b = biz(), cap = B.offlineCapSec(b), t = Math.min(sec, cap);
    var res = B.offlineGain(b, fromMs, t, state.rush.until);
    var gain = res.gain;
    if (gain < 1) return;
    var lost = Math.round((1 - res.factor) * 100);
    modal('<div class="big-ico">💼</div><h2>Пока тебя не было</h2>' +
      '<p>Команда работала ' + fmtDur(t) + (sec > cap ? ' (больше не влезло — лимит ' + fmtDur(cap) + ', прокачай «' + esc(def().upg.chairs.n) + '»)' : '') + '</p>' +
      (lost >= 1 ? '<p class="warn">😩 Команда устала — доход был ниже на ' + lost + '%. Позаботься о ней: ' + def().needs.map(function (n) { return n.e; }).join(' ') + ' над сеткой.</p>' : '') +
      '<div class="amount">+' + rub(gain) + '</div><div class="btns"><button class="btn btn-primary" data-take>Забрать</button><button class="btn btn-ghost" data-ad>📺 ×2 за рекламу · скоро</button></div>',
      function (root, close) {
        root.querySelector('[data-ad]').onclick = function () { toast('Реклама за награду появится позже'); };
        root.querySelector('[data-take]').onclick = function () {
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
      text = step === 0 ? 'Нажми «Нанять» — придёт первый сотрудник: ' + staff(1).n.toLowerCase() : 'Отлично! Найми ещё одного';
      el.hire.classList.add('glow');
      r = el.hire.getBoundingClientRect();
      t.innerHTML = '<div class="tip down"><span class="n">' + (step + 1) + '</span>' + text + '</div>';
      var tip = t.firstChild;
      tip.style.top = (r.top - tip.offsetHeight - 16) + 'px';
      styleArrow(tip, r.left + r.width / 2 - tip.getBoundingClientRect().left);
    } else {
      var g = biz().grid, a = -1, bIdx = -1;
      for (var i = 0; i < g.length; i++) if (B.lvl(g[i]) === 1) { if (a < 0) a = i; else if (bIdx < 0) bIdx = i; }
      if (a < 0 || bIdx < 0) { t.innerHTML = ''; return; }
      var ra = cells[a].getBoundingClientRect(), rb = cells[bIdx].getBoundingClientRect();
      html = '<div class="tip up" style="top:' + (ra.bottom + 18) + 'px"><span class="n">3</span>Перетащи одного на другого — получишь: ' + staff(2).e + ' ' + esc(staff(2).n) + '</div>' +
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

  // ---------- Друзья ----------
  function stepDef(need) {
    for (var i = 0; i < C.FRIEND_STEPS.length; i++) if (C.FRIEND_STEPS[i].need === need) return C.FRIEND_STEPS[i];
    return null;
  }
  function stepIcon(need) { var d = stepDef(need); return d ? d.e : '🎁'; }
  function stepLabel(r) { var d = stepDef(r.need); return d ? d.s : String(r.title || '').replace(/^[^0-9A-Za-zА-Яа-яЁё«]+/, ''); }
  function invite() {
    var N = net();
    if (N && typeof N.invite === 'function') { try { N.invite(); return; } catch (e) {} }
    var url = 'https://t.me/share/url?url=' + encodeURIComponent('https://t.me/startup_zero_bot') +
      '&text=' + encodeURIComponent('Строю бизнес с нуля 🚀 Заходи — обгони меня!');
    if (inTg) { try { tg.openTelegramLink(url); return; } catch (e) {} }
    window.open(url, '_blank');
  }
  function ladderHtml(invited, rewards, live) {
    var maxNeed = rewards[rewards.length - 1].need;
    var html = '<div class="ladder-steps">';
    rewards.forEach(function (r) {
      var reached = invited >= r.need;
      var cls = r.claimed ? 'claimed' : (r.ready || (live && reached)) ? 'ready' : reached ? 'reached' : '';
      html += '<div class="step ' + cls + (r.need === 3 ? ' main' : '') + '"><div class="st-ico">' + (r.claimed ? '✓' : stepIcon(r.need)) + '</div>' +
        '<b>' + r.need + '</b><small>' + esc(stepLabel(r)) + '</small>' +
        (live && cls === 'ready' ? '<button class="buy glow" data-claim-f="' + r.need + '">Забрать</button>' : '') + '</div>';
    });
    // полоска идёт от ступени к ступени (ступени стоят равномерно, а числа друзей — нет)
    var n = rewards.length, x = 0, prevNeed = 0, prevX = 0;
    for (var k = 0; k < n; k++) {
      var xk = (k + 0.5) / n;
      if (invited >= rewards[k].need) { x = xk; prevNeed = rewards[k].need; prevX = xk; continue; }
      x = prevX + (xk - prevX) * (invited - prevNeed) / (rewards[k].need - prevNeed);
      break;
    }
    if (invited >= maxNeed) x = 1;
    html += '</div><div class="ladder-line"><i style="width:' + (x * 100).toFixed(1) + '%"></i></div>';
    return html;
  }
  var friendsReq = 0;
  function renderFriends() {
    var box = $('friends-box'), N = net();
    var head = '<div class="hero-card"><div class="hc-ico">🤝</div><div><b>Зови друзей — получай сотрудников</b><p>Другу — подарок на старте, тебе — награды по ступеням. За 3 друзей — бесплатный редкий сотрудник.</p></div></div>';
    if (!N) {
      var steps = C.FRIEND_STEPS.map(function (s) { return { need: s.need, title: s.title, claimed: false, ready: false }; });
      box.innerHTML = head + '<div class="card col"><div class="t">Приглашено: <span class="acc">0</span></div>' + ladderHtml(0, steps, false) + '</div>' +
        '<button class="btn btn-primary btn-wide" data-invite>📨 Пригласить друга</button>' +
        '<p class="muted-c">Список друзей и награды появятся, когда игра подключится к серверу. Ссылку можно отправить уже сейчас.</p>';
      return;
    }
    box.innerHTML = head + '<div class="loading">⏳ Загружаем друзей…</div>';
    var my = ++friendsReq;
    N.friends().then(function (data) {
      if (my !== friendsReq || activeView !== 'friends') return;
      data = data || {};
      if (data.offline) throw new Error('offline');
      var invited = data.invited || 0, rewards = (data.rewards && data.rewards.length ? data.rewards : C.FRIEND_STEPS.map(function (s) { return { need: s.need, title: s.title }; }));
      state.net.invited = invited;
      rewards.forEach(function (r) { if (r.claimed && state.net.claimed.indexOf(r.need) < 0) state.net.claimed.push(r.need); });
      var list = (data.list || []).map(function (f) {
        var d = BIZ[f.business];
        return '<div class="card fr"><div class="ico">' + (d ? d.icon : '🏢') + '</div><div class="txt"><div class="t">' + esc(f.name || 'Друг') + '</div>' +
          '<div class="d">' + (d ? esc(d.name) + ' · ' : '') + 'ур. ' + (f.level || 1) + ' · ' + fmtRate(f.income || 0) + ' ₽/сек</div></div></div>';
      }).join('');
      box.innerHTML = head + '<div class="card col"><div class="t">Приглашено: <span class="acc">' + invited + '</span></div>' + ladderHtml(invited, rewards, true) + '</div>' +
        '<button class="btn btn-primary btn-wide" data-invite>📨 Пригласить друга</button>' +
        '<h3 class="sub-title">Твои друзья</h3>' + (list ? '<div class="list">' + list + '</div>' : '<p class="muted-c">Пока никого. Отправь ссылку — друг появится здесь, когда откроет игру.</p>');
      updateUi(true);
    }).catch(function () {
      if (my !== friendsReq || activeView !== 'friends') return;
      box.innerHTML = head + '<div class="error-box">📡 Нет связи с сервером<br><small>Проверь интернет и попробуй ещё раз</small><button class="btn btn-dark" data-retry="friends">Повторить</button></div>' +
        '<button class="btn btn-primary btn-wide" data-invite>📨 Пригласить друга</button>';
    });
  }
  $('view-friends').addEventListener('click', function (e) {
    if (e.target.closest('[data-invite]')) return invite();
    if (e.target.closest('[data-retry]')) return renderFriends();
    var c = e.target.closest('[data-claim-f]'), N = net();
    if (c && N) {
      var need = Number(c.dataset.claimF);
      c.disabled = true; c.textContent = '…';
      N.claimFriendReward(need).then(function (res) {
        if (!res || !res.ok) { toast('Не получилось — попробуй ещё раз'); renderFriends(); return; }
        if (state.net.claimed.indexOf(need) < 0) state.net.claimed.push(need);
        applyReward(res.reward, 'Награда за ' + need + ' ' + plural(need, 'друга', 'друзей', 'друзей'));
        save(true); renderFriends();
      }).catch(function () { toast('📡 Нет связи — попробуй позже'); renderFriends(); });
    }
  });
  function rarIndex(x) {
    if (typeof x === 'number') return Math.max(0, Math.min(3, x));
    return { common: 0, rare: 1, epic: 2, legendary: 3, legend: 3 }[x] || 1;
  }
  function applyReward(rw, title) {
    if (!rw) return;
    if (rw.type === 'cash') { var c = Number(rw.cash) || 0; biz().money += c; biz().earned += c; toast('💰 ' + title + ': +' + rub(c)); updateUi(true); }
    else if (rw.type === 'pack') { questProgress('pack'); var id = B.PACKS[rw.pack] ? rw.pack : 'premium'; reveal(B.rollPack(id, Math.random), '🎁 ' + title, id); }
    else reveal([B.cell(2, rarIndex(rw.rarity))], '🎁 ' + title, 'gift');
  }

  // ---------- Рейтинг ----------
  var ratingScope = 'friends', ratingReq = 0;
  function myValuation() { return B.valuation(biz(), Date.now()); }
  function renderRating() {
    var box = $('rating-box'), N = net();
    var me = '<div class="stat"><span>Оценка твоей компании</span><b>' + rub(myValuation()) + '</b><small>всё заработанное + доход за сутки</small></div>';
    var tabs = '<div class="seg">' + [['friends', 'Друзья'], ['week', 'Неделя'], ['all', 'Всё время']].map(function (s) {
      return '<button class="' + (ratingScope === s[0] ? 'on' : '') + '" data-scope="' + s[0] + '">' + s[1] + '</button>';
    }).join('') + '</div>';
    if (!N) {
      box.innerHTML = me + '<div class="soon"><div class="soon-ico">🏆</div><h2>Рейтинг — скоро</h2><p>Соревнуйся с друзьями и со всеми игроками за неделю. Мерило — оценка компании.</p>' +
        '<button class="btn btn-primary btn-wide" data-invite>📨 Позвать друзей соревноваться</button></div>';
      return;
    }
    box.innerHTML = me + tabs + '<div class="loading">⏳ Загружаем рейтинг…</div>';
    var my = ++ratingReq;
    N.leaderboard(ratingScope).then(function (rows) {
      if (my !== ratingReq || activeView !== 'rating') return;
      rows = rows || [];
      var list = rows.map(function (r) {
        var medal = r.place === 1 ? '🥇' : r.place === 2 ? '🥈' : r.place === 3 ? '🥉' : r.place;
        return '<div class="lb' + (r.me ? ' me' : '') + '"><span class="pl">' + medal + '</span><span class="nmr">' + esc(r.name || '—') + (r.me ? ' (ты)' : '') + '</span><b>' + rub(r.value || 0) + '</b></div>';
      }).join('');
      box.innerHTML = me + tabs + (list ? '<div class="lb-list">' + list + '</div>' : '<p class="muted-c">Здесь пока пусто.' + (ratingScope === 'friends' ? ' Позови друзей!' : '') + '</p>') +
        (ratingScope === 'friends' ? '<button class="btn btn-dark btn-wide" data-invite>📨 Пригласить друга</button>' : '');
    }).catch(function () {
      if (my !== ratingReq || activeView !== 'rating') return;
      box.innerHTML = me + tabs + '<div class="error-box">📡 Нет связи с сервером<br><small>Проверь интернет и попробуй ещё раз</small><button class="btn btn-dark" data-retry="rating">Повторить</button></div>';
    });
  }
  $('view-rating').addEventListener('click', function (e) {
    if (e.target.closest('[data-invite]')) return invite();
    if (e.target.closest('[data-retry]')) return renderRating();
    var s = e.target.closest('[data-scope]');
    if (s) { ratingScope = s.dataset.scope; haptic('select'); renderRating(); }
  });
  var lastSync = 0;
  function sync() {
    var N = net(); if (!N || !state || !state.businesses.length || typeof N.sync !== 'function') return;
    lastSync = Date.now();
    try {
      var p = N.sync({ valuation: myValuation(), business: biz().type, maxLevel: B.maxLevel(biz()), incomePerSec: Math.round(income() * 100) / 100 });
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }
  window.addEventListener('gamenet:ready', function () {
    if (!state || el.app.hidden) return;
    if (activeView === 'friends') renderFriends();
    if (activeView === 'rating') renderRating();
    sync();
  });
  function hookReferral() {
    var N = window.GameNet;
    if (!N || typeof N.onReferralBonus !== 'function') return;
    try {
      N.onReferralBonus(function (bonus) {
        if (!state || state.net.refBonus || !state.businesses.length) return;
        state.net.refBonus = true;
        var cash = bonus && Number(bonus.cash) > 0 ? Number(bonus.cash) : 0;
        if (cash) { biz().money += cash; biz().earned += cash; }
        save(true);
        reveal([B.cell(2, 1)], '🎉 Тебя пригласил друг!' + (cash ? ' +' + rub(cash) + ' и' : '') + ' подарок:', 'gift');
      });
    } catch (e) {}
  }

  // ---------- Интерфейс ----------
  var lastBtnState = '';
  function updateDots() {
    var ds = dailyState();
    el.dailyDot.classList.toggle('on', !ds.claimed);
    var q = state.tutorial >= 3 ? ensureQuests() : null;
    var qReady = !!q && (q.list.some(function (x) { return !x.claimed && x.have >= x.need; }) || (!q.chest && q.list.every(function (x) { return x.claimed; })));
    el.questsDot.classList.toggle('on', qReady);
    var freeReady = state.agency.freeAt <= Date.now() || state.agency.shards >= B.SHARDS_FOR_RARE;
    el.shopDot.classList.toggle('on', state.tutorial >= 3 && freeReady);
  }
  function updateUi(force) {
    var b = biz(); if (!b) return;
    var d = def(), now = Date.now(), inc = income(now), rush = rushOn(now);
    el.money.innerHTML = fmt(b.money) + ' <span>₽</span>';
    var f = B.needsFactor(b, now);
    el.rate.innerHTML = '<b>+' + fmtRate(inc) + ' ₽/сек</b>' + (rush ? ' <em class="x2">⚡×' + B.RUSH_MULT + '</em>' : '') + (f < 1 ? ' <em class="tired-t">😩 −' + Math.round((1 - f) * 100) + '%</em>' : ' · пока тебя нет, тоже');
    var cost = B.hireCost(b), full = freeCell() < 0, inbox = b.inbox.length;
    var bs = (full ? 'full' : inbox ? 'inbox' + inbox : b.money < cost ? 'poor' : 'ok') + cost;
    if (bs !== lastBtnState || force) {
      lastBtnState = bs;
      el.hire.className = 'btn btn-primary' + (full ? ' full' : !inbox && b.money < cost ? ' poor' : '') + (state.tutorial < 2 ? ' glow' : '');
      el.hire.textContent = full ? '➕ Нет места' : inbox ? '🪑 Из приёмной · ' + inbox : '➕ Нанять · ' + rub(cost);
    }
    // аврал
    var rs = state.rush, rlabel, rcls = 'btn btn-dark btn-rush';
    if (now < rs.until) { rlabel = '⚡ ' + fmtClock((rs.until - now) / 1000); rcls += ' on'; }
    else if (now < rs.readyAt) { var left = (rs.readyAt - now) / 1000; rlabel = '⚡ ' + (left >= 3600 ? Math.ceil(left / 3600) + ' ч' : Math.ceil(left / 60) + ' мин'); rcls += ' wait'; }
    else { rlabel = '⚡ Аврал ×' + B.RUSH_MULT; if (state.tutorial >= 3) rcls += ' ready'; }
    if (el.rush.textContent !== rlabel) el.rush.textContent = rlabel;
    if (el.rush.className.replace(' pop', '') !== rcls) el.rush.className = rcls;
    updateDots();
    // баннер «Пригласи 3»
    var bannerOn = state.tutorial >= 3 && state.net.claimed.indexOf(3) < 0;
    if (el.banner.hidden === bannerOn) { el.banner.hidden = !bannerOn; fitGrid(); }
    if (bannerOn) {
      var inv = Math.min(3, state.net.invited || 0);
      var bh = '<span class="ib-ico">🔵</span><span class="ib-t"><b>Пригласи 3 друзей</b><small>бесплатный редкий сотрудник · доход ×1,5</small></span><span class="ib-p">' + inv + '/3</span>';
      if (el.banner.innerHTML !== bh) el.banner.innerHTML = bh;
    }
    // следующий переезд
    var next = B.ROOMS[b.room + 1];
    if (next) {
      var st = roomStatus(b.room + 1), r = d.rooms[b.room + 1], need = staff(next.needLevel);
      var p = Math.min(1, b.money / next.needMoney);
      el.nextRoom.classList.toggle('ready', st.ok);
      el.nextRoom.innerHTML = st.ok
        ? '<b>' + r.e + ' Можно переезжать: ' + esc(r.n) + ' · ×' + next.mult + '</b> — нажми'
        : '<span class="nr-l">Дальше: <b>' + r.e + ' ' + esc(r.s) + ' ×' + next.mult + '</b></span><span class="nr-r">' + (st.lvlOk ? '✅' : '⏳') + need.e + ' · ' + (st.moneyOk ? '✅ ' : '') + rub(next.needMoney) + '</span>' +
          '<div class="bar"><i style="width:' + (p * 100).toFixed(1) + '%"></i></div>';
    } else {
      el.nextRoom.classList.remove('ready');
      el.nextRoom.innerHTML = '🏁 Это лучшее помещение на сегодня. Новые — в следующих обновлениях.';
    }
    el.chipRoom.textContent = d.rooms[b.room].e + ' ' + d.rooms[b.room].s + ' · ×' + B.ROOMS[b.room].mult;
    var open = b.seen >= B.HOLDING_UNLOCK_LEVEL;
    el.chipLock.classList.toggle('open', open);
    el.chipLock.innerHTML = open ? '<span>🏗️ 2-й бизнес — скоро</span>' : '<span>🔒 2-й бизнес — на 5-м уровне</span>';
    if (force || now - lastNeeds > 1000) { lastNeeds = now; renderNeeds(); }
    // подсказка
    var hint;
    if (f < 1) hint = '😩 Команда устала — нажми на ' + d.needs.map(function (n) { return n.e; }).join('') + ' сверху';
    else if (full && !hasPair()) hint = next ? 'Мест нет и пар нет — копи на переезд' : 'Мест нет — объединяй, когда появятся пары';
    else if (hasPair()) hint = 'Перетащи одинаковых друг на друга — уровень выше';
    else if (inbox) hint = '🪑 В приёмной ждут — нажми «Из приёмной»';
    else hint = 'Тапни по сотруднику — +2 сек его дохода';
    if (el.hint.textContent !== hint) el.hint.textContent = hint;
    if (force && activeView === 'upgrades') renderUpgrades();
    if (activeView === 'shop' && (force || now - lastAgency > 1000)) { lastAgency = now; renderAgency(); }
  }
  var lastNeeds = 0, lastAgency = 0;
  function hasPair() {
    var g = biz().grid, seen = {};
    for (var i = 0; i < g.length; i++) { var l = B.lvl(g[i]); if (g[i] && l < B.MAX_LEVEL) { if (seen[l]) return true; seen[l] = 1; } }
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
    if (v === 'rating') renderRating();
    if (v === 'friends') renderFriends();
    if (v === 'shop') renderAgency();
    if (v === 'office') requestAnimationFrame(fitGrid);
    haptic('select');
  }

  el.hire.addEventListener('click', hire);
  el.rush.addEventListener('click', rushClick);
  el.daily.addEventListener('click', showDaily);
  el.quests.addEventListener('click', function () {
    if (state.tutorial < 3) { toast('Задания откроются после обучения'); return; }
    showQuests();
  });
  el.banner.addEventListener('click', function () { setView('friends'); });
  el.chipRoom.addEventListener('click', showRooms);
  el.nextRoom.addEventListener('click', showRooms);
  el.chipLock.addEventListener('click', function () {
    toast(biz().seen >= B.HOLDING_UNLOCK_LEVEL ? 'Холдинг из нескольких бизнесов — в следующем обновлении' : 'Получи сотрудника 5-го уровня — откроется второй бизнес');
  });
  $('btn-settings').addEventListener('click', function () {
    var b = biz(), d = def();
    modal('<div class="big-ico">⚙️</div><h2>Настройки</h2>' +
      '<p>' + d.icon + ' ' + d.name + ' · ' + d.rooms[b.room].n + '<br>Наймов: ' + b.hires + ' · объединений: ' + b.merges + '<br>Сохранение: на этом устройстве' + (cloud ? ' и в облаке Telegram' : '') + (net() ? '<br>Сервер: подключён ✅' : '') + '</p>' +
      '<div class="btns"><button class="btn btn-dark" data-close>Закрыть</button><button class="btn btn-ghost" data-reset>Сбросить прогресс</button></div>' +
      '<p style="margin:12px 0 0;font-size:12px;color:var(--dim)">Стартап с нуля · версия 0.2 (этап 2)</p>',
      function (root, close) {
        root.querySelector('[data-close]').onclick = close;
        root.querySelector('[data-reset]').onclick = function () { close(); confirmReset(); };
      });
  });
  function confirmReset() {
    modal('<div class="big-ico">⚠️</div><h2>Сбросить прогресс?</h2><p>Пропадут деньги, сотрудники, помещения, улучшения и осколки. Это нельзя отменить.</p>' +
      '<div class="btns"><button class="btn btn-danger" data-yes>Да, начать заново</button><button class="btn btn-dark" data-no>Отмена</button></div>',
      function (root, close) {
        root.querySelector('[data-no]').onclick = close;
        root.querySelector('[data-yes]').onclick = function () {
          close();
          try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
          if (cloud) { try { cloud.removeItem(CLOUD_KEY, function () {}); } catch (e) {} }
          var keepNet = state.net; // друзья и полученные награды живут на сервере — не сбрасываем
          state = freshState(); state.net = keepNet; tapCd = {};
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
        if (dt >= B.OFFLINE_MIN_SEC) offline(dt, lastTick);
        else { var g0 = B.offlineGain(biz(), lastTick, dt, state.rush.until).gain; biz().money += g0; biz().earned += g0; }
      } else if (dt > 0) {
        var g = income(now) * dt;
        biz().money += g; biz().earned += g;
      }
      if (now - lastUi > 100) { lastUi = now; updateUi(); }
      if (now - lastSave > 5000) { lastSave = now; save(); }
      if (now - lastSync > 60000) sync();
    }
    lastTick = now;
  }
  // запасной таймер: если кадры не рисуются (окно видно, но rAF стоит) — деньги всё равно идут
  setInterval(function () { if (document.visibilityState === 'visible' && Date.now() - lastTick > 1000) tick(); }, 1000);

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { save(true); sync(); }
  });
  window.addEventListener('pagehide', function () { save(true); sync(); });
  window.addEventListener('resize', function () {
    fitGrid();
    if (state && state.tutorial < 3 && state.businesses.length) tutorial();
  });

  function showGame() {
    el.choose.hidden = true; el.app.hidden = false;
    setView('office');
    updateUi(true);
    buildGrid();
    lastTick = Date.now();
    requestAnimationFrame(function () { fitGrid(); tutorial(); });
  }

  // ---------- Старт ----------
  function boot(loaded) {
    state = loaded ? normalize(loaded) : freshState();
    if (!state.businesses.length) { showChoose(); }
    else {
      var away = (Date.now() - state.savedAt) / 1000;
      showGame();
      if (away >= B.OFFLINE_MIN_SEC) offline(away, state.savedAt);
    }
    hookReferral();
    lastSync = Date.now() - 50000; // первая отправка — через ~10 сек после входа
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
  window.__game = {
    get state() { return state; }, save: save, fmt: fmt,
    rebuild: function () { buildGrid(); updateUi(true); tutorial(); },
    reveal: reveal, openPack: openPack, setView: setView
  };
})();
