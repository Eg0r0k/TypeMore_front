<template>
  <li
    class="room"
    role="button"
    tabindex="0"
    @keydown.enter="handleClick"
    @keydown.space="handleClick"
    @click="handleClick"
    :aria-label="`Select room ${name}`"
  >
    <div class="name">
      <div class="title">name</div>
      <div class="value">{{ name }}</div>
    </div>
    <div class="name">
      <div class="title">Name</div>
      <div class="value">{{ name }}</div>
    </div>
    <div class="players">
      <div class="title">Players</div>
      <div class="value">1</div>
    </div>
    <div class="state">
      <div class="title">State</div>
      <div class="value">Lobby</div>
    </div>
    <div class="config">
      <div class="title">Config</div>
      <div class="value">Time 30 English</div>
    </div>
    <div class="chevron" aria-hidden="true">
      <Icon icon="tabler:arrow-big-right-filled" />
    </div>
  </li>
</template>

<script lang="ts" setup>
  import { Icon } from '@iconify/vue'

  interface Props {
    id: string
    name: string
    hasPassword: boolean
  }

  const emit = defineEmits<{
    (e: 'selectRoom', room: Props): void
  }>()
  const handleClick = () => {
    emit('selectRoom', { id: props.id, name: props.name, hasPassword: props.hasPassword })
  }
  const props = defineProps<Props>()
</script>

<style lang="scss" scoped>
  .room {
    display: grid;
    grid-template-columns: 1fr 1fr 3fr 0fr;
    grid-auto-rows: auto;
    width: 100%;
    height: min-content;
    padding: 1rem;
    border: 2px solid var(--sub-alt-color);
    gap: 0.5rem;
    transition: 0.25s;
    box-sizing: border-box;
    user-select: none;
    cursor: pointer;
    grid-template-areas:
      'name name name chevron'
      'state players config chevron';
    border-radius: var(--border-radius);

    &:hover {
      background-color: var(--sub-alt-color);
    }

    &:focus-visible {
      outline: none;
      box-shadow:
        0 0 0 1.5px var(--bg-color),
        0 0 0 3px var(--text-color);
    }

    .name {
      grid-area: name;
    }

    .players {
      grid-area: players;
    }

    .state {
      grid-area: state;
    }

    .config {
      grid-area: config;
    }

    .chevron {
      grid-area: chevron;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 10px;
    }

    .title {
      font-size: 12px;
      color: var(--sub-color);
    }

    .value {
      font-size: 14px;
      color: var(--text-color);
    }
  }
</style>
