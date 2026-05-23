/**
 * RAG 检索器
 * 
 * 职责：
 * 1. 提供统一的检索接口（支持多种检索策略）
 * 2. 实现重排序（Reranker）逻辑
 * 3. 实现上下文增强（Context Enrichment）
 * 4. 提供智能问答接口
 * 5. 集成 Chroma 向量搜索和 SQLite 关键字搜索
 */

import { Database } from 'sql.js'
import MemoryManager, { MemoryRecord, SearchOptions } from './MemoryManager'
import ChromaClientManager from './ChromaClient'
import EmbeddingClient from './EmbeddingClient'

// ============================================================
// 配置和常量
// ============================================================

const DEFAULT_RAG_CONFIG = {
  // 检索配置
  retrievalStrategy: 'hybrid',  // 'keyword' | 'semantic' | 'hybrid'
  maxResults: 10,
  semanticWeight: 0.7,        // 语义搜索权重
  keywordWeight: 0.3,         // 关键字搜索权重
  
  // 重排序配置
  enableReranking: true,
  rerankerModel: 'cross-encoder/ms-marco-MiniLM-L-6-v2',
  rerankerTopK: 20,           // 初筛返回的候选数量
  
  // 上下文增强配置
  enableContextEnrichment: true,
  maxContextTokens: 32000,
  contextOverlapSize: 200,     // 上下文重叠大小（字符）
  
  // 智能问答配置
  enableSmartQA: true,
  qaModel: 'gpt-3.5-turbo',
  qaMaxTokens: 1000,
}

// ============================================================
// 类型定义
// ============================================================

export type RetrievalStrategy = 'keyword' | 'semantic' | 'hybrid'

export interface RAGConfig {
  retrievalStrategy?: RetrievalStrategy
  maxResults?: number
  semanticWeight?: number
  keywordWeight?: number
  enableReranking?: boolean
  rerankerModel?: string
  rerankerTopK?: number
  enableContextEnrichment?: boolean
  maxContextTokens?: number
  contextOverlapSize?: number
  enableSmartQA?: boolean
  qaModel?: string
  qaMaxTokens?: number
}

export interface RetrievalResult {
  record: MemoryRecord
  score: number
  strategy: RetrievalStrategy
  rerankerScore?: number
}

export interface QARequest {
  question: string
  projectId: string
  context?: string  // 可选：用户提供的额外上下文
  maxTokens?: number
}

export interface QAResponse {
  question: string
  answer: string
  sources: MemoryRecord[]  // 引用的来源
  tokensUsed: number
}

// ============================================================
// 核心类定义
// ============================================================

/**
 * RAG 检索器
 */
export class RAGRetriever {
  private memoryManager: MemoryManager
  private chromaManager: ChromaClientManager
  private embeddingClient: EmbeddingClient
  private db: Database
  private config: Required<RAGConfig>
  private reranker: any = null  // 重排序模型实例

  constructor(
    memoryManager: MemoryManager,
    chromaManager: ChromaClientManager,
    embeddingClient: EmbeddingClient,
    db: Database,
    config?: RAGConfig
  ) {
    this.memoryManager = memoryManager
    this.chromaManager = chromaManager
    this.embeddingClient = embeddingClient
    this.db = db
    this.config = { ...DEFAULT_RAG_CONFIG, ...config }
  }

  /**
   * 初始化 RAG 检索器
   */
  async initialize(): Promise<void> {
    // 初始化重排序模型（如果启用）
    if (this.config.enableReranking) {
      await this.initializeReranker()
    }

    console.log('[RAGRetriever] Initialized successfully')
  }

  /**
   * 检索相关记忆
   * @param query 查询文本
   * @param options 检索选项
   * @returns 检索结果数组
   */
  async retrieve(
    query: string,
    options?: SearchOptions & { 
      strategy?: RetrievalStrategy 
    }
  ): Promise<RetrievalResult[]> {
    const strategy = options?.strategy || this.config.retrievalStrategy
    const maxResults = options?.maxResults || this.config.maxResults

    let results: RetrievalResult[] = []

    // 根据策略执行检索
    switch (strategy) {
      case 'keyword':
        results = await this.retrieveByKeyword(query, options)
        break
      
      case 'semantic':
        results = await this.retrieveBySemantic(query, options)
        break
      
      case 'hybrid':
        results = await this.retrieveHybrid(query, options)
        break
    }

    // 重排序（如果启用）
    if (this.config.enableReranking && this.reranker) {
      results = await this.rerank(results, query)
    }

    // 限制结果数量
    if (results.length > maxResults) {
      results = results.slice(0, maxResults)
    }

    return results
  }

