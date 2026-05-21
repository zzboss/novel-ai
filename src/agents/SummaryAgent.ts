import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'

/**
 * 摘要生成 Agent（对应 InkOS Observer 的摘要部分）
 *
 * 管线 Step 4 补充：生成章节200字摘要
 * 调 LLM（推荐轻量模型），输出结构化摘要
 *
 * 用途：
 * - 注入后续章节的「前N章摘要」上下文
 * - 支持长篇小说的语义检索
 * - 为伏笔看板提供章节事件索引
 */
export class SummaryAgent extends BaseAgent {
  readonly agentType = 'summary' as const

  private readonly systemPrompt = `你是一位专业的小说内容摘要专家。你的任务是为章节正文生成简洁精准的摘要。

## 摘要要求

1. **字数**：200字左右，不超过300字
2. **内容**：必须包含以下要素
   - 核心事件：本章发生了什么
   - 角色动态：哪些角色出场，关键行为/变化
   - 情节推进：对主线剧情的贡献
   - 伏笔线索：埋下了什么伏笔或回收了什么伏笔
3. **风格**：客观陈述，不加评价
4. **语言**：中文

## 输出格式

严格按照以下JSON格式输出：

\`\`\`json
{
  "summary": "200字摘要内容",
  "keyEvents": ["关键事件1", "关键事件2", "关键事件3"],
  "characterChanges": {
    "角色名": "状态变更描述"
  }
}
\`\`\`

## 重要提醒
- keyEvents 应列出3-5个最重要的情节节点
- characterChanges 只记录有显著变化的角色
- 只输出JSON，不要输出任何解释文字`

  /**
   * 构建 User Prompt
   */
  private buildUserPrompt(input: AgentInput, context: AgentContext): string {
    if (input.type !== 'summary') {
      throw new Error('SummaryAgent 收到了错误的输入类型')
    }

    const { chapterId, chapterContent } = input
    const project = context.project

    let userPrompt = `# 请为以下章节生成摘要\n\n`

    // 章节标题
    for (const vol of project.volumes) {
      const chapter = vol.chapters.find(c => c.id === chapterId)
      if (chapter) {
        userPrompt += `## 章节信息\n\n`
        userPrompt += `标题：${chapter.title}\n`
        userPrompt += `所属卷：${vol.title}\n\n`
        break
      }
    }

    // 角色对照表
    if (project.characters.length > 0) {
      userPrompt += `## 主要角色\n\n`
      for (const char of project.characters.slice(0, 10)) {
        userPrompt += `- ${char.name}（${char.role === 'protagonist' ? '主角' : char.role}）\n`
      }
      userPrompt += '\n'
    }

    userPrompt += `## 章节正文\n\n${chapterContent}\n\n`
    userPrompt += '---\n\n请严格按照JSON格式输出摘要。'

    return userPrompt
  }

  /**
   * 执行摘要生成（非流式）
   */
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    const ctx = await this.buildContext(input, context)
    const userPrompt = this.buildUserPrompt(input, context)

    const messages = [
      { role: 'system' as const, content: this.systemPrompt + '\n\n' + ctx },
      { role: 'user' as const, content: userPrompt }
    ]

    const content = await this.callLLM(messages, context)

    // 尝试解析JSON
    const parsed = this.parseSummaryJSON(content)

    return {
      content: parsed ? JSON.stringify(parsed, null, 2) : content,
      metadata: { summary: parsed }
    }
  }

  /**
   * 流式执行摘要生成
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

  /**
   * 解析LLM输出的摘要JSON
   */
  private parseSummaryJSON(content: string): {
    summary: string
    keyEvents: string[]
    characterChanges: Record<string, string>
  } | null {
    try {
      return JSON.parse(content)
    } catch {
      const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1])
        } catch {
          // fallthrough
        }
      }

      const startIdx = content.indexOf('{')
      const endIdx = content.lastIndexOf('}')
      if (startIdx !== -1 && endIdx > startIdx) {
        try {
          return JSON.parse(content.substring(startIdx, endIdx + 1))
        } catch {
          // fallthrough
        }
      }

      return null
    }
  }
}
