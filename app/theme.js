/* «Стартап с нуля» — пробные оформления (A «Неоновая сцена», B «Премиум-золото», C «Кибер-комикс», D «Диорама», E «Настолка»,
   F «Пиксель-арт», G «Пластилин», H «Манга», I «Офис-95», J «Стеклянный город», K «Полночь», L «Нуар-казино», M «Ночной Токио»).
   Выбор: ?theme=a…m (или ?theme=old — вернуть старое), запоминается в localStorage. По умолчанию — старая тема.
   Стили: A–C — themes.css, D–E — themes2.css, F–J — themes3.css, K–M — themes4.css.
   Здесь: выбор темы, сцена-фон, свои SVG-иконки меню и шапки, эффекты (window.GameFx: монеты, вспышки, частицы).
   Подключается в <head> без defer — чтобы тема встала до первой отрисовки. Стили — themes.css. */
(function () {
  'use strict';
  var KEY = 'startup_zero_theme';
  var LIST = [{ id: 'old', n: 'Сейчас' }, { id: 'a', n: 'A' }, { id: 'b', n: 'B' }, { id: 'c', n: 'C' }, { id: 'd', n: 'D' }, { id: 'e', n: 'E' },
    { id: 'f', n: 'F' }, { id: 'g', n: 'G' }, { id: 'h', n: 'H' }, { id: 'i', n: 'I' }, { id: 'j', n: 'J' },
    { id: 'k', n: 'K' }, { id: 'l', n: 'L' }, { id: 'm', n: 'M' }];
  var BG = { a: '#07090f', b: '#0d0a12', c: '#120a2a', d: '#0b1030', e: '#3a2417', f: '#1a1c2c', g: '#f3e3d3', h: '#f7f5f0', i: '#008080', j: '#1b2a55', k: '#07090f', l: '#14080c', m: '#090a18', old: '#0D0F14' };
  // J: небо по реальному часу — утро / день / вечер / ночь (цвет шапки Telegram — верх неба)
  var SKY = { dawn: '#f4a98a', day: '#4b9be0', dusk: '#3a2d6b', night: '#0b1433' };
  function skyNow() { var h = new Date().getHours(); return h >= 5 && h < 10 ? 'dawn' : h >= 10 && h < 17 ? 'day' : h >= 17 && h < 21 ? 'dusk' : 'night'; }
  var root = document.documentElement;

  function valid(t) { return typeof t === 'string' && /^[a-m]$/.test(t); }
  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function write(t) { try { if (valid(t)) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY); } catch (e) {} }

  var theme = null;
  try {
    var q = new URLSearchParams(location.search).get('theme');
    if (q != null) { q = q.toLowerCase(); write(valid(q) ? q : 'old'); }
  } catch (e) {}
  theme = read();
  if (!valid(theme)) theme = 'old';

  function bgNow() { return theme === 'j' ? SKY[root.getAttribute('data-sky') || 'night'] : BG[theme]; }
  function tgColors() {
    var tg = window.Telegram && window.Telegram.WebApp;
    if (!tg || !tg.initData) return;
    try { if (tg.isVersionAtLeast('6.1')) { tg.setHeaderColor(bgNow()); tg.setBackgroundColor(bgNow()); } } catch (e) {}
    try { if (tg.isVersionAtLeast('7.7') && tg.setBottomBarColor) tg.setBottomBarColor(bgNow()); } catch (e) {}
  }
  function apply() {
    if (valid(theme)) root.setAttribute('data-theme', theme); else root.removeAttribute('data-theme');
    if (theme === 'j') root.setAttribute('data-sky', skyNow()); else root.removeAttribute('data-sky');
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', bgNow());
  }
  apply();
  // пиксельный шрифт (F, I) догружается после первой раскладки — пересчитать высоту клеток
  try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (theme === 'f' || theme === 'i') window.dispatchEvent(new Event('resize')); }); } catch (e) {}
  // небо J меняется само, раз в 5 минут проверяем час (дёшево: один атрибут)
  setInterval(function () { if (theme === 'j' && root.getAttribute('data-sky') !== skyNow()) { apply(); tgColors(); } }, 300000);

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
  // Эмблема бизнеса на плашке (сцена A): щит со скосами
  var EMBLEM = '<svg class="emb-svg" viewBox="0 0 40 44" aria-hidden="true"><path class="e1" d="M20 1l17 6v14c0 11-7.4 18.6-17 22C10.4 39.6 3 32 3 21V7z"/>' +
    '<path class="e2" d="M20 5.4l13 4.6v11c0 8.6-5.6 14.6-13 17.6C12.6 35.6 7 29.6 7 21V10z"/></svg>';

  // ---------- Доп. сцены F–J (рисуются кодом: SVG с детерминированным «случайным» городом) ----------
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
  // F: пиксельный пейзаж (crispEdges — без сглаживания), 1 единица = 1 «пиксель»
  function pxScene() {
    var r = rnd(7), stars = '', city = '', x = 0;
    for (var i = 0; i < 40; i++) stars += '<rect x="' + Math.floor(r() * 120) + '" y="' + Math.floor(r() * 110) + '" width="1" height="1"' + (i % 5 ? '' : ' class="tw"') + '/>';
    var hill = 'M0,150', hx = 0, hy = 150;
    while (hx < 120) { hx += 4 + Math.floor(r() * 6); hy = Math.max(128, Math.min(158, hy + Math.floor(r() * 13) - 6)); hill += ' H' + hx + ' V' + hy; }
    hill += ' V200 H0 Z';
    while (x < 120) {
      var w = 7 + Math.floor(r() * 9), h = 18 + Math.floor(r() * 34), y = 200 - h;
      city += '<rect class="pb" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"/>';
      for (var wy = y + 2; wy < 196; wy += 4) for (var wx = x + 1; wx < x + w - 1; wx += 2) if (r() < 0.3) city += '<rect class="pw" x="' + wx + '" y="' + wy + '" width="1" height="2"/>';
      x += w + 1;
    }
    return '<svg class="sc-px" viewBox="0 0 120 200" preserveAspectRatio="xMidYMax slice" shape-rendering="crispEdges" aria-hidden="true">' +
      '<rect class="s1" width="120" height="200"/><rect class="s2" y="60" width="120" height="140"/><rect class="s3" y="100" width="120" height="100"/><rect class="s4" y="126" width="120" height="74"/>' +
      '<g class="st">' + stars + '</g><path class="mn" d="M96,14h6v1h2v1h1v2h1v6h-1v2h-1v1h-2v1h-6v-1h-2v-1h-1v-2h-1v-6h1v-2h1v-1h2z"/><path class="mn2" d="M97,17h2v2h-2zM101,22h2v1h-2z"/>' +
      '<path class="hl" d="' + hill + '"/>' + city + '<rect class="gr" y="196" width="120" height="4"/></svg>';
  }
  function sceneX() {
    if (theme === 'f') return pxScene();
    if (theme === 'g') return '<div class="sc-x"><i class="b1"></i><i class="b2"></i><i class="b3"></i><i class="b4"></i><i class="b5"></i></div>';
    if (theme === 'h') return '<div class="sc-x"><i class="sl"></i><i class="ht"></i></div>';
    if (theme === 'j') return '<div class="sc-x"><i class="sun"></i><i class="cl c1"></i><i class="cl c2"></i><i class="cl c3"></i>' +
      '<svg class="sky-far" viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice">' + cityRects(11, 400, 0, 50, 130, false, 'bf') + '</svg>' +
      '<svg class="sky-near" viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice">' + cityRects(5, 400, 0, 26, 92, true, 'bn') + '</svg></div>';
    if (theme === 'k') return '<div class="sc-x"><i class="ka1"></i><i class="ka2"></i>' +
      '<svg class="k-lines" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="kgl" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0" class="ks0"/><stop offset=".55" class="ks1"/><stop offset="1" class="ks0"/></linearGradient></defs>' +
      '<path d="M-30 190 C 110 90, 250 300, 430 150"/><path class="kl2" d="M-30 250 C 140 170, 230 330, 430 230"/><path d="M-30 690 C 130 600, 260 780, 430 640"/></svg></div>';
    if (theme === 'l') return '<div class="sc-x"><i class="vel"></i><i class="lamp lp1"><b></b></i><i class="lamp lp2"><b></b></i><i class="wain"></i></div>';
    if (theme === 'm') return '<div class="sc-x"><i class="fog"></i>' +
      '<svg class="m-far" viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice">' + cityRects(31, 400, 0, 70, 180, true, 'mf') + '</svg>' +
      '<svg class="m-near" viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice">' + cityRects(17, 400, 0, 40, 120, true, 'mn') + '</svg>' +
      '<i class="sg sg1"></i><i class="sg sg2"></i><i class="sg sg3"></i><i class="sg sgb"></i><i class="street"></i><i class="refl"></i>' +
      '<i class="rain r1"></i><i class="rain r2"></i></div>';
    return '';
  }
  function sceneSync() {
    var sc = document.querySelector('.scene'); if (!sc) return;
    var old = sc.querySelector('.sc-x, .sc-px');
    if (old && old.getAttribute('data-for') === theme) return;
    if (old) old.remove();
    var h = sceneX(); if (!h) return;
    sc.insertAdjacentHTML('beforeend', h);
    var n = sc.lastElementChild; n.setAttribute('data-for', theme); n.setAttribute('aria-hidden', 'true');
  }

  function decorate() {
    // сцена-фон (одна на страницу, статичная: градиенты + перспективный пол)
    if (!document.querySelector('.scene')) {
      var sc = document.createElement('div');
      sc.className = 'scene'; sc.setAttribute('aria-hidden', 'true');
      sc.innerHTML = '<div class="sc-stars"></div><div class="sc-moon"></div><div class="sc-wall"></div><div class="sc-room"></div><div class="sc-sign"><i></i></div><div class="sc-tubes"><i></i><i></i><i></i></div>' +
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
    if (money && !document.querySelector('.coin-big')) {
      money.insertAdjacentHTML('beforebegin', '<i class="coin-big" aria-hidden="true"></i>');
    }
    var room = document.getElementById('chip-room');
    if (room && !document.querySelector('.emb')) room.insertAdjacentHTML('beforebegin', '<span class="emb" aria-hidden="true">' + EMBLEM + '<b></b></span>');
  }

  // ---------- Сотрудники под стиль: F — настоящий пиксельный спрайт, H — манга (ч/б тона + цвет бизнеса только акцентом) ----------
  // Рисуем SVG сотрудника в маленький canvas и обрабатываем пиксели; результат кэшируется (data:URI png), одна картинка на (тема, бизнес, уровень, редкость).
  var INK_ACC = { coffee: '#f08a24', it: '#00b894', barber: '#e8213c', burger: '#ff5a1a', auto: '#1f6bff', fitness: '#6cc000', gamedev: '#8a3dff', delivery: '#f2b600' };
  var SKIN_RGB = [[255, 225, 201], [246, 203, 165], [231, 176, 138], [201, 141, 99], [156, 102, 68], [111, 69, 44]];
  var pcache = {}, pids = {}, pseq = 0, pbusy = {};
  function avMode() { return theme === 'f' ? 'px' : theme === 'h' ? 'ink' : ''; }
  function hex(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
  function hsv(r, g, b) {
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [(h * 60 + 360) % 360, mx ? d / mx : 0, mx];
  }
  function procPx(d, W, H) {
    var a = d.data, i, op = new Uint8Array(W * H);
    for (i = 0; i < W * H; i++) {
      var k = i * 4;
      if (a[k + 3] < 120) { a[k + 3] = 0; continue; }
      op[i] = 1; a[k + 3] = 255;
      for (var c = 0; c < 3; c++) a[k + c] = Math.min(255, Math.round(a[k + c] / 36) * 36 + (a[k + c] > 240 ? 3 : 0));
    }
    // контур в 1 пиксель тёмным цветом палитры — как у спрайтов 16-бит
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      i = y * W + x; if (op[i]) continue;
      if ((x > 0 && op[i - 1]) || (x < W - 1 && op[i + 1]) || (y > 0 && op[i - W]) || (y < H - 1 && op[i + W])) {
        var q = i * 4; a[q] = 26; a[q + 1] = 28; a[q + 2] = 44; a[q + 3] = 255;
      }
    }
  }
  function procInk(d, W, H, biz) {
    var a = d.data, acc = hex(INK_ACC[biz] || '#e8213c'), ah = hsv(acc[0], acc[1], acc[2])[0];
    for (var i = 0; i < W * H; i++) {
      var k = i * 4; if (a[k + 3] < 8) continue;
      var r = a[k], g = a[k + 1], b = a[k + 2], v = hsv(r, g, b), L = 0.299 * r + 0.587 * g + 0.114 * b;
      var skin = false;
      for (var s2 = 0; s2 < SKIN_RGB.length; s2++) { var S = SKIN_RGB[s2]; if (Math.abs(S[0] - r) + Math.abs(S[1] - g) + Math.abs(S[2] - b) < 46) { skin = true; break; } }
      var dh = Math.abs(v[0] - ah); dh = Math.min(dh, 360 - dh);
      if (skin) { var st2 = L > 175 ? 255 : 222; a[k] = a[k + 1] = a[k + 2] = st2; continue; }
      if (v[1] > 0.38 && v[2] > 70 && dh < 32) {
        var dk = L < 95 ? 0.62 : 1; a[k] = acc[0] * dk; a[k + 1] = acc[1] * dk; a[k + 2] = acc[2] * dk;
      } else {
        var t = L > 196 ? 255 : L > 140 ? 216 : L > 84 ? 140 : 24; a[k] = a[k + 1] = a[k + 2] = t;
      }
    }
  }
  function processAv(id, src, m, biz) {
    if (pbusy[id]) return; pbusy[id] = 1;
    var im = new Image();
    im.onload = function () {
      try {
        var W = m === 'px' ? 34 : 96, H = m === 'px' ? 42 : 120, c = document.createElement('canvas');
        c.width = W; c.height = H;
        var x = c.getContext('2d');
        if (m === 'px') x.drawImage(im, 1, 1, W - 2, H - 2); else x.drawImage(im, 0, 0, W, H);
        var d = x.getImageData(0, 0, W, H);
        if (m === 'px') procPx(d, W, H); else procInk(d, W, H, biz);
        x.putImageData(d, 0, 0);
        pcache[id] = c.toDataURL('image/png');
        document.querySelectorAll('img[data-pk="' + id + '"]').forEach(function (n) { n.src = pcache[id]; n.classList.add('av-' + m); });
      } catch (e) {}
    };
    im.src = src;
  }
  function hookAvatars() {
    var A = window.GameAvatars; if (!A || A.__th) return;
    var orig = A.avatar; A.__th = 1;
    A.avatar = function (biz, lvl, rar, cls) {
      var html = orig.apply(this, arguments), m = avMode();
      if (!m) return html;
      var mm = html.match(/ src="([^"]+)"/); if (!mm) return html;
      var key = m + '|' + (m === 'ink' ? biz : '') + '|' + mm[1];
      var id = pids[key] || (pids[key] = 'p' + (++pseq));
      if (pcache[id]) return html.replace(mm[0], ' src="' + pcache[id] + '"').replace('class="av', 'class="av av-' + m);
      processAv(id, mm[1], m, biz);
      return html.replace('<img ', '<img data-pk="' + id + '" ');
    };
    window.avatar = A.avatar;
  }
  // avatars.js грузится позже (defer) — перехватываем момент, когда он объявит GameAvatars, и сразу подменяем avatar()
  try {
    var GA = window.GameAvatars;
    Object.defineProperty(window, 'GameAvatars', { configurable: true, enumerable: true, get: function () { return GA; }, set: function (v) { GA = v; hookAvatars(); } });
  } catch (e) {}
  // прогрев: все сотрудники текущего бизнеса, чтобы при найме/слиянии не мигало
  function warmAvatars() {
    var A = window.GameAvatars, b = root.getAttribute('data-biz');
    if (!A || !avMode() || !b) return;
    for (var l = 1; l <= 8; l++) for (var r = 0; r < 4; r++) A.avatar(b, l, r);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { decorate(); tgColors(); hookAvatars(); warmAvatars(); });
  else { decorate(); tgColors(); hookAvatars(); }

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
  // монеты в характере темы: F — пиксельная (кадры вращения), G — пластилиновая, H — тушью с линиями скорости, I — «95» без сглаживания, J — стеклянная с бликом
  function coinDraw(p, x, y, r, sq, k) {
    if (theme === 'f' || theme === 'i') {
      var u = theme === 'f' ? 2 : 1.5, fr = Math.floor(p.t * 14 + p.ph * 3) % 4, cw = [4, 3, 1, 3][fr];
      x = Math.round(x / u) * u; y = Math.round(y / u) * u;
      ctx.fillStyle = theme === 'f' ? '#1a1c2c' : '#000';
      ctx.fillRect(x - (cw + 1) * u, y - 5 * u, (cw * 2 + 2) * u, 10 * u); ctx.fillRect(x - (cw + 2) * u, y - 4 * u, (cw * 2 + 4) * u, 8 * u);
      ctx.fillStyle = theme === 'f' ? '#ffcd75' : '#ffff00'; ctx.fillRect(x - cw * u, y - 4 * u, cw * 2 * u, 8 * u); ctx.fillRect(x - (cw + 1) * u, y - 3 * u, (cw * 2 + 2) * u, 6 * u);
      ctx.fillStyle = theme === 'f' ? '#ef7d57' : '#808000'; ctx.fillRect(x + (cw - 1) * u, y - 2 * u, u, 5 * u);
      if (cw > 1) { ctx.fillStyle = '#fff'; ctx.fillRect(x - (cw - 1) * u, y - 3 * u, u, 2 * u); }
      return;
    }
    if (theme === 'g') {
      var sy = 1 + Math.sin(p.t * 18) * 0.12;
      ctx.fillStyle = '#c98a1e'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.28, r * 1.05, r * 0.95 / sy, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#ffc94a'; ctx.beginPath(); ctx.ellipse(x, y, r * 1.05, r * 0.95 / sy, 0, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.38, r * 0.32, r * 0.2, -0.6, 0, 6.283); ctx.fill();
      return;
    }
    if (theme === 'h') {
      ctx.strokeStyle = '#111'; ctx.lineWidth = 1.6;
      var vx = p.lx != null ? x - p.lx : 0, vy = p.ly != null ? y - p.ly : 0, vl = Math.sqrt(vx * vx + vy * vy) || 1;
      for (var j = -1; j <= 1; j++) { ctx.beginPath(); ctx.moveTo(x - vx / vl * (r + 3) + j * vy / vl * 4, y - vy / vl * (r + 3) - j * vx / vl * 4); ctx.lineTo(x - vx / vl * (r + 14) + j * vy / vl * 4, y - vy / vl * (r + 14) - j * vx / vl * 4); ctx.stroke(); }
      p.lx = x; p.ly = y;
      ctx.lineWidth = 2.2; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, y, r * Math.max(0.3, sq), r, 0, 0, 6.283); ctx.fill(); ctx.stroke();
      ctx.fillStyle = cssVar('--hk', '#e8213c'); ctx.beginPath(); ctx.ellipse(x, y, r * 0.5 * Math.max(0.3, sq), r * 0.5, 0, 0, 6.283); ctx.fill();
      return;
    }
    if (theme === 'j') {
      ctx.fillStyle = 'rgba(255,230,160,.25)'; ctx.beginPath(); ctx.arc(x, y, r * 2, 0, 6.283); ctx.fill();
      ctx.fillStyle = 'rgba(255,214,110,.92)'; ctx.beginPath(); ctx.ellipse(x, y, r * Math.max(0.25, sq), r, 0, 0, 6.283); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.ellipse(x - r * 0.3 * sq, y - r * 0.35, r * 0.22 * Math.max(0.3, sq), r * 0.4, 0.5, 0, 6.283); ctx.fill();
      return;
    }
    if (theme === 'k') {
      // K: светящаяся точка с ореолом и тонким кольцом
      var kg = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
      kg.addColorStop(0, 'rgba(255,236,190,.55)'); kg.addColorStop(1, 'rgba(255,236,190,0)');
      ctx.fillStyle = kg; ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, 6.283); ctx.fill();
      ctx.strokeStyle = '#F3D98B'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(x, y, r * Math.max(0.2, sq), r, 0, 0, 6.283); ctx.stroke();
      ctx.fillStyle = '#FFF6DE'; ctx.beginPath(); ctx.arc(x, y, r * 0.32, 0, 6.283); ctx.fill();
      return;
    }
    if (theme === 'l') return chipDraw(x, y, r * 1.15, sq, cssVar('--biz', '#B8324A'));
    if (theme === 'm') {
      // M: неоновая монета со следом-шлейфом
      var mb = cssVar('--biz', '#45E0D8');
      if (p.lx != null) { ctx.strokeStyle = mb; ctx.globalAlpha *= 0.5; ctx.lineWidth = r * 0.9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.lx, p.ly); ctx.lineTo(x, y); ctx.stroke(); ctx.globalAlpha /= 0.5; }
      p.lx = x; p.ly = y;
      ctx.fillStyle = 'rgba(255,214,120,.25)'; ctx.beginPath(); ctx.arc(x, y, r * 1.9, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#ffd98a'; ctx.beginPath(); ctx.ellipse(x, y, r * Math.max(0.25, sq), r, 0, 0, 6.283); ctx.fill();
      ctx.strokeStyle = '#fff4d0'; ctx.lineWidth = 1; ctx.stroke();
      return;
    }
    ctx.fillStyle = '#B9771A'; ctx.beginPath(); ctx.ellipse(x, y + 1.2, r * Math.max(0.25, sq), r, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#FFD25A'; ctx.beginPath(); ctx.ellipse(x, y, r * Math.max(0.25, sq), r, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#FFF3C4'; ctx.beginPath(); ctx.ellipse(x - r * 0.3 * sq, y - r * 0.3, r * 0.28 * Math.max(0.3, sq), r * 0.28, 0, 0, 6.283); ctx.fill();
  }
  // L: фишка казино (вид сверху, сжатая по вращению): цветной край с белыми вставками, кант, центр
  function chipDraw(x, y, r, sq, col) {
    var w = r * Math.max(0.22, sq);
    ctx.save(); ctx.translate(x, y); ctx.scale(w / r, 1);
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.arc(0, r * 0.18, r, 0, 6.283); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#f3e7cf';
    for (var i = 0; i < 6; i++) { var a = i / 6 * 6.283; ctx.beginPath(); ctx.arc(0, 0, r, a - 0.18, a + 0.18); ctx.arc(0, 0, r * 0.72, a + 0.18, a - 0.18, true); ctx.fill(); }
    ctx.strokeStyle = 'rgba(243,231,207,.85)'; ctx.lineWidth = Math.max(0.8, r * 0.08); ctx.setLineDash([r * 0.22, r * 0.18]);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, 6.283); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.3, r * 0.35, 0, 6.283); ctx.fill();
    ctx.restore();
  }
  function loop() {
    if (!parts.length) { running = false; ctx.clearRect(0, 0, cv.width, cv.height); return; }
    running = true;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = !(theme === 'f' || theme === 'i');
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      p.t += 1 / 60;
      var k = p.t / p.life;
      if (k >= 1) { if (p.done) p.done(); parts.splice(i, 1); continue; }
      if (k < 0) continue;
      // «ступенчатое» время для пиксельных тем: 8 кадров на всю жизнь частицы
      var ks = p.steps ? Math.floor(k * p.steps) / p.steps : k;
      ctx.globalAlpha = p.type === 'coin' ? (k > 0.85 ? (1 - k) / 0.15 : 1) : p.type === 'zrect' ? (1 - ks) : p.type === 'mote' ? Math.sin(k * 3.14) * (p.a || 0.8) : 1 - (p.steps ? ks : k);
      if (p.type === 'ring') {
        ctx.strokeStyle = p.c; ctx.lineWidth = (p.w || 4) * (1 - k) + 1;
        var rr = p.r0 + (p.r1 - p.r0) * (1 - Math.pow(1 - k, 3));
        ctx.beginPath(); ctx.ellipse(p.x, p.y, rr, rr * (p.fy || 1), 0, 0, 6.283); ctx.stroke();
      } else if (p.type === 'zrect') {
        // F/I: прямоугольная рамка растёт рывками (как открытие окна в 95-м или пиксельная вспышка)
        var e2 = ks, hw = p.w0 + (p.w1 - p.w0) * e2, hh = p.h0 + (p.h1 - p.h0) * e2, u2 = p.u || 1;
        ctx.strokeStyle = p.c; ctx.lineWidth = p.lw || 2;
        if (p.dash) ctx.setLineDash(p.dash);
        ctx.strokeRect(Math.round((p.x - hw / 2) / u2) * u2, Math.round((p.y - hh / 2) / u2) * u2, Math.round(hw / u2) * u2, Math.round(hh / u2) * u2);
        if (p.dash) ctx.setLineDash([]);
      } else if (p.type === 'ray') {
        // H: линии концентрации — летят от центра наружу и тают
        var e3 = 1 - Math.pow(1 - k, 2), ra = p.r0 + (p.r1 - p.r0) * e3, rb = ra + p.len * (1 - k * 0.6);
        ctx.strokeStyle = p.c; ctx.lineWidth = p.lw * (1 - k * 0.5); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x + Math.cos(p.a) * ra, p.y + Math.sin(p.a) * ra); ctx.lineTo(p.x + Math.cos(p.a) * rb, p.y + Math.sin(p.a) * rb); ctx.stroke();
      } else if (p.type === 'coin') {
        // монета летит по дуге к счётчику денег
        var kk = p.steps ? ks : k, e = kk * kk * (3 - 2 * kk);
        var x = p.x + (p.tx - p.x) * e + Math.sin(kk * 3.14) * p.bend, y = p.y + (p.ty - p.y) * e - Math.sin(kk * 3.14) * 60;
        coinDraw(p, x, y, p.s * (1 - 0.35 * k), Math.abs(Math.cos(p.t * 9 + p.ph)), k);
      } else if (p.type === 'mote') {
        // J: мягкие огоньки (боке), всплывают вверх
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
        } else if (p.type === 'px') {
          // F: квадратные пиксели по сетке, размер меняется ступеньками
          var u = p.u || 3, ps = Math.max(1, Math.round(p.s * (1 - ks * 0.5) / u)) * u;
          ctx.fillRect(Math.round(p.x / u) * u - ps / 2, Math.round(p.y / u) * u - ps / 2, ps, ps);
        } else if (p.type === 'blob') {
          // G: пластилиновые шарики с бликом, сплющиваются при падении
          var st = 1 + Math.min(0.35, Math.abs(p.vy) * 0.04);
          ctx.beginPath(); ctx.ellipse(p.x, p.y, s / st, s * st, 0, 0, 6.283); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(p.x - s * 0.3, p.y - s * 0.35 * st, s * 0.3, s * 0.2, -0.5, 0, 6.283); ctx.fill();
        } else if (p.type === 'chip') {
          // L: фишки разлетаются и крутятся
          chipDraw(p.x, p.y, s * 1.1, Math.abs(Math.cos(p.t * 8 + (p.ph || 0))), p.c);
        } else if (p.type === 'drop') {
          // M: брызги дождя — короткие штрихи по направлению полёта
          ctx.strokeStyle = p.c; ctx.lineWidth = Math.max(0.8, s * 0.35); ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2); ctx.stroke();
        } else if (p.type === 'ink') {
          // H: капли туши
          ctx.beginPath(); ctx.arc(p.x, p.y, s * 0.7, 0, 6.283); ctx.fill();
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
        s: (o.s || 2.5) + Math.random() * (o.sr || 3.5), c: colors[i % colors.length], t: 0, life: (o.life || 0.55) + Math.random() * 0.45, steps: o.steps, u: o.u, a: o.a, ph: Math.random() * 3 });
    }
    kick();
  }
  // H: линии концентрации вокруг клетки
  function rays(x, y, n, r0, r1, cols, lw) {
    canvas();
    for (var i = 0; i < n; i++) parts.push({ type: 'ray', x: x, y: y, a: i / n * 6.283 + Math.random() * 0.12, r0: r0, r1: r1, len: 14 + Math.random() * 22, c: cols[i % cols.length], lw: lw || 2.4, t: -Math.random() * 0.05, life: 0.42 + Math.random() * 0.15 });
    kick();
  }
  function zrects(c, n, col, o) {
    canvas(); o = o || {};
    for (var i = 0; i < n; i++) parts.push({ type: 'zrect', x: c.x, y: c.y, w0: c.w * (o.s0 || 0.5), h0: c.h * (o.s0 || 0.5), w1: c.w * (o.s1 || 1.8), h1: c.h * (o.s1 || 1.8),
      c: Array.isArray(col) ? col[i % col.length] : col, lw: o.lw || 2, u: o.u || 1, steps: o.steps || 6, dash: o.dash, t: -i * (o.gap || 0.07), life: o.life || 0.45 });
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

  // D «Диорама»: каждая клетка — изометрическая комнатка (пол с плитой перекрытия, две стены, окно, лампа и свет).
  // Цвета — классами из themes2.css (стены в цвете бизнеса, свет — в цвете редкости). Растягивается под клетку.
  var ROOM = '<svg class="rm" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
    '<polygon class="rm-sl" points="2,66 50,84 50,96 2,78"/><polygon class="rm-sr" points="50,84 98,66 98,78 50,96"/>' +
    '<polygon class="rm-wl" points="2,66 2,22 50,4 50,48"/><polygon class="rm-wr" points="50,48 50,4 98,22 98,66"/>' +
    '<polygon class="rm-sh" points="2,66 2,22 50,4 50,48"/>' +
    '<polygon class="rm-win" points="61,18.1 87,27.9 87,46.4 61,36.6"/><path class="rm-wf" d="M74,23 V41.5 M61,27.4 L87,37.2" vector-effect="non-scaling-stroke"/>' +
    '<polygon class="rm-pos" points="12,30 29,23.6 29,39.6 12,46"/><polygon class="rm-pos2" points="15,33 26,28.9 26,32.4 15,36.5"/>' +
    '<polygon class="rm-fl" points="2,66 50,48 98,66 50,84"/>' +
    '<path class="rm-tl" d="M26,57 L74,75 M26,75 L74,57 M14,61.5 L62,79.5 M38,52.5 L86,70.5 M14,70.5 L62,52.5 M38,79.5 L86,61.5" vector-effect="non-scaling-stroke"/>' +
    '<ellipse class="rm-pool" cx="50" cy="66" rx="31" ry="11.5"/><polygon class="rm-cone" points="45,19 55,19 78,66 22,66"/>' +
    '<path class="rm-ed" d="M2,66 V22 L50,4 L98,22 V66 M50,4 V48 M2,66 L50,84 L98,66" vector-effect="non-scaling-stroke"/>' +
    '<path class="rm-cord" d="M50,4 V13" vector-effect="non-scaling-stroke"/><path class="rm-lamp" d="M43.5,20 Q50,9.5 56.5,20 Z"/></svg>';

  window.GameTheme = {
    list: LIST,
    // доп. разметка клетки для темы (сейчас — только комнатка в D)
    cellDeco: function () { return theme === 'd' ? ROOM : ''; },
    get: function () { return theme; },
    set: function (t) {
      theme = valid(t) ? t : 'old'; write(theme); apply(); tgColors(); sceneSync(); warmAvatars();
      try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    }
  };

  var SFX = ['БАМ!', 'ДОН!', 'ХОП!', 'ВЖУХ!', 'БУМ!'];
  // I: «синий экран» — шуточное событие при аврале (тап или 2,6 с — закрывается)
  function bsod() {
    var o = document.createElement('div');
    o.className = 'bsod'; o.setAttribute('role', 'alert');
    o.innerHTML = '<div class="bs-in"><p class="bs-t"><b>СТАРТАП 95</b></p><p>Произошла исключительная ситуация 0E: АВРАЛ ×2 по адресу 0028:C0FFEE95.</p>' +
      '<p>Команда временно работает в два раза быстрее. Сохранять работу не нужно — всё сохранено.</p>' +
      '<p>* Доход ×2, пока идёт аврал.<br>* Перезагрузка компьютера не поможет — только кофе.</p><p class="bs-c">Нажмите на экран, чтобы продолжить <i>_</i></p></div>';
    document.body.appendChild(o);
    var t = setTimeout(close, 2600);
    function close() { clearTimeout(t); if (o.parentNode) o.remove(); }
    o.addEventListener('click', close);
  }
  // I: курсор-часики на полсекунды (на телефоне — значок песочных часов у счётчика дохода)
  var busyT;
  function busy() { root.classList.add('busy'); clearTimeout(busyT); busyT = setTimeout(function () { root.classList.remove('busy'); }, 700); }

  window.GameFx = {
    on: function () { return valid(theme); },
    // слияние — в характере темы
    merge: function (node, rar, up) {
      if (!node) return;
      node.classList.remove('tmerge'); void node.offsetWidth; node.classList.add('tmerge');
      setTimeout(function () { node.classList.remove('tmerge'); }, 700);
      if (theme === 'i') busy();
      if (reduce) return;
      var c = center(node), biz = cssVar('--biz', '#B9FF3F');
      var cols = rar ? [RAR[rar], '#ffffff', RAR[rar], biz] : [biz, '#ffffff', biz];
      canvas();
      if (theme === 'f') {
        // пиксельная вспышка: квадратные рамки рывками + пиксели по сетке
        var pc = rar ? [RAR[rar], '#f4f4f4', cssVar('--fb', biz)] : [cssVar('--fb', biz), '#f4f4f4', cssVar('--fbh', '#ffcd75')];
        zrects(c, up || rar ? 3 : 2, pc, { u: 3, lw: 3, steps: 5, s0: 0.6, s1: 1.7, life: 0.4 });
        burst(c.x, c.y, rar === 3 ? 30 : 22, rar === 3 ? ['#ffcd75', '#f4f4f4', '#ef7d57'] : pc, 4.2, 'px', { u: 3, s: 3, sr: 4, steps: 8, g: 0.16 });
        return;
      }
      if (theme === 'g') {
        var gc = rar ? [RAR[rar], '#ffffff', cssVar('--gb', biz)] : [cssVar('--gb', biz), cssVar('--gh', '#fff'), '#ffffff', cssVar('--gb2', biz)];
        parts.push({ type: 'ring', x: c.x, y: c.y, r0: 10, r1: c.w * 0.8, c: 'rgba(255,255,255,.9)', w: 9, t: 0, life: 0.45 });
        burst(c.x, c.y, rar === 3 ? 22 : 14, rar === 3 ? ['#ffc94a', '#ffe9a8', '#ff9fb0', '#fff'] : gc, 4, 'blob', { s: 3.5, sr: 4, g: 0.2, life: 0.6 });
        return;
      }
      if (theme === 'h') {
        var hk = cssVar('--hk', '#e8213c');
        rays(c.x, c.y, up || rar ? 30 : 22, c.w * 0.45, c.w * 0.9, rar ? ['#111', '#111', RAR[rar] === '#FFC83D' ? '#f2b600' : hk] : ['#111', '#111', '#111', hk], 2.6);
        burst(c.x, c.y, 8, ['#111', hk], 3.5, 'ink', { s: 2, sr: 3 });
        var r0 = node.getBoundingClientRect();
        floatEl(r0.left + r0.width / 2, r0.top - 4, rar === 3 ? 'ЛЕГЕНДА!!' : up ? 'ВАУ!!' : SFX[Math.floor(Math.random() * SFX.length)], 'sfx' + (rar ? ' sfx-r' : ''));
        return;
      }
      if (theme === 'i') {
        // «открытие окна» 95-го: рамки-контуры разлетаются ступеньками
        zrects(c, 6, rar ? ['#000080', RAR[rar] === '#FFC83D' ? '#808000' : '#000080'] : '#000', { u: 1, lw: 1, steps: 6, s0: 0.3, s1: 1.9, dash: [2, 2], gap: 0.045, life: 0.36 });
        return;
      }
      if (theme === 'k') {
        // тонкие кольца-обводки и несколько мягких огоньков — сдержанно
        parts.push({ type: 'ring', x: c.x, y: c.y, r0: c.w * 0.3, r1: c.w * 0.95, c: rar ? RAR[rar] : biz, w: 1.2, t: 0, life: 0.6 });
        parts.push({ type: 'ring', x: c.x, y: c.y, r0: c.w * 0.2, r1: c.w * 0.7, c: 'rgba(255,255,255,.8)', w: 0.8, t: -0.07, life: 0.55 });
        if (rar >= 2 || up) parts.push({ type: 'ring', x: c.x, y: c.y, r0: c.w * 0.3, r1: c.w * 1.5, c: rar ? RAR[rar] : biz, w: 0.8, t: -0.14, life: 0.75 });
        burst(c.x, c.y, rar === 3 ? 18 : 10, rar ? [RAR[rar], '#ffffff'] : [biz, '#ffffff'], 1.4, 'mote', { s: 4, sr: 5, g: 0, up: 0.5, life: 0.7, a: 0.85 });
        return;
      }
      if (theme === 'l') {
        // фишки разлетаются со стола, латунное кольцо; легенда — золотые фишки
        var lc = rar === 3 ? ['#D9A441', '#E9C16A', '#B8862F'] : rar ? [RAR[rar] === '#4FC3FF' ? '#3A64C4' : '#8B52C9', biz] : [biz, '#1d1d1d', biz];
        parts.push({ type: 'ring', x: c.x, y: c.y, r0: 8, r1: c.w * 0.8, c: 'rgba(233,193,120,.9)', w: 2.5, t: 0, life: 0.5 });
        burst(c.x, c.y, rar === 3 ? 12 : up ? 9 : 7, lc, 3.6, 'chip', { s: 4, sr: 2.5, g: 0.22, up: 0.9, life: 0.7 });
        burst(c.x, c.y, 8, ['#FFE3B0', '#E9C178'], 2.2, 'mote', { s: 3, sr: 3, g: 0, up: 0.4, life: 0.5, a: 0.9 });
        return;
      }
      if (theme === 'm') {
        // неоновое кольцо, «лужа» под сотрудником и брызги
        parts.push({ type: 'ring', x: c.x, y: c.y, r0: 6, r1: c.w * 0.85, c: rar ? RAR[rar] : biz, w: 2, t: 0, life: 0.5 });
        parts.push({ type: 'ring', x: c.x, y: c.y + c.h * 0.38, r0: 4, r1: c.w * 0.9, fy: 0.28, c: 'rgba(180,200,255,.8)', w: 1.2, t: 0.02, life: 0.7 });
        burst(c.x, c.y + c.h * 0.3, rar === 3 ? 22 : 14, rar ? [RAR[rar], '#cfe0ff'] : [biz, '#cfe0ff', '#ffffff'], 3.4, 'drop', { s: 2.5, sr: 2, g: 0.24, up: 1, life: 0.55 });
        return;
      }
      if (theme === 'j') {
        parts.push({ type: 'ring', x: c.x, y: c.y, r0: 6, r1: c.w * 0.85, c: 'rgba(255,255,255,.95)', w: 3, t: 0, life: 0.55 });
        if (rar) parts.push({ type: 'ring', x: c.x, y: c.y, r0: 4, r1: c.w * 1.25, c: RAR[rar], w: 2, t: -0.06, life: 0.7 });
        burst(c.x, c.y, rar === 3 ? 22 : 14, rar ? [RAR[rar], '#ffffff', 'rgba(255,240,200,1)'] : [biz, '#ffffff', '#cfe8ff'], 1.6, 'mote', { s: 6, sr: 8, g: 0, up: 0.6, life: 0.8, a: 0.9 });
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
      var n = 4, px = theme === 'f' || theme === 'i';
      for (var i = 0; i < n; i++) {
        parts.push({ type: 'coin', x: a.x + (Math.random() - 0.5) * 20, y: a.y, tx: b.x - b.w * 0.25 + Math.random() * 20, ty: b.y, bend: (Math.random() - 0.5) * 80,
          s: 6 + Math.random() * 2, t: -i * 0.06, life: 0.75 + i * 0.04, ph: Math.random() * 3, steps: px ? 14 : 0, done: i === n - 1 ? function () { bump(target); } : null });
      }
      kick();
    },
    // пассивный доход: «+N ₽» с монеткой поднимается над сотрудником
    income: function (node, text) {
      if (!node) return;
      var r = node.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      floatEl(r.left + r.width / 2, r.top + r.height * 0.3, '<i class="tcoin"></i>' + text, 'inc');
    },
    spawn: function (node) {
      if (theme === 'i') busy();
      if (!node || reduce) return;
      var c = center(node), bz = cssVar('--biz', '#B9FF3F');
      if (theme === 'f') return burst(c.x, c.y + c.h * 0.25, 10, [cssVar('--fb', bz), '#f4f4f4'], 2.6, 'px', { u: 3, s: 3, sr: 2, steps: 6 });
      if (theme === 'g') return burst(c.x, c.y + c.h * 0.25, 8, [cssVar('--gb', bz), '#ffffff'], 2.6, 'blob', { s: 2.5, sr: 3 });
      if (theme === 'h') return rays(c.x, c.y, 14, c.w * 0.4, c.w * 0.7, ['#111'], 1.8);
      if (theme === 'i') return zrects(c, 3, '#000', { u: 1, lw: 1, steps: 4, s0: 0.2, s1: 1, dash: [2, 2], life: 0.25 });
      if (theme === 'k') { parts.push({ type: 'ring', x: c.x, y: c.y, r0: c.w * 0.2, r1: c.w * 0.6, c: bz, w: 1, t: 0, life: 0.45 }); kick(); return; }
      if (theme === 'l') return burst(c.x, c.y + c.h * 0.25, 4, [bz, '#1d1d1d'], 2.4, 'chip', { s: 3, sr: 1.5, g: 0.22, up: 0.9, life: 0.5 });
      if (theme === 'm') { parts.push({ type: 'ring', x: c.x, y: c.y + c.h * 0.36, r0: 3, r1: c.w * 0.5, fy: 0.3, c: 'rgba(190,210,255,.85)', w: 1.2, t: 0, life: 0.6 }); kick(); return; }
      if (theme === 'j') return burst(c.x, c.y + c.h * 0.2, 8, ['#ffffff', bz], 1.2, 'mote', { s: 5, sr: 5, g: 0, up: 0.6, life: 0.7, a: 0.8 });
      burst(c.x, c.y + c.h * 0.25, 10, [bz, '#ffffff'], 3);
    },
    unlock: function (node) {
      if (!node || reduce) return;
      var c = center(node);
      canvas();
      if (theme === 'f') return zrects(c, 3, ['#ffcd75', '#f4f4f4'], { u: 3, lw: 3, steps: 5 }), burst(c.x, c.y, 20, ['#ffcd75', '#f4f4f4', '#73eff7'], 4, 'px', { u: 3, s: 3, steps: 8 });
      if (theme === 'h') return rays(c.x, c.y, 28, c.w * 0.4, c.w, ['#111', cssVar('--hk', '#e8213c')], 2.6);
      if (theme === 'i') return zrects(c, 6, '#000080', { u: 1, lw: 1, dash: [2, 2], gap: 0.045 });
      if (theme === 'k') { parts.push({ type: 'ring', x: c.x, y: c.y, r0: 6, r1: c.w, c: '#F3D98B', w: 1.2, t: 0, life: 0.7 }); return burst(c.x, c.y, 14, ['#F3D98B', '#ffffff'], 1.4, 'mote', { s: 4, sr: 5, g: 0, life: 0.8 }); }
      if (theme === 'l') return burst(c.x, c.y, 12, ['#D9A441', '#E9C16A', cssVar('--biz', '#B8324A')], 3.6, 'chip', { s: 4, sr: 2, g: 0.22, up: 0.9, life: 0.7 });
      if (theme === 'm') return burst(c.x, c.y, 18, ['#FFD98A', '#cfe0ff', cssVar('--biz', '#45E0D8')], 3.4, 'drop', { s: 2.5, sr: 2, g: 0.24, up: 1, life: 0.6 });
      parts.push({ type: 'ring', x: c.x, y: c.y, r0: 6, r1: c.w, c: '#FFC83D', t: 0, life: 0.6 });
      burst(c.x, c.y, 24, ['#FFC83D', '#ffffff', cssVar('--biz', '#B9FF3F')], 4.5, theme === 'g' ? 'blob' : theme === 'j' ? 'mote' : 'star', theme === 'j' ? { s: 5, sr: 6, g: 0, life: 0.8 } : null);
    },
    // аврал: I — «синий экран», остальные новые темы — крупная надпись в своём стиле
    rush: function (node) {
      if (theme === 'i') return bsod();
      var t = { f: 'POWER UP! ×2', g: 'Аврал ×2!', h: 'АВРАЛ!!', j: 'Аврал ×2', k: 'Аврал <b>×2</b>', l: 'Ставки <b>×2</b>', m: '<i>残業</i>Аврал ×2' }[theme];
      if (!t) return;
      floatEl(window.innerWidth / 2, window.innerHeight * 0.42, t, 'rushx');
      if (theme === 'h' && !reduce) rays(window.innerWidth / 2, window.innerHeight * 0.42, 40, 60, window.innerWidth * 0.7, ['#111'], 3);
    }
  };
})();
