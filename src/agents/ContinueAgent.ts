import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'
import { PromptLoader, AGENT_CATEGORY_MAP, AGENT_PROMPT_NAME_MAP } from '@/utils/promptLoader'
import type { ContinueResponseData } from '@/types/llm-response'

/**
 * 续写 Agent（写作执行组）
 * 
 * 功能说明：
 * - 在光标位置继续写作
 * - 自动理解上下文，保持文风和剧情连贯
 * - 支持指定续写字数
 * 
 * 已重构：从文件加载提示词，使用 callLLMJSON 解析 JSON 响应
 */
export class ContinueAgent extends BaseAgent {
  /** Agent 类型标识 */
  readonly agentType = 'continue' as const

  /**
   * 从文件加载的 System Prompt（延迟加载，首次调用时加载并缓存）
   */
  private systemPromptCache: string | null = null

  /**
   * 获取 System Prompt（从文件加载，带缓存）
   */
  private async getSystemPrompt(): Promise<string> {
    if (this.systemPromptCache) {
      return this.systemPromptCache
    }

    const category = AGENT_CATEGORY_MAP[this.agentType] || 'a_精密构造'
    const agentName = AGENT_PROMPT_NAME_MAP[this.agentType] || 'continue_agent'
    
    // 加载 System Prompt
    const systemPrompt = await PromptLoader.loadSystemPrompt(category, agentName)
    
    // 加载 Few-shot 示例（如果有），追加到 System Prompt 后面
    const fewShot = await PromptLoader.loadFewShotExamples(category, agentName)
    
    // 组装最终 System Prompt
    this.systemPromptCache = systemPrompt + (fewShot ? '\n\n---\n\n' + fewShot : '')
    
    return this.systemPromptCache
  }

  /**
   * 清除提示词缓存（当提示词文件更新时调用）
   */
  clearPromptCache(): void {
    this.systemPromptCache = null
    PromptLoader.clearCache()
  }

  /**
   * 构建 User Prompt
   */
  private buildUserPrompt(input: AgentInput, context: AgentContext): string {
    const project = context.project
    const chapterId = input.type === 'continue' ? input.chapterId : ''
    const cursorPosition = input.type === 'continue' ? (input as any).cursorPosition : 0
    
    // 获取章节内容
    const chapters = (project as any).chapters || []
    const chapter = chapters.find((c: any) => c.id === chapterId)
    const chapterContent = chapter?.content || ''
    
    // 获取前文（光标位置之前的内容，最多1500字）
    const precedingContent = chapterContent.substring(0, cursorPosition).slice(-1500)
    
    let userPrompt = `# 请根据以下内容，无缝续写故事。\n\n`
    
    // 前文
    userPrompt += `## 前文（最近约1500字）\n\n${precedingContent}\n\n`
    
    // 本章概要
    if (chapter?.outline) {
      userPrompt += `## 本章概要（供参考）\n\n${chapter.outline}\n\n`
    }
    
    // 续写方向（可选）
    const continuationDirection = input.type === 'continue' ? (input as any).continuationDirection : undefined
    if (continuationDirection) {
      userPrompt += `## 续写方向（可选）\n\n${continuationDirection}\n\n`
    }
    
    // 续写字数上限
    const maxWords = input.type === 'continue' ? ((input as any).maxWords || 500) : 500
    userPrompt += `## 续写字数上限\n\n${maxWords} 字\n\n`
    
    userPrompt += '---\n\n请按照 system prompt 中的 JSON 格式，输出续写结果。'
    
    return userPrompt
  }

  /**
   * 执行续写（非流式，返回 JSON）
   */
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    try {
      const ctx = await this.buildContext(input, context)
      const userPrompt = this.buildUserPrompt(input, context)
      
      // 获取 System Prompt（从文件加载）
      const systemPrompt = await this.getSystemPrompt()
      
      const messages = [
        { role: 'system' as const, content: systemPrompt + '\n\n' + ctx },
        { role: 'user' as const, content: userPrompt }
      ]
      
      // 使用 callLLMJSON 调用 LLM 并解析 JSON 响应
      const result = await this.callLLMJSON<ContinueResponseData>(messages, context)
      
      // 返回结构化的 JSON 数据
      return {
        content: result.continuedText || '',
        metadata: {
          continuation: true,
          wordCount: result.wordCount || 0,
          analysis: result.analysis || {}
        }
      }
    } catch (error) {
      console.error('[ContinueAgent] LLM 调用失败:', error)
      return {
        content: '',
        metadata: {
          error: error instanceof Error ? error.message : 'LLM 调用失败',
          continuation: true
        }
      }
    }
  }

  /**
   * 流式执行续写（已禁用，改为非流式）
   */
  async *stream(input: AgentInput, context: AgentContext): AsyncGenerator<string> {
    const result = await this.execute(input, context)
    yield JSON.stringify(result, null, 2)
  }
}
