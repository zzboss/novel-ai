import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'
import { PromptLoader, AGENT_CATEGORY_MAP, AGENT_PROMPT_NAME_MAP } from '@/utils/promptLoader'
import type { EmotionResponseData } from '@/types/llm-response'

/**
 * 情感曲线 Agent（质量保障组）
 * 
 * 功能说明：
 * - 分析章节的情感曲线（如：平静 -> 紧张 -> 高潮 -> 释放）
 * - 提供情感曲线调整建议
 * - 支持指定情感弧线类型
 * 
 * 已从文件加载提示词：prompts/d_分析推理/emotion_agent/system_prompt.md
 */
export class EmotionAgent extends BaseAgent {
  /** Agent 类型标识 */
  readonly agentType = 'emotion' as const

  /** 
   * 加载 System Prompt（从文件，带缓存）
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
    const agentName = AGENT_PROMPT_NAME_MAP[this.agentType] || 'emotion_agent'

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
    const chapterId = input.type === 'emotion' ? (input as any).chapterId : ''
    const arcType = (input as any).arcType || '单章分析'

    let userPrompt = `# 请进行情感曲线分析\n\n`
    userPrompt += `**工作模式**：${arcType}\n\n`

    // 内容输入
    if (arcType === '全书曲线生成' || arcType === '问题诊断') {
      // 全书模式：使用各章摘要
      userPrompt += `## 内容输入\n\n`
      const chapters = (project as any).chapters || []
      for (const chapter of chapters) {
        userPrompt += `- 第${chapter.chapterNumber || '?'}章：${chapter.title || '...'} - ${chapter.summary || '...'}\n`
      }
      userPrompt += '\n'
    } else if (chapterId) {
      // 单章模式：使用章节正文
      const chapters = (project as any).chapters || []
      const chapter = chapters.find((c: any) => c.id === chapterId)
      if (chapter && chapter.content) {
        userPrompt += `## 内容输入\n\n${chapter.content}\n\n`
      }
    }

    // 故事类型与情感预期
    userPrompt += `## 故事类型与情感预期\n\n`
    userPrompt += `**类型**：${project.genre || '不限'}\n\n`
    userPrompt += `**情感基调**：${(project as any).tone || '不限'}\n\n`

    // 情感弧线类型
    if (arcType) {
      userPrompt += `## 情感弧线类型\n\n${arcType}\n\n`
    }

    userPrompt += '---\n\n请按照 system prompt 中的 JSON 格式，输出情感曲线分析。'

    return userPrompt
  }

  /**
   * 执行情感曲线分析（非流式，返回 JSON 格式）
   * 
   * 流程：
   * 1. 构建上下文和 User Prompt
   * 2. 加载 System Prompt（从文件）
   * 3. 调用 LLM 并解析 JSON 响应
   * 4. 提取情感曲线数据
   * 5. 返回 AgentOutput
   */
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    if (input.type !== 'emotion') {
      throw new Error('EmotionAgent 收到了错误的输入类型')
    }

    const ctx = await this.buildContext(input, context)
    const userPrompt = this.buildUserPrompt(input, context)

    // 加载 System Prompt
    const systemPrompt = await this.getSystemPrompt()

    const messages = [
      { role: 'system' as const, content: systemPrompt + '\n\n' + ctx },
      { role: 'user' as const, content: userPrompt }
    ]

    // 使用 callLLMJSON 调用 LLM 并解析 JSON
    const response = await this.callLLMJSON<{ success: boolean; data: EmotionResponseData; message?: string }>(messages, context)

    // 检查响应是否成功
    if (!response.success) {
      throw new Error(response.message || '情感曲线分析失败')
    }

    // 返回情感曲线分析结果
    const { chapterAnalysis, bookEmotionCurve, problems, optimizationSuggestions } = response.data
    
    // 根据模式选择返回的数据
    const emotionData = chapterAnalysis?.emotionCurve || bookEmotionCurve || []

    return {
      content: JSON.stringify(emotionData, null, 2),
      metadata: {
        emotionAnalysis: true,
        arcType: (input as any).arcType || '单章分析',
        mode: response.data.mode,
        hasEmotionCurve: emotionData.length > 0,
        problemsCount: problems?.length || 0,
        hasOptimizationSuggestions: !!optimizationSuggestions,
        chapterAnalysis: chapterAnalysis || null,
        bookEmotionCurve: bookEmotionCurve || null,
        problems: problems || null,
        optimizationSuggestions: optimizationSuggestions || null
      }
    }
  }
}
