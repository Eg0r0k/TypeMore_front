# @typemore/core

Framework-free ядро TypeMore: event log (v1 + v2-телеметрия), редьюсер,
метрики, score, нормализация ввода, `mulberry32`, FNV-1a. Единственный
источник истины для веб-приложения **и** для серверного replay: бэкенд
исполняет ровно этот код через goja (`dist/core.bundle.js`, вендорится в
`TypeMore_back/internal/replay/corejs/`). Go-реализаций алгоритмов ядра не
существует и существовать не должно.

## Сборка

```sh
pnpm --filter @typemore/core build
```

Один entry — `src/index.ts`, из него собираются оба артефакта:

| Артефакт | Что это |
|---|---|
| `dist/index.js`, `dist/*.d.ts` | ESM-библиотека |
| `dist/core.bundle.js` | самодостаточный IIFE (`TypeMoreCore`) для goja |

Сборка детерминирована: два прогона на одном дереве дают байт-в-байт
одинаковый файл (закреплено `tests/bundle-determinism.test.ts`). Последняя
строка бандла — машинно-читаемый трейлер
`//# typemore-core-build {version, eventLogVersion, telemetryLogVersion,
gitSha, gitDirty}`; `make core-bundle` на стороне бэка отказывается
вендорить бандл, собранный из грязного или несовпадающего с HEAD дерева.

`tests/export-parity.test.ts` держит множество экспортов бандла равным
множеству экспортов `src/index.ts` — бандл, собранный из другого entry, не
проходит тесты.

## Публичная поверхность

Только `@typemore/core` (index) и `@typemore/core/timer.worker`
(Vite-воркер, отдельный entry по своей природе). Deep-import'ы в `src/...`
закрыты через `exports`. Нужно что-то ещё — экспортируйте из index
осознанно, с записью в EXTRACTION_LOG.md.

## Версионирование

Semver. **major = версия формата event-log** (сейчас 2 — log v2,
keystroke-телеметрия). Бамп формата лога — это major-бамп пакета. Пакет не
публикуется в npm — только workspace.

## Политика изменений ядра

Правило политики флагов v1, дословно:

> Любое изменение поведения ядра (CoreConfig, редьюсер, бамп
> EVENT_LOG_VERSION) требует пере-вендоринга и деплоя бандла ДО того, как
> такие раны поедут от игроков.

Практически: правка ядра → `pnpm --filter @typemore/core build` → в
`TypeMore_back`: `make core-bundle` → `make revalidate` (BundleSHA
двигается, вся история должна быть пересужена текущим ядром) → деплой
сервера, и только потом — клиента.

## Чистота

Ядро не импортирует Vue/Pinia/DOM и не читает часы
(`tests/purity.test.ts`, запускается и из пакета:
`pnpm --filter @typemore/core test:purity`). Исключение — `timer.worker.ts`
(cadence-оболочка с worker-глобалами, не входит в граф редьюсера).
