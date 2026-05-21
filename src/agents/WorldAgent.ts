import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'

/**
 * 世界观构建 Agent（前期构建组）
 * 
 * 功能说明：
 * - 根据小说类型，生成完整的世界观设定
 * - 包括：世界规则、力量体系、地理格局、历史沿革等
 */
export class WorldAgent extends BaseAgent {
  /** Agent 类型标识 */
  readonly agentType = 'world' as const

  /** System Prompt（来自 prompts/b_精准指令/world_agent/system_prompt.md） */
  private readonly systemPrompt = `你是一位世界观设计师，专门为小说构建完整、自洽、有生命力的虚构世界。你的世界观设计既有宏观框架（历史/地理/势力）又有具体规则（力量体系/社会运行方式），并且内在逻辑严密，没有明显的漏洞。

## 核心原则

1. **规则先于设定**：一个好的世界首先需要"规则"（什么能做/不能做），其次才是具体地名和势力名称。
2. **限制创造张力**：最有趣的力量体系都有代价和上限。你会主动为每个力量体系设计约束。
3. **历史服务于现在**：世界观里的历史事件必须与当前故事有关联，不是为了显得厚重而堆砌背景。
4. **避免类型套路**：修仙世界不需要千篇一律的"炼气/筑基/金丹"晋级体系，除非用户明确要求。

## 输出格式

## 世界背景
[时代特征 / 环境概况 / 社会结构，约200字]

## 力量/魔法体系
### 体系名称：
**核心原理**：...
**等级划分**：...（3-6级即可，避免过度细分）
**能力边界**：...（可以做什么）
**代价与限制**：...（不能做什么，使用的代价）

## 主要势力
| 势力名称 | 立场 | 资源/优势 | 与主角的关系 |
|---------|------|---------|------------|
| ... | ... | ... | ... |

## 关键地点
（3-5处，格式：地点名 + 特征描述 + 在故事中的作用，各50字以内）

## 历史背景
（影响当前故事走向的2-3个历史事件，各50-80字）

## 世界核心规则
（3-5条，这个世界运作的根本逻辑）

## 质量要求

- 力量体系必须有明确的"代价与限制"，否则会丧失戏剧张力
- 势力不超过5个，每个都与主角有明确的关系（盟友/敌人/中立/未知）
- 不输出解释性废话，直接给设定内容`

  /**
   * 构建 User Prompt
   */
  private buildUserPrompt(input: AgentInput, context: AgentContext): string {
    const project = context.project
    const prompt = input.type === 'world' ? input.prompt : ''
    const projectContext = input.type === 'world' ? input.projectContext : undefined
    
    let userPrompt = `# 请根据以下故事基础，生成完整的世界观设定。\n\n`
    
    userPrompt += `**故事简介**：${project.synopsis || prompt}\n`
    userPrompt += `**小说类型**：${project.genre || '不限'}\n`
    userPrompt += `**文风**：${project.tone || '不限'}\n\n`
    
    if (projectContext) {
      userPrompt += `**用户已有的世界观草稿**：\n${projectContext}\n\n`
    }
    
    if (prompt && !project.synopsis) {
      userPrompt += `**用户特别要求**：\n${prompt}\n\n`
    }
    
    // 注入已挂载 Skill 的内容
    const skillSnippets = this.mountedSkills
      .map(s => s.systemPromptSnippet)
      .filter(Boolean)
      .join('\n\n')
    
    if (skillSnippets) {
      userPrompt += `## Skill 注入（如有）\n${skillSnippets}\n\n`
    }
    
    userPrompt += '---\n\n请按照 system prompt 中规定的 Markdown 格式输出世界观文档。'
    
    return userPrompt
  }

  /**
   * 执行世界观构建（非流式）
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
   * 流式执行世界观构建
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
