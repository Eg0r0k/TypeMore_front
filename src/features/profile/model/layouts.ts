/**
 * Keyboard layout PRESETS for the profile heatmap.
 *
 * The heatmap is keyed on PHYSICAL keys (`KeyboardEvent.code` — `KeyA`,
 * `Digit1`, `Space`), which is exactly what the server's per-key aggregates
 * carry. A layout therefore is nothing but a relabelling of the same physical
 * board: same ids, different glyphs. That makes the whole thing data — a row
 * template plus one glyph string per row — so adding Colemak-DH is three
 * strings, not a new component branch.
 *
 * Only LATIN layouts ship here on purpose: the map's labels are the caps a
 * touch typist looks at, and the profile's own key data is layout-agnostic.
 * (The Cyrillic ЙЦУКЕН board used to come from the server asset and was
 * dropped — it doubled the toggle for zero extra information.)
 */

/** One drawn cap: the physical key, the glyph on it, its width in key units. */
export interface LayoutKey {
  readonly id: string
  readonly label: string
  /** Cap width in key units (1 = a letter cap; the space bar is several). */
  readonly units: number
}

export interface KeyboardLayoutPreset {
  /** Stable id used by the toggle and by the server's `keyboard.layout`. */
  readonly name: string
  readonly label: string
  readonly rows: readonly (readonly LayoutKey[])[]
}

// ── The physical board (ANSI), shared by every preset ───────────────────────
const DIGIT_ROW = [
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Digit6',
  'Digit7',
  'Digit8',
  'Digit9',
  'Digit0'
] as const

const TOP_ROW = [
  'KeyQ',
  'KeyW',
  'KeyE',
  'KeyR',
  'KeyT',
  'KeyY',
  'KeyU',
  'KeyI',
  'KeyO',
  'KeyP',
  'BracketLeft',
  'BracketRight'
] as const

const HOME_ROW = [
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyF',
  'KeyG',
  'KeyH',
  'KeyJ',
  'KeyK',
  'KeyL',
  'Semicolon',
  'Quote'
] as const

const BOTTOM_ROW = [
  'KeyZ',
  'KeyX',
  'KeyC',
  'KeyV',
  'KeyB',
  'KeyN',
  'KeyM',
  'Comma',
  'Period',
  'Slash'
] as const

/** The space bar, in key units — wide enough to read as one. */
const SPACE_UNITS = 6.25

/**
 * Zips a physical row with its glyphs. Throws on a length mismatch: a preset
 * that lost a glyph is a typo, and silently drawing a blank cap would hide it
 * behind a plausible-looking keyboard.
 */
function row(ids: readonly string[], glyphs: string): readonly LayoutKey[] {
  const chars = [...glyphs]
  if (chars.length !== ids.length) {
    throw new Error(
      `keyboard preset row: ${ids.length} keys but ${chars.length} glyphs ("${glyphs}")`
    )
  }
  return ids.map((id, i) => ({ id, label: chars[i] as string, units: 1 }))
}

const SPACE_ROW: readonly LayoutKey[] = [{ id: 'Space', label: '␣', units: SPACE_UNITS }]

interface PresetSpec {
  readonly name: string
  readonly label: string
  readonly digits: string
  readonly top: string
  readonly home: string
  readonly bottom: string
}

/** The glyph tables. Order here is the order of the layout toggle. */
const SPECS: readonly PresetSpec[] = [
  {
    name: 'qwerty',
    label: 'QWERTY',
    digits: '1234567890',
    top: 'qwertyuiop[]',
    home: "asdfghjkl;'",
    bottom: 'zxcvbnm,./'
  },
  {
    name: 'qwertz',
    label: 'QWERTZ',
    digits: '1234567890',
    top: 'qwertzuiopü+',
    home: 'asdfghjklöä',
    bottom: 'yxcvbnm,.-'
  },
  {
    name: 'azerty',
    label: 'AZERTY',
    digits: '&é"\'(-è_çà',
    top: 'azertyuiop^$',
    home: 'qsdfghjklmù',
    bottom: 'wxcvbn,;:!'
  },
  {
    name: 'dvorak',
    label: 'Dvorak',
    digits: '1234567890',
    top: "',.pyfgcrl/=",
    home: 'aoeuidhtns-',
    bottom: ';qjkxbmwvz'
  },
  {
    name: 'colemak',
    label: 'Colemak',
    digits: '1234567890',
    top: 'qwfpgjluy;[]',
    home: "arstdhneio'",
    bottom: 'zxcvbkm,./'
  },
  {
    name: 'colemak-dh',
    label: 'Colemak-DH',
    digits: '1234567890',
    top: 'qwfpbjluy;[]',
    home: "arstgmneio'",
    bottom: 'zxcdvkh,./'
  },
  {
    name: 'workman',
    label: 'Workman',
    digits: '1234567890',
    top: 'qdrwbjfup;[]',
    home: "ashtgyneoi'",
    bottom: 'zxmcvkl,./'
  }
]

/** Every layout the heatmap can be drawn in. */
export const KEYBOARD_LAYOUT_PRESETS: readonly KeyboardLayoutPreset[] = SPECS.map((spec) => ({
  name: spec.name,
  label: spec.label,
  rows: [
    row(DIGIT_ROW, spec.digits),
    row(TOP_ROW, spec.top),
    row(HOME_ROW, spec.home),
    row(BOTTOM_ROW, spec.bottom),
    SPACE_ROW
  ]
}))

/** The layout drawn when the profile names one we do not ship (e.g. ЙЦУКЕН). */
export const DEFAULT_LAYOUT_NAME = 'qwerty'

/** Resolves a layout by name, falling back to {@link DEFAULT_LAYOUT_NAME}. */
export function layoutByName(name: string): KeyboardLayoutPreset {
  return (
    KEYBOARD_LAYOUT_PRESETS.find((preset) => preset.name === name) ??
    (KEYBOARD_LAYOUT_PRESETS.find((preset) => preset.name === DEFAULT_LAYOUT_NAME) as
      KeyboardLayoutPreset | undefined) ??
    (KEYBOARD_LAYOUT_PRESETS[0] as KeyboardLayoutPreset)
  )
}
