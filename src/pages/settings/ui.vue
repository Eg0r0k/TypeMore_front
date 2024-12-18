<template>
  <div class="test-color">
    <div class="test-color__container">
      <Typography color="primary" size="xl" tag-name="p">
        The
        <Typography color="error" tag-name="span" decoration="underline" size="xl">
          quick
        </Typography>
        <Typography size="xl" tag-name="span" color="sub">brown</Typography>
        <Typography tag-name="span" color="extra-error" decoration="underline" size="xl">
          fox
        </Typography>
        jumps
        <Typography tag-name="span" color="main" size="xl">over the lazy</Typography>
        dog
      </Typography>
      <div class="test">
        <Popper hover arrow offset-distance="6" :content="'some information'">
          <Button class="test__btn" color="gray">Button with hint</Button>
        </Popper>
        <Button class="test__btn" color="main">
          <template #left-icon>
            <Icon width="24" icon="fluent:target-20-filled" />
          </template>
          Text
          <template #right-icon>
            <Icon width="24" icon="fluent:target-20-filled" />
          </template>
        </Button>
        <Button to="/" class="test__btn" color="main">
          <template #left-icon>
            <Icon width="24" icon="fluent:target-20-filled" />
          </template>
          Link
          <template #right-icon>
            <Icon width="24" icon="fluent:target-20-filled" />
          </template>
        </Button>
        <Button color="error">
          <template #left-icon>
            <Icon width="24" icon="ic:round-warning" />
          </template>
          Dunger
        </Button>

        <Button style="max-width: fit-content" size="s" color="error">
          <template #left-icon>
            <Icon width="24" icon="ic:round-warning" />
          </template>
        </Button>
        <Button isLoading style="max-width: fit-content" size="s" color="error">
          <template #left-icon>
            <Icon width="24" icon="ic:round-warning" />
          </template>
          Test text
        </Button>
        <Button isLoading size="l" color="error">
          <template #left-icon>
            <Icon width="24" icon="ic:round-warning" />
          </template>
          Dunger
        </Button>
        <Button isLoading style="max-width: fit-content" size="s" color="error">
          <template #left-icon>
            <Icon width="24" icon="ic:round-warning" />
          </template>
        </Button>
        <Button style="max-width: fit-content" size="s" color="shadow">Shadow</Button>
        <Button isLoading size="s" color="shadow">Shadow</Button>
        <Button size="s" color="shadow">
          <template #left-icon>
            <Icon width="24" icon="ic:round-warning" />
          </template>
          Shadow
        </Button>
        <TextInput placeholder="Some text" />
        <TextInput :is-disabled="true" placeholder="Some text" />
        <Select :options="selectValues" />
        <Select isDisabled :options="selectValues" />
        <CheckBox value="test">Тест</CheckBox>
        <CheckBox isDisabled value="test">Тест</CheckBox>
      </div>
    </div>

    <div class="controls">
      <div v-for="(color, index) in colors" :key="index" class="theme-input">
        <Typography style="flex: 1" size="m" color="primary">{{ color.label }}</Typography>
        <TextInput v-model="color.hex" @input="debouncedUpdateColor(color)" />
        <div class="color">
          <Icon icon="mdi:color" width="30" />
          <input
            v-model="color.hex"
            class="input-color"
            type="color"
            @input="debouncedUpdateColor(color)"
          />
        </div>
      </div>
      <div></div>
      <Button @click="copyTheme">
        <template #left-icon>
          <Icon width="24" icon="ph:copy-bold" />
        </template>
        Copy
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Icon } from '@iconify/vue'
  import { TextInput } from '@/shared/ui/input'
  import { Typography } from '@shared/ui/typography'
  import { Button } from '@shared/ui/button'
  import { onMounted, ref } from 'vue'
  import { Theme } from '@/features/modal/themes/types/themes'
  import { useAlertStore } from '@/entities/alert'
  import { AlertType } from '@/entities/alert/types/alertData'
  import { useDebounceFn } from '@vueuse/core'
  import { Select } from '@/shared/ui/select'
  import { CheckBox } from '@/shared/ui/checkbox'
  const root = document.documentElement
  const selectValues = ['a', 'b', 'c']
  const alertStore = useAlertStore()
  interface Color {
    label: string
    var: string
    hex: string
  }
  const colors = ref([
    {
      label: 'background',
      var: '--bg-color',
      hex: getComputedStyle(root).getPropertyValue('--bg-color')
    },
    {
      label: 'main',
      var: '--main-color',
      hex: getComputedStyle(root).getPropertyValue('--main-color')
    },
    {
      label: 'sub-color',
      var: '--sub-color',
      hex: getComputedStyle(root).getPropertyValue('--sub-color')
    },
    {
      label: 'sub-alt-color',
      var: '--sub-alt-color',
      hex: getComputedStyle(root).getPropertyValue('--sub-alt-color')
    },
    {
      label: 'text-color',
      var: '--text-color',
      hex: getComputedStyle(root).getPropertyValue('--text-color')
    },
    {
      label: 'error',
      var: '--error-color',
      hex: getComputedStyle(root).getPropertyValue('--error-color')
    },
    {
      label: 'extra-error',
      var: '--error-extra-color',
      hex: getComputedStyle(root).getPropertyValue('--error-extra-color')
    }
  ])

  const getTheme = (): Theme => {
    return colors.value.reduce((theme, color) => {
      theme[color.var as keyof Theme] = color.hex
      return theme
    }, {} as Theme)
  }

  let queuedUpdates: Color[] = []

  const updateColor = (color: Color) => {
    queuedUpdates.push(color)

    if (!queuedUpdates.length) {
      return
    }

    requestAnimationFrame(() => {
      const updates = queuedUpdates
      queuedUpdates = []

      updates.forEach((color) => {
        root.style.setProperty(color.var, color.hex)
      })
    })
  }
  const copyTheme = async () => {
    const theme = getTheme()
    try {
      await navigator.clipboard.writeText(JSON.stringify(theme, null, 2))
    } catch (error) {
      alertStore.addAlert({
        type: AlertType.Error,
        title: 'Failed to copy theme',
        msg: `${error}`,
        duration: 2000
      })
    }
  }
  const debouncedUpdateColor = useDebounceFn(updateColor, 200, { maxWait: 200 })

  onMounted(() => {
    getTheme()
  })
</script>

<style lang="scss" scoped>
  .controls {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 20px 50px;
    width: 100%;
    padding-top: 40px;
    border-top: 2px solid var(--sub-alt-color);

    @media (width >=792px) {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .theme-input {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .color {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 40px;
    height: 40px;
    cursor: pointer;
    user-select: none;
    background-color: var(--sub-alt-color);
    border-radius: var(--border-radius);

    & input {
      position: absolute;
      width: 100%;
      height: 100%;
      cursor: pointer;
      opacity: 0;
    }
  }

  .test {
    display: flex;
    flex-direction: column;
    gap: 12px;

    &__btn {
      width: 100%;
    }
  }

  .test-color {
    display: flex;
    flex-direction: column;
    gap: 40px;

    &__container {
      display: grid;
      grid-template-columns: repeat(1, 1fr);
      gap: 12px;
      width: 100%;

      @media (width >=792px) {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  }
</style>
