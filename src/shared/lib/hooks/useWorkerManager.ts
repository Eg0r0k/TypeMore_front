export interface WorkerService {
  start: (time: number) => void
  stop: () => void
  reset: () => void
  onTick: (callback: (time: number) => void) => void
  onStop: (callback: () => void) => void
  terminateWorker: () => void
}

/**
 * Factory function that creates and returns a `WorkerService` instance
 * @param {new () => Worker} workerScript - The constructor for the Web Worker
 * @returns {WorkerService} An object implementing the `WorkerService` interface
 */
export const useWorkerService = (workerScript: new () => Worker): WorkerService => {
  /**
   * @private {Worker | null} worker - The Web Worker instance.  Initialized to `null` and assigned when the service is created
   */
  let worker: Worker | null = new workerScript()
  /**
   * @private {function | null} tickCallback - The callback function to be executed on each timer tick
   */
  let tickCallback: ((time: number) => void) | null = null
  /**
   * @private {function | null} stopCallback - The callback function to be executed when the timer stops.
   */
  let stopCallback: (() => void) | null = null

  const start = (time: number) => {
    worker?.postMessage({ command: 'start', time })
  }
  //TODO: Think about this :D (mb later...)
  const stop = () => {
    worker?.postMessage({ command: 'reset' })
  }
  const reset = () => {
    worker?.postMessage({ command: 'reset' })
  }
  /**
   * Sets the callback function for tick events
   * @param callback - The function to be called on each tick
   */
  const onTick = (callback: (time: number) => void) => {
    tickCallback = callback
  }

  /**
   * Sets the callback function for the stop event.
   * @param callback - The function to be called when the timer stops.
   */
  const onStop = (callback: () => void) => {
    stopCallback = callback
  }
  /**
   * Handles incoming messages from the Web Worker
   * @param {MessageEvent} e - The message event
   * @private
   */
  const handleMessage = (e: MessageEvent) => {
    if (e.data.command === 'stop') {
      stopCallback?.()
    } else if (typeof e.data.timer !== 'undefined') {
      tickCallback?.(e.data.timer)
    }
  }
  /**
   * Terminates the Web Worker and sets the worker instance to null.
   */
  const terminateWorker = () => {
    if (worker) {
      worker.terminate()
      worker = null
    }
  }
  if (worker) {
    worker.onmessage = handleMessage
  }
  return {
    start,
    stop,
    reset,
    onTick,
    onStop,
    terminateWorker
  }
}
