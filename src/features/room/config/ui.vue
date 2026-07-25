<template>
  <div v-if="room" class="config">
    <div class="config__settings">
      <!-- Host between matches: live editor. Everyone else: read-only view. -->
      <div v-if="session.isHost" class="config__editor">
        <div class="config__field">
          <Typography size="xs" color="sub">{{ t('room.name') }}</Typography>
          <TextInput
            v-model="localName"
            v-max-chars="32"
            :placeholder="t('room.name')"
            @keydown.enter="commitName"
            @blur="commitName"
          />
        </div>

        <div class="config__field">
          <Typography size="xs" color="sub">{{ t('room.visibility') }}</Typography>
          <ToggleGroup
            :model-value="settings.visibility"
            aria-label="visibility"
            @update:model-value="onVisibility"
          >
            <ToggleGroupItem v-for="vis in VISIBILITIES" :key="vis" :value="vis">
              {{ t(`room.visibilityKind.${vis}`) }}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div class="config__field">
          <Typography size="xs" color="sub">{{ t('room.mode') }}</Typography>
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
            class="config__lang bg-sub-alt border border-sub rounded-md transition-tm focus-ring flex h-9 w-full cursor-pointer items-center px-3 text-sm text-text"
            @click="languageOpen = true"
          >
            <span class="truncate">{{ settings.lang }}</span>
          </button>
          <LanguageModal
            v-model:open="languageOpen"
            :model-value="settings.lang"
            @update:model-value="onLanguage"
          />
        </div>

        <div class="config__field">
          <Typography size="xs" color="sub">{{ t('room.textMods') }}</Typography>
          <ToggleGroup
            type="multiple"
            :model-value="activeTextMods"
            aria-label="text mods"
            @update:model-value="onTextMods"
          >
            <ToggleGroupItem v-for="mod in TEXT_MOD_KEYS" :key="mod" :value="mod">
              {{ t(`game.${mod}`) }}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <dl v-else class="config__summary">
        <div class="config__row">
          <dt>{{ t('room.name') }}</dt>
          <dd>{{ settings.name }}</dd>
        </div>
        <div class="config__row">
          <dt>{{ t('room.visibility') }}</dt>
          <dd>{{ t(`room.visibilityKind.${settings.visibility}`) }}</dd>
        </div>
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
          <dd>{{ settings.lang }}</dd>
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
      <div class="config__field">
        <Toggle
          size="sm"
          :pressed="myFreemods.nospace"
          aria-label="nospace"
          @update:pressed="onNospace"
        >
          {{ t('game.nospace') }}
        </Toggle>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import type { Freemods, RoomPlayer, RoomSettings } from '@/entities/lobby'
  import { useConfigStore } from '@/entities/config/model/store'
  import { useMatchSessionStore } from '@/entities/match'
  import { loadDictionaryBody } from '@shared/api'
  import { TextInput } from '@/shared/ui/input'
  import { Toggle } from '@/shared/ui/toggle'
  import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
  import { LanguageModal } from '@/features/modal/language'
  import { Typography } from '@/shared/ui/typography'
  import { dictVersion } from '@shared/core'

  /**
   * Room settings (host-only, §5 `settings_update` — the server resets every
   * ready flag on apply) plus the seat's own freemods (`set_freemods`). Both
   * are lobby-phase-only by construction: this panel is not rendered during
   * countdown/running. Changing the language recomputes `dictHash` locally
   * (FNV-1a via core's `dictVersion`) so every client verifies the same
   * dictionary fingerprint.
   */
  const VISIBILITIES = ['open', 'private'] as const
  const MODES = ['time', 'words'] as const
  const DURATIONS_MS = [15000, 30000, 60000, 120000] as const
  const WORD_COUNTS = [10, 25, 50, 100] as const
  const DIFFICULTIES = ['normal', 'expert', 'master'] as const
  const MIN_WPMS = [0, 60, 80, 100] as const
  const TEXT_MOD_KEYS = ['punctuation', 'numbers', 'randomCase', 'reverse'] as const

  const { t } = useI18n()
  const session = useMatchSessionStore()
  const room = computed(() => session.room)

  const FALLBACK_SETTINGS: RoomSettings = {
    name: '',
    visibility: 'private',
    mode: 'time',
    durationMs: 30000,
    lang: 'english',
    dictHash: '',
    textMods: { punctuation: false, numbers: false, randomCase: false, reverse: false },
    textSource: { kind: 'seeded' }
  }
  const settings = computed<RoomSettings>(() => room.value?.settings ?? FALLBACK_SETTINGS)

  const apply = (patch: Partial<RoomSettings>) => {
    const next: RoomSettings = { ...settings.value, ...patch }
    // `durationMs` / `wordCount` are mode-conditional on the wire (§5): send
    // only the active one.
    if (next.mode === 'time') {
      next.durationMs = next.durationMs ?? 30000
      delete next.wordCount
    } else {
      next.wordCount = next.wordCount ?? 25
      delete next.durationMs
    }
    session.updateSettings(next)
  }

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

  // Room name commits on blur/enter, not per keystroke.
  const localName = ref(settings.value.name)
  watch(
    () => settings.value.name,
    (name) => (localName.value = name)
  )
  const commitName = () => {
    const name = localName.value.trim()
    if (!name || name === settings.value.name) return
    apply({ name })
  }

  const onVisibility = (value: unknown) => {
    if (value === 'open' || value === 'private') apply({ visibility: value })
  }
  const onMode = (value: unknown) => {
    if (value === 'time' || value === 'words') apply({ mode: value })
  }
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
    const dictionary = await loadDictionaryBody(lang)
    apply({ lang, dictHash: dictVersion(dictionary.words) })
  }

  const activeTextMods = computed(() => TEXT_MOD_KEYS.filter((key) => settings.value.textMods[key]))
  const onTextMods = (value: unknown) => {
    const active = new Set(Array.isArray(value) ? (value as string[]) : [])
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
  const onNospace = (pressed: boolean) => setFreemods({ nospace: pressed })
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
