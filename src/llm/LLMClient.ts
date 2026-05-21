import type { LLMMessage, ModelConfig, StreamCallbacks } from './types'
import { useProjectStore } from '@/stores/project'
import { logLLMInteraction } from '@/services/llmInteractionService'

/**
 * LLM 调用时的日志记录配置
 */
export interface LLMLoggingConfig {
  operationType: string;           // 操作类型：generateIdea, modifyIdea, etc.
  promptTemplateName?: string;     // prompt 模板名称（可选）
  inputParameters?: Record<string, unknown>;  // 输入参数（可选）
  projectPath?: string;           // 项目路径（可选，默认从 store 获取）
}

/**
 * LLM 统一调用入口
 * 通过 IPC 调用主进程中的 LLM API，避免 CORS 问题
 * 这是所有 Agent 与 LLM 交互的统一接口
 * 
 * 支持自动记录交互日志（通过传入 loggingConfig）
 */
export class LLMClient {
  /**
   * 普通对话调用
   * @param config - 模型配置对象
   * @param messages - 对话消息数组
   * @param agentName - 调用该请求的 Agent 名称（可选，用于调试）
   * @param loggingConfig - 日志记录配置（可选，传入后自动记录交互）
   * @returns 模型生成的完整回复字符串
   */
  static async chat(
    config: ModelConfig, 
    messages: LLMMessage[], 
    agentName?: string,
    loggingConfig?: LLMLoggingConfig
  ): Promise<string> {
    const timeout = config.timeout || this.getDefaultTimeout(config.provider)
    const api = (window as any).electronAPI
    const startTime = Date.now()
    
    // 构建完整的 input prompt（将所有 messages 拼接）
    const inputPrompt = messages.map(m => `${m.role}: ${m.content}`).join('\n\n')
    
    try {
      const response = await api?.llmChat({
        provider: config.provider,
        baseURL: config.baseURL,
        apiKey: config.apiKey,
        model: config.model,
        messages,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        timeout,  // 传递超时参数到主进程
        agentName  // 传递 Agent 名称到主进程
      })

      const durationMs = Date.now() - startTime

      if (!response.success) {
        const errorMsg = this.enhanceErrorMessage(response.error || 'LLM 调用失败')
        
        // 记录失败的交互
        if (loggingConfig) {
          await this.logInteraction(config, loggingConfig, inputPrompt, '', {
            status: 'error',
            error_message: errorMsg,
            duration_ms: durationMs
          })
        }
        
        throw new Error(errorMsg)
      }

      const outputResponse = response.content || ''

      // 记录成功的交互
      if (loggingConfig) {
        await this.logInteraction(config, loggingConfig, inputPrompt, outputResponse, {
          status: 'success',
          duration_ms: durationMs,
          tokens_input: response.tokens_input,
          tokens_output: response.tokens_output
        })
      }

      return outputResponse
    } catch (error) {
      // 如果还没有记录错误（上面的 !response.success 分支已经记录了），这里记录异常
      if (loggingConfig) {
        const durationMs = Date.now() - startTime
        const errorMsg = error instanceof Error ? error.message : String(error)
        
        // 检查是否已经记录了这个错误
        // （简单策略：总是记录，避免重复记录的逻辑太复杂）
        await this.logInteraction(config, loggingConfig, inputPrompt, '', {
          status: 'error',
          error_message: errorMsg,
          duration_ms: durationMs
        })
      }
      throw error
    }
  }

  /**
   * 内部方法：记录 LLM 交互
   */
  private static async logInteraction(
    config: ModelConfig,
    loggingConfig: LLMLoggingConfig,
    inputPrompt: string,
    outputResponse: string,
    options: {
      status: 'success' | 'error' | 'cancelled';
      error_message?: string;
      duration_ms?: number;
      tokens_input?: number;
      tokens_output?: number;
    }
  ): Promise<void> {
    try {
      // 获取项目路径
      const projectStore = useProjectStore()
      const projectPath = loggingConfig.projectPath || projectStore.project?.path || ''

      if (!projectPath) {
        console.warn('[LLMClient] 无法记录交互：未提供项目路径')
        return
      }

      // 异步记录，不阻塞主流程
      logLLMInteraction(
        projectPath,
        loggingConfig.operationType,
        { provider: config.provider, model: config.model },
        inputPrompt,
        outputResponse,
        {
          prompt_template_name: loggingConfig.promptTemplateName,
          input_parameters: loggingConfig.inputParameters,
          status: options.status,
          error_message: options.error_message,
          duration_ms: options.duration_ms,
          tokens_input: options.tokens_input,
          tokens_output: options.tokens_output
        }
      ).catch(err => {
        console.error('[LLMClient] 记录交互失败:', err)
      })
    } catch (err) {
      console.error('[LLMClient] 记录交互失败:', err)
    }
  }

  /**
   * 根据提供商获取默认超时时间
   */
  private static getDefaultTimeout(provider: string): number {
    const timeoutMap: Record<string, number> = {
      'ollama': 300_000,  // 本地模型默认 5 分钟
      'openai': 120_000,   // OpenAI 默认 2 分钟
      'claude': 120_000,   // Claude 默认 2 分钟
      'custom': 120_000     // 自定义接口默认 2 分钟
    }
    return timeoutMap[provider] || 120_000
  }

  /**
   * 增强错误信息，使其更用户友好
   */
  private static enhanceErrorMessage(originalError: string): string {
    if (originalError.includes('timed out') || originalError.includes('timeout')) {
      return '请求超时。可能原因：\n' +
             '1. 模型响应太慢（本地模型尤其常见）\n' +
             '2. 网络连接问题\n' +
             '3. API 服务不可用\n\n' +
             '建议：\n' +
             '- 本地模型：请在设置中增加超时时间\n' +
             '- 网络模型：请检查 API Key 和网络连接\n' +
             '- 尝试简化输入内容后重试'
    }
    
    if (originalError.includes('API key') || originalError.includes('authentication')) {
      return 'API 密钥错误，请在设置中检查 API Key 是否正确'
    }
    
    if (originalError.includes('quota') || originalError.includes('billing')) {
      return 'API 配额已用完，请检查账户余额'
    }
    
    return originalError
  }

