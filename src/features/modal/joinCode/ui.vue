<template>
  <div class="code-modal">
    <Typography class="code-modal__title" size="l" tag-name="h2" color="primary">
      Enter the code
    </Typography>
    <div class="code-modal__input">
      <TextInput v-focus v-model="inputCode" placeholder="Code" />
      <Popper placement="top" hover arrow :interactive="false" content="Paste code">
        <Button @click="pasteFromClipboard" style="height: 37px" size="s">
          <template #left-icon>
            <Icon width="28" icon="mingcute:clipboard-fill" />
          </template>
        </Button>
      </Popper>
    </div>
    <Typography color="sub" size="xs">
      If you have a room code, enter it here to connect.
    </Typography>
    <Button buttonLabel="save time amount" size="m" color="gray">ok</Button>
  </div>
</template>

<script lang="ts" setup>
  import { useAlertStore } from '@/entities/alert'
  import { AlertType } from '@/entities/alert/types/alertData'
  import { Button } from '@/shared/ui/button'
  import { TextInput } from '@/shared/ui/input'
  import { Typography } from '@/shared/ui/typography'
  import { Icon } from '@iconify/vue'
  import { ref } from 'vue'

  const inputCode = ref('')
  const alert = useAlertStore()
  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      inputCode.value = text
    } catch (e) {
      alert.addAlert({
        type: AlertType.Error,
        msg: `Paste from clipboard failed: ${e}`,
        title: 'Clipboard Error',
        duration: 10000
      })
    }
  }
</script>

<style lang="scss" scoped>
  .code-modal {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    padding: 1.5rem;
    max-width: 300px;
    background: var(--bg-color);
    border-radius: var(--border-radius);
    box-shadow: 0 0 0 0.2em var(--sub-alt-color);

    &__input {
      display: flex;
      align-items: flex-end;
      gap: 5px;
      margin-bottom: 10px;
    }

    &__title {
      margin-bottom: 10px;
    }
  }
</style>
