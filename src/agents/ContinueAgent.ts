import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'

/**
 * 续写 Agent（写作执行组）
 * 
 * 功能说明：
 * - 在光标位置继续写作
 * - 自动理解上下文，保持文风和剧情连贯
 * - 支持指定续写字数
 */
export class ContinueAgent extends BaseAgent {
  /** Agent 类型标识 */
  readonly agentType = 'continue' as const

  /** System Prompt（来自 prompts/c_快速执行/continue_agent/system_prompt.md） */
  private readonly systemPrompt = `你是一位续写专家，专门根据已有内容无缝延续故事。你的核心能力是"消失"——读者看不出哪里是原文结束、哪里是你开始的。

## 核心要求

1. **风格镜像**：分析前文的句式特征（长/短句比例、段落节奏、用词风格），严格模仿
2. **情绪延续**：延续前文的情绪氛围，不突然跳跃（紧张中的续写不能突然变成轻松）
3. **信息推进**：续写内容必须推进情节或加深人物，不允许停在原地重复前文意思
4. **尊重方向**：如果用户给了续写方向提示，以此为目标，但过渡要自然，不能突然跳入
5. **开放式结尾**：续写结束时留有悬念或自然的"暂停感"，便于用户继续

## 工作流程

1. 阅读提供的前文（约1500字），识别风格特征
2. 如果有用户提供的续写方向，规划如何从当前状态走向那个方向
3. 开始续写，字数不超过用户指定上限
4. 确保第一句无缝接续前文，读者感觉不到切换点

## 输出要求

直接输出续写内容，不加任何解释。`

  /**
   * 构建 User Prompt
   */
  private buildUserPrompt(input: AgentInput, context: AgentContext): string {
    const project = context.project
    const chapterId = input.type === 'continue' ? input.chapterId : ''
    const cursorPosition = input.type === 'continue' ? input.cursorPosition : 0
    
    // 获取章节内容
    const chapters = (project as any).chapters || []
    const chapter = chapters.find((c: any) => c.id === chapterId)
    const chapterContent = chapter?.content || ''
    
    // 获取前文（光标位置之前的内容，最多1500字）
    const precedingContent = chapterContent.substring(0, cursorPosition).slice(-1500)
    
    let userPrompt = `# 请根据以下内容，无缝续写故事。\n\n`
    userPrompt += `## 前文（最近约1500字）\n\n${precedingContent}\n\n`
    
    // 本章概要
    if (chapter?.outline) {
      userPrompt += `## 本章概要（供参考）\n\n${chapter.outline}\n\n`
    }
    
    // 续写方向（可选）
    const continuationDirection = input.type === 'continue' ? (input as any).continuationDirection : undefined
    if (continuationDirection) {
      userPrompt += `## 续写方向（可选）\n\n${continuationDirection}\n\n`
    }
    
    // 续写字数上限
    const maxWords = input.type === 'continue' ? ((input as any).maxWords || 500) : 500
    userPrompt += `## 续写字数上限\n\n${maxWords} 字\n\n`
    
    userPrompt += '---\n\n请直接输出续写内容，从前文结束的地方无缝接续。'
    
    return userPrompt
  }

  /**
   * 执行续写（非流式）
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
   * 流式执行续写（推荐使用）
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