  /**
   * 流式对话调用（异步生成器）
   * 真正流式：监听主进程发送的 token 事件
   * @param config - 模型配置对象
   * @param messages - 对话消息数组
   * @param agentName - 调用该请求的 Agent 名称（可选，用于调试）
   * @param loggingConfig - 日志记录配置（可选，传入后自动记录交互）
   * @returns 异步生成器，逐 token 产出生成内容
   */
  static async *stream(
    config: ModelConfig, 
    messages: LLMMessage[], 
    agentName?: string,
    loggingConfig?: LLMLoggingConfig
  ): AsyncGenerator<string> {
    const timeout = config.timeout || this.getDefaultTimeout(config.provider)
    const startTime = Date.now()
    
    let done = false
    let error: Error | null = null
    const tokenQueue: string[] = []
    let resolver: (() => void) | null = null
    let waiter: Promise<void> | null = null
    let fullResponse = ''  // 收集完整响应

    // 构建完整的 input prompt
    const inputPrompt = messages.map(m => `${m.role}: ${m.content}`).join('\n\n')

    // 监听主进程发送的 token 事件
    const onToken = (_event: any, data: { token: string; partial: string; done?: boolean }) => {
      if (data.done) {
        done = true
        if (resolver) resolver()
        return
      }
      
      tokenQueue.push(data.token)
      fullResponse += data.token  // 收集 token
      if (resolver) {
        resolver()
        resolver = null
        waiter = null
      }
    }

    // 监听完成事件
    const onDone = (_event: any, data: { success: boolean; content: string; tokenCount: number; totalTime: number }) => {
      done = true
      if (resolver) resolver()
      
      // 记录成功的交互
      if (loggingConfig) {
        const durationMs = Date.now() - startTime
        this.logInteraction(config, loggingConfig, inputPrompt, data.content || fullResponse, {
          status: 'success',
          duration_ms: durationMs,
          tokens_output: data.tokenCount
        }).catch(err => {
          console.error('[LLMClient] 记录交互失败:', err)
        })
      }
    }

    // 监听错误事件
    const onError = (_event: any, data: { success: false; error: string }) => {
      done = true
      error = new Error(this.enhanceErrorMessage(data.error))
      if (resolver) resolver()
      
      // 记录失败的交互
      if (loggingConfig) {
        const durationMs = Date.now() - startTime
        this.logInteraction(config, loggingConfig, inputPrompt, '', {
          status: 'error',
          error_message: error.message,
          duration_ms: durationMs
        }).catch(err => {
          console.error('[LLMClient] 记录交互失败:', err)
        })
      }
    }

    // 注册事件监听器
    const api = (window as any).electronAPI
    api?.on?.('llm:stream-token', onToken)
    api?.on?.('llm:stream-done', onDone)
    api?.on?.('llm:stream-error', onError)

    try {
      // 发送流式请求
      const api = (window as any).electronAPI
      api?.llmStream({
        provider: config.provider,
        baseURL: config.baseURL,
        apiKey: config.apiKey,
        model: config.model,
        messages,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        timeout,
        agentName  // 传递 Agent 名称到主进程
      })

      // 等待并处理 token
      while (!done || tokenQueue.length > 0) {
        if (tokenQueue.length > 0) {
          const token = tokenQueue.shift()!
          yield token
        } else if (!done) {
          // 等待新的 token
          waiter = new Promise<void>(resolve => { resolver = resolve })
          await waiter
        }
      }

      if (error) throw error
    } finally {
      // 移除事件监听器
      const api = (window as any).electronAPI
      api?.off?.('llm:stream-token', onToken)
      api?.off?.('llm:stream-done', onDone)
      api?.off?.('llm:stream-error', onError)
    }
  }

  /**
   * 流式对话调用（带回调函数）- 真正流式
   * @param config - 模型配置对象
   * @param messages - 对话消息数组
   * @param callbacks - 流式输出回调函数对象
   * @param agentName - 调用该请求的 Agent 名称（可选，用于调试）
   * @param loggingConfig - 日志记录配置（可选，传入后自动记录交互）
   * @returns Promise，完成时 resolve
   */
  static async streamWithCallbacks(
    config: ModelConfig,
    messages: LLMMessage[],
    callbacks: StreamCallbacks,
    agentName?: string,
    loggingConfig?: LLMLoggingConfig
  ): Promise<void> {
    try {
      for await (const token of this.stream(config, messages, agentName, loggingConfig)) {
        callbacks.onToken(token)
      }
      callbacks.onDone()
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * 健康检查
   * 检测指定模型的可用性和响应延迟，并尝试拉取可用模型列表
   * @param config - 模型配置对象
   * @returns 健康状态对象，包含是否可用、模型列表和错误信息
   */
  static async healthCheck(
    config: ModelConfig
  ): Promise<{ ok: boolean; models?: string[]; error?: string }> {
    try {
      const api = (window as any).electronAPI
      const response = await api?.llmHealthCheck({
        provider: config.provider,
        baseURL: config.baseURL,
        apiKey: config.apiKey,
        model: config.model,
        messages: [{ role: 'user', content: 'hi' }]
      })

      if (!response.success) {
        return { ok: false, error: response.error }
      }

      return { ok: true, models: response.models }
    } catch (error) {
      return { ok: false, error: String(error) }
    }
  }
}
