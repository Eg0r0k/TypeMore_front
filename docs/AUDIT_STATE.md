# AUDIT_STATE — инвентаризация фич (read-only аудит)

Дата: 2026-07-29. Режим: только чтение, ничего не чинилось, ничего не коммитилось,
тесты не запускались (мандат). Все вердикты — по исходникам, а не по наблюдённому
зелёному прогону.

Репозитории: `TypeMore_front` (Vue 3 + TS, FSD), `TypeMore_back` (Go).
Отчёт одинаков в обоих репо; пути с префиксом `back:` относятся к TypeMore_back,
остальные — к TypeMore_front.

Правила доказательства: источник правды — код и тесты; документация
доказательством не считается; имя файла/функции не считается; TODO/заглушка/
закомментированное — не реализация.

---

## 1. Сводная таблица

| ID | Вердикт | Доказательство (путь:строка) | Тест (упадёт при вырезании) | Комментарий |
|---|---|---|---|---|
| A1 | DONE | `src/pages/home/ui.vue:24`, `src/features/test/race/ui.vue:1-7` (renderless), `src/entities/race/model/store.ts:86` | `src/__tests__/race/race-host.test.ts:110`; `e2e/race.spec.ts:60` | Гонка — состояние home-экрана: хост безголовый, всё видимое идёт через штатные соло-поверхности |
| A2 | PARTIAL | `src/features/test/race/ui.vue:107-125,133-152`; `src/features/replay-view/model/replay-from-api.ts:183-190,218-228,252` | `src/__tests__/race/race-host.test.ts:110` (слова + `generation.textSource`) | Режим/моды/текст/сид применяются (слова РЕГЕНЕРИРУЮТСЯ из seed+dictHash, цитата подставляется по id и сверяется по хешу). НЕТ: `language` (осознанно, `store.ts:26-30`) и `quoteGroup` (лежит в `RACE_SNAPSHOT_KEYS`, но `settingsOf()` его не пишет — quote-гонка показывает свою группу игрока) |
| A3 | PARTIAL | `src/features/test/race/ui.vue:139` (GhostDriver), `src/entities/match/model/ghost-driver.ts:55`, каретка `src/pages/home/ui.vue:192-208` | `src/__tests__/race/race-host.test.ts:110`; `src/__tests__/match/ghost-driver.test.ts:143` | Призрак через GhostDriver — да. Отдельной «компактной строки оппонента» у соло-гонки НЕТ: личность оппонента — это лейбл pace-чипа `ghost · <nick>` (`src/features/test/pace/ui.vue:116-131`) и строка поражения на результатах. `race-rail.vue` — рейка МУЛЬТИПЛЕЕРА |
| A4 | MISSING | `src/features/test/race/ui.vue:2-5` («the race has NO chrome of its own»); выход — `src/features/test/pace/ui.vue:147,160` | нет | Баннера «racing <n>» у соло-гонки нет и не предусмотрено. `room.match.waiting.racing` (`src/features/room/match/ui.vue:24,47`) — это баннер ожидания в МАТЧЕ, другая фича |
| A5 | DONE | `src/entities/race/model/store.ts:98-104,123-138,159-174` | `src/__tests__/race/race-store.test.ts:26,58,72`; `src/__tests__/race/race-host.test.ts:178`; `e2e/race.spec.ts:120` | Round-trip + heal после перезагрузки; персистится только снапшот |
| A6 | PARTIAL | `src/entities/game/config/registry.ts:95-105,534-537`; `src/features/test/settings-bar/ui.vue:216-225` | `src/__tests__/race/race-lock.test.ts:12` | Блокировка через контексты декларативного реестра — есть и закреплена. Но «смена настройки = выход» НЕ реализована: бар просто задизейблен, единственный выход — pace-селектор |
| A7 | DONE | `src/features/test/race/ui.vue:133-152,188-193`; `src/entities/race/model/store.ts:106-108` | `src/__tests__/race/race-host.test.ts:161`; `e2e/race.spec.ts:123` | restart пере-сажает ТОТ ЖЕ призрак на тот же лог/слова |
| A8 | DONE | `src/app/router/routes/boards.ts:36-42` | `src/__tests__/race/race-redirect.test.ts:15`; `e2e/race.spec.ts:92` | `src/pages/race` отсутствует; grep остатков — см. раздел 4 |
| A9 | DONE | `src/pages/home/ui.vue:334-340` (`!race.racing` в `finishedOk`) | `e2e/race.spec.ts:60` (спай на реальный POST /runs) | Юнит-спай `src/__tests__/race/race-no-submission.test.ts:95` дублирует гейт в самом тесте и НЕ упал бы при удалении гейта из home; страхует e2e |
| A10 | DONE | `src/features/profile/pbs/ui.vue:42-45`; `src/features/profile/runs-table/ui.vue:88-91`; `src/pages/profile/ui.vue:261` | `e2e/profile.spec.ts:201` | Race-действия и на PB-карточках, и в строках таблицы ранов |
| B1 | DONE | `src/shared/core/events.ts:83-92,113-120`; `src/shared/core/validate.ts:145-162` | `src/__tests__/core/telemetry.test.ts:366` («telemetry consumes seq»), `:295-352` | Телеметрия внутри лога, под защитой contiguous `seq`; бокового канала нет |
| B2 | DONE | `src/shared/lib/log-version.ts:25-42`; back: `internal/runs/validate.go:65-78` | `src/__tests__/telemetry-capture.test.ts:115-152`; back: `internal/runs/runs_test.go:145` | v2 только если: `maxTouchPoints===0` И нет mobile-UA И есть `matchMedia` И `(pointer:fine)` И НЕ `(pointer:coarse)`; любой бросок/неизвестность ⇒ v1. v1 принимается вечно |
| B3 | DONE | `src/shared/core/game-core.ts:885-887` (возвращается ТОТ ЖЕ объект state, включая `lastSeq`); `src/entities/game/model/store.ts:394-413` | `src/__tests__/core/telemetry.test.ts:266,272,284` | down/up — no-op в любой фазе, включая `finished` |
| B4 | PARTIAL | `src/__tests__/core/telemetry.test.ts:84-133` (`typeAllTwins`), `:202-259` | `src/__tests__/core/telemetry.test.ts:210` (stripping) и `:248` (v2 ≡ v1-твин) | Свойство закреплено ТАБЛИЧНЫМ тестом на 5 сценариях, а не рандомизированным property-тестом (`fast-check` в репо отсутствует). Golden-ПАРЫ как хранимой фикстуры нет — оба твина синтезируются одним генератором в тесте, так что баг генератора сдвинет их синхронно |
| B5 | DONE | `src/features/test/input/ui.vue:145,150` (`event.code`) | `src/__tests__/telemetry-adapter.test.ts:56`; back: `internal/runs/runs_test.go:169` (отказ на `"Key F!"`) | Физический `KeyboardEvent.code`, не `key`/`keyCode` |
| B6 | DONE | `src/features/test/input/ui.vue:145,150` — `event.isComposing` первым условием на ОБОИХ обработчиках | `src/__tests__/telemetry-adapter.test.ts:98` | Подавление по-событийное (`isComposing`), не по флагу сессии; авто-повтор (`event.repeat`) и пустой `code` тоже отсекаются |
| B7 | PARTIAL | структурный слой `src/shared/core/validate.ts:145-163`; НО scored-флаг `unpaired-keyup` `src/shared/core/validate.ts:165-189` + `:76` | `src/__tests__/core/telemetry.test.ts:375` (флаг), `:395` (hold/overlap НЕ флагуются) | Эвристик hold/overlap нет — это закреплено. Но одна scored-эвристика по телеметрии всё же появилась и взвешивается серверной review-политикой (back: `internal/replay/policy_test.go:127` `FlagUnpairedKeyup`) — отклонение от решения |
| B8 | PARTIAL | `src/entities/match/model/ghost-driver.ts:159-167` → `core.dispatch` → `game-core.ts:885`; `src/shared/core/score.ts` `scoreStep` (`default: break`); фильтрует только `src/features/replay-view/model/replay-results.ts:51` | `src/__tests__/match/ghost-driver.test.ts:143-199` — но ТОЛЬКО на v1-логах | Ни GhostDriver, ни плеер реплея телеметрию не «скипают» — они её диспатчат, а no-op обеспечивает редьюсер. Тест на бит-в-бит эквивалентность есть (40 сидов × 3 сценария), но v2-лог в него никогда не подаётся |
| B9 | DONE | back: `internal/ws/room_match.go:211`, `internal/ws/session.go:272` | back: `internal/ws/relay_test.go:807` `TestTelemetryBatchRelaysAndPersistsOpaque` | Реле не парсит события; `version:2` доезжает до пира байт-в-байт |
| B10 | DONE | back: `internal/runs/validate.go:14-34` (`maxEvents=120_000`, `maxEventsV2=480_000`, `maxLogBytesV1=6.5 MiB`), `internal/runs/handler.go:17-26` (`maxBodyBytes=25 MiB`), зеркало `internal/perf/generate.go:17-40` | back: `internal/replay/dictionaries_test.go:862` `TestEveryPublishedDictionaryCanPlayAFullLengthRunUnderLogV2` | Капы пересчитаны заново под down+up (3× state-событий + Shift-пары). Худший словарь — `code_abap_1k`, 417 710 событий; кап даёт ~15 % запаса. v1-конверт сохранён отдельным `maxLogBytesV1` |
| B11 | DONE (с оговоркой) | back: `internal/replay/corejs/core.bundle.js` содержит `EVENT_LOG_VERSION_TELEMETRY` (6×), `isTelemetryEvent` (9×), `keyDownEvent` (3×), строку `unpaired-keyup`; SHA — `internal/replay/core.go:51-60`; ревалидация — `cmd/replayctl/main.go:346` | back: `internal/replay/queue_pg_test.go:454` `TestRevalidateClaimsRunsJudgedByAnotherBundle`; `internal/replay/worker_test.go:1067` `TestBundleSHAIsStableAndRecorded` | Бандл ПЕРЕ-вендорен под log v2 (текущий SHA `01eb00f3…`). Оговорка: это сборка более СТАРОГО `core/index.ts` — экспортов `src/shared/core/normalize.ts` (untracked, реэкспортируется из индекса) в бандле нет. Поведенческого дрейфа нет (ядро `normalize` нигде не импортирует), но байт-в-байт актуальным бандл не является |
| B12 | PARTIAL | back: `internal/runs/validate.go:65-78` (`KnownLogVersions{1,2}`); реплей версионно-агностичен — ветвление внутри вендоренного `validateLog` | back: `internal/runs/runs_test.go:129,145` (v1 и v2 принимаются, v3 — 422) | Старые v1-логи принимаются и реплеятся. Теста на СМЕШАННУЮ популяцию v1+v2 из БД нет; единственное покрытие v2-реплея — load-тест `internal/replay/replay_load_test.go:507` (perf-гейт, не запускался) |
| C1 | DONE (с отклонением) | back: `internal/protocol/protocol.go:132` `AfkTrailingMs = 15_000`; в `protocol.Settings` его нет; единственный оверрайд — `internal/ws/handler.go:117-127` `WithAfkKick` (опция конструктора сервера, для тестов) | back: `internal/ws/matchend_test.go:210` `TestAfkTrailingDNFInTimeMode` | Константа, не ручка комнаты — подтверждено. Отклонение от «варианта B»: кроме стрика сервер гоняет ВТОРОЕ правило — SHARE ≥ 0.6 после 10 с прогрева, счётные режимы (`internal/ws/room_afk.go:58-87`). Само число 15 000 на бэке тестом не закреплено (см. раздел 3) |
| C2 | DONE | `src/entities/match/model/session-store.ts:268-281` (12 000 / 0.55 / 8 000) против back: `internal/protocol/protocol.go:132-136` (15 000 / 0.6 / 10 000); оба числа рядом в `docs/MATCH.md:55-80`, таблица `:68-72` | `src/__tests__/match/afk-kick.test.ts:131` | Все три клиентских порога строго внутри серверных, задокументированы парами и закреплены |
| C3 | PARTIAL | клиент шлёт `finish{forfeit:true}` — `src/entities/match/model/session-store.ts:1102-1104`; сервер ставит `StatusDNF` и шлёт уже существующий `peer_status` — back: `internal/ws/room_afk.go:84-85` | `src/__tests__/match/afk-kick.test.ts:142`; back: `internal/ws/matchend_test.go:134` | Обычный fail-путь и НОЛЬ новых сущностей на проводе — подтверждено. НО ранжирование не «как у master-фейла»: dnf — тир 2 и сортируется по **wpm** (`session-store.ts:1385`), тогда как фейл по freemod-правилу — тир 1 и сортируется по **прогрессу** (`:1383`) |
| C4 | PARTIAL (отклонение) | back: `internal/ws/room_match.go:140-141` («A graced seat is not exempt»), `internal/ws/room_afk.go:70` (пропускаются только не-`seatActive`), `internal/ws/room.go:189-191` (при дисконнекте статус места остаётся `seatActive`) | `src/__tests__/match/afk-kick.test.ts:208` | Тест стыка с реконнект-парковкой есть, но он закрепляет ОБРАТНОЕ ожидаемому: игрок в grace-окне киается штатно и осознанно. При grace = 15 с (`room_match.go:29`) и trailing = 15 с дисконнект-место дисквалифицируется ровно тогда же, когда истекает grace |
| C5 | DONE | метр `src/entities/match/model/session-store.ts:1093-1100` (`Math.min(1, max(streak, mirror))`); подписи — `src/features/room/match/ui.vue:69-83` (`idle`, явный комментарий «Deliberately NOT called "afk"») против `src/features/room/results/ui.vue:231-234` (`room.results.afkShare`) | `src/__tests__/match/afk-kick.test.ts:150` (`afkProgress === 1`) | Метр честно доходит до 100 %; afkShare подписан иначе |
| C6 | DONE | (а) и метр, и свип якорятся на GO, а не на `startedAt` локального рана: `session-store.ts:1094-1096`, back: `internal/ws/room_afk.go:14-23,73-75`; (б) share достигает 1.0 — `room_afk.go:19-23` | back: `internal/ws/matchend_test.go:134` `TestWordsAfkShareDNF` (`AfkShare == 1.0`, `AfkMs > 0` у ни разу не печатавшего) | Обе исторические причины закрыты. Соло-путь `src/shared/core/stats.ts:583` по-прежнему даёт `afkMs=0` при `startedAt=null` — там это верно (нет окна рана) и свипом не используется |
| D1 | MISSING | back: `internal/protocol/protocol.go:410-417` (Countdown несёт только Settings+Seed), `:614-618` (валидация требует лишь непустой `quoteId`); в `internal/ws` нет ни одной ссылки на quote-стор. Розыгрыш — КЛИЕНТСКИЙ, у хоста: `src/features/room/config/ui.vue:326` | `src/__tests__/room/quote-config.test.ts:93` покрывает клиентский розыгрыш | Ни серверного розыгрыша цитаты на countdown, ни проверки существования `quoteId` в `settings_update` нет |
| D2 | DONE | рейка `src/features/leaderboards/rail/ui.vue`; sticky self-row + процентиль `src/features/leaderboards/self-row/ui.vue:65,91` + `model/percentile.ts`; `?around=me` `src/shared/api/leaderboards/endpoints.ts:38-49` ↔ back: `internal/leaderboard/handler.go:204-214`; колонки `src/features/leaderboards/board-table/ui.vue:9-95` | `src/__tests__/boards/{board-table,boards-page,percentile,own-rank,rail,mod-chips,feed-seams}.test.ts`; `e2e/boards.spec.ts` | Порядок колонок rank / player(ник + мод-чипы) / score(+грейд бейджем) / wpm / raw / acc / date — совпадает |
| D3 | PARTIAL | портрет `src/features/profile/keyboard/ui.vue`; общий ассет раскладок back: `internal/keyboard/layouts/{qwerty,jcuken}.json`, отдача GET `/layouts` — `src/shared/api/profile/endpoints.ts:50-52`; проекция в транзакции вердикта back: `internal/replay/pgstore/pgstore.go:34-41,150-154` + `internal/keyboard/pgstore/pgstore.go:100-118` | фронт: `src/__tests__/profile/profile-keyboard.test.ts` | Реализовано целиком. Чего нет: функционального теста на `ProjectKeyboard` ВНУТРИ транзакции вердикта — единственный вызов в тестах это load-харнесс back: `internal/profile/profile_load_test.go:527` |
| D4 | DONE | гейт back: `internal/auth/captcha.go:41`, навешан ровно на register / verify/resend / password-reset/request — `internal/auth/handler.go:22-30`; верификатор `internal/platform/turnstile/turnstile.go`; nil-верификатор = no-op (`internal/auth/service.go:104`); фронт `src/features/captcha/turnstile/*` | back: `internal/auth/captcha_test.go`, `internal/platform/turnstile/turnstile_test.go`; фронт `src/__tests__/auth/turnstile-captcha.test.ts` | Набор эндпойнтов совпадает с заявленным |
| D5 | DONE | back: `cmd/server/main.go:320` → `internal/ws/lobby.go` `LobbyHandler`; фильтр открытости `internal/ws/lobby.go:168` | back: `internal/ws/lobby_test.go`, `internal/ws/lobby_internal_test.go` | Есть; при этом в нём живёт открытый баг D8-№4 (см. ниже) |
| D6 | DONE | back: `cmd/banctl/main.go:3-22` (ban/unban/list/show, HTTP-админки нет намеренно); единственная дверь на чтение — вью `leaderboard_rows` (`db/migrations/00006_leaderboards.sql:182`, `00009:157,204`, `00011:103`); 403 `internal/runs/errors.go:48` | back: `internal/moderation/moderation_test.go` (7 тестов); `internal/runs/restricted_test.go:22,53,73,102` | Все три части на месте |
| D7 | PARTIAL | back: `docs/DICTIONARIES.md:60-69`; кап остался глобальным `MaxWordCount = 10 000` (`internal/runs/validate.go:43`) | back: `internal/replay/dictionaries_test.go:831` `TestEveryPublishedDictionaryCanPlayAFullLengthRun` (+ `:862` для v2) | ПЕР-СЛОВАРНОГО капа слов НЕТ и он явно отвергнут («the answer when it fails is to leave the dictionary out, never to raise the cap»). Реализовано другое: десять тяжёлых upstream-словарей просто не импортированы, и это закреплено тестом |
| D8 | см. раздел 1.1 | — | — | 5 из 7 багов бэкенд-лога открыты, 2 починены |
| D9 | MISSING | `e2e/perf.spec.ts:516-633`: сэмплер по-прежнему по стенным часам (`sleep(40)` × 120, выход по `progress() >= 100`), ассерт `drops >= 1` на `:630`, набор без замедления | — | Детерминированным не сделан — ровно та форма, которую `docs/REFACTOR_LOG.md:111-121` и диагностировал как флейк |
| D10 | DONE | журнал `docs/REFACTOR_LOG.md` (436 строк: baseline, 10 стейджей, DoD на `:413`); стейджи видны в коде: `src/shared/router/{index,route-names,route-locations}.ts` (стейдж 5) и его импорт `src/app/router/routes/boards.ts:3`; `narrowTo` вместо кастов `src/features/test/settings-bar/ui.vue:176` (стейдж 9); публичный API `src/entities/config` (стейдж 4) | тесты стейджей: `src/__tests__/stores/set-config-validation.test.ts` | Рефакторинг приземлён, журнал есть и подробный |

