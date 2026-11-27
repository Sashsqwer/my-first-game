/* «Стартап с нуля» — сотрудники, нарисованные кодом (SVG, «чиби»: большая голова, чистые формы).
   avatar(business, level, rarity, cls, kit) → HTML-строка: <img> с картинкой. kit — комплект стиля (main | neon | collection),
   по умолчанию — надетый (GameTheme.get()).
     1) если в CONTENT.STAFF_IMG[kit] есть «<business>-<level>» — берём app/img/staff/<kit>/<business>-<level>.webp (нарисованные картинки);
     2) иначе — SVG отсюда (кэшируется как data:URI, на клетку — один <img>, без лишнего DOM).
   Внешность детерминирована по (бизнес, уровень): один уровень всегда выглядит одинаково.
   Чем выше уровень — тем солиднее: футболка → форма профессии → рубашка/жилет → пиджак → золото и корона.
   Режим «смайлики» (⚙️ → «Сотрудники») хранится в localStorage, его читает game.js через GameAvatars.mode(). */
(function () {
  'use strict';
  var KEY = 'startup_zero_staff';
  var INK = '#2a1f33';
  var SKIN = ['#ffe1c9', '#f6cba5', '#e7b08a', '#c98d63', '#9c6644', '#6f452c'];
  var HAIR = { black: '#231a1f', dark: '#3b2619', brown: '#6b4126', light: '#9a6634', blond: '#e1b04c', ginger: '#c0502b', grey: '#a7adb7', pink: '#ff5fa8', blue: '#4fb6ff', violet: '#9b6bff' };

  // Цвета формы по бизнесу: uni — форма, acc — акцент (логотип, кепка), pants — брюки
  var PAL = {
    coffee: { uni: '#7a4b2e', acc: '#FFB547', pants: '#3b2d2a' },
    it: { uni: '#1fb38f', acc: '#2CF5C4', pants: '#2c3550' },
    barber: { uni: '#2d2b36', acc: '#FF3D55', pants: '#26242e' },
    burger: { uni: '#e0452b', acc: '#FFB02E', pants: '#34303a' },
    auto: { uni: '#2f6fd6', acc: '#FF8A1F', pants: '#24407a' },
    fitness: { uni: '#5fb520', acc: '#B6FF2E', pants: '#2b2f3a' },
    gamedev: { uni: '#7b47d6', acc: '#B57BFF', pants: '#2a2640' },
    delivery: { uni: '#f2c40c', acc: '#2b2b33', pants: '#34363f' }
  };

  // Роли: o — одежда, c — цвет одежды (по умолчанию форма бизнеса), hat, prop, x — детали лица/шеи, hs — причёска, hc — цвет волос
  var ROLES = {
    coffee: [
      { o: 'tee', c: '#eef1f6', prop: 'cup', x: [] },
      { o: 'apron', c: '#f4efe6', prop: 'cup', x: [] },
      { o: 'apron', c: '#2f2d38', prop: 'cezve', hat: 'bandana', x: [] },
      { o: 'apron', c: '#9c3d2f', plaid: 1, prop: 'beans', x: ['beard'] },
      { o: 'apron', c: '#f4efe6', prop: 'pitcher', hat: 'beret', x: ['mustache'] },
      { o: 'vest', c: '#f4f4f6', vest: '#5a3a28', tie: '#FFB547', prop: 'clipboard', x: ['glasses'] },
      { o: 'jacket', c: '#334063', tie: '#c8862a', prop: 'keys', x: [] },
      { o: 'gold', prop: 'goldcup', hat: 'crown', x: ['chain'] }
    ],
    it: [
      { o: 'tee', c: '#dfe5ee', prop: 'book', x: ['backpack'] },
      { o: 'hoodie', c: '#1fb38f', prop: 'laptop', x: [] },
      { o: 'hoodie', c: '#34406a', prop: 'laptop', hat: 'headphones', x: [] },
      { o: 'shirt', c: '#3d6fb0', plaid: 1, prop: 'mug', x: ['beard', 'glasses'] },
      { o: 'polo', c: '#26c6a0', prop: 'tablet', hat: 'headset', x: [] },
      { o: 'turtle', c: '#23222b', prop: 'gear', x: ['glasses'] },
      { o: 'jacket', c: '#4a4f63', inner: '#ffffff', prop: 'chart', x: [] },
      { o: 'gold', prop: 'bag', hat: 'horn', x: ['chain'] }
    ],
    barber: [
      { o: 'tee', c: '#e9e4dc', prop: 'broom', x: [] },
      { o: 'apron', c: '#f3f3f5', prop: 'scissors', x: [] },
      { o: 'apron', c: '#8b2232', prop: 'comb', x: ['beard'] },
      { o: 'apron', c: '#1e1d24', prop: 'clipper', hs: 'buzz', x: ['bigbeard', 'mustache'] },
      { o: 'apron', c: '#f3f3f5', prop: 'brush', hs: 'mohawk', hc: 'pink', x: [] },
      { o: 'jacket', c: '#1f1e26', inner: '#FF3D55', prop: 'scissors', x: ['shades'] },
      { o: 'jacket', c: '#3a3f55', tie: '#FF3D55', prop: 'tablet', x: ['stubble'] },
      { o: 'gold', prop: 'goldscissors', hat: 'crown', hs: 'side', x: ['bigbeard', 'chain'] }
    ],
    burger: [
      { o: 'tee', c: '#f6f1e6', prop: 'lettuce', hat: 'paper', x: [] },
      { o: 'chef', c: '#ffffff', prop: 'spatula', hat: 'toque1', x: [] },
      { o: 'apron', c: '#2f2d38', prop: 'tongs', hat: 'bandana', x: ['stubble'] },
      { o: 'chef', c: '#ffffff', prop: 'knife', hat: 'toque2', x: [] },
      { o: 'chef', c: '#ffffff', prop: 'burger', hat: 'toque3', x: ['mustache'] },
      { o: 'vest', c: '#ffffff', vest: '#2f2d38', tie: '#e0452b', prop: 'clipboard', x: [] },
      { o: 'jacket', c: '#3b3550', tie: '#FFB02E', prop: 'briefcase', x: [] },
      { o: 'gold', prop: 'goldburger', hat: 'crown', x: ['chain', 'mustache'] }
    ],
    auto: [
      { o: 'tee', c: '#7fc4ff', prop: 'sponge', x: [] },
      { o: 'overall', c: '#e9e4dc', prop: 'wrench', x: ['smudge'] },
      { o: 'overall', c: '#ff8a1f', prop: 'wrench', hat: 'cap', x: ['smudge'] },
      { o: 'overall', c: '#e9e4dc', prop: 'tablet', x: ['glasses'] },
      { o: 'polo', c: '#2f6fd6', prop: 'clipboard', x: [] },
      { o: 'overall', c: '#3a3f55', prop: 'wrench', hat: 'hardhat', x: ['mustache'] },
      { o: 'jacket', c: '#24262f', tie: '#FF8A1F', prop: 'keys', hat: 'tophat', x: [] },
      { o: 'gold', prop: 'goldwrench', hat: 'crown', x: ['chain'] }
    ],
    fitness: [
      { o: 'tee', c: '#cfd6e2', prop: 'mop', x: [] },
      { o: 'tank', c: '#5fb520', prop: 'bottle', hat: 'headband', x: ['whistle'] },
      { o: 'tank', c: '#2d2b36', prop: 'dumbbell', x: ['muscle'] },
      { o: 'tank', c: '#b07be8', prop: 'mat', hs: 'bun', x: [] },
      { o: 'polo', c: '#ffffff', prop: 'apple', x: ['glasses'] },
      { o: 'track', c: '#2f6fd6', prop: 'trophy', x: ['whistle'] },
      { o: 'jacket', c: '#2d3b2a', tie: '#B6FF2E', prop: 'clipboard', x: [] },
      { o: 'gold', prop: 'golddumbbell', hat: 'crown', x: ['chain'] }
    ],
    gamedev: [
      { o: 'tee', c: '#ff9a3d', prop: 'gamepad', hat: 'headphones', x: [] },
      { o: 'hoodie', c: '#e85c9c', prop: 'pen', hat: 'beret', x: [] },
      { o: 'hoodie', c: '#2fb3a0', prop: 'dice', x: [] },
      { o: 'hoodie', c: '#2a2838', prop: 'laptop', x: ['glasses'] },
      { o: 'shirt', c: '#ffffff', prop: 'note', hat: 'headphones', x: [] },
      { o: 'jacket', c: '#463a6b', inner: '#ffffff', prop: 'clapper', x: [] },
      { o: 'jacket', c: '#1f1e26', inner: '#B57BFF', prop: 'joystick', hat: 'beret', x: ['shades'] },
      { o: 'gold', prop: 'goldpad', hat: 'crown', x: ['chain'] }
    ],
    delivery: [
      { o: 'tee', c: '#c9a77a', prop: 'box', x: [] },
      { o: 'courier', c: '#f2c40c', prop: 'phone', hat: 'cap', x: ['thermo'] },
      { o: 'courier', c: '#f2c40c', prop: 'bottle', hat: 'helmet', x: ['thermo'] },
      { o: 'courier', c: '#2d2b36', prop: 'pizza', hat: 'moto', x: ['thermo'] },
      { o: 'shirt', c: '#e9f0fb', prop: 'map', x: ['glasses'] },
      { o: 'polo', c: '#f2c40c', prop: 'phone', hat: 'headset', x: [] },
      { o: 'hiviz', c: '#3a3f55', prop: 'clipboard', hat: 'hardhat', x: [] },
      { o: 'gold', prop: 'goldbox', hat: 'crown', x: ['chain'] }
    ]
  };

  // ---------- Детерминированный «рандом» ----------
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  var STYLES = ['short', 'side', 'spiky', 'curly', 'bob', 'long', 'ponytail', 'short', 'side', 'curly'];
  var HC_ORDER = ['dark', 'brown', 'black', 'light', 'blond', 'ginger', 'dark', 'brown'];
  var BIZ_SEED = { coffee: 0, it: 3, barber: 1, burger: 5, auto: 2, fitness: 4, gamedev: 6, delivery: 7 };
  function look(biz, lvl, role) {
    var h = hash(biz + ':' + lvl), s = (BIZ_SEED[biz] || 0);
    // в одном бизнесе соседние уровни не повторяются: сдвиг по уровню, а не чистый рандом
    var look = {
      skin: SKIN[(s * 2 + lvl * 5 + (h & 1)) % SKIN.length],
      hs: role.hs || STYLES[(s * 3 + lvl * 7 + (h >> 3) % 3) % STYLES.length],
      hc: HAIR[role.hc || HC_ORDER[(s + lvl * 3 + (h >> 5) % 2) % HC_ORDER.length]],
      eyes: (h >> 7) % 3,
      mouth: lvl >= 5 ? 1 : (h >> 9) % 2
    };
    if (lvl === 8 || (role.x.indexOf('beard') >= 0 && lvl >= 6)) look.hc = lvl === 8 && (s % 2) ? HAIR.grey : look.hc;
    // бороды и «длинные» причёски вместе не рисуем — читается хуже
    if (role.x.indexOf('beard') >= 0 || role.x.indexOf('bigbeard') >= 0 || role.x.indexOf('mustache') >= 0) { if (look.hs === 'long' || look.hs === 'bob' || look.hs === 'ponytail') look.hs = 'short'; }
    return look;
  }

  // ---------- Помощники ----------
  function shade(hex, k) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (k < 0) { r *= 1 + k; g *= 1 + k; b *= 1 + k; } else { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
    return '#' + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1);
  }
  function light(hex) { var n = parseInt(hex.slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150; }
  var O = ' stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"';
  var O1 = ' stroke="' + INK + '" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"';
  function P(d, fill, extra) { return '<path d="' + d + '" fill="' + fill + '"' + (extra == null ? O : extra) + '/>'; }
  function C(cx, cy, r, fill, extra) { return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + fill + '"' + (extra == null ? O : extra) + '/>'; }
  function E(cx, cy, rx, ry, fill, extra) { return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + fill + '"' + (extra == null ? O : extra) + '/>'; }
  function R(x, y, w, h, rx, fill, extra) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + rx + '" fill="' + fill + '"' + (extra == null ? O : extra) + '/>'; }
  function L(d, color, w) { return '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"/>'; }
  var GOLD = '#f5c542', GOLD_D = '#c48a12', GOLD_L = '#fff0b0';

  // ---------- Тело ----------
  var TORSO = 'M31,96 C29.5,85 30,73 34,67.5 C37,63.6 42.5,62 50,62 C57.5,62 63,63.6 66,67.5 C70,73 70.5,85 69,96 Z';
  function torsoShade() { return '<path d="M58,63 C64,64.5 67.5,68 68.8,74 C70,82 70,89 69,96 L60,96 C62,86 62,74 58,63 Z" fill="#000" opacity=".13"/>'; }

  function outfit(r, p, lk) {
    var c = r.c || p.uni, s = '', o = r.o, dark = shade(c, -0.25);
    var collar = function (col) { return P('M42.5,63 L50,71 L57.5,63 L54,62.2 L50,66 L46,62.2 Z', col || '#ffffff', O1); };
    var tie = function (col) { return P('M48.4,66.5 L51.6,66.5 L52.6,69 L51.2,80 L50,82 L48.8,80 L47.4,69 Z', col, O1) + P('M48.2,66 L51.8,66 L51.2,69 L48.8,69 Z', shade(col, -0.2), O1); };
    var plaid = function () {
      return '<g clip-path="url(#tc)" opacity=".38">' + L('M30,72 H70 M30,80 H70 M30,88 H70', '#000', 2.2) + L('M38,60 V98 M46,60 V98 M54,60 V98 M62,60 V98', '#fff', 1.4) + '</g>';
    };
    if (o === 'tee') {
      s += P(TORSO, c) + torsoShade();
      s += L('M44,63.2 Q50,68 56,63.2', shade(c, -0.35), 1.6);
      s += C(57.5, 74.5, 3.2, p.acc, O1);
    } else if (o === 'hoodie') {
      s += P('M36,66 C38,58 62,58 64,66 C58,64 42,64 36,66 Z', dark) + P(TORSO, c) + torsoShade();
      s += P('M40.5,63.5 Q50,73 59.5,63.5', shade(c, -0.15), O1);
      s += L('M46.5,67 V75 M53.5,67 V75', '#f4f4f4', 1.4);
      s += P('M39,84 H61 L58,94 H42 Z', shade(c, -0.12), O1);
    } else if (o === 'apron' || o === 'chef') {
      if (o === 'chef') {
        s += P(TORSO, c) + torsoShade();
        s += P('M42,62.6 Q50,69 58,62.6 L57,66 Q50,70 43,66 Z', p.acc, O1);
        s += L('M50,68 V96', '#d9dde5', 1.4) + C(45.5, 74, 1.4, '#c6ccd6', '') + C(45.5, 82, 1.4, '#c6ccd6', '') + C(54.5, 74, 1.4, '#c6ccd6', '') + C(54.5, 82, 1.4, '#c6ccd6', '');
      } else {
        s += P(TORSO, c) + torsoShade();
        if (r.plaid) s += plaid();
        var ap = r.c === '#2f2d38' && p === PAL.burger ? '#e0452b' : (p === PAL.barber ? (r.c === '#1e1d24' ? '#5b3a28' : '#2d2b36') : p.uni);
        s += L('M41.5,63.5 L43,71 M58.5,63.5 L57,71', shade(ap, -0.3), 1.8);
        s += P('M41.5,71 H58.5 L59.5,80 C62.5,82 64.5,88 64,96 H36 C35.5,88 37.5,82 40.5,80 Z', ap, O1);
        s += P('M45,84 H55 V90 H45 Z', shade(ap, -0.18), O1);
        s += C(50, 75.5, 2, p.acc, '');
      }
    } else if (o === 'overall') {
      s += P(TORSO, c) + torsoShade();
      var ov = p.uni;
      s += P('M38.5,64.5 L42,64 L44,73 H56 L58,64 L61.5,64.5 L60,74 C63,80 64.8,88 64.5,96 H35.5 C35.2,88 37,80 40,74 Z', ov, O1);
      s += C(43.6, 73.5, 1.5, '#ffd36b', O1) + C(56.4, 73.5, 1.5, '#ffd36b', O1);
      s += P('M45,78 H55 V85 H45 Z', shade(ov, -0.18), O1);
    } else if (o === 'tank') {
      s += P(TORSO, lk.skin) + P('M36.5,96 C35,86 35.5,74 38.5,66 L42,64.5 Q50,72 58,64.5 L61.5,66 C64.5,74 65,86 63.5,96 Z', c, O1) + torsoShade();
      if (r.x.indexOf('muscle') >= 0) s += L('M42,70 Q46,73 50,70 Q54,73 58,70', shade(c, -0.4), 1.3);
    } else if (o === 'polo' || o === 'shirt' || o === 'turtle' || o === 'track' || o === 'courier' || o === 'hiviz') {
      s += P(TORSO, c) + torsoShade();
      if (r.plaid) s += plaid();
      if (o === 'polo') { s += collar(shade(c, -0.08)) + L('M50,70 V77', shade(c, -0.35), 1.4) + C(50, 73.5, 0.9, shade(c, -0.45), ''); s += C(58, 72, 2.6, p.acc, O1); }
      if (o === 'shirt') { s += collar('#ffffff') + L('M50,70 V96', shade(c, -0.25), 1.2) + C(50, 76, 0.9, shade(c, -0.45), '') + C(50, 84, 0.9, shade(c, -0.45), ''); }
      if (o === 'turtle') { s += P('M42,61.5 Q50,59 58,61.5 L58.5,66.5 Q50,69 41.5,66.5 Z', shade(c, 0.12), O1); }
      if (o === 'track') { s += collar(shade(c, 0.1)) + L('M50,69 V96', '#e8e8ee', 1.6) + L('M33.5,70 L32,94 M66.5,70 L68,94', '#ffffff', 2); }
      if (o === 'courier') { s += collar(shade(c, -0.15)) + L('M50,69 V96', shade(c, -0.4), 1.4) + R(32, 84, 36, 4, 1, light(c) ? '#2b2b33' : '#f2c40c', O1); }
      if (o === 'hiviz') {
        s += collar('#ffffff') + tie('#2f6fd6');
        s += P('M34.5,68 L42,64 L46,96 H32.5 C31,86 31.5,75 34.5,68 Z', '#ff8a1f', O1) + P('M65.5,68 L58,64 L54,96 H67.5 C69,86 68.5,75 65.5,68 Z', '#ff8a1f', O1);
        s += L('M33,84 L45,84 M55,84 L67,84', '#e9f6ff', 2.6);
      }
    } else if (o === 'vest') {
      s += P(TORSO, c) + torsoShade() + collar('#ffffff') + tie(r.tie || p.acc);
      var v = r.vest || '#3a3f55';
      s += P('M35,68 C37,65 40,64 43,63.6 L48.5,78 L47,96 H32.5 C31,86 31.5,76 35,68 Z', v, O1);
      s += P('M65,68 C63,65 60,64 57,63.6 L51.5,78 L53,96 H67.5 C69,86 68.5,76 65,68 Z', v, O1);
      s += C(48.6, 84, 1.1, shade(v, 0.4), '') + C(48.6, 90, 1.1, shade(v, 0.4), '');
    } else if (o === 'jacket' || o === 'gold') {
      var g = o === 'gold', jc = g ? '#2a1d4f' : c, inner = r.inner || '#ffffff';
      s += P(TORSO, inner) + (r.tie || g ? collar('#ffffff') : '') + (g ? tie('#d8263f') : r.tie ? tie(r.tie) : '');
      if (!r.tie && !g) s += L('M44,63.2 Q50,67 56,63.2', shade(inner, -0.3), 1.4);
      s += P('M34.5,68 C36.5,64.5 40,63.2 43,62.8 L46,70 L44,73 L49.2,90 L48.5,96 H32 C30.5,86 31,76 34.5,68 Z', jc, O1);
      s += P('M65.5,68 C63.5,64.5 60,63.2 57,62.8 L54,70 L56,73 L50.8,90 L51.5,96 H68 C69.5,86 69,76 65.5,68 Z', jc, O1);
      var lap = g ? GOLD : shade(jc, 0.18);
      s += P('M43,62.8 L46,70 L44,73 L48,84 L41.5,71 Z', lap, O1) + P('M57,62.8 L54,70 L56,73 L52,84 L58.5,71 Z', lap, O1);
      s += torsoShade();
      s += P('M58,76 L63,75.5 L63.2,77.2 L58.2,77.6 Z', g ? '#ffffff' : (r.tie || '#ffffff'), O1);
      if (g) s += L('M31.5,94 H48.5 M51.5,94 H68.5', GOLD, 1.6) + C(47.5, 88, 1.2, GOLD, '') + C(52.5, 88, 1.2, GOLD, '');
    }
    return s;
  }

  // ---------- Руки ----------
  function arm(d, sleeve, skin, bare) {
    return L(d, INK, 10.6) + L(d, bare ? skin : sleeve, 6.6);
  }
  function hand(x, y, skin) { return C(x, y, 4.4, skin, O1); }

  // ---------- Голова ----------
  function hairBack(hs, hc) {
    var d = shade(hc, -0.15);
    if (hs === 'long') return P('M23.5,40 C20,58 19,70 26,76 C33,79 67,79 74,76 C81,70 80,58 76.5,40 Z', d);
    if (hs === 'bob') return P('M23,36 C21,48 21,58 25,62 L75,62 C79,58 79,48 77,36 Z', d);
    if (hs === 'bun') return C(50, 10.5, 8.5, d);
    if (hs === 'ponytail') return P('M70,30 C82,32 86,46 82,60 C80,64 76,64 77,58 C79,48 76,40 69,37 Z', d);
    return '';
  }
  function hairFront(hs, hc) {
    var hl = '<path d="M33,20 C38,15 45,13 50,13" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2.4" stroke-linecap="round"/>';
    switch (hs) {
      case 'short': return P('M24.5,37 C22.8,19 35,10.5 50,10.5 C65,10.5 77.2,19 75.5,37 C73.5,30.5 70,27 64.5,26.5 C59,29 52,28.5 46,25.5 C41,29.5 34,30 29,29 C26.5,31 25.2,33.5 24.5,37 Z', hc) + hl;
      case 'side': return P('M24,39 C21,20 34,9.5 50,9.5 C67,9.5 79.5,19 76,39 C74.5,32 72,28 68,25.5 C59,32 43,32.5 33,25 C29,28.5 25.8,32.5 24,39 Z', hc) + hl;
      case 'spiky': return P('M24,38 C22.5,25 26,17.5 31,14 L29.5,6.5 L38,10.5 L41.5,3 L48,9.5 L55,2.5 L58.5,10 L66.5,5 L66.5,12.5 C73,15.5 78,23 76,38 C72.5,30 67,27 61,27.5 L57,23.5 L52.5,28.5 L46.5,24.5 L40.5,29.5 C34.5,28.5 28,31.5 24,38 Z', hc) + hl;
      case 'curly': return P('M24,39 C17.5,33 19.5,22.5 26.5,19.5 C26.5,11.5 35,7.5 41,11 C45,5.5 55,5.5 59,11 C65,7.5 73.5,11.5 73.5,19.5 C80.5,22.5 82.5,33 76,39 C74,32 70.5,28.5 66,28.5 C62,31.5 56,31.5 52,28.5 C48,31.5 42,31.5 38,28.5 C33,29 27.5,31.5 24,39 Z', hc) + hl;
      case 'bob': return P('M23.5,44 C19.5,20 34,9.5 50,9.5 C66,9.5 80.5,20 76.5,44 C74.5,37 73.5,32 71.5,28.5 C62,31.5 38,31.5 28.5,28.5 C26.5,32 25.5,37 23.5,44 Z', hc) + hl;
      case 'long': return P('M23.5,46 C19.5,20 34,9.5 50,9.5 C66,9.5 80.5,20 76.5,46 C75,38 74,33 71,29 C66,26 59,24 54,22 C50,27 40,30 30,30 C27,34 25,39 23.5,46 Z', hc) + hl;
      case 'ponytail': return P('M24.5,37 C22.8,19 35,10 50,10 C65,10 77.2,19 75.5,37 C73,30 69,27 63,26.5 C57,29.5 45,29.5 38,26.5 C32,28 27,31.5 24.5,37 Z', hc) + hl;
      case 'bun': return P('M24.5,36 C23.5,20 35,12 50,12 C65,12 76.5,20 75.5,36 C72,29 66,26.5 58,27.5 C53,25.5 47,25.5 42,27.5 C34,26.5 28,29 24.5,36 Z', hc) + hl;
      case 'buzz': return P('M25.5,33 C26.5,19 37,12.5 50,12.5 C63,12.5 73.5,19 74.5,33 C66,26.5 34,26.5 25.5,33 Z', hc, O1);
      case 'mohawk': return P('M25.5,33 C26.5,19 37,12.5 50,12.5 C63,12.5 73.5,19 74.5,33 C66,26.5 34,26.5 25.5,33 Z', shade(hc, -0.45), O1) +
        P('M41,22 C41,10 45,2 52,1 C49,6 50,9 54,8 C53,12 56,13 59,13 C58,18 59,21 60,23 C54,26 46,26 41,22 Z', hc) + hl;
    }
    return '';
  }
  function face(lk, r, lvl) {
    var s = '', skin = lk.skin, x = r.x, ink = INK;
    s += C(25, 42, 5.2, skin) + C(75, 42, 5.2, skin);
    s += C(25, 42, 2.2, shade(skin, -0.18), '') + C(75, 42, 2.2, shade(skin, -0.18), '');
    s += E(50, 38, 25.5, 24, skin);
    s += '<path d="M62,17.5 C71,22 75.5,30 75.3,40 C75,51 68,58.5 58,61 C66,55 69.5,47 69.5,39 C69.5,30 66.5,22.5 62,17.5 Z" fill="#000" opacity=".07"/>';
    if (x.indexOf('bigbeard') >= 0) s += P('M26.5,42 C26,60 36,70 50,70 C64,70 74,60 73.5,42 C70,49 66,52.5 60,52.5 C56,49.5 44,49.5 40,52.5 C34,52.5 30,49 26.5,42 Z', lk.hc);
    else if (x.indexOf('beard') >= 0) s += P('M27,44 C28.5,57 38,63.5 50,63.5 C62,63.5 71.5,57 73,44 C70,50 66,53 60,53 C56,50.5 44,50.5 40,53 C34,53 30,50 27,44 Z', lk.hc);
    else if (x.indexOf('stubble') >= 0) s += '<path d="M30,49 C33,58 41,61.5 50,61.5 C59,61.5 67,58 70,49 C66,54 61,56 50,56 C39,56 34,54 30,49 Z" fill="' + lk.hc + '" opacity=".28"/>';
    // глаза
    var ey = 42;
    if (x.indexOf('shades') >= 0) {
      s += P('M32,37.5 H47.5 C47.5,44 45,47 40,47 C35,47 32.5,44 32,37.5 Z', '#15131c', O1) + P('M52.5,37.5 H68 C67.5,44 65,47 60,47 C55,47 52.5,44 52.5,37.5 Z', '#15131c', O1);
      s += L('M47.5,39 H52.5', ink, 1.8) + L('M35,40 L38.5,40', '#ffffff', 1.4) + L('M55.5,40 L59,40', '#ffffff', 1.4);
    } else {
      if (lk.eyes === 2) s += L('M37.5,42.5 Q41,38.8 44.5,42.5 M55.5,42.5 Q59,38.8 62.5,42.5', ink, 2.4);
      else {
        s += E(41, ey, 3.5, 4.4, ink, '') + E(59, ey, 3.5, 4.4, ink, '');
        s += C(42.3, ey - 1.7, 1.35, '#ffffff', '') + C(60.3, ey - 1.7, 1.35, '#ffffff', '') + C(40.2, ey + 1.6, 0.6, '#ffffff', '') + C(58.2, ey + 1.6, 0.6, '#ffffff', '');
      }
      var by = lk.eyes === 1 ? 33.5 : 34.5, bc = lvl >= 6 ? shade(lk.hc, -0.2) : lk.hc;
      s += L('M36.5,' + (by + 0.6) + ' Q41,' + (by - 1.6) + ' 45,' + by + ' M55,' + by + ' Q59,' + (by - 1.6) + ' 63.5,' + (by + 0.6), bc === '#e1b04c' ? '#a8752a' : bc, 2.1);
    }
    if (x.indexOf('glasses') >= 0) s += '<g fill="#ffffff" fill-opacity=".18"' + O1 + '><circle cx="41" cy="42" r="6.4"/><circle cx="59" cy="42" r="6.4"/></g>' + L('M47.4,41.5 H52.6 M34.6,41 L27.5,39.5 M65.4,41 L72.5,39.5', ink, 1.6);
    // щёки
    s += E(34.5, 50, 4, 2.4, '#ff7d8e', ' opacity=".38"') + E(65.5, 50, 4, 2.4, '#ff7d8e', ' opacity=".38"');
    if (x.indexOf('smudge') >= 0) s += E(66, 46.5, 3.2, 1.6, '#3a3340', ' opacity=".35"');
    // рот
    if (x.indexOf('mustache') >= 0) {
      s += P('M43,54.6 Q46.6,56.6 50,55.6 Q53.4,56.6 57,54.6', 'none', ' stroke="' + INK + '" stroke-width="1.6" stroke-linecap="round"');
      s += P('M41.5,52.5 C44.5,48.5 48.5,49 50,50.8 C51.5,49 55.5,48.5 58.5,52.5 C55,54.2 52,53.4 50,52.4 C48,53.4 45,54.2 41.5,52.5 Z', lk.hc === HAIR.grey ? '#8e939c' : lk.hc, O1);
    } else if (lk.mouth === 1) {
      s += P('M44.5,51.5 Q50,52.6 55.5,51.5 Q55,57.5 50,57.6 Q45,57.5 44.5,51.5 Z', '#7a2a3a', O1) + P('M46.6,55.6 Q50,54 53.4,55.6 Q50,57.4 46.6,55.6 Z', '#ff8a9a', '');
    } else s += L('M45,52 Q50,56.6 55,52', ink, 2);
    return s;
  }
  function headwear(hat, p, hc) {
    switch (hat) {
      case 'cap': return P('M25.5,31 C25,15 37,8.5 50,8.5 C63,8.5 75,15 74.5,31 Z', p.uni === '#f2c40c' ? '#2b2b33' : p.acc) + '<path d="M31,22 C35,14 43,11 50,11" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2.4" stroke-linecap="round"/>' +
        P('M23,31 Q50,25 80,30 Q86,31.5 84,34.5 Q52,30.5 24.5,35.5 Q21,34 23,31 Z', shade(p.uni === '#f2c40c' ? '#2b2b33' : p.acc, -0.25)) + C(50, 9.5, 1.8, shade(p.acc, -0.3), O1);
      case 'bandana': return P('M24.5,30 C30,22 70,22 75.5,30 L75,35.5 C68,30 32,30 25,35.5 Z', p.acc) + P('M74,31 L82,27 L81,35 Z M74,32 L81,38 L76,40 Z', shade(p.acc, -0.2), O1) +
        C(40, 30, 1.1, '#fff', ' opacity=".8"') + C(52, 28.5, 1.1, '#fff', ' opacity=".8"') + C(64, 30, 1.1, '#fff', ' opacity=".8"');
      case 'beret': return P('M26,24 C24,14 40,6 54,7 C68,8 80,14 76,22 C70,26 36,28 26,24 Z', '#d8314a') + C(53, 7, 2, '#a3203a', O1);
      case 'paper': return P('M28,30 L32,14 H68 L72,30 Z', '#ffffff') + R(30.5, 21, 39, 4.5, 1, p.uni, '');
      case 'toque1': case 'toque2': case 'toque3':
        var t = hat === 'toque1' ? 0 : hat === 'toque2' ? 6 : 13;
        return P('M30,30 C26,' + (20 - t) + ' 34,' + (10 - t) + ' 41,' + (13 - t) + ' C43,' + (4 - t) + ' 57,' + (4 - t) + ' 59,' + (13 - t) + ' C66,' + (10 - t) + ' 74,' + (20 - t) + ' 70,30 Z', '#ffffff') +
          R(29, 25, 42, 8, 2.5, '#f1f3f7') + L('M42,' + (16 - t) + ' Q44,22 43,26 M58,' + (16 - t) + ' Q56,22 57,26', '#d7dbe3', 1.4);
      case 'headphones': return L('M23,42 C19,18 33,7 50,7 C67,7 81,18 77,42', INK, 6) + L('M23,42 C19,18 33,7 50,7 C67,7 81,18 77,42', p.acc === '#2b2b33' ? '#ff8a1f' : shade(p.acc, -0.1), 3) +
        R(17.5, 34, 10, 16, 4.5, shade(p.uni, -0.1)) + R(72.5, 34, 10, 16, 4.5, shade(p.uni, -0.1));
      case 'headset': return L('M24,40 C21,18 34,8.5 50,8.5 C66,8.5 79,18 76,40', INK, 4.8) + L('M24,40 C21,18 34,8.5 50,8.5 C66,8.5 79,18 76,40', '#4a4f63', 2.2) +
        R(18.5, 35, 9, 13, 4, '#3a3f55') + L('M23,47 C24,55 30,58 38,57', INK, 2.2) + C(39, 57, 2.2, p.acc, O1);
      case 'helmet': return P('M23.5,33 C22,15 35,7 50,7 C65,7 78,15 76.5,33 Z', p.uni) + L('M38,10 L40,30 M50,7.5 V31 M62,10 L60,30', shade(p.uni, -0.35), 1.6) + P('M22,33 H78 V36.5 H22 Z', shade(p.uni, -0.3), O1);
      case 'moto': return P('M21,44 C17,16 33,4 50,4 C67,4 83,16 79,44 L72,44 C72,32 64,26 50,26 C36,26 28,32 28,44 Z', '#e83a3a') +
        P('M27,27 C34,20 66,20 73,27 L71,31 C64,25.5 36,25.5 29,31 Z', '#2a2f45', O1) + L('M30,12 C38,7 46,6 50,6', '#fff', 2.2);
      case 'hardhat': return P('M25,30 C25,15 37,8 50,8 C63,8 75,15 75,30 Z', '#ffc928') + L('M50,8.5 V29 M42,10 L41,29 M58,10 L59,29', '#e0a400', 1.6) + P('M20,30 H80 Q82,34 78,34.5 H22 Q18,34 20,30 Z', '#f0b400');
      case 'tophat': return P('M34,24 L36,2 H64 L66,24 Z', '#1d1c24') + R(36, 15, 28, 5, 0, '#FF8A1F', O1) + P('M24,24 H76 Q79,28 75,29 H25 Q21,28 24,24 Z', '#1d1c24');
      case 'headband': return P('M24.5,30.5 C32,25.5 68,25.5 75.5,30.5 L75.3,35.5 C68,30.5 32,30.5 24.7,35.5 Z', '#ffffff') + L('M25,33 C33,28.5 67,28.5 75,33', p.uni, 1.6);
      case 'crown': return P('M30,22 L28,3 L39,12 L50,0 L61,12 L72,3 L70,22 Z', GOLD) + P('M30,22 H70 V27 H30 Z', GOLD_D, O1) +
        C(50, 9, 2.6, '#e8364f', O1) + C(39.5, 16, 2, '#3aa0ff', O1) + C(60.5, 16, 2, '#3aa0ff', O1) + L('M33,19 L33.6,8', GOLD_L, 1.6);
      case 'horn': return P('M28,26 C35,20 65,20 72,26 L71,30 C64,25 36,25 29,30 Z', '#ff86c8') +
        P('M43,22 L50,-2 L57,22 Z', '#fff4c8') + L('M45.5,15 L54.5,12.5 M46.8,9 L53.3,7 M48,3.5 L51.8,2.5', '#f2b13c', 1.6) + C(36, 25, 2, '#7cd6ff', O1) + C(64, 25, 2, '#b88bff', O1);
    }
    return '';
  }

  // ---------- Предметы в руке (центр ~ правая кисть 73,85) ----------
  function prop(name, p) {
    var acc = p.acc, s = '';
    switch (name) {
      case 'cup': return P('M68,73 H80 L78.5,91 H69.5 Z', '#ffffff') + R(67, 71, 14, 3.5, 1.5, shade(p.uni, 0.1)) + P('M68.7,79 H79.3 L78.8,85 H69.2 Z', p.uni, O1) + L('M73,66 Q71,63 73.5,60 M77,66 Q75,63 77.5,60', '#ffffff', 1.4);
      case 'goldcup': return P('M66,72 H82 C82,80 78.5,84 74,84 C69.5,84 66,80 66,72 Z', GOLD) + L('M82,74 C87,74 87,80 81.5,80', INK, 3.6) + L('M82,74 C87,74 87,80 81.5,80', GOLD, 1.8) +
        R(72.5, 84, 3, 4, 0, GOLD_D) + R(68.5, 88, 11, 3.5, 1.5, GOLD) + L('M69,74.5 V79', GOLD_L, 1.6);
      case 'cezve': return P('M66,79 H76 L77.5,90 C77.5,92 64.5,92 64.5,90 Z', '#d97a3a') + L('M76,81 L88,72', INK, 4.6) + L('M76,81 L88,72', '#4a2e20', 2.4) + L('M67,82 V88', '#ffb47a', 1.4);
      case 'beans': return P('M64,92 C62,82 64,74 67,72 L80,72 C83,74 85,82 83,92 Z', '#c9a77a') + L('M66.5,74 Q73.5,77 80.5,74', '#8a6a44', 1.4) + E(71, 84, 2.4, 3.2, '#5a3218', O1) + E(77, 82, 2.4, 3.2, '#5a3218', O1);
      case 'pitcher': return P('M67,74 H79 L80.5,90 H65.5 Z', '#c8d0db') + P('M79,74 L84,71 L80,77 Z', '#c8d0db', O1) + L('M65.5,78 C60,78 61,86 66,86', INK, 3.4) + L('M65.5,78 C60,78 61,86 66,86', '#c8d0db', 1.6) + L('M68.5,77 V87', '#ffffff', 1.6);
      case 'clipboard': return R(64, 70, 17, 22, 2, '#a5774a') + R(66.5, 73.5, 12, 16, 1, '#ffffff', O1) + R(69, 68.5, 7, 3.5, 1, '#9aa3b2', O1) + L('M68.5,78 H76.5 M68.5,82 H76.5 M68.5,86 H73', '#9aa3b2', 1.4) + L('M68.2,77.6 l1.2,1.2 l2,-2.2', '#1fb38f', 1.4);
      case 'keys': return R(66, 70, 13, 19, 5, '#1d1c24') + C(72.5, 75, 2, '#e8364f', O1) + R(69.5, 79, 6, 2.4, 1, '#9aa3b2', '') + R(69.5, 82.5, 6, 2.4, 1, '#9aa3b2', '') +
        P('M78,74 L88,64 L90.5,66.5 L88.5,68.5 L90,70 L88,72 L86.5,70.5 L80.5,76.5 Z', '#c8d0db', O1);
      case 'phone': return R(68.5, 70, 11, 19, 2.2, '#1d1c24') + R(70, 72.5, 8, 13, 1, '#5fd0ff', '') + L('M71.5,76 H76.5 M71.5,79 H75', '#ffffff', 1.1);
      case 'book': return P('M64,74 L74,72 L84,74 V90 L74,88 L64,90 Z', p.uni) + L('M74,72 V88', INK, 1.4) + L('M66.5,78 L71.5,77 M66.5,82 L71.5,81', '#ffffff', 1.2);
      case 'laptop': return P('M35,72 H65 L66.5,88 H33.5 Z', '#a9b4c6') + P('M37,74 H63 L64,86 H36 Z', '#2f3a55', O1) + C(50, 80, 2.6, acc, '') + R(30, 87.5, 40, 4.5, 2, '#d5dce8');
      case 'mug': return R(66, 74, 12, 14, 2.5, '#ffffff') + L('M78,77 C83,77 83,84 78,84', INK, 3.4) + L('M78,77 C83,77 83,84 78,84', '#ffffff', 1.6) + R(68.5, 78, 7, 3.5, 1, acc, '') + L('M70,70 Q68.5,67 70.5,64', '#ffffff', 1.3);
      case 'tablet': return R(63.5, 69, 18, 24, 3, '#2a2838') + R(65.5, 71.5, 14, 18, 1.4, '#6fd3ff', '') + R(67.5, 74, 10, 3, 1, '#ffffff', '') + R(67.5, 79, 6, 6, 1, acc, '') + R(74.5, 79, 3, 6, 1, '#ffffff', '');
      case 'chart': return R(63.5, 69, 18, 24, 3, '#2a2838') + R(65.5, 71.5, 14, 18, 1.4, '#ffffff', '') + L('M67,86 L71,81 L74,83 L78.5,75', '#1fb38f', 2) + P('M76,74.5 L79.5,74 L79,77.5 Z', '#1fb38f', '');
      case 'gear': s = 'M75.5,70 L78,70 L78.6,73 L81,74 L83.5,72.2 L85.3,74 L83.5,76.5 L84.5,79 L87.5,79.6 L87.5,82 L84.5,82.6 L83.5,85 L85.3,87.5 L83.5,89.3 L81,87.5 L78.6,88.5 L78,91.5 L75.5,91.5 L74.9,88.5 L72.5,87.5 L70,89.3 L68.2,87.5 L70,85 L69,82.6 L66,82 L66,79.6 L69,79 L70,76.5 L68.2,74 L70,72.2 L72.5,74 L74.9,73 Z';
        return P(s, '#9aa3b2') + C(76.75, 80.8, 3.6, '#2a2838', O1);
      case 'bag': return P('M65,77 C63,84 64,92 75,92 C86,92 87,84 85,77 C83,73 67,73 65,77 Z', '#5fb520') + P('M69,73 L72,68 H78 L81,73 Z', '#4a9418', O1) + '<text x="75" y="88" font-family="Arial" font-weight="900" font-size="11" text-anchor="middle" fill="#fff4b0">₽</text>';
      case 'broom': return L('M86,58 L72,92', INK, 4) + L('M86,58 L72,92', '#b07a46', 2) + P('M66,88 L76,92 L72,102 L60,97 Z', '#f1c75b') + L('M64,96 L70,90 M67,98 L72,93', '#c69a2c', 1.2);
      case 'scissors': return C(70, 89, 3.2, 'none', ' stroke="' + INK + '" stroke-width="4"') + C(70, 89, 3.2, 'none', ' stroke="' + acc + '" stroke-width="2"') + C(78, 89, 3.2, 'none', ' stroke="' + INK + '" stroke-width="4"') + C(78, 89, 3.2, 'none', ' stroke="' + acc + '" stroke-width="2"') +
        P('M71.5,86 L82,68 L77.5,85.5 Z', '#dfe5ee', O1) + P('M76.5,86 L66,68 L70.5,85.5 Z', '#c8d0db', O1);
      case 'goldscissors': return C(70, 89, 3.2, 'none', ' stroke="' + INK + '" stroke-width="4"') + C(70, 89, 3.2, 'none', ' stroke="' + GOLD + '" stroke-width="2"') + C(78, 89, 3.2, 'none', ' stroke="' + INK + '" stroke-width="4"') + C(78, 89, 3.2, 'none', ' stroke="' + GOLD + '" stroke-width="2"') +
        P('M71.5,86 L82,68 L77.5,85.5 Z', GOLD_L, O1) + P('M76.5,86 L66,68 L70.5,85.5 Z', GOLD, O1);
      case 'comb': return R(64, 72, 22, 6, 1.5, '#1d1c24') + L('M66,78 V84 M69,78 V84 M72,78 V84 M75,78 V84 M78,78 V84 M81,78 V84 M84,78 V84', INK, 1.6);
      case 'clipper': return R(68, 70, 11, 21, 4, '#2d2b36') + R(67, 68, 13, 4, 1, '#c8d0db', O1) + R(71, 77, 5, 7, 2, acc, '');
      case 'brush': return L('M84,64 L72,86', INK, 4.4) + L('M84,64 L72,86', '#f1c75b', 2.4) + P('M84,64 C86,58 90,57 90,57 C90,60 89,64 86,66 Z', '#ff5fa8') + C(66, 92, 3, '#4fb6ff', O1) + C(72, 95, 2.4, '#ffd23d', O1);
      case 'lettuce': return P('M64,84 C60,76 66,70 72,73 C74,66 84,68 83,75 C89,78 87,88 80,88 C76,92 67,91 64,84 Z', '#7dd34a') + L('M67,84 C71,80 76,79 82,80 M72,74 C73,79 74,83 74,87', '#4e9a22', 1.4);
      case 'spatula': return L('M73,92 L80,72', INK, 4.4) + L('M73,92 L80,72', '#3a3340', 2.4) + P('M76,72 L80,58 L90,61 L85,75 Z', '#c8d0db') + L('M80,64 L86,66 M79,68 L85,70', '#8d96a5', 1.2);
      case 'tongs': return L('M70,92 L84,62 M76,92 L86,64', INK, 3.8) + L('M70,92 L84,62 M76,92 L86,64', '#c8d0db', 1.8) + E(86, 61, 5, 3, '#8a3d22', O1);
      case 'knife': return R(70, 82, 5, 11, 1.5, '#3a3340') + P('M70,82 L70.5,62 C76,63 79,70 75,82 Z', '#e3e8f0') + L('M72,66 L72,80', '#ffffff', 1.2);
      case 'burger': return P('M63,80 C63,70 87,70 87,80 Z', '#e8a24a') + P('M62,80 H88 L86.5,83 H63.5 Z', '#7dd34a', O1) + R(62.5, 82.5, 25, 4, 2, '#7a3d22', O1) + P('M63,86.5 H87 C87,91 63,91 63,86.5 Z', '#e8a24a', O1) +
        C(70, 74.5, 0.8, '#fff4d0', '') + C(76, 73, 0.8, '#fff4d0', '') + C(81, 75, 0.8, '#fff4d0', '');
      case 'goldburger': return P('M63,80 C63,70 87,70 87,80 Z', GOLD) + R(62.5, 80, 25, 5, 2, GOLD_D, O1) + P('M63,85 H87 C87,90 63,90 63,85 Z', GOLD, O1) + L('M67,75 Q70,72 74,72', GOLD_L, 1.6);
      case 'briefcase': return R(62, 78, 24, 16, 3, '#6b4126') + P('M70,78 V74.5 H78 V78', 'none', O1) + R(72, 83, 4, 4, 1, GOLD, O1) + L('M62,85 H86', INK, 1.4);
      case 'sponge': return R(65, 76, 16, 11, 3.5, '#ffd23d') + C(69, 80, 1, '#d8a800', '') + C(75, 82, 1.2, '#d8a800', '') + C(78, 79, 0.9, '#d8a800', '') + C(84, 72, 2.4, '#e9f6ff', O1) + C(87, 77, 1.6, '#e9f6ff', O1);
      case 'wrench': return P('M71,94 L80,73 C76,70 76,64 80,61.5 L81.5,66.5 L85.5,67.5 L87.5,63.5 C90.5,66.5 89.5,72 84.5,74.5 L75.5,95.5 C74.5,97.5 70,96.5 71,94 Z', '#b9c2cf');
      case 'goldwrench': return P('M71,94 L80,73 C76,70 76,64 80,61.5 L81.5,66.5 L85.5,67.5 L87.5,63.5 C90.5,66.5 89.5,72 84.5,74.5 L75.5,95.5 C74.5,97.5 70,96.5 71,94 Z', GOLD) + L('M79,75 L73.5,88', GOLD_L, 1.4);
      case 'mop': return L('M86,58 L72,94', INK, 4) + L('M86,58 L72,94', '#4fb6ff', 2) + P('M62,92 C64,88 78,90 80,95 L80,100 H60 Z', '#e9eef6') + L('M64,94 V100 M68,94 V100 M72,95 V100 M76,95 V100', '#b9c2cf', 1.2);
      case 'bottle': return R(68, 72, 10, 19, 3.5, '#4fb6ff') + R(69.5, 68, 7, 5, 1.5, '#ffffff', O1) + R(68.5, 78, 9, 5, 0, '#ffffff', ' opacity=".6"');
      case 'dumbbell': return R(62, 82.5, 26, 4, 1.5, '#9aa3b2') + R(60, 76, 6, 17, 2, '#2d2b36') + R(84, 76, 6, 17, 2, '#2d2b36');
      case 'golddumbbell': return R(62, 82.5, 26, 4, 1.5, GOLD_D) + R(60, 76, 6, 17, 2, GOLD) + R(84, 76, 6, 17, 2, GOLD) + L('M61.5,79 V89 M85.5,79 V89', GOLD_L, 1.2);
      case 'mat': return R(70, 64, 10, 30, 5, '#7ee0c8') + E(75, 64.5, 5, 2.4, '#5bc4ab', O1) + L('M70.5,72 H79.5 M70.5,86 H79.5', '#ffffff', 1.4);
      case 'apple': return C(75, 82, 7.5, '#e8364f') + P('M75,74 Q77,70 80,70', 'none', O1) + P('M76,73 C78,69 83,69 84,71 C81,73 79,74 76,73 Z', '#5fb520', O1) + C(72, 79, 1.6, '#ffffff', ' opacity=".7"');
      case 'trophy': return P('M66,70 H84 C84,79 80,83 75,83 C70,83 66,79 66,70 Z', GOLD) + L('M66,72 C61,72 61,78 67,79 M84,72 C89,72 89,78 83,79', INK, 3) + L('M66,72 C61,72 61,78 67,79 M84,72 C89,72 89,78 83,79', GOLD, 1.4) +
        R(73, 83, 4, 4, 0, GOLD_D) + R(68, 87, 14, 5, 1.5, '#6b4126') + C(75, 75, 2.4, GOLD_L, '');
      case 'gamepad': return P('M62,80 C62,74 68,73 75,73 C82,73 88,74 88,80 C88,87 85,91 81,88 L78,85.5 H72 L69,88 C65,91 62,87 62,80 Z', '#3a3f55') +
        L('M66.5,79 H71.5 M69,76.5 V81.5', '#ffffff', 1.6) + C(80, 77.5, 1.5, '#ff5f6d', '') + C(83.5, 80.5, 1.5, '#ffd23d', '');
      case 'goldpad': return P('M62,80 C62,74 68,73 75,73 C82,73 88,74 88,80 C88,87 85,91 81,88 L78,85.5 H72 L69,88 C65,91 62,87 62,80 Z', GOLD) +
        L('M66.5,79 H71.5 M69,76.5 V81.5', GOLD_D, 1.8) + C(80, 77.5, 1.5, '#e8364f', '') + C(83.5, 80.5, 1.5, '#3aa0ff', '');
      case 'pen': return R(64, 72, 22, 16, 2.5, '#2a2838') + R(66, 74, 18, 12, 1, '#fff6e8', '') + L('M68,83 Q72,76 76,81 T82,78', acc, 1.8) + L('M86,62 L77,80', INK, 3.6) + L('M86,62 L77,80', '#ffffff', 1.8);
      case 'dice': return R(64, 74, 13, 13, 2.5, '#ffffff') + C(67.5, 77.5, 1.1, INK, '') + C(73.5, 83.5, 1.1, INK, '') + C(70.5, 80.5, 1.1, INK, '') +
        R(75, 70, 11, 11, 2.5, '#e8364f') + C(78, 73, 1, '#fff', '') + C(83, 78, 1, '#fff', '');
      case 'note': return L('M73,90 V68 L84,65 V86', INK, 3.6) + L('M73,90 V68 L84,65 V86', '#2a2838', 1.6) + E(70, 90, 4, 3, '#2a2838') + E(81, 86, 4, 3, '#2a2838') + P('M73,68 L84,65 V70 L73,73 Z', '#2a2838', O1);
      case 'clapper': return R(63, 76, 22, 15, 1.5, '#1d1c24') + P('M63,70 L84,66 L85,71.5 L64,75.5 Z', '#ffffff') + L('M67,69.3 L69,74.5 M72,68.4 L74,73.5 M77,67.4 L79,72.6', INK, 2) + L('M66,82 H79 M66,86 H75', '#ffffff', 1.2);
      case 'joystick': return R(64, 84, 22, 8, 2.5, '#2a2838') + L('M75,84 L77,71', INK, 3.6) + L('M75,84 L77,71', '#9aa3b2', 1.6) + C(77.5, 69.5, 4.5, '#e8364f') + C(82, 88, 1.5, acc, '');
      case 'box': return P('M62,76 L75,72 L88,76 V92 L75,96 L62,92 Z', '#c9a77a') + P('M62,76 L75,80 L88,76', 'none', O1) + L('M75,80 V96', INK, 1.4) + P('M66,74.8 L79,79 L79,83 L66,78.8 Z', '#e8d3a8', '');
      case 'goldbox': return P('M62,76 L75,72 L88,76 V92 L75,96 L62,92 Z', GOLD) + P('M62,76 L75,80 L88,76', 'none', O1) + L('M75,80 V96', INK, 1.4) + L('M68,74.2 L81,78.2 V94', '#e8364f', 2.4);
      case 'pizza': return P('M62,74 L88,70 L78,92 Z', '#f2c26a') + P('M62,74 L88,70 L87,73.5 L64,77 Z', '#c27a3a', O1) + C(73, 77, 2, '#d8314a', '') + C(80, 76, 1.8, '#d8314a', '') + C(77, 84, 1.8, '#d8314a', '');
      case 'map': return P('M62,74 L69,71 L76,74 L84,71 V91 L76,94 L69,91 L62,94 Z', '#eef6e0') + L('M69,71 V91 M76,74 V94', '#b8c7a3', 1.2) + L('M64,88 Q70,78 74,84 T82,76', '#e8364f', 1.6) + C(82, 76, 2, '#e8364f', '');
    }
    return '';
  }
  // Что держат двумя руками (рисуем перед телом)
  var TWO_HANDS = { laptop: 1 };

  function body(biz, lvl, r, lk) {
    var p = PAL[biz], s = '';
    var bare = r.o === 'tank';
    var sleeve = r.o === 'gold' ? '#2a1d4f' : r.o === 'jacket' ? r.c : r.o === 'vest' ? (r.c || '#ffffff') : r.o === 'hiviz' ? '#ffffff' : (r.c || p.uni);
    // тень, ноги, обувь
    s += E(50, 104.5, 22, 4, '#000', ' opacity=".22"');
    var shoe = lvl >= 6 ? '#1d1c24' : lvl >= 3 ? shade(p.acc === '#2b2b33' ? '#ff8a1f' : p.acc, -0.35) : '#f1f3f7';
    var pants = r.o === 'gold' ? '#1d1830' : r.o === 'overall' ? p.uni : p.pants;
    s += R(37.5, 88, 11, 14, 4, pants) + R(51.5, 88, 11, 14, 4, pants);
    s += P('M35,102.5 C35,98.5 38,97.5 42.5,97.5 C47.5,97.5 49.5,99 49.5,102.5 Z', shoe) + P('M50.5,102.5 C50.5,99 52.5,97.5 57.5,97.5 C62,97.5 65,98.5 65,102.5 Z', shoe);
    // рюкзак/термокороб — за спиной
    if (r.x.indexOf('thermo') >= 0) s += R(24, 60, 52, 30, 5, r.o === 'courier' && r.c === '#2d2b36' ? '#f2c40c' : '#2d2b36') + R(28, 64, 44, 4, 1.5, '#ffffff', ' opacity=".25"');
    if (r.x.indexOf('backpack') >= 0) s += R(27, 64, 46, 28, 6, p.uni);
    return { pre: s, sleeve: sleeve, bare: bare, p: p };
  }

  function draw(biz, lvl, rar) {
    var roles = ROLES[biz] || ROLES.it, r = roles[Math.max(0, Math.min(7, lvl - 1))];
    var lk = look(biz, lvl, r), b = body(biz, lvl, r, lk), p = b.p, s = '';
    var two = TWO_HANDS[r.prop];
    // аура редкости — мягкое пятно под ногами
    var RC = ['', '#4FC3FF', '#B57BFF', '#FFC83D'];
    if (rar) s += '<ellipse cx="50" cy="103" rx="30" ry="7" fill="' + RC[rar] + '" opacity=".55"/>';
    s += b.pre;
    s += hairBack(lk.hs, lk.hc);
    s += '<clipPath id="tc"><path d="' + TORSO + '"/></clipPath>';
    s += outfit(r, p, lk);
    if (r.x.indexOf('chain') >= 0) s += L('M42.5,64 Q50,80 57.5,64', GOLD_D, 2.6) + L('M42.5,64 Q50,80 57.5,64', GOLD, 1.3) + C(50, 74.5, 3.4, GOLD, O1) + '<text x="50" y="76.4" font-family="Arial" font-weight="900" font-size="5" text-anchor="middle" fill="' + GOLD_D + '">₽</text>';
    if (r.x.indexOf('whistle') >= 0) s += L('M43,64 Q50,77 57,64', '#e8364f', 1.4) + R(47.5, 73, 6, 4, 1.5, '#c8d0db', O1);
    if (r.x.indexOf('backpack') >= 0) s += L('M38,64 L37,84 M62,64 L63,84', shade(p.uni, -0.35), 3);
    // руки: левая опущена; правая держит предмет (или обе — ноутбук)
    if (two) {
      s += arm('M35.5,68 C32,74 33,80 38,82.5', b.sleeve, lk.skin, b.bare) + arm('M64.5,68 C68,74 67,80 62,82.5', b.sleeve, lk.skin, b.bare);
      s += prop(r.prop, p) + hand(37.5, 85, lk.skin) + hand(62.5, 85, lk.skin);
    } else {
      s += arm('M35,68 C30.5,73 28,80 27.5,87', b.sleeve, lk.skin, b.bare) + hand(27.5, 88.5, lk.skin);
      s += arm('M65,68 C70,72 72.5,78 72.5,84', b.sleeve, lk.skin, b.bare);
      s += prop(r.prop, p) + hand(72.5, 85.5, lk.skin);
    }
    // голова
    s += face(lk, r, lvl);
    s += hairFront(r.hat === 'moto' ? 'buzz' : lk.hs, lk.hc);
    s += headwear(r.hat, p, lk.hc);
    if (rar === 3) s += '<g fill="#FFE27A" stroke="#fff" stroke-width=".6"><path d="M12,30 l1.6,4 4,1.6 -4,1.6 -1.6,4 -1.6,-4 -4,-1.6 4,-1.6z"/><path d="M88,56 l1.2,3 3,1.2 -3,1.2 -1.2,3 -1.2,-3 -3,-1.2 3,-1.2z"/></g>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="6 -3 88 110">' + s + '</svg>';
  }

  // ---------- API ----------
  var cache = {};
  function svgUri(biz, lvl, rar) {
    var k = biz + lvl + ':' + (rar || 0);
    if (!cache[k]) cache[k] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(draw(biz, lvl, rar || 0));
    return cache[k];
  }
  var KITS = { main: 1, neon: 1, collection: 1 };
  function kitNow(kit) {
    if (KITS[kit]) return kit;
    var T = window.GameTheme, t = T && T.get ? T.get() : 'main';
    return KITS[t] ? t : 'main';
  }
  function hasImg(kit, biz, lvl) {
    var all = window.CONTENT && window.CONTENT.STAFF_IMG, list = all && all[kit];
    return !!(Array.isArray(list) && list.indexOf(biz + '-' + lvl) >= 0);
  }
  // ВРЕМЕННО, только для просмотра стилей: ?preview_staff=1 — в основном комплекте (и в «Коллекции») вместо SVG персонажи с пробного листа
  // (docs/staff-concepts/2-multyashnyj-OSNOVNOJ.jpg, нарезка — tools/staff-preview.py → img/staff-preview/1..12.webp).
  // Уровни 1–6 — персонажи своего бизнеса, 7 — бизнесмен, 8 — босс в короне.
  var PREVIEW = false;
  try { PREVIEW = new URLSearchParams(location.search).get('preview_staff') === '1'; } catch (e) {}
  var PV = { coffee: [1, 2], it: [3, 4], barber: [5], burger: [6], auto: [7], fitness: [8], gamedev: [9], delivery: [10] };
  // для «Коллекции» — 3D-фигурки с листа docs/staff-concepts/1-figurki-3d.jpg (tools/staff-preview-3d.py → img/staff-preview-3d/)
  function previewSrc(biz, lvl, kit) {
    var n = lvl >= 8 ? 12 : lvl === 7 ? 11 : (PV[biz] || [1])[(lvl - 1) % (PV[biz] || [1]).length];
    return (kit === 'collection' ? 'img/staff-preview-3d/' : 'img/staff-preview/') + n + '.webp';
  }
  // Главная функция: картинка сотрудника комплекта (img/staff/<kit>/*.webp, если есть, иначе SVG)
  function avatar(biz, lvl, rar, cls, kit) {
    lvl = Math.max(1, Math.min(8, lvl | 0)); kit = kitNow(kit);
    var src = PREVIEW && (kit === 'main' || kit === 'collection') ? previewSrc(biz, lvl, kit) : hasImg(kit, biz, lvl) ? 'img/staff/' + kit + '/' + biz + '-' + lvl + '.webp' : svgUri(biz, lvl, rar);
    return '<img class="av' + (cls ? ' ' + cls : '') + '" src="' + src + '" alt="" draggable="false" decoding="async">';
  }
  function mode() { try { return localStorage.getItem(KEY) === 'emoji' ? 'emoji' : 'art'; } catch (e) { return 'art'; } }
  function setMode(m) { try { if (m === 'emoji') localStorage.setItem(KEY, 'emoji'); else localStorage.removeItem(KEY); } catch (e) {} }

  window.GameAvatars = { avatar: avatar, svg: draw, uri: svgUri, mode: mode, setMode: setMode, roles: ROLES };
  window.avatar = avatar;
})();
