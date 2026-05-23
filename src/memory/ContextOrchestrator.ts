/**
 * 上下文编排器
 * 
 * 职责：
 * 1. 根据任务类型和小说进度动态分配 Token 预算
 * 2. 从四层记忆中检索相关上下文（使用 Chroma 向量检索）
 * 3. 按优先级组装上下文
 * 4. 缓存已构建的上下文
 * 5. 集成 RAG 检索器提供智能问答
 */

import MemoryManager, { MemoryRecord, MemoryType, SearchOptions } from './MemoryManager'
import RAGRetriever, { RetrievalResult } from './RAGRetriever'
import { Database } from 'sql.js'

// ============================================================
// 类型和接口定义
// ============================================================

export type AgentType = 'chapter' | 'character' | 'outline' | 'world' | 'dialogue' | 'summary'

export interface WritingProgress {
  chapterCount: number      // 已完成的章节数
  totalChapters: number     // 总章节数（如果已知）
  currentVolume: number     // 当前卷号
  chaptersInCurrentVolume: number  // 当前卷的章节数
}

export interface TokenBudget {
  total: number           // 总预算（默认 32000 token）
  systemPrompt: number    // 系统提示词（固定）
  projectMeta: number     // 项目元数据（项目类型、类型、目标读者等）
  storyState: number      // 故事状态（世界观、角色状态、资源清单等）
  recentChapters: number  // 最近章节（最近 3-5 章）
  chapterSummaries: number // 章节摘要（当前卷的所有章节摘要）
  longTermMemories: number // 长期记忆（相关历史事件、角色发展等）
  userInput: number       // 用户输入（用户提示词、要求等）
  output: number          // 输出预算（预留给模型输出）
}

export interface Context {
  systemPrompt: string
  projectMeta: string
  storyState: string
  recentChapters: string
  chapterSummaries: string
  longTermMemories: string
  userInput: string
  totalTokens: number
}

export interface BuildContextOptions {
  maxTokens?: number      // 最大 Token 数
  includeTypes?: MemoryType[]  // 包含的记忆类型
  excludeTypes?: MemoryType[]  // 排除的记忆类型
  minImportance?: number  // 最小重要性
  useCache?: boolean      // 是否使用缓存
}

export interface CachedContext {
  context: Context
  timestamp: number
  ttl: number           // 缓存有效期（毫秒）
}

// ============================================================
// 配置和常量
// ============================================================

const DEFAULT_TOKEN_BUDGET: TokenBudget = {
  total: 32000,
  systemPrompt: 2000,
  projectMeta: 2000,
  storyState: 6000,
  recentChapters: 8000,
  chapterSummaries: 4000,
  longTermMemories: 6000,
  userInput: 2000,
  output: 4000,
}

const DEFAULT_BUILD_OPTIONS: BuildContextOptions = {
  maxTokens: 32000,
  includeTypes: ['short', 'medium', 'long', 'meta'],
  excludeTypes: [],
  minImportance: 3,
  useCache: true,
}

// ============================================================
// 核心类定义
// ============================================================

/**
 * 上下文编排器
 */
export class ContextOrchestrator {
  private memoryManager: MemoryManager
  private ragRetriever: RAGRetriever
  private db: Database
  private cache: Map<string, CachedContext>
  private tokenBudget: TokenBudget
  private options: BuildContextOptions

  constructor(
    memoryManager: MemoryManager,
    ragRetriever: RAGRetriever,
    db: Database,
    options?: BuildContextOptions
  ) {
    this.memoryManager = memoryManager
    this.ragRetriever = ragRetriever
    this.db = db
    this.cache = new Map()
    this.tokenBudget = { ...DEFAULT_TOKEN_BUDGET }
    this.options = { ...DEFAULT_BUILD_OPTIONS, ...options }
  }

  /**
   * 构建上下文（主入口）
   * @param task 当前任务
   * @param projectId 项目 ID
   * @param options 构建选项
   * @returns 构建好的上下文
   */
  async buildContext(
    task: { type: AgentType; description: string },
    projectId: string,
    options?: BuildContextOptions
  ): Promise<Context> {
    const opts = { ...this.options, ...options }
    
    // 1. 检查缓存
    if (opts.useCache) {
      const cacheKey = this.getCacheKey(task, projectId, opts)
      const cached = this.getCachedContext(cacheKey)
      if (cached) {
        console.log('[ContextOrchestrator] Using cached context')
        return cached
      }
    }

    // 2. 根据任务类型调整 Token 预算
    this.adjustByTaskType(task.type)

    // 3. 获取写作进度
    const progress = await this.getWritingProgress(projectId)

    // 4. 根据进度调整 Token 预算
    this.adjustByProgress(progress)

    // 5. 从四层记忆中检索相关上下文
    const memories = await this.retrieveRelevantMemories(task, projectId, opts)

    // 6. 按优先级组装上下文
    let context = this.assembleContext(memories, projectId)

    // 7. 压缩上下文（如果超过 Token 预算）
    context = this.compressContext(context)

    // 8. 缓存上下文
    if (opts.useCache) {
      const cacheKey = this.getCacheKey(task, projectId, opts)
      this.cacheContext(cacheKey, context)
    }

    return context
  }

