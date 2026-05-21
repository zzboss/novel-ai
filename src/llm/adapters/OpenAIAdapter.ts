import OpenAI from 'openai'
import type { LLMMessage, ModelConfig } from '../types'

/**
 * OpenAI 适配器
 *
 * 功能说明：
 * - 支持 OpenAI 官方 API
 * - 兼容所有 OpenAI 格式的服务（Ollama、通义千问、DeepSeek、豆包等）
 * - 实现普通调用、流式调用和健康检查（含模型列表拉取）
 *
 * 使用说明：
 * - 云端模型需要配置 apiKey 和 baseURL
 * - 本地模型（如 Ollama）无需真实 apiKey，可传入任意字符串
 */
export class OpenAIAdapter {
  /**
   * 创建 OpenAI 客户端实例
   * @param config - 模型配置对象
   * @returns OpenAI 客户端实例
   */
  private createClient(config: ModelConfig): OpenAI {
    return new OpenAI({
      apiKey: config.apiKey || 'ollama', // Ollama 不需要真实 key
      baseURL: config.baseURL,
      timeout: 120_000, // 120 秒超时
      dangerouslyAllowBrowser: true // Electron 环境允许直接调用 API
    })
  }

  /**
   * 普通对话调用
   * @param messages - 对话消息数组
   * @param config - 模型配置对象
   * @returns 模型生成的完整回复字符串
   */
  async chat(messages: LLMMessage[], config: ModelConfig): Promise<string> {
    const client = this.createClient(config)
    const response = await client.chat.completions.create({
      model: config.model,
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 4096
    })
    return response.choices[0]?.message?.content || ''
  }

  /**
   * 流式对话调用
   * @param messages - 对话消息数组
   * @param config - 模型配置对象
   * @returns 异步生成器，逐 token 产出生成内容
   */
  async *stream(messages: LLMMessage[], config: ModelConfig): AsyncGenerator<string> {
    const client = this.createClient(config)
    const stream = await client.chat.completions.create({
      model: config.model,
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 4096,
      stream: true
    })

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content
      if (token) {
        yield token
      }
    }
  }

  /**
   * 健康检查 + 拉取模型列表
   * 1. 尝试调用 /v1/models 拉取可用模型（best-effort，失败后忽略）
   * 2. 用一条最短消息验证连通性
   *
   * @param config - 模型配置对象
   * @returns 健康状态 + 模型列表（如支持）
   */
  async healthCheck(
    config: ModelConfig
  ): Promise<{ ok: boolean; models?: string[]; error?: string }> {
    try {
      const client = this.createClient(config)

      // 尝试拉取模型列表（并非所有提供商都支持）
      let models: string[] | undefined
      try {
        const modelList = await client.models.list()
        models = modelList.data.map(m => m.id)
      } catch {
        // 忽略：不支持列出模型的提供商保持 models 为 undefined
      }

      // 用最短请求验证连通性
      await client.chat.completions.create({
        model: config.model,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1
      })

      return { ok: true, models }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}
