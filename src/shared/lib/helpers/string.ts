/**
 * Returns the last character of a given string.
 * @param word - The string from which to retrieve the last character.
 * @returns The last character of the string, or an empty string if the input is not valid.
 */
export const getLastChar = (word: string): string => {
  try {
    return word.charAt(word.length - 1)
  } catch {
    return ''
  }
}
