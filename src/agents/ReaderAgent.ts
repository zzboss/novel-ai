import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'
import { PromptLoader, AGENT_CATEGORY_MAP, AGENT_PROMPT_NAME_MAP } from '@/utils/promptLoader'
import type { ReaderResponseData } from '@/types/llm-response'

/**
 * 读者反馈 Agent（写作辅助组，唯一使用读者视角）
 * 
 * 功能说明：
 * - 模拟读者视角，提供阅读反馈
 * - 分析：哪里吸引人、哪里枯燥、哪里看不懂
 * - 支持指定反馈视角（如：新读者、老读者）
 * 
 * 已重构：从文件加载提示词，使用 callLLMJSON 解析 JSON 响应
 */
export class ReaderAgent extends BaseAgent {
  /** Agent 类型标识 */
  readonly agentType = 'reader' as const

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

    const category = AGENT_CATEGORY_MAP[this.agentType] || 'd_分析推理'
    const agentName = AGENT_PROMPT_NAME_MAP[this.agentType] || 'reader_agent'

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
    const chapterId = input.type === 'reader' ? input.chapterId : ''
    
    let userPrompt = `# 请从四类读者视角，对以下章节内容进行真实反馈模拟。\n\n`
    
    // 章节信息
    const chapters = (project as any).chapters || []
    const chapter = chapterId ? chapters.find((c: any) => c.id === chapterId) : null
    
    if (chapter) {
      userPrompt += `## 章节信息\n\n`
      userPrompt += `**章节标题**：${chapter.title || '...'}\n\n`
      userPrompt += `**章节在全书中的位置**：${chapter.chapterNumber || '...'}\n\n`
    }
    
    // 章节内容
    if (chapter?.content) {
      userPrompt += `## 章节内容\n\n${chapter.content}\n\n`
    }
    
    // 类型
    userPrompt += `## 类型\n\n${project.genre || '不限'}\n\n`
    
    // 故事背景简介
    if (project.synopsis) {
      userPrompt += `## 故事背景简介（帮助读者理解上下文）\n\n${project.synopsis}\n\n`
    }
    
    // 用户希望重点关注的方面
    const focusAreas = (input as any).focusAreas || ''
    if (focusAreas) {
      userPrompt += `## 用户希望重点关注的方面（可选）\n\n${focusAreas}\n\n`
    }
    
    userPrompt += '---\n\n请按照 system prompt 中的 JSON 格式，输出四类读者反馈报告。'
    
    return userPrompt
  }

  /**
   * 执行读者反馈分析（非流式，返回 JSON）
   * 
   * 流程：
   * 1. 构建上下文和 User Prompt
   * 2. 加载 System Prompt（从文件）
   * 3. 调用 LLM 并解析 JSON 响应
   * 4. 提取读者反馈数据
   * 5. 返回 AgentOutput
   */
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    const ctx = await this.buildContext(input, context)
    const userPrompt = this.buildUserPrompt(input, context)
    
    // 加载 System Prompt（从文件）
    const systemPrompt = await this.getSystemPrompt()
    
    const messages = [
      { role: 'system' as const, content: systemPrompt + '\n\n' + ctx },
      { role: 'user' as const, content: userPrompt }
    ]
    
    // 使用 callLLMJSON 调用 LLM 并解析 JSON 响应
    const response = await this.callLLMJSON<{ success: boolean; data: ReaderResponseData; message?: string }>(messages, context)
    
    // 检查响应是否成功
    if (!response.success) {
      console.error('[ReaderAgent] LLM 调用失败:', response.message)
      
      // 返回空结果
      return {
        content: '',
        metadata: {
          readerFeedback: true,
          error: response.message || 'LLM 调用失败'
        }
      }
    }
    
    // 返回读者反馈结果
    const { readerFeedback } = response.data
    
    return {
      content: JSON.stringify(readerFeedback, null, 2),
      metadata: {
        readerFeedback: true,
        coreFan: readerFeedback?.coreFan || {},
        casualReader: readerFeedback?.casualReader || {},
        criticalReader: readerFeedback?.criticalReader || {},
        newReader: readerFeedback?.newReader || {}
      }
    }
  }
}