  /**
   * 根据任务类型调整 Token 预算
   * @param taskType 任务类型
   */
  adjustByTaskType(taskType: AgentType): void {
    switch (taskType) {
      case 'chapter':
        // 章节写作：需要更多最近章节和故事状态
        this.tokenBudget.recentChapters = 8000
        this.tokenBudget.storyState = 6000
        this.tokenBudget.chapterSummaries = 4000
        break
      
      case 'character':
        // 角色设计：需要更多角色状态和长期记忆
        this.tokenBudget.storyState = 8000
        this.tokenBudget.longTermMemories = 6000
        this.tokenBudget.recentChapters = 2000
        break
      
      case 'outline':
        // 大纲规划：需要更多章节摘要和长期记忆
        this.tokenBudget.chapterSummaries = 8000
        this.tokenBudget.longTermMemories = 6000
        this.tokenBudget.storyState = 4000
        break
      
      case 'world':
        // 世界观设定：需要更多故事状态和长期记忆
        this.tokenBudget.storyState = 10000
        this.tokenBudget.longTermMemories = 8000
        this.tokenBudget.recentChapters = 2000
        break
      
      case 'dialogue':
        // 对话生成：需要更多最近章节和角色状态
        this.tokenBudget.recentChapters = 10000
        this.tokenBudget.storyState = 6000
        this.tokenBudget.longTermMemories = 4000
        break
      
      case 'summary':
        // 摘要生成：需要更多章节摘要和最近章节
        this.tokenBudget.chapterSummaries = 10000
        this.tokenBudget.recentChapters = 6000
        this.tokenBudget.longTermMemories = 4000
        break
    }
  }

  /**
   * 根据小说进度调整 Token 预算
   * @param progress 写作进度
   */
  adjustByProgress(progress: WritingProgress): void {
    if (progress.chapterCount < 10) {
      // 前期：不需要太多长期记忆
      this.tokenBudget.longTermMemories = 2000
      this.tokenBudget.chapterSummaries = 2000
    } else if (progress.chapterCount < 50) {
      // 中期：需要更多章节摘要
      this.tokenBudget.longTermMemories = 4000
      this.tokenBudget.chapterSummaries = 6000
    } else {
      // 后期：需要更多长期记忆
      this.tokenBudget.longTermMemories = 8000
      this.tokenBudget.chapterSummaries = 8000
    }
  }