### 1.1. D8 — семь багов из back:`docs/REFACTOR_LOG.md:118-186`, по одному

| № | Вердикт | Доказательство | Тест |
|---|---|---|---|
| 1. отсутствует обещанный `defer pool.Close()` | НЕ ПОЧИНЕН | back: `cmd/server/main.go` — ни одного `Close()` в файле; комментарий на `:214` по-прежнему ссылается на «the deferred pool.Close» | нет |
| 2. `go r.persist(snap)` без владельца | НЕ ПОЧИНЕН | back: `internal/ws/room_match.go:358` — та же fire-and-forget горутина | нет |
| 3. гонка регистрации grace-токена | НЕ ПОЧИНЕН | back: `internal/ws/handler.go:210-213` — `addGrace` по-прежнему после `room.disconnect`, который уже взвёл таймер | нет |
| 4. `lobbyEntryOf` не знает `ModeQuote` | НЕ ПОЧИНЕН | back: `internal/ws/lobby.go:183-190` — switch покрывает только `ModeTime`/`ModeWords`; quote-комната в публичном списке идёт без `durationMs` и без `wordCount` | нет |
| 5. токен верификации в info-логах почты | ПОЧИНЕН | back: `internal/platform/mail/mail.go:97-104` — логируются только `to`, `subject`, `bodyBytes`; тело намеренно не пишется | НЕТ (в `internal/platform/mail` вообще нет `_test.go`) |
| 6. флейк холодного старта testcontainers | средовой, кода не касается | — | — |
| 7. устаревшая фикстура oversized-теста | ПОЧИНЕН | back: `internal/runs/ingest_load_test.go:223-225` — ступени теперь КАП-ОТНОСИТЕЛЬНЫЕ (1.25× / 2.5× / 5×), не сгниют при следующем пересчёте капа | сам load-тест `TestLoadIngestOversizedBodyRejectedEarly` (perf-гейт, не запускался) |

