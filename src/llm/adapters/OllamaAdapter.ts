import OpenAI from 'openai'
import type { LLMMessage, ModelConfig } from '../types'

/**
 * Ollama 本地模型适配器
 * 
 * 功能说明：
 * - 支持通过 Ollama 运行的本地开源模型
 * - 复用 OpenAI 兼容格式（Ollama 提供了 OpenAI 兼容接口）
 * - 无需 API Key，但需要本地运行 Ollama 服务
 * 
 * 使用说明：
 * - 需要先在本地安装并运行 Ollama
 * - 默认 baseURL 为 http://localhost:11434/v1
 * - 本地模型推理速度较慢，超时时间设置较长（300 秒）
 * - 推荐使用较小上下文窗口的模型（如 2048 tokens）
 */
export class OllamaAdapter {
  /**
   * 创建 OpenAI 兼容客户端实例
   * @param config - 模型配置对象
   * @returns OpenAI 兼容客户端实例
   */
  private createClient(config: ModelConfig): OpenAI {
    return new OpenAI({
      apiKey: 'ollama', // Ollama 不需要真实 key，传入任意字符串即可
      baseURL: config.baseURL || 'http://localhost:11434/v1',
      timeout: 300_000 // 本地模型超时时间更长（300 秒）
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
      max_tokens: config.maxTokens ?? 2048 // 本地模型默认使用较小上下文
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
      max_tokens: config.maxTokens ?? 2048,
      stream: true
    })

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content
      if (token) {
        yield token
      }
    }
  }
}
