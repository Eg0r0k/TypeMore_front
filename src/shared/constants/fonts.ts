/**
 * Typefaces bundled with the app. The list mirrors `$var-fonts` in
 * `src/app/main.scss` — every entry there is `@font-face`d at boot, so anything
 * offered here is guaranteed to render without a network round trip.
 * `config.fontFamily` stores the family name verbatim.
 */
export const FONT_FAMILIES: readonly string[] = [
  'Geist',
  'Hack',
  'JetBrainsMono',
  'Mononoki',
  'Montserrat',
  'ShantellSans',
  'Vazirmatn',
  'Lobster',
  'BalsamiqSans'
]

/** Test-text size bounds offered by the settings dialog (px). */
export const FONT_SIZE_MIN = 16
export const FONT_SIZE_MAX = 48
export const FONT_SIZE_STEP = 2
