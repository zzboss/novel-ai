/**
 * WritingAssistantAgent - 对话式AI创作助手（重构后）
 *
 * 新职责（协调者）：
 * 1. 协调各模块完成对话流程
 * 2. 管理对话状态和上下文
 * 3. 提供对外的统一接口
 *
 * 已解耦的职责（交给专门模块）：
 * - 阶段管理 -> PhaseManager
 * - 意图处理 -> IntentHandler
 * - LLM调用 -> LLMService
 */

import type { ProjectState } from '@/stores/project'
import type { StoryState } from '@/schemas/storyState'
import { useSettingsStore } from '@/stores/settings'
import { parseIntent, type ParsedIntent, type EditorContext } from '@/utils/IntentParser'
import { ConversationManager } from '@/utils/conversationManager'
import { PhaseManager } from './assistant/PhaseManager'
import { IntentHandler } from './assistant/IntentHandler'
import { LLMService } from './assistant/LLMService'
import * as chatHistoryService from '@/services/chatHistoryService'

/** 对话消息 */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  /** 附加操作按钮 */
  actions?: ChatAction[]
  /** 是否正在流式输出 */
  isStreaming?: boolean
}

/** 消息操作按钮 */
export interface ChatAction {
  label: string
  value: string
  type?: 'primary' | 'default' | 'success' | 'warning'
}

/** 对话阶段 */
export type ConversationPhase = 'greeting' | 'understanding' | 'planning' | 'generating' | 'reviewing'

export class WritingAssistantAgent {
  private currentChapterId: string | null = null
  private project: ProjectState | null = null
  private storyState: StoryState | null = null
  private projectPath: string = ''

  /** 对话历史 */
  private conversationHistory: ChatMessage[] = []

  /** 对话管理器（管理历史、滑动窗口、摘要压缩） */
  private conversationManager: ConversationManager

  /** 阶段管理器 */
  private phaseManager: PhaseManager

  /** 意图处理器 */
  private intentHandler: IntentHandler

  /** LLM调用服务 */
  private llmService: LLMService

  constructor() {
    // 初始化各模块
    this.conversationManager = new ConversationManager({ windowSize: 10 })
    this.phaseManager = new PhaseManager()
    this.intentHandler = new IntentHandler()
    this.llmService = new LLMService()

    // 初始化问候语
    this.addMessage('assistant', this.getGreeting())
  }

  /**
   * 设置当前章节
   */
  setCurrentChapter(chapterId: string | null, project: ProjectState | null): void {
    this.currentChapterId = chapterId
    this.project = project

    // 更新 StoryState 引用
    this.storyState = project?.storyState || null
    this.conversationManager.setProjectContext(project, this.storyState)

    // 如果是新会话（历史为空），添加章节问候语
    if (chapterId && this.conversationHistory.length === 0) {
      this.addMessage('assistant', this.getChapterGreeting())
      this.phaseManager.setPhase('greeting')
    }
  }

  /**
   * 设置项目路径（用于保存对话历史到数据库）
   */
  setProjectPath(path: string): void {
    this.projectPath = path
  }

  /**
   * 处理用户输入，返回AI回复
   */
  async processMessage(userInput: string, context?: EditorContext): Promise<ChatMessage> {
    // 添加用户消息到历史（同时添加到 ConversationManager）
    const userMsg = this.addMessage('user', userInput)
    this.conversationManager.addMessage(userMsg)

    // 使用 IntentParser 解析用户意图（异步）
    const intent = await parseIntent(userInput, context)

    // 根据意图类型，分发处理
    let reply: { content: string; actions?: ChatAction[]; nextPhase?: ConversationPhase }

    // 特殊意图：修改、润色、重写
    if (intent.type === 'modify') {
      reply = this.intentHandler.handleModifyIntent(userInput, context)
    } else if (intent.type === 'polish') {
      reply = this.intentHandler.handlePolishIntent(userInput, context)
    } else if (intent.type === 'rewrite') {
      reply = this.intentHandler.handleRewriteIntent(userInput, context)
    } else {
      // 默认处理流程：调用 LLM
      reply = await this.generateReplyWithLLM(userInput, intent, context)
    }

    // 添加AI回复到历史
    const assistantMsg = this.addMessage('assistant', reply.content, reply.actions)

    // 更新对话阶段
    this.phaseManager.updatePhase(reply.nextPhase)

    return assistantMsg
  }

  /**
   * 停止生成
   */
  stop(): void {
    this.llmService.stop()
  }

  /**
   * 获取对话历史
   */
  getHistory(): ChatMessage[] {
    return [...this.conversationHistory]
  }

