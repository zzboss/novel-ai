import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'
import { PromptLoader, AGENT_CATEGORY_MAP, AGENT_PROMPT_NAME_MAP } from '@/utils/promptLoader'
import type { PolishResponseData } from '@/types/llm-response'

/**
 * 润色优化 Agent（写作执行组）
 * 
 * 功能说明：
 * - 对已有内容进行润色，提升文字质量
 * - 支持指定润色风格（如：更文艺、更简洁、更口语化）
 * - 支持指定润色强度
 * 
 * 已从文件加载提示词：prompts/c_快速执行/polish_agent/system_prompt.md
 */
export class PolishAgent extends BaseAgent {
  /** Agent 类型标识 */
  readonly agentType = 'polish' as const

  /** 
   * 加载 System Prompt（从文件）
   */
  private async getSystemPrompt(): Promise<string> {
    try {
      const prompt = await PromptLoader.loadSystemPrompt(
        AGENT_CATEGORY_MAP.polish,
        AGENT_PROMPT_NAME_MAP.polish
      )
      return prompt
    } catch (error) {
      console.error('[PolishAgent] 加载 system_prompt 失败，使用默认提示词:', error)
      // 返回默认提示词（简化版）
      return `你是一位文字润色专家，负责对已完成的小说段落进行文笔优化。
      
## 输出格式要求
      
**重要：你必须返回严格的 JSON 格式！**
      
输出格式如下：
\`\`\`json
{
  "success": true,
  "data": {
    "polishedText": "润色后的完整文本",
    "changes": ["修改点1", "修改点2"],
    "changeCount": 5
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
    const prompt = input.type === 'polish' ? input.prompt : ''
    
    let userPrompt = `# 请对以下文本进行润色优化。\n\n`
    userPrompt += `**待润色文本**：\n${prompt}\n\n`
    
    // 润色目标
    const polishGoals = (input as any).polishGoals || ['消除重复用词', '优化句式节奏', '强化感官描写', '情绪渲染增强', '删除冗余描述']
    userPrompt += `**润色目标**（已勾选项）：\n${polishGoals.join(' / ')}\n\n`
    
    // 文风要求
    const project = context.project
    const styleNotes = (project as any).tone || ''
    if (styleNotes) {
      userPrompt += `**文风要求**（可选）：\n${styleNotes}\n\n`
    }
    
    // 注入已挂载 Skill 的内容
    const skillSnippets = this.mountedSkills
      .map(s => s.systemPromptSnippet)
      .filter(Boolean)
      .join('\n\n')
    
    if (skillSnippets) {
      userPrompt += `## Skill 注入（如有）\n${skillSnippets}\n\n`
    }
    
    userPrompt += '---\n\n请按照 system prompt 中的要求，返回严格的 JSON 格式。'
    
    return userPrompt
  }

  /**
   * 执行润色优化（非流式，返回 JSON 格式）
   * 
   * 流程：
   * 1. 构建上下文和 User Prompt
   * 2. 加载 System Prompt（从文件）
   * 3. 调用 LLM 并解析 JSON 响应
   * 4. 提取润色后的文本
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
    const response = await this.callLLMJSON<{ success: boolean; data: PolishResponseData; message?: string }>(messages, context)
    
    // 检查响应是否成功
    if (!response.success) {
      console.error('[PolishAgent] LLM 调用失败:', response.message)
      return {
        content: '',
        metadata: {
          error: response.message || 'LLM 调用失败',
          polishOptimization: true
        }
      }
    }
    
    // 返回润色后的文本
    const { polishedText, changes, changeCount } = response.data
    
    return {
      content: polishedText || '',
      metadata: {
        changes: changes || [],
        changeCount: changeCount || 0,
        polishOptimization: true
      }
    }
  }
}
