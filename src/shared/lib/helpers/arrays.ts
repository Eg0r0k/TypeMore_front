import { randomIntFromRange } from './numbers'
/**
 *
 * @param arr - any array
 * @returns random value from array
 */
export const RandomElementFromArray = <T>(arr: T[]): T => {
  if (arr.length === 0) {
    throw new Error('Array cannot be empty')
  }
  const randomIndex = randomIntFromRange(0, arr.length - 1)
  return arr[randomIndex]
}
