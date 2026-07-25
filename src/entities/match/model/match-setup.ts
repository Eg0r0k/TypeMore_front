/**
 * Countdown → GameSetup mapping — the server-authoritative match setup path
 * (PROTOCOL.md §4 `countdown`, MATCH.md §2/§5).
 *
 * Pure helpers shared by the session store and the loopback bots:
 * - room `settings` (shared map: mode, dims, textMods) → `GenerationConfig`;
 * - a seat's frozen `freemods` → that player's `CoreConfig` (per-player rules);
 * - the scoring generation strips text mods: per MATCH.md §3 only log-provable
 *   freemods multiply the match score — the shared text mods define the map,
 *   identical for everyone, so they are never a per-player multiplier.
 *
 * The dictionary is fetched by `settings.lang`; the caller verifies its FNV-1a
 * content hash (`dictVersion`) against `settings.dictHash` — a mismatch is
 * REPORTED, never silently adapted.
 */
import type { CoreConfig, Dictionary, GenerationConfig } from '@shared/core'
import { DEFAULT_MAX_EXTRA_CHARS } from '@shared/core'
import type { Freemods, RoomSettings } from '@shared/match-transport'
import { loadDictionaryBody } from '@shared/api'

/**
 * Default dictionary loader: the same server-served, hash-addressed dictionary
 * fetch the solo path uses (catalogue → `/static/dictionaries/<hash>.json`).
 * Tests inject a stub instead.
 */
export async function loadMatchDictionary(lang: string): Promise<Dictionary> {
  const language = await loadDictionaryBody(lang)
  return { name: language.name, bcp47: language.bcp47 ?? lang, words: language.words }
}

/**
 * Shared-map generation config from the frozen room settings. Returns `null`
 * when the settings violate the protocol shape for their mode (`time` without
 * `durationMs` / `words` without `wordCount`) — the caller reports, never guesses.
 */
export function matchGeneration(settings: RoomSettings): GenerationConfig | null {
  if (settings.mode === 'time' && settings.durationMs === undefined) return null
  if (settings.mode === 'words' && settings.wordCount === undefined) return null
  return {
    mode: settings.mode,
    // `length` is seconds for time mode, target word count otherwise.
    length:
      settings.mode === 'time'
        ? Math.round((settings.durationMs as number) / 1000)
        : (settings.wordCount as number),
    punctuation: settings.textMods.punctuation,
    numbers: settings.textMods.numbers,
    randomCase: settings.textMods.randomCase,
    reverse: settings.textMods.reverse
  }
}

/**
 * One player's reducer config: shared mode/dims + that seat's frozen freemods.
 * `startPolicy: 'go'` is what makes a match a match — every core (local and
 * ghost) is live from `t = 0`, the server's go instant, so the clock, the
 * deadline and the MinSpeed floor never wait for a keystroke.
 */
export function freemodsConfig(settings: RoomSettings, freemods: Freemods): CoreConfig {
  return {
    mode: settings.mode,
    durationMs: settings.mode === 'time' ? (settings.durationMs ?? 0) : 0,
    maxExtraChars: DEFAULT_MAX_EXTRA_CHARS,
    difficulty: freemods.difficulty,
    nospace: freemods.nospace,
    minWpm: freemods.minWpm,
    startPolicy: 'go'
  }
}

/**
 * The generation config the match SCORE reads (MATCH.md §3): text-mod flags
 * zeroed so `modMultiplierV1` derives multipliers from freemods alone.
 */
export function scoringGeneration(generation: GenerationConfig): GenerationConfig {
  return { ...generation, punctuation: false, numbers: false, randomCase: false, reverse: false }
}
