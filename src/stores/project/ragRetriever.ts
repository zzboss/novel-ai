/**
 * RAG 检索器模块
 * 
 * 职责：
 * 1. 封装 RAGRetriever 的初始化和使用
 * 2. 提供项目级的 RAG 检索方法
 * 3. 与 agentStore 集成
 */

import { ref } from 'vue'
import RAGRetriever, { RetrievalResult, RAGConfig, QARequest, QAResponse } from '../../memory/RAGRetriever'
import MemoryManager from '../../memory/MemoryManager'
import ChromaClientManager from '../../memory/ChromaClient'
import EmbeddingClient from '../../memory/EmbeddingClient'
import { Database } from 'sql.js'

// ============================================================
// 状态定义
// ============================================================

const ragRetriever = ref<RAGRetriever | null>(null)
const isRAGInitialized = ref(false)
const ragError = ref<string | null>(null)

// ============================================================
// 初始化方法
// ============================================================

/**
 * 初始化 RAG 检索器
 * @param memoryManager MemoryManager 实例
 * @param chromaManager ChromaClientManager 实例
 * @param db SQL.js 数据库实例
 * @param config RAG 配置
 */
export async function initRAGRetriever(
  memoryManager: MemoryManager,
  chromaManager: ChromaClientManager,
  db: Database,
  config?: RAGConfig
): Promise<void> {
  try {
    ragError.value = null

    // 1. 初始化 Embedding 客户端
    const embeddingClient = new EmbeddingClient({
      model: 'text-embedding-ada-002', // 默认使用 OpenAI 模型
      dimensions: 1536,
    })

    // 2. 初始化 RAG 检索器
    if (!ragRetriever.value) {
      ragRetriever.value = new RAGRetriever(
        memoryManager,
        chromaManager,
        embeddingClient,
        db,
        config
      )
      await ragRetriever.value.initialize()
    }

    isRAGInitialized.value = true
    console.log('[RAGRetriever] Initialized successfully')
  } catch (error) {
    ragError.value = error instanceof Error ? error.message : String(error)
    console.error('[RAGRetriever] Initialization failed:', error)
    throw error
  }
}

/**
 * 销毁 RAG 检索器
 */
export function destroyRAGRetriever(): void {
  ragRetriever.value = null
  isRAGInitialized.value = false
  console.log('[RAGRetriever] Destroyed')
}

// ============================================================
// RAG 检索方法
// ============================================================

/**
 * 检索相关记忆
 * @param query 查询文本
 * @param options 检索选项
 * @returns 检索结果数组
 */
export async function retrieve(
  query: string,
  options?: {
    strategy?: 'keyword' | 'semantic' | 'hybrid'
    maxResults?: number
    projectId?: string
    memoryType?: string | string[]
    contentType?: string | string[]
    chapterId?: string
    characterId?: string
    minImportance?: number
  }
): Promise<RetrievalResult[]> {
  if (!ragRetriever.value) {
    throw new Error('RAGRetriever not initialized')
  }

  return ragRetriever.value.retrieve(query, options)
}

/**
 * 上下文增强
 * @param results 检索结果
 * @param query 查询文本
 * @returns 增强后的上下文文本
 */
export async function enrichContext(
  results: RetrievalResult[],
  query: string
): Promise<string> {
  if (!ragRetriever.value) {
    throw new Error('RAGRetriever not initialized')
  }

  return ragRetriever.value.enrichContext(results, query)
}

/**
 * 智能问答
 * @param request 问答请求
 * @returns 问答响应
 */
export async function smartQA(request: QARequest): Promise<QAResponse> {
  if (!ragRetriever.value) {
    throw new Error('RAGRetriever not initialized')
  }

  return ragRetriever.value.smartQA(request)
}

// ============================================================
// Getter 方法
// ============================================================

/**
 * 获取 RAGRetriever 实例
 */
export function getRAGRetriever(): RAGRetriever | null {
  return ragRetriever.value
}

/**
 * 检查 RAG 检索器是否已初始化
 */
export function isRAGReady(): boolean {
  return isRAGInitialized.value
}

/**
 * 获取 RAG 错误
 */
export function getRAGError(): string | null {
  return ragError.value
}

/**
 * 获取当前 RAG 配置
 */
export function getRAGConfig(): Required<RAGConfig> | null {
  if (!ragRetriever.value) {
    return null
  }

  return ragRetriever.value.getConfig()
}

/**
 * 更新 RAG 配置
 * @param config 新的配置
 */
export function updateRAGConfig(config: Partial<RAGConfig>): void {
  if (!ragRetriever.value) {
    throw new Error('RAGRetriever not initialized')
  }

  ragRetriever.value.updateConfig(config)
}

// ============================================================
// 导出
// ============================================================

export default {
  initRAGRetriever,
  destroyRAGRetriever,
  retrieve,
  enrichContext,
  smartQA,
  getRAGRetriever,
  isRAGReady,
  getRAGError,
  getRAGConfig,
  updateRAGConfig,
}
