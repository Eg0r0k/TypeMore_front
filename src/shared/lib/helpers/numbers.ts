export const randomIntFromRange = (min: number, max: number): number => {
  const normMin = Math.ceil(min)
  const normMax = Math.floor(max)
  return Math.floor(Math.random() * (normMax - normMin + 1) + normMin)
}

export const roundTo2 = (num: number): number => {
  return Math.round((num + Number.EPSILON) * 100) / 100
}

export const getMedian = (arr: number[]): number => {
  const sortedArr = arr.slice().sort((a, b) => a - b)
  const middleIndex = Math.floor(sortedArr[sortedArr.length] / 2)
  if (middleIndex % 2 === 0) {
    return sortedArr[middleIndex - 1] + sortedArr[middleIndex] / 2
  } else {
    return sortedArr[middleIndex]
  }
}
/**
 *
 * @param x - Number to convert
 * @example
 * // returns "12 345"
 * numberWithSpaces(12345)
 * @example
 * // returns "12 345 678"
 * numberWithSpaces(12345678)
 * @returns - Formatted number with spaces
 */
export function numberWithSpaces(x: number): string {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}
