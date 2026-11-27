/* «Стартап с нуля» — стили оформления. Стили идут КОМПЛЕКТАМИ «оформление + сотрудники» (B.SKINS в balance.js):
   main — «Основной» «Сочный офис» (бесплатно, у всех по умолчанию) + мультяшные сотрудники;
   neon — «Ночной неон» (ночь, дождь, неон, золото) + неоновые сотрудники; за 3 друзей или ⭐ 75;
   collection — «Коллекция» (витрина коллекционера, студийный свет, подставки) + 3D-фигурки; ⭐ 150.
   Картинки сотрудников комплекта — app/img/staff/<комплект>/ (списки — CONTENT.STAFF_IMG, пока пустые → SVG из avatars.js).
   Выбор хранится в сохранении игрока (state.skin), здесь — только копия в localStorage, чтобы стиль встал до первой отрисовки.
   ?theme=main|neon|collection в адресе — только для проверки: показывает стиль, ничего не сохраняет.
   Старые id (mix, k, m, b, c и пробные ca/cb/cc) переводятся: mix/cb/ca/cc → main, k/m → neon, b/c → collection.
   CSS: общее — themes.css; основной — themes-main.css (общая «мультяшная» основа html[data-cartoon] + свой вид),
   «Коллекция» — themes-collection.css (на той же основе), «Ночной неон» — themes-neon.css.
   Здесь: сцена-фон, свои SVG-иконки меню и шапки, эффекты (window.GameFx: монеты, вспышки, частицы).
   Подключается в <head> без defer — чтобы стиль встал до первой отрисовки. */
