<template>
  <div
    class="console-modal"
    tabindex="0"
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-search-title"
    @keydown.tab.prevent="navigateItems(NavigationDirection.Down)"
    @keydown.up.prevent="navigateItems(NavigationDirection.Up)"
    @keydown.down.prevent="navigateItems(NavigationDirection.Down)"
    @keydown.enter.prevent="selectFocusedItem"
  >
    <h2 id="modal-search-title" class="sr-only">Search elements</h2>
    <div class="console-modal__header modal-header">
      <SearchBar v-model="searchQuery" placeholder="Search..." />
    </div>
    <div
      ref="itemsList"
      role="listbox"
      aria-labelledby="modal-search-title"
      class="console-modal__body"
    >
      <slot
        name="items"
        :focused-items="focusedItemIndex"
        :select-item="selectItem"
        :filtered-items="filteredItems"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref, nextTick } from 'vue'
  import { Theme } from '../themes/types/themes'
  import { SearchBar } from '@/shared/ui/search'

  enum NavigationDirection {
    Up = 'up',
    Down = 'down'
  }

  const searchQuery = ref('')
  const focusedItemIndex = ref(-1)
  const itemsList = ref<HTMLElement | null>(null)

  interface Props {
    items: Theme[] | Record<string, any>[] | any[]
    searchKey?: string
    activeItem?: Record<string, any> | string | null
  }

  const props = withDefaults(defineProps<Props>(), {
    items: () => [],
    searchKey: 'name',
    activeItem: null
  })

  const emit = defineEmits(['item-selected'])

  const filteredItems = computed(() => {
    const searchTerm = searchQuery.value.toLowerCase()
    return props.items.filter((item) => {
      const searchableText =
        typeof item === 'string'
          ? item
          : props.searchKey && item[props.searchKey]
            ? item[props.searchKey]
            : ''
      return searchableText.toLowerCase().includes(searchTerm)
    })
  })

  const navigateItems = async (direction: NavigationDirection) => {
    const itemsLength = filteredItems.value.length
    if (itemsLength === 0) return

    const newIndex =
      (focusedItemIndex.value + (direction === NavigationDirection.Up ? -1 : 1) + itemsLength) %
      itemsLength
    if (newIndex !== focusedItemIndex.value) {
      focusedItemIndex.value = newIndex
      await nextTick(centerFocusedItem)
    }
  }

  const selectItem = (item: any): void => {
    if (item !== props.activeItem) {
      focusedItemIndex.value = props.items.indexOf(item)
      emit('item-selected', item)
    }
  }

  const selectFocusedItem = (): void => {
    if (focusedItemIndex.value >= 0 && focusedItemIndex.value < filteredItems.value.length) {
      selectItem(filteredItems.value[focusedItemIndex.value])
    }
  }

  const centerFocusedItem = () => {
    if (!itemsList.value || focusedItemIndex.value === -1) return

    const suggestionRect = itemsList.value.getBoundingClientRect()
    const focusedItem = itemsList.value.children[focusedItemIndex.value] as HTMLElement
    const focusedItemRect = focusedItem.getBoundingClientRect()

    const scroll =
      Math.abs(suggestionRect.top - focusedItemRect.top - itemsList.value.scrollTop) -
      (suggestionRect.height >> 1) +
      focusedItemRect.height

    itemsList.value.scrollTop = scroll
  }

  onMounted(async () => {
    if (!props.items.length) return
    const activeIndex = props.items.findIndex((item) =>
      typeof item === 'string'
        ? item === props.activeItem
        : props.searchKey && item[props.searchKey] === props.activeItem
    )
    focusedItemIndex.value = activeIndex !== -1 ? activeIndex : -1
    if (activeIndex !== -1) await nextTick(centerFocusedItem)
  })
</script>

<style scoped lang="scss">
  .modal-header {
    display: flex;
    align-items: center;
  }

  .sr-only {
    @include hide-visually;
  }

  .console-modal {
    width: 100%;
    max-width: 700px;
    max-height: 100%;
    overflow: hidden;
    background-color: var(--sub-alt-color);
    border-radius: var(--border-radius);
    outline: 3px solid var(--sub-color);

    &__body {
      display: grid;
      max-height: calc(100vh - 200px);
      overflow-y: scroll;
      overscroll-behavior: contain;
      cursor: pointer;
      user-select: none;
    }
  }
</style>
