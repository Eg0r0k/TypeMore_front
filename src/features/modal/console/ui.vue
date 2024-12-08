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
      <div class="modal-header__search-wrapper">
        <Icon width="20" icon="fluent:search-12-filled" class="modal-header__search-icon" />
        <input
          ref="searchInput"
          :value="searchQuery"
          @input="onSearchInput"
          type="text"
          class="modal-header__search"
          placeholder="Search..."
          aria-label="Search"
        />
      </div>
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
  import { Icon } from '@iconify/vue'
  import { computed, onMounted, ref, nextTick } from 'vue'
  import { useFocus } from '@vueuse/core'
  import { Theme } from '../themes/types/themes'

  enum NavigationDirection {
    Up = 'up',
    Down = 'down'
  }

  const searchQuery = ref('')
  const focusedItemIndex = ref(-1)
  const searchInput = ref<HTMLInputElement | null>(null)
  const itemsList = ref<HTMLElement | null>(null)
  const onSearchInput = (event: Event): void => {
    const target = event.target as HTMLInputElement
    searchQuery.value = target.value.trim()
  }
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
  useFocus(searchInput, { initialValue: true })

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

    &__search-icon {
      position: absolute;
      top: 50%;
      left: 15px;
      color: var(--sub-color);
      pointer-events: none;
      transition: all var(--transition-duration);
      transform: translateY(-50%);
    }

    &__search-wrapper {
      position: relative;
      width: 100%;

      &:focus-within {
        .modal-header__search-icon {
          color: var(--text-color);
        }
      }
    }

    &__search {
      box-sizing: border-box;
      width: 100%;
      padding: 10px 20px 10px 50px;
      font-size: 16px;
      line-height: normal;
      color: var(--text-color);
      caret-color: var(--main-color);
      user-select: none;
      background-color: var(--sub-alt-color);
      border: none;
      border-radius: var(--border-radius);
      outline: none;

      &::placeholder {
        color: var(--sub-color);
        opacity: 1;
      }
    }
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