---

## 2. Расхождения код ↔ документация

1. **`src/pages/home/ui.vue:577`** — комментарий «in a race this re-races the SAME
   ghost **from 3-2-1**». Обратного отсчёта в гонке нет: `src/features/test/race/ui.vue:29-31`
   («There is no countdown and no overlay»), закреплено `src/__tests__/race/race-host.test.ts:145`.
2. **`src/pages/home/ui.vue:440-444`** — комментарий «the race host owns the game
   setup (exact words, exact seed, **'go' clock**)». Хост принудительно ставит
   `startPolicy: 'input'` (`src/features/test/race/ui.vue:147`), т.е. часы стартуют
   с первого нажатия, а не по 'go'.
3. **`docs/REFACTOR_LOG.md:421`** (фронт, DoD) фиксирует SHA пере-собранного бандла
   `27BC050B…`. Вендоренный файл на бэке сейчас хешируется в `01eb00f3…` — это
   ожидаемо (пере-вендорено под log v2), но строка DoD протухла.
4. **back:`docs/REFACTOR_LOG.md:118`** — заголовок «Найденные баги (**не исправлены**)»,
   при этом раздел триажа на `:186` помечает №5 и №7 как исправленные. Сам список
   не обновлён; из семи открыты №1-№4 (и №6 как средовой).
