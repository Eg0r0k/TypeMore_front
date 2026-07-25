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

        <Scrollable class="console-modal__scroll">
          <div
            ref="itemsList"
            role="listbox"
            :aria-label="title"
            :aria-multiselectable="multiple"
            class="console-modal__body"
          >
            <div
              v-for="(item, index) in filteredItems"
              :key="valueOf(item)"
              :data-index="index"
              role="option"
              :aria-selected="isSelected(item)"
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

            <Typography v-if="!filteredItems.length" class="console-modal__empty" color="sub">
              {{ t('picker.empty') }}
            </Typography>
          </div>
        </Scrollable>

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
  import { Scrollable } from '@/shared/ui/scrollable'
  import { SearchBar } from '@/shared/ui/search'
  import { Typography } from '@/shared/ui/typography'

  /**
   * Searchable console-style picker (the themes/language modal): a dialog with a
   * search bar on top and a scrollable option list below.
   *
   * Selection is a plain `v-model` over the item *values* — a single string in
   * single mode, a string array when `multiple`. Items may be strings or objects;
   * `searchKey` names the searchable/label field and `valueKey` the identity one
   * (defaults to `searchKey`). Custom rows go through the `#item` slot; the
   * option wrapper (role, aria-selected, focus/active state, click) is ours.
   */
  interface Props {
    items?: T[]
    /** Object field used for search and for the default label. */
    searchKey?: string
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
    valueKey: undefined,
    multiple: false,
    description: undefined,
    searchPlaceholder: undefined,
    closeOnSelect: true
  })

  const open = defineModel<boolean>('open', { required: true })
  const model = defineModel<string | string[] | null>({ default: null })

  const { t } = useI18n()

  const searchQuery = ref('')
  const focusedItemIndex = ref(-1)
  const itemsList = ref<HTMLElement | null>(null)

  const fieldOf = (item: T, key: string): string => {
    if (typeof item === 'string') return item
    const value = item[key]
    return typeof value === 'string' ? value : String(value ?? '')
  }

  const labelOf = (item: T): string => fieldOf(item, props.searchKey)
  const valueOf = (item: T): string => fieldOf(item, props.valueKey ?? props.searchKey)

  const filteredItems = computed(() => {
    const term = searchQuery.value.toLowerCase()
    if (!term) return props.items
    return props.items.filter((item) => labelOf(item).toLowerCase().includes(term))
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

  const revealFocusedItem = (): void => {
    itemsList.value
      ?.querySelector<HTMLElement>(`[data-index="${focusedItemIndex.value}"]`)
      ?.scrollIntoView({ block: 'nearest' })
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

    &__body {
      display: grid;
      align-content: start;
      cursor: pointer;
      user-select: none;
    }

    &__item {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      padding: 4px 20px;
      color: var(--sub-color);
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
