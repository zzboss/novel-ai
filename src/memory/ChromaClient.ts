/**
 * Chroma 向量数据库客户端封装
 * 
 * 职责：
 * 1. 管理 Chroma 客户端的连接和初始化
 * 2. 提供集合（Collection）的创建、获取、删除操作
 * 3. 提供向量的增删改查操作
 * 4. 处理错误处理和重试逻辑
 */

import { ChromaClient, Collection, Where, WhereDocument, QueryResult } from 'chromadb'

// ============================================================
// 配置和常量
// ============================================================

/**
 * 空的 Embedding Function - 阻止 chromadb 动态导入 @chroma-core/default-embed
 * 我们自己的 EmbeddingClient 负责向量化，Chroma 只负责存储和检索
 * 
 * chromadb JS 客户端在创建/getCollection 时，如果传入了 embeddingFunction，
 * 就不会尝试动态导入 @chroma-core/default-embed
 */
class NoopEmbeddingFunction {
  public defaultEmbeddingDocumentType = 'query'

  async generate(texts: string[]): Promise<number[][]> {
    // 返回空向量 - 实际不会用到，因为我们用 addVectors 直接传 embeddings
    console.warn('[ChromaClient] NoopEmbeddingFunction.generate() called - this should not happen')
    return texts.map(() => [])
  }
}

const NOOP_EMBEDDING_FN = new NoopEmbeddingFunction()

// ============================================================
// 配置和常量
// ============================================================

const CHROMA_DEFAULT_URL = 'http://localhost:8000'
const CHROMA_COLLECTION_SCHEMA = {
  MEMORIES: 'memories',      // 记忆集合
  CHAPTERS: 'chapters',      // 章节集合
  CHARACTERS: 'characters',  // 角色集合
  WORLD: 'world',            // 世界观集合
}

// 记忆集合的元数据 schema
const MEMORY_METADATA_SCHEMA = {
  memory_id: 'int',
  project_id: 'string',
  memory_type: 'string',      // 'short', 'medium', 'long', 'meta'
  content_type: 'string',     // 'chapter', 'character', 'world', 'dialogue', 'event'
  chapter_id: 'string',
  character_id: 'string',
  importance: 'int',
  created_at: 'int',
  last_accessed_at: 'int',
}

// ============================================================
// 核心类定义
// ============================================================

/**
 * Chroma 客户端管理器
 */
export class ChromaClientManager {
  private client: ChromaClient | null = null
  private collections: Map<string, Collection> = new Map()
  private isInitialized: boolean = false
  private chromaUrl: string

  constructor(chromaUrl?: string) {
    this.chromaUrl = chromaUrl || CHROMA_DEFAULT_URL
  }

