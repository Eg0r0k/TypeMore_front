let timeoutId: NodeJS.Timeout | null = null

interface WorkerMessage {
  command: string
  time?: number
}

enum TimerCommand {
  Start = 'start',
  Reset = 'reset',
  SetTime = 'setTime',
  Stop = 'stop'
}
interface TimerState {
  current: number
  target: number
  isRunning: boolean
}
const timerState: TimerState = {
  current: 0,
  target: 0,
  isRunning: false
}
/**
 * Handles incoming messages to the worker and executes commands (start, reset, setTime).
 *
 * @param event - The message event containing the command and optional time.
 */
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { command, time } = event.data

  switch (command) {
    case TimerCommand.Start:
      if (typeof time === 'number' && time > 0) startTimer(time)
      break
    case TimerCommand.Reset:
      resetTimer()
      break
    case TimerCommand.SetTime:
      if (typeof time === 'number' && time > 0) setConfigTime(time)
      break
    case 'stop':
      stopTimer()
      break
    default:
      throw new Error(`Unknown command: ${command}`)
  }
}

/**
 * Starts the timer with the specified configuration time.
 *
 * @param time - The time duration for the timer.
 * @returns Return void if timer <= 0
 */
function startTimer(time: number) {
  if (timerState.isRunning) return
  timerState.target = time
  timerState.current = 0
  timerState.isRunning = true
  timerStep()
}

/**
 * Resets the timer, stopping it and clearing the timeout if it exists.
 */
function resetTimer() {
  timerState.current = 0
  timerState.isRunning = false
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
}
/**
 * Sets the configuration time for the timer.
 *
 * @param time - The time duration to set for the timer.
 */
function setConfigTime(time: number) {
  timerState.target = time
}

/**
 * Stops the timer without resetting the current time.
 */
function stopTimer() {
  timerState.isRunning = false
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
}

/**
 * Increments the timer and posts the current timer value to the main thread.
 * If the timer reaches the configured time, it stops and sends a stop command.
 */
function timerStep() {
  if (!timerState.isRunning) return
  console.log('____START-STEP_____')
  timerState.current++
  postMessage({ timer: timerState.current })
  timeoutId = setTimeout(timerStep, 1000)
  console.log('_____END-STEP_____')
}
