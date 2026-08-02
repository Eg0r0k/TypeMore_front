<template>
  <div class="emoji-picker" role="group" :aria-label="t('room.chat.emojiPicker')">
    <InputGroup class="emoji-picker__search">
      <InputGroupAddon align="inline-start">
        <IconSearch aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        v-model="query"
        :placeholder="t('room.chat.emojiSearch')"
        :aria-label="t('room.chat.emojiSearch')"
        data-testid="emoji-search"
        @keydown.escape.stop="query = ''"
      />
      <InputGroupAddon v-if="query" align="inline-end">
        <InputGroupButton :aria-label="t('room.chat.emojiClear')" @click="query = ''">
          <IconClear aria-hidden="true" />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>

    <!--
      Virtualised only when there is something to virtualise. The virtualizer
      brings a measuring pass, two ResizeObservers and the custom scrollbar with
      it, and on a phone all of that landed in the same frame as the tray's
      slide-in — which is what made opening it stutter. A grid that already fits
      on screen has nothing to gain from it.
    -->
    <VirtualScrollable
      v-if="overflows"
      class="emoji-picker__list"
      :items="rows"
      :estimate-size="ROW_HEIGHT"
      :style="{ height: `${listHeight}px` }"
    >
      <template #default="{ item: row }">
        <div class="emoji-picker__row">
          <EmojiCell
            v-for="emoji in row"
            :key="emoji.value"
            :emoji="emoji"
            :broken="broken.has(emoji.value)"
            @select="emit('select', emoji)"
            @broken="broken.add(emoji.value)"
          />
        </div>
      </template>
    </VirtualScrollable>

    <div v-else-if="rows.length > 0" class="emoji-picker__grid">
      <div v-for="(row, index) in rows" :key="index" class="emoji-picker__row">
        <EmojiCell
          v-for="emoji in row"
          :key="emoji.value"
          :emoji="emoji"
          :broken="broken.has(emoji.value)"
          @select="emit('select', emoji)"
          @broken="broken.add(emoji.value)"
        />
      </div>
    </div>

    <p v-else class="emoji-picker__empty">{{ t('room.chat.emojiEmpty') }}</p>
  </div>
</template>

<script setup lang="ts">
  import { computed, reactive, ref } from 'vue'
  import { useI18n } from 'vue-i18n'

  import { emojis, searchEmojis, type Emoji } from '@/shared/lib/helpers/emoji'
  import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput
  } from '@/shared/ui/input-group'
  import { VirtualScrollable } from '@/shared/ui/virtualScrollable'
  import IconSearch from '~icons/tabler/search'
  import IconClear from '~icons/tabler/x'

  import EmojiCell from './emoji-cell.vue'

  /**
   * The emoji picker: a search box over the shipped set, and a grid.
   *
   * The set itself lives in `shared/lib/helpers/emoji.ts` and is edited there —
   * it is shipped, not per-user, because a `:token:` only means anything if the
   * client READING the message has the same list, and chat travels as text.
   *
   * `columns` is a prop rather than a constant: the same component is a popover
   * on a desktop and a full-width tray on a phone, and a tray six cells wide
   * with the rest empty would waste the row it was given.
   */
  const { t } = useI18n()

  const props = withDefaults(defineProps<{ columns?: number }>(), { columns: 6 })
  const emit = defineEmits<{ select: [Emoji] }>()

  /** Cell 2.25rem, gap 0.375rem, at 16px root — the grid's geometry in pixels. */
  const CELL = 36
  const GAP = 6
  const ROW_HEIGHT = CELL + GAP
  /** Rows before the grid stops growing and starts scrolling. */
  const MAX_ROWS = 5

  const query = ref('')
  const matches = computed(() => searchEmojis(emojis, query.value))

  const rows = computed<Emoji[][]>(() => {
    const chunks: Emoji[][] = []
    for (let index = 0; index < matches.value.length; index += props.columns) {
      chunks.push(matches.value.slice(index, index + props.columns))
    }
    return chunks
  })

  /**
   * Sized to what it holds, up to a cap. A fixed height opens a box of mostly
   * nothing for a small set, and searching down to two results should not leave
   * four empty rows under them.
   */
  const listHeight = computed(() => Math.min(rows.value.length, MAX_ROWS) * ROW_HEIGHT)

  /** Whether the grid is taller than the cap — the only case worth virtualising. */
  const overflows = computed(() => rows.value.length > MAX_ROWS)

  /** Icons whose remote image failed; they render as their name instead. */
  const broken = reactive(new Set<string>())
</script>

<style lang="scss" scoped>
  .emoji-picker {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    max-width: 100%;

    &__row {
      display: flex;
      gap: 0.375rem;
      padding-bottom: 0.375rem;
    }

    &__grid {
      display: flex;
      flex-direction: column;
    }

    &__empty {
      width: 100%;
      padding: 1rem 0;
      font-size: 0.8125rem;
      color: var(--sub-color);
      text-align: center;
    }

    // Compound with the component's own class to outweigh its
    // `.scrollable-direction-y { height: 100% }` rule; the height is bound
    // inline from the grid's geometry.
    &__list.scrollable-wrapper {
      width: 100%;
    }
  }
</style>
