import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'
import { PromptLoader, AGENT_CATEGORY_MAP, AGENT_PROMPT_NAME_MAP } from '@/utils/promptLoader'
import type { WorldResponseData } from '@/types/llm-response'

/**
 * 世界观构建 Agent（前期构建组）
 * 
 * 功能说明：
 * - 根据小说类型，生成完整的世界观设定
 * - 包括：世界规则、力量体系、地理格局、历史沿革等
 * - 从文件加载提示词：prompts/b_精准指令/world_agent/system_prompt.md
 */
export class WorldAgent extends BaseAgent {
  /** Agent 类型标识 */
  readonly agentType = 'world' as const

  /** 
   * 加载 System Prompt（从文件）
   */
  private async getSystemPrompt(): Promise<string> {
    try {
      const prompt = await PromptLoader.loadSystemPrompt(
        AGENT_CATEGORY_MAP.world,
        AGENT_PROMPT_NAME_MAP.world
      )
      return prompt
    } catch (error) {
      console.error('[WorldAgent] 加载 system_prompt 失败，使用默认提示词:', error)
      // 返回默认提示词（简化版）
      return `你是一位世界观设计师，专门为小说构建完整、自洽、有生命力的虚构世界。

## 输出格式要求

**重要：你必须返回严格的 JSON 格式！**

输出格式如下：
\`\`\`json
{
  "success": true,
  "data": {
    "worldSetting": "完整的世界观设定（Markdown 格式）",
    "keyElements": {
      "powerSystems": ["力量体系1"],
      "factions": ["势力1"],
      "locations": ["地点1"],
      "historicalEvents": ["事件1"]
    }
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
    const project = context.project
    const prompt = input.type === 'world' ? input.prompt : ''
    const projectContext = input.type === 'world' ? input.projectContext : undefined
    
    let userPrompt = `# 请根据以下故事基础，生成完整的世界观设定。\n\n`
    
    userPrompt += `**故事简介**：${project.synopsis || prompt}\n`
    userPrompt += `**小说类型**：${project.genre || '不限'}\n`
    userPrompt += `**文风**：${project.tone || '不限'}\n\n`
    
    if (projectContext) {
      userPrompt += `**用户已有的世界观草稿**：\n${projectContext}\n\n`
    }
    
    if (prompt && !project.synopsis) {
      userPrompt += `**用户特别要求**：\n${prompt}\n\n`
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
   * 执行世界观构建（非流式）
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
    const response = await this.callLLMJSON<{ success: boolean; data: WorldResponseData; message?: string }>(messages, context)
    
    // 检查响应是否成功
    if (!response.success) {
      console.error('[WorldAgent] LLM 调用失败:', response.message)
      return {
        content: '',
        metadata: {
          error: response.message || 'LLM 调用失败',
          worldBuilding: true
        }
      }
    }
    
    // 返回世界观设定
    const { worldSetting, keyElements, analysis } = response.data
    
    return {
      content: worldSetting || '',
      metadata: {
        keyElements: keyElements || {},
        analysis: analysis || {},
        worldBuilding: true
      }
    }
  }
}
