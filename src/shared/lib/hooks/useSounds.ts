import { computed, ref, watch, type Ref } from 'vue'
import { useSound } from '@vueuse/sound'
import { useConfigStore } from '@/entities/config'

/**
 * Keystroke audio: a pool of sample slots whose URLs are swapped, never a pool
 * that is rebuilt.
 *
 * That distinction is the whole design. `useSound` builds its Howl inside
 * `onMounted`, so an instance created AFTER the component has mounted never
 * gets one and is silently mute forever — which is what the previous version
 * did on every pack change, and why changing the pack used to need a remount to
 * take effect. Here every slot is created once during setup with a reactive
 * url, and switching packs writes the urls: `useSound`'s own watcher rebuilds
 * the Howl, and howler's global cache means a sample decoded once is not
 * decoded again.
 *
 * The pools are sized to the largest pack (see `sound-packs.ts`). A slot past
 * the end of the current pack is never played AND never left with an empty
 * `src`, which howler treats as a load failure.
 */
const KEY_SLOTS = 10
const ERROR_SLOTS = 2

export function useSounds(clickPaths: readonly string[], errorPaths: readonly string[]) {
  const { config } = useConfigStore()
  const volume = ref(config.soundVolume)
  // Keep the howler volume (watched by @vueuse/sound via unref) in sync with the
  // persisted config, so the settings slider applies live to loaded samples.
  watch(
    () => config.soundVolume,
    (next) => {
      volume.value = next
    }
  )

  const clickUrls = ref<string[]>([...clickPaths])
  const errorUrls = ref<string[]>([...errorPaths])

  const pool = (urls: Ref<string[]>, slots: number) =>
    Array.from({ length: slots }, (_, index) =>
      useSound(
        computed(() => urls.value[index] ?? urls.value[urls.value.length - 1] ?? ''),
        // @vueuse/sound's ComposableOptions collides `volume` with Howl's
        // `volume: number`, yielding an impossible `MaybeRef<number> & number`.
        // unref() handles the Ref at runtime.
        { volume: volume as unknown as number, interrupt: true }
      )
    )

  const clicks = pool(clickUrls, KEY_SLOTS)
  const errors = pool(errorUrls, ERROR_SLOTS)

  /** Plays one of the pack's samples at random — a repeated sample stops sounding like a key. */
  const playFrom = (slots: ReturnType<typeof pool>, urls: Ref<string[]>): void => {
    const available = Math.min(urls.value.length, slots.length)
    if (available <= 0) return
    slots[Math.floor(Math.random() * available)]?.play()
  }

  const setVolume = (value: number): void => {
    config.soundVolume = value
    volume.value = value
  }

  const setClickSounds = (paths: readonly string[]): void => {
    clickUrls.value = [...paths]
  }

  const setErrorSounds = (paths: readonly string[]): void => {
    errorUrls.value = [...paths]
  }

  const playRandomClickSound = (): void => {
    if (!config.playSound) return
    playFrom(clicks, clickUrls)
  }

  const playErrorSound = (): void => {
    if (!config.playSound) return
    playFrom(errors, errorUrls)
  }

  return {
    setVolume,
    setClickSounds,
    setErrorSounds,
    playRandomClickSound,
    playErrorSound
  }
}
