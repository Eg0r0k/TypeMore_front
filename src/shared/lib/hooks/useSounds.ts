import { computed, ref, Ref } from 'vue'
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
  const volume = computed(() => config.soundVolume)

  const clickSounds: Ref<SoundInstance[]> = ref(
    initialClickSounds.length > 0
      ? initialClickSounds.map((soundPath) => createSoundInstance(soundPath, volume))
      : []
  )
  const errorSound: Ref<SoundInstance | null> = ref(
    initialErrorSound ? createSoundInstance(initialErrorSound, volume) : null
  )

  const setVolume = (val: number): void => {
    config.soundVolume = val
  }

  const playErrorSound = (): void => {
    if (errorSound.value) {
      errorSound.value.play()
    }
  }

  const setClickSounds = (newClickSounds: string[]): void => {
    clickSounds.value = newClickSounds.map((soundPath) => createSoundInstance(soundPath, volume))
  }

  const playRandomClickSound = (): void => {
    if (clickSounds.value.length > 0) {
      const randomSound = RandomElementFromArray(clickSounds.value)
      if (randomSound) {
        randomSound.play()
      }
    }
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
