# DEV preview — `/profile` and `/u/{name}` without a backend

The two profile pages are almost entirely a rendering of data nobody has
locally: a year of activity, a board of personal bests, a keyboard portrait,
two charts, a paginated run history — and the server's REFUSALS, which are half
of what `/u` draws (a closed profile, a private portrait, an unknown name).

Preview mode answers those requests from fixtures so every state can be looked
at with no backend, no account and no year of typing. It is **development
only**: the flag reads `null` in a production build, and the fixtures, the
handler and the badge are behind DEV-guarded dynamic imports, so a production
bundle never contains them.

## Using it

```
pnpm dev
```

then open either page with the flag:

```
/profile?preview=1                 # a lived-in account
/profile?preview=empty             # a fresh one
/u/preview_rival?preview=closed    # somebody who closed their profile
```

A badge appears in the bottom-left corner of the two pages (and nowhere else).
It shows the active scenario and switches between them, so the URL is only ever
needed once. The choice lives in `sessionStorage` for the tab — leaving the URL
that set it keeps the preview on; `?preview=off`, or the badge's `off`, ends it.

Switching a scenario reloads the page on purpose: `/me` resolves once per page
load and the auth store is derived from it, so `guest` is only honest after a
fresh boot.

Add `&previewDelay=3000` to any of these to hold every previewed response for
three seconds — that is how the loading skeletons are looked at (fixtures answer
within a microtask otherwise). URL-only, never remembered.

## The scenarios

| Scenario   | What it shows                                                                      |
| ---------- | ---------------------------------------------------------------------------------- |
| `full`     | A lived-in account: every section populated (`?preview=1` means this).             |
| `empty`    | A fresh account: honest zeroes, empty PBs, empty history.                          |
| `stress`   | The layout's worst case: a 24-character name, twelve languages, five-digit counts. |
| `closed`   | `/u` of a player who closed their profile — 403 `profile_closed` per section.      |
| `portrait` | An open profile that keeps its keyboard portrait private (403 `portrait_closed`).  |
| `missing`  | `/u` of a name nobody has — the 404 state.                                         |
| `error`    | Every aggregate fails: the section error chrome and its retry, section by section. |
| `guest`    | No session — `/profile` renders its sign-in hint.                                  |

Two names matter. `preview_you` is who the mocked session is, and
`preview_rival` is somebody else. That pair is what makes the owner's view
previewable: `/u/preview_you?preview=closed` renders the page its OWNER sees
(the server lets an owner through their own closed profile), while
`/u/preview_rival?preview=closed` renders what a stranger gets. Any other name
works too — it is simply treated as a stranger's.

## How it works, and why there

`src/shared/dev-preview/`:

- `scenario.ts` — the flag: reading it from the URL, remembering it for the tab.
- `fixtures.ts` — one builder per endpoint. Deterministic (a seeded PRNG keyed by
  the profile's name), so a reload redraws the same charts and screenshots stay
  comparable; only "today" moves, because a heatmap ending three months ago is
  not what the page looks like.
- `handler.ts` — path → fixture, plus the refusals as real `ApiError`s carrying
  the server's own codes.
- `ui.vue` — the badge.

The fixtures enter at the TRANSPORT boundary (`shared/api/transport.ts`), not by
seeding the query cache from the pages. That is the whole point: the pages, their
auth gates, their loading skeletons, their `keepPreviousData` range switches,
their retry policies and their error states all run exactly as they do against
the real server — the only thing replaced is what comes back over the wire. A
fixture is still parsed by the endpoint's own valibot schema on the way in, so a
fixture that drifts from the contract fails loudly instead of quietly rendering
a page the server could never produce (`src/__tests__/profile/dev-preview.test.ts`
pins the same thing in CI).

Anything the handler does not recognise falls through to the network, so preview
mode never blinds the rest of the app, and writes are never faked: `GET` only.

## What it does NOT cover

Only what the two pages ask for, plus `/quotes/{id}` (the runs table resolves a
quote row's text) and `/me`. Following a row into `/replay/{runId}` or racing a
PB leaves the previewed surface and hits the real API — those pages have their
own data and are out of scope here.