  /**
   * 关键字检索
   */
  private async retrieveByKeyword(
    query: string,
    options?: SearchOptions
  ): Promise<RetrievalResult[]> {
    const records = await this.memoryManager.searchByKeyword(query, options)
    
    return records.map(record => ({
      record,
      score: 1.0,  // 关键字检索不评分，统一为 1.0
      strategy: 'keyword' as RetrievalStrategy,
    }))
  }

  /**
   * 语义检索
   */
  private async retrieveBySemantic(
    query: string,
    options?: SearchOptions
  ): Promise<RetrievalResult[]> {
    // 生成查询向量
    const queryEmbedding = await this.embeddingClient.embed(query)
    
    const records = await this.memoryManager.searchBySemantic(queryEmbedding, options)
    
    // 语义检索返回的结果已经按相似度排序，但我们需要将其转为 RetrievalResult 格式
    // 注意：这里需要 Chroma 返回的 distances，但 MemoryManager.searchBySemantic 没有返回
    // TODO: 修改 MemoryManager 以返回相似度分数
    return records.map((record, index) => ({
      record,
      score: 1.0 - (index * 0.05),  // 简单估算：按返回顺序递减
      strategy: 'semantic' as RetrievalStrategy,
    }))
  }

  /**
   * 混合检索
   */
  private async retrieveHybrid(
    query: string,
    options?: SearchOptions
  ): Promise<RetrievalResult[]> {
    // 并行执行关键字和语义检索
    const [keywordResults, semanticResults] = await Promise.all([
      this.retrieveByKeyword(query, options),
      this.retrieveBySemantic(query, options),
    ])

    // 合并结果（去重）
    const mergedMap = new Map<string, RetrievalResult>()
    
    // 关键字结果
    for (const result of keywordResults) {
      result.score *= this.config.keywordWeight
      mergedMap.set(result.record.id, result)
    }
    
    // 语义结果
    for (const result of semanticResults) {
      result.score *= this.config.semanticWeight
      
      if (mergedMap.has(result.record.id)) {
        // 已存在，合并分数
        const existing = mergedMap.get(result.record.id)!
        existing.score += result.score
        existing.strategy = 'hybrid'
      } else {
        result.strategy = 'hybrid'
        mergedMap.set(result.record.id, result)
      }
    }

    // 按分数排序
    const merged = Array.from(mergedMap.values())
    merged.sort((a, b) => b.score - a.score)

    return merged
  }

  /**
   * 重排序
   * @param results 检索结果
   * @param query 查询文本
   * @returns 重排序后的结果
   */
  private async rerank(
    results: RetrievalResult[],
    query: string
  ): Promise<RetrievalResult[]> {
    if (!this.reranker) {
      console.warn('[RAGRetriever] Reranker not initialized, skipping reranking')
      return results
    }

    // 初筛：如果结果太多，先按当前分数筛选
    const topK = Math.min(this.config.rerankerTopK, results.length)
    const candidates = results.slice(0, topK)

    try {
      // 调用重排序模型
      const texts = candidates.map(r => r.record.content)
      const scores = await this.reranker.computeScore([[query, texts]])

      // 更新重排序分数
      for (let i = 0; i < candidates.length; i++) {
        candidates[i].rerankerScore = scores[i]
      }

      // 按重排序分数重新排序
      candidates.sort((a, b) => (b.rerankerScore || 0) - (a.rerankerScore || 0))

      // 将剩余结果附加到后面
      if (results.length > topK) {
        return [...candidates, ...results.slice(topK)]
      }

      return candidates
    } catch (error) {
      console.error('[RAGRetriever] Reranking failed:', error)
      return results  // 失败时返回原结果
    }
  }

