import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'

/**
 * 对话优化 Agent（写作执行组）
 * 
 * 功能说明：
 * - 优化小说中的对话，使其更自然、更符合角色性格
 * - 支持指定需要优化的角色
 * - 保持对话推动剧情的功能
 */
export class DialogueAgent extends BaseAgent {
  /** Agent 类型标识 */
  readonly agentType = 'dialogue' as const

  /** System Prompt（来自 prompts/c_快速执行/dialogue_agent/system_prompt.md） */
  private readonly systemPrompt = `你是一位对白优化专家，专门将平淡、功能性的对话改写为有戏剧张力、有角色个性、有潜台词的优质对白。

## 核心原则

1. **角色音色**：每个角色说话方式必须有辨识度——读者不看标注也能知道是谁在说话。
2. **潜台词优先**：好对话说的是A，想的是B，做的是C。让角色说"侧面的话"，而不是直接说出内心。
3. **节奏控制**：长对话需要有短句打断，有沉默/动作穿插，避免乒乓球式纯对话。
4. **戏剧张力**：每段对话都应有一个微小的权力博弈或情感交锋，有来有往，不是信息传递机器。

## 工作方式

1. 先识别对话中每个角色的身份、情绪状态、当前目的
2. 检查哪些台词"太直白"（直接说出了内心）——改成间接表达
3. 检查角色说话方式是否有差异——如果雷同则调整
4. 优化节奏：适当加入动作描写、神态、停顿
5. 输出优化后的完整对话段落

## 输出格式

直接输出优化后的对话段落，保留必要的动作描写穿插。不加解释，不加对比说明。`

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
    
    userPrompt += '---\n\n请直接输出优化后的对话段落。'
    
    return userPrompt
  }

  /**
   * 执行对话优化（非流式）
   */
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    const ctx = await this.buildContext(input, context)
    const userPrompt = this.buildUserPrompt(input, context)
    
    const messages = [
      { role: 'system' as const, content: this.systemPrompt + '\n\n' + ctx },
      { role: 'user' as const, content: userPrompt }
    ]
    
    const content = await this.callLLM(messages, context)
    return { content }
  }

  /**
   * 流式执行对话优化
   */
  async *stream(input: AgentInput, context: AgentContext): AsyncGenerator<string> {
    const ctx = await this.buildContext(input, context)
    const userPrompt = this.buildUserPrompt(input, context)
    
    const messages = [
      { role: 'system' as const, content: this.systemPrompt + '\n\n' + ctx },
      { role: 'user' as const, content: userPrompt }
    ]
    
    yield* this.callLLMStream(messages, context)
  }
}
