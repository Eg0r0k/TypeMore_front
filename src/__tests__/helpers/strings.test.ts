import { getLastChar } from '@/shared/lib/helpers/string'
import { describe, it, expect } from 'vitest'

describe('getLastChar', () => {
  it('should return the last character of a string', () => {
    expect(getLastChar('hello')).toBe('o')
    expect(getLastChar('world')).toBe('d')
    expect(getLastChar('a')).toBe('a')
  })

  it('should handle empty string', () => {
    expect(getLastChar('')).toBe('')
  })

  it('should handle strings with spaces', () => {
    expect(getLastChar('hello world')).toBe('d')
    expect(getLastChar('  space  ')).toBe(' ')
  })

  it('should handle special characters', () => {
    expect(getLastChar('hello!')).toBe('!')
    expect(getLastChar('123#')).toBe('#')
    expect(getLastChar('привет')).toBe('т')
  })

  it('should handle null and undefined gracefully', () => {
    // @ts-expect-error function cant accept this args
    expect(getLastChar(null)).toBe('')
    // @ts-expect-error function cant accept this args
    expect(getLastChar(undefined)).toBe('')
  })
})
