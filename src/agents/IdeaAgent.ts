import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'

/**
 * 创意激发 Agent（前期构建组）
 * 
 * 功能说明：
 * - 根据用户提供的关键词或主题，生成小说创意
 * - 支持指定类型（如：奇幻、都市、科幻等）
 * - 生成多个创意供用户选择
 */
export class IdeaAgent extends BaseAgent {
  /** Agent 类型标识 */
  readonly agentType = 'idea' as const

  /** System Prompt（来自 prompts/b_精准指令/idea_agent/system_prompt.md） */
  private readonly systemPrompt = `你是一位经验丰富的故事策划师，熟悉中文网络小说市场和传统文学写作规范。你的任务是根据用户提供的关键词和方向，生成3个具有明显差异的故事概念供用户选择。

## 你的目标

帮助用户快速找到一个**有潜力、有差异化、有执行路径**的故事核心。你不是在写故事，你是在为故事找"灵魂"。

## 输出规范

生成3个故事概念，每个概念包含以下5项内容：

### 概念 [编号]：[概念名称/一句话标签]

**核心前提**（一句话）：[谁 在 什么情况下 必须 做什么，会产生什么后果]

**主角方向**：[性格核心 + 与故事命题的关联，30字以内]

**核心冲突**：[主角的内部冲突 vs 外部冲突，各一句话]

**独特卖点**（差异化钩子）：[这个故事与同类相比，什么地方让读者停不下来，30-50字]

**大致结局方向**：[悲剧/喜剧/开放式，以及一句话概括主角最终的选择或代价]

## 质量要求

- 3个概念必须有明显差异（角色类型/故事走向/情感基调），不允许换汤不换药
- 核心前提要具体，避免"一个普通少年开始了他的修炼之路"这类废话
- 独特卖点要真的不同寻常，不是类型标配
- 如果用户提供了参考风格（如"类金庸"），需在概念中体现对应的叙事特征
- 输出中文，格式整洁`

  /**
   * 构建 User Prompt
   */
  private buildUserPrompt(input: AgentInput, _context: AgentContext): string {
    const prompt = input.type === 'idea' ? input.prompt : ''
    const genre = input.type === 'idea' ? (input.genre || '不限') : '不限'
    
    let userPrompt = `# 请根据以下信息，生成3个具有明显差异的故事概念。\n\n**关键词**：${prompt}\n**小说类型**：${genre}\n**目标体量**：长篇\n`
    
    // 注入已挂载 Skill 的内容
    const skillSnippets = this.mountedSkills
      .map(s => s.systemPromptSnippet)
      .filter(Boolean)
      .join('\n\n')
    
    if (skillSnippets) {
      userPrompt += `\n## Skill 注入（如有）\n${skillSnippets}\n`
    }
    
    userPrompt += '\n---\n\n请按照 system prompt 中规定的格式，输出3个故事概念。'
    
    return userPrompt
  }

  /**
   * 执行创意激发（非流式）
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
   * 流式执行创意激发
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
