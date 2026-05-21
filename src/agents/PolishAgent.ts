import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'

/**
 * 润色优化 Agent（写作执行组）
 * 
 * 功能说明：
 * - 对已有内容进行润色，提升文字质量
 * - 支持指定润色风格（如：更文艺、更简洁、更口语化）
 * - 支持指定润色强度
 */
export class PolishAgent extends BaseAgent {
  /** Agent 类型标识 */
  readonly agentType = 'polish' as const

  /** System Prompt（来自 prompts/c_快速执行/polish_agent/system_prompt.md） */
  private readonly systemPrompt = `你是一位文字润色专家，负责对已完成的小说段落进行文笔优化。你的任务不是重写故事，而是在保持原有情节和意图不变的前提下，让文字更流畅、更有感染力、更具阅读快感。

## 可执行的润色类型

根据用户勾选的目标，执行对应操作（可组合）：

| 润色类型 | 操作说明 |
|---------|---------|
| **消除重复用词** | 识别高频重复的词汇（尤其是动词、形容词），替换为近义词或改变句式 |
| **优化句式节奏** | 拆长句、合短句、调整信息密度，让段落读起来有节奏感 |
| **强化感官描写** | 识别纯叙述段落，注入具体的视觉/听觉/触觉细节 |
| **情绪渲染增强** | 找到情绪高点，通过具体细节而非抽象情绪词强化情感冲击 |
| **删除冗余描述** | 删去重复表达同一意思的句子，删去"交代性"废话 |

## 润色原则

- **不改变情节**：绝不增删事件、改变角色行为或调整时间线
- **保留作者声音**：识别文本中的个人风格标记，润色时不抹平，而是强化
- **最小改动原则**：能局部调整就不整段重写，尊重原文的骨架

## 输出要求

直接输出润色后的文本，不加任何解释或对比说明。`

  /**
   * 构建 User Prompt
   */
  private buildUserPrompt(input: AgentInput, context: AgentContext): string {
    const content = input.type === 'polish' ? input.content : ''
    const options = input.type === 'polish' ? input.options : undefined
    
    let userPrompt = `# 请对以下文本进行润色优化。\n\n`
    userPrompt += `## 待润色文本\n\n${content}\n\n`
    
    // 润色目标
    const polishGoals = options?.style ? [options.style] : ['消除重复用词', '优化句式节奏', '强化感官描写', '情绪渲染增强', '删除冗余描述']
    userPrompt += `## 润色目标（已勾选项）\n\n${polishGoals.join(' / ')}\n\n`
    
    // 文风参考
    const project = context.project
    const styleReference = (project as any).tone || ''
    if (styleReference) {
      userPrompt += `## 文风参考（可选）\n\n${styleReference}\n\n`
    }
    
    userPrompt += '---\n\n请直接输出润色后的文本。'
    
    return userPrompt
  }

  /**
   * 执行润色优化（非流式）
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
   * 流式执行润色优化
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
