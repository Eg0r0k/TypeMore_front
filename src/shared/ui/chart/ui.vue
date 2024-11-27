<template>
  <LineChart ref="lineChartRef" v-bind="lineChartProps" />
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { LineChart } from 'vue-chart-3'
  import { Chart, ChartData, ChartOptions, registerables } from 'chart.js'

  import { useTimerStore } from '@/entities/timer/model/store'
  import { useThemes } from '@/shared/lib/hooks/useThemes'
  import { useStats } from '@/shared/lib/hooks/useStats'
  import { getColorWithOpacity } from '@/shared/lib/helpers/colors'

  Chart.register(...registerables)

  const { refColors } = useThemes()
  const timerStore = useTimerStore()
  const stats = useStats()

  const dataLabels = ref<number[]>([])
  const dataError = ref<number[]>([])
  const dataWPM = ref<number[]>([])
  const dataRAW = ref<number[]>([])

  const lineChartData = computed<ChartData<'line'>>(() => ({
    labels: dataLabels.value,
    datasets: [
      {
        label: 'Errors', // Опечатка исправлена
        data: dataError.value,
        borderColor: refColors['--error-color'],
        backgroundColor: refColors['--error-color'],
        pointBackgroundColor: refColors['--error-color'],
        pointBorderColor: refColors['--error-color'],
        pointStyle: 'crossRot',
        showLine: false
      },
      {
        label: 'WPM',
        data: dataWPM.value,
        borderColor: refColors['--main-color'],
        backgroundColor: getColorWithOpacity(refColors['--sub-alt-color'], 0.4),
        fill: true,
        tension: 0.2,
        pointBackgroundColor: refColors['--main-color'],
        pointBorderColor: refColors['--main-color']
      },
      {
        label: 'RAW WPM', // Добавлено "WPM" для ясности
        data: dataRAW.value,
        borderColor: refColors['--sub-alt-color'],
        backgroundColor: getColorWithOpacity(refColors['--sub-alt-color'], 0.4),
        fill: true,
        tension: 0.2,
        pointBackgroundColor: refColors['--sub-alt-color'],
        pointBorderColor: refColors['--sub-alt-color']
      }
    ]
  }))

  const lineChartOptions = computed<ChartOptions<'line'>>(() => ({
    scales: {
      x: {
        type: 'category',
        ticks: {
          autoSkip: false
        },
        grid: {
          color: getColorWithOpacity(refColors['--sub-alt-color'], 0.4)
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: getColorWithOpacity(refColors['--sub-alt-color'], 0.4)
        }
      }
    },
    plugins: {
      tooltip: {
        mode: 'nearest',
        intersect: false
      }
    },
    elements: {
      point: {
        radius: 3
      }
    }
  }))

  const lineChartProps = computed(() => ({
    chartData: lineChartData.value,
    options: lineChartOptions.value
  }))

  watch(timerStore.getTime, (newTime) => {
    dataLabels.value.push(newTime)
    const currentStats = stats.getStats.value

    dataError.value.push(currentStats.missedChars + currentStats.extraChars)
    dataWPM.value.push(currentStats.wpm)
    dataRAW.value.push(currentStats.wpmRaw)
  })
</script>

<style></style>
