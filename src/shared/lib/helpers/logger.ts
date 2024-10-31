type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface Logger {
  log: (level: LogLevel, message: string, ...data: any[]) => void
  info: (message: string, ...data: any[]) => void
  warn: (message: string, ...data: any[]) => void
  error: (message: string, ...data: any[]) => void
  debug: (message: string, ...data: any[]) => void
}

const colors = {
  info: '\x1b[34m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  debug: '\x1b[32m',
  reset: '\x1b[0m'
}

const logger: Logger = {
  log(level, message, ...data) {
    const timestamp = new Date().toISOString()
    const color = colors[level] || colors.info
    console.log(
      `${color}[${timestamp}] [${level.toUpperCase()}] ${message}${colors.reset}`,
      ...data
    )
  },

  info(message, ...data) {
    this.log('info', message, ...data)
  },

  warn(message, ...data) {
    this.log('warn', message, ...data)
  },

  error(message, ...data) {
    this.log('error', message, ...data)
  },

  debug(message, ...data) {
    this.log('debug', message, ...data)
  }
}

export default logger
