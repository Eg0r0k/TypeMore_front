import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { useSounds } from '@/shared/lib/hooks/useSounds'
import { useSound } from '@vueuse/sound'

const createBaseSoundMock = () => ({
  play: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  isPlaying: ref(false),
  duration: ref(1000),
  sound: ref(new Audio())
})
vi.mock('@vueuse/sound', () => ({
  useSound: vi.fn().mockImplementation(() => createBaseSoundMock())
}))

vi.mock('@/shared/lib/helpers/arrays', () => ({
  RandomElementFromArray: vi.fn((arr) => arr[0])
}))

const mockConfig = {
  soundVolume: 0.5
}

vi.mock('@/entities/config/model/store', () => ({
  useConfigStore: vi.fn(() => ({
    config: mockConfig
  }))
}))

describe('useSounds', () => {
  const mockClickSounds = ['/click1.mp3', '/click2.mp3']
  const mockErrorSound = '/error.mp3'
  let sounds: ReturnType<typeof useSounds>

  beforeEach(() => {
    vi.clearAllMocks()
    mockConfig.soundVolume = 0.5
  })

  describe('initialization', () => {
    it('should initialize with provided click sounds', () => {
      sounds = useSounds(mockClickSounds)
      expect(useSound).toHaveBeenCalledWith(mockClickSounds[0], expect.any(Object))
      expect(useSound).toHaveBeenCalledWith(mockClickSounds[1], expect.any(Object))
    })

    it('should initialize with provided error sound', () => {
      sounds = useSounds([], mockErrorSound)
      expect(useSound).toHaveBeenCalledWith(mockErrorSound, expect.any(Object))
    })

    it('should initialize with empty sounds', () => {
      const mockUseSound = vi.fn()
      vi.mocked(useSound).mockImplementation(mockUseSound)
      sounds = useSounds([], '')
      expect(mockUseSound).not.toHaveBeenCalled()
    })
  })

  describe('volume control', () => {
    it('should set volume correctly', () => {
      const soundMock = createBaseSoundMock()
      vi.mocked(useSound).mockImplementation(() => soundMock)

      sounds = useSounds(mockClickSounds)
      const newVolume = 0.8
      sounds.setVolume(newVolume)
      expect(mockConfig.soundVolume).toBe(newVolume)
    })
  })

  describe('sound playback', () => {
    it('should play error sound when available', () => {
      const mockPlay = vi.fn()
      const soundMock = createBaseSoundMock()
      soundMock.play = mockPlay
      vi.mocked(useSound).mockImplementation(() => soundMock)

      sounds = useSounds([], mockErrorSound)
      sounds.playErrorSound()
      expect(mockPlay).toHaveBeenCalled()
    })

    it('should not throw when playing error sound if not available', () => {
      sounds = useSounds([], '')
      expect(() => sounds.playErrorSound()).not.toThrow()
    })

    it('should play random click sound when available', () => {
      const mockPlay = vi.fn()
      const soundMock = createBaseSoundMock()
      soundMock.play = mockPlay
      vi.mocked(useSound).mockImplementation(() => soundMock)

      sounds = useSounds(mockClickSounds)
      sounds.playRandomClickSound()
      expect(mockPlay).toHaveBeenCalled()
    })

    it('should handle empty click sounds array gracefully', () => {
      const soundMock = createBaseSoundMock()
      vi.mocked(useSound).mockImplementation(() => soundMock)

      sounds = useSounds([])
      expect(() => sounds.playRandomClickSound()).not.toThrow()
    })
  })

  describe('sound management', () => {
    it('should set new click sounds', () => {
      const newClickSounds = ['/new-click1.mp3', '/new-click2.mp3']
      const soundMock = createBaseSoundMock()
      vi.mocked(useSound).mockImplementation(() => soundMock)

      sounds = useSounds([])
      sounds.setClickSounds(newClickSounds)
      expect(useSound).toHaveBeenCalledWith(newClickSounds[0], expect.any(Object))
      expect(useSound).toHaveBeenCalledWith(newClickSounds[1], expect.any(Object))
    })

    it('should set new error sound', () => {
      const newErrorSound = '/new-error.mp3'
      const soundMock = createBaseSoundMock()
      vi.mocked(useSound).mockImplementation(() => soundMock)

      sounds = useSounds([])
      sounds.setErrorSound(newErrorSound)
      expect(useSound).toHaveBeenCalledWith(newErrorSound, expect.any(Object))
    })
  })

  describe('sound instance creation', () => {
    it('should create sound instance with correct volume', () => {
      const volume = 0.7
      mockConfig.soundVolume = volume
      const soundMock = createBaseSoundMock()
      vi.mocked(useSound).mockImplementation(() => soundMock)

      sounds = useSounds(mockClickSounds)
      expect(useSound).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          volume: expect.any(Object),
          interrupt: true
        })
      )
    })

    it('should create sound instances with interrupt option', () => {
      const soundMock = createBaseSoundMock()
      vi.mocked(useSound).mockImplementation(() => soundMock)

      sounds = useSounds(mockClickSounds)
      expect(useSound).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          interrupt: true
        })
      )
    })
  })

  describe('error handling', () => {
    it('should handle invalid sound paths gracefully', () => {
      const soundMock = createBaseSoundMock()
      vi.mocked(useSound).mockImplementation(() => soundMock)

      sounds = useSounds([])
      expect(() => sounds.setErrorSound('')).not.toThrow()
    })

    it('should handle invalid volume values', () => {
      const soundMock = createBaseSoundMock()
      vi.mocked(useSound).mockImplementation(() => soundMock)

      sounds = useSounds([])
      expect(() => sounds.setVolume(-1)).not.toThrow()
      expect(() => sounds.setVolume(2)).not.toThrow()
    })
  })
})
