<template>
  <div class="room-match flex h-full justify-center">
    <TestProgress
      :running="session.phase === 'running'"
      :duration-ms="timeDurationMs ?? undefined"
      :value="timeDurationMs === null ? wordProgress : undefined"
    />
    <div
      v-if="session.phase === 'countdown' && countdownLabel"
      class="room-match__countdown"
      role="timer"
      aria-live="assertive"
    >
      <span class="room-match__countdown-number">{{ countdownLabel }}</span>
    </div>
    <div
      v-if="session.phase === 'waiting'"
      class="room-match__waiting"
      data-testid="match-waiting-banner"
      role="status"
    >
      <span class="room-match__waiting-title">{{ t('room.match.waiting.title') }}</span>
      <span class="room-match__waiting-count">
        {{ t('room.match.waiting.racing', { count: racingCount }) }}
      </span>
    </div>
    <div
      v-if="session.phase === 'eliminated' && session.selfOutcome"
      class="room-match__eliminated"
      data-testid="match-eliminated-panel"
      role="status"
    >
      <span class="room-match__eliminated-title">{{ t('room.match.eliminated.title') }}</span>
      <span class="room-match__eliminated-reason">{{ eliminatedReason }}</span>
      <span
        v-if="eliminatedStats.length"
        class="room-match__eliminated-stats"
        data-testid="match-eliminated-stats"
      >
        <span v-for="stat in eliminatedStats" :key="stat.label" class="room-match__eliminated-stat">
          <span class="room-match__eliminated-stat-label">{{ stat.label }}</span>
          {{ stat.value }}
        </span>
      </span>
      <span class="room-match__eliminated-waiting">
        {{ t('room.match.eliminated.waiting') }} ·
        {{ t('room.match.waiting.racing', { count: racingCount }) }}
      </span>
    </div>
    <section class="room-match__field">
      <!--
        The same live scoring HUD the solo stage shows, fed by the local run
        (which is a full game store under the match's scoring generation).
        Absolute like the idle meter so its appearance on "go" never reflows
        the words; hidden in blind mode by the same rule as solo — the combo
        leaks per-keystroke correctness.
      -->
      <div
        v-show="session.phase === 'running' && !config.blind"
        class="room-match__hud"
        aria-hidden="true"
      >
        <ScoreHud v-bind="session.selfHud" />
      </div>
      <!--
        The idle meter (streak/mirror progress, session.judgeIdle) — top-left
        corner ABOVE the field, absolute so its appearance never reflows the
        words. The label says only "idle": no kick threat on screen, the bar
        filling is the whole message. Deliberately NOT called "afk" — the
        results screen's afkShare is a different, post-hoc judging metric, and
        one word for two numbers would read as a bug.
      -->
      <div
        v-if="session.phase === 'running' && session.afkProgress >= IDLE_METER_SHOW"
        class="room-match__idle"
        role="status"
        data-testid="idle-kick-meter"
      >
        <span class="room-match__idle-label">{{ t('room.match.idle.label') }}</span>
        <span class="room-match__idle-bar" aria-hidden="true">
          <span
            class="room-match__idle-fill"
            :style="{ width: `${Math.round(session.afkProgress * 100)}%` }"
          ></span>
        </span>
      </div>
      <!--
        The personal visual mods travel with the player, not with the room.
        PROTOCOL.md §5 keeps blind/fading/flashlight off the wire because they
        leave no trace in the event log and so cannot be scored — that is why
        they are not freemods, NOT a reason to withhold them from the player who
        turned them on. `blind` already reached the field through `selfView`;
        fading and flashlight are CSS mods carried as props, and were simply
        never passed here. All three are self-handicaps: they hide information,
        so there is nothing to guard against.
      -->
      <Test
        v-if="session.selfView"
        :store="session.selfView"
        :ghosts="ghosts"
        :fading="config.fading"
        :flashlight="config.flashlight"
        :caret-style="config.caretStyle"
        :smooth-caret="config.smoothCaret"
      />
    </section>
    <!-- <OpponentsRail :peers="railPeers" class="room-match__rail" /> -->
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import type { PeerRailEntry } from '@/entities/lobby'
  import { useMatchSessionStore } from '@/entities/match'
  import { useConfigStore } from '@/entities/config/model/store'
  import { TestProgress } from '@/features/test/progress'
  import { ScoreHud } from '@/features/test/score-hud'
  import { Test, type TestGhostCaret } from '@/widgets/test'
  import OpponentsRail from './opponents-rail.vue'

  /**
   * The live match surface, laid out like the solo test: the time-mode drain
   * bar on top and the local GameField centered at full width. Opponents race
   * INSIDE the local field as ghost carets (racing "ghost cars" — sub-colored
   * bars with the nick above), while the rail carries nick + live wpm + status
   * badges. During `countdown` the 3-2-1-go overlay renders
   * `ceil(countdownMsLeft / 1000)` off the NTP-scheduled go instant.
   */
  const { t } = useI18n()
  const session = useMatchSessionStore()
  const config = useConfigStore().config

  /** The meter surfaces halfway to the kick (≈6 s of silence). */
  const IDLE_METER_SHOW = 0.5

  const countdownLabel = computed(() => {
    const msLeft = session.countdownMsLeft
    if (msLeft === null) return ''
    if (msLeft <= 0) return t('room.match.go')
    return String(Math.ceil(msLeft / 1000))
  })

  /** Frozen match duration for the top drain bar; null outside time mode. */
  const timeDurationMs = computed(() => {
    const settings = session.room?.settings
    if (settings === undefined || settings.mode !== 'time') return null
    return settings.durationMs ?? null
  })

  /** The counted arm of the same bar: the local seat's share of the words. */
  const wordProgress = computed(() => {
    const view = session.selfView
    const total = view?.words.length ?? 0
    return total > 0 ? Math.min(1, view.wordIndex / total) : 0
  })

  const railPeers = computed<PeerRailEntry[]>(() =>
    session.peers.map((peer: PeerRailEntry) => ({
      playerId: peer.playerId,
      nick: peer.nick,
      metrics: peer.metrics,
      status: peer.status,
      failReason: peer.failReason
    }))
  )

  /**
   * Ghost carets for peers still racing — a finished/dropped peer's story is told
   * by its rail badge. The anchor comes from the session store (`peer.caret`),
   * never from the peer's raw input: over-typed extras occupy no target position,
   * so measuring the typed string would drift a ghost past where it really is.
   */
  const ghosts = computed<TestGhostCaret[]>(() =>
    session.peers
      .filter((peer) => peer.status === 'racing')
      .map((peer) => ({
        id: peer.playerId,
        label: peer.nick,
        wordIndex: peer.caret.wordIndex,
        charIndex: peer.caret.charIndex
      }))
  )

  /**
   * Why the local run ended. Freemod reasons come from replaying the log; the
   * wire only ever says "finished". `reload` is the odd one out — it is not a
   * rule at all but the forfeit we send when a page reload leaves a stale
   * racing seat behind and the log that could have finished it is gone.
   */
  const eliminatedReason = computed(() => {
    const outcome = session.selfOutcome
    if (outcome === null) return ''
    return t(`room.match.eliminated.reason.${outcome.reason}`)
  })

  /**
   * The local player's own numbers, frozen at the elimination instant. Labelled
   * pairs, not a bare joined string: three raw percentages in a row read as
   * noise, and the score is absent for an empty run.
   *
   * A reload forfeit has no numbers at all — the event log died with the page,
   * so every value is zero. A row of hard zeros reads as a catastrophically bad
   * run rather than as "there is nothing to report", so the whole line is
   * dropped and the reason carries the story.
   */
  const eliminatedStats = computed<{ label: string; value: string }[]>(() => {
    const outcome = session.selfOutcome
    if (outcome === null) return []
    if (outcome.wpm === 0 && outcome.acc === 0 && outcome.progress === 0 && !outcome.score) {
      return []
    }
    const stats = [
      { label: 'wpm', value: String(Math.round(outcome.wpm)) },
      { label: 'acc', value: `${Math.round(outcome.acc * 100)}%` },
      {
        label: t('room.match.eliminated.progress'),
        value: `${Math.round(outcome.progress * 100)}%`
      }
    ]
    if (outcome.score !== null) {
      stats.push({ label: t('room.results.score'), value: String(Math.round(outcome.score)) })
    }
    return stats
  })

  /** Δ3 waiting banner: non-terminal seats (a graced disconnect is still racing server-side). */
  const racingCount = computed(
    () =>
      session.peers.filter((peer) => peer.status === 'racing' || peer.status === 'disconnected')
        .length
  )
</script>

<style lang="scss" scoped>
  .room-match {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 100%;
    gap: 2rem;

    &__countdown {
      position: absolute;
      inset: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }

    &__countdown-number {
      font-size: 6rem;
      color: var(--main-color);
      text-shadow: 0 0 1.5rem var(--bg-color);
    }

    &__idle {
      position: absolute;
      top: -1.75rem;
      left: 0;
      z-index: 10;
      display: flex;
      gap: 0.5rem;
      align-items: center;
      pointer-events: none;
    }

    &__idle-label {
      font-size: 0.85rem;
      color: var(--sub-color);
    }

    &__idle-bar {
      display: inline-block;
      width: 6rem;
      height: 0.35rem;
      overflow: hidden;
      background: var(--sub-alt-color);
      border-radius: var(--border-radius);
    }

    &__idle-fill {
      display: block;
      height: 100%;
      background: var(--error-color);
      transition: width var(--transition-duration) linear;
    }

    &__waiting {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      text-align: center;
    }

    &__waiting-title {
      font-size: 1.1rem;
      color: var(--main-color);
    }

    &__waiting-count {
      font-size: 0.9rem;
      color: var(--sub-color);
    }

    &__eliminated {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      text-align: center;
    }

    &__eliminated-title {
      font-size: 1.1rem;
      color: var(--error-color);
    }

    &__eliminated-reason {
      font-size: 0.9rem;
      color: var(--text-color);
    }

    &__eliminated-stats {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.75rem;
      font-size: 0.9rem;
      color: var(--text-color);
    }

    &__eliminated-stat-label {
      margin-right: 0.25rem;
      color: var(--sub-color);
    }

    &__eliminated-waiting {
      font-size: 0.9rem;
      color: var(--sub-color);
    }

    &__field {
      position: relative;
      min-width: 0;
    }

    &__hud {
      position: absolute;
      right: 0;
      bottom: calc(100% + 1rem);
      left: 0;
      z-index: 5;
      display: flex;
      justify-content: center;
      pointer-events: none;
    }
  }
</style>
