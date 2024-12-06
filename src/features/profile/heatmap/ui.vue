<template>
  <div class="game-heatmap" role="region" aria-label="Game activity heatmap">
    <div class="days">
      <Typography
        color="primary"
        size="s"
        tag="span"
        v-for="day in ['Mon', 'Wed', 'Fri']"
        :key="day"
      >
        {{ day }}
      </Typography>
    </div>
    <div class="grid-container">
      <Typography color="primary" size="s" tag="span" class="months">
        <span v-for="month in 12" :key="month" aria-hidden="true">
          {{ new Date(0, month - 1).toLocaleString('en', { month: 'short' }) }}
        </span>
      </Typography>
      <div class="grid" role="grid" aria-labelledby="id-heatmap-label">
        <h2 class="sr-only" id="id-heatmap-label">Heatmap activity</h2>
        <div
          v-for="day in gridData"
          :key="day.date"
          class="cell"
          :data-date="day.date"
          :style="{ backgroundColor: getCellColor(day.timesPlayed, day.date) }"
          :aria-label="`Date: ${day.date}. ${day.timesPlayed} games played`"
          role="gridcell"
          tabindex="0"
          @mouseover="selectedCell = day"
          @mouseleave="selectedCell = null"
          @click="selectedCell = day"
          @focus="selectedCell = day"
          @blur="selectedCell = null"
          @touchstart="selectedCell = day"
          @touchend="selectedCell = null"
        ></div>
      </div>
    </div>
    <div
      class="tooltip"
      role="tooltip"
      aria-live="polite"
      v-if="selectedCell"
      :style="tooltipStyle"
    >
      <span>
        {{ selectedCell.date }}:
        {{ selectedCell.timesPlayed > 0 ? selectedCell.timesPlayed + ' games' : 'no activity' }}
      </span>
      <div class="arrow"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue'
  import dayjs from 'dayjs'
  import { Typography } from '@/shared/ui/typography'
  import { useThemes } from '@/shared/lib/hooks/useThemes'
  import { lightenColor } from '@/shared/lib/helpers/colors'
  interface Props {
    year: number
  }
  interface GameData {
    date: string
    timesPlayed: number
  }

  const props = defineProps<Props>()

  const data = ref<GameData[]>([
    { date: '2024-01-01', timesPlayed: 3 },
    { date: '2024-01-02', timesPlayed: 1 },
    { date: '2024-01-03', timesPlayed: 5 },
    { date: '2024-01-04', timesPlayed: 5 },
    { date: '2024-03-20', timesPlayed: 5 },
    { date: '2024-05-20', timesPlayed: 10 },
    { date: '2024-05-22', timesPlayed: 2 },
    { date: '2023-04-22', timesPlayed: 10 }
  ])

  const { refColors } = useThemes()
  const today = dayjs().format('YYYY-MM-DD')
  const selectedCell = ref<GameData | null>(null)

  const gridData = computed(() => {
    const daysInYear = Array.from({ length: 365 }, (_, i) => {
      const date = dayjs(`${props.year}-01-01`).add(i, 'day').format('YYYY-MM-DD')
      const timesPlayed = data.value.find((d) => d.date === date)?.timesPlayed || 0
      return { date, timesPlayed }
    })
    return daysInYear
  })

  const colorMap = computed(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const lightenAmount = 1 - Math.min(i / 5, 1)
      return lightenColor(refColors['--main-color'], lightenAmount)
    })
  })

  function getCellColor(timesPlayed: number, date: string): string {
    if (date === today) return refColors['--text-color']
    if (timesPlayed === 0) return refColors['--sub-color']
    return colorMap.value[Math.min(timesPlayed, 5)]
  }

  const tooltipStyle = computed(() => {
    if (!selectedCell.value) return { top: '0', left: '0' }

    const cellElement = document.querySelector(
      `.cell[data-date="${selectedCell.value.date}"]`
    ) as HTMLElement
    if (!cellElement) return { top: '0', left: '0' }

    const rect = cellElement.getBoundingClientRect()
    const tooltipWidth = 100
    const tooltipOffset = 5
    let left = rect.left + window.scrollX + rect.width / 2
    let top = rect.top + window.scrollY - tooltipOffset - 30

    if (left + tooltipWidth > window.innerWidth)
      left = window.innerWidth - tooltipWidth - tooltipOffset
    if (left < 0) left = tooltipOffset

    return { top: `${top}px`, left: `${left}px` }
  })
</script>
<style lang="scss" scoped>
  .sr-only {
    @include hide-visually;
  }

  .game-heatmap {
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.5rem;

    .months {
      display: flex;
      grid-column: 2;
      justify-content: space-around;
      min-width: 1267px;
      margin-bottom: 0.5rem;
    }

    .days {
      display: flex;
      flex-direction: column;
      justify-content: space-evenly;
      margin-right: 6px;
    }

    .grid-container {
      max-width: 1267px;
      overflow-x: auto;
      white-space: nowrap;
    }

    .grid {
      display: grid;
      grid-area: chart;
      grid-template-rows: repeat(7, 1fr);
      grid-template-columns: repeat(53, 1fr);
      grid-auto-flow: column;
      gap: 5px;

      .cell {
        position: relative;
        width: 19px;
        height: 19px;
        border-radius: 4px;
        outline: none;
        transition: background-color 0.3s;

        &:hover {
          cursor: pointer;
        }

        &:focus {
          outline: 2px solid var(--focus-color);
        }
      }
    }

    .tooltip {
      position: fixed;
      z-index: 10;
      padding: 0.3rem 0.5rem;
      font-size: 0.8rem;
      color: var(--text-color);
      pointer-events: none;
      background-color: var(--sub-alt-color);
      border-radius: 3px;
      outline: 1px solid var(--text-color);
      transform: translateX(-50%);

      .arrow {
        position: absolute;
        top: 100%;
        left: 50%;
        margin-left: -5px;
        border-color: var(--text-color) transparent transparent transparent;
        border-style: solid;
        border-width: 5px;
      }
    }
  }
</style>
