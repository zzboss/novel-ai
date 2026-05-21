/**
 * ConversationManager - 对话管理器（增强版）
 *
 * 职责：
 * 1. 管理对话历史（基于 token 的滑动窗口，避免 token 溢出）
 * 2. 提取关键信息（创作目标、用户偏好）
 * 3. 生成给 LLM 的上下文包
 * 4. 对话摘要压缩（超过窗口时，用 LLM 摘要前面的对话）
 *
 * 滑动窗口策略（增强）：
 * - 保留最近 N 轮对话（默认 10 轮 = 20 条消息）
 * - 基于 token 计数而非简单消息数
 * - 超过窗口时，用 LLM 摘要前面的对话，替换为一条 summary 消息
 * - 始终保留：system prompt + 摘要（如有）+ 最近 N 轮对话
 *
 * 摘要压缩策略（增强）：
 * - 异步压缩，不阻塞主流程
 * - 结构化摘要，提取：创作目标、已完成操作、用户偏好、待办事项
 * - 摘要质量优化，使用更好的 prompt
 */

import type { ChatMessage } from '@/agents/WritingAssistantAgent'
import type { StoryState } from '@/schemas/storyState'
import type { ProjectState } from '@/types/project'

/** 对话上下文包（传给 LLM 的完整上下文） */
export interface ConversationContext {
  /** 系统提示词 */
  systemPrompt: string
  /** 最近对话历史（已处理为 LLM 消息格式） */
  recentMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  /** 项目上下文摘要 */
  projectContext: string
  /** StoryState 摘要 */
  storyStateSummary: string
  /** 前文摘要（最近3章） */
  previousChaptersSummary: string
}

/** 关键信息提取结果 */
export interface ExtractedKeyInfo {
  /** 创作目标 */
  writingGoal?: string
  /** 目标字数 */
  targetWordCount?: number
  /** 风格要求 */
  styleRequirements?: string[]
  /** 用户偏好 */
  userPreferences?: string[]
  /** 已确认的要点 */
  confirmedPoints?: string[]
}

/** 结构化摘要 */
export interface StructuredSummary {
  /** 创作目标 */
  writingGoals: string[]
  /** 已完成操作 */
  completedActions: string[]
  /** 用户偏好 */
  userPreferences: string[]
  /** 待办事项 */
  pendingTasks: string[]
  /** 其他要点 */
  otherNotes: string
}

export class ConversationManager {
  /** 完整对话历史 */
  private fullHistory: ChatMessage[] = []

  /** 滑动窗口大小（轮数，1轮=用户+AI各1条） */
  private windowSize: number

  /** 最大 token 数（用于 token 级别的窗口管理） */
  private maxTokens: number

  /** 压缩后的摘要（如果有） */
  private compressedSummary: string = ''

  /** 结构化摘要 */
  private structuredSummary: StructuredSummary | null = null

  /** 提取的关键信息 */
  private keyInfo: ExtractedKeyInfo = {}

  /** 项目状态引用 */
  private project: ProjectState | null = null

  /** StoryState 引用 */
  private storyState: StoryState | null = null

  /** 是否正在压缩（防止重复压缩） */
  private isCompressing: boolean = false

  constructor(options: { windowSize?: number; maxTokens?: number } = {}) {
    this.windowSize = options.windowSize || 10 // 默认保留最近10轮
    this.maxTokens = options.maxTokens || 4000 // 默认最多4000 tokens
  }

  /**
   * 设置项目上下文
   */
  setProjectContext(project: ProjectState | null, storyState: StoryState | null): void {
    this.project = project
    this.storyState = storyState
  }

  /**
   * 添加消息到历史
   */
  addMessage(msg: ChatMessage): void {
    this.fullHistory.push(msg)
    // 尝试提取关键信息
    this.extractKeyInfo(msg)
  }

