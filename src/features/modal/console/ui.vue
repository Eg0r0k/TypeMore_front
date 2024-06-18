<template>
  <div class="theme-modal" @keydown.tab.prevent="navigateItems(NavigationDirection.Down)"
    @keydown.up.prevent="navigateItems(NavigationDirection.Up)"
    @keydown.down.prevent="navigateItems(NavigationDirection.Down)" @keydown.enter.prevent="selectFocusedItem"
    tabindex="0">
    <div class="theme-modal__header modal-header">
      <div class="modal-header__icon">
        <Icon width="20" icon="fluent:search-12-filled" />
      </div>
      <input ref="searchInput" type="text" v-model.trim="searchQuery" class="modal-header__search"
        placeholder="Search..." />
    </div>

    <div role="listbox" ref="itemsList" class="theme-modal__body">
      <slot name="items" :focused-items="focusedItemIndex" :select-items="selectItem" :filtered-items="filteredItems" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onMounted, ref, nextTick } from 'vue'
import { useFocus } from '@vueuse/core'
import { Theme } from './types/themes';
enum NavigationDirection {
  Up = 'up',
  Down = 'down',
}
const searchQuery = ref('')
const focusedItemIndex = ref(-1)
const searchInput = ref<HTMLInputElement | null>(null)
const itemsList = ref<HTMLElement | null>(null)

interface Props {
  items?: Theme[] | Record<string, any>[] | any[];
  searchKey?: string;
  activeItem?: Record<string, any> | string | null
}

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  searchKey: 'name',
  activeItem: null,
});

const emit = defineEmits(['item-selected'])

const filteredItems = computed(() => {
  const searchTerm = searchQuery.value.toLowerCase();
  return props.items.filter((item) => {
    const searchableText = typeof item === 'string'
      ? item
      : props.searchKey && item[props.searchKey]
        ? item[props.searchKey]
        : '';
    return searchableText.toLowerCase().includes(searchTerm);
  });
});


const navigateItems = async (direction: NavigationDirection) => {
  const itemsLength = filteredItems.value.length
  if (itemsLength === 0) return
  focusedItemIndex.value =
    (focusedItemIndex.value + (direction === 'up' ? -1 : 1) + itemsLength) % itemsLength
  nextTick(() => {
    centerFocusedItem()
  })
}

const selectItem = (item: any): void => {
  const index = props.items.indexOf(item)
  if (index !== -1 || index) {
    if (item !== props.activeItem) {
      focusedItemIndex.value = index
      emit('item-selected', item)
    }
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
    const bodyHeight = itemsList.value.clientHeight - 240
    const itemHeight = focusedItem.clientHeight
    const offset = (bodyHeight - itemHeight) / 1.1
    itemsList.value.scrollTop = focusedItem.offsetTop - offset
  }
}

const centerActiveItem = async (): Promise<void> => {
  nextTick(() => {
    if (!itemsList.value || focusedItemIndex.value === -1) return
    centerFocusedItem()
  })
}

useFocus(searchInput, { initialValue: true })

onMounted(async () => {
  if (!props.items || props.items.length === 0) return

  let activeIndex = -1
  if (props.activeItem) {
    activeIndex = props.items.findIndex((item) => {
      if (typeof item === 'string') {
        return item === props.activeItem
      } else if (props.searchKey) {
        return item[props.searchKey] === props.activeItem
      }
      return false
    })
  }

  if (activeIndex !== -1) {
    focusedItemIndex.value = activeIndex
    await centerActiveItem()
  } else {
    focusedItemIndex.value = -1
  }
})
</script>

<style scoped lang="scss">
.modal-header {
  display: flex;
  align-items: center;

  &__icon {
    color: var(--sub-color);
    margin: 5px 1rem 0;
  }

  &__search {
    &::placeholder {
      color: var(--sub-color);
      opacity: 1;
    }

    width: 100%;
    user-select: none;
    line-height: normal;
    box-sizing: border-box;
    background-color: var(--sub-alt-color);
    border-radius: var(--border-radius);
    border: none;
    outline: none;
    padding: 10px 20px 10px 0;
    font-size: 16px;
    color: var(--text-color);
    caret-color: var(--main-color);
    position: relative;
  }
}

.theme-modal {
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
