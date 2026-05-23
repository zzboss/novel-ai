/**
 * Memory 模块统一导出入口
 * 
 * 此模块提供：
 * 1. ChromaClientManager - Chroma 向量数据库客户端管理器
 * 2. MemoryManager - 记忆管理器（四层记忆架构）
 * 3. EmbeddingClient - 文本向量化客户端
 * 4. RAGRetriever - RAG 检索器（混合检索 + 重排序 + 上下文增强）
 * 5. ContextOrchestrator - 上下文编排器（Token 预算分配 + 上下文构建）
 * 
 * 使用示例：
 * ```typescript
 * import { createMemorySystem } from '@/memory'
 * 
 * // 创建完整的记忆系统
 * const { memoryManager, ragRetriever } = await createMemorySystem(db, {
 *   chromaUrl: 'http://localhost:8000',
 *   embeddingModel: 'text-embedding-ada-002',
 *   embeddingApiKey: 'your-api-key',
 * })
 * 
 * // 写入记忆
 * await memoryManager.writeShortTermMemory(projectId, chapterId, content, embedding)
 * 
 * // 检索记忆
 * const results = await ragRetriever.retrieve(query, { projectId })
 * ```
 */

// 导出核心类
export { default as ChromaClientManager } from './ChromaClient'
export { default as MemoryManager } from './MemoryManager'
export { default as EmbeddingClient } from './EmbeddingClient'
export { default as RAGRetriever } from './RAGRetriever'
export { default as ContextOrchestrator } from './ContextOrchestrator'

// 导出 ChromaClient 相关
export {
  ChromaClientManager,
  getOrCreateCollection,
  deleteCollection,
  addVectors,
  queryVectors,
  deleteVectors,
  updateVectors,
  countVectors,
  CHROMA_COLLECTION_SCHEMA,
  MEMORY_METADATA_SCHEMA,
} from './ChromaClient'

// 导出 MemoryManager 相关
export {
  MemoryManager,
  type MemoryType,
  type ContentType,
  type MemoryRecord,
  type SearchOptions,
  type MemoryManagerOptions,
} from './MemoryManager'

// 导出 EmbeddingClient 相关
export {
  EmbeddingClient,
  type EmbeddingConfig,
  type EmbeddingRequest,
  type EmbeddingResponse,
  EMBEDDING_MODELS,
  DEFAULT_CONFIG as EMBEDDING_DEFAULT_CONFIG,
} from './EmbeddingClient'

// 导出 RAGRetriever 相关
export {
  RAGRetriever,
  type RetrievalStrategy,
  type RAGConfig,
  type RetrievalResult,
  type QARequest,
  type QAResponse,
  DEFAULT_RAG_CONFIG,
} from './RAGRetriever'

// ============================================================
// 工厂函数
// ============================================================

import ChromaClientManager from './ChromaClient'
import MemoryManager from './MemoryManager'
import EmbeddingClient from './EmbeddingClient'
import RAGRetriever from './RAGRetriever'
import type { MemoryManagerOptions, EmbeddingConfig, RAGConfig } from './'

/**
 * 创建完整的记忆系统（一站式配置）
 * 
 * @param db SQLite 数据库实例
 * @param options 配置选项
 * @returns 记忆系统实例（包含所有管理器）
 */
