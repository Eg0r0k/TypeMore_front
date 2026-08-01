<template>
  <Tooltip>
    <TooltipTrigger as-child>
      <Button :color="color" size="icon-sm" :aria-label="label" @click="emit('click')">
        <slot />
      </Button>
    </TooltipTrigger>
    <TooltipContent>{{ label }}</TooltipContent>
  </Tooltip>
</template>

<script setup lang="ts">
  import { Button, type ButtonColor } from '@/shared/ui/button'
  import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'

  /**
   * An action in a setting row reduced to its glyph.
   *
   * Rows like "settings file" or "custom background" spent their whole control
   * rail on button captions that repeated what the row's own label and
   * description had already said — `export` / `import` under "import or export
   * all your settings", `use local image` / `clear` under a row called "custom
   * background". The glyph carries the verb; the caption it replaces becomes the
   * tooltip AND the accessible name, so nothing is only available on hover.
   *
   * Reserved for actions with a settled icon (download, upload, copy, clear).
   * Destructive confirmations keep their words — `reset settings` still asks in
   * a sentence, because a glyph is a bad place to put "this cannot be undone".
   *
   * `TooltipProvider` is mounted once in App.vue; the dialog is portalled out of
   * that subtree but Vue's provide/inject follows the component tree, not the
   * DOM, so the injection still resolves here.
   */
  withDefaults(defineProps<{ label: string; color?: ButtonColor }>(), { color: 'gray' })

  const emit = defineEmits<{ click: [] }>()
</script>
