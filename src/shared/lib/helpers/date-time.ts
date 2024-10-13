const MILISECONDS_IN_HOUR = 3600000
const MILLISECONDS_IN_DAY = 86400000

/**
 * Returns the current timestamp adjusted by the specified hour offset.
 *
 * @param hourOffset - The number of hours to offset the current time. Defaults to 0.
 * @returns The timestamp representing the current time with the specified hour offset.
 */
export const getCurrentTimeStamp = (hourOffset = 0): number => {
  const offsetMilis: number = hourOffset * MILISECONDS_IN_HOUR
  const currentTime = Date.now()
  return getStartOfDayTimeStamp(currentTime, offsetMilis)
}

/**
 * Calculates the timestamp for the start of the day based on the given timestamp and offset.
 *
 * @param timestamp - The initial timestamp from which to calculate the start of the day.
 * @param offsetMilis - The number of milliseconds to offset the timestamp. Defaults to 0.
 * @returns The timestamp representing the start of the day based on the input timestamp and offset.
 */
export const getStartOfDayTimeStamp = (timestamp: number, offsetMilis = 0): number => {
  const timeSinceStartOfDay = (timestamp - offsetMilis) % MILLISECONDS_IN_DAY
  return timestamp - timeSinceStartOfDay
}

/**
 * Determines if the given timestamp corresponds to today's date, adjusted by the hour offset.
 *
 * @param timestamp - The timestamp to check.
 * @param hourOffset - The number of hours to offset the date comparison. Defaults to 0.
 * @returns True if the timestamp is within today's date range, adjusted by the offset; otherwise, false.
 */
export const isToday = (timestamp: number, hourOffset = 0): boolean => {
  const offsetMilis = hourOffset * MILISECONDS_IN_HOUR
  const today = getStartOfDayTimeStamp(Date.now(), offsetMilis)
  const date = getStartOfDayTimeStamp(timestamp, offsetMilis)
  return date === today
}
/**
 * Determines if the given timestamp corresponds to yesterday's date, adjusted by the hour offset.
 *
 * @param timestamp - The timestamp to check.
 * @param hourOffset - The number of hours to offset the date comparison. Defaults to 0.
 * @returns True if the timestamp is within yesterday's date range, adjusted by the offset; otherwise, false.
 */
export const isYesterday = (timestamp: number, hourOffset = 0): boolean => {
  const offsetMilis = hourOffset * MILISECONDS_IN_HOUR
  const today = getStartOfDayTimeStamp(Date.now() - MILLISECONDS_IN_DAY, offsetMilis)
  const date = getStartOfDayTimeStamp(timestamp, offsetMilis)
  return date === today
}
