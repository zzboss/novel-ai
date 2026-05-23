import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'
import { PromptLoader, AGENT_CATEGORY_MAP, AGENT_PROMPT_NAME_MAP } from '@/utils/promptLoader'
import type { ReviserResponseData } from '@/types/llm-response'

/**
 * 定点修复 Agent（对应 InkOS Reviser）
 *
 * 管线 Step 6：根据审计报告的关键问题，定点修复章节草稿
 * 调 LLM（推荐强模型），仅修改问题段落，保留已通过内容
 *
 * 核心原则：
 * - 最小化修改：仅修复审计指出的关键问题
 * - 保留已通过内容：不改动未标记问题的段落
 * - 修复验证：修复后关键问题应清零
 * - 最多3次循环：防止无限修复
 * 
 * 已重构：使用 this.callLLMJSON 解析 JSON 响应
 */
export class ReviserAgent extends BaseAgent {
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
    const agentName = AGENT_PROMPT_NAME_MAP[this.agentType] || 'reviser_agent'

    // 加载 System Prompt
    const systemPrompt = await PromptLoader.loadSystemPrompt(category, agentName)

    // 加载 Few-shot 示例（如果有），追加到 System Prompt 后面\
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
  private buildUserPrompt(input: AgentInput, _context: AgentContext): string {
    if (input.type !== 'reviser') {
      throw new Error('ReviserAgent 收到了错误的输入类型')
    }

    const { content, auditIssues } = input

    let userPrompt = `# 请根据审计报告修复以下章节草稿\n\n`

    // 审计报告
    userPrompt += `## 审计报告\n\n`
    userPrompt += `发现 ${auditIssues.length} 个问题：\n\n`

    const criticalIssues = auditIssues.filter(i => i.severity === 'critical' || i.severity === '关键' || i.severity === '严重')
    const suggestionIssues = auditIssues.filter(i => i.severity !== 'critical' && i.severity !== '关键' && i.severity !== '严重')

    if (criticalIssues.length > 0) {
      userPrompt += `### 关键问题（必须修复）\n\n`
      for (let i = 0; i < criticalIssues.length; i++) {
        userPrompt += `${i + 1}. **[${criticalIssues[i].severity}]** ${criticalIssues[i].description}\n`
      }
      userPrompt += '\n'
    }

    if (suggestionIssues.length > 0) {
      userPrompt += `### 建议性问题（可选修复）\n\n`
      for (let i = 0; i < suggestionIssues.length; i++) {
        userPrompt += `${i + 1}. [${suggestionIssues[i].severity}] ${suggestionIssues[i].description}\n`
      }
      userPrompt += '\n'
    }

    userPrompt += `## 章节草稿\n\n${content}\n\n`
    userPrompt += '---\n\n请仅修复标记为「关键」的问题，保留其他所有内容不变。使用 <!-- fix --> 标记修复的段落。'

    return userPrompt
  }

  /**
   * 执行定点修复（非流式，返回 JSON）
   * 
   * 流程：
   * 1. 检查输入类型
   * 2. 构建上下文和 User Prompt
   * 3. 加载 System Prompt（从文件）
   * 4. 调用 LLM 并解析 JSON 响应
   * 5. 清理修复标记
   * 6. 返回 AgentOutput
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

      // 使用 this.callLLMJSON 调用 LLM 并解析 JSON 响应
      const result = await this.callLLMJSON<ReviserResponseData>(messages, context)

      // 清理修复标记（保留纯正文）
      const cleanedContent = this.cleanFixMarkers(result.revisedContent || input.content || '')

      // 返回结构化的 JSON 数据
      return {
        content: cleanedContent,
        metadata: {
          hadMarkers: cleanedContent !== (result.revisedContent || ''),
          originalIssueCount: input.type === 'reviser' ? input.auditIssues.length : 0,
          fixedIssuesCount: result.summary?.fixedIssues || 0,
          data: result
        }
      }
    } catch (error) {
      console.error('[ReviserAgent] LLM 调用失败:', error)
      return {
        content: input.type === 'reviser' ? input.content || '' : '',
        metadata: {
          error: error instanceof Error ? error.message : 'LLM 调用失败',
          revised: false
        }
      }
    }
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
}
