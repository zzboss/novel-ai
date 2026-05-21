import type { AgentInput, AgentOutput, AgentContext, StoryState, CharacterState, PendingHook, ChapterSummary } from './types'
import { BaseAgent } from './base'
import { PromptLoader, AGENT_CATEGORY_MAP, AGENT_PROMPT_NAME_MAP } from '@/utils/promptLoader'
import { StoryStateSchema } from '@/schemas/storyState'

/**
 * 状态提取 Agent（对应 InkOS 的 Observer）
 * 
 * 功能：
 * 1. 从章节正文中提取结构化事实
 * 2. 更新 StoryState（角色状态、资源台账、伏笔追踪等）
 * 3. 生成章节摘要
 * 
 * 设计思路：
 * - 参考 InkOS 的 Observer 模式
 * - 使用 LLM 提取事实，然后通过 Zod Schema 校验
 * - 输出结构化的 StateDelta，用于更新 StoryState
 */
export class StateExtractorAgent extends BaseAgent {
  /** Agent 类型标识 */
  readonly agentType = 'state_extractor' as const

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

    const category = AGENT_CATEGORY_MAP[this.agentType] || 'd_分析推理'
    const agentName = AGENT_PROMPT_NAME_MAP[this.agentType] || 'state_extractor_agent'
    
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
   * 从章节正文提取结构化事实
   * 
   * @param chapterContent - 章节正文
   * @param project - 项目状态（用于获取角色列表、世界观等）
   * @param context - Agent 执行上下文
   * @returns 提取的事实（StateDelta）
   */
  async extract(
    chapterContent: string,
    project: any, // ProjectState
    context: AgentContext
  ): Promise<{
    characterStates: Record<string, Partial<CharacterState>>
    resourceUpdates: Record<string, { action: 'add' | 'update' | 'remove'; data: any }>
    hookUpdates: Array<{ action: 'add' | 'update' | 'resolve'; data: Partial<PendingHook> }>
    chapterSummary: Partial<ChapterSummary>
  }> {
    // 构建提取提示词
    const prompt = this.buildExtractionPrompt(chapterContent, project)
    
    // 加载 System Prompt
    const systemPrompt = await this.getSystemPrompt()
    
    // 调用 LLM 进行提取
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: prompt }
    ]
    
    const result = await this.callLLM(messages, context)
    
    // 解析 LLM 输出（假设输出是 JSON 格式）
    try {
      // 先清理 LLM 返回结果，去除可能的 Markdown 代码块包裹
      let cleanResult = result.trim()
      
      // 去除 ```json ... ``` 或 ``` ... ``` 包裹
      const codeBlockMatch = cleanResult.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```$/)
      if (codeBlockMatch) {
        cleanResult = codeBlockMatch[1].trim()
      }
      
      const parsed = JSON.parse(cleanResult)
      
      // 通过 Zod Schema 校验
      const validated = this.validateExtractionResult(parsed)
      
      return validated
    } catch (error) {
      console.error('[StateExtractorAgent] Failed to parse extraction result:', error)
      console.error('[StateExtractorAgent] Raw result:', result)
      
      // 返回空结果
      return {
        characterStates: {},
        resourceUpdates: {},
        hookUpdates: [],
        chapterSummary: {}
      }
    }
  }

  /**
   * 构建提取提示词
   */
  private buildExtractionPrompt(chapterContent: string, project: any): string {
    let prompt = `# 请从以下章节正文中提取结构化事实\n\n`
    
    prompt += `## 提取要求\n\n`
    prompt += `1. **角色状态变化**：提取每个出场角色的位置、情绪、知识、物品、关系变化\n`
    prompt += `2. **资源台账更新**：提取物品的获得、使用、消耗、转移\n`
    prompt += `3. **伏笔追踪**：提取伏笔的埋下或回收\n`
    prompt += `4. **章节摘要**：生成 200 字以内的章节摘要\n\n`
    
    prompt += `## 输出格式\n\n`
    prompt += `必须输出严格的 JSON 格式，包含以下字段：\n`
    prompt += `\`\`\`json\n`
    prompt += `{\n`
    prompt += `  "characterStates": { "角色ID": { "location": "...", "emotionalState": "...", ... } },\n`
    prompt += `  "resourceUpdates": { "物品ID": { "action": "add|update|remove", "data": {...} } },\n`
    prompt += `  "hookUpdates": [{ "action": "add|update|resolve", "data": {...} }],\n`
    prompt += `  "chapterSummary": { "summary": "...", "keyEvents": [...], ... }\n`
    prompt += `}\n`
    prompt += `\`\`\`\n\n`
    
    prompt += `## 章节正文\n\n${chapterContent}`
    
    return prompt
  }

  /**
   * 校验提取结果
   */
  private validateExtractionResult(data: any): {
    characterStates: Record<string, Partial<CharacterState>>
    resourceUpdates: Record<string, { action: 'add' | 'update' | 'remove'; data: any }>
    hookUpdates: Array<{ action: 'add' | 'update' | 'resolve'; data: Partial<PendingHook> }>
    chapterSummary: Partial<ChapterSummary>
  } {
    // 基础校验
    const result = {
      characterStates: data.characterStates || {},
      resourceUpdates: data.resourceUpdates || {},
      hookUpdates: data.hookUpdates || [],
      chapterSummary: data.chapterSummary || {}
    }
    
    // TODO: 使用 Zod Schema 进行严格校验
    // const validated = StoryStateSchema.partial().parse(data)
    
    return result
  }

  /**
   * 执行状态提取（非流式）
   */
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    if (input.type !== 'state_extractor') {
      throw new Error('StateExtractorAgent 收到了错误的输入类型')
    }

    const { chapterId, chapterContent } = input
    const project = context.project

    // 提取结构化事实
    const extractionResult = await this.extract(chapterContent, project, context)

    // 生成章节摘要
    const summary = extractionResult.chapterSummary.summary || ''
    const keyEvents = extractionResult.chapterSummary.keyEvents || []

    return {
      content: JSON.stringify(extractionResult, null, 2),
      metadata: {
        chapterId,
        summary,
        keyEvents,
        characterCount: Object.keys(extractionResult.characterStates).length,
        resourceUpdateCount: Object.keys(extractionResult.resourceUpdates).length,
        hookUpdateCount: extractionResult.hookUpdates.length
      }
    }
  }

  /**
   * 流式执行状态提取
   */
  async *stream(input: AgentInput, context: AgentContext): AsyncGenerator<string> {
    if (input.type !== 'state_extractor') {
      throw new Error('StateExtractorAgent 收到了错误的输入类型')
    }

    const result = await this.execute(input, context)
    yield result.content
  }
}
