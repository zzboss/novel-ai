import OpenAI from 'openai'
import type { LLMMessage, ModelConfig } from '../types'

/**
 * 自定义 BaseURL 适配器
 * 
 * 功能说明：
 * - 支持自部署模型（如本地部署的 LLaMA、ChatGLM 等）
 * - 支持第三方提供的 OpenAI 兼容 API 服务
 * - 通过自定义 baseURL 连接到任意兼容 OpenAI 格式的服务
 * 
 * 使用场景：
 * - 企业内网部署的私有化模型
 * - 第三方 AI 服务商（非官方 OpenAI）
 * - 需要自定义 API 端点的场景
 * 
 * 注意事项：
 * - 必须配置正确的 baseURL
 * - 可能需要配置 API Key（取决于服务端要求）
 */
export class CustomAdapter {
  /**
   * 创建 OpenAI 兼容客户端实例
   * @param config - 模型配置对象
   * @returns OpenAI 兼容客户端实例
   */
  private createClient(config: ModelConfig): OpenAI {
    return new OpenAI({
      apiKey: config.apiKey || '', // 某些服务可能不需要 API Key
      baseURL: config.baseURL,
      timeout: 120_000 // 120 秒超时
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
}
