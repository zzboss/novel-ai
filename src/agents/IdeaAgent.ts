import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'
import { PromptLoader, AGENT_CATEGORY_MAP, AGENT_PROMPT_NAME_MAP } from '@/utils/promptLoader'
import type { IdeaResponseData } from '@/types/llm-response'

/**
 * 创意激发 Agent（前期构建组）
 * 
 * 功能说明：
 * - 根据用户提供的关键词或主题，生成小说创意
 * - 支持指定类型（如：奇幻、都市、科幻等）
 * - 生成多个创意供用户选择
 * 
 * 已从文件加载提示词：prompts/b_精准指令/idea_agent/system_prompt.md
 */
export class IdeaAgent extends BaseAgent {
  readonly agentType = 'idea' as const

  /** 
   * 加载 System Prompt（从文件）
   */
  private async getSystemPrompt(): Promise<string> {
    try {
      const prompt = await PromptLoader.loadSystemPrompt(
        AGENT_CATEGORY_MAP.idea,
        AGENT_PROMPT_NAME_MAP.idea
      )
      return prompt
    } catch (error) {
      console.error('[IdeaAgent] 加载 system_prompt 失败，使用默认提示词:', error)
      // 返回默认提示词（简化版）
      return `你是一位经验丰富的故事策划师，熟悉中文网络小说市场和传统文学写作规范。你的任务是根据用户提供的关键词和方向，生成3个具有明显差异的故事概念供用户选择。
      
## 输出格式要求
      
**重要：你必须返回严格的 JSON 格式！**
      
输出格式如下：
\`\`\`json
{
  "success": true,
  "data": {
    "ideas": [
      {
        "conceptName": "概念1名称",
        "corePremise": "核心前提",
        "protagonistDirection": "主角方向",
        "coreConflict": "核心冲突",
        "uniqueSellingPoint": "独特卖点",
        "endingDirection": "结局方向"
      }
    ]
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
    const prompt = input.type === 'idea' ? input.prompt : ''
    const genre = input.type === 'idea' ? (input as any).genre || '不限' : '不限'
    
    let userPrompt = `# 请根据以下信息，生成3个具有明显差异的故事概念。\n\n`
    
    // 关键词
    userPrompt += `## 关键词\n\n${prompt}\n\n`
    
    // 类型
    userPrompt += `## 小说类型\n\n${genre}\n\n`
    
    // 目标体量
    const targetLength = (input as any).targetLength || '长篇'
    userPrompt += `## 目标体量\n\n${targetLength}\n\n`
    
    // 禁忌元素
    const forbiddenElements = (input as any).forbiddenElements || ''
    if (forbiddenElements) {
      userPrompt += `## 禁忌元素（不要出现）\n\n${forbiddenElements}\n\n`
    }
    
    // 注入已挂载 Skill 的内容
    const skillSnippets = this.mountedSkills
      .map(s => s.systemPromptSnippet)
      .filter(Boolean)
      .join('\n\n')
    
    if (skillSnippets) {
      userPrompt += `## Skill 注入（如有）\n\n${skillSnippets}\n\n`
    }
    
    userPrompt += '---\n\n请按照 system prompt 中的要求，返回严格的 JSON 格式。'
    
    return userPrompt
  }

  /**
   * 执行创意激发（非流式，返回 JSON 格式）
   * 
   * 流程：
   * 1. 构建上下文和 User Prompt
   * 2. 加载 System Prompt（从文件）
   * 3. 调用 LLM 并解析 JSON 响应
   * 4. 提取创意列表
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
    const response = await this.callLLMJSON<{ success: boolean; data: IdeaResponseData; message?: string }>(messages, context)
    
    // 检查响应是否成功
    if (!response.success) {
      throw new Error(response.message || '创意激发失败')
    }
    
    // 返回创意列表
    const { ideas } = response.data
    
    return {
      content: JSON.stringify(ideas, null, 2),
      metadata: {
        ideaCount: ideas?.length || 0,
        ideas: ideas?.map(idea => idea.conceptName) || []
      }
    }
  }
}
