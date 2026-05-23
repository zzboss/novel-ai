import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'
import { PromptLoader, AGENT_CATEGORY_MAP, AGENT_PROMPT_NAME_MAP } from '@/utils/promptLoader'
import type { OutlineResponseData } from '@/types/llm-response'

/**
 * 大纲规划 Agent（前期构建组）
 * 
 * 功能说明：
 * - 根据小说类型和创意，生成完整的大纲
 * - 包括：卷数、每卷的章节数、章节标题、章节摘要
 */
export class OutlineAgent extends BaseAgent {
  /** Agent 类型标识 */
  readonly agentType = 'outline' as const

  /**
   * 从文件加载的 System Prompt（延迟加载，首次调用时加载并缓存）
   */
  private systemPromptCache: string | null = null

  /**
   * 获取 System Prompt（从文件加载，带缓存）
   */
  private async getSystemPrompt(): Promise<string> {
    if (this.systemPromptCache) {
      return this.systemPromptCache
    }

    const category = AGENT_CATEGORY_MAP[this.agentType] || 'a_精密构造'
    const agentName = AGENT_PROMPT_NAME_MAP[this.agentType] || 'outline_agent'
    
    // 加载 System Prompt
    const systemPrompt = await PromptLoader.loadSystemPrompt(category, agentName)
    
    // 加载 Few-shot 示例（如果有），追加到 System Prompt 后面
    const fewShot = await PromptLoader.loadFewShotExamples(category, agentName)
    
    // 组装最终 System Prompt
    this.systemPromptCache = systemPrompt + (fewShot ? '\n\n---\n\n' + fewShot : '')
    
    return this.systemPromptCache
  }

  /**
   * 清除提示词缓存（当提示词文件更新时调用）
   */
  clearPromptCache(): void {
    this.systemPromptCache = null
    PromptLoader.clearCache()
  }

  /**
   * 构建 User Prompt（从文件加载模板并填充变量）
   */
  private async buildUserPrompt(input: AgentInput, context: AgentContext): Promise<string> {
    const project = context.project
    const prompt = input.type === 'outline' ? input.prompt : ''
    const volumeCount = input.type === 'outline' ? input.volumeCount : undefined
    
    // 从文件加载 User Prompt 模板
    const category = AGENT_CATEGORY_MAP[this.agentType] || 'a_精密构造'
    const agentName = AGENT_PROMPT_NAME_MAP[this.agentType] || 'outline_agent'
    let userPromptTemplate = await PromptLoader.loadUserPromptTemplate(category, agentName)
    
    // 如果模板文件不存在，使用默认模板
    if (!userPromptTemplate) {
      userPromptTemplate = `# 请根据以下项目信息，生成一份完整的全书大纲。

## 项目基本信息

**书名**：{{projectTitle}}
**类型**：{{genre}}
**文风**：{{tone}}
**目标总字数**：{{targetWords}} 字（约 {{estimatedChapters}} 章）
**面向读者**：{{targetAudience}}

## 故事基础

**故事简介（核心前提）**：
{{synopsis}}

**主角**：{{protagonistDescription}}

**反派/核心对手**：{{antagonistDescription}}

**核心冲突**：
{{coreConflict}}

**主题思想**（用户已填写，可选）：
{{theme}}

## 世界观摘要

{{worldSummary}}

## 主要角色档案（简版）

{{characterSummaries}}

## 用户的特殊要求

{{userRequirements}}

## Skill 注入（如有）

{{skillInjections}}

---

请严格按照 system prompt 中规定的 Markdown 格式输出完整大纲。`
    }
    
    // 准备模板变量
    const protagonist = (project as any).characters?.find((c: any) => c.role === 'protagonist')
    const antagonist = (project as any).characters?.find((c: any) => c.role === 'antagonist')
    const characters = (project as any).characters || []
    
    const characterSummaries = characters.slice(0, 5).map((char: any) => 
      `- ${char.name}（${char.role || '配角'}）：${char.personality || '...'}`
    ).join('\n')
    
    const variables: Record<string, string> = {
      projectTitle: project.name || '未命名项目',
      genre: project.genre || '不限',
      tone: project.tone || '不限',
      targetWords: String(project.targetWords || '100万'),
      estimatedChapters: String(volumeCount || '3'),
      targetAudience: project.targetAudience || '通用',
      synopsis: project.synopsis || prompt || '待补充',
      protagonistDescription: protagonist ? `${protagonist.name} - ${protagonist.personality || '待补充'}` : '待补充',
      antagonistDescription: antagonist ? `${antagonist.name} - ${antagonist.personality || '待补充'}` : '待补充',
      coreConflict: (project as any).coreConflict || '待补充',
      theme: (project as any).theme || '待补充',
      worldSummary: (project as any).worldSummary || '待补充',
      characterSummaries: characterSummaries || '待补充',
      userRequirements: prompt && !project.synopsis ? prompt : '无',
      skillInjections: this.mountedSkills.map(s => s.systemPromptSnippet).filter(Boolean).join('\n\n') || '无'
    }
    
    // 填充模板
    const userPrompt = PromptLoader.fillTemplate(userPromptTemplate, variables)
    
    return userPrompt
  }

  /**
   * 执行大纲规划（非流式，返回 JSON 格式）
   * 
   * 流程：
   * 1. 构建上下文和 User Prompt
   * 2. 加载 System Prompt（从文件）
   * 3. 调用 LLM 并解析 JSON 响应
   * 4. 提取大纲数据
   * 5. 返回 AgentOutput
   */
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    const ctx = await this.buildContext(input, context)
    const userPrompt = await this.buildUserPrompt(input, context)
    
    // 加载 System Prompt（从文件）
    const systemPrompt = await this.getSystemPrompt()
    
    const messages = [
      { role: 'system' as const, content: systemPrompt + '\n\n' + ctx },
      { role: 'user' as const, content: userPrompt }
    ]
    
    // 调用 LLM 并解析 JSON 响应
    const response = await this.callLLMJSON<{ success: boolean; data: OutlineResponseData; message?: string }>(messages, context)
    
    // 检查响应是否成功
    if (!response.success) {
      throw new Error(response.message || '大纲生成失败')
    }
    
    const { outline } = response.data
    
    // 返回大纲内容（JSON 字符串）
    return {
      content: JSON.stringify(outline, null, 2),
      metadata: {
        outlineTitle: outline.title,
        outlineSummary: outline.summary,
        structure: outline.structure,
        arcCount: outline.arcs.length,
        chapterCount: outline.chapters.length
      }
    }
  }
}
