<script setup lang="ts">
  import { Check, ChevronsUpDown } from '@lucide/vue'
  import { ref } from 'vue'
  import { cn } from '@/shared/lib/utils'
  import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
  } from '@/shared/ui/command'
  import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'

  const props = withDefaults(
    defineProps<{
      options: string[]
      placeholder?: string
      searchPlaceholder?: string
      disabled?: boolean
    }>(),
    {
      placeholder: 'Select...',
      searchPlaceholder: 'Search...',
      disabled: false
    }
  )

  const model = defineModel<string>()

  const open = ref(false)

  function onSelect(value: string) {
    model.value = value
    open.value = false
  }
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <button
        type="button"
        role="combobox"
        :aria-expanded="open"
        :disabled="props.disabled"
        :class="
          cn(
            'bg-sub-alt border border-sub rounded-md transition-tm focus-ring flex h-9 w-full items-center justify-between gap-2 px-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50',
            model ? 'text-text' : 'text-sub'
          )
        "
      >
        <span class="truncate">{{ model || props.placeholder }}</span>
        <ChevronsUpDown class="size-4 shrink-0 text-sub" />
      </button>
    </PopoverTrigger>
    <PopoverContent class="w-(--reka-popover-trigger-width) p-0">
      <Command>
        <CommandInput :placeholder="props.searchPlaceholder" />
        <CommandList>
          <CommandEmpty>No results</CommandEmpty>
          <CommandGroup>
            <CommandItem
              v-for="option in props.options"
              :key="option"
              :value="option"
              @select="onSelect(option)"
            >
              <span class="truncate">{{ option }}</span>
              <Check
                :class="
                  cn('ml-auto size-4 text-main', model === option ? 'opacity-100' : 'opacity-0')
                "
              />
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
