import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'
import { PromptLoader, AGENT_CATEGORY_MAP, AGENT_PROMPT_NAME_MAP } from '@/utils/promptLoader'
import type { DialogueResponseData } from '@/types/llm-response'

/**
 * 对话优化 Agent（写作执行组）
 * 
 * 功能说明：
 * - 优化小说中的对话，使其更自然、更符合角色性格
 * - 支持指定需要优化的角色
 * - 保持对话推动剧情的功能
 * - 从文件加载提示词：prompts/c_快速执行/dialogue_agent/system_prompt.md
 */
export class DialogueAgent extends BaseAgent {
  /** Agent 类型标识 */
  readonly agentType = 'dialogue' as const

  /** 
   * 加载 System Prompt（从文件）
   */
  private async getSystemPrompt(): Promise<string> {
    try {
      const prompt = await PromptLoader.loadSystemPrompt(
        AGENT_CATEGORY_MAP.dialogue,
        AGENT_PROMPT_NAME_MAP.dialogue
      )
      return prompt
    } catch (error) {
      console.error('[DialogueAgent] 加载 system_prompt 失败，使用默认提示词:', error)
      // 返回默认提示词（简化版）
      return `你是一位对白优化专家，专门将平淡、功能性的对话改写为有戏剧张力、有角色个性、有潜台词的高质对话。

## 输出格式要求

**重要：你必须返回严格的 JSON 格式！**

输出格式如下：
\`\`\`json
{
  "success": true,
  "data": {
    "optimizedDialogue": "优化后的对话段落",
    "changes": ["修改点1", "修改点2"],
    "characterAnalysis": {
      "角色名1": "说话风格特征"
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
    const content = input.type === 'dialogue' ? input.content : ''
    const characters = input.type === 'dialogue' ? input.characters : undefined
    
    let userPrompt = `# 请优化以下对话段落。\n\n`
    userPrompt += `## 对话段落\n\n${content}\n\n`
    
    // 角色信息
    const allCharacters = (project as any).characters || []
    let characterInfo = ''
    
    if (characters && characters.length > 0) {
      // 如果指定了角色，只显示指定角色
      const specifiedChars = allCharacters.filter((c: any) => characters.includes(c.name))
      for (const char of specifiedChars) {
        characterInfo += `${char.name} | ${char.mood || '平静'} | ${char.speakingStyle || '未定义'}\n`
      }
    } else {
      // 否则显示所有角色
      for (const char of allCharacters.slice(0, 5)) {
        characterInfo += `${char.name} | ${char.mood || '平静'} | ${char.speakingStyle || '未定义'}\n`
      }
    }
    
    if (characterInfo) {
      userPrompt += `## 角色信息\n\n${characterInfo}\n`
      userPrompt += `（格式：角色名 | 当前情绪状态 | 说话风格特征）\n\n`
    }
    
    // 场景上下文
    const sceneContext = (input as any).sceneContext || ''
    if (sceneContext) {
      userPrompt += `## 场景上下文\n\n${sceneContext}\n\n`
    }
    
    // 优化目标
    const optimizationGoals = (input as any).optimizationGoals || ['角色音色区分', '增加潜台词', '提升戏剧张力', '节奏优化']
    userPrompt += `## 优化目标（可多选）\n\n${optimizationGoals.join(' / ')}\n\n`
    
    userPrompt += '---\n\n请按照 system prompt 中的要求，返回严格的 JSON 格式。'
    
    return userPrompt
  }

  /**
   * 执行对话优化（非流式）
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
    const response = await this.callLLMJSON<{ success: boolean; data: DialogueResponseData; message?: string }>(messages, context)
    
    // 检查响应是否成功
    if (!response.success) {
      console.error('[DialogueAgent] LLM 调用失败:', response.message)
      return {
        content: '',
        metadata: {
          error: response.message || 'LLM 调用失败',
          dialogueOptimization: true
        }
      }
    }
    
    // 返回优化后的对话
    const { optimizedDialogue, changes, characterAnalysis } = response.data
    
    return {
      content: optimizedDialogue || '',
      metadata: {
        changes: changes || [],
        characterAnalysis: characterAnalysis || {},
        dialogueOptimization: true
      }
    }
  }
}
