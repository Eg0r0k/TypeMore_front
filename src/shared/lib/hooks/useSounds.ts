import { ref, Ref } from 'vue'
import { useSound } from '@vueuse/sound'
import { useConfigStore } from '@/entities/config/model/store'
import { RandomElementFromArray } from '../helpers/arrays'

interface SoundInstance {
  play: () => void
  stop: (id?: number) => void
  pause: (id?: number) => void
  isPlaying: boolean
  duration: number | null
}

function createSoundInstance(soundPath: string, volume: Ref<number>): SoundInstance {
  const sound = useSound(soundPath, { volume, interrupt: true })
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
    if (errorSound.value) {
      errorSound.value.play()
    }
  }

  const setClickSounds = (newClickSounds: string[]): void => {
    clickSounds.value = createSoundInstances(newClickSounds)
  }

  const playRandomClickSound = (): void => {
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
