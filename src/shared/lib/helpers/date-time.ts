const MILISECONDS_IN_HOUR = 3600000
const MILLISECONDS_IN_DAY = 86400000

/**
 *
 * @param hourOffset
 * @returns
 */
export const getCurrentTimeStamp = (hourOffset = 0): number => {
  const offsetMilis: number = hourOffset * MILISECONDS_IN_HOUR
  const currentTime = Date.now()
  return getStartOfDayTimeStamp(currentTime, offsetMilis)
}

/**
 *
 * @param timestamp
 * @param offsetMilis
 * @returns
 */
export const getStartOfDayTimeStamp = (timestamp: number, offsetMilis = 0): number => {
  const timeSinceStartOfDay = (timestamp - offsetMilis) % MILLISECONDS_IN_DAY
  return timestamp - timeSinceStartOfDay
}

/**
 *
 * @param timestamp
 * @param hourOffset
 * @returns
 */
export const isToday = (timestamp: number, hourOffset = 0): boolean => {
  const offsetMilis = hourOffset * MILISECONDS_IN_HOUR
  const today = getStartOfDayTimeStamp(Date.now(), offsetMilis)
  const date = getStartOfDayTimeStamp(timestamp, offsetMilis)
  return date === today
}

/**
 *
 * @param timestamp
 * @param hourOffset
 * @returns
 */
export const isYesterday = (timestamp: number, hourOffset = 0): boolean => {
  const offsetMilis = hourOffset * MILISECONDS_IN_HOUR
  const today = getStartOfDayTimeStamp(Date.now() - MILLISECONDS_IN_DAY, offsetMilis)
  const date = getStartOfDayTimeStamp(timestamp, offsetMilis)
  return date === today
}
