import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'

/**
 * 定点修复 Agent（对应 InkOS Reviser）
 *
 * 管线 Step 6：根据审计报告的关键问题，定点修复章节草稿
 * 调 LLM（推荐强模型），仅修改问题段落，保留已通过内容
 *
 * 核心原则：
 * - 最小化修改：仅修复审计指出的关键问题
 * - 保留已通过内容：不改动未标记问题的段落
 * - 修复验证：修复后关键问题应清零
 * - 最多3次循环：防止无限修复
 */
export class ReviserAgent extends BaseAgent {
  readonly agentType = 'reviser' as const

  private readonly systemPrompt = `你是一位严谨的小说修订编辑。你的任务是根据一致性审计报告，对章节草稿进行定点修复。

## 修复原则

1. **最小化修改**：仅修改审计报告中标记为「关键」的问题，不改动任何未标记问题的段落
2. **保留原文风格**：修复时保持原文的语气、文风和叙事节奏
3. **连贯性优先**：修复后的段落必须与前后文自然衔接
4. **不引入新问题**：修复不能引入新的逻辑矛盾

## 输出格式

输出完整的修复后章节正文（Markdown格式）。在修复的段落前用 <!-- fix --> 标记，方便用户对比：

示例：
\`\`\`markdown
前文未修改内容...

<!-- fix -->
修复后的段落内容
<!-- /fix -->

后文未修改内容...
\`\`\`

## 修复策略

### 角色名错误
- 直接替换为正确名称

### 角色位置瞬移
- 添加合理的移动描写，或调整角色出场位置

### 物品凭空出现/消失
- 添加物品来源描写，或移除不合理的使用

### 角色行为不一致（OOC）
- 修改行为描写，使其符合角色性格设定

### 知识边界越界
- 删除角色不应知道的信息引用，或添加信息获取的合理途径

### 时间线矛盾
- 调整时间描述，使其与已建立的时间线一致

### 世界规则违反
- 修改描写，使其符合世界规则设定`

  /**
   * 构建 User Prompt
   */
  private buildUserPrompt(input: AgentInput, _context: AgentContext): string {
    if (input.type !== 'reviser') {
      throw new Error('ReviserAgent 收到了错误的输入类型')
    }

    const { content, auditIssues } = input

    let userPrompt = `# 请根据审计报告修复以下章节草稿\n\n`

    // 审计报告
    userPrompt += `## 审计报告\n\n`
    userPrompt += `发现 ${auditIssues.length} 个问题：\n\n`

    const criticalIssues = auditIssues.filter(i => i.severity === 'critical' || i.severity === '关键' || i.severity === '严重')
    const suggestionIssues = auditIssues.filter(i => i.severity !== 'critical' && i.severity !== '关键' && i.severity !== '严重')

    if (criticalIssues.length > 0) {
      userPrompt += `### 关键问题（必须修复）\n\n`
      for (let i = 0; i < criticalIssues.length; i++) {
        userPrompt += `${i + 1}. **[${criticalIssues[i].severity}]** ${criticalIssues[i].description}\n`
      }
      userPrompt += '\n'
    }

    if (suggestionIssues.length > 0) {
      userPrompt += `### 建议性问题（可选修复）\n\n`
      for (let i = 0; i < suggestionIssues.length; i++) {
        userPrompt += `${i + 1}. [${suggestionIssues[i].severity}] ${suggestionIssues[i].description}\n`
      }
      userPrompt += '\n'
    }

    userPrompt += `## 章节草稿\n\n${content}\n\n`
    userPrompt += '---\n\n请仅修复标记为「关键」的问题，保留其他所有内容不变。使用 <!-- fix --> 标记修复的段落。'

    return userPrompt
  }

  /**
   * 执行定点修复（非流式）
   */
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    const ctx = await this.buildContext(input, context)
    const userPrompt = this.buildUserPrompt(input, context)

    const messages = [
      { role: 'system' as const, content: this.systemPrompt + '\n\n' + ctx },
      { role: 'user' as const, content: userPrompt }
    ]

    const content = await this.callLLM(messages, context)

    // 清理修复标记（保留纯正文）
    const cleanedContent = this.cleanFixMarkers(content)

    return {
      content: cleanedContent,
      metadata: {
        hadMarkers: cleanedContent !== content,
        originalIssueCount: input.type === 'reviser' ? input.auditIssues.length : 0
      }
    }
  }

  /**
   * 流式执行定点修复
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
   * 清理修复标记，保留纯正文
   */
  private cleanFixMarkers(content: string): string {
    return content
      .replace(/<!--\s*fix\s*-->/g, '')
      .replace(/<!--\s*\/fix\s*-->/g, '')
      .trim()
  }
}
