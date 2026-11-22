/* «Стартап с нуля» — связь с сервером (друзья, приглашения, награды, рейтинг). window.GameNet.
   Сервер: репозиторий alex-bots, public/game-api.php (по умолчанию https://tw.nightflo.ru/bots/game-api.php; свой адрес — window.GAME_API).
   Вход — по подписи Telegram: в заголовке X-Tg-Init-Data уходит Telegram.WebApp.initData. Нет Telegram или сервера — ready() = false,
   все методы отвечают пустыми данными и не падают. Подключать до game.js. */
(function (root) {
  'use strict';

  var DEFAULT_API = 'https://tw.nightflo.ru/bots/game-api.php';
  var BOT = 'startup_zero_bot';
  var REF_BONUS = 500;             // как Game::REF_BONUS на сервере
  var TIMEOUT_MS = 8000;
  var SYNC_EVERY_MS = 20000;       // сервер принимает не чаще раза в 15 с
  var STEPS = [
    { need: 1, title: '💰 Деньги на развитие' },
    { need: 3, title: '🔷 Редкий сотрудник' },
    { need: 5, title: '📄 Пачка резюме' },
    { need: 10, title: '💜 Эпический сотрудник' },
    { need: 25, title: '👑 Легендарный сотрудник' }
  ];

  var tg = root.Telegram && root.Telegram.WebApp;
  var initData = (tg && tg.initData) || '';
  var me = null;
  var ok = false;
  var refSent = false;
  var bonus = null;              // {cash} — пришёл по приглашению, первый вход
  var bonusCbs = [];
  var bonusFired = false;
  var readyCbs = [];
  var starting = null;

  function api() { return root.GAME_API || DEFAULT_API; }

  /* start-параметр приглашения: из Telegram (прямая ссылка ?startapp=ref_<id>) или из адреса (?ref=ref_<id> — кнопка бота) */
  function startParam() {
    var p = '';
    try { p = (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || ''; } catch (e) {}
    if (!p) {
      try {
        var q = new URLSearchParams(root.location.search);
        p = q.get('ref') || q.get('tgWebAppStartParam') || '';
      } catch (e) {}
    }
    return /^ref_\d{1,19}$/.test(p) ? p : '';
  }

  /* Запрос к серверу → Promise(данные) | reject. Таймаут, без падений. */
  function call(action, body) {
    if (!initData || typeof fetch !== 'function') return Promise.reject(new Error('offline'));
    body = body || {};
    if (!refSent) { var r = startParam(); if (r) body.ref = r; }
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = null;
    var req = fetch(api() + (api().indexOf('?') < 0 ? '?' : '&') + 'a=' + encodeURIComponent(action), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tg-Init-Data': initData },
      body: JSON.stringify(body),
      mode: 'cors',
      credentials: 'omit',
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) { var e = new Error((data && data.error) || ('http ' + res.status)); e.status = res.status; throw e; }
        refSent = true;
        return data;
      });
    });
    var timeout = new Promise(function (_, reject) {
      timer = setTimeout(function () { if (ctrl) { try { ctrl.abort(); } catch (e) {} } reject(new Error('timeout')); }, TIMEOUT_MS);
    });
    return Promise.race([req, timeout]).then(function (d) { clearTimeout(timer); return d; }, function (e) { clearTimeout(timer); throw e; });
  }

  function fireBonus() {
    if (!bonus || bonusFired || !bonusCbs.length) return;
    bonusFired = true;
    var b = { cash: bonus.cash };
    bonusCbs.forEach(function (cb) { try { cb(b); } catch (e) {} });
  }

  /* Первый запрос: кто я (+ приглашение и бонус). Повторяется, если сервер был недоступен. */
  function start() {
    if (ok) return Promise.resolve(true);
    if (starting) return starting;
    starting = call('me').then(function (d) {
      if (!d || !d.ok || !d.user) return false;
      me = { id: d.user.id, name: d.user.name };
      ok = true;
      if (d.bonus && d.bonus.cash > 0) bonus = { cash: d.bonus.cash };
      fireBonus();
      readyCbs.splice(0).forEach(function (cb) { try { cb(me); } catch (e) {} });
      try { root.dispatchEvent(new CustomEvent('gamenet:ready', { detail: me })); } catch (e) {}
      return true;
    }).catch(function () { return false; }).then(function (r) { starting = null; return r; });
    return starting;
  }

  function withServer(fn, fallback) {
    return start().then(function (good) { return good ? fn() : fallback(); }).catch(function () { return fallback(); });
  }

  function emptyFriends() {
    return { invited: 0, counted: 0, list: [], offline: true,
      rewards: STEPS.map(function (s) { return { need: s.need, title: s.title, claimed: false, ready: false }; }) };
  }

  // ---------- sync: не чаще раза в 20 с, последнее состояние всегда доходит ----------
  var lastSync = 0, pending = null, syncTimer = null;
  function sendSync() {
    syncTimer = null;
    if (!pending) return Promise.resolve();
    var s = pending; pending = null; lastSync = Date.now();
    return call('sync', { state: s }).then(function () {}, function () {});
  }

  var GameNet = {
    ready: function () { return ok; },
    user: function () { return me ? { id: me.id, name: me.name } : null; },

    /* Ссылка-приглашение. id — с сервера, а пока его нет — из Telegram (initDataUnsafe), так ссылка рабочая и без сервера */
    link: function () {
      var id = me ? me.id : 0;
      if (!id) { try { id = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id) || 0; } catch (e) {} }
      return 'https://t.me/' + BOT + (/^\d{1,19}$/.test(String(id)) && id ? '?startapp=ref_' + id : '');
    },

    /* Поделиться: окно «Переслать» Telegram (вне Telegram — новая вкладка). text — свой текст (для «Похвастаться») */
    share: function (text) {
      var url = 'https://t.me/share/url?url=' + encodeURIComponent(GameNet.link()) + '&text=' + encodeURIComponent(text);
      if (tg && tg.initData && tg.openTelegramLink) { try { tg.openTelegramLink(url); return; } catch (e) {} }
      try { root.open(url, '_blank', 'noopener'); } catch (e) {}
    },

    invite: function () {
      GameNet.share('Строю стартап с нуля 🚀 Заходи по моей ссылке — получишь +' + REF_BONUS + ' ₽ на старт, а я награду. Обгони меня!');
    },

    friends: function () {
      return withServer(function () {
        return call('friends').then(function (d) {
          if (!d || !d.ok) return emptyFriends();
          return { invited: d.invited || 0, counted: d.counted || 0, need: d.need, list: d.list || [], rewards: d.rewards || emptyFriends().rewards };
        });
      }, emptyFriends).catch(emptyFriends);
    },

    claimFriendReward: function (need) {
      var no = function () { return { ok: false, error: 'offline' }; };
      return withServer(function () {
        return call('claim', { need: need }).then(function (d) {
          return d && d.ok ? { ok: true, reward: d.reward } : { ok: false, error: (d && d.error) || 'error' };
        });
      }, no).catch(no);
    },

    leaderboard: function (scope) {
      scope = scope === 'friends' || scope === 'week' ? scope : 'all';
      var none = function () { return []; };
      return withServer(function () {
        return call('top', { scope: scope }).then(function (d) { return (d && d.list) || []; });
      }, none).catch(none);
    },

    sync: function (state) {
      if (!state) return Promise.resolve();
      pending = {
        valuation: +state.valuation || 0,
        business: String(state.business || ''),
        maxLevel: +state.maxLevel || 0,
        incomePerSec: +state.incomePerSec || 0,
        earned: +state.earned || 0
      };
      if (!initData) return Promise.resolve();
      var wait = SYNC_EVERY_MS - (Date.now() - lastSync);
      if (wait <= 0 && ok) { if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; } return sendSync(); }
      if (!syncTimer) syncTimer = setTimeout(function () { start().then(function (good) { if (good) sendSync(); else syncTimer = null; }); }, Math.max(wait, 1000));
      return Promise.resolve();
    },

    onReferralBonus: function (cb) {
      if (typeof cb !== 'function') return;
      bonusCbs.push(cb);
      fireBonus();
    },

    /* необязательно: cb(user), когда сервер ответил (или сразу, если уже) */
    onReady: function (cb) {
      if (typeof cb !== 'function') return;
      if (ok) { try { cb(me); } catch (e) {} } else readyCbs.push(cb);
    }
  };

  root.GameNet = GameNet;
  if (initData) start();
})(window);
