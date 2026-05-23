import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'
import { PromptLoader, AGENT_CATEGORY_MAP, AGENT_PROMPT_NAME_MAP } from '@/utils/promptLoader'
import type { AntiAIResponseData } from '@/types/llm-response'

/**
 * 降 AI 味 Agent（质量保障组）
 * 
 * 功能说明：
 * - 检测内容中的"AI 味"（如：过于规整的句式、过于书面化的表达）
 * - 提供修改建议，使内容更自然、更像人类写作
 * - 支持指定降 AI 味的级别
 * 
 * 已重构：从文件加载提示词，使用 callLLMJSON 解析 JSON 响应
 */
export class AntiAIAgent extends BaseAgent {
  /** Agent 类型标识 */
  readonly agentType = 'anti_ai' as const

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
    const agentName = AGENT_PROMPT_NAME_MAP[this.agentType] || 'anti_ai_agent'
    
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
    const content = input.type === 'anti_ai' ? input.content : ''
    const level = input.type === 'anti_ai' ? (input.level ?? 3) : 3
    
    let userPrompt = `# 请对以下文本进行 AI 腔检测和处理。\n\n`
    userPrompt += `## 待处理文本\n\n${content}\n\n`
    
    // 处理级别
    const processingLevel = level <= 2 ? '轻度：词汇替换' : level <= 4 ? '中度：句式重构' : '深度：段落重塑'
    userPrompt += `## 处理级别\n\n${processingLevel}\n\n`
    
    // 文风参考
    const project = context.project
    const styleReference = (project as any).tone || ''
    if (styleReference) {
      userPrompt += `## 文风参考（可选）\n\n${styleReference}\n\n`
    }
    
    userPrompt += '---\n\n请按照 system prompt 中的 JSON 格式，输出检测报告和改写后全文。'
    
    return userPrompt
  }

  /**
   * 执行降 AI 味检测（非流式，返回 JSON）
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
      const result = await this.callLLMJSON<AntiAIResponseData>(messages, context)
      
      // 返回结构化的 JSON 数据
      return {
        content: result.rewrittenText || '',
        metadata: {
          antiAICheck: true,
          detectionReport: result.aiDetectionReport || {},
          issueCount: result.aiDetectionReport?.issueCount || 0,
          highRiskCount: result.aiDetectionReport?.highRiskCount || 0,
          mediumRiskCount: result.aiDetectionReport?.mediumRiskCount || 0,
          lowRiskCount: result.aiDetectionReport?.lowRiskCount || 0
        }
      }
    } catch (error) {
      console.error('[AntiAIAgent] LLM 调用失败:', error)
      return {
        content: '',
        metadata: {
          error: error instanceof Error ? error.message : 'LLM 调用失败',
          antiAICheck: true
        }
      }
    }
  }

}
