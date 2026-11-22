/* «Стартап с нуля» — пробные оформления (A «Неоновая сцена», B «Премиум-золото», C «Кибер-комикс», D «Диорама», E «Настолка»).
   Выбор: ?theme=a|b|c|d|e (или ?theme=old — вернуть старое), запоминается в localStorage. По умолчанию — старая тема.
   Здесь: выбор темы, сцена-фон, свои SVG-иконки меню и шапки, эффекты (window.GameFx: монеты, вспышки, частицы).
   Подключается в <head> без defer — чтобы тема встала до первой отрисовки. Стили — themes.css. */
(function () {
  'use strict';
  var KEY = 'startup_zero_theme';
  var LIST = [{ id: 'old', n: 'Сейчас' }, { id: 'a', n: 'A' }, { id: 'b', n: 'B' }, { id: 'c', n: 'C' }, { id: 'd', n: 'D' }, { id: 'e', n: 'E' }];
  var BG = { a: '#07090f', b: '#0d0a12', c: '#120a2a', d: '#0b1030', e: '#3a2417', old: '#0D0F14' };
  var root = document.documentElement;

  function valid(t) { return t === 'a' || t === 'b' || t === 'c' || t === 'd' || t === 'e'; }
  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function write(t) { try { if (valid(t)) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY); } catch (e) {} }

  var theme = null;
  try {
    var q = new URLSearchParams(location.search).get('theme');
    if (q != null) { q = q.toLowerCase(); write(valid(q) ? q : 'old'); }
  } catch (e) {}
  theme = read();
  if (!valid(theme)) theme = 'old';

  function tgColors() {
    var tg = window.Telegram && window.Telegram.WebApp;
    if (!tg || !tg.initData) return;
    try { if (tg.isVersionAtLeast('6.1')) { tg.setHeaderColor(BG[theme]); tg.setBackgroundColor(BG[theme]); } } catch (e) {}
    try { if (tg.isVersionAtLeast('7.7') && tg.setBottomBarColor) tg.setBottomBarColor(BG[theme]); } catch (e) {}
  }
  function apply() {
    if (valid(theme)) root.setAttribute('data-theme', theme); else root.removeAttribute('data-theme');
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
  // Эмблема бизнеса на плашке (сцена A): щит со скосами
  var EMBLEM = '<svg class="emb-svg" viewBox="0 0 40 44" aria-hidden="true"><path class="e1" d="M20 1l17 6v14c0 11-7.4 18.6-17 22C10.4 39.6 3 32 3 21V7z"/>' +
    '<path class="e2" d="M20 5.4l13 4.6v11c0 8.6-5.6 14.6-13 17.6C12.6 35.6 7 29.6 7 21V10z"/></svg>';

  function decorate() {
    // сцена-фон (одна на страницу, статичная: градиенты + перспективный пол)
    if (!document.querySelector('.scene')) {
      var sc = document.createElement('div');
      sc.className = 'scene'; sc.setAttribute('aria-hidden', 'true');
      sc.innerHTML = '<div class="sc-stars"></div><div class="sc-moon"></div><div class="sc-wall"></div><div class="sc-room"></div><div class="sc-sign"><i></i></div><div class="sc-tubes"><i></i><i></i><i></i></div>' +
        '<div class="sc-floor"><div class="sc-grid"></div></div><div class="sc-spot"></div><div class="sc-city"></div>';
      document.body.insertBefore(sc, document.body.firstChild);
    }
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
      ctx.globalAlpha = p.type === 'coin' ? (k > 0.85 ? (1 - k) / 0.15 : 1) : 1 - k;
      if (p.type === 'ring') {
        ctx.strokeStyle = p.c; ctx.lineWidth = 4 * (1 - k) + 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * (1 - Math.pow(1 - k, 3)), 0, 6.283); ctx.stroke();
      } else if (p.type === 'coin') {
        // монета летит по дуге к счётчику денег
        var e = k * k * (3 - 2 * k);
        var x = p.x + (p.tx - p.x) * e + Math.sin(k * 3.14) * p.bend, y = p.y + (p.ty - p.y) * e - Math.sin(k * 3.14) * 60;
        var r = p.s * (1 - 0.35 * k), sq = Math.abs(Math.cos(p.t * 9 + p.ph));
        ctx.fillStyle = '#B9771A'; ctx.beginPath(); ctx.ellipse(x, y + 1.2, r * Math.max(0.25, sq), r, 0, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#FFD25A'; ctx.beginPath(); ctx.ellipse(x, y, r * Math.max(0.25, sq), r, 0, 0, 6.283); ctx.fill();
        ctx.fillStyle = '#FFF3C4'; ctx.beginPath(); ctx.ellipse(x - r * 0.3 * sq, y - r * 0.3, r * 0.28 * Math.max(0.3, sq), r * 0.28, 0, 0, 6.283); ctx.fill();
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
  function burst(x, y, n, colors, speed, type) {
    canvas();
    for (var i = 0; i < n && parts.length < 140; i++) {
      var a = Math.random() * 6.283, v = speed * (0.4 + Math.random() * 0.8);
      parts.push({ type: type || (Math.random() < 0.35 ? 'star' : 'sq'), x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.35, g: 0.12,
        s: 2.5 + Math.random() * 3.5, c: colors[i % colors.length], t: 0, life: 0.55 + Math.random() * 0.45 });
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
      theme = valid(t) ? t : 'old'; write(theme); apply(); tgColors();
      try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    }
  };

  window.GameFx = {
    on: function () { return valid(theme); },
    // слияние: вспышка, кольцо и искры (у редких — их цвет, у легенды — золото со звёздами)
    merge: function (node, rar, up) {
      if (!node) return;
      node.classList.remove('tmerge'); void node.offsetWidth; node.classList.add('tmerge');
      setTimeout(function () { node.classList.remove('tmerge'); }, 700);
      if (reduce) return;
      var c = center(node), biz = cssVar('--biz', '#B9FF3F');
      var cols = rar ? [RAR[rar], '#ffffff', RAR[rar], biz] : [biz, '#ffffff', biz];
      canvas();
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
    // пассивный доход: «+N ₽» с монеткой поднимается над сотрудником
    income: function (node, text) {
      if (!node) return;
      var r = node.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      floatEl(r.left + r.width / 2, r.top + r.height * 0.3, '<i class="tcoin"></i>' + text, 'inc');
    },
    spawn: function (node) {
      if (!node || reduce) return;
      var c = center(node);
      burst(c.x, c.y + c.h * 0.25, 10, [cssVar('--biz', '#B9FF3F'), '#ffffff'], 3);
    },
    unlock: function (node) {
      if (!node || reduce) return;
      var c = center(node);
      canvas();
      parts.push({ type: 'ring', x: c.x, y: c.y, r0: 6, r1: c.w, c: '#FFC83D', t: 0, life: 0.6 });
      burst(c.x, c.y, 24, ['#FFC83D', '#ffffff', cssVar('--biz', '#B9FF3F')], 4.5, 'star');
    }
  };
})();
