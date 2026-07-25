import { request } from '../transport'
import { ThemeListSchema, type ThemeList } from './schemas'

/**
 * Layer 1 — Themes ship with the frontend (`public/static/themes/themes.json`),
 * not with the Go backend. The URL is made absolute against the app origin so
 * the shared transport does not prefix it with the API base — everything else
 * (schema parsing, error normalization) is worth reusing.
 */
export const listThemes = (): Promise<ThemeList> =>
  request(new URL('/static/themes/themes.json', window.location.origin).toString(), ThemeListSchema)
