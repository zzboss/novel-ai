/**
 * 日志工具
 *
 * 封装 console 方法，根据环境变量控制日志输出。
 * 生产构建时配合 Vite 的 terser 配置自动移除 console 调用。
 */

const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development'

/** 日志级别 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/** 日志工具 */
export const logger = {
  debug(...args: unknown[]): void {
    if (isDev) console.debug('[DEBUG]', ...args)
  },

  log(...args: unknown[]): void {
    if (isDev) console.log('[LOG]', ...args)
  },

  info(...args: unknown[]): void {
    if (isDev) console.info('[INFO]', ...args)
  },

  warn(...args: unknown[]): void {
    if (isDev) console.warn('[WARN]', ...args)
  },

  error(...args: unknown[]): void {
    // 错误日志在生产环境也保留（可发送到错误追踪服务）
    console.error('[ERROR]', ...args)
  }
}