5. **back:`docs/DICTIONARIES.md:62`** утверждает «the ingestion event cap is 120 000»
   без упоминания живущего рядом v2-капа 480 000 (`internal/runs/validate.go:29`).
   Для log-v2-рана число в доке неверно.
6. **B7, зафиксированное решение «для v2 — только структурный слой»** противоречит коду:
   `src/shared/core/validate.ts:182-188` поднимает scored-флаг `unpaired-keyup`, и
   серверная review-политика его взвешивает (back:`internal/replay/policy_test.go:127`).
7. **C4** — ожидание аудита «игрок в grace-окне не киается по ошибке» противоречит
   явному проектному решению back:`internal/ws/room_match.go:140-141`:
   «A graced seat is not exempt: a disconnected player is the most AFK a player gets».
8. **`src/entities/race/model/store.ts:31-46`** перечисляет `quoteGroup` среди
   `RACE_SNAPSHOT_KEYS`, но `src/features/test/race/ui.vue:107-125` его никогда не
   пишет — ключ участвует только в снапшоте/восстановлении, так что quote-гонка
   показывает в баре СВОЮ группу игрока, а не группу рекорда.

---

## 3. Реализовано без тестов (UNTESTED-риски, по убыванию)

1. **B8 — v2-лог никогда не проходит через GhostDriver и плеер реплея.**
   Эквивалентность закреплена только на v1-логах (`src/__tests__/match/ghost-driver.test.ts:143`).
   Регрессия в no-op-обработке телеметрии призраком/реплеем не будет поймана ничем.
