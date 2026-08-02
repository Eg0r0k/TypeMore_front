import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useScreenStore = defineStore('screen', () => {
  // App-level loading (theme bootstrap); moved off the old game store.
  const isLoading = ref(true)
  const setLoading = (value: boolean): void => {
    isLoading.value = value
  }
  /**
   * A run is under way on whichever surface is showing one.
   *
   * The app SHELL needs this — the header chrome and the footer step out of the
   * way while you type, and the pointer is hidden over the words — and the shell
   * is not the page: it renders outside the router view and cannot reach into a
   * page's game store to ask.
   *
   * Deliberately NOT a mirror of `game.phase`. This is not the game's state, it
   * is a statement about what the screen is for right now: a solo test, a match
   * and (later) a replay-along all answer it the same way and none of them share
   * a store. The surface that owns the run sets it; anything that has to get out
   * of the way reads it.
   */
  const isTyping = ref(false)

  /**
   * Written on the NEXT frame, deliberately.
   *
   * Everything downstream of this flag is decoration — two subtrees fading and
   * an inherited `cursor` — and every one of those is a style invalidation. The
   * flag flips on the keystroke that STARTS a run, which is the one frame that
   * also has to lay out the first typed character; doing both put the keystroke
   * budget over 16ms (`e2e/perf.spec.ts`). A frame of delay is invisible against
   * a 200ms fade, and it is scheduled here rather than at each call site so no
   * future typing surface has to remember it.
   */
  let pending = 0
  const setTyping = (value: boolean): void => {
    if (typeof requestAnimationFrame !== 'function') {
      isTyping.value = value
      return
    }
    if (pending !== 0) cancelAnimationFrame(pending)
    pending = requestAnimationFrame(() => {
      pending = 0
      isTyping.value = value
    })
  }

  return { isLoading, setLoading, isTyping, setTyping }
})
