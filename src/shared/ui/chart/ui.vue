<template>
  <LineChart ref="doughnutChartRef" style="height: 200px" v-bind="doughnutChartProps" />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { LineChart } from 'vue-chart-3'
import { Chart, ChartData, ChartOptions, registerables } from 'chart.js'
import { getColorWithOpacity } from '@/shared/lib/helpers/misc'
import { useTimerStore } from '@/entities/timer/model/store'
import { useThemes } from '@/shared/lib/hooks/useThemes'
Chart.register(...registerables)

// interface Props {
//   dataError: number[];
//   dataWPM: number[];
//   dataRAW: number[];
//   dataLabels: number[];
//   dataTimeLabel: number[]
// }
// const props = defineProps<Props>()

const { refColors } = useThemes()
const dataError = ref<number[]>([])
const dataWPM = ref<number[]>([])
const dataRAW = ref<number[]>([])
const dataLabels = ref<number[]>([])

const testData = computed<ChartData<'line'>>(() => ({
  labels: dataLabels.value,
  datasets: [
    {
      label: 'Error',
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
      label: 'RAW',
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

const options = computed<ChartOptions<'line'>>(() => ({
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

const doughnutChartProps = computed(() => ({
  chartData: testData.value,
  options: options.value
}))
const timerStore = useTimerStore()
// watch(timerStore.getTime, (newTime) => {
//   dataLabels.value.push(newTime)
//   dataError.value.push(Math.floor(Math.random() * 100) + 1)
//   dataWPM.value.push(Math.floor(Math.random() * 100) + 1)
//   dataRAW.value.push(Math.floor(Math.random() * 100) + 1)
//   console.log(refColors)

// })
</script>

<style></style>
