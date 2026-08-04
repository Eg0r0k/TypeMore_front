import { readonly, ref, type Ref } from 'vue'
import { useMediaQuery } from '@vueuse/core'

/**
 * The "the way out is HERE" nudge: a short shake on the control the user
 * should have used.
 *
 * The animation itself is the `animate-shake` utility (app/tailwind.css); this
 * hook owns the one hard part — RE-triggering it. A CSS animation replays only
 * when the class goes away and comes back, so a second attempt while the first
 * shake is still running would do nothing at all, which is exactly the moment
 * the user is most likely to try again. `shake()` therefore drops the class,
 * waits one frame for the browser to notice, and puts it back.
 *
 * Under `prefers-reduced-motion: reduce` it is a no-op: the caller is expected
 * to say the same thing in words too (a toast), so nothing is lost.
 *
 * ```vue
 * const { shaking, shake } = useShake()
 * <Button :class="{ 'animate-shake': shaking }" @click="leave" />
 * ```
 */
export interface UseShake {
  /** Bind to `animate-shake` on the element to nudge. */
  readonly shaking: Readonly<Ref<boolean>>
  /** Play the shake, restarting it if one is already running. */
  readonly shake: () => void
}

export function useShake(durationMs = 400): UseShake {
  const shaking = ref(false)
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  let timer: ReturnType<typeof setTimeout> | undefined

  const shake = (): void => {
    if (reduced.value) return
    clearTimeout(timer)
    shaking.value = false
    // One frame with the class off is what makes the keyframe restart. rAF
    // rather than a microtask: the class must be OFF in a painted frame, and
    // a microtask would coalesce into the same one.
    requestAnimationFrame(() => {
      shaking.value = true
      timer = setTimeout(() => (shaking.value = false), durationMs)
    })
  }

  return { shaking: readonly(shaking), shake }
}
