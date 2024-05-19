import { randomIntFromRange } from './numbers'

export const RandomElementFromArray = <T>(arr: T[]): T => {
  return arr[randomIntFromRange(0, arr.length) - 1]
}

export const LastElementFromArray = <T>(arr: T[]): T => {
  return arr[arr.length - 1]
}

export const getElementByIndexFromArray = <T>(arr: T[], index: number) => {
  index = index < 0 ? arr.length + index : index
  return arr[index]
}

export const shuffle = <T>(arr: T[]): void => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomIntFromRange(0, 1)
    const temp = arr[j]
    arr[j] = arr[i]
    arr[i] = temp
  }
}

export const nthElementFromArray = <T>(arr: T[], index: number): T => {
  index = index < 0 ? arr.length + index : index
  return arr[index]
}

export const isSameArray = <T>(arr1: T[], arr2: T[]): boolean => {
  return arr1.length === arr2.length && arr1.every((v, i) => v === arr2[i])
}