  /**
   * 获取当前阶段
   */
  getCurrentPhase(): ConversationPhase {
    return this.phaseManager.getCurrentPhase()
  }

  /**
   * 清空对话
   */
  clearHistory(): void {
    this.conversationHistory = []
    this.conversationManager.clearHistory()
    this.phaseManager.reset()
    this.addMessage('assistant', this.getGreeting())
  }

  // ============ 私有方法 ============

  /**
   * 添加消息到历史
   */
  private addMessage(role: 'user' | 'assistant' | 'system', content: string, actions?: ChatAction[]): ChatMessage {
    const msg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role,
      content,
      timestamp: Date.now(),
      actions
    }
    this.conversationHistory.push(msg)
    
    // 自动保存到数据库
    if (this.projectPath) {
      const sessionId = this.currentChapterId || 'default'
      chatHistoryService.saveMessage(
        this.projectPath,
        {
          messageId: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp
        },
        sessionId
      ).catch(err => {
        console.error('[WritingAssistantAgent] 保存消息到数据库失败:', err)
      })
    }
    
    return msg
  }

  /**
   * 获取问候语
   */
  private getGreeting(): string {
    return `你好！我是你的 AI 创作助手。

我可以帮你：
• **生成新章节** - 告诉我这一章想写什么
• **续写内容** - 接着当前内容继续写
• **润色文字** - 让文字更流畅自然
• **重写段落** - 按你的要求重新写

你想做什么？`
  }

  /**
   * 获取章节切换后的问候语
   */
  private getChapterGreeting(): string {
    const chapterNum = this.getChapterNumber()
    let greeting = `已切换到第 ${chapterNum} 章。`

    if (chapterNum <= 3) {
      greeting += `\n\n这是**黄金三章**的第 ${chapterNum} 章，需要特别注意开篇节奏。`
    }

    greeting += `\n\n你想对这章做什么？`
    return greeting
  }

  /**
   * 调用LLM生成回复
   */
  private async generateReplyWithLLM(
    userInput: string,
    intent: ParsedIntent,
    context?: EditorContext
  ): Promise<{ content: string; actions?: ChatAction[]; nextPhase?: ConversationPhase }> {
    // 获取模型配置
    const settingsStore = useSettingsStore()
    const modelConfig = settingsStore.activeModel

    if (!modelConfig) {
      return {
        content: '⚠️ 未配置AI模型，请在设置中配置后重试。',
        nextPhase: this.phaseManager.getCurrentPhase()
      }
    }

    // 使用 ConversationManager 获取上下文（含滑动窗口和摘要压缩）
    const conversationContext = this.conversationManager.getContextForLLM(userInput)

    try {
      // 调用 LLMService 生成回复
      const reply = await this.llmService.generateReply({
        modelConfig,
        conversationContext,
        userInput,
        editorContext: context
      })

      // 将AI回复添加到 ConversationManager
      this.conversationManager.addMessage({
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: 'assistant',
        content: reply,
        timestamp: Date.now()
      })

      // 根据意图生成操作按钮
      const editorContext = this.getCurrentEditorContext()
      const actions = this.intentHandler.generateActions(this.phaseManager.getCurrentPhase(), editorContext)

      // 计算下一阶段
      const nextPhase = this.phaseManager.calculateNextPhase(intent.type)

      return {
        content: reply,
        actions,
        nextPhase
      }
    } catch (err) {
      console.error('AI回复生成失败:', err)
      return {
        content: '抱歉，我遇到了一些问题，请稍后再试。',
        nextPhase: this.phaseManager.getCurrentPhase()
      }
    }
  }

  /**
   * 获取当前编辑器上下文（用于生成操作按钮时判断）
   */
  private getCurrentEditorContext(): EditorContext {
    // 从 window 获取编辑器实例
    const editor = (window as any).__chapterEditor as any
    if (!editor) return {}

    const context: EditorContext = {}

    // 获取选中内容
    const { from, to } = editor.state.selection
    if (from !== to) {
      context.selectedText = editor.state.doc.textBetween(from, to, ' ')
    }

    // 获取全文
    const text = editor.state.doc.textContent || ''
    context.chapterContent = text
    context.wordCount = text.replace(/\s/g, '').length

    return context
  }

  /**
   * 获取章节号
   */
  private getChapterNumber(): number {
    if (!this.project || !this.currentChapterId) return 0

    let count = 0
    for (const volume of this.project.volumes) {
      for (const chapter of volume.chapters) {
        count++
        if (chapter.id === this.currentChapterId) {
          return count
        }
      }
    }
    return 0
  }
}
