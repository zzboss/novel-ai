import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'

/**
 * 场景扩写 Agent（写作辅助组）
 * 
 * 功能说明：
 * - 对场景描述进行扩写，增加画面感和沉浸感
 * - 支持指定场景地点
 * - 强调五感描写（视觉、听觉、嗅觉、触觉、味觉）
 */
export class SceneAgent extends BaseAgent {
  /** Agent 类型标识 */
  readonly agentType = 'scene' as const

  /** System Prompt（来自 prompts/b_精准指令/scene_agent/system_prompt.md） */
  private readonly systemPrompt = `你是一位场景描写专家，擅长将"一句话场景"扩写成充满感官细节、情绪浸透的沉浸式场景。你的场景描写坚守一个原则：**每一个细节都在服务当下的情绪和后续的剧情**，没有废话，没有景物图鉴式的堆砌。

## 核心技巧

1. **五感全开，但有侧重**：不是每个场景都需要五感平均分配，根据场景用途决定侧重点（战斗侧重触觉/听觉，悬疑侧重视觉细节/异常感，离别侧重嗅觉/时间感）。
2. **情绪渗透**：不直接说角色"很悲伤"，而是让场景本身散发出悲伤的气息——通过光线、声音、细节的选择。
3. **细节锚点**：在场景中埋入1-2个具体的小细节（一个破了一角的茶杯，空气里残留的火药味），让场景可记忆。
4. **动与静**：大多数优秀场景都有"动"（发生了什么）和"静"（时间停顿、感官特写）的交替。

## 输出字数选项

- **精简版（约100字）**：只抓最核心的感官特写，适合嵌入剧情推进段落
- **标准版（约300字）**：完整场景扩写，主流选择
- **详写版（约500字）**：充分展开，适合全书高潮或重要转折场景

## 质量要求

- 禁止开头是"这是一个…"/"在这个地方…"/"只见…"
- 避免大段环境描写没有人物动作穿插其中
- 扩写内容必须与用户提供的场景用途（战前/高潮/悬疑/过渡等）在氛围上高度匹配
- 直接输出场景正文，不加任何解释。`

  /**
   * 构建 User Prompt
   */
  private buildUserPrompt(input: AgentInput, context: AgentContext): string {
    const prompt = input.type === 'scene' ? input.prompt : ''
    
    let userPrompt = `# 请将以下简短场景描述扩写为沉浸式场景描写。\n\n`
    userPrompt += `**场景描述**：\n${prompt}\n\n`
    
    // 场景用途
    const scenePurpose = (input as any).scenePurpose || '标准场景'
    userPrompt += `**场景用途**：\n${scenePurpose}\n\n`
    
    // 角色情绪状态
    const characterEmotion = (input as any).characterEmotion || ''
    if (characterEmotion) {
      userPrompt += `**角色情绪状态**：\n${characterEmotion}\n\n`
    }
    
    // 输出字数
    const wordCount = (input as any).wordCount || '300'
    userPrompt += `**输出字数**：\n${wordCount}字标准版\n\n`
    
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
    
    userPrompt += '---\n\n请直接输出扩写后的场景正文。'
    
    return userPrompt
  }

  /**
   * 执行场景扩写（非流式）
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
   * 流式执行场景扩写
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
