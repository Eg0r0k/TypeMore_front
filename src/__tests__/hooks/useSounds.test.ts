/**
 * Keystroke audio is a POOL of sample slots whose urls are swapped, not a set of
 * instances that is rebuilt per pack.
 *
 * That is not a style preference. `useSound` builds its Howl inside
 * `onMounted`, so an instance created after the component has mounted never
 * gets one and is mute forever — which is exactly what changing the pack used
 * to do. These tests pin the shape that cannot regress into it: a fixed number
 * of slots, created once, reacting to url refs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, unref, type Ref } from 'vue'

import { useSounds } from '@/shared/lib/hooks/useSounds'
import { useSound } from '@vueuse/sound'

/** Every url ref handed to `useSound`, in slot order. */
const urls: Ref<string>[] = []

vi.mock('@vueuse/sound', () => ({
  useSound: vi.fn((url: Ref<string>) => {
    urls.push(url)
    return {
      play: vi.fn(),
      stop: vi.fn(),
      pause: vi.fn(),
      isPlaying: ref(false),
      duration: ref(1000),
      sound: ref(null)
    }
  })
}))

const mockConfig = { soundVolume: 0.5, playSound: true }
vi.mock('@/entities/config', () => ({
  useConfigStore: vi.fn(() => ({ config: mockConfig }))
}))

const KEY_SLOTS = 10
const ERROR_SLOTS = 2

const keys = ['/k/1.wav', '/k/2.wav', '/k/3.wav']
const errors = ['/e/1.wav', '/e/2.wav']

/** The urls the key slots currently resolve to. */
const keyUrls = (): string[] => urls.slice(0, KEY_SLOTS).map((u) => unref(u))
const errorUrls = (): string[] => urls.slice(KEY_SLOTS).map((u) => unref(u))

beforeEach(() => {
  vi.clearAllMocks()
  urls.length = 0
  mockConfig.soundVolume = 0.5
  mockConfig.playSound = true
})

describe('useSounds', () => {
  it('creates one slot per possible sample, once', () => {
    useSounds(keys, errors)

    expect(vi.mocked(useSound)).toHaveBeenCalledTimes(KEY_SLOTS + ERROR_SLOTS)
    expect(vi.mocked(useSound).mock.calls[0]?.[1]).toMatchObject({ interrupt: true })
  })

  it('gives each slot the matching sample, and never an empty src', () => {
    useSounds(keys, errors)

    // The pack has three samples; the other seven slots hold the last real one
    // rather than '', which howler reports as a failed load.
    expect(keyUrls().slice(0, 3)).toEqual(keys)
    expect(new Set(keyUrls().slice(3))).toEqual(new Set(['/k/3.wav']))
    expect(errorUrls()).toEqual(errors)
    expect(keyUrls().every((u) => u !== '')).toBe(true)
  })

  it('switches packs by rewriting the urls, NOT by building more slots', () => {
    const sounds = useSounds(keys, errors)
    const built = vi.mocked(useSound).mock.calls.length

    sounds.setClickSounds(['/n/1.wav', '/n/2.wav'])
    sounds.setErrorSounds(['/n/e.wav'])

    expect(vi.mocked(useSound)).toHaveBeenCalledTimes(built)
    expect(keyUrls().slice(0, 2)).toEqual(['/n/1.wav', '/n/2.wav'])
    expect(new Set(keyUrls().slice(2))).toEqual(new Set(['/n/2.wav']))
    expect(new Set(errorUrls())).toEqual(new Set(['/n/e.wav']))
  })

  it('plays nothing at all while sound is off', () => {
    const sounds = useSounds(keys, errors)
    const plays = vi.mocked(useSound).mock.results.map((r) => r.value.play)

    mockConfig.playSound = false
    sounds.playRandomClickSound()
    sounds.playErrorSound()

    expect(plays.some((play) => play.mock.calls.length > 0)).toBe(false)
  })

  it('plays one sample of the pack — and only one', () => {
    const sounds = useSounds(keys, errors)
    const plays = vi.mocked(useSound).mock.results.map((r) => r.value.play)

    sounds.playRandomClickSound()

    const played = plays.filter((play) => play.mock.calls.length > 0)
    expect(played).toHaveLength(1)
    // Never a slot past the end of the pack: those hold a duplicate url, and
    // hitting them would skew the randomisation towards the last sample.
    expect(plays.slice(0, keys.length).some((play) => play.mock.calls.length > 0)).toBe(true)
  })

  it('survives a pack with no samples', () => {
    const sounds = useSounds([], [])

    expect(() => sounds.playRandomClickSound()).not.toThrow()
    expect(() => sounds.playErrorSound()).not.toThrow()
  })

  it('writes the volume through to the config', () => {
    const sounds = useSounds(keys, errors)

    sounds.setVolume(0.8)
    expect(mockConfig.soundVolume).toBe(0.8)

    // Out-of-range values are the caller's problem, not a crash here.
    expect(() => sounds.setVolume(-1)).not.toThrow()
    expect(() => sounds.setVolume(2)).not.toThrow()
  })
})
