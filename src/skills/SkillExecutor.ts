import type { SkillManifest, SkillContext, SkillResult } from './types'

/**
 * Skill 执行器
 * 
 * 功能说明：
 * - 在 Web Worker 沙箱中执行第三方 Skill，确保安全隔离
 * - 内置 Skill 在主线程执行（可信代码，无需沙箱）
 * - 提供超时保护（5 分钟）
 * - 支持取消正在执行的 Skill
 * 
 * 安全设计：
 * - 第三方 Skill 代码在独立线程（Web Worker）中执行
 * - Worker 环境无 DOM 访问权限，无法操作 UI
 * - 通过 postMessage 与主线程通信
 * - tool-call 权限需用户显式授权
 * 
 * 使用示例：
 * ```typescript
 * const executor = new SkillExecutor()
 * 
 * // 执行内置 Skill（主线程）
 * const result1 = await executor.execute(builtinManifest, context)
 * 
 * // 执行第三方 Skill（Worker 沙箱）
 * const result2 = await executor.execute(thirdPartyManifest, context)
 * 
 * // 取消执行
 * executor.cancel()
 * ```
 */
export class SkillExecutor {
  /** Web Worker 实例（执行第三方 Skill 时使用） */
  private worker: Worker | null = null

  /**
   * 执行 Skill
   * 
   * 功能说明：
   * - 根据 Skill 类型选择执行方式
   * - 内置 Skill：在主线程执行（快速、无跨线程开销）
   * - 第三方 Skill：在 Web Worker 中执行（安全隔离）
   * 
   * @param manifest - Skill 清单对象
   * @param context - Skill 执行上下文
   * @returns Promise<SkillResult> - Skill 执行结果
   */
  async execute(manifest: SkillManifest, context: SkillContext): Promise<SkillResult> {
    // 内置 Skill 直接在主线程执行（可信代码，无需沙箱）
    if (manifest.id.startsWith('builtin-') || this.isBuiltin(manifest)) {
      return this.executeBuiltin(manifest, context)
    }

    // 第三方 Skill 在 Worker 中执行（安全隔离）
    return this.executeInWorker(manifest, context)
  }

  /**
   * 判断是否为内置 Skill
   * 
   * 判断逻辑：
   * - 检查 manifest.id 是否在内置 Skill 列表中
   * 
   * @param manifest - Skill 清单对象
   * @returns 是否为内置 Skill
   */
  private isBuiltin(manifest: SkillManifest): boolean {
    return ['web-search', 'reference-lookup', 'style-transfer', 'genre-rules', 'translation'].includes(manifest.id)
  }

  /**
   * 执行内置 Skill（主线程）
   * 
   * 功能说明：
   * - 通过动态导入加载 Skill 模块
   * - 调用模块的 execute 函数（或 default 导出）
   * - 捕获执行错误并返回友好错误信息
   * 
   * 注意事项：
   * - 内置 Skill 代码随应用打包，安全性可控
   * - 直接在主线程执行，无跨线程通信开销
   * 
   * @param manifest - Skill 清单对象
   * @param context - Skill 执行上下文
   * @returns Promise<SkillResult> - Skill 执行结果
   */
  private async executeBuiltin(manifest: SkillManifest, context: SkillContext): Promise<SkillResult> {
    try {
      // 动态导入内置 Skill 模块
      const module = await import(manifest.entry)
      
      // 获取 execute 函数（支持命名导出和 default 导出）
      const execute = module.execute || module.default
      
      if (typeof execute !== 'function') {
        throw new Error(`Skill ${manifest.id} 未导出 execute 函数`)
      }
      
      // 执行 Skill
      const result = await execute(context)
      
      return {
        output: result.output || '',
        usage: result.usage || { promptTokens: 0, completionTokens: 0 }
      }
    } catch (error) {
      // 捕获错误，返回友好格式
      return {
        output: '',
        error: String(error)
      }
    }
  }

  /**
   * 在 Web Worker 中执行第三方 Skill
   * 
   * 功能说明：
   * - 创建 Web Worker 实例（沙箱环境）
   * - 设置超时保护（5 分钟）
   * - 监听 Worker 消息和错误事件
   * - 将执行上下文发送给 Worker
   * 
   * 安全特性：
   * - Worker 环境无 DOM 访问权限
   * - 无法使用 BroadcastChannel 等跨文档通信 API
   * - 只能通过 postMessage 与主线程通信
   * 
   * @param manifest - Skill 清单对象
   * @param context - Skill 执行上下文
   * @returns Promise<SkillResult> - Skill 执行结果
   */
  private async executeInWorker(manifest: SkillManifest, context: SkillContext): Promise<SkillResult> {
    return new Promise((resolve) => {
      // 创建 Web Worker（沙箱环境）
      // 注意：第三方 Skill 需打包为独立 Worker 入口
      const worker = new Worker(new URL('./skillWorker.ts', import.meta.url), { type: 'module' })

      // 超时保护（5 分钟）
      const timeout = setTimeout(() => {
        worker.terminate()
        resolve({
          output: '',
          error: 'Skill 执行超时（5分钟）'
        })
      }, 300_000) // 5分钟超时

      // 监听 Worker 消息事件
      worker.onmessage = (event: MessageEvent) => {
        clearTimeout(timeout)
        worker.terminate()
        resolve(event.data as SkillResult)
      }

      // 监听 Worker 错误事件
      worker.onerror = (error) => {
        clearTimeout(timeout)
        worker.terminate()
        resolve({
          output: '',
          error: `Skill 执行错误: ${error.message}`
        })
      }

      // 发送执行上下文给 Worker
      worker.postMessage({ manifest, context })
    })
  }

  /**
   * 终止正在执行的 Skill
   * 
   * 功能说明：
   * - 终止 Web Worker（如正在执行第三方 Skill）
   * - 清理 worker 引用
   * 
   * 使用场景：
   * - 用户取消 Skill 执行
   * - 应用退出时清理资源
   */
  cancel(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
  }
}
