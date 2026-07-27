<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="flex h-full max-h-[70vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[700px]"
      :show-close-button="false"
      v-bind="description ? {} : { 'aria-describedby': 'undefined' }"
    >
      <DialogTitle class="sr-only">{{ title }}</DialogTitle>
      <DialogDescription v-if="description" class="sr-only">{{ description }}</DialogDescription>

      <div
        class="console-modal"
        @keydown.tab.prevent="navigateItems(1)"
        @keydown.down.prevent="navigateItems(1)"
        @keydown.up.prevent="navigateItems(-1)"
        @keydown.enter.prevent="selectFocusedItem"
      >
        <div class="console-modal__header">
          <SearchBar v-model="searchQuery" :placeholder="searchPlaceholder ?? t('picker.search')" />
        </div>

        <VirtualScrollable
          ref="itemsList"
          role="listbox"
          :aria-label="title"
          :aria-multiselectable="multiple"
          class="console-modal__scroll"
          :items="filteredItems"
          :estimate-size="ITEM_HEIGHT"
          :get-item-key="keyAt"
        >
          <template #default="{ item, index }">
            <div
              :data-index="index"
              role="option"
              :aria-selected="isSelected(item)"
              :aria-setsize="filteredItems.length"
              :aria-posinset="index + 1"
              class="console-modal__item"
              :class="{
                'console-modal__item--active': isSelected(item),
                'console-modal__item--focused': index === focusedItemIndex
              }"
              @click="selectItem(item)"
            >
              <slot
                name="item"
                :item="item"
                :index="index"
                :selected="isSelected(item)"
                :focused="index === focusedItemIndex"
              >
                <Typography color="primary">{{ labelOf(item) }}</Typography>
              </slot>

              <Check
                v-if="multiple"
                class="console-modal__check"
                :class="{ 'console-modal__check--on': isSelected(item) }"
              />
            </div>
          </template>

          <template #empty>
            <Typography class="console-modal__empty" color="sub">
              {{ t('picker.empty') }}
            </Typography>
          </template>
        </VirtualScrollable>

        <div v-if="multiple" class="console-modal__footer">
          <Typography size="xs" color="sub">
            {{ t('picker.selected', { count: selectedValues.length }) }}
          </Typography>
          <Button size="s" @click="open = false">{{ t('picker.done') }}</Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts" generic="T extends string | Record<string, unknown>">
  import { computed, nextTick, ref, watch } from 'vue'
  import { Check } from '@lucide/vue'
  import { useI18n } from 'vue-i18n'

  import { Button } from '@/shared/ui/button'
  import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
  import { SearchBar } from '@/shared/ui/search'
  import { Typography } from '@/shared/ui/typography'
  import { VirtualScrollable } from '@/shared/ui/virtualScrollable'

  /**
   * Searchable console-style picker (the themes/language modal): a dialog with a
   * search bar on top and a scrollable option list below.
   *
   * Selection is a plain `v-model` over the item *values* — a single string in
   * single mode, a string array when `multiple`. Items may be strings or objects;
   * `searchKey` names the label field, `valueKey` the identity one (defaults to
   * `searchKey`), and `searchKeys` adds further fields the query matches against
   * — a language is findable by its name AND by the key it is stored under.
   * Custom rows go through the `#item` slot; the option wrapper (role,
   * aria-selected, focus/active state, click) is ours.
   *
   * The list is VIRTUALISED, because both of its real callers outgrew a plain
   * `v-for`: the language picker is 430 rows and the board picker is one row per
   * (mode, size, language) plus one per quote, which the corpus puts in the
   * thousands. Only the visible window is in the DOM, so an option a keyboard
   * cursor lands on may not be mounted — hence `scrollToIndex` on the
   * virtualizer rather than `scrollIntoView` on a node that might not exist, and
   * `aria-setsize` / `aria-posinset` on every option so a screen reader (and a
   * test) is told how long the list really is instead of counting what is
   * currently rendered.
   */
  interface Props {
    items?: T[]
    /** Object field used for search and for the default label. */
    searchKey?: string
    /** Extra object fields the search matches, beyond `searchKey`. */
    searchKeys?: readonly string[]
    /** Object field used as the model value. Defaults to `searchKey`. */
    valueKey?: string
    multiple?: boolean
    /** Accessible dialog name (rendered sr-only — the search bar is the header). */
    title: string
    description?: string
    searchPlaceholder?: string
    /** Single mode only: close once a value is picked. Defaults to true. */
    closeOnSelect?: boolean
  }

  const props = withDefaults(defineProps<Props>(), {
    items: () => [],
    searchKey: 'name',
    searchKeys: () => [],
    valueKey: undefined,
    multiple: false,
    description: undefined,
    searchPlaceholder: undefined,
    closeOnSelect: true
  })

  const open = defineModel<boolean>('open', { required: true })
  const model = defineModel<string | string[] | null>({ default: null })

  const { t } = useI18n()

  /** Row height estimate; rows are one line, and the virtualizer measures the rest. */
  const ITEM_HEIGHT = 28

  const searchQuery = ref('')
  const focusedItemIndex = ref(-1)

  /**
   * Structural, not `InstanceType<typeof VirtualScrollable>`: the component is
   * generic, so naming its instance type here would pin `T` to whatever this
   * file happens to infer. Only the one method is used.
   */
  interface VirtualList {
    scrollToIndex: (
      index: number,
      options?: { align?: 'start' | 'center' | 'end' | 'auto' }
    ) => void
  }
  const itemsList = ref<VirtualList | null>(null)

  const fieldOf = (item: T, key: string): string => {
    if (typeof item === 'string') return item
    const value = item[key]
    return typeof value === 'string' ? value : String(value ?? '')
  }

  const labelOf = (item: T): string => fieldOf(item, props.searchKey)
  const valueOf = (item: T): string => fieldOf(item, props.valueKey ?? props.searchKey)

  /**
   * Row identity for the virtualizer, which addresses rows by index. Keyed by
   * VALUE rather than by index so a row keeps its measured height when the
   * search query re-orders the list under it.
   */
  const keyAt = (index: number): string | number => {
    const item = filteredItems.value[index]
    return item === undefined ? index : valueOf(item)
  }

  /** Every field the query is tested against: the label, plus whatever `searchKeys` adds. */
  const matches = (item: T, term: string): boolean =>
    [props.searchKey, ...props.searchKeys].some((key) =>
      fieldOf(item, key).toLowerCase().includes(term)
    )

  const filteredItems = computed(() => {
    const term = searchQuery.value.toLowerCase()
    if (!term) return props.items
    return props.items.filter((item) => matches(item, term))
  })

  const selectedValues = computed<string[]>(() => {
    if (Array.isArray(model.value)) return model.value
    return typeof model.value === 'string' ? [model.value] : []
  })

  const isSelected = (item: T): boolean => selectedValues.value.includes(valueOf(item))

  const selectItem = (item: T): void => {
    const value = valueOf(item)

    if (props.multiple) {
      model.value = isSelected(item)
        ? selectedValues.value.filter((selected) => selected !== value)
        : [...selectedValues.value, value]
      return
    }

    if (value !== model.value) model.value = value
    if (props.closeOnSelect) open.value = false
  }

  const selectFocusedItem = (): void => {
    const item = filteredItems.value[focusedItemIndex.value]
    if (item !== undefined) selectItem(item)
  }

  /**
   * Bring the keyboard cursor into view. `auto` is the virtualizer's "only if it
   * is off screen", which is what `scrollIntoView({ block: 'nearest' })` used to
   * do — and unlike that call it works for a row that is not mounted at all.
   */
  const revealFocusedItem = (): void => {
    if (focusedItemIndex.value < 0) return
    itemsList.value?.scrollToIndex(focusedItemIndex.value, { align: 'auto' })
  }

  const navigateItems = async (step: 1 | -1): Promise<void> => {
    const total = filteredItems.value.length
    if (!total) return

    focusedItemIndex.value =
      focusedItemIndex.value < 0
        ? step === 1
          ? 0
          : total - 1
        : (focusedItemIndex.value + step + total) % total

    await nextTick()
    revealFocusedItem()
  }

  /** Puts the keyboard cursor on the current selection (or nowhere) and scrolls to it. */
  const focusSelection = async (): Promise<void> => {
    focusedItemIndex.value = filteredItems.value.findIndex((item) => isSelected(item))
    await nextTick()
    if (focusedItemIndex.value >= 0) revealFocusedItem()
  }

  // The dialog body is portalled and unmounted while closed, so every open is a
  // fresh start: empty query, cursor parked on the current selection.
  watch(
    open,
    (isOpen) => {
      if (!isOpen) return
      searchQuery.value = ''
      void focusSelection()
    },
    { immediate: true }
  )

  // The catalogue often arrives after the modal is already open (async query).
  watch(
    () => props.items,
    () => {
      if (open.value && !searchQuery.value) void focusSelection()
    }
  )

  watch(searchQuery, async (term) => {
    if (!term) {
      void focusSelection()
      return
    }
    focusedItemIndex.value = filteredItems.value.length ? 0 : -1
    await nextTick()
    revealFocusedItem()
  })
</script>

<style scoped lang="scss">
  .console-modal {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;

    &__header {
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }

    &__scroll {
      flex: 1;
      min-height: 0;
    }

    // The rows are positioned by the virtualizer, so `cursor` and `user-select`
    // moved onto the row itself — there is no list wrapper left to carry them.
    &__item {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      padding: 4px 20px;
      color: var(--sub-color);
      cursor: pointer;
      user-select: none;
      outline: none;
      transition: background-color var(--transition-duration) linear;

      &--active {
        background-color: var(--bg-color);
      }

      &--focused {
        outline: 2px solid var(--main-color);
        outline-offset: -2px;
      }

      &:hover {
        background-color: var(--sub-color);
      }
    }

    &__check {
      width: 16px;
      height: 16px;
      color: var(--main-color);
      opacity: 0;

      &--on {
        opacity: 1;
      }
    }

    &__empty {
      padding: 12px 20px;
    }

    &__footer {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: space-between;
      padding: 10px 20px;
      border-top: 1px solid var(--sub-color);
    }
  }
</style>
