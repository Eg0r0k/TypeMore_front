import type { InjectionKey, MaybeRef, Ref } from 'vue'
import type { Theme } from '@shared/api'

// Provide keys for App.vue. The value may arrive as a plain reactive array
// (the app provides `useThemes().themesList`) or as a Ref (unit tests) — both
// read the same from a template, so the key admits either.
export const THEMES_KEY: InjectionKey<MaybeRef<Theme[]>> = Symbol('themes')

/**
 * Room → leave button: "the way out is that one".
 *
 * The PAGE owns this, because only the page can cancel a route change, and the
 * button it points at lives two components down inside the lobby grid —
 * threading a prop there would pass a nudge flag through components that have
 * nothing to do with leaving. Provided read-only: the page shakes, the button
 * only renders it.
 */
export const LEAVE_SHAKE_KEY: InjectionKey<Readonly<Ref<boolean>>> = Symbol('leave-shake')
