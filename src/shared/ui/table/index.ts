/**
 * THE table look — one definition for every ranking, standings and history
 * table in the app, so "these all read the same" is true by construction rather
 * than by four templates happening to agree.
 *
 * The look is the profile's runs table: no rules between rows, zebra striping
 * on the odd ones with the stripe rounded at both ends of the row, a quiet
 * lowercase header in `--sub-color`, tabular numbers, and a font size that
 * steps up with the viewport. Colours are design tokens only, so a theme
 * switch repaints every table at once.
 *
 * Two flavours, same paint:
 *   • {@link TABLE} for a real `<table>` (profile runs, room standings);
 *   • {@link TABLE_GRID_*} for the grid-based boards, whose "rows" are single
 *     buttons and therefore cannot be table rows.
 *
 * These are plain strings rather than components on purpose: the four tables
 * differ in structure (a `<table>`, a grid of buttons, a sticky single row)
 * and share only their paint. A component would have had to model all three.
 */

/** The scroll box. Narrow columns outgrow a phone; the TABLE scrolls, not the page. */
export const TABLE_SCROLL = 'w-full overflow-x-auto'

/**
 * The `<table>` itself. `border-separate` with zero spacing is what lets the
 * zebra stripe carry rounded corners without a wrapper element per row.
 */
export const TABLE = [
  'w-full table-auto border-separate border-spacing-0 text-xs md:text-sm lg:text-base',
  '[&_td]:appearance-none [&_td]:p-2 [&_td]:text-left [&_td]:align-middle',
  '[&_td:first-child]:w-0 [&_td:first-child]:rounded-l [&_td:first-child]:pl-4',
  '[&_td:last-child]:rounded-r [&_td:last-child]:pr-4',
  '[&_th]:appearance-none [&_th]:p-2 [&_th]:align-bottom [&_th]:text-left [&_th]:text-xs',
  '[&_th]:font-normal [&_th]:whitespace-nowrap',
  '[&_th:first-child]:pl-4 [&_th:last-child]:pr-4',
  'xl:[&_td:first-child]:pl-8 xl:[&_th:first-child]:pl-8',
  // Numeric columns opt in with data-num on the th/td: right-aligned tabular
  // digits stack into comparable place-value columns. The attribute selector
  // outweighs the [&_td]:text-left default, so no !important is needed.
  '[&_td[data-num]]:text-right [&_td[data-num]]:tabular-nums [&_th[data-num]]:text-right'
].join(' ')

/** `<thead>` — labels, never data. */
export const TABLE_HEAD = 'text-sub'

/** `<tbody>` — the zebra. Odd rows carry the stripe; even rows are the page. */
export const TABLE_BODY = '[&>tr:nth-child(odd)>td]:bg-sub-alt'

/** A row the reader is looking for (their own): the accent, nothing louder. */
export const TABLE_ROW_SELF = '[&>td]:text-main'

/** A row that did not finish / does not count: present, but quiet. */
export const TABLE_ROW_MUTED = '[&>td]:text-sub'

// ── The grid flavour (leaderboards) ────────────────────────────────────────

/** The header strip above a grid table. */
export const TABLE_GRID_HEAD = 'px-4 py-2 text-xs text-sub'

/** One grid row: the same padding, size and rounding as a `<table>` row. */
export const TABLE_GRID_ROW = 'rounded px-4 py-2 text-xs md:text-sm lg:text-base'

/** The zebra stripe, applied to odd rows by the list that owns them. */
export const TABLE_GRID_ROW_ODD = 'bg-sub-alt'
