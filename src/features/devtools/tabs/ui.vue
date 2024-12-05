<template>
  <div class="tabs">
    <div class="tab-buttons">
      <Button
        color="shadow"
        size="s"
        v-for="(tab, index) in tabs"
        :key="index"
        :class="{ active: currentTab === tab.name }"
        @click="currentTab = tab.name"
      >
        {{ tab.label }}
      </Button>
    </div>
    <div class="tab-content">
      <div class="accordion-content">
        <div class="devtools__body">
          <KeepAlive>
            <component :is="currentTabComponent" />
          </KeepAlive>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
  import { Button } from '@shared/ui/button'
  import { ref, computed } from 'vue'
  import DevtoolsTabControls from '../screens/DevtoolsTabInfo.vue'
  import DevtoolsTabInfo from '../screens/DevtoolsTabControls.vue'

  interface Tab {
    name: string
    label: string
  }

  interface Props {
    tabs: Tab[]
  }

  const props = defineProps<Props>()
  const currentTab = ref(props.tabs[0]?.name)

  const currentTabComponent = computed(() => {
    switch (currentTab.value) {
      case 'stats':
        return DevtoolsTabControls
      case 'test-info':
        return DevtoolsTabInfo
      default:
        return null
    }
  })
</script>
<style lang="scss" scoped>
  .tab-buttons {
    display: flex;
    justify-content: space-between;
    flex: 1;
    padding: 0 10px;

    & button {
      flex: 1;
    }
  }

  .devtools {
    &__body {
      padding: 0 20px 0 20px;
      overflow: hidden;
    }
  }

  .accordion-content {
    transition: opacity 0.3s ease;
    padding: 0 0 10px 0;
  }

  :deep(.active) {
    p {
      color: var(--main-color);
    }
  }
</style>
