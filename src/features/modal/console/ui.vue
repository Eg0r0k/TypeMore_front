<template>
  <div
    class="console-modal"
    tabindex="0"
    @keydown.tab.prevent="navigateItems(NavigationDirection.Down)"
    @keydown.up.prevent="navigateItems(NavigationDirection.Up)"
    @keydown.down.prevent="navigateItems(NavigationDirection.Down)"
    @keydown.enter.prevent="selectFocusedItem"
  >
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
        />
      </div>
    </div>
    <div ref="itemsList" role="listbox" class="console-modal__body">
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
import { Typography } from '@/shared/ui/typography'

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
  focusedItemIndex.value =
    (focusedItemIndex.value + (direction === NavigationDirection.Up ? -1 : 1) + itemsLength) %
    itemsLength
  await nextTick(centerFocusedItem)
}

const selectItem = (item: any): void => {
  const index = props.items.findIndex((i) => i === item)
  if (index !== -1 && item !== props.activeItem && item[props.searchKey] !== props.activeItem) {
    focusedItemIndex.value = index
    emit('item-selected', item)
  }
}

const selectFocusedItem = (): void => {
  if (focusedItemIndex.value >= 0 && focusedItemIndex.value < filteredItems.value.length) {
    selectItem(filteredItems.value[focusedItemIndex.value])
  }
}

const centerFocusedItem = () => {
  if (itemsList?.value && focusedItemIndex.value !== -1) {
    const focusedItem = itemsList.value.children[focusedItemIndex.value] as HTMLElement
    const bodyHeight = itemsList.value.clientHeight

    const itemHeight = focusedItem.clientHeight
    const offset = (bodyHeight - itemHeight) / 2
    itemsList.value.scrollTop = focusedItem.offsetTop - offset
  }
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

  &__search-wrapper {
    position: relative;
    width: 100%;

    &:focus-within {
      .modal-header__search-icon {
        color: var(--text-color);
      }
    }
  }

  &__search-icon {
    position: absolute;
    top: 50%;
    left: 15px;
    transition: all var(--transition-duration);
    transform: translateY(-50%);
    color: var(--sub-color);
    pointer-events: none;
  }

  &__search {
    width: 100%;
    padding: 10px 20px 10px 50px;

    line-height: normal;
    box-sizing: border-box;
    background-color: var(--sub-alt-color);
    border-radius: var(--border-radius);
    border: none;
    outline: none;
    font-size: 16px;
    color: var(--text-color);
    caret-color: var(--main-color);
    -webkit-user-select: none;
    -moz-user-select: none;
    user-select: none;

    &::placeholder {
      color: var(--sub-color);
      opacity: 1;
    }
  }
}

.console-modal {
  border-radius: var(--border-radius);
  outline: 3px solid var(--sub-color);
  max-width: 700px;
  overflow: hidden;
  width: 100%;
  max-height: 100%;
  background-color: var(--sub-alt-color);

  &__body {
    overflow-y: scroll;
    overscroll-behavior: contain;
    max-height: calc(100vh - 200px);
    display: grid;
    cursor: pointer;
    -webkit-user-select: none;
    -moz-user-select: none;
    user-select: none;
  }
}
</style>
