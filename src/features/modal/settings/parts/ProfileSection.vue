<template>
  <div class="settings-section">
    <div v-if="!authStore.isAuth" class="py-3" data-testid="settings-profile-signin">
      <Typography size="s" color="sub">{{ t('settings.account.signin') }}</Typography>
    </div>

    <template v-else>
      <!-- Bio ---------------------------------------------------------------->
      <div class="flex flex-col gap-1 py-2">
        <label class="text-sm text-sub" for="profile-bio">{{ t('settings.bio.label') }}</label>
        <TextInput
          id="profile-bio"
          v-model="draft.bio"
          tag-name="textarea"
          rows="3"
          :maxlength="BIO_MAX"
          :placeholder="t('settings.bio.placeholder')"
          data-testid="settings-bio"
        />
        <!-- The counter is the only feedback this field needs: the cap is
             enforced by maxlength, so it can never be exceeded, only
             approached. -->
        <Typography size="xs" color="sub" tag-name="p">
          {{ draft.bio.length }}/{{ BIO_MAX }} · {{ t('settings.bio.description') }}
        </Typography>
      </div>

      <!-- Keyboard ----------------------------------------------------------->
      <div class="flex flex-col gap-1 py-2">
        <label class="text-sm text-sub" for="profile-keyboard">
          {{ t('settings.keyboardName.label') }}
        </label>
        <TextInput
          id="profile-keyboard"
          v-model="draft.keyboard"
          :maxlength="KEYBOARD_MAX"
          :placeholder="t('settings.keyboardName.placeholder')"
          data-testid="settings-keyboard-name"
        />
      </div>

      <!-- Links -------------------------------------------------------------->
      <div class="flex flex-col gap-2 py-2">
        <Typography size="s" color="sub" tag-name="p">{{ t('settings.links.label') }}</Typography>
        <div v-for="kind in LINK_KINDS" :key="kind" class="flex flex-col gap-1">
          <label class="text-xs text-sub" :for="`profile-link-${kind}`">
            {{ t(`settings.links.${kind}`) }}
          </label>
          <!-- The prefix is rendered as a STATIC label, never as part of the
               value: it is the client's own allowlist, and showing it beside
               the input is what makes "we want a handle, not a link" obvious
               before somebody pastes a url the server will refuse. -->
          <div class="flex items-center gap-2">
            <span class="shrink-0 text-xs text-sub">{{ LINK_PREFIXES[kind] }}</span>
            <TextInput
              :id="`profile-link-${kind}`"
              v-model="draft.links[kind]"
              class="min-w-0 flex-1"
              :is-error="invalidLinks.has(kind)"
              :placeholder="t('settings.links.placeholder')"
              :data-testid="`settings-link-${kind}`"
            />
          </div>
          <Typography
            v-if="invalidLinks.has(kind)"
            size="xs"
            color="error"
            tag-name="p"
            :data-testid="`settings-link-${kind}-error`"
          >
            {{ t('settings.links.invalid') }}
          </Typography>
        </div>
      </div>

      <!-- Badge showcase ------------------------------------------------------>
      <!-- Rendered only when the account HOLDS something: an empty pool means
           nothing to arrange, and a "you have no badges" panel is a permanent
           reminder of an absence nobody can act on. -->
      <div v-if="pool.length" class="flex flex-col gap-2 py-2" data-testid="settings-badges">
        <Typography size="s" color="sub" tag-name="p">{{ t('settings.badges.label') }}</Typography>
        <Typography size="xs" color="sub" tag-name="p">
          {{ t('settings.badges.description') }}
        </Typography>

        <ul class="flex flex-col gap-1">
          <li
            v-for="(entry, index) in pool"
            :key="entry.code"
            class="flex items-center gap-2 rounded-md bg-sub-alt px-2 py-1.5"
            :data-testid="`settings-badge-${entry.code}`"
          >
            <Checkbox
              :model-value="entry.shown"
              :aria-label="entry.name"
              :data-testid="`settings-badge-toggle-${entry.code}`"
              @update:model-value="(value) => toggle(entry.code, value === true)"
            />
            <component :is="entry.icon" class="size-4 shrink-0" :class="entry.toneClass" />
            <span class="min-w-0 flex-1 truncate text-sm">{{ entry.name }}</span>
            <!-- Arrows rather than drag: the list is a handful of rows, the
                 keyboard reaches them for free, and a drag surface would need
                 a pointer to be usable at all. Only shown rows can move —
                 order is a property of the showcase, not of the pool. -->
            <template v-if="entry.shown">
              <Button
                color="shadow"
                size="icon-sm"
                :disabled="index === 0 || !canMoveUp(index)"
                :aria-label="t('settings.badges.moveUp')"
                :data-testid="`settings-badge-up-${entry.code}`"
                @click="move(entry.code, -1)"
              >
                <IconUp class="size-4" />
              </Button>
              <Button
                color="shadow"
                size="icon-sm"
                :disabled="!canMoveDown(index)"
                :aria-label="t('settings.badges.moveDown')"
                :data-testid="`settings-badge-down-${entry.code}`"
                @click="move(entry.code, 1)"
              >
                <IconDown class="size-4" />
              </Button>
            </template>
          </li>
        </ul>
      </div>

      <div class="flex items-center gap-3 py-2">
        <Button
          size="s"
          color="main-outline"
          :disabled="mutation.isPending.value || invalidLinks.size > 0"
          data-testid="settings-profile-save"
          @click="save"
        >
          {{ t('settings.profileSave') }}
        </Button>
        <Typography
          v-if="mutation.isError.value"
          size="xs"
          color="error"
          tag-name="p"
          data-testid="settings-profile-error"
        >
          {{ errorText }}
        </Typography>
        <Typography
          v-else-if="saved"
          size="xs"
          color="sub"
          tag-name="p"
          data-testid="settings-profile-saved"
        >
          {{ t('settings.profileSaved') }}
        </Typography>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { computed, onUnmounted, reactive, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import IconUp from '~icons/tabler/arrow-up'
  import IconDown from '~icons/tabler/arrow-down'

  import { useAuthStore } from '@/entities/auth'
  import { badgeOf } from '@/entities/badge'
  import {
    BIO_MAX,
    KEYBOARD_MAX,
    LINK_PATTERNS,
    LINK_PREFIXES,
    isApiError,
    useOwnProfileQuery,
    useUpdateProfileMutation,
    type LinkKind
  } from '@shared/api'
  import { Button } from '@/shared/ui/button'
  import { Checkbox } from '@/shared/ui/checkbox'
  import { TextInput } from '@/shared/ui/input'
  import { Typography } from '@/shared/ui/typography'

  /**
   * The profile editor: bio, board, links, badge showcase — one draft, one save.
   *
   * A DRAFT rather than per-field writes, because the server takes the whole
   * edit in one transaction and the four fields are one gesture. Saving each
   * keystroke would also mean a badge order that reorders itself under a slow
   * connection.
   *
   * Validation here is a COURTESY: the same handle grammars the server enforces
   * (`internal/profile/links.go`), duplicated so a bad handle gets a red border
   * instead of a round trip. Anything that gets past this still has to get past
   * the server, and a disagreement is a bug in this copy.
   */
  const { t } = useI18n()
  const authStore = useAuthStore()

  const LINK_KINDS: readonly LinkKind[] = ['github', 'youtube', 'twitch']

  const query = useOwnProfileQuery()
  const mutation = useUpdateProfileMutation()

  const draft = reactive({
    bio: '',
    keyboard: '',
    links: { github: '', youtube: '', twitch: '' } as Record<LinkKind, string>
  })

  /** Codes in showcase order, then the held-but-hidden ones. */
  const showcase = ref<string[]>([])
  const held = ref<string[]>([])

  // The server's answer is the source: every load and every save re-seeds the
  // draft from it, so the screen can never drift from what is stored.
  watch(
    () => query.data.value,
    (profile) => {
      if (!profile) return
      draft.bio = profile.bio ?? ''
      draft.keyboard = profile.keyboard ?? ''
      draft.links = { github: '', youtube: '', twitch: '' }
      for (const link of profile.links) draft.links[link.kind] = link.handle
      const shown = profile.badges
        .filter((b) => b.shown)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      showcase.value = shown.map((b) => b.code)
      held.value = profile.badges.map((b) => b.code)
    },
    { immediate: true }
  )

  /** The pool as rows: shown ones first in their order, then the rest. */
  const pool = computed(() => {
    const ordered = [...showcase.value, ...held.value.filter((c) => !showcase.value.includes(c))]
    return ordered.flatMap((code) => {
      const badge = badgeOf(code)
      // A grant this build cannot draw is dropped rather than shown as a blank
      // row — the same rule the public showcase follows.
      if (!badge) return []
      return [
        {
          code,
          name: badge.name,
          icon: badge.icon,
          toneClass: badge.tone === 'main' ? 'text-main' : 'text-sub',
          shown: showcase.value.includes(code)
        }
      ]
    })
  })

  const canMoveUp = (index: number): boolean => index > 0 && pool.value[index - 1]?.shown === true
  const canMoveDown = (index: number): boolean => pool.value[index + 1]?.shown === true

  const toggle = (code: string, value: boolean): void => {
    showcase.value = value
      ? [...showcase.value, code]
      : showcase.value.filter((c) => c !== code)
  }

  const move = (code: string, delta: number): void => {
    const from = showcase.value.indexOf(code)
    const to = from + delta
    if (from < 0 || to < 0 || to >= showcase.value.length) return
    const next = [...showcase.value]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    showcase.value = next
  }

  /** Which link fields a save would be refused for. Empty is always legal. */
  const invalidLinks = computed(() => {
    const bad = new Set<LinkKind>()
    for (const kind of LINK_KINDS) {
      const handle = draft.links[kind].trim()
      if (handle !== '' && !LINK_PATTERNS[kind].test(handle)) bad.add(kind)
    }
    return bad
  })

  const saved = ref(false)
  let savedTimer: ReturnType<typeof setTimeout> | undefined
  onUnmounted(() => clearTimeout(savedTimer))

  const errorText = computed(() => {
    const err = mutation.error.value
    if (err && isApiError(err) && err.message) return err.message
    return t('settings.account.error')
  })

  const save = (): void => {
    if (invalidLinks.value.size > 0) return
    mutation.mutate(
      {
        bio: draft.bio.trim(),
        keyboard: draft.keyboard.trim(),
        links: Object.fromEntries(
          LINK_KINDS.map((kind) => [kind, draft.links[kind].trim()])
        ) as Partial<Record<LinkKind, string>>,
        showcase: showcase.value
      },
      {
        onSuccess: () => {
          saved.value = true
          clearTimeout(savedTimer)
          savedTimer = setTimeout(() => (saved.value = false), 2000)
        }
      }
    )
  }
</script>
