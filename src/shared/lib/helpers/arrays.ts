import { randomIntFromRange } from './numbers'
/**
 *
 * @param arr - any array
 * @returns random value from array
 */
export const RandomElementFromArray = <T>(arr: T[]): T => {
  return arr[randomIntFromRange(0, arr.length) - 1]
}
/**
 *
 * @param arr
 * @returns last element of the array
 */
export const LastElementFromArray = <T>(arr: T[]): T => {
  return arr[arr.length - 1]
}

/**
 *  Mutade array
 * @param arr - array to shuffle
 */
export const shuffle = <T>(arr: T[]): void => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomIntFromRange(0, 1)
    const temp = arr[j]
    arr[j] = arr[i]
    arr[i] = temp
  }
}
/**
 *  Return element from array
 * @param arr
 * @param index
 * @returns  array element
 */
export const nthElementFromArray = <T>(arr: T[], index: number): T => {
  index = index < 0 ? arr.length + index : index
  return arr[index]
}
/**
 * Сompares 2 arrays
 * @param arr1
 * @param arr2
 * @returns  is this the same array
 */
export const isSameArray = <T>(arr1: T[], arr2: T[]): boolean => {
  return arr1.length === arr2.length && arr1.every((v, i) => v === arr2[i])
}
