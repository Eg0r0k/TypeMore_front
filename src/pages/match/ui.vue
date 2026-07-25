<template>
  <main class="match">
    <p v-if="session.phase === 'error'" class="match__error">{{ session.matchError?.message }}</p>
    <template v-else-if="session.phase === 'running' || session.phase === 'results'">
      <section class="match__local">
        <h2 class="match__label">you</h2>
        <Test
          :store="session.selfView"
          :is-right-to-left="isRightToLeft"
          :caret-style="config.caretStyle"
          :smooth-caret="config.smoothCaret"
        />
      </section>

      <section class="match__ghosts">
        <div
          v-for="peer in session.peers"
          :key="peer.playerId"
          class="match__ghost"
          :data-ghost="peer.playerId"
        >
          <header class="match__ghost-bar">
            <span class="match__ghost-name">{{ peer.nick }}</span>
            <span class="match__ghost-wpm">{{ Math.round(peer.metrics.wpm) }} wpm</span>
            <span class="match__ghost-progress">
              {{ peer.view.wordIndex }} / {{ peer.view.words.length }}
            </span>
            <span v-if="peer.status !== 'racing'" class="match__ghost-done">{{ peer.status }}</span>
          </header>
          <Test :store="peer.view" view-only :is-right-to-left="isRightToLeft" />
        </div>
      </section>

      <ol v-if="session.standings" class="match__standings">
        <li v-for="row in session.standings" :key="row.playerId">
          #{{ row.rank }} {{ row.nick }} — {{ row.status }}
          <template v-if="row.score !== undefined">, {{ row.score }} pts</template>
        </li>
      </ol>
    </template>
    <p v-else class="match__label">{{ session.phase }}…</p>
  </main>
</template>

<script lang="ts" setup>
  import { onUnmounted, onMounted, ref } from 'vue'
  import { useRoute } from 'vue-router'

  import { Test } from '@/widgets/test'
  import { addLoopbackBot, useMatchSessionStore } from '@entities/match'
  import { useConfigStore } from '@/entities/config/model/store'
  import { loadDictionaryBody } from '@shared/api'
  import { type Dictionary, dictVersion, mulberry32 } from '@shared/core'
  import { LoopbackServer, LoopbackTransport } from '@shared/match-transport'

  /**
   * DEV-ONLY match screen — the C1 harness: the real session store on a
   * LoopbackTransport, opponents are scripted protocol bots (join → ready →
   * countdown → batched event stream → finish). Not a product surface — the
   * S3 lobby/room flow is the real one; this page exists for the Playwright
   * perf gates (e2e/perf.spec.ts) and manual poking.
   *
   * Query knobs (unchanged from Phase B): ?words=10000&ghosts=4&botwpm=60&seed=42
   * botwpm=0 seats non-typing bots (static ghosts) so the local keystroke
   * budget can be measured without cross-instance update noise.
   */
  const session = useMatchSessionStore()
  const config = useConfigStore().config
  const route = useRoute()

  const isRightToLeft = ref(false)

  const intParam = (key: string, fallback: number): number => {
    const raw = Number.parseInt(String(route.query[key] ?? ''), 10)
    return Number.isFinite(raw) ? raw : fallback
  }

  let rafId = 0
  let alive = true

  const waitFor = (cond: () => boolean, timeoutMs = 15_000): Promise<void> =>
    new Promise((resolve, reject) => {
      const startedAt = Date.now()
      const poll = window.setInterval(() => {
        if (!alive || cond()) {
          window.clearInterval(poll)
          resolve()
        } else if (Date.now() - startedAt > timeoutMs) {
          window.clearInterval(poll)
          reject(new Error('match harness: timed out waiting for room state'))
        }
      }, 25)
    })

  onMounted(async () => {
    const wordCount = intParam('words', 100)
    const ghostCount = Math.min(4, Math.max(0, intParam('ghosts', 4)))
    const botWpm = intParam('botwpm', 45)
    const seed = intParam('seed', Math.floor(Math.random() * 0x1_0000_0000))

    const lang = await loadDictionaryBody(config.language)
    const dictionary: Dictionary = {
      name: lang.name,
      bcp47: lang.bcp47 ?? config.language,
      words: lang.words
    }
    isRightToLeft.value = lang.rightToleft === true
    const loadDictionary = async (): Promise<Dictionary> => dictionary

    // Short countdown + seeded randomness: deterministic words per ?seed and
    // fields that are typeable almost immediately (the perf gate types as soon
    // as the five hosts render).
    const server = new LoopbackServer({ countdownLeadMs: 300, random: mulberry32(seed) })
    await session.init(new LoopbackTransport(server), { loadDictionary })
    session.createRoom()
    await waitFor(() => session.room !== null)

    session.updateSettings({
      name: 'Match harness',
      visibility: 'private',
      mode: 'words',
      wordCount,
      lang: config.language,
      dictHash: dictVersion(dictionary.words),
      textMods: { punctuation: false, numbers: false, randomCase: false, reverse: false },
      textSource: { kind: 'seeded' }
    })

    for (let i = 0; i < ghostCount; i++) {
      // Staggered speeds like the Phase B bots; wpm 0 = seated, never types.
      void addLoopbackBot(server, session.room!.code, {
        wpm: botWpm > 0 ? botWpm + i * 10 : 0,
        seed: seed + i,
        loadDictionary
      })
    }
    if (ghostCount > 0) {
      await waitFor(() => {
        const players = session.room?.players ?? []
        return (
          players.length === ghostCount + 1 &&
          players.every((p) => p.ready || p.playerId === session.selfId)
        )
      })
      session.startMatch()
    }

    const frame = (): void => {
      session.advance() // smooth ghost display between the store's own ticks
      rafId = requestAnimationFrame(frame)
    }
    rafId = requestAnimationFrame(frame)
  })

  onUnmounted(() => {
    alive = false
    if (rafId) cancelAnimationFrame(rafId)
    session.dispose()
  })
</script>

<style lang="scss" scoped>
  // Throwaway dev layout — intentionally unstyled beyond basic structure.
  .match {
    display: flex;
    flex-direction: column;
    gap: 24px;
    width: 100%;
    max-width: 1100px;
    margin: 0 auto;
    padding: 16px;
  }

  .match__label {
    font-size: 14px;
    color: var(--sub-color);
  }

  .match__error {
    font-size: 14px;
    color: var(--error-color, #c44);
  }

  .match__ghosts {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .match__ghost-bar {
    display: flex;
    gap: 12px;
    font-size: 13px;
    color: var(--sub-color);
  }

  .match__ghost-done {
    color: var(--main-color);
  }

  .match__standings {
    font-size: 13px;
    color: var(--sub-color);
  }
</style>
