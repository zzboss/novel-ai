import Anthropic from '@anthropic-ai/sdk'
import type { LLMMessage, ModelConfig } from '../types'

/**
 * Claude 适配器
 * 
 * 功能说明：
 * - 支持 Anthropic Claude 系列模型
 * - Claude API 格式与 OpenAI 不同，需要单独适配
 * - system 提示需要作为独立参数传递，不能放在 messages 中
 * 
 * 使用说明：
 * - 需要配置 Anthropic API Key
 * - 支持 Claude 3 系列（Opus/Sonnet/Haiku）
 */
export class ClaudeAdapter {
  /**
   * 创建 Anthropic 客户端实例
   * @param config - 模型配置对象
   * @returns Anthropic 客户端实例
   */
  private createClient(config: ModelConfig): Anthropic {
    return new Anthropic({
      apiKey: config.apiKey || '',
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
    const { system, anthropicMessages } = this.convertMessages(messages)

    const response = await client.messages.create({
      model: config.model,
      system,
      messages: anthropicMessages,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 4096
    })

    const content = response.content[0]
    return content.type === 'text' ? content.text : ''
  }

  /**
   * 流式对话调用
   * @param messages - 对话消息数组
   * @param config - 模型配置对象
   * @returns 异步生成器，逐 token 产出生成内容
   */
  async *stream(messages: LLMMessage[], config: ModelConfig): AsyncGenerator<string> {
    const client = this.createClient(config)
    const { system, anthropicMessages } = this.convertMessages(messages)

    const stream = await client.messages.stream({
      model: config.model,
      system,
      messages: anthropicMessages,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 4096
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text
      }
    }
  }

  /**
   * 将通用消息格式转换为 Claude API 格式
   * 
   * 格式差异说明：
   * - OpenAI 格式：system 消息放在 messages 数组中
   * - Claude 格式：system 提示作为独立参数传递
   * 
   * @param messages - 通用消息数组
   * @returns 包含 system 提示和 anthropicMessages 的对象
   */
  private convertMessages(messages: LLMMessage[]): {
    system: string
    anthropicMessages: Anthropic.MessageParam[]
  } {
    let system = ''
    const anthropicMessages: Anthropic.MessageParam[] = []

    for (const msg of messages) {
      if (msg.role === 'system') {
        // Claude 的 system 提示需要单独提取
        system = msg.content
      } else {
        // 其他消息放入 anthropicMessages 数组
        anthropicMessages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })
      }
    }

    return { system, anthropicMessages }
  }
}