2. **B12 — смешанная популяция v1+v2 в БД.** Приём версий закреплён на ingest, но
   реплей смешанной популяции — нет; единственное v2-покрытие реплея это perf-гейт.
3. **D8-№5 — редакция письма в `LogSender`.** Починено, но в `internal/platform/mail`
   нет ни одного теста: возврат тела письма в лог пройдёт молча.
4. **D3 — `ProjectKeyboard` внутри транзакции вердикта.** Атомарность «принят ⇔ учтён
   в хитмапе» держится только на коде; функционального теста нет.
5. **C1 — само число 15 000 мс на сервере.** Ни один Go-тест его не утверждает
   (тесты инжектят свои значения); число продублировано литералом в
   `src/__tests__/match/afk-kick.test.ts:137` — при изменении бэка фронт-тест
   останется зелёным и разъедется молча.
6. **A2 — исключения `language` / `quoteGroup` из применяемого сетапа.** Ни один тест
   не фиксирует, что именно бар показывает в quote-гонке.
7. **B11 — свежесть вендоренного бандла.** Ничего не падает, если бандл отстанет от
   фронтового ядра (кроме golden-векторов, которые ловят только сдвиг арифметики).
8. **A4/A6 — отсутствующие части** тестами, разумеется, не закрыты (они и не
   реализованы) — перечислены здесь как известные дыры покрытия поведения выхода из
   гонки: единственный путь выхода закреплён лишь e2e (`e2e/race.spec.ts:114-120`).