  /**
   * 获取写作进度
   * @param projectId 项目 ID
   * @returns 写作进度
   */
  private async getWritingProgress(projectId: string): Promise<WritingProgress> {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          COUNT(*) as chapter_count,
          MAX(volume_id) as current_volume,
          COUNT(CASE WHEN volume_id = (SELECT MAX(volume_id) FROM chapters WHERE project_id = ?) THEN 1 END) as chapters_in_current_volume
        FROM chapters 
        WHERE project_id = ?
      `)
      const result = stmt.get([projectId, projectId]) as any
      stmt.free()

      return {
        chapterCount: result.chapter_count || 0,
        totalChapters: 0, // 未知
        currentVolume: result.current_volume || 1,
        chaptersInCurrentVolume: result.chapters_in_current_volume || 0,
      }
    } catch (error) {
      console.error('[ContextOrchestrator] Failed to get writing progress:', error)
      return {
        chapterCount: 0,
        totalChapters: 0,
        currentVolume: 1,
        chaptersInCurrentVolume: 0,
      }
    }
  }

  /**
   * 从四层记忆中检索相关上下文
   * @param task 当前任务
   * @param projectId 项目 ID
   * @param options 检索选项
   * @returns 检索到的记忆数组
   */
  private async retrieveRelevantMemories(
    task: { type: AgentType; description: string },
    projectId: string,
    options: BuildContextOptions
  ): Promise<MemoryRecord[]> {
    const memories: MemoryRecord[] = []

    // 1. 使用 RAG 检索器进行语义检索
    const ragResults: RetrievalResult[] = await this.ragRetriever.retrieve(task.description, {
      projectId,
      maxResults: 20,
      strategy: 'hybrid',
    })

    // 2. 转换为 MemoryRecord
    const ragMemories = ragResults.map(r => r.record)
    memories.push(...ragMemories)

    // 3. 根据任务类型补充特定记忆
    switch (task.type) {
      case 'chapter':
        // 补充最近章节
        const recentChapters = await this.memoryManager.searchByKeyword('', {
          projectId,
          memoryType: 'short',
          maxResults: 5,
        })
        memories.push(...recentChapters)
        break
      
      case 'character':
        // 补充角色相关记忆
        const characterMemories = await this.memoryManager.searchByKeyword(task.description, {
          projectId,
          contentType: 'character',
          maxResults: 10,
        })
        memories.push(...characterMemories)
        break
      
      // ... 其他任务类型
    }

    // 4. 去重
    const uniqueMemories = Array.from(
      new Map(memories.map(m => [m.id, m])).values()
    )

    // 5. 按重要性排序
    uniqueMemories.sort((a, b) => b.importance - a.importance)

    return uniqueMemories
  }

  /**
   * 按优先级组装上下文
   * @param memories 检索到的记忆
   * @param projectId 项目 ID
   * @returns 组装好的上下文
   */
  private assembleContext(memories: MemoryRecord[], projectId: string): Context {
    // 按记忆类型分组
    const grouped = {
      meta: memories.filter(m => m.memoryType === 'meta'),
      short: memories.filter(m => m.memoryType === 'short'),
      medium: memories.filter(m => m.memoryType === 'medium'),
      long: memories.filter(m => m.memoryType === 'long'),
    }

    // 组装各部分
    const context: Context = {
      systemPrompt: this.buildSystemPrompt(),
      projectMeta: this.buildProjectMeta(projectId),
      storyState: this.buildStoryState(grouped.meta, grouped.long),
      recentChapters: this.buildRecentChapters(grouped.short),
      chapterSummaries: this.buildChapterSummaries(grouped.medium),
      longTermMemories: this.buildLongTermMemories(grouped.long),
      userInput: '', // 由调用者填充
      totalTokens: 0,
    }

    // 计算总 Token 数
    context.totalTokens = this.estimateTokens(context)

    return context
  }

  /**
   * 构建系统提示词
   * @returns 系统提示词
   */
  private buildSystemPrompt(): string {
    return `你是一个专业的小说创作助手。请根据用户的要求，创作高质量的小说内容。
    
## 创作要求
1. 保持角色性格一致
2. 遵循世界观设定
3. 情节合理推进
4. 文笔流畅自然
5. 符合项目风格指南`
  }

  /**
   * 构建项目元数据
   * @param projectId 项目 ID
   * @returns 项目元数据字符串
   */
  private buildProjectMeta(projectId: string): string {
    // TODO: 从数据库查询项目元数据
    return `项目 ID: ${projectId}`
  }

  /**
   * 构建故事状态
   * @param metaMemories 元记忆
   * @param longMemories 长期记忆
   * @returns 故事状态字符串
   */
  private buildStoryState(metaMemories: MemoryRecord[], longMemories: MemoryRecord[]): string {
    let state = ''

    // 添加元记忆（项目创作指南、风格指南等）
    for (const memory of metaMemories) {
      state += `\n\n## ${memory.contentType}\n${memory.content}`
    }

    // 添加长期记忆（相关历史事件、角色发展等）
    for (const memory of longMemories) {
      state += `\n\n## ${memory.contentType}\n${memory.content}`
    }

