import { ipcMain } from 'electron'
import OpenAI from 'openai'
import { getDatabase } from '../database/index'
import { saveLLMInteraction, type LLMInteractionCreateInput } from '../database/repositories/llmInteractionRepo'

/**
 * LLM API 代理 - 在主进程中执行 API 调用，避免 CORS 问题
 */

/** 当前正在进行的请求的 AbortController（用于取消） */
let currentAbortController: AbortController | null = null

interface LLMRequest {
  provider: string
  baseURL?: string
  apiKey?: string
  model: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  temperature?: number
  maxTokens?: number
  stream?: boolean
  timeout?: number  // 超时时间（毫秒），可选
  agentName?: string  // 调用该请求的 Agent 名称，用于调试
  projectPath?: string  // 项目路径（用于记录 LLM 交互日志）
}

/**
 * 记录 LLM 交互日志（辅助函数）
 */
async function logInteraction(
  projectPath: string | undefined,
  request: LLMRequest,
  inputPrompt: string,
  outputResponse: string,
  startTime: number,
  status: 'success' | 'error' = 'success',
  error_message?: string
): Promise<void> {
  if (!projectPath) return  // 如果没有项目路径，不记录

  try {
    const { db, save } = await getDatabase(projectPath)
    try {
      const input: LLMInteractionCreateInput = {
        operation_type: request.agentName || 'unknown',
        model_provider: request.provider,
        model_name: request.model,
        input_prompt: inputPrompt,
        output_response: outputResponse,
        duration_ms: Date.now() - startTime,
        status,
        error_message
      }
      saveLLMInteraction(db, input)
      save()
    } finally {
      db.close()
    }
  } catch (error) {
    console.error('[LLM IPC] 记录交互日志失败:', error)
  }
}

/**
 * 创建 OpenAI 客户端（复用兼容格式）
 */
function createClient(config: { baseURL?: string; apiKey?: string; timeout?: number }): OpenAI {
  const defaultTimeout = 300_000  // 默认 5 分钟（适合本地模型）
  const timeout = config.timeout || defaultTimeout
  
  return new OpenAI({
    apiKey: config.apiKey || 'ollama',
    baseURL: config.baseURL,
    timeout  // 使用请求指定的超时时间
  })
}

/**
 * 普通对话调用
 */
ipcMain.handle('llm:chat', async (_event, request: LLMRequest) => {
  // 创建 AbortController 支持取消
  const abortController = new AbortController()
  currentAbortController = abortController
  const startTime = Date.now()
  const inputPrompt = JSON.stringify(request.messages)

  try {
    const client = createClient({
      baseURL: request.baseURL,
      apiKey: request.apiKey,
      timeout: request.timeout
    })

    const response = await client.chat.completions.create(
      {
        model: request.model,
        messages: request.messages as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 4096
      },
      { signal: abortController.signal }  // 传递 signal 支持取消
    )

    // 请求完成后清除 currentAbortController
    currentAbortController = null

    const content = response.choices[0]?.message?.content || ''

    // 记录交互日志
    logInteraction(
      request.projectPath,
      request,
      inputPrompt,
      content,
      startTime,
      'success'
    )

    return {
      success: true,
      content
    }
  } catch (error) {
    // 请求完成后清除 currentAbortController
    currentAbortController = null

    // 检查是否是取消错误
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: '用户取消了请求'
      }
    }

    const errorMessage = error instanceof Error ? error.message : String(error)

    // 记录失败的交互日志
    logInteraction(
      request.projectPath,
      request,
      inputPrompt,
      '',
      startTime,
      'error',
      errorMessage
    )

    return {
      success: false,
      error: errorMessage
    }
  }
})

/**
 * 流式对话调用（真正流式：分块发送到渲染进程）
 * 使用 event.sender.send() 将每个 token 实时发送到渲染进程
 */
