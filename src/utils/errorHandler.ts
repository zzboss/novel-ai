/**
 * 全局错误处理器
 *
 * 统一处理 Vue 组件错误和未捕获的 Promise 拒绝。
 */

import { AppError } from '@/types/errors'
import { logger } from '@/utils/logger'

/** Vue app.config.errorHandler 的参数类型 */
interface ErrorHandlerParams {
  component?: unknown
  info?: string
}

/**
 * 全局错误处理函数
 * 可配置给 app.config.errorHandler 和 window.unhandledrejection
 */
export function handleError(
  err: unknown,
  params: ErrorHandlerParams = {}
): void {
  if (err instanceof AppError) {
    logger.error(
      `[${err.code}] ${err.message}`,
      params.info ? `(info: ${params.info})` : '',
      err.originalError || ''
    )
  } else if (err instanceof Error) {
    logger.error(
      `[UNCAUGHT] ${err.message}`,
      params.info ? `(info: ${params.info})` : '',
      err.stack || ''
    )
  } else {
    logger.error('[UNCAUGHT]', err)
  }
}

/**
 * 注册全局错误处理器
 *
 * 用法：
 * ```typescript
 * import { registerErrorHandler } from '@/utils/errorHandler'
 *
 * const app = createApp(App)
 * registerErrorHandler(app)
 * app.mount('#app')
 * ```
 */
export function registerErrorHandler(app: {
  config: { errorHandler: (err: unknown, instance: unknown, info: string) => void }
}): void {
  app.config.errorHandler = (err: unknown, instance: unknown, info: string) => {
    handleError(err, { component: instance, info })
  }

  // 未捕获的 Promise 拒绝
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    handleError(event.reason, { info: 'unhandledrejection' })
  })
}
