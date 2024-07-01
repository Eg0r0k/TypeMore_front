import { computed, ref } from 'vue'
import click1 from '/static/sounds/click/click1_1.wav'
import click2 from '/static/sounds/click/click1_2.wav'
import click3 from '/static/sounds/click/click1_3.wav'
import { useSound } from '@vueuse/sound'
import { useConfigStore } from '@/entities/config/model/store'
import { RandomElementFromArray } from '../helpers/arrays'
//TODO End this hook

export function useSounds() {
  const { config } = useConfigStore()
  const volume = computed(() => config.soundVolume)

  const clickSounds = [click1, click2, click3]
  const errorSounds = ref<string[]>([])

  const setVolume = (val: number): void => {
    config.soundVolume = val
  }
  const clickSoundInstances = clickSounds.map((sound) =>
    useSound(sound, { volume, interrupt: true })
  )
  const playClickSound = () => {
    if (!config.playSound || clickSounds.length === 0) return

    const randomInstance = RandomElementFromArray(clickSoundInstances)
    randomInstance.play()
  }

  const playErrorSound = () => {
    if (!config.playSound || errorSounds.value.length === 0) return
    const randomSound = RandomElementFromArray(errorSounds.value)
    const { play } = useSound(randomSound, { volume: volume.value, interrupt: true })
    play()
  }

  return {
    setVolume,
    playClickSound,
    playErrorSound
  }
}
