import type { InjectionKey, MaybeRef } from 'vue'
import type { Theme } from '@shared/api'

// Provide keys for App.vue. The value may arrive as a plain reactive array
// (the app provides `useThemes().themesList`) or as a Ref (unit tests) — both
// read the same from a template, so the key admits either.
export const THEMES_KEY: InjectionKey<MaybeRef<Theme[]>> = Symbol('themes')
