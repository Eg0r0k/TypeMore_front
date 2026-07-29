<template>
  <div v-if="room" class="config">
    <div class="config__settings">
      <div v-if="session.isHost" class="config__editor">
        <div class="config__field">
          <Typography size="xs" color="sub" class="flex items-center gap-1.5">
            {{ t('room.mode') }}
            <!-- A quote draw is a network round-trip: while it flies, the mode
                 toggles LOOK dead (the patch only lands with the drawn id) —
                 the spinner is that state made visible. -->
            <IconLoader v-if="quoteBusy" class="animate-spin size-3" data-testid="quote-loader" />
          </Typography>
          <ToggleGroup :model-value="settings.mode" aria-label="mode" @update:model-value="onMode">
            <ToggleGroupItem v-for="m in MODES" :key="m" :value="m">
              {{ t(`game.mode.${m}`) }}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div v-if="settings.mode === 'time'" class="config__field">
          <Typography size="xs" color="sub">{{ t('room.duration') }}</Typography>
          <ToggleGroup
            :model-value="String(settings.durationMs ?? '')"
            aria-label="duration"
            @update:model-value="onDuration"
          >
            <ToggleGroupItem v-for="ms in DURATIONS_MS" :key="ms" :value="String(ms)">
              {{ ms / 1000 }}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <!--
          Quote: the band is a filter on the DRAW, not a wire field. Picking one
          redraws immediately, so the room always advertises a quote that exists
          and every seat can resolve by id.
        -->
        <div v-else-if="settings.mode === 'quote'" class="config__field">
          <Typography size="xs" color="sub">{{ t('game.quote.length') }}</Typography>
          <ToggleGroup
            :model-value="quoteGroup"
            aria-label="quote length"
            @update:model-value="onQuoteGroup"
          >
            <ToggleGroupItem v-for="band in QUOTE_GROUPS" :key="band" :value="band">
              {{ t(`game.quote.group.${band}`) }}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div v-else class="config__field">
          <Typography size="xs" color="sub">{{ t('room.wordCount') }}</Typography>
          <ToggleGroup
            :model-value="String(settings.wordCount ?? '')"
            aria-label="word count"
            @update:model-value="onWordCount"
          >
            <ToggleGroupItem v-for="count in WORD_COUNTS" :key="count" :value="String(count)">
              {{ count }}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div class="config__field">
          <Typography size="xs" color="sub">{{ t('game.language') }}</Typography>
          <button
            type="button"
            class="config__lang bg-sub-alt border border-sub rounded-md transition-tm focus-ring flex py-2 w-full cursor-pointer items-center px-3 text-sm text-text"
            @click="languageOpen = true"
          >
            <span class="truncate">{{ languageName(settings.lang) }}</span>
          </button>
          <LanguageModal
            v-model:open="languageOpen"
            :model-value="settings.lang"
            @update:model-value="onLanguage"
          />
        </div>

        <!--
          The same component, the same glyphs and the same group label the solo
          bar uses. That is the point of it living in `entities/game`: a mod a
          player learned on the home page is the same picture here, and it is so
          by construction rather than by two templates agreeing.
        -->
        <ModGroup
          :options="TEXT_MOD_OPTIONS"
          :active="activeTextMods"
          :label="t('game.slot.generation')"
          group-aria-label="text mods"
          @update:active="onTextMods"
        />
      </div>

      <dl v-else class="config__summary">
        <div class="config__row">
          <dt>{{ t('room.mode') }}</dt>
          <dd>
            {{ t(`game.mode.${settings.mode}`) }} ·
            {{
              settings.mode === 'time'
                ? `${(settings.durationMs ?? 0) / 1000}s`
                : settings.wordCount
            }}
          </dd>
        </div>
        <div class="config__row">
          <dt>{{ t('game.language') }}</dt>
          <dd>{{ languageName(settings.lang) }}</dd>
        </div>
        <div v-if="activeTextMods.length" class="config__row">
          <dt>{{ t('room.textMods') }}</dt>
          <dd>{{ activeTextMods.map((mod) => t(`game.${mod}`)).join(', ') }}</dd>
        </div>
      </dl>
    </div>

    <!-- Own freemods: any seat, between matches (this panel only renders in the lobby phase). -->
    <div class="config__freemods">
      <Typography color="sub" class="config__label">{{ t('room.yourMods') }}</Typography>
      <div class="config__field">
        <Typography size="xs" color="sub">{{ t('game.difficulty.label') }}</Typography>
        <ToggleGroup
          :model-value="myFreemods.difficulty"
          aria-label="difficulty"
          @update:model-value="onDifficulty"
        >
          <ToggleGroupItem v-for="d in DIFFICULTIES" :key="d" :value="d">
            {{ t(`game.difficulty.${d}`) }}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div class="config__field">
        <Typography size="xs" color="sub">{{ t('game.minSpeed') }}</Typography>
        <ToggleGroup
          :model-value="String(myFreemods.minWpm)"
          aria-label="min speed"
          @update:model-value="onMinWpm"
        >
          <ToggleGroupItem v-for="wpm in MIN_WPMS" :key="wpm" :value="String(wpm)">
            {{ wpm === 0 ? t('game.minSpeedOff') : wpm }}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <ModGroup
        :options="NOSPACE_OPTIONS"
        :active="activeFreemodFlags"
        :label="t('game.slot.core')"
        group-aria-label="nospace"
        @update:active="onNospaceKeys"
      />

      <!--
        Visual mods. Local to this player and NOT on the wire: they leave no
        trace in the event log, so they cannot be scored — which is why they are
        not freemods (PROTOCOL.md §5) and why nothing needs to guard them. They
        are self-handicaps: they hide information from the person who turned
        them on. The field already applied them in a match; only the switch was
        missing, so it lived on the home page and nowhere a player in a room
        could reach it.
      -->
      <ModGroup
        :options="VIEW_MODS"
        :active="activeViewMods"
        :label="t('game.slot.view')"
        group-aria-label="view mods"
        @update:active="onViewMods"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import type { Freemods, RoomPlayer, RoomSettings } from '@/entities/lobby'
  import { useConfigStore } from '@/entities/config/model/store'
  import { ModGroup, optionOf, optionsFor, valuesFor } from '@/entities/game'
  import { isApiError, loadDictionaryBody, loadRandomQuote, quoteCorpusLang } from '@shared/api'
  import type { QuoteGroup } from '@/shared/constants/type'
  import { useLanguageNames } from '@/shared/lib/hooks/useLanguageNames'
  import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
  import { LanguageModal } from '@/features/modal/language'
  import { toast } from '@/shared/ui/sonner'
  import { Typography } from '@/shared/ui/typography'
  import { dictVersion } from '@shared/core'
  import IconLoader from '~icons/tabler/loader-2'

  import { useRoomSettings } from './model/use-room-settings'

  /**
   * Room settings (host-only, §5 `settings_update` — the server resets every
   * ready flag on apply) plus the seat's own freemods (`set_freemods`). Both
   * are lobby-phase-only by construction: this panel is not rendered during
   * countdown/running. Changing the language recomputes `dictHash` locally
   * (FNV-1a via core's `dictVersion`) so every client verifies the same
   * dictionary fingerprint.
   */
  const MODES = valuesFor(optionOf('mode'), 'roomSettings')
  const DURATIONS_MS = [15000, 30000, 60000, 120000] as const
  const WORD_COUNTS = [10, 25, 50, 100] as const
  const QUOTE_GROUPS = valuesFor(optionOf('quoteGroup'), 'roomSettings')
  const DIFFICULTIES = ['normal', 'expert', 'master'] as const
  const MIN_WPMS = [0, 60, 80, 100] as const

  /**
   * The shared text mods, from the registry rather than from a list retyped
   * here — the same four the solo bar shows, in the same order, with the same
   * glyphs. The wire shape (`textMods` as four named booleans, §5) is still the
   * protocol's and is assembled in `onTextMods`; the registry only says which
   * options this surface may edit.
   */
  const TEXT_MOD_OPTIONS = optionsFor('roomSettings').filter((o) => o.control.kind === 'boolean')
  const TEXT_MOD_KEYS = TEXT_MOD_OPTIONS.map((o) => o.key)
  /** `nospace` is a freemod and travels per seat; it is grouped as a RULE, not as text. */
  const NOSPACE_OPTIONS = [optionOf('nospace')]

  const { t } = useI18n()
  // `lang` is the key the room settings travel as; the catalogue owns its name.
  const { languageName } = useLanguageNames()
  const { session, room, settings, apply } = useRoomSettings()

  // Host bootstrap: a fresh `create_room` arrives with server placeholder
  // settings (lang/dictHash the client may not have). The creating host —
  // alone in the room, lobby phase — replaces them with its local config
  // language and the locally computed FNV-1a fingerprint, so the advertised
  // dictionary is always verifiable by every joiner. Never runs on a
  // transferred host (seat count > 1) — that would stomp the room's settings.
  const configStore = useConfigStore()
  const bootstrappedRoom = ref<string | null>(null)
  watch(
    [() => room.value?.code, () => session.isHost],
    async ([code, isHost]) => {
      if (!code || !isHost || room.value?.players.length !== 1) return
      if (bootstrappedRoom.value === code) return
      bootstrappedRoom.value = code
      const current = settings.value
      try {
        const dict = await loadDictionaryBody(current.lang)
        const hash = dictVersion(dict.words)
        if (hash !== current.dictHash) apply({ dictHash: hash })
      } catch {
        // Advertised dictionary is not locally loadable — fall back to the
        // player's own language.
        const lang = configStore.config.language
        const dict = await loadDictionaryBody(lang)
        apply({ lang, dictHash: dictVersion(dict.words) })
      }
    },
    { immediate: true }
  )

  const onMode = (value: unknown) => {
    if (typeof value !== 'string' || !MODES.includes(value)) return
    if (quoteBusy.value) return
    if (value === 'quote') {
      void drawQuote(quoteGroup.value)
      return
    }
    // Leaving quote mode has to bring a dictionary back: entering it blanked
    // `dictHash` (a quote has nothing to fingerprint), and the server rejects
    // seeded settings without one — a bare mode patch would be silently
    // dropped and the room would stay in quote mode for good.
    if (settings.value.mode === 'quote') {
      void leaveQuote(value as RoomSettings['mode'])
      return
    }
    apply({ mode: value as RoomSettings['mode'] })
  }

  const leaveQuote = async (mode: RoomSettings['mode']): Promise<void> => {
    quoteBusy.value = true
    try {
      const dictionary = await loadDictionaryBody(settings.value.lang)
      apply({ mode, dictHash: dictVersion(dictionary.words) })
    } catch {
      // The advertised lang has no word list (a quote-only corpus) — fall back
      // to the player's own language, the same way the host bootstrap does.
      try {
        const lang = configStore.config.language
        const dictionary = await loadDictionaryBody(lang)
        apply({ mode, lang, dictHash: dictVersion(dictionary.words) })
      } catch {
        toast.error(t('game.setup.dictionaryError', { lang: settings.value.lang }))
      }
    } finally {
      quoteBusy.value = false
    }
  }

  // ── Quote mode ────────────────────────────────────────────────────────────
  /**
   * The room races ONE published quote, and the host is who draws it: the id is
   * what travels (PROTOCOL.md §5), never the bytes, so every seat resolves the
   * same immutable text from `/quotes/{id}` — no seed, no dictionary, no hash.
   *
   * `wordCount` goes along as the drawn text's length. It is not a target the
   * run reads; the server uses it for the counted-mode duration ceiling, which
   * otherwise has nothing to scale by.
   */
  const quoteGroup = ref<QuoteGroup>('all')
  /**
   * A draw in flight. Every quote interaction is a network round-trip whose
   * only visible effect is the settings patch at the end — without this flag
   * the panel simply looks dead for its duration (and a second click starts a
   * second draw). The spinner renders it; the handlers early-return on it.
   */
  const quoteBusy = ref(false)

  const drawQuote = async (group: QuoteGroup): Promise<void> => {
    quoteBusy.value = true
    try {
      const quote = await loadRandomQuote({
        // A size variant is not a language: the corpus publishes `russian` once.
        lang: quoteCorpusLang(settings.value.lang),
        // `all` is the absence of a filter, not a sixth band.
        group: group === 'all' ? undefined : group
      })
      quoteGroup.value = group
      apply({
        mode: 'quote',
        wordCount: quote.text.split(/\s+/).filter(Boolean).length,
        // A quote carries no dictionary to fingerprint — quote-only languages
        // have none at all.
        dictHash: '',
        textSource: { kind: 'quote', quoteId: quote.id }
      })
    } catch (error) {
      // A toast (sonner — the app's ONE toast system), not an inline note:
      // the draw is triggered from
      // OUTSIDE quote mode too (the mode toggle), where the quote panel — and
      // any inline error in it — is not rendered at all. Failing there looked
      // like a dead button.
      toast.warning(
        isApiError(error) && error.status === 404
          ? t('game.setup.quoteEmpty', {
              lang: quoteCorpusLang(settings.value.lang),
              group: t(`game.quote.group.${group}`)
            })
          : t('game.setup.quoteError')
      )
    } finally {
      quoteBusy.value = false
    }
  }

  const onQuoteGroup = (value: unknown) => {
    if (quoteBusy.value) return
    if (typeof value === 'string') void drawQuote(value as QuoteGroup)
  }

  /**
   * A fresh run deserves a fresh quote. This panel exists only in the lobby
   * phase, so mounting it with quote mode already on means the room just came
   * back from a match (or the host just arrived) — either way the room should
   * not race yesterday's text again unless chance deals it twice. The band
   * filter is component state and resets to `all` with the panel.
   */
  onMounted(() => {
    if (session.isHost && settings.value.mode === 'quote') void drawQuote(quoteGroup.value)
  })
  const onDuration = (value: unknown) => {
    const ms = Number(value)
    if (Number.isFinite(ms) && ms > 0) apply({ durationMs: ms })
  }
  const onWordCount = (value: unknown) => {
    const count = Number(value)
    if (Number.isFinite(count) && count > 0) apply({ wordCount: count })
  }

  const languageOpen = ref(false)
  const onLanguage = async (lang: string) => {
    if (lang === settings.value.lang) return
    if (quoteBusy.value) return
    // In quote mode the language IS the corpus: a new one means a new draw, and
    // there is no dictionary to fingerprint on this path at all.
    if (settings.value.mode === 'quote') {
      apply({ lang })
      await drawQuote(quoteGroup.value)
      return
    }
    const dictionary = await loadDictionaryBody(lang)
    apply({ lang, dictHash: dictVersion(dictionary.words) })
  }

  const activeTextMods = computed(() =>
    TEXT_MOD_KEYS.filter((key) => settings.value.textMods[key as keyof RoomSettings['textMods']])
  )
  const onTextMods = (keys: readonly string[]) => {
    const active = new Set(keys)
    apply({
      textMods: {
        punctuation: active.has('punctuation'),
        numbers: active.has('numbers'),
        randomCase: active.has('randomCase'),
        reverse: active.has('reverse')
      }
    })
  }

  // ── Own freemods ──────────────────────────────────────────────────────────
  const DEFAULT_FREEMODS: Freemods = { difficulty: 'normal', minWpm: 0, nospace: false }
  const myFreemods = computed<Freemods>(
    () =>
      room.value?.players.find((player: RoomPlayer) => player.playerId === session.selfId)
        ?.freemods ?? DEFAULT_FREEMODS
  )
  const setFreemods = (patch: Partial<Freemods>) => {
    session.setFreemods({ ...myFreemods.value, ...patch })
  }
  const onDifficulty = (value: unknown) => {
    if (value === 'normal' || value === 'expert' || value === 'master') {
      setFreemods({ difficulty: value })
    }
  }
  const onMinWpm = (value: unknown) => {
    const wpm = Number(value)
    if (wpm === 0 || wpm === 60 || wpm === 80 || wpm === 100) setFreemods({ minWpm: wpm })
  }
  /** `nospace` as a one-key group, so it wears the same control as every other mod. */
  const activeFreemodFlags = computed(() => (myFreemods.value.nospace ? ['nospace'] : []))
  const onNospaceKeys = (keys: readonly string[]) =>
    setFreemods({ nospace: keys.includes('nospace') })

  // ── Own visual mods (local; never sent) ───────────────────────────────────
  /** The `Config` fields this group writes — every boolean one. */
  type BooleanConfigKey = {
    [K in keyof typeof configStore.config]: (typeof configStore.config)[K] extends boolean
      ? K
      : never
  }[keyof typeof configStore.config]

  const VIEW_MODS = optionsFor('roomLocal')
  const activeViewMods = computed(() =>
    VIEW_MODS.filter((mod) => configStore.config[mod.key] === true).map((mod) => mod.key)
  )
  const onViewMods = (keys: readonly string[]) => {
    const active = new Set(keys)
    for (const mod of VIEW_MODS) {
      configStore.config[mod.key as BooleanConfigKey] = active.has(mod.key)
    }
  }
</script>

<style lang="scss" scoped>
  .config {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;

    &__settings,
    &__freemods {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      min-width: 16rem;
      flex: 1;
    }

    &__editor {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    &__field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      align-items: flex-start;
    }

    &__lang {
      max-width: 12rem;
    }

    &__summary {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      margin: 0;
    }

    &__row {
      display: flex;
      gap: 0.5rem;

      dt {
        color: var(--sub-color);
      }

      dd {
        margin: 0;
        color: var(--text-color);
      }
    }
  }
</style>