---

## 4. Остатки удалённого (по grep)

1. **Мёртвая alert-цепочка (фронт).** `src/widgets/alerts/ui.vue` не импортируется
   нигде (grep по `src/app`, `src/pages`, `src/widgets` — пусто), `useAlertStore`
   (`src/entities/alert/model/store.ts:14`) не вызывается ни из одной фичи: экран
   результатов переехал на sonner (`src/features/test/results/ui.vue:259,397-398`).
   Живым остаётся только тест на сам стор — `src/__tests__/stores/alert.test.ts`.
   Итого мёртвыми висят: `src/entities/alert/`, `src/widgets/alerts/` и их тест.
   Это ровно баг №7 фронтового `docs/REFACTOR_LOG.md:127-135`, не закрытый.
2. **`/race` — остатков НЕ найдено.** `src/pages/race` отсутствует; `ROUTE_NAMES.RACE`
   сохранён намеренно как цель тонкого редиректа, его производители живые:
   `src/features/leaderboards/board-table/ui.vue:276`, `src/pages/profile/ui.vue:261`,
   `src/app/router/routes/boards.ts:37`.
3. **`src/features/room/match/race-rail.vue` — НЕ остаток.** Это рейка мультиплеерного
   матча, смонтирована и покрыта `src/__tests__/room/race-rail.test.ts`.
