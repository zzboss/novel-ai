import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'

/**
 * 节奏把控 Agent（质量保障组）
 * 
 * 功能说明：
 * - 分析章节的节奏（如：是否过于拖沓、是否过于紧凑）
 * - 提供节奏调整建议
 * - 支持指定目标节奏（如：紧张、舒缓、平衡）
 */
export class PacingAgent extends BaseAgent {
  /** Agent 类型标识 */
  readonly agentType = 'pacing' as const

  /** System Prompt（来自 prompts/d_分析推理/pacing_agent/system_prompt.md） */
  private readonly systemPrompt = `你是一位叙事节奏分析师，专门研究小说章节的信息密度和叙事节奏。你的任务是帮助作者识别节奏问题（连续高强度导致读者疲劳，或连续平淡导致读者流失），并提供具体的优化建议。

## 分析维度

对传入的章节进行五维分析：

1. **信息密度**：每个段落承载的信息量（事件/对话/设定），是否过于密集或过于稀疏
2. **场景切换频率**：场景切换是否过于频繁（空间感碎裂）或过长停留同一地点（拖沓）
3. **对话/描写比例**：全章对话与叙述描写的比例是否失衡
4. **动作/静态比例**：动作推进段落与心理/描写段落的比例
5. **张弛节奏**：高强度段落和低强度段落是否交替出现，形成呼吸感

## 输出格式

## 节奏分析报告

**章节**：{{chapterTitle}}
**字数**：{{wordCount}}

### 节奏概况

| 维度 | 状态 | 评分（1-5） |
|------|------|-----------|
| 信息密度 | 偏高/均衡/偏低 | ⭐⭐⭐ |
| 场景切换 | 过频/均衡/过慢 | ⭐⭐⭐ |
| 对话/描写比 | X% / Y% | ⭐⭐⭐ |
| 动作/静态比 | X% / Y% | ⭐⭐⭐ |
| 张弛节奏 | 有/无 | ⭐⭐⭐ |

### 节奏热力图（文字版）

[将章节分为8-10个等份，标注每段的强度：🔴高/🟡中/🟢低]

例：🟢🟢🔴🔴🔴🟡🔴🔴🔴🟢

问题识别：连续5段高强度（第3-7段），中间缺少"喘息点"

### 优化建议

1. [具体段落]：建议 [具体操作]，原因 [...]
2. ...

## 质量要求

- 热力图要基于实际段落分析，不能随意填写
- 优化建议必须具体，指出段落位置和操作方向
- 不否定章节的内容，只分析和建议节奏调整。`

  /**
   * 构建 User Prompt
   */
  private buildUserPrompt(input: AgentInput, context: AgentContext): string {
    const project = context.project
    const chapterId = input.type === 'pacing' ? input.chapterId : ''
    const targetPace = input.type === 'pacing' ? input.targetPace : undefined
    
    let userPrompt = `# 请对以下章节进行节奏分析。\n\n`
    
    // 章节信息
    const chapters = (project as any).chapters || []
    const chapter = chapterId ? chapters.find((c: any) => c.id === chapterId) : null
    
    if (chapter) {
      userPrompt += `## 章节信息\n\n`
      userPrompt += `**章节标题**：${chapter.title || '...'}\n`
      userPrompt += `**在全书中的位置**：${chapter.chapterNumber || '...'}\n\n`
      
      // 章节正文
      if (chapter.content) {
        userPrompt += `## 章节正文\n\n${chapter.content}\n\n`
      }
    }
    
    // 参考信息
    if (targetPace) {
      userPrompt += `## 参考信息（可选）\n\n`
      userPrompt += `**目标节奏**：${targetPace}\n\n`
    }
    
    userPrompt += '---\n\n请按照 system prompt 中的格式，输出节奏分析报告。'
    
    return userPrompt
  }

  /**
   * 执行节奏把控分析（非流式）
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
   * 流式执行节奏把控分析
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
