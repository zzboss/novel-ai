import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'
import { PromptLoader, AGENT_CATEGORY_MAP, AGENT_PROMPT_NAME_MAP } from '@/utils/promptLoader'
import type { RevisionResponseData } from '@/types/llm-response'

/**
 * 修订 Agent（对应 InkOS 的 Reviser）
 * 
 * 功能：
 * 1. 接收评估报告和原始草稿
 * 2. 定点修复关键问题（只修改有问题的部分）
 * 3. 输出修订后的草稿
 * 
 * 设计思路：
 * - 参考 InkOS 的 Reviser 模式
 * - 使用"定点修复"策略，而非全章重写
 * - 保留未提及的优质内容
 * 
 * 已重构：使用 this.callLLMJSON 解析 JSON 响应
 */
export class RevisionAgent extends BaseAgent {
  /** Agent 类型标识 */
  readonly agentType = 'reviser' as const

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

    const category = AGENT_CATEGORY_MAP[this.agentType] || 'c_快速执行'
    const agentName = AGENT_PROMPT_NAME_MAP[this.agentType] || 'revision_agent'

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
   * 修订章节（定点修复）
   * 
   * @param content - 原始草稿
   * @param evaluation - 质量评估结果
   * @param context - Agent 执行上下文
   * @returns 修订后的草稿
   */
  async revise(
    content: string,
    evaluation: any, // QualityEvaluation 类型
    context: AgentContext
  ): Promise<string> {
    // 如果没有关键问题，直接返回原稿
    if (!evaluation.criticalIssues || evaluation.criticalIssues.length === 0) {
      return content
    }

    // 构建修订提示词
    const prompt = await this.buildRevisionPrompt(content, evaluation)

    // 加载 System Prompt
    const systemPrompt = await this.getSystemPrompt()

    // 调用 LLM 进行定点修复
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: prompt }
    ]

    try {
      // 使用 this.callLLMJSON 调用 LLM 并解析 JSON 响应
      const result = await this.callLLMJSON<RevisionResponseData>(messages, context)

      // 返回修复后的内容
      return result.revisedContent || content
    } catch (error) {
      console.error('[RevisionAgent] LLM 调用失败:', error)
      return content // 返回原稿
    }
  }

  /**
   * 构建修订提示词
   */
  private async buildRevisionPrompt(content: string, evaluation: any): Promise<string> {
    let prompt = `# 请对以下章节进行定点修复\n\n`

    prompt += `## 关键问题列表\n\n`
    for (const issue of evaluation.criticalIssues) {
      prompt += `- [${issue.dimension}] ${issue.description}\n`
      if (issue.evidence) {
        prompt += `  证据：${issue.evidence}\n`
      }
    }

    prompt += `\n## 修订要求\n\n`
    prompt += `- 只修复上述关键问题，不要重写整个章节\n`
    prompt += `- 保留未提及的优质内容\n`
    prompt += `- 修复后重新输出完整章节\n\n`

    prompt += `## 原始章节\n\n${content}`

    return Promise.resolve(prompt)
  }

  /**
   * 清理修复标记，保留纯正文
   */
  private cleanFixMarkers(content: string): string {
    return content
      .replace(/<!--\s*fix\s*-->/g, '')
      .replace(/<!--\s*\/fix\s*-->/g, '')
      .trim()
  }

  /**
   * 执行修订（非流式，返回 JSON 格式）
   * 
   * 流程：
   * 1. 检查输入类型
   * 2. 调用 revise() 进行定点修复
   * 3. 清理修复标记
   * 4. 返回 AgentOutput
   */
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    if (input.type !== 'reviser') {
      throw new Error('RevisionAgent 收到了错误的输入类型')
    }

    try {
      const revisedContent = await this.revise(input.content, input.auditIssues, context)

      // 清理修复标记
      const cleanedContent = this.cleanFixMarkers(revisedContent)

      return {
        content: cleanedContent,
        metadata: {
          revised: true,
          issuesFixed: input.auditIssues?.length || 0
        }
      }
    } catch (error) {
      console.error('[RevisionAgent] 执行失败:', error)
      return {
        content: input.content || '',
        metadata: {
          error: error instanceof Error ? error.message : 'LLM 调用失败',
          revised: false
        }
      }
    }
  }
}
