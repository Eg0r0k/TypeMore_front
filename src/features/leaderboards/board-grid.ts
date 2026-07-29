/*
 * THE board grid — one definition for the ranking table, its header and the
 * pinned self row, so "your metrics in exactly the table's columns" is true
 * by construction rather than by three templates agreeing.
 *
 * Column order is the ranking's own: rank, player (mod chips ride beside the
 * name), SCORE (the metric the board sorts by — visually primary, with the
 * grade badge beside the value), then wpm / raw / acc, then the date. Grade
 * and mods own no column of their own.
 *
 * The PAINT (padding, zebra, type scale) is not here — it comes from the app's
 * shared table recipe in `shared/ui/table`, which the profile's runs table and
 * the room's standings use too. This constant is only the column geometry.
 */
export const BOARD_GRID =
  'grid w-full grid-cols-[2.75rem_minmax(8rem,1fr)_6.5rem_3.5rem_3.5rem_3.5rem_6rem] items-center gap-3 text-start'
