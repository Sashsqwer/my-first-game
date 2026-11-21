# Сервер игры (друзья, приглашения, награды, рейтинг)

Сервер живёт в репозитории **alex-bots** (`public/game-api.php`, подробно — `docs/game-server.md` там). Здесь — только клиент `app/net.js` (`window.GameNet`), подключается до `game.js`.

- Адрес API: `https://tw.nightflo.ru/bots/game-api.php` (свой — `window.GAME_API` до подключения net.js).
- Вход по подписи Telegram (`Telegram.WebApp.initData` в заголовке `X-Tg-Init-Data`). Вне Telegram или без сервера `GameNet.ready()` = false, методы отдают пустые данные и не падают.
- `ready()`, `user()`, `invite()`, `friends()`, `claimFriendReward(need)`, `leaderboard('friends'|'week'|'all')`, `sync({valuation, business, maxLevel, incomePerSec})` (сам не чаще раза в 20 с), `onReferralBonus(cb)` → `cb({cash})` один раз новичку по приглашению; доп. `onReady(cb)` и событие `gamenet:ready`.
- Награда `claimFriendReward` → `{ok, reward: {type: 'cash', cash} | {type: 'rare', rarity: 'rare'|'epic'|'legendary'} | {type: 'pack'}}`.
- Друг засчитывается, когда его оценка ≥ 5 000 ₽ и с первого входа прошло ≥ 10 минут.
- Приглашение: `t.me/startup_zero_bot?startapp=ref_<id>`; из кнопки бота — `?ref=ref_<id>` в адресе игры (net.js читает оба).
