/**
 * LLMService - LLM调用服务
 *
 * 封装LLM调用逻辑：
 * - 构建消息数组
 * - 调用 LLMClient
 * - 处理错误和异常
 * - 支持中断
 */

import type { LLMMessage } from '@/llm/types'
import { LLMClient } from '@/llm/LLMClient'
import type { ModelConfig } from '@/llm/types'
import type { ConversationContext } from '@/utils/conversationManager'
import type { EditorContext } from '@/utils/IntentParser'

export class LLMService {
  private abortController: AbortController | null = null

  /**
   * 调用LLM生成回复
   */
  async generateReply(params: {
    modelConfig: ModelConfig
    conversationContext: ConversationContext
    userInput: string
    editorContext?: EditorContext
  }): Promise<string> {
    const { modelConfig, conversationContext, userInput, editorContext } = params

    // 构建消息数组
    const messages: LLMMessage[] = [
      { role: 'system', content: conversationContext.systemPrompt }
    ]

    // 添加历史消息
    for (const msg of conversationContext.recentMessages) {
      messages.push({
        role: msg.role,
        content: msg.content
      })
    }

    // 添加当前用户输入（附带编辑器上下文）
    let userMessage = userInput
    if (editorContext?.selectedText) {
      userMessage += `\n\n[选中内容]：\n${editorContext.selectedText.slice(0, 500)}`
    }
    if (editorContext?.chapterContent) {
      userMessage += `\n\n[章节内容]（节选）：\n${editorContext.chapterContent.slice(0, 1000)}`
    }
    messages.push({ role: 'user', content: userMessage })

    try {
      this.abortController = new AbortController()
      const reply = await LLMClient.chat(
        modelConfig,
        messages,
        'writing-assistant'
      )

      return reply
    } catch (err) {
      console.error('LLMService: LLM调用失败:', err)
      throw err
    }
  }

  /**
   * 停止生成
   */
  stop(): void {
    // 取消渲染进程中的 AbortController（用于 stream 模式）
    this.abortController?.abort()
    this.abortController = null
    
    // 通过 IPC 取消主进程中的请求（用于 chat 和 stream 模式）
    try {
      ;(window as any).electronAPI?.llmCancel()
    } catch (err) {
      console.error('LLMService: 取消请求失败:', err)
    }
  }

  /**
   * 是否正在生成
   */
  isGenerating(): boolean {
    return this.abortController !== null
  }
}