  /**
   * 初始化 Chroma 客户端
   */
  async initialize(): Promise<void> {
    if (this.isInitialized && this.client) {
      return
    }

    try {
      this.client = new ChromaClient({ path: this.chromaUrl })
      
      // 测试连接
      await this.client.heartbeat()
      
      this.isInitialized = true
      console.log('[ChromaClient] Initialized successfully')
    } catch (error) {
      console.error('[ChromaClient] Failed to initialize:', error)
      throw new Error(`Chroma 连接失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * 获取 Chroma 客户端实例
   */
  getClient(): ChromaClient {
    if (!this.client) {
      throw new Error('Chroma 客户端未初始化，请先调用 initialize()')
    }
    return this.client
  }

  /**
   * 检查是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized
  }

  /**
   * 重置客户端（用于重连）
   */
  reset(): void {
    this.client = null
    this.collections.clear()
    this.isInitialized = false
  }
}

// ============================================================
// 集合管理
// ============================================================

/**
 * 获取或创建集合
 * @param manager ChromaClientManager 实例
 * @param collectionName 集合名称
 * @param metadata 集合元数据（可选）
 * @returns Collection 实例
 */
export async function getOrCreateCollection(
  manager: ChromaClientManager,
  collectionName: string,
  metadata?: Record<string, any>
): Promise<Collection> {
  const client = manager.getClient()

  try {
    // 尝试获取现有集合，传入 embeddingFunction 阻止动态导入
    const collection = await client.getCollection({
      name: collectionName,
      embeddingFunction: NOOP_EMBEDDING_FN,
    })
    console.log(`[ChromaClient] Got existing collection: ${collectionName}`)
    return collection
  } catch (error) {
    // 集合不存在，创建新集合，传入 embeddingFunction 阻止动态导入
    console.log(`[ChromaClient] Creating new collection: ${collectionName}`)
    const collection = await client.createCollection({
      name: collectionName,
      metadata: metadata || { 'hnsw:space': 'cosine' },
      embeddingFunction: NOOP_EMBEDDING_FN,
    })
    return collection
  }
}

/**
 * 删除集合
 * @param manager ChromaClientManager 实例
 * @param collectionName 集合名称
 */
export async function deleteCollection(
  manager: ChromaClientManager,
  collectionName: string
): Promise<void> {
  const client = manager.getClient()

  try {
    await client.deleteCollection({ name: collectionName })
    console.log(`[ChromaClient] Deleted collection: ${collectionName}`)
  } catch (error) {
    console.error(`[ChromaClient] Failed to delete collection ${collectionName}:`, error)
    throw error
  }
}

// ============================================================
// 向量操作
// ============================================================

/**
 * 向集合中添加向量
 * @param collection Collection 实例
 * @param ids 向量 ID 数组
 * @param embeddings 向量数组
 * @param metadatas 元数据数组（可选）
 * @param documents 文档内容数组（可选）
 */
export async function addVectors(
  collection: Collection,
  ids: string[],
  embeddings: number[][],
  metadatas?: Record<string, any>[],
  documents?: string[]
): Promise<void> {
  try {
    await collection.add({
      ids,
      embeddings,
      metadatas,
      documents,
    })
    console.log(`[ChromaClient] Added ${ids.length} vectors to collection ${collection.name}`)
  } catch (error) {
    console.error(`[ChromaClient] Failed to add vectors to ${collection.name}:`, error)
    throw error
  }
}

/**
 * 从集合中查询向量（语义搜索）
 * @param collection Collection 实例
 * @param queryEmbeddings 查询向量数组
 * @param nResults 返回结果数量
 * @param where 过滤条件（可选）
 * @param whereDocument 文档过滤条件（可选）
 * @returns 查询结果
 */
export async function queryVectors(
  collection: Collection,
  queryEmbeddings: number[][],
  nResults: number = 10,
  where?: Where,
  whereDocument?: WhereDocument
): Promise<QueryResult<any>> {
  try {
    const results = await collection.query({
      queryEmbeddings,
      nResults,
      where,
      whereDocument,
    })
    console.log(`[ChromaClient] Queried ${results.ids[0]?.length || 0} vectors from ${collection.name}`)
    return results
  } catch (error) {
    console.error(`[ChromaClient] Failed to query vectors from ${collection.name}:`, error)
    throw error
  }
}

/**
 * 从集合中删除向量
 * @param collection Collection 实例
 * @param ids 要删除的向量 ID 数组
 */
export async function deleteVectors(
  collection: Collection,
  ids: string[]
): Promise<void> {
  try {
    await collection.delete({
      ids,
    })
    console.log(`[ChromaClient] Deleted ${ids.length} vectors from ${collection.name}`)
  } catch (error) {
    console.error(`[ChromaClient] Failed to delete vectors from ${collection.name}:`, error)
    throw error
  }
}

/**
 * 更新集合中的向量
 * @param collection Collection 实例
 * @param ids 向量 ID 数组
 * @param embeddings 新的向量数组（可选）
 * @param metadatas 新的元数据数组（可选）
 * @param documents 新的文档内容数组（可选）
 */
export async function updateVectors(
  collection: Collection,
  ids: string[],
  embeddings?: number[][],
  metadatas?: Record<string, any>[],
  documents?: string[]
): Promise<void> {
  try {
    await collection.update({
      ids,
      embeddings,
      metadatas,
      documents,
    })
    console.log(`[ChromaClient] Updated ${ids.length} vectors in ${collection.name}`)
  } catch (error) {
    console.error(`[ChromaClient] Failed to update vectors in ${collection.name}:`, error)
    throw error
  }
}

/**
 * 获取集合中的向量数量
 * @param collection Collection 实例
 * @returns 向量数量
 */
export async function countVectors(collection: Collection): Promise<number> {
  try {
    const count = await collection.count()
    return count
  } catch (error) {
    console.error(`[ChromaClient] Failed to count vectors in ${collection.name}:`, error)
    throw error
  }
}

// ============================================================
// 导出
// ============================================================

export {
  CHROMA_COLLECTION_SCHEMA,
  MEMORY_METADATA_SCHEMA,
}

export default ChromaClientManager