ipcMain.handle('llm:stream', async (event, request: LLMRequest) => {
  // 创建 AbortController 支持取消
  const abortController = new AbortController()
  currentAbortController = abortController
  const startTime = Date.now()
  const inputPrompt = JSON.stringify(request.messages)

  try {
    const client = createClient({
      baseURL: request.baseURL,
      apiKey: request.apiKey,
      timeout: request.timeout
    })

    const stream = await client.chat.completions.create(
      {
        model: request.model,
        messages: request.messages as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 4096,
        stream: true
      },
      { signal: abortController.signal }  // 传递 signal 支持取消
    )

    // 节流发送到渲染进程（累积 delta，避免频繁 IPC 调用）
    let content = ''
    let tokenCount = 0
    let pendingDelta = ''  // 累积待发送的增量内容
    const THROTTLE_INTERVAL = 5  // 每 5 个 token 发送一次
    const FLUSH_THRESHOLD = 200  // 或累积超过 200 字符时发送
    
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content
      if (token) {
        content += token
        tokenCount++
        pendingDelta += token
        
        // 节流：每 N 个 token 或累积内容超过阈值时发送
        if (tokenCount % THROTTLE_INTERVAL === 0 || pendingDelta.length >= FLUSH_THRESHOLD || tokenCount === 1) {
          event.sender.send('llm:stream-token', {
            token: pendingDelta,  // 发送累积的增量内容
            partial: content,
            tokenCount,
            elapsedTime: Date.now() - startTime
          })
          pendingDelta = ''
        }
      }
    }
    
    // 发送剩余未 flush 的内容
    if (pendingDelta) {
      event.sender.send('llm:stream-token', {
        token: pendingDelta,
        partial: content,
        tokenCount,
        elapsedTime: Date.now() - startTime
      })
    }

    // 发送完成事件
    event.sender.send('llm:stream-done', {
      success: true,
      content,
      tokenCount,
      totalTime: Date.now() - startTime
    })

    // 记录交互日志
    logInteraction(
      request.projectPath,
      request,
      inputPrompt,
      content,
      startTime,
      'success'
    )

    return {
      success: true,
      content
    }
  } catch (error) {
    // 请求完成后清除 currentAbortController
    currentAbortController = null

    // 检查是否是取消错误
    if (error instanceof Error && error.name === 'AbortError') {
      event.sender.send('llm:stream-error', {
        success: false,
        error: '用户取消了请求',
        cancelled: true
      })
      
      return {
        success: false,
        error: '用户取消了请求'
      }
    }

    const errorMessage = error instanceof Error ? error.message : String(error)

    // 发送错误事件
    event.sender.send('llm:stream-error', {
      success: false,
      error: errorMessage
    })

    // 记录失败的交互日志
    logInteraction(
      request.projectPath,
      request,
      inputPrompt,
      '',
      startTime,
      'error',
      errorMessage
    )

    return {
      success: false,
      error: errorMessage
    }
  }
})

/**
 * 取消正在进行的 LLM 请求
 */
ipcMain.handle('llm:cancel', async (_event) => {
  if (currentAbortController) {
    currentAbortController.abort()
    currentAbortController = null
    return { success: true }
  }
  return { success: false, error: '没有正在进行的请求' }
})

/**
 * 健康检查 + 拉取模型列表
 */
ipcMain.handle('llm:healthCheck', async (_event, request: LLMRequest) => {
  try {
    const client = createClient({
      baseURL: request.baseURL,
      apiKey: request.apiKey
    })

    // 尝试拉取模型列表
    let models: string[] | undefined
    try {
      const modelList = await client.models.list()
      models = modelList.data.map(m => m.id)
    } catch {
      // 忽略：不支持列出模型的提供商
    }

    // 用最短请求验证连通性
    await client.chat.completions.create({
      model: request.model,
      messages: [{ role: 'user', content: 'hi' }],
      max_tokens: 1
    })

    return {
      success: true,
      models
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
})
