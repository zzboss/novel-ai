import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'
import { PromptLoader, AGENT_CATEGORY_MAP, AGENT_PROMPT_NAME_MAP } from '@/utils/promptLoader'
import type { PacingResponseData } from '@/types/llm-response'

/**
 * 节奏把控 Agent（质量保障组）
 * 
 * 功能说明：
 * - 分析章节的节奏（如：是否过于拖沓、是否过于紧凑）
 * - 提供节奏调整建议
 * - 支持指定目标节奏（如：紧张、舒缓、平衡）
 * 
 * 已从文件加载提示词：prompts/d_分析推理/pacing_agent/system_prompt.md
 */
export class PacingAgent extends BaseAgent {
  /** Agent 类型标识 */
  readonly agentType = 'pacing' as const

  /** 
   * 加载 System Prompt（从文件）
   */
  private async getSystemPrompt(): Promise<string> {
    try {
      const prompt = await PromptLoader.loadSystemPrompt(
        AGENT_CATEGORY_MAP.pacing,
        AGENT_PROMPT_NAME_MAP.pacing
      )
      return prompt
    } catch (error) {
      console.error('[PacingAgent] 加载 system_prompt 失败，使用默认提示词:', error)
      // 返回默认提示词（简化版）
      return `你是一位专业的小说节奏分析师。分析章节节奏，提供调整建议。
      
## 输出格式要求

**重要：你必须返回严格的 JSON 格式！**

输出格式如下：
\`\`\`json
{
  "success": true,
  "data": {
    "overallScore": 3,
    "rhythmAnalysis": {
      "informationDensity": { "score": 3, "analysis": "分析" },
      "sceneSwitching": { "score": 3, "analysis": "分析" },
      "dialogueDescriptionRatio": { "score": 3, "analysis": "分析" },
      "actionStagnationRatio": { "score": 3, "analysis": "分析" },
      "tensionRhythm": { "score": 3, "analysis": "分析" }
    },
    "suggestions": ["建议1", "建议2"]
  }
}
\`\`\`

---

**重要提醒：只返回 JSON，不要返回其他内容！**`
    }
  }

  /**
   * 构建 User Prompt
   */
  private buildUserPrompt(input: AgentInput, context: AgentContext): string {
    if (input.type !== 'pacing') {
      throw new Error('PacingAgent 收到了错误的输入类型')
    }

    const { chapterId, targetPace } = input as any
    const project = context.project

    let userPrompt = `# 请对以下章节进行节奏分析\n\n`

    // 章节信息
    const chapters = (project as any).chapters || []
    const chapter = chapterId ? chapters.find((c: any) => c.id === chapterId) : null

    if (chapter) {
      userPrompt += `## 章节信息\n\n`
      userPrompt += `**章节标题**：${chapter.title || '...'}\n`
      userPrompt += `**章节在全书中的位置**：${chapter.chapterNumber || '...'}\n\n`
    }

    // 章节内容
    if (chapter?.content) {
      userPrompt += `## 章节内容\n\n${chapter.content}\n\n`
    }

    // 目标节奏
    if (targetPace) {
      userPrompt += `## 目标节奏（可选）\n\n${targetPace}\n\n`
    }

    userPrompt += '---\n\n请按照 system prompt 中的 JSON 格式，输出节奏分析报告。'

    return userPrompt
  }

  /**
   * 执行节奏把控分析（非流式，返回 JSON 格式）
   * 
   * 流程：
   * 1. 加载 System Prompt（从文件）
   * 2. 构建上下文和 User Prompt
   * 3. 调用 LLM 并解析 JSON 响应
   * 4. 提取节奏分析数据
   * 5. 返回 AgentOutput
   */
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    const ctx = await this.buildContext(input, context)
    const userPrompt = this.buildUserPrompt(input, context)
    
    // 加载 System Prompt
    const systemPrompt = await this.getSystemPrompt()
    
    const messages = [
      { role: 'system' as const, content: systemPrompt + '\n\n' + ctx },
      { role: 'user' as const, content: userPrompt }
    ]
    
    // 使用 callLLMJSON 调用 LLM 并解析 JSON
    const response = await this.callLLMJSON<{ success: boolean; data: PacingResponseData; message?: string }>(messages, context)
    
    // 检查响应是否成功
    if (!response.success) {
      throw new Error(response.message || '节奏分析失败')
    }
    
    // 返回节奏分析结果
    const { overallScore, rhythmAnalysis, suggestions } = response.data
    
    return {
      content: JSON.stringify(response.data, null, 2),
      metadata: {
        pacingAnalysis: true,
        overallScore,
        rhythmAnalysis,
        suggestions: suggestions || []
      }
    }
  }
}
