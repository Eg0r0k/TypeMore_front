/**
 * Typing sound packs. Each pack is a set of interchangeable "click" samples
 * (one is picked at random per correct keystroke) plus a shared error sample
 * played on an incorrect keystroke.
 *
 * The samples live in `public/static/sounds/**` and are referenced by runtime
 * URL (same convention as languages/themes), so no bundler asset import is
 * needed. `config.soundSet` stores the active pack `id`.
 */
export interface SoundPack {
  id: string
  label: string
  click: readonly string[]
  error: string
}

const ERROR_SOUND = '/static/sounds/error/error1_1.wav'

export const SOUND_PACKS: readonly SoundPack[] = [
  {
    id: 'click',
    label: 'Click',
    click: [
      '/static/sounds/click/click1_1.wav',
      '/static/sounds/click/click1_2.wav',
      '/static/sounds/click/click1_3.wav'
    ],
    error: ERROR_SOUND
  },
  {
    id: 'click1',
    label: 'Typewriter',
    click: [
      '/static/sounds/click1/click14_1.wav',
      '/static/sounds/click1/click14_2.wav',
      '/static/sounds/click1/click14_3.wav',
      '/static/sounds/click1/click14_4.wav',
      '/static/sounds/click1/click14_5.wav',
      '/static/sounds/click1/click14_6.wav',
      '/static/sounds/click1/click14_7.wav',
      '/static/sounds/click1/click14_8.wav'
    ],
    error: ERROR_SOUND
  },
  {
    id: 'click2',
    label: 'Soft',
    click: [
      '/static/sounds/click2/click2_1.wav',
      '/static/sounds/click2/click2_2.wav',
      '/static/sounds/click2/click2_3.wav'
    ],
    error: ERROR_SOUND
  },
  {
    id: 'click3',
    label: 'Mechanical',
    click: [
      '/static/sounds/click3/click6_1.wav',
      '/static/sounds/click3/click6_2.wav',
      '/static/sounds/click3/click6_3.wav',
      '/static/sounds/click3/click6_11.wav',
      '/static/sounds/click3/click6_22.wav',
      '/static/sounds/click3/click6_33.wav'
    ],
    error: ERROR_SOUND
  }
]

/** Pack applied when config carries no (or an unknown) sound set. */
export const DEFAULT_SOUND_PACK = 'click3'

/** Resolve a pack by id, falling back to the default (never returns undefined). */
export function getSoundPack(id: string): SoundPack {
  return (
    SOUND_PACKS.find((pack) => pack.id === id) ??
    SOUND_PACKS.find((pack) => pack.id === DEFAULT_SOUND_PACK) ??
    SOUND_PACKS[0]
  )
}