4. **Незакоммиченные «сироты» на фронте.** `src/shared/core/normalize.ts` реэкспортируется
   из `src/shared/core/index.ts:7`, но ни один модуль ядра его не импортирует
   (проверены `game-core`, `stats`, `score`, `words`, `keyboard`, `parse`, `validate`,
   `timer`, `mods`) — пока это чистое расширение публичного API без потребителя внутри
   ядра. Именно поэтому его отсутствие в вендоренном бандле безвредно (см. B11).

---

## 5. UNKNOWN — что не удалось установить и что для этого нужно

1. **Байт-в-байт актуальность вендоренного бандла.** Установлено: log-v2-символы в
   бандле есть, экспортов `normalize.ts` — нет. Установить, совпадает ли бандл с
   свежей сборкой текущего ядра, read-only нельзя: `make core-bundle` перезаписывает
   `internal/replay/corejs/core.bundle.js` (мандат запрещает менять файлы).
   *Что нужно:* собрать esbuild'ом во ВРЕМЕННЫЙ путь теми же флагами
   (back:`Makefile:79-83`) и сделать diff против вендоренного файла.
2. **Фактическое состояние perf/load-гейтов.** B10 (капы в рантайме), B12 (v2-реплей),
   D8-№7 (ранний 413) покрыты только длинными load-тестами, запуск которых запрещён
   мандатом. Их зелёность НЕ проверялась. *Что нужно:* точечный
   `go test -run TestLoadIngestOversizedBodyRejectedEarly ./internal/runs/` и
   `-run TestLoadReplayMaxRunV2Telemetry ./internal/replay/` на непрогруженной машине.
3. **Ни один тест в рамках аудита не запускался** (read-only мандат). Все вердикты
   «тест есть» означают «тест существует в исходниках и по коду обязан упасть при
   вырезании фичи», а не «наблюдался зелёный/красный прогон». Для B4/B8/D9 это
   особенно существенно: D9 по коду флейк, но частота не измерялась.
4. **D9 — фактическая частота флейка после последних правок фронта** (в рабочей копии
   изменены `src/widgets/test/*`, `src/shared/lib/hooks/useLineJump.ts`,
   `useScrollTape.ts`, влияющие на line-jump). *Что нужно:* 5-10 повторов
   `pnpm exec playwright test e2e/perf.spec.ts -g "replay field honors"`.
5. **Влияние 100 незакоммиченных файлов фронта на вердикты.** Аудит читал рабочую
   копию (это и есть текущее состояние), но сопоставить, какие из вердиктов держатся
   только на незакоммиченной работе, без диффа по каждому файлу нельзя.
   *Что нужно:* `git diff` по `src/shared/core`, `src/entities/race`, `src/features/test/race`.

---

## 6. `git status` обоих репозиториев (дословно, ничего не трогалось)

### TypeMore_front

