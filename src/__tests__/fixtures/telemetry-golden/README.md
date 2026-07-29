# telemetry-golden — a stored v1/v2 pair from a real run

These three files are the on-disk half of the stripping property (`v2 minus
telemetry ≡ v1`). They exist because the property's other tests SYNTHESIZE both
twins — `core/telemetry.test.ts` from a table generator, `core/telemetry-property.test.ts`
from the live game store — and a synthesized pair can only ever be as correct as
the thing that synthesized it. These bytes were written by the shipped client
and judged by the shipped server; nothing in the repo can move them.

| file               | what it is                                                                                                                                                                                                                                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `run-v2.json`      | A real accepted log-v2 run, pulled verbatim out of the dev database's `runs` table (row `ea2bfd6d-169f-41dc-bf7d-0cac74ee7423`, 2026-07-29). `log` is the gunzipped `runs.log` blob event for event; `setup`, `serverValidation`, `serverScore`, `serverMetrics`, `seed` and `dictHash` are that row's columns. |
| `run-v1-twin.json` | Its v1 twin: every `down`/`up` removed, `seq` renumbered contiguously from 1, `t` and payloads untouched. **A frozen expectation** — the test compares against these stored bytes instead of recomputing them, which is the whole point.                                                                        |
| `dictionary.json`  | The word list the run was played against — `GET /static/dictionaries/f5aacfd2.json` from the dev server. The frontend ships no dictionaries, so the words have to travel with the fixture; the test still regenerates the run's targets from `seed` + this body through the real generator.                     |

## Why the twin is derived and the v2 log is the real one

A single run is captured at one log version, so a pair of genuinely independent
captures of _the same keystrokes_ does not exist and cannot be fabricated. Of
the two possible directions only one is honest:

- real v2 → derived v1 (**what this is**): dropping telemetry throws information
  away. Nothing is invented.
- real v1 → derived v2: would mean inventing `KeyboardEvent.code` values and
  press/release instants nobody recorded. That is not a fixture, it is a forgery.

So the v2 log is the evidence and the v1 twin is the frozen claim about it.

## The second pair, not built yet

This run has `validation.flags` empty, and that is a deliberate choice: the v2
report can carry `unpaired-keyup` (a scored flag raised off telemetry —
`validate.ts:165-189`) where its v1 twin structurally cannot, so "the same
report" would be false for a reason that is not a bug. Most real v2 runs in the
dev database are of that kind.

The pair covering THAT case is tracked as a skipped test in
`../../core/telemetry-golden.test.ts` — not as a line in this file, so it stays
in front of whoever runs the suite. It waits on the `unpaired-keyup` weight
being zeroed in the server review policy (B7).

## Refreshing

Don't, unless the wire format changes. If it must be refreshed, take another
**accepted** run whose `validation.flags` is empty (see above), and regenerate
`run-v1-twin.json` by the derivation described in its `provenance` block.
