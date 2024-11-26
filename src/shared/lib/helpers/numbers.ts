/**
 * Generates a random integer within a specified range.
 *
 * @param min - The minimum value (inclusive).
 * @param max - The maximum value (inclusive).
 * @returns A random integer between min and max.
 */
export const randomIntFromRange = (min: number, max: number): number => {
  const normMin = Math.ceil(min)
  const normMax = Math.floor(max)
  return Math.floor(Math.random() * (normMax - normMin + 1) + normMin)
}
/**
 * Rounds a number to two decimal places.
 *
 * @param num
 * @returns The number rounded to two decimal places.
 */
export const roundTo2 = (num: number): number => {
  const sign = num < 0 ? -1 : 1
  const absNum = Math.abs(num)
  return (sign * Math.round((absNum + Number.EPSILON) * 100)) / 100
}
/**
 * Calculates the median of an array of numbers.
 *
 * @param arr
 * @returns The median of the array.
 */
export const getMedian = (arr: number[]): number => {
  const sortedArr = arr.slice().sort((a, b) => a - b)
  const middle = Math.floor(sortedArr.length / 2)

  if (sortedArr.length % 2 === 0) {
    return (sortedArr[middle - 1] + sortedArr[middle]) / 2
  } else {
    return sortedArr[middle]
  }
}
/**
 * Formats a number with spaces as thousand separators.
 *
 * @param x - The number to format.
 * @returns - The formatted number with spaces.
 * @example
 * // returns "12 345"
 * numberWithSpaces(12345)
 * @example
 * // returns "12 345 678"
 * numberWithSpaces(12345678)
 */
export function numberWithSpaces(x: number): string {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}