(function () {
  'use strict';
  var KEY = 'startup_zero_theme';
  var LIST = [{ id: 'main', n: 'Основной' }, { id: 'neon', n: 'Ночной неон' }, { id: 'collection', n: 'Коллекция' }];
  var BG = { main: '#f4c98f', neon: '#07090f', collection: '#e9e3da' };
  var OLD = { mix: 'main', cb: 'main', ca: 'main', cc: 'main', k: 'neon', m: 'neon', b: 'collection', c: 'collection' };
  var CARTOON = { main: 1, collection: 1 };
  var root = document.documentElement;

  function valid(t) { return typeof t === 'string' && BG.hasOwnProperty(t); }
  function upgrade(t) { return typeof t === 'string' && OLD.hasOwnProperty(t) ? OLD[t] : t; }
  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function write(t) { try { localStorage.setItem(KEY, t); } catch (e) {} }

  // «Коллекция» — вид «Бутик игрушек» (выбор владельца 27.11): CSS themes-collection1.css (селекторы html[data-cv="1"]).
  var cvar = 1;
  var theme = upgrade(read()), forced = null;
  try {
    var q = new URLSearchParams(location.search).get('theme');
    if (q != null && valid(upgrade(q.toLowerCase()))) forced = upgrade(q.toLowerCase());
  } catch (e) {}
  BG.collection = '#15183A';
  if (!valid(theme)) theme = 'main'; // неизвестное → основной
  if (forced) theme = forced;

  function tgColors() {
    var tg = window.Telegram && window.Telegram.WebApp;
    if (!tg || !tg.initData) return;
    try { if (tg.isVersionAtLeast('6.1')) { tg.setHeaderColor(BG[theme]); tg.setBackgroundColor(BG[theme]); } } catch (e) {}
    try { if (tg.isVersionAtLeast('7.7') && tg.setBottomBarColor) tg.setBottomBarColor(BG[theme]); } catch (e) {}
  }
  function apply() {
    root.setAttribute('data-theme', theme);
    if (CARTOON[theme]) root.setAttribute('data-cartoon', theme); else root.removeAttribute('data-cartoon');
    if (theme === 'collection') root.setAttribute('data-cv', cvar); else root.removeAttribute('data-cv');
    root.setAttribute('data-cvp', cvar); // превью «Коллекции» на экране «Стили» — в выбранном варианте
    root.style.colorScheme = theme === 'neon' ? 'dark' : 'light';
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', BG[theme]);
  }
  apply();

  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  // ---------- SVG-иконки (свои, без библиотек). Классы: f1 — основная заливка, f2 — вторая, f3 — блик, o — контур ----------
  var ICONS = {
    office: '<path class="f2 o" d="M18 28V12.5l9 3.2V28z"/><path class="f1 o" d="M5 28V7.6L18 3v25z"/>' +
      '<path class="f3" d="M8.5 10h2.6v2.6H8.5zm4.6-1.4h2.6v2.6h-2.6zM8.5 15h2.6v2.6H8.5zm4.6 0h2.6v2.6h-2.6zM8.5 20h2.6v2.6H8.5zm4.6 0h2.6v2.6h-2.6zM21 18h3v2.4h-3zm0 4.4h3v2.4h-3z"/>' +
      '<path class="o" fill="none" d="M3 28h26"/>',
    upgrades: '<path class="f2 o" d="M10.5 18.5l-5 2.6 1.6 4.6 5.6-2.4zm11 0l5 2.6-1.6 4.6-5.6-2.4z"/>' +
      '<path class="f1 o" d="M16 2.5c5.4 4 7.6 10.6 6.2 18.8H9.8C8.4 13.1 10.6 6.5 16 2.5z"/>' +
      '<circle class="f3 o" cx="16" cy="11.5" r="2.9"/><path class="f4" d="M12.6 22.6h6.8L16 30z"/>',
    rating: '<path class="f2 o" d="M9 7H4.5a4.5 4.5 0 0 0 5.2 6.4M23 7h4.5a4.5 4.5 0 0 1-5.2 6.4" fill="none"/>' +
      '<path class="f1 o" d="M8.5 4h15v7.5a7.5 7.5 0 0 1-15 0z"/><path class="f1 o" d="M14 18.5h4v4.2h-4z"/>' +
      '<path class="f2 o" d="M9.5 22.5h13v5.5h-13z"/><path class="f3" d="M16 6.8l1.4 2.8 3 .4-2.2 2.1.5 3L16 13.7l-2.7 1.4.5-3-2.2-2.1 3-.4z"/>',
    friends: '<circle class="f2 o" cx="22" cy="10" r="4"/><path class="f2 o" d="M15.5 26.5a7.2 7.2 0 0 1 14 0v1.5h-12z"/>' +
      '<circle class="f1 o" cx="12" cy="11" r="5"/><path class="f1 o" d="M3 28a9 9 0 0 1 18 0z"/><path class="f3" d="M9.4 9.6a2.8 2.8 0 0 1 2.6-1.9"/>',
    shop: '<path class="f2 o" d="M3.5 9a2 2 0 0 1 2-2h7.2l3 3h10.8a2 2 0 0 1 2 2v14.5a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2z"/>' +
      '<rect class="f3 o" x="8.5" y="11.5" width="15" height="11" rx="1.8"/><circle class="f1" cx="13" cy="16" r="2.2"/><path class="f1" d="M10 21a3 3 0 0 1 6 0z"/><path class="f1" d="M17.6 14.6h4M17.6 17.6h3" stroke-width="1.6" stroke-linecap="round" fill="none"/>' +
      '<path class="f1 o" d="M3.5 14.5h25v12a2 2 0 0 1-2 2h-21a2 2 0 0 1-2-2z" opacity=".55"/>',
    gift: '<path class="f2 o" d="M6 15.5h20V28H6z"/><path class="f1 o" d="M4 10.5h24v5H4z"/><path class="f3" d="M14.4 10.5h3.2V28h-3.2z"/>' +
      '<path class="f4 o" d="M16 10.4c-2.6-5.8-9-5-6.6-1.2 1.6 1.6 6.6 1.2 6.6 1.2zm0 0c2.6-5.8 9-5 6.6-1.2-1.6 1.6-6.6 1.2-6.6 1.2z"/>',
    quests: '<rect class="f1 o" x="6.5" y="5.5" width="19" height="23" rx="3"/><rect class="f2 o" x="11.5" y="3" width="9" height="5" rx="1.6"/>' +
      '<path class="f3" d="M10.5 14.5l2 2 3.4-3.8M10.5 21.5l2 2 3.4-3.8" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path class="f2" d="M18 14.6h4.5v2H18zm0 7h4.5v2H18z"/>',
    settings: '<path class="f1 o" d="M13.6 3h4.8l.8 3.6 2.6 1.1 3.1-2 3.4 3.4-2 3.1 1.1 2.6 3.6.8v4.8l-3.6.8-1.1 2.6 2 3.1-3.4 3.4-3.1-2-2.6 1.1-.8 3.6h-4.8l-.8-3.6-2.6-1.1-3.1 2-3.4-3.4 2-3.1L6.4 18l-3.6-.8v-4.8l3.6-.8 1.1-2.6-2-3.1 3.4-3.4 3.1 2 2.6-1.1z"/>' +
      '<circle class="f2 o" cx="16" cy="15" r="4.6"/><circle class="f3" cx="14.6" cy="13.6" r="1.4"/>'
  };
  function svg(name, cls) {
    return '<svg class="' + (cls || 'ti') + ' ti-' + name + '" viewBox="0 0 32 32" aria-hidden="true">' + ICONS[name] + '</svg>';
  }
  // ---------- Сцены-фоны скинов (рисуются кодом) ----------
  function rnd(seed) { var x = seed; return function () { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; }; }
  function cityRects(seed, W, n, hMin, hMax, win, cls) {
    var r = rnd(seed), out = '', x = 0, wins = '';
    while (x < W) {
      var w = Math.round(14 + r() * 26), h = Math.round(hMin + r() * (hMax - hMin)), y = 200 - h;
      out += '<rect class="' + cls + '" x="' + x + '" y="' + y + '" width="' + (w + 0.5) + '" height="' + h + '"/>';
      if (r() < 0.35) out += '<rect class="' + cls + '" x="' + (x + w / 2 - 1) + '" y="' + (y - 10) + '" width="2" height="10"/>';
      if (win) for (var wy = y + 5; wy < 196; wy += 7) for (var wx = x + 3; wx < x + w - 4; wx += 5) if (r() < 0.42) wins += '<rect x="' + wx + '" y="' + wy + '" width="2.4" height="3.4"/>';
      x += w + Math.round(r() * 4);
    }
    return out + (wins ? '<g class="win">' + wins + '</g>' : '');
  }
  var K_LINES = '<svg class="k-lines" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="kgl" x1="0" y1="0" x2="1" y2="0">' +
    '<stop offset="0" class="ks0"/><stop offset=".55" class="ks1"/><stop offset="1" class="ks0"/></linearGradient></defs>' +
    '<path d="M-30 190 C 110 90, 250 300, 430 150"/><path class="kl2" d="M-30 250 C 140 170, 230 330, 430 230"/><path d="M-30 690 C 130 600, 260 780, 430 640"/></svg>';
  // ---------- Сцены основного и «Коллекции»: SVG, классы красятся в themes-main.css / themes-collection.css ----------
  function cloud(x, y, k) {
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + k + ')"><path class="cl" d="M10 40 C-8 40 -6 16 14 18 C16 2 40 -2 48 12 C56 0 82 4 80 22 C98 22 98 42 82 42 Z"/>' +
      '<path class="cl-s" d="M6 36 C20 44 70 44 88 34 C90 40 86 42 82 42 L10 40 C6 40 4 38 6 36Z"/></g>';
  }
  // полка «Коллекции»: доска, коробки-«блайнд-боксы», колпак со звездой, фигурка-силуэт на подставке
  function shelf(seed) {
    var r = rnd(seed), x = 8, out = '';
    while (x < 190) {
      var k = Math.floor(r() * 3), w;
      if (k === 0) { w = 30 + Math.round(r() * 8); var h = 38 + Math.round(r() * 10);
        out += '<rect class="bx b' + Math.floor(r() * 3) + '" x="' + x + '" y="' + (70 - h) + '" width="' + w + '" height="' + h + '" rx="3"/><rect class="bx-w" x="' + (x + 5) + '" y="' + (70 - h + 8) + '" width="' + (w - 10) + '" height="' + (h - 18) + '" rx="3"/>';
      } else if (k === 1) { w = 30;
        out += '<rect class="pd-s" x="' + x + '" y="62" width="30" height="8" rx="3"/><path class="jar" d="M' + (x + 3) + ' 62 V36 a12 12 0 0 1 24 0 V62z"/><circle class="fg" cx="' + (x + 15) + '" cy="42" r="6"/><path class="fg" d="M' + (x + 8) + ' 62 q7 -16 14 0z"/><path class="jar-h" d="M' + (x + 8) + ' 56 V38"/>';
      } else { w = 22;
        out += '<ellipse class="pd-s" cx="' + (x + 11) + '" cy="67" rx="11" ry="3.5"/><circle class="fg" cx="' + (x + 11) + '" cy="44" r="7"/><path class="fg" d="M' + (x + 2) + ' 66 q9 -22 18 0z"/>';
      }
      x += w + 8 + Math.round(r() * 8);
    }
    return out + '<rect class="sh-b" x="0" y="70" width="200" height="7" rx="2"/><rect class="sh-u" x="0" y="77" width="200" height="4"/>';
  }
  var CARTOON_SCENE = {
    // основной «Сочный офис»: обои, большое окно с городом и облаками, часы, полка, растения, паркет
    main: function () {
      return '<div class="sc-x"><i class="cb-wall"></i>' +
        '<svg class="cb-win" viewBox="0 0 300 190"><rect class="wf" x="4" y="4" width="292" height="170" rx="14"/><rect class="sky" x="16" y="16" width="268" height="146" rx="6"/>' +
        '<g class="wcity">' + cityRects(41, 268, 0, 30, 80, false, 'wc').replace(/y="(\d+(\.\d+)?)"/g, function (m, v) { return 'y="' + (+v - 38) + '"'; }) + '</g>' +
        '<g transform="translate(40 34) scale(.55)">' + cloud(0, 0, 1) + '</g><g transform="translate(180 52) scale(.45)">' + cloud(0, 0, 1) + '</g>' +
        '<rect class="wbar" x="146" y="16" width="8" height="146"/><rect class="wbar" x="16" y="86" width="268" height="7"/><rect class="sill" x="-2" y="166" width="304" height="16" rx="6"/></svg>' +
        '<svg class="cb-clock" viewBox="-30 -30 60 60"><circle class="ck" r="25"/><circle class="ck-f" r="19"/><path class="ck-h" d="M0 0 L0 -12 M0 0 L9 4"/><circle class="ck-c" r="2.6"/></svg>' +
        '<svg class="cb-plant pl1" viewBox="0 0 120 200"><path class="lf" d="M60 120 C20 110 0 70 14 40 C40 50 58 80 60 120Z"/><path class="lf" d="M60 120 C100 104 120 60 104 30 C80 44 62 80 60 120Z"/>' +
        '<path class="lf2" d="M60 124 C40 80 44 30 62 8 C80 36 78 84 60 124Z"/><path class="vein" d="M60 120 C30 100 22 70 18 48 M60 120 C92 100 100 64 100 38 M60 122 C58 90 60 50 62 14"/>' +
        '<path class="pot" d="M30 120 H90 L82 190 H38 Z"/><rect class="pot-r" x="26" y="116" width="68" height="14" rx="5"/></svg>' +
        '<svg class="cb-plant pl2" viewBox="0 0 120 200"><path class="lf" d="M60 130 C30 120 18 90 26 62 C46 74 58 100 60 130Z"/><path class="lf2" d="M60 130 C88 116 100 86 94 58 C74 70 62 100 60 130Z"/>' +
        '<path class="pot" d="M34 128 H86 L80 190 H40 Z"/><rect class="pot-r" x="30" y="124" width="60" height="13" rx="5"/></svg>' +
        '<i class="cb-floor"></i></div>';
    },
    // «Коллекция»: студийный фон-«циклорама», мягкие софиты сверху, полки коллекционера (в лёгком расфокусе), стол-подиум
    collection: function () {
      if (cvar === 1) // «Бутик игрушек»: бархатный занавес, латунная рампа с прожекторами, стеклянные витрины по бокам, лаковый пол
        return '<div class="sc-x"><i class="bt-wall"></i><i class="bt-folds"></i><i class="bt-beam b1"></i><i class="bt-beam b2"></i><i class="bt-beam b3"></i>' +
          '<i class="bt-rail"></i><i class="bt-lamp l1"></i><i class="bt-lamp l2"></i><i class="bt-lamp l3"></i>' +
          '<svg class="bt-case c1" viewBox="0 0 200 84">' + shelf(11) + '</svg><svg class="bt-case c2" viewBox="0 0 200 84">' + shelf(29) + '</svg>' +
          '<i class="co-dust d1"></i><i class="co-dust d2"></i><i class="bt-floor"></i></div>';
      if (cvar === 2) // «Блайнд-бокс студия»: яркая стена с перфопанелью, цветные полки с коробками, лучи-«санбёрст»
        return '<div class="sc-x"><i class="bb-wall"></i><i class="bb-burst"></i><i class="bb-peg"></i>' +
          '<svg class="bb-shelf s1" viewBox="0 0 200 84">' + shelf(11) + '</svg><svg class="bb-shelf s2" viewBox="0 0 200 84">' + shelf(29) + '</svg>' +
          '<i class="bb-conf c1"></i><i class="bb-conf c2"></i><i class="bb-floor"></i></div>';
      if (cvar === 3) // «Капсульный автомат»: корпус автомата, хромированные полосы, капсулы, лампочки
        return '<div class="sc-x"><i class="gc-wall"></i><i class="gc-dots"></i><i class="gc-stripe"></i><i class="gc-bulbs"></i>' +
          '<i class="gc-cap k1"></i><i class="gc-cap k2"></i><i class="gc-cap k3"></i><i class="gc-cap k4"></i><i class="gc-floor"></i></div>';
      return '<div class="sc-x"><i class="co-wall"></i><i class="co-spot s1"></i><i class="co-spot s2"></i>' +
        '<svg class="co-shelf sf1" viewBox="0 0 200 84">' + shelf(11) + '</svg>' +
        '<svg class="co-shelf sf2" viewBox="0 0 200 84">' + shelf(29) + '</svg>' +
        '<i class="co-dust d1"></i><i class="co-dust d2"></i><i class="co-table"></i></div>';
    }
  };
  function sceneX() {
    if (theme === 'neon') return '<div class="sc-x"><i class="ka1"></i><i class="ka2"></i>' + K_LINES +
      '<svg class="x-city" viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice">' + cityRects(17, 400, 0, 30, 110, true, 'xc') + '</svg>' +
      '<i class="fog"></i><i class="refl"></i><i class="rain r1"></i><i class="rain r2"></i></div>';
    if (CARTOON[theme]) return CARTOON_SCENE[theme]();
    return '';
  }
  function sceneSync() {
    var sc = document.querySelector('.scene'); if (!sc) return;
    var old = sc.querySelector('.sc-x');
    if (old && old.getAttribute('data-for') === theme) return;
    if (old) old.remove();
    var h = sceneX(); if (!h) return;
    sc.insertAdjacentHTML('beforeend', h);
    var n = sc.lastElementChild; n.setAttribute('data-for', theme); n.setAttribute('aria-hidden', 'true');
  }

  function decorate() {
    // сцена-фон (одна на страницу, статичная: градиенты)
    if (!document.querySelector('.scene')) {
      var sc = document.createElement('div');
      sc.className = 'scene'; sc.setAttribute('aria-hidden', 'true');
      sc.innerHTML = '<div class="sc-stars"></div><div class="sc-wall"></div><div class="sc-room"></div><div class="sc-sign"><i></i></div><div class="sc-tubes"><i></i><i></i><i></i></div>' +
        '<div class="sc-floor"><div class="sc-grid"></div></div><div class="sc-spot"></div><div class="sc-city"></div>';
      document.body.insertBefore(sc, document.body.firstChild);
    }
    sceneSync();
    var map = { office: 'office', upgrades: 'upgrades', rating: 'rating', friends: 'friends', shop: 'shop' };
    document.querySelectorAll('.tab').forEach(function (t) {
      var n = map[t.dataset.view];
      if (n && !t.querySelector('.ti')) t.insertAdjacentHTML('afterbegin', svg(n));
    });
    [['btn-daily', 'gift'], ['btn-quests', 'quests'], ['btn-settings', 'settings']].forEach(function (p) {
      var b = document.getElementById(p[0]);
      if (b && !b.querySelector('.ti')) b.insertAdjacentHTML('afterbegin', svg(p[1]));
    });
    var money = document.getElementById('money');
    if (money && !document.querySelector('.coin-big')) money.insertAdjacentHTML('beforebegin', '<i class="coin-big" aria-hidden="true"></i>');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { decorate(); tgColors(); });
  else { decorate(); tgColors(); }

  // ---------- Эффекты: canvas-частицы (рисуем только пока есть частицы) + DOM-всплывашки ----------
  var cv = null, ctx = null, parts = [], running = false, dpr = 1;
  function canvas() {
    if (cv) return ctx;
    cv = document.createElement('canvas');
    cv.className = 'fx-canvas'; cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv);
    ctx = cv.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    return ctx;
  }
  function resize() {
    if (!cv) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(window.innerWidth * dpr); cv.height = Math.round(window.innerHeight * dpr);
  }
  function cssVar(name, fb) {
    var v = getComputedStyle(root).getPropertyValue(name);
    return (v && v.trim()) || fb;
  }
  var RAR = ['#ffffff', '#4FC3FF', '#B57BFF', '#FFC83D'];
  var GOLD = ['#F6D78B', '#E8B85A', '#FFF1C8', '#C99232'];
  // монета в характере стиля
  function coinDraw(p, x, y, r, sq) {
    if (theme === 'neon') {
      // неон: золотая монета со светящимся шлейфом
      if (p.lx != null) { ctx.strokeStyle = '#F2C86A'; ctx.globalAlpha *= 0.45; ctx.lineWidth = r * 0.9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.lx, p.ly); ctx.lineTo(x, y); ctx.stroke(); ctx.globalAlpha /= 0.45; }
      p.lx = x; p.ly = y;
      ctx.fillStyle = 'rgba(255,214,120,.25)'; ctx.beginPath(); ctx.arc(x, y, r * 1.9, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#ffd98a'; ctx.beginPath(); ctx.ellipse(x, y, r * Math.max(0.25, sq), r, 0, 0, 6.283); ctx.fill();
      ctx.strokeStyle = '#fff4d0'; ctx.lineWidth = 1; ctx.stroke();
      return;
    }
    if (theme === 'main') {
      // основной: мультяшная монета с тёмным контуром
      ctx.fillStyle = '#3A2314'; ctx.beginPath(); ctx.ellipse(x, y + 1.5, r * Math.max(0.25, sq) + 1.4, r + 1.4, 0, 0, 6.283); ctx.fill();
    }
    ctx.fillStyle = '#B9771A'; ctx.beginPath(); ctx.ellipse(x, y + 1.2, r * Math.max(0.25, sq), r, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#FFD25A'; ctx.beginPath(); ctx.ellipse(x, y, r * Math.max(0.25, sq), r, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#FFF3C4'; ctx.beginPath(); ctx.ellipse(x - r * 0.3 * sq, y - r * 0.3, r * 0.28 * Math.max(0.3, sq), r * 0.28, 0, 0, 6.283); ctx.fill();
  }
  function loop() {
    if (!parts.length) { running = false; ctx.clearRect(0, 0, cv.width, cv.height); return; }
    running = true;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.t += 1 / 60;
      var k = p.t / p.life;
      if (k >= 1) { if (p.done) p.done(); parts.splice(i, 1); continue; }
      if (k < 0) continue;
      ctx.globalAlpha = p.type === 'coin' ? (k > 0.85 ? (1 - k) / 0.15 : 1) : p.type === 'mote' ? Math.sin(k * 3.14) * (p.a || 0.8) : 1 - k;
      if (p.type === 'ring') {
        ctx.strokeStyle = p.c; ctx.lineWidth = (p.w || 4) * (1 - k) + 1;
        var rr = p.r0 + (p.r1 - p.r0) * (1 - Math.pow(1 - k, 3));
        ctx.beginPath(); ctx.ellipse(p.x, p.y, rr, rr * (p.fy || 1), 0, 0, 6.283); ctx.stroke();
      } else if (p.type === 'coin') {
        // монета летит по дуге к счётчику денег
        var e = k * k * (3 - 2 * k);
        var x = p.x + (p.tx - p.x) * e + Math.sin(k * 3.14) * p.bend, y = p.y + (p.ty - p.y) * e - Math.sin(k * 3.14) * 60;
        coinDraw(p, x, y, p.s * (1 - 0.35 * k), Math.abs(Math.cos(p.t * 9 + p.ph)));
      } else if (p.type === 'mote') {
        // мягкие огоньки, всплывают вверх
        p.x += p.vx; p.y += p.vy; p.vx *= 0.98; p.vy = p.vy * 0.98 - 0.02;
        var gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s);
        gr.addColorStop(0, p.c); gr.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.283); ctx.fill();
      } else {
        p.vy += p.g; p.vx *= 0.985; p.vy *= 0.985;
        p.x += p.vx; p.y += p.vy;
        ctx.fillStyle = p.c;
        var s = p.s * (1 - k * 0.6);
        if (p.type === 'star') {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - s * 1.6); ctx.lineTo(p.x + s * 0.4, p.y - s * 0.4); ctx.lineTo(p.x + s * 1.6, p.y); ctx.lineTo(p.x + s * 0.4, p.y + s * 0.4);
          ctx.lineTo(p.x, p.y + s * 1.6); ctx.lineTo(p.x - s * 0.4, p.y + s * 0.4); ctx.lineTo(p.x - s * 1.6, p.y); ctx.lineTo(p.x - s * 0.4, p.y - s * 0.4);
          ctx.fill();
        } else if (p.type === 'drop') {
          // брызги дождя — короткие штрихи по направлению полёта
          ctx.strokeStyle = p.c; ctx.lineWidth = Math.max(0.8, s * 0.35); ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2); ctx.stroke();
        } else ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(loop);
  }
  function kick() { if (!running) { running = true; requestAnimationFrame(loop); } }
  function center(node) {
    var r = node.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  }
  function burst(x, y, n, colors, speed, type, o) {
    canvas(); o = o || {};
    for (var i = 0; i < n && parts.length < 160; i++) {
      var a = Math.random() * 6.283, v = speed * (0.4 + Math.random() * 0.8);
      parts.push({ type: type || (Math.random() < 0.35 ? 'star' : 'sq'), x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * (o.up != null ? o.up : 0.35), g: o.g != null ? o.g : 0.12,
        s: (o.s || 2.5) + Math.random() * (o.sr || 3.5), c: colors[i % colors.length], t: 0, life: (o.life || 0.55) + Math.random() * 0.45, a: o.a, ph: Math.random() * 3 });
    }
    kick();
  }
  function floatEl(x, y, html, cls) {
    var fx = document.getElementById('fx'); if (!fx) return;
    var f = document.createElement('div');
    f.className = 'tfloat ' + (cls || '');
    f.innerHTML = html;
    f.style.left = x + 'px'; f.style.top = y + 'px';
    fx.appendChild(f);
    setTimeout(function () { f.remove(); }, 1300);
  }
  function bump(node) {
    if (!node) return;
    node.classList.remove('tbump'); void node.offsetWidth; node.classList.add('tbump');
  }

  window.GameTheme = {
    list: LIST,
    cellDeco: function () { return ''; },
    get: function () { return theme; },
    forced: function () { return forced; },
    // надеть стиль (game.js вызывает с выбором из сохранения); при ?theme=… в адресе — показываем стиль из адреса
    set: function (t) {
      if (forced) t = forced;
      t = upgrade(t);
      if (!valid(t)) t = 'main';
      if (!forced) write(t);
      if (t === theme && root.getAttribute('data-theme') === t) return;
      theme = t; apply(); tgColors(); sceneSync();
      try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    }
  };

  window.GameFx = {
    on: function () { return true; },
    // слияние — в характере стиля
    merge: function (node, rar, up) {
      if (!node) return;
      node.classList.remove('tmerge'); void node.offsetWidth; node.classList.add('tmerge');
      setTimeout(function () { node.classList.remove('tmerge'); }, 700);
      if (reduce) return;
      var c = center(node), biz = cssVar('--biz', '#B9FF3F');
      var cols = rar ? [RAR[rar], '#ffffff', RAR[rar], biz] : [biz, '#ffffff', biz];
      canvas();
      if (theme === 'neon') {
        // неон: вспышка-кольцо, звёзды и брызги по «луже»; легенда — золотой салют
        var gold = rar === 3;
        parts.push({ type: 'ring', x: c.x, y: c.y, r0: 6, r1: c.w * 0.95, c: gold ? '#F6D78B' : rar ? RAR[rar] : biz, w: 3.5, t: 0, life: 0.5 });
        parts.push({ type: 'ring', x: c.x, y: c.y + c.h * 0.36, r0: 4, r1: c.w * 0.85, fy: 0.28, c: 'rgba(200,215,255,.75)', w: 1.4, t: 0.03, life: 0.65 });
        if (up || rar >= 2) parts.push({ type: 'ring', x: c.x, y: c.y, r0: 4, r1: c.w * 1.5, c: '#ffffff', w: 2, t: -0.08, life: 0.7 });
        burst(c.x, c.y, gold ? 34 : up ? 28 : 20, gold ? GOLD.concat('#ffffff') : cols, gold ? 5.6 : 4.6, gold ? 'star' : null);
        burst(c.x, c.y + c.h * 0.3, 8, [biz, '#cfe0ff'], 2.6, 'drop', { s: 2.2, sr: 1.5, g: 0.24, up: 1, life: 0.45 });
        return;
      }
      if (theme === 'collection') {
        // «Коллекция»: мягкий свет софита — светлое кольцо по подставке, тёплые огоньки и блёстки (у легенды — золото)
        var cg = rar === 3 ? GOLD : rar ? [RAR[rar], '#ffffff', '#FFF3D6'] : ['#FFF3D6', '#ffffff', '#E8C98A'];
        parts.push({ type: 'ring', x: c.x, y: c.y + c.h * 0.3, r0: 4, r1: c.w * 0.8, fy: 0.3, c: rar === 3 ? '#E8B85A' : 'rgba(255,255,255,.95)', w: 2.4, t: 0, life: 0.6 });
        parts.push({ type: 'ring', x: c.x, y: c.y, r0: c.w * 0.2, r1: c.w * 0.9, c: rar ? cg[0] : 'rgba(232,201,138,.9)', w: 1.6, t: 0.02, life: 0.55 });
        burst(c.x, c.y, rar === 3 ? 22 : 14, cg, 1.8, 'mote', { s: 4, sr: 5, g: 0, up: 0.6, life: 0.75, a: 0.9 });
        burst(c.x, c.y, rar === 3 ? 18 : 10, cg, 3.6, 'star', { s: 1.8, sr: 2, g: 0.06, life: 0.5 });
        return;
      }
      if (CARTOON[theme]) {
        // мультяшный «бум»: кольцо с тёмным контуром и звёзды цвета бизнеса и золота
        var t1 = cssVar('--t1', biz), ink = cssVar('--ink', '#1D2A4D'), rc = rar === 3 ? '#FFC21A' : rar ? RAR[rar] : t1;
        parts.push({ type: 'ring', x: c.x, y: c.y, r0: 8, r1: c.w * 0.95, c: ink, w: 7, t: 0, life: 0.45 });
        parts.push({ type: 'ring', x: c.x, y: c.y, r0: 8, r1: c.w * 0.95, c: rc, w: 4, t: 0, life: 0.45 });
        if (up || rar >= 2) parts.push({ type: 'ring', x: c.x, y: c.y, r0: 6, r1: c.w * 1.45, c: '#ffffff', w: 3, t: -0.08, life: 0.6 });
        burst(c.x, c.y, rar === 3 ? 30 : 22, rar === 3 ? ['#FFE14D', '#FFC21A', '#ffffff'] : [t1, '#FFE14D', '#ffffff'], 5, 'star', { s: 3.5, sr: 3.5, g: 0.16 });
        return;
      }
      parts.push({ type: 'ring', x: c.x, y: c.y, r0: 8, r1: c.w * 0.9, c: rar ? RAR[rar] : biz, t: 0, life: 0.5 });
      if (up || rar >= 2) parts.push({ type: 'ring', x: c.x, y: c.y, r0: 4, r1: c.w * 1.4, c: '#ffffff', t: -0.08, life: 0.7 });
      burst(c.x, c.y, rar === 3 ? 36 : up ? 30 : 20, rar === 3 ? ['#FFC83D', '#FFF1B0', '#FFAA00', '#ffffff'] : cols, rar === 3 ? 6 : 4.6, rar === 3 ? 'star' : null);
    },
    // тап: монеты летят из сотрудника в счётчик денег
    tap: function (node, target) {
      if (!node || reduce) return;
      var a = center(node), b = target ? center(target) : { x: 40, y: 30 };
      canvas();
      var n = 4;
      for (var i = 0; i < n; i++) {
        parts.push({ type: 'coin', x: a.x + (Math.random() - 0.5) * 20, y: a.y, tx: b.x - b.w * 0.25 + Math.random() * 20, ty: b.y, bend: (Math.random() - 0.5) * 80,
          s: 6 + Math.random() * 2, t: -i * 0.06, life: 0.75 + i * 0.04, ph: Math.random() * 3, done: i === n - 1 ? function () { bump(target); } : null });
      }
      kick();
    },
    // пассивный доход: «+N/ч» с монеткой поднимается над сотрудником
    income: function (node, text) {
      if (!node) return;
      var r = node.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      floatEl(r.left + r.width / 2, r.top + r.height * 0.3, '<i class="tcoin"></i>' + text, 'inc');
    },
    spawn: function (node) {
      if (!node || reduce) return;
      var c = center(node), bz = cssVar('--biz', '#B9FF3F');
      canvas();
      if (theme === 'neon') {
        parts.push({ type: 'ring', x: c.x, y: c.y + c.h * 0.36, r0: 3, r1: c.w * 0.5, fy: 0.3, c: 'rgba(190,210,255,.85)', w: 1.2, t: 0, life: 0.6 });
        burst(c.x, c.y + c.h * 0.3, 6, [bz, '#ffffff'], 2.2, 'drop', { s: 2, sr: 1.5, g: 0.24, up: 1, life: 0.4 });
        kick(); return;
      }
      if (theme === 'collection') { parts.push({ type: 'ring', x: c.x, y: c.y + c.h * 0.3, r0: 3, r1: c.w * 0.45, fy: 0.3, c: 'rgba(255,255,255,.95)', w: 1.6, t: 0, life: 0.5 }); kick(); return; }
      burst(c.x, c.y + c.h * 0.25, 10, [bz, '#ffffff'], 3);
    },
    unlock: function (node) {
      if (!node || reduce) return;
      var c = center(node);
      canvas();
      if (theme === 'neon' || theme === 'collection') { parts.push({ type: 'ring', x: c.x, y: c.y, r0: 6, r1: c.w, c: '#F3D98B', w: 1.6, t: 0, life: 0.7 }); return burst(c.x, c.y, 16, ['#F3D98B', '#ffffff', '#E8B85A'], 1.6, 'mote', { s: 4, sr: 5, g: 0, life: 0.8 }); }
      parts.push({ type: 'ring', x: c.x, y: c.y, r0: 6, r1: c.w, c: '#FFC83D', t: 0, life: 0.6 });
      burst(c.x, c.y, 24, ['#FFC83D', '#ffffff', cssVar('--biz', '#B9FF3F')], 4.5, 'star');
    },
    // аврал: крупная надпись в своём стиле
    rush: function () {
      var t = { main: 'Аврал <b>×2</b>', neon: 'Аврал <b>×2</b>', collection: 'Аврал <b>×2</b>' }[theme];
      if (!t) return;
      floatEl(window.innerWidth / 2, window.innerHeight * 0.42, t, 'rushx');
    }
  };
})();
