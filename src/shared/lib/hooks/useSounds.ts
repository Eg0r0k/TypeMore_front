import { ref, watch, type Ref } from 'vue'
import { useSound } from '@vueuse/sound'
import { useConfigStore } from '@/entities/config'
import { RandomElementFromArray } from '../helpers/arrays'

interface SoundInstance {
  play: () => void
  stop: (id?: number) => void
  pause: (id?: number) => void
  isPlaying: boolean
  duration: number | null
}

function createSoundInstance(soundPath: string, volume: Ref<number>): SoundInstance {
  // @vueuse/sound's ComposableOptions collides `volume` with Howl's `volume: number`,
  // yielding an impossible `MaybeRef<number> & number` type. unref() handles the Ref at runtime.
  const sound = useSound(soundPath, { volume: volume as unknown as number, interrupt: true })
  return {
    play: sound.play,
    stop: sound.stop,
    pause: sound.pause,
    isPlaying: sound.isPlaying.value,
    duration: sound.duration.value
  }
}

export function useSounds(initialClickSounds: string[] = [], initialErrorSound: string = '') {
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

  const createSoundInstances = (soundPaths: string[]) =>
    soundPaths.map((soundPath) => createSoundInstance(soundPath, volume))

  const clickSounds: Ref<SoundInstance[]> = ref(createSoundInstances(initialClickSounds))
  const errorSound: Ref<SoundInstance | null> = ref(
    initialErrorSound ? createSoundInstance(initialErrorSound, volume) : null
  )

  const setVolume = (val: number): void => {
    config.soundVolume = val
    volume.value = val
  }

  const playErrorSound = (): void => {
    if (errorSound.value && config.playSound) {
      errorSound.value.play()
    }
  }

  const setClickSounds = (newClickSounds: string[]): void => {
    clickSounds.value = createSoundInstances(newClickSounds)
  }

  const playRandomClickSound = (): void => {
    if (!config.playSound) return
    const randomSound = RandomElementFromArray(clickSounds.value)
    randomSound?.play()
  }

  const setErrorSound = (newErrorSound: string): void => {
    errorSound.value = createSoundInstance(newErrorSound, volume)
  }

  return {
    setVolume,
    playRandomClickSound,
    playErrorSound,
    setClickSounds,
    setErrorSound
  }
}