  /**
   * 初始化重排序模型
   */
  private async initializeReranker(): Promise<void> {
    try {
      // 方案 1：使用 @xenova/transformers（本地）
      // 注意：需要在浏览器环境中运行
      if (typeof window !== 'undefined') {
        try {
          const { pipeline } = await import('@xenova/transformers')
          this.reranker = await pipeline('reranking', this.config.rerankerModel)
          console.log(`[RAGRetriever] Reranker initialized: ${this.config.rerankerModel}`)
          return
        } catch (err) {
          console.warn('[RAGRetriever] Failed to load @xenova/transformers, falling back to simple reranking:', err)
        }
      }
      
      // 方案 2：简单重排序（基于关键字匹配）
      console.log('[RAGRetriever] Using simple reranking (keyword-based)')
      this.reranker = {
        computeScore: (pairs: [string, string][]) => {
          // 简单重排序：基于查询和文档的关键字匹配度
          return pairs.map(([query, doc]) => {
            const queryWords = query.toLowerCase().split(/\s+/)
            const docWords = doc.toLowerCase().split(/\s+/)
            let score = 0
            for (const qw of queryWords) {
              for (const dw of docWords) {
                if (dw.includes(qw) || qw.includes(dw)) {
                  score += 1
                }
              }
            }
            return score / Math.max(queryWords.length, 1)
          })
        }
      }
    } catch (error) {
      console.error('[RAGRetriever] Failed to initialize reranker:', error)
      this.config.enableReranking = false
    }
  }

  /**
   * 上下文增强
   * @param results 检索结果
   * @param query 查询文本
   * @returns 增强后的上下文文本
   */
  async enrichContext(
    results: RetrievalResult[],
    query: string
  ): Promise<string> {
    if (!this.config.enableContextEnrichment) {
      // 不增强，直接拼接
      return results.map(r => r.record.content).join('\n\n')
    }

    // 构建上下文
    let context = ''
    let tokenCount = 0

    for (const result of results) {
      const content = result.record.content
      const estimatedTokens = Math.ceil(content.length / 4)  // 简单估算：1 token ≈ 4 字符

      if (tokenCount + estimatedTokens > this.config.maxContextTokens) {
        // 超出 Token 预算，停止添加
        break
      }

      // 添加内容
      context += `\n\n---\n\n${content}`
      tokenCount += estimatedTokens

      // 如果启用了上下文重叠，添加相邻章节的内容
      if (this.config.contextOverlapSize > 0 && result.record.chapterId) {
        const adjacentContent = await this.getAdjacentChapterContent(result.record.chapterId)
        const adjacentTokens = Math.ceil(adjacentContent.length / 4)
        
        if (tokenCount + adjacentTokens <= this.config.maxContextTokens) {
          context += `\n\n[相邻内容]:\n${adjacentContent}`
          tokenCount += adjacentTokens
        }
      }
    }

    return context.trim()
  }

  /**
   * 获取相邻章节的内容
   * @param chapterId 当前章节 ID
   * @returns 相邻章节内容（前 200 字符 + 后 200 字符）
   */
  private async getAdjacentChapterContent(chapterId: string): Promise<string> {
    // TODO: 实现相邻章节内容获取
    // 1. 从数据库查询当前章节的 volume_id 和 chapter_number
    // 2. 查询上一章和下一章的内容
    // 3. 返回拼接的结果
    return ''
  }

  /**
   * 智能问答
   * @param request 问答请求
   * @returns 问答响应
   */
  async smartQA(request: QARequest): Promise<QAResponse> {
    if (!this.config.enableSmartQA) {
      throw new Error('智能问答功能未启用')
    }

    // 1. 检索相关记忆
    const results = await this.retrieve(request.question, {
      projectId: request.projectId,
      maxResults: 5,
    })

    // 2. 增强上下文
    const context = await this.enrichContext(results, request.question)

    // 3. 构建 Prompt
    const prompt = this.buildQAPrompt(request.question, context, request.context)

    // 4. 调用 LLM 生成答案
    // TODO: 实现 LLM 调用
    const answer = `这是一个关于"${request.question}"的回答。（LLM 调用尚未实现）`

    // 5. 构造响应
    return {
      question: request.question,
      answer,
      sources: results.map(r => r.record),
      tokensUsed: Math.ceil(prompt.length / 4) + Math.ceil(answer.length / 4),
    }
  }

  /**
   * 构建问答 Prompt
   */
  private buildQAPrompt(question: string, context: string, additionalContext?: string): string {
    return `你是一个小说创作助手。请根据以下上下文回答用户的问题。

## 上下文

${context}

${additionalContext ? `## 额外信息\n\n${additionalContext}\n\n` : ''}## 用户问题

${question}

## 回答要求

1. 基于上下文提供准确的回答
2. 如果上下文中没有相关信息，请明确说明
3. 回答要简洁明了，直接回答问题
4. 可以适当引用上下文中的具体内容`
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<RAGConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取当前配置
   */
  getConfig(): Required<RAGConfig> {
    return { ...this.config }
  }
}

// ============================================================
// 导出
// ============================================================

export {
  DEFAULT_RAG_CONFIG,
}

export default RAGRetriever
