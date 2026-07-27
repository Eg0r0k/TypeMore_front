/**
 * Scripted loopback bot — a full protocol client (LoopbackTransport → hello →
 * NTP → join → ready → race) used by the `/match` dev harness and Playwright
 * E2E via `window.__tmLoopback.addBot()`.
 *
 * The bot is honest about the wire contract: it synthesizes a human-cadence
 * log (`synthesizeBotLog`), waits for the shared `goAtServerMs` on its own NTP
 * offset, and streams the events through an `EventBatcher` — so the ≤100 ms /
 * ≤16-event batching rules and `batchSeq` continuity hold exactly as they do
 * for a real player. `wpm: 0` seats a spectator-like bot: it joins and
 * readies (so the host can start) but never types and never finishes.
 */
import {
  type CountdownFrame,
  type RoomStateFrame,
  EventBatcher,
  LoopbackServer,
  LoopbackTransport,
  sampleNtp
} from '@shared/match-transport'
import { type Dictionary, generateWords, makeSeedContext } from '@shared/core'

import { synthesizeBotLog } from './demo-feed'
import { isQuoteMatch, loadMatchDictionary, loadMatchQuote, matchGeneration } from './match-setup'

/** The word list a quote match never reads — its hash comes from the text. */
const EMPTY_DICTIONARY: Dictionary = { name: '', bcp47: '', words: [] }

export interface LoopbackBotOptions {
  /** Typing speed. Default 45. `0` ⇒ join + ready, never type, never finish. */
  readonly wpm?: number
  /** Cadence-jitter seed; defaults to the match seed (per-bot variety comes from the caller). */
  readonly seed?: number
  /** Dictionary source; defaults to the shared server-dictionary fetch. */
  readonly loadDictionary?: (lang: string) => Promise<Dictionary>
  /** How often due events are pushed into the batcher. Default 25 ms. */
  readonly pumpIntervalMs?: number
}

/**
 * Connect a bot to `server` and seat it in room `code`. Resolves once the bot
 * is seated (its first `room_state`); racing continues in the background for
 * every subsequent countdown (bots auto re-ready, so rematches work).
 */
export async function addLoopbackBot(
  server: LoopbackServer,
  code: string,
  options: LoopbackBotOptions = {}
): Promise<void> {
  const transport = new LoopbackTransport(server)
  await transport.connect()
  const ntp = await sampleNtp(transport)
  const batcher = new EventBatcher({ transport })
  const wpm = options.wpm ?? 45
  const loadDictionary = options.loadDictionary ?? loadMatchDictionary

  let seated: (() => void) | null = null
  const seatedPromise = new Promise<void>((resolve) => {
    seated = resolve
  })

  const onRoomState = (frame: RoomStateFrame): void => {
    const self = frame.players.find((player) => player.playerId === transport.playerId)
    if (self === undefined) return
    seated?.()
    seated = null
    // Auto-(re)ready: settings changes and match end reset the flag (§3/§6).
    if (!self.ready) transport.send({ type: 'ready' })
  }

  const race = async (countdown: CountdownFrame): Promise<void> => {
    // Same two text paths the real client takes: a quote match resolves its
    // bytes by id and never touches a dictionary. A bot typing a different text
    // than the seat beside it would not be an opponent.
    const quote = isQuoteMatch(countdown.settings)
      ? await loadMatchQuote(countdown.settings)
      : undefined
    const generation = matchGeneration(countdown.settings, quote)
    if (generation === null) return
    const dictionary = quote ? EMPTY_DICTIONARY : await loadDictionary(countdown.settings.lang)
    const generated = generateWords(
      dictionary,
      makeSeedContext(dictionary, countdown.seed, generation)
    )
    if (generated.isErr()) return
    const own = countdown.players.find((player) => player.playerId === transport.playerId)
    const log = synthesizeBotLog(generated.value.words, {
      wpm,
      seed: options.seed ?? countdown.seed,
      nospace: own?.freemods.nospace ?? false,
      maxDurationMs: countdown.settings.mode === 'time' ? countdown.settings.durationMs : undefined
    })

    const startDelay = Math.max(0, ntp.toLocalTime(countdown.goAtServerMs) - Date.now())
    setTimeout(() => {
      batcher.startMatch(countdown.matchId)
      const startedAt = Date.now()
      let cursor = 0
      const pump = setInterval(() => {
        const elapsed = Date.now() - startedAt
        while (cursor < log.length && log[cursor].t <= elapsed) {
          batcher.push(log[cursor])
          cursor += 1
        }
        if (cursor >= log.length) {
          clearInterval(pump)
          batcher.endMatch()
          try {
            transport.send({ type: 'finish', matchId: countdown.matchId })
          } catch {
            // Dropped mid-finish: the seat dnf's on grace expiry — acceptable for a bot.
          }
        }
      }, options.pumpIntervalMs ?? 25)
    }, startDelay)
  }

  transport.onEvent((event) => {
    if (event.type === 'room_state') onRoomState(event)
    else if (event.type === 'countdown' && wpm > 0) void race(event)
  })

  transport.send({ type: 'join_room', code })
  await seatedPromise
}