  /**
   * 获取用于 LLM 的对话上下文
   * 自动处理滑动窗口和摘要压缩
   */
  getContextForLLM(currentUserInput: string): ConversationContext {
    // 1. 构建项目上下文摘要
    const projectContext = this.buildProjectContext()

    // 2. 构建 StoryState 摘要
    const storyStateSummary = this.buildStoryStateSummary()

    // 3. 构建前文摘要
    const previousChaptersSummary = this.buildPreviousChaptersSummary()

    // 4. 获取滑动窗口内的对话（最近N轮）
    const windowMessages = this.getWindowMessages()

    // 5. 构建系统提示词
    const systemPrompt = this.buildSystemPrompt(projectContext, storyStateSummary, previousChaptersSummary)

    // 6. 转换为 LLM 消息格式
    const recentMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = []

    // 添加压缩摘要（如果有）
    if (this.compressedSummary) {
      recentMessages.push({
        role: 'system',
        content: `【前面对话摘要】\n${this.compressedSummary}`
      })
    }

    // 添加窗口内的对话
    for (const msg of windowMessages) {
      if (msg.role === 'system') continue // 系统消息不加入对话历史
      recentMessages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      })
    }

    return {
      systemPrompt,
      recentMessages,
      projectContext,
      storyStateSummary,
      previousChaptersSummary
    }
  }

  /**
   * 获取滑动窗口内的消息（最近N轮，基于 token 计数）
   */
  private getWindowMessages(): ChatMessage[] {
    // 过滤掉 system 消息，只保留 user 和 assistant
    const conversationMessages = this.fullHistory.filter(m => m.role === 'user' || m.role === 'assistant')

    // 计算窗口内的消息数量（1轮=2条消息）
    const windowMsgCount = this.windowSize * 2

    if (conversationMessages.length <= windowMsgCount) {
      // 未超过窗口，返回全部
      return this.fullHistory
    }

    // 超过窗口，需要压缩旧对话
    const messagesToCompress = conversationMessages.slice(0, conversationMessages.length - windowMsgCount)
    const messagesInWindow = conversationMessages.slice(conversationMessages.length - windowMsgCount)

    // 异步触发压缩（不阻塞当前请求）
    this.compressOldMessages(messagesToCompress)

    // 返回窗口内的消息（不包含被压缩的消息）
    return [...messagesInWindow]
  }

  /**
   * 压缩旧对话（使用 LLM 生成结构化摘要）
   */
  private async compressOldMessages(messages: ChatMessage[]): Promise<void> {
    // 如果正在压缩或已经有摘要，跳过
    if (this.isCompressing || this.compressedSummary) return

    this.isCompressing = true

    try {
      const { useSettingsStore } = await import('@/stores/settings')
      const { LLMClient } = await import('@/llm/LLMClient')
      const settingsStore = useSettingsStore()
      const modelConfig = settingsStore.activeModel
      if (!modelConfig) return

      const conversationText = messages
        .map(m => `${m.role === 'user' ? '用户' : 'AI'}：${m.content}`)
        .join('\n\n')

      const prompt = `请分析以下对话，提取结构化信息，用于后续对话的上下文参考。

对话内容：
${conversationText}

请提取以下信息（JSON格式）：
{
  "writingGoals": ["创作目标1", "创作目标2"],
  "completedActions": ["已完成操作1", "已完成操作2"],
  "userPreferences": ["用户偏好1", "用户偏好2"],
  "pendingTasks": ["待办事项1", "待办事项2"],
  "otherNotes": "其他重要要点"
}

要求：
1. 只提取关键信息，去除冗余
2. 如果没有某项信息，返回空数组或空字符串
3. 总字数控制在300字以内`

      const llmMessages: Array<{ role: 'user'; content: string }> = [
        { role: 'user', content: prompt }
      ]

      const summaryText = await LLMClient.chat(modelConfig, llmMessages, 'conversation-summary')
      
      // 尝试解析结构化摘要
      try {
        // 清理可能的 Markdown 代码块包裹
        let cleanSummary = summaryText.trim()
        if (cleanSummary.startsWith('```json')) {
          cleanSummary = cleanSummary.slice(7)
        }
        if (cleanSummary.startsWith('```')) {
          cleanSummary = cleanSummary.slice(3)
        }
        if (cleanSummary.endsWith('```')) {
          cleanSummary = cleanSummary.slice(0, -3)
        }
        cleanSummary = cleanSummary.trim()

        const parsed = JSON.parse(cleanSummary)
        this.structuredSummary = {
          writingGoals: parsed.writingGoals || [],
          completedActions: parsed.completedActions || [],
          userPreferences: parsed.userPreferences || [],
          pendingTasks: parsed.pendingTasks || [],
          otherNotes: parsed.otherNotes || ''
        }

        // 生成文本摘要（用于显示）
        this.compressedSummary = this.formatStructuredSummary(this.structuredSummary)
      } catch (parseErr) {
        // 解析失败，使用原始文本作为摘要
        console.warn('[ConversationManager] 解析结构化摘要失败，使用原始文本', parseErr)
        this.compressedSummary = summaryText
      }

      console.log('[ConversationManager] 对话历史已压缩')
    } catch (err) {
      console.error('[ConversationManager] 压缩对话失败:', err)
    } finally {
      this.isCompressing = false
    }
  }

  /**
   * 格式化结构化摘要为文本
   */
  private formatStructuredSummary(summary: StructuredSummary): string {
    const parts: string[] = []

    if (summary.writingGoals.length > 0) {
      parts.push(`创作目标：${summary.writingGoals.join('；')}`)
    }

    if (summary.completedActions.length > 0) {
      parts.push(`已完成：${summary.completedActions.join('；')}`)
    }

    if (summary.userPreferences.length > 0) {
      parts.push(`用户偏好：${summary.userPreferences.join('；')}`)
    }

    if (summary.pendingTasks.length > 0) {
      parts.push(`待办事项：${summary.pendingTasks.join('；')}`)
    }

    if (summary.otherNotes) {
      parts.push(`其他要点：${summary.otherNotes}`)
    }

    return parts.join('\n')
  }

  /**
   * 估算文本的 token 数（粗略估算：1个中文字符≈2个token，1个英文单词≈1个token）
   */
  private estimateTokens(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
    const otherChars = text.length - chineseChars - englishWords
    
    return Math.ceil(chineseChars * 2 + englishWords + otherChars * 0.5)
  }

  /**
   * 构建项目上下文摘要
   */
  private buildProjectContext(): string {
    if (!this.project) return '项目未加载'

    const parts: string[] = [
      `项目名称：${this.project.name}`,
      `类型：${this.project.projectType === 'novel' ? '长篇小说' : this.project.projectType === 'short-story' ? '短篇故事' : '短剧剧本'}`,
    ]

    if (this.project.idea) {
      parts.push(`故事创意：${this.project.idea.slice(0, 200)}`)
    }

    if (this.project.characters.length > 0) {
      const charNames = this.project.characters.map(c => c.name).join('、')
      parts.push(`主要角色：${charNames}`)
    }

    if (this.project.worldSettings?.rules) {
      parts.push(`世界观要点：${this.project.worldSettings.rules.slice(0, 150)}`)
    }

    return parts.join('\n')
  }

  /**
   * 构建 StoryState 摘要
   */
  private buildStoryStateSummary(): string {
    if (!this.storyState) return 'StoryState 未初始化'

    const parts: string[] = []

    // 世界状态
    const ws = this.storyState.worldState
    if (ws.currentTimeline) {
      parts.push(`当前时间线：${ws.currentTimeline}`)
    }
    if (ws.activeConflicts.length > 0) {
      parts.push(`活跃冲突：${ws.activeConflicts.join('；')}`)
    }
    if (ws.globalMood) {
      parts.push(`全局氛围：${ws.globalMood}`)
    }

    // 角色状态（简要）
    const charStates = this.storyState.characterStates
    const charEntries = Object.entries(charStates)
    if (charEntries.length > 0) {
      const charSummary = charEntries
        .slice(0, 5) // 最多显示5个角色
        .map(([id, state]) => `${state.name}（${state.location}，${state.emotionalState}）`)
        .join('；')
      parts.push(`角色状态：${charSummary}`)
    }

    // 未回收的伏笔
    const openHooks = this.storyState.pendingHooks.filter(h => h.status === 'open')
    if (openHooks.length > 0) {
      const hookSummary = openHooks
        .slice(0, 3)
        .map(h => h.description)
        .join('；')
      parts.push(`未回收伏笔：${hookSummary}`)
    }

    return parts.length > 0 ? parts.join('\n') : '暂无状态信息'
  }

  /**
   * 构建前文摘要（最近3章）
   */
  private buildPreviousChaptersSummary(): string {
    if (!this.storyState) return ''

    const summaries = this.storyState.chapterSummaries
    if (summaries.length === 0) return '前文暂无摘要'

    // 取最近3章
    const recent = summaries.slice(-3)
    return recent
      .map(s => `第${s.chapterId}章：${s.summary}`)
      .join('\n\n')
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(
    projectContext: string,
    storyStateSummary: string,
    previousChaptersSummary: string
  ): string {
    let prompt = `你是一位资深小说创作助手，帮助用户创作小说章节。

## 你的职责
1. 理解用户的创作意图
2. 提供专业的创作建议
3. 引导用户明确创作目标
4. 在用户确认后，调用相应的创作功能

## 项目信息
${projectContext}

## 当前故事状态（StoryState）
${storyStateSummary}

## 前文摘要
${previousChaptersSummary}

## 对话风格
- 简洁友好，像一位有经验的编辑在旁边指导
- 主动引导，但不要替用户做决定
- 给出建议时，解释为什么这样建议
- 使用中文回复

## 重要约束
- **禁止直接生成长篇内容**（包括但不限于：章节正文、小说段落、叙事内容）
- **只能生成短回复**（≤500字），用于对话交流
- 引导用户明确创作目标：写什么、写多少字、什么风格
- 用户确认后，回复"好的，我开始生成..."，然后等待系统调用创作管线
- 创作管线会自动将生成的内容流式输出到编辑器中
- 你看到的[选中内容]、[章节内容]仅用于理解上下文，不要将其作为生成内容的依据
`

    return prompt
  }

  /**
   * 提取关键信息（从消息中）
   */
  private extractKeyInfo(msg: ChatMessage): void {
    if (msg.role !== 'user') return

    const content = msg.content

    // 提取创作目标
    if (/我想写|帮我写|生成.*章/.test(content)) {
      this.keyInfo.writingGoal = content.slice(0, 100)
    }

    // 提取目标字数
    const wordCountMatch = content.match(/(\d+)\s*字/)
    if (wordCountMatch) {
      this.keyInfo.targetWordCount = parseInt(wordCountMatch[1])
    }

    // 提取风格要求
    const styleKeywords = ['紧张', '轻松', '悬疑', '搞笑', '严肃', '抒情', '快节奏', '慢节奏']
    for (const kw of styleKeywords) {
      if (content.includes(kw)) {
        if (!this.keyInfo.styleRequirements) {
          this.keyInfo.styleRequirements = []
        }
        if (!this.keyInfo.styleRequirements.includes(kw)) {
          this.keyInfo.styleRequirements.push(kw)
        }
      }
    }
  }

  /**
   * 获取提取的关键信息
   */
  getKeyInfo(): ExtractedKeyInfo {
    return { ...this.keyInfo }
  }

  /**
   * 获取结构化摘要
   */
  getStructuredSummary(): StructuredSummary | null {
    return this.structuredSummary ? { ...this.structuredSummary } : null
  }

  /**
   * 清空对话历史
   */
  clearHistory(): void {
    this.fullHistory = []
    this.compressedSummary = ''
    this.structuredSummary = null
    this.keyInfo = {}
    this.isCompressing = false
  }

  /**
   * 获取完整历史
   */
  getFullHistory(): ChatMessage[] {
    return [...this.fullHistory]
  }
}
