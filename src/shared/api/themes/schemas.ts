import * as v from 'valibot'

/**
 * Layer 1 — A theme is a name plus the palette every screen reads as CSS custom
 * properties. The seven below are required (the app has no partial-theme
 * fallback); any extra `--*` a theme ships is kept as a string.
 */
export const ThemeSchema = v.objectWithRest(
  {
    name: v.string(),
    '--bg-color': v.string(),
    '--main-color': v.string(),
    '--sub-color': v.string(),
    '--sub-alt-color': v.string(),
    '--text-color': v.string(),
    '--error-color': v.string(),
    '--error-extra-color': v.string()
  },
  v.string()
)
export type Theme = v.InferOutput<typeof ThemeSchema>

export const ThemeListSchema = v.array(ThemeSchema)
export type ThemeList = v.InferOutput<typeof ThemeListSchema>
