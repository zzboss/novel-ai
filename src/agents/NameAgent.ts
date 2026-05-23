import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'
import { PromptLoader, AGENT_CATEGORY_MAP, AGENT_PROMPT_NAME_MAP } from '@/utils/promptLoader'
import type { NameResponseData } from '@/types/llm-response'

/**
 * 命名工厂 Agent（写作辅助组）
 * 
 * 功能说明：
 * - 根据类型、风格生成名字（角色名、地名、功法名、技能名等）
 * - 支持批量生成
 * - 支持指定命名风格
 * 
 * 已重构：从文件加载提示词，使用 callLLMJSON 解析 JSON 响应
 */
export class NameAgent extends BaseAgent {
  /** Agent 类型标识 */
  readonly agentType = 'name' as const

  /** 
   * 加载 System Prompt（从文件）
   */
  private async getSystemPrompt(): Promise<string> {
    try {
      const prompt = await PromptLoader.loadSystemPrompt(
        AGENT_CATEGORY_MAP.name,
        AGENT_PROMPT_NAME_MAP.name
      )
      return prompt
    } catch (error) {
      console.error('[NameAgent] 加载 system_prompt 失败，使用默认提示词:', error)
      // 返回默认提示词（简化版）
      return `你是一位专业的小说命名专家。根据类型和风格生成合适的名字。
      
## 输出格式要求

**重要：你必须返回严格的 JSON 格式！**

输出格式如下：
\`\`\`json
{
  "success": true,
  "data": {
    "candidates": ["名字1", "名字2", ...],
    "nameType": "角色名",
    "style": "古典雅致"
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
    if (input.type !== 'name') {
      throw new Error('NameAgent 收到了错误的输入类型')
    }

    const { nameType, count, style, meaningDirection } = input
    const project = context.project

    let userPrompt = `# 请生成合适的名字\n\n`

    // 命名类型
    userPrompt += `## 命名类型\n\n${nameType || '角色名'}\n\n`

    // 生成数量
    userPrompt += `## 生成数量\n\n${count || 8}个\n\n`

    // 命名风格
    const stylePreference = style || (project as any).tone || '古典雅致'
    userPrompt += `## 命名风格\n\n${stylePreference}\n\n`

    // 寓意方向
    if (meaningDirection) {
      userPrompt += `## 寓意方向（可选）\n\n${meaningDirection}\n\n`
    }

    // 世界观文化背景
    const worldCulture = (project as any).worldCulture || ''
    if (worldCulture) {
      userPrompt += `## 世界观文化背景（可选）\n\n${worldCulture}\n\n`
    }

    // 已有同类名称（避免重复）
    const existingNames = (input as any).existingNames || ''
    if (existingNames) {
      userPrompt += `## 已有同类名称（避免重复）\n\n${existingNames}\n\n`
    }

    userPrompt += '---\n\n请按照 system prompt 中规定的 JSON 格式，生成名字。'

    return userPrompt
  }

  /**
   * 执行命名生成（非流式，返回 JSON 格式）
   * 
   * 流程：
   * 1. 加载 System Prompt（从文件）
   * 2. 构建上下文和 User Prompt
   * 3. 调用 LLM 并解析 JSON 响应
   * 4. 提取候选名字列表
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
    
    // 调用 LLM 并解析 JSON 响应
    const response = await this.callLLMJSON<{ success: boolean; data: NameResponseData; message?: string }>(messages, context)
    
    // 检查响应是否成功
    if (!response.success) {
      throw new Error(response.message || '命名生成失败')
    }
    
    const { candidates, nameType, style } = response.data
    
    // 返回候选名字列表
    return {
      content: JSON.stringify(candidates || [], null, 2),
      metadata: {
        nameType: nameType || '角色名',
        candidateCount: candidates?.length || 0,
        style: style || '',
        candidates: candidates || []
      }
    }
  }
}
