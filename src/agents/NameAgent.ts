import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'

/**
 * 命名工厂 Agent（写作辅助组）
 * 
 * 功能说明：
 * - 根据类型、风格生成名字（角色名、地名、功法名、技能名等）
 * - 支持批量生成
 * - 支持指定命名风格
 */
export class NameAgent extends BaseAgent {
  /** Agent 类型标识 */
  readonly agentType = 'name' as const

  /** System Prompt（来自 prompts/c_快速执行/name_agent/system_prompt.md） */
  private readonly systemPrompt = `你是一位精通中文文化、历史典故和语音美学的命名专家，为小说中的角色、地点、功法、物品等生成符合世界观风格的名称。

## 命名原则

1. **音韵美**：名字读起来顺口，有节奏感，避免拗口的声母/韵母组合
2. **寓意贴切**：名称的字义与对象的特征、定位相呼应
3. **风格统一**：与世界观的整体文化氛围一致（古典/现代/玄幻/科幻等）
4. **差异化**：同一批次的名称之间不重复、不雷同

## 输出格式

每次生成8-10个候选名称，每个名称附简要说明（20字以内）：

1. [名称] — [简要说明]
2. [名称] — [简要说明]
...

不要输出其他内容。`

  /**
   * 构建 User Prompt
   */
  private buildUserPrompt(input: AgentInput, context: AgentContext): string {
    const nameType = input.type === 'name' ? input.nameType : 'character'
    const count = input.type === 'name' ? (input.count || 8) : 8
    const style = input.type === 'name' ? input.style : undefined
    
    let userPrompt = `**命名类型**：${nameType}\n\n`
    userPrompt += `（角色人名 / 地点名 / 功法/技能名 / 物品/宝器名 / 势力/门派名 / 其他）\n\n`
    
    // 风格偏好
    const stylePreference = style || (context.project as any).tone || '古典雅致'
    userPrompt += `**风格偏好**：${stylePreference}\n\n`
    
    // 寓意方向
    const meaningDirection = (input as any).meaningDirection || ''
    if (meaningDirection) {
      userPrompt += `**寓意方向**：${meaningDirection}\n\n`
    }
    
    // 世界观文化背景
    const worldCulture = (context.project as any).worldCulture || ''
    if (worldCulture) {
      userPrompt += `**世界观文化背景**（可选）：${worldCulture}\n\n`
    }
    
    // 已有同类名称（避免重复）
    const existingNames = (input as any).existingNames || ''
    if (existingNames) {
      userPrompt += `**已有同类名称（避免重复）**：${existingNames}\n\n`
    }
    
    // 额外说明
    const userNotes = (input as any).userNotes || ''
    if (userNotes) {
      userPrompt += `**额外说明**（可选）：${userNotes}\n\n`
    }
    
    userPrompt += `---\n\n请生成${count}个候选名称，每个附简要说明。`
    
    return userPrompt
  }

  /**
   * 执行命名生成（非流式）
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
   * 流式执行命名生成
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
