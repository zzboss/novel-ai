import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'
import { PromptLoader, AGENT_CATEGORY_MAP, AGENT_PROMPT_NAME_MAP } from '@/utils/promptLoader'
import type { SummaryResponseData } from '@/types/llm-response'

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
 * 
 * 从文件加载提示词：prompts/c_快速执行/summary_agent/system_prompt.md
 */
export class SummaryAgent extends BaseAgent {
  readonly agentType = 'summary' as const
  
  /** 
   * 加载 System Prompt（从文件）
   */
  private async getSystemPrompt(): Promise<string> {
    try {
      const prompt = await PromptLoader.loadSystemPrompt(
        AGENT_CATEGORY_MAP.summary,
        AGENT_PROMPT_NAME_MAP.summary
      )
      return prompt
    } catch (error) {
      console.error('[SummaryAgent] 加载 system_prompt 失败，使用默认提示词:', error)
      // 返回默认提示词（简化版）
      return `你是一位专业的小说内容摘要专家。为章节正文生成简洁精准的摘要。
      
## 输出格式要求
      
**重要：你必须返回严格的 JSON 格式！**
      
输出格式如下：
\`\`\`json
{
  "success": true,
  "data": {
    "summary": "200字摘要内容",
    "keyEvents": ["关键事件1", "关键事件2"],
    "characterChanges": {}
  }
}
\`\`\`

---

**重要提醒：只返回 JSON，不要返回其他内容！**`
    }
  }

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
    userPrompt += '---\n\n请按照 system prompt 中规定的 JSON 格式，生成摘要。'
    
    return userPrompt
  }

  /**
   * 执行摘要生成（非流式，返回 JSON 格式）
   * 
   * 流程：
   * 1. 加载 System Prompt（从文件）
   * 2. 构建上下文和 User Prompt
   * 3. 调用 LLM 并解析 JSON 响应
   * 4. 提取摘要数据
   * 5. 返回 AgentOutput
   */
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    const ctx = await this.buildContext(input, context)
    const userPrompt = this.buildUserPrompt(input, context)
    
    // 加载 System Prompt（从文件）
    const systemPrompt = await this.getSystemPrompt()
    
    const messages = [
      { role: 'system' as const, content: systemPrompt + '\n\n' + ctx },
      { role: 'user' as const, content: userPrompt }
    ]
    
    // 调用 LLM 并解析 JSON 响应
    const response = await this.callLLMJSON<{ success: boolean; data: SummaryResponseData; message?: string }>(messages, context)
    
    // 检查响应是否成功
    if (!response.success) {
      throw new Error(response.message || '摘要生成失败')
    }
    
    const { summary, keyEvents, characterChanges } = response.data
    
    // 返回摘要内容
    return {
      content: summary,
      metadata: {
        summary,
        keyEventsCount: keyEvents?.length || 0,
        hasCharacterChanges: characterChanges && Object.keys(characterChanges).length > 0,
        characterChanges
      }
    }
  }
}
