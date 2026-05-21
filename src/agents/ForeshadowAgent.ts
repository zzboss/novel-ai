import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'

/**
 * 伏笔管理 Agent（质量保障组）
 *
 * 已重构：接入 StoryState.pendingHooks
 * - 伏笔数据从 StoryState.pendingHooks 读取
 * - 新发现的伏笔通过 StoryStateUpdater 写入
 * - 支持伏笔自动追踪和状态管理
 */
export class ForeshadowAgent extends BaseAgent {
  readonly agentType = 'foreshadow' as const

  private readonly systemPrompt = `你是一位专注于伏笔管理的叙事顾问。你的任务是帮助作者追踪全书的伏笔状态：哪些已经埋下、哪些应该回收、哪些被遗忘了、哪些处理得不够漂亮。

一个被精心处理的伏笔能让读者在回收时感受到"原来早就说了！"的惊喜——你的工作就是保证这件事发生。

## 工作模式

系统会根据用户操作传入不同的任务类型：

### 模式1：从章节中提取伏笔（scan）
分析传入的章节内容，识别其中可能的伏笔（显性/隐性/物品/角色/事件），生成伏笔候选列表供用户确认。

### 模式2：全书伏笔状态扫描（status）
输出当前所有已记录伏笔的状态概览（已回收/待回收/超期/搁置）。

### 模式3：写新章节前的伏笔提醒（remind）
根据即将开始的章节，提醒作者：哪些伏笔已到预计回收时机、哪些可以在本章推进。

### 模式4：为指定伏笔生成回收方案（resolve）
针对一条具体伏笔，生成2-3种不同风格的回收方案（出乎意料程度/回收方式/情感效果各异）。

## 伏笔分类

- **主线伏笔**：影响核心冲突和结局，必须回收（urgency: high）
- **次线伏笔**：增加故事层次，建议回收（urgency: medium）
- **细节伏笔**：增加真实感的小细节，可以回收也可以让读者自行联想（urgency: low）

## 输出格式

根据工作模式不同，输出对应格式。

### 提取伏笔时（scan模式）输出JSON：

\`\`\`json
{
  "foreshadows": [
    {
      "description": "伏笔描述",
      "type": "主线/次线/细节",
      "urgency": "high/medium/low",
      "relatedCharacters": ["角色名1"],
      "expectedResolve": "预计回收时机",
      "evidence": "原文引用"
    }
  ]
}
\`\`\`

### 状态扫描时（status模式）输出概览文本。

### 提醒模式（remind）输出建议文本。

### 回收方案（resolve模式）输出2-3种方案。`

  /**
   * 构建 User Prompt
   */
  private buildUserPrompt(input: AgentInput, context: AgentContext): string {
    const project = context.project
    const chapterId = input.type === 'foreshadow' ? input.chapterId : ''
    const mode = input.type === 'foreshadow' ? input.mode : 'scan'

    let userPrompt = `# **工作模式**：${mode}\n\n`

    // ★ 从 StoryState.pendingHooks 读取伏笔库
    if (project.storyState?.pendingHooks) {
      const hooks = project.storyState.pendingHooks
      if (hooks.length > 0) {
        userPrompt += `## 当前伏笔库（来自StoryState）\n\n`

        const openHooks = hooks.filter(h => h.status === 'open')
        const progressingHooks = hooks.filter(h => h.status === 'progressing')
        const resolvedHooks = hooks.filter(h => h.status === 'resolved')

        if (openHooks.length > 0) {
          userPrompt += `### 待回收伏笔（${openHooks.length}条）\n\n`
          for (const hook of openHooks) {
            userPrompt += `- ID: ${hook.id} | [${hook.urgency}紧迫] 「${hook.description}」`
            if (hook.relatedCharacters.length > 0) {
              const charNames = hook.relatedCharacters.map(id => {
                const char = project.characters.find(c => c.id === id)
                return char?.name || id
              })
              userPrompt += ` | 相关角色：${charNames.join('、')}`
            }
            userPrompt += ` | 埋于：${hook.plantedChapter}\n`
          }
          userPrompt += '\n'
        }

        if (progressingHooks.length > 0) {
          userPrompt += `### 推进中的伏笔（${progressingHooks.length}条）\n\n`
          for (const hook of progressingHooks) {
            userPrompt += `- ID: ${hook.id} | 「${hook.description}」 | 埋于：${hook.plantedChapter}\n`
          }
          userPrompt += '\n'
        }

        if (mode === 'status' && resolvedHooks.length > 0) {
          userPrompt += `### 已回收伏笔（${resolvedHooks.length}条）\n\n`
          for (const hook of resolvedHooks) {
            userPrompt += `- ID: ${hook.id} | 「${hook.description}」 | 回收于：${hook.resolvedChapter || '?'} | 回收方式：${hook.resolution || '?'}\n`
          }
          userPrompt += '\n'
        }
      } else {
        userPrompt += `## 当前伏笔库\n\n暂无记录的伏笔。\n\n`
      }
    }

    // 当前章节内容（提取伏笔模式）
    if (mode === 'scan' && chapterId) {
      for (const vol of project.volumes) {
        const chapter = vol.chapters.find(c => c.id === chapterId)
        if (chapter && 'content' in chapter) {
          userPrompt += `## 当前章节内容\n\n${(chapter as any).content || '...'}\n\n`
          break
        }
      }
    }

    // 即将写作的章节信息（写作前提醒模式）
    if (mode === 'remind') {
      userPrompt += `## 即将写作的章节信息\n\n`
      userPrompt += `章节ID：${chapterId || '...'}\n\n`

      // 提供高紧迫度伏笔提醒
      const highUrgencyHooks = project.storyState?.pendingHooks.filter(
        h => h.status !== 'resolved' && h.urgency === 'high'
      ) || []

      if (highUrgencyHooks.length > 0) {
        userPrompt += `### 高紧迫度伏笔提醒\n\n`
        for (const hook of highUrgencyHooks) {
          userPrompt += `- 「${hook.description}」应在本章或近期回收\n`
        }
        userPrompt += '\n'
      }
    }

    // 世界观摘要
    if (project.worldSettings.rules) {
      userPrompt += `## 相关背景信息\n\n${project.worldSettings.rules}\n\n`
    }

    userPrompt += '---\n\n请根据工作模式，输出对应格式的结果。'

    return userPrompt
  }

  /**
   * 执行伏笔管理（非流式）
   */
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    const ctx = await this.buildContext(input, context)
    const userPrompt = this.buildUserPrompt(input, context)

    const messages = [
      { role: 'system' as const, content: this.systemPrompt + '\n\n' + ctx },
      { role: 'user' as const, content: userPrompt }
    ]

    const content = await this.callLLM(messages, context)

    // 解析提取结果（scan模式）
    const mode = input.type === 'foreshadow' ? input.mode : 'scan'
    const metadata: Record<string, unknown> = { mode }

    if (mode === 'scan') {
      const parsed = this.parseForeshadowJSON(content)
      if (parsed) {
        metadata.extractedForeshadows = parsed.foreshadows
      }
    }

    return { content, metadata }
  }

  /**
   * 流式执行伏笔管理
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
   * 解析提取伏笔的JSON
   */
  private parseForeshadowJSON(content: string): { foreshadows: Array<{
    description: string
    type: string
    urgency: string
    relatedCharacters: string[]
    expectedResolve: string
    evidence: string
  }>} | null {
    try {
      return JSON.parse(content)
    } catch {
      const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1])
        } catch {
          return null
        }
      }
      return null
    }
  }
}
