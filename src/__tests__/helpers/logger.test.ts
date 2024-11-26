import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import logger from '@/shared/lib/helpers/logger'

describe('logger', () => {
  let consoleLogSpy: any

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-01-01T00:00:00.000Z')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should log info messages with correct format', () => {
    logger.info('Test info message', { data: 'test' })

    expect(consoleLogSpy).toHaveBeenCalledWith(
      '\x1b[34m[2024-01-01T00:00:00.000Z] [INFO] Test info message\x1b[0m',
      { data: 'test' }
    )
  })

  it('should log warn messages with correct format', () => {
    logger.warn('Test warning message', { data: 'test' })

    expect(consoleLogSpy).toHaveBeenCalledWith(
      '\x1b[33m[2024-01-01T00:00:00.000Z] [WARN] Test warning message\x1b[0m',
      { data: 'test' }
    )
  })

  it('should log error messages with correct format', () => {
    logger.error('Test error message', new Error('test error'))

    expect(consoleLogSpy).toHaveBeenCalledWith(
      '\x1b[31m[2024-01-01T00:00:00.000Z] [ERROR] Test error message\x1b[0m',
      new Error('test error')
    )
  })

  it('should log debug messages with correct format', () => {
    logger.debug('Test debug message', { debug: true })

    expect(consoleLogSpy).toHaveBeenCalledWith(
      '\x1b[32m[2024-01-01T00:00:00.000Z] [DEBUG] Test debug message\x1b[0m',
      { debug: true }
    )
  })

  it('should handle multiple data arguments', () => {
    logger.info('Multiple args', 1, 'two', { three: 3 })

    expect(consoleLogSpy).toHaveBeenCalledWith(
      '\x1b[34m[2024-01-01T00:00:00.000Z] [INFO] Multiple args\x1b[0m',
      1,
      'two',
      { three: 3 }
    )
  })

  it('should handle messages without additional data', () => {
    logger.info('Just a message')

    expect(consoleLogSpy).toHaveBeenCalledWith(
      '\x1b[34m[2024-01-01T00:00:00.000Z] [INFO] Just a message\x1b[0m'
    )
  })

  it('should use default color for unknown log levels', () => {
    // @ts-expect-error testing invalid log level
    logger.log('unknown', 'Test message')

    expect(consoleLogSpy).toHaveBeenCalledWith(
      '\x1b[34m[2024-01-01T00:00:00.000Z] [UNKNOWN] Test message\x1b[0m'
    )
  })
})