```
On branch main
Your branch is ahead of 'origin/main' by 79 commits.
  (use "git push" to publish your local commits)

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   e2e/profile.spec.ts
	modified:   e2e/race.spec.ts
	modified:   src/__tests__/boards/board-format.test.ts
	modified:   src/__tests__/core/parse.test.ts
	modified:   src/__tests__/core/quote-source.test.ts
	modified:   src/__tests__/core/telemetry.test.ts
	modified:   src/__tests__/game-config/registry.test.ts
	modified:   src/__tests__/game-word.test.ts
	modified:   src/__tests__/hooks/useGhostCarets.test.ts
	modified:   src/__tests__/match/session-resilience.test.ts
	modified:   src/__tests__/profile/profile-keyboard.test.ts
	modified:   src/__tests__/race/race-host.test.ts
	modified:   src/__tests__/replay-from-api/replay-page-states.test.ts
	modified:   src/__tests__/replay-player.test.ts
	modified:   src/__tests__/room/race-rail.test.ts
	modified:   src/__tests__/run-submit/use-run-submission.test.ts
	modified:   src/__tests__/telemetry-adapter.test.ts
	modified:   src/__tests__/telemetry-capture.test.ts
	modified:   src/app/i18n/locales/en.ts
	modified:   src/app/i18n/locales/ru.ts
	modified:   src/app/tailwind.css
	modified:   src/entities/game/config/registry.ts
	modified:   src/entities/game/lib/whitespace.ts
	modified:   src/entities/game/model/store.ts
	modified:   src/entities/game/model/view.ts
	modified:   src/entities/race/index.ts
	modified:   src/entities/race/model/store.ts
	modified:   src/features/leaderboards/model/format.ts
	modified:   src/features/modal/settings/parts/AppearanceSection.vue
	modified:   src/features/modal/settings/parts/CaretSection.vue
	modified:   src/features/modal/settings/parts/InputSection.vue
	modified:   src/features/modal/settings/parts/ThemeSection.vue
	modified:   src/features/modal/settings/ui.vue
	modified:   src/features/profile/activity/ui.vue
	modified:   src/features/profile/keyboard/ui.vue
	modified:   src/features/profile/pbs/ui.vue
	modified:   src/features/profile/runs-table/ui.vue
	modified:   src/features/profile/section/ui.vue
	modified:   src/features/profile/summary/ui.vue
	modified:   src/features/replay-view/index.ts
	modified:   src/features/room/chat/ui.vue
	modified:   src/features/room/config/parts/Identity.vue
	modified:   src/features/room/controls/ui.vue
	modified:   src/features/room/players/ui.vue
	modified:   src/features/room/results/ui.vue
	modified:   src/features/run-submit/index.ts
	modified:   src/features/run-submit/model/build-payload.ts
	modified:   src/features/run-submit/model/use-run-submission.ts
	modified:   src/features/test/input/ui.vue
	modified:   src/features/test/race/ui.vue
	modified:   src/features/test/replay/ui.vue
	modified:   src/features/test/results/ui.vue
	modified:   src/features/test/score-hud/ui.vue
	modified:   src/features/test/settings-bar/ui.vue
	modified:   src/pages/auth/login/ui.vue
	modified:   src/pages/home/ui.vue
	modified:   src/pages/match/ui.vue
	modified:   src/pages/replay/ui.vue
	modified:   src/shared/api/runs/types.ts
	modified:   src/shared/constants/default-config.ts
	modified:   src/shared/constants/type.ts
	modified:   src/shared/core/events.ts
	modified:   src/shared/core/game-core.ts
	modified:   src/shared/core/index.ts
	modified:   src/shared/core/parse.ts
	modified:   src/shared/core/score.ts
	modified:   src/shared/core/stats.ts
	modified:   src/shared/core/validate.ts
	modified:   src/shared/lib/helpers/environment.ts
	modified:   src/shared/lib/helpers/narrow.ts
	modified:   src/shared/lib/helpers/validation.ts
	modified:   src/shared/lib/hooks/useAppSetup.ts
	modified:   src/shared/lib/hooks/useCaret.ts
	modified:   src/shared/lib/hooks/useGhostCarets.ts
	modified:   src/shared/lib/hooks/useLineJump.ts
	modified:   src/shared/lib/hooks/useScrollTape.ts
	modified:   src/shared/lib/log-version.ts
	modified:   src/shared/match-transport/batcher.ts
	modified:   src/shared/match-transport/loopback.ts
	modified:   src/shared/match-transport/protocol.ts
	modified:   src/shared/match-transport/ws-transport.ts
	modified:   src/shared/ui/typography/ui.vue
	modified:   src/widgets/footer/ui.vue
	modified:   src/widgets/test/game-styles.ts
	modified:   src/widgets/test/ui.vue

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	src/__tests__/core/normalize.test.ts
	src/__tests__/core/word-history.test.ts
	src/__tests__/input-history.test.ts
	src/__tests__/input-normalize.test.ts
	src/__tests__/perf/
	src/__tests__/race/pace-position.test.ts
	src/__tests__/replay-from-api/replay-results.test.ts
	src/__tests__/run-submit/restart-counter.test.ts
	src/features/replay-view/model/replay-results.ts
	src/features/run-submit/model/restart-counter.ts
	src/features/test/pace/
	src/features/test/results/input-history.vue
	src/shared/core/normalize.ts
	src/shared/lib/helpers/datetime.ts
	src/shared/lib/hooks/useRootClass.ts

no changes added to commit (use "git add" and/or "git commit -a")
```

### TypeMore_back

```
On branch main
Your branch is ahead of 'origin/main' by 74 commits.
  (use "git push" to publish your local commits)

nothing to commit, working tree clean
```

---

*Примечание к разделу 6: `git status` снят ДО записи этого файла. Сам
`docs/AUDIT_STATE.md` — новый untracked-файл в обоих репозиториях (в TypeMore_back
он единственное изменение рабочего дерева); коммит не делался.*