export async function createMemorySystem(
  db: any,  // Database 类型
  options?: {
    // Chroma 配置
    chromaUrl?: string
    
    // Embedding 配置
    embeddingModel?: string
    embeddingApiKey?: string
    embeddingApiBaseUrl?: string
    
    // MemoryManager 配置
    memoryOptions?: MemoryManagerOptions
    
    // RAG 配置
    ragOptions?: RAGConfig
  }
): Promise<{
  chromaManager: ChromaClientManager
  memoryManager: MemoryManager
  embeddingClient: EmbeddingClient
  ragRetriever: RAGRetriever
}> {
  // 1. 创建 Chroma 客户端管理器
  const chromaManager = new ChromaClientManager(options?.chromaUrl)
  await chromaManager.initialize()

  // 2. 创建 Embedding 客户端
  const embeddingClient = new EmbeddingClient({
    model: options?.embeddingModel,
    apiKey: options?.embeddingApiKey,
    apiBaseUrl: options?.embeddingApiBaseUrl,
  })
  await embeddingClient.initialize()

  // 3. 创建记忆管理器
  const memoryManager = new MemoryManager(db, chromaManager, options?.memoryOptions)
  await memoryManager.initialize()

  // 4. 创建 RAG 检索器
  const ragRetriever = new RAGRetriever(
    memoryManager,
    chromaManager,
    embeddingClient,
    db,
    options?.ragOptions
  )
  await ragRetriever.initialize()

  console.log('[Memory System] All components initialized successfully')

  return {
    chromaManager,
    memoryManager,
    embeddingClient,
    ragRetriever,
  }
}

/**
 * 简化版：仅创建 Chroma + MemoryManager（不包含 RAG）
 */
export async function createBasicMemorySystem(
  db: any,
  chromaUrl?: string
): Promise<{
  chromaManager: ChromaClientManager
  memoryManager: MemoryManager
}> {
  const chromaManager = new ChromaClientManager(chromaUrl)
  await chromaManager.initialize()

  const memoryManager = new MemoryManager(db, chromaManager)
  await memoryManager.initialize()

  return { chromaManager, memoryManager }
}

/**
 * 简化版：仅创建 EmbeddingClient
 */
export async function createEmbeddingClient(
  config?: EmbeddingConfig
): Promise<EmbeddingClient> {
  const client = new EmbeddingClient(config)
  await client.initialize()
  return client
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 计算向量相似度（余弦相似度）
 * @param vec1 向量 1
 * @param vec2 向量 2
 * @returns 相似度（-1 到 1，1 表示完全相同）
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('向量维度不匹配')
  }

  let dotProduct = 0
  let norm1 = 0
  let norm2 = 0

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i]
    norm1 += vec1[i] * vec1[i]
    norm2 += vec2[i] * vec2[i]
  }

  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2)
  if (denominator === 0) {
    return 0
  }

  return dotProduct / denominator
}

/**
 * 计算欧几里得距离
 * @param vec1 向量 1
 * @param vec2 向量 2
 * @returns 距离（越小越相似）
 */
export function euclideanDistance(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('向量维度不匹配')
  }

  let sum = 0
  for (let i = 0; i < vec1.length; i++) {
    const diff = vec1[i] - vec2[i]
    sum += diff * diff
  }

  return Math.sqrt(sum)
}

/**
 * 标准化向量（使其长度为 1）
 * @param vec 输入向量
 * @returns 标准化后的向量
 */
export function normalizeVector(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0))
  
  if (norm === 0) {
    return vec
  }

  return vec.map(val => val / norm)
}

/**
 * 估算文本的 Token 数量（简单估算：1 token ≈ 4 字符）
 * @param text 输入文本
 * @returns 估算的 Token 数量
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * 截断文本到指定的 Token 数量
 * @param text 输入文本
 * @param maxTokens 最大 Token 数量
 * @returns 截断后的文本
 */
export function truncateToTokenLimit(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4  // 1 token ≈ 4 字符
  
  if (text.length <= maxChars) {
    return text
  }

  return text.substring(0, maxChars) + '...'
}

// ============================================================
// 默认导出
// ============================================================

export default {
  ChromaClientManager,
  MemoryManager,
  EmbeddingClient,
  RAGRetriever,
  createMemorySystem,
  createBasicMemorySystem,
  createEmbeddingClient,
  cosineSimilarity,
  euclideanDistance,
  normalizeVector,
  estimateTokenCount,
  truncateToTokenLimit,
}
