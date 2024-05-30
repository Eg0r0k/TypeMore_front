let timer = 0
let isRunning = false
let configTime = 0
let timeoutId: NodeJS.Timeout | null = null

self.onmessage = function (e) {
  const { command, time } = e.data
  if (time <= 0) {
    return
  }
  if (command === 'start') {
    if (!isRunning) {
      isRunning = true
      configTime = time
      timer = 0
      timerStep()
    }
  } else if (command === 'reset') {
    timer = 0
    isRunning = false
    postMessage({ timer })
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }
  } else if (command === 'setTime') {
    configTime = time
  }
}

function timerStep() {
  if (isRunning) {
    timer++
    postMessage({ timer })

    if (timer >= configTime && configTime !== 0) {
      isRunning = false
      postMessage({ command: 'stop' })
    } else {
      timeoutId = setTimeout(timerStep, 1000)
    }
  }
}
