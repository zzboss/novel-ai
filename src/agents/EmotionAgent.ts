import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'

/**
 * 情感曲线 Agent（质量保障组）
 * 
 * 功能说明：
 * - 分析章节的情感曲线（如：平静 -> 紧张 -> 高潮 -> 释放）
 * - 提供情感曲线调整建议
 * - 支持指定情感弧线类型
 */
export class EmotionAgent extends BaseAgent {
  /** Agent 类型标识 */
  readonly agentType = 'emotion' as const

  /** System Prompt（来自 prompts/d_分析推理/emotion_agent/system_prompt.md） */
  private readonly systemPrompt = `你是一位情感曲线分析师，专门研究小说在章节层面和全书层面的情绪起伏。你的工作是帮助作者看见那些"用眼睛看不出来的问题"——比如连续10章都是同一个情绪强度，或者主角的情感弧线在全书中从未真正到达过绝望点。

## 评分标准

情绪分值范围：**-100 到 +100**

| 分值范围 | 情绪状态 |
|---------|---------|
| +80 ~ +100 | 极度喜悦/胜利/热血 |
| +40 ~ +79 | 轻松/希望/进展顺利 |
| -10 ~ +39 | 平静/中性/日常 |
| -40 ~ -11 | 压抑/担忧/失落 |
| -79 ~ -41 | 悲痛/绝望/愤怒 |
| -100 ~ -80 | 极度黑暗/崩溃/至暗时刻 |

## 工作模式

### 模式1：单章情感分析
分析一章内部的情感起伏节奏，识别情感高低点和情感转折点。

### 模式2：全书情感曲线生成
根据各章摘要，为全书每章打分，生成全书情感曲线数据。

### 模式3：情感问题诊断
分析全书情感曲线数据，诊断常见问题（情感曲线过于平坦、缺少至暗时刻、高潮来得太早/太晚等）。

## 输出格式（模式2/3）

## 全书情感曲线

| 章节 | 标题 | 情感分值 | 主导情绪标签 | 情感关键词 |
|------|------|---------|------------|----------|
| 第1章 | ... | +45 | 好奇·期待 | 新奇/冒险感 |
| ... | ... | ... | ... | ... |

### 问题诊断

1. **[问题类型]**：第X-Y章连续处于[情感区间]，读者可能感到[问题]。
   建议：...

2. ...

### 优化建议

[总体情感设计建议，约100字]`

  /**
   * 构建 User Prompt
   */
  private buildUserPrompt(input: AgentInput, context: AgentContext): string {
    const project = context.project
    const chapterId = input.type === 'emotion' ? input.chapterId : ''
    const arcType = input.type === 'emotion' ? input.arcType : undefined
    
    let userPrompt = `# **工作模式**：${arcType || '单章分析'}\n\n`
    
    // 内容输入
    if (arcType === '全书曲线生成' || arcType === '问题诊断') {
      // 全书模式：使用各章摘要
      userPrompt += `## 内容输入\n\n`
      const chapters = (project as any).chapters || []
      for (const chapter of chapters) {
        userPrompt += `- 第${chapter.chapterNumber || '?'}章：${chapter.title || '...'} - ${chapter.summary || '...'}\n`
      }
      userPrompt += '\n'
    } else if (chapterId) {
      // 单章模式：使用章节正文
      const chapters = (project as any).chapters || []
      const chapter = chapters.find((c: any) => c.id === chapterId)
      if (chapter) {
        userPrompt += `## 内容输入\n\n${chapter.content || '...'}\n\n`
      }
    }
    
    // 故事类型与情感预期
    userPrompt += `## 故事类型与情感预期\n\n`
    userPrompt += `**类型**：${project.genre || '不限'}\n`
    userPrompt += `**情感基调**：${project.tone || '不限'}\n`
    
    if (arcType) {
      userPrompt += `**全书情感设计目标**：${arcType}\n`
    }
    
    userPrompt += '\n---\n\n请按照 system prompt 中的格式输出对应结果。'
    
    return userPrompt
  }

  /**
   * 执行情感曲线分析（非流式）
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
   * 流式执行情感曲线分析
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
