import clsx from 'clsx'

/**
 * The look of a chip on the notice line under the test config bar — the
 * language, the pace, the difficulty and the view mods.
 *
 * It lives with the option registry rather than in the settings bar because the
 * pace selector is its own feature and sits in the middle of that line: two
 * copies of the string is how the row ends up with one chip a pixel taller than
 * its neighbours.
 *
 * Sized to be READ and HIT: 13px text with a 15px glyph and a real padding box,
 * not the 12px text at 60% opacity the line used to carry. Everything on this
 * line is a control, and half of it was being mistaken for a caption.
 */
const BASE = [
  'inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1',
  'text-[0.8125rem] leading-none transition-tm focus-ring',
  '[&_svg]:size-[0.9375rem] [&_svg]:shrink-0',
  'disabled:cursor-default disabled:opacity-50'
].join(' ')

/**
 * `iconOnly` chips are the view mods, and they are the ONE control here whose
 * value you can only read from its own appearance — there is no label saying
 * "on". A text chip could get away with brightening from `sub` to `text`,
 * because the word beside it is already telling you what it is; a lone glyph
 * that only brightens says nothing.
 *
 * So an active view mod takes the same filled `main` pill the toggle groups
 * above it use. One rule across the whole bar: filled blue means on.
 */
export const noticeChipClass = (active: boolean, iconOnly = false): string =>
  clsx(
    BASE,
    iconOnly
      ? [
          'px-1.5',
          active
            ? 'bg-main text-bg hover:brightness-110'
            : 'text-sub hover:bg-sub-alt hover:text-text'
        ]
      : active
        ? 'text-text hover:bg-sub-alt'
        : 'text-sub hover:bg-sub-alt hover:text-text'
  )