    return state
  }

  /**
   * 构建最近章节内容
   * @param shortMemories 短期记忆
   * @returns 最近章节内容字符串
   */
  private buildRecentChapters(shortMemories: MemoryRecord[]): string {
    let content = ''

    // 按章节 ID 分组
    const chapterMap = new Map<string, MemoryRecord[]>()
    for (const memory of shortMemories) {
      if (memory.chapterId) {
        if (!chapterMap.has(memory.chapterId)) {
          chapterMap.set(memory.chapterId, [])
        }
        chapterMap.get(memory.chapterId)!.push(memory)
      }
    }

    // 添加章节内容
    for (const [chapterId, memories] of chapterMap) {
      content += `\n\n## 章节 ${chapterId}\n`
      for (const memory of memories) {
        content += `${memory.content}\n`
      }
    }

    return content
  }

  /**
   * 构建章节摘要
   * @param mediumMemories 中期记忆
   * @returns 章节摘要字符串
   */
  private buildChapterSummaries(mediumMemories: MemoryRecord[]): string {
    let summaries = ''

    for (const memory of mediumMemories) {
      summaries += `\n\n## ${memory.contentType}\n${memory.content}`
    }

    return summaries
  }

  /**
   * 构建长期记忆
   * @param longMemories 长期记忆
   * @returns 长期记忆字符串
   */
  private buildLongTermMemories(longMemories: MemoryRecord[]): string {
    let memories = ''

    for (const memory of longMemories) {
      memories += `\n\n## ${memory.contentType} (重要性: ${memory.importance})\n${memory.content}`
    }

    return memories
  }

  /**
   * 压缩上下文（如果超过 Token 预算）
   * @param context 上下文
   * @returns 压缩后的上下文
   */
  private compressContext(context: Context): Context {
    const totalTokens = this.estimateTokens(context)

    if (totalTokens <= this.tokenBudget.total) {
      return context
    }

    console.log(`[ContextOrchestrator] Compressing context: ${totalTokens} -> ${this.tokenBudget.total}`)

    // 按优先级压缩（从低优先级开始）
    // 1. 压缩长期记忆
    if (this.estimateTokens(context) > this.tokenBudget.total) {
      context.longTermMemories = this.truncateToTokens(
        context.longTermMemories,
        this.tokenBudget.longTermMemories
      )
    }

    // 2. 压缩章节摘要
    if (this.estimateTokens(context) > this.tokenBudget.total) {
      context.chapterSummaries = this.truncateToTokens(
        context.chapterSummaries,
        this.tokenBudget.chapterSummaries
      )
    }

    // 3. 压缩最近章节
    if (this.estimateTokens(context) > this.tokenBudget.total) {
      context.recentChapters = this.truncateToTokens(
        context.recentChapters,
        this.tokenBudget.recentChapters
      )
    }

    // 重新计算总 Token 数
    context.totalTokens = this.estimateTokens(context)

    return context
  }

  /**
   * 估算上下文的 Token 数
   * @param context 上下文
   * @returns Token 数
   */
  private estimateTokens(context: Context): number {
    let total = 0
    total += Math.ceil(context.systemPrompt.length / 4)
    total += Math.ceil(context.projectMeta.length / 4)
    total += Math.ceil(context.storyState.length / 4)
    total += Math.ceil(context.recentChapters.length / 4)
    total += Math.ceil(context.chapterSummaries.length / 4)
    total += Math.ceil(context.longTermMemories.length / 4)
    total += Math.ceil(context.userInput.length / 4)
    total += this.tokenBudget.output
    return total
  }

  /**
   * 将文本截断到指定 Token 数
   * @param text 文本
   * @param maxTokens 最大 Token 数
   * @returns 截断后的文本
   */
  private truncateToTokens(text: string, maxTokens: number): string {
    const maxChars = maxTokens * 4
    if (text.length <= maxChars) {
      return text
    }
    return text.substring(0, maxChars) + '\n\n[内容已截断]'
  }

  // ==================== 缓存管理 ====================

  /**
   * 获取缓存的上下文
   * @param cacheKey 缓存键
   * @returns 缓存的上下文，如果不存在或已过期则返回 null
   */
  private getCachedContext(cacheKey: string): Context | null {
    const cached = this.cache.get(cacheKey)
    if (!cached) {
      return null
    }

    // 检查是否过期
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(cacheKey)
      return null
    }

    return cached.context
  }

  /**
   * 缓存上下文
   * @param cacheKey 缓存键
   * @param context 上下文
   */
  private cacheContext(cacheKey: string, context: Context): void {
    this.cache.set(cacheKey, {
      context,
      timestamp: Date.now(),
      ttl: 5 * 60 * 1000, // 5 分钟有效期
    })
  }

  /**
   * 生成缓存键
   * @param task 任务
   * @param projectId 项目 ID
   * @param options 选项
   * @returns 缓存键
   */
  private getCacheKey(
    task: { type: AgentType; description: string },
    projectId: string,
    options: BuildContextOptions
  ): string {
    return `${task.type}_${projectId}_${options.maxTokens}_${options.minImportance}`
  }

  /**
   * 使缓存失效
   * @param cacheKey 缓存键（可选，如果不提供则清除所有缓存）
   */
  invalidateCache(cacheKey?: string): void {
    if (cacheKey) {
      this.cache.delete(cacheKey)
    } else {
      this.cache.clear()
    }
  }

  // ==================== 公共方法 ====================

  /**
   * 更新 Token 预算
   * @param budget 新的 Token 预算
   */
  updateTokenBudget(budget: Partial<TokenBudget>): void {
    this.tokenBudget = { ...this.tokenBudget, ...budget }
  }

  /**
   * 获取当前 Token 预算
   * @returns Token 预算
   */
  getTokenBudget(): TokenBudget {
    return { ...this.tokenBudget }
  }

  /**
   * 更新构建选项
   * @param options 新的构建选项
   */
  updateOptions(options: Partial<BuildContextOptions>): void {
    this.options = { ...this.options, ...options }
  }

  /**
   * 获取当前构建选项
   * @returns 构建选项
   */
  getOptions(): BuildContextOptions {
    return { ...this.options }
  }
}

// ============================================================
// 导出
// ============================================================

export default ContextOrchestrator
