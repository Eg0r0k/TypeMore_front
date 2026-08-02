/**
 * Typing sound packs.
 *
 * A KEY pack is a set of interchangeable samples, one picked at random per
 * correct keystroke — that randomisation is the whole trick, because a single
 * sample repeated at typing speed stops sounding like a keyboard within a
 * second. An ERROR pack is the same thing for a wrong keystroke, chosen
 * separately: which keyboard you want to sound like and how loudly you want to
 * be told off are unrelated preferences.
 *
 * Samples live in `public/static/sounds/{keys,error}/<id>/N.wav` and are
 * referenced by runtime URL (same convention as languages and themes), so no
 * bundler asset import is needed. `config.soundSet` and `config.errorSoundSet`
 * store the active ids.
 *
 * PROVENANCE: the samples and their names come from monkeytype
 * (github.com/monkeytypegame/monkeytype, GPL-3.0) — see NOTICE.md at the repo
 * root. The folder-per-pack layout and the 1..N numbering are ours; upstream
 * keys them by number, which is why nothing here is called `click19`.
 */
export interface SoundPack {
  readonly id: string
  readonly label: string
  /** Sample count; the URLs are derived from it. */
  readonly samples: number
}

const keysUrl = (id: string, n: number): string => `/static/sounds/keys/${id}/${n}.wav`
const errorUrl = (id: string, n: number): string => `/static/sounds/error/${id}/${n}.wav`

/** Every sample in a pack, in order. */
export const samplesOf = (pack: SoundPack, kind: 'keys' | 'error'): string[] =>
  Array.from({ length: pack.samples }, (_, i) =>
    kind === 'keys' ? keysUrl(pack.id, i + 1) : errorUrl(pack.id, i + 1)
  )

const pack = (id: string, label: string, samples: number): SoundPack => ({ id, label, samples })

/**
 * Ordered so the plain ones come first and the twenty-odd list does not open on
 * a wall of switch names: the generic clicks, then the novelty samples, then the
 * keyboard recordings grouped by brand.
 */
export const SOUND_PACKS: readonly SoundPack[] = [
  pack('click', 'Click', 3),
  pack('beep', 'Beep', 3),
  pack('pop', 'Pop', 3),
  pack('typewriter', 'Typewriter', 6),
  pack('rubber-keys', 'Rubber keys', 5),
  pack('nk-creams', 'NK Creams', 6),
  pack('osu', 'Osu', 3),
  pack('hitmarker', 'Hitmarker', 3),
  pack('fist-fight', 'Fist fight', 8),
  pack('fart', 'Fart', 8),
  pack('akko-lavenders', 'Akko Lavenders', 10),
  pack('cherrymx-black-abs', 'Cherry MX Black · ABS', 10),
  pack('cherrymx-black-pbt', 'Cherry MX Black · PBT', 10),
  pack('cherrymx-blue-abs', 'Cherry MX Blue · ABS', 10),
  pack('cherrymx-blue-pbt', 'Cherry MX Blue · PBT', 10),
  pack('cherrymx-brown-pbt', 'Cherry MX Brown · PBT', 10),
  pack('kailh-box-white', 'Kailh Box White', 10),
  pack('razer-green', 'Razer Green', 10),
  pack('tealios-v2', 'Tealios V2', 10),
  pack('trust-gxt', 'Trust GXT', 10)
]

export const ERROR_SOUND_PACKS: readonly SoundPack[] = [
  pack('damage', 'Damage', 1),
  pack('triangle', 'Triangle', 1),
  pack('square', 'Square', 1),
  pack('missed-punch', 'Missed punch', 2)
]

/** Applied when config carries no (or an unknown) set. */
export const DEFAULT_SOUND_PACK = 'osu'
export const DEFAULT_ERROR_SOUND_PACK = 'damage'

/**
 * The four ids this app shipped before the packs were named after what they
 * actually are. A stored config keeps working and keeps the SAME sound — a
 * silent fallback to the default would swap the sound of everyone who had ever
 * chosen one, which is the one thing a rename must not do.
 */
const LEGACY_IDS: Readonly<Record<string, string>> = {
  click: 'click',
  click1: 'fist-fight',
  click2: 'beep',
  click3: 'osu'
}

/** Whether an id is one this app still answers to (current or legacy). */
export const isKnownSoundPack = (id: unknown): boolean =>
  typeof id === 'string' && (id in LEGACY_IDS || SOUND_PACKS.some((p) => p.id === id))

export const isKnownErrorSoundPack = (id: unknown): boolean =>
  typeof id === 'string' && ERROR_SOUND_PACKS.some((p) => p.id === id)

const resolve = (
  list: readonly SoundPack[],
  id: string,
  fallback: string
): SoundPack => list.find((p) => p.id === id) ?? list.find((p) => p.id === fallback) ?? list[0]

/** Resolve a key pack by id, following legacy ids; never returns undefined. */
export function getSoundPack(id: string): SoundPack {
  return resolve(SOUND_PACKS, LEGACY_IDS[id] ?? id, DEFAULT_SOUND_PACK)
}

/** Resolve an error pack by id; never returns undefined. */
export function getErrorSoundPack(id: string): SoundPack {
  return resolve(ERROR_SOUND_PACKS, id, DEFAULT_ERROR_SOUND_PACK)
}
