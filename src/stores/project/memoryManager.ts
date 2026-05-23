/**
 * 记忆管理模块
 * 
 * 职责：
 * 1. 封装 MemoryManager 的初始化和使用
 * 2. 提供项目级的记忆操作方法
 * 3. 与 projectStore 集成
 */

import { ref, computed } from 'vue'
import { Database } from 'sql.js'
import MemoryManager, { MemoryRecord, MemoryType, ContentType, SearchOptions } from '../../memory/MemoryManager'
import ChromaClientManager from '../../memory/ChromaClient'
import EmbeddingClient from '../../memory/EmbeddingClient'

// ============================================================
// 状态定义
// ============================================================

const memoryManager = ref<MemoryManager | null>(null)
const chromaManager = ref<ChromaClientManager | null>(null)
const embeddingClient = ref<EmbeddingClient | null>(null)
const isMemoryInitialized = ref(false)
const memoryError = ref<string | null>(null)

// ============================================================
// 初始化方法
// ============================================================

/**
 * 初始化记忆管理系统
 * @param db SQL.js 数据库实例
 * @param projectId 项目 ID
 */
export async function initMemoryManager(db: Database, projectId: string): Promise<void> {
  try {
    memoryError.value = null

    // 1. 初始化 Chroma 客户端
    if (!chromaManager.value) {
      chromaManager.value = new ChromaClientManager({
        path: ':memory:', // 使用内存模式，生产环境应改为文件路径
      })
      await chromaManager.value.initialize()
    }

    // 2. 初始化 Embedding 客户端
    if (!embeddingClient.value) {
      embeddingClient.value = new EmbeddingClient({
        model: 'text-embedding-ada-002', // 默认使用 OpenAI 模型
        dimensions: 1536,
      })
    }

    // 3. 初始化 MemoryManager
    if (!memoryManager.value) {
      memoryManager.value = new MemoryManager(
        db,
        chromaManager.value,
        { embeddingDimension: 1536 }
      )
      await memoryManager.value.initialize()
    }

    isMemoryInitialized.value = true
    console.log('[MemoryManager] Initialized successfully')
  } catch (error) {
    memoryError.value = error instanceof Error ? error.message : String(error)
    console.error('[MemoryManager] Initialization failed:', error)
    throw error
  }
}

/**
 * 销毁记忆管理系统
 */
export function destroyMemoryManager(): void {
  memoryManager.value = null
  chromaManager.value = null
  embeddingClient.value = null
  isMemoryInitialized.value = false
  console.log('[MemoryManager] Destroyed')
}

// ============================================================
// 记忆操作方法
// ============================================================

/**
 * 写入短期记忆（当前章节内容）
 * @param projectId 项目 ID
 * @param chapterId 章节 ID
 * @param content 章节内容
 * @param metadata 元数据
 */
export async function writeShortTermMemory(
  projectId: string,
  chapterId: string,
  content: string,
  metadata?: Record<string, any>
): Promise<string> {
  if (!memoryManager.value) {
    throw new Error('MemoryManager not initialized')
  }

  // 生成 embedding
  let embedding: number[] | undefined
  if (embeddingClient.value) {
    try {
      embedding = await embeddingClient.value.embed(content)
    } catch (error) {
      console.warn('[MemoryManager] Failed to generate embedding:', error)
    }
  }

  return memoryManager.value.writeShortTermMemory(
    projectId,
    chapterId,
    content,
    embedding,
    metadata
  )
}

/**
 * 写入中期记忆（当前卷的章节摘要）
 * @param projectId 项目 ID
 * @param volumeId 卷 ID
 * @param chapters 章节数组
 */
export async function writeMediumTermMemory(
  projectId: string,
  volumeId: string,
  chapters: Array<{ id: string; title: string; content: string }>,
): Promise<string[]> {
  if (!memoryManager.value) {
    throw new Error('MemoryManager not initialized')
  }

  // 生成 embeddings
  let embeddings: number[][] | undefined
  if (embeddingClient.value) {
    try {
      const contents = chapters.map(c => c.content)
      embeddings = await embeddingClient.value.embedBatch(contents)
    } catch (error) {
      console.warn('[MemoryManager] Failed to generate embeddings:', error)
    }
  }

  return memoryManager.value.writeMediumTermMemory(
    projectId,
    volumeId,
    chapters,
    embeddings
  )
}

/**
 * 写入长期记忆（重要事件、角色发展等）
 * @param projectId 项目 ID
 * @param content 内容
 * @param contentType 内容类型
 * @param importance 重要性（1-10）
 * @param metadata 元数据
 */
export async function writeLongTermMemory(
  projectId: string,
  content: string,
  contentType: ContentType,
  importance: number = 7,
  metadata?: Record<string, any>
): Promise<string> {
  if (!memoryManager.value) {
    throw new Error('MemoryManager not initialized')
  }

  // 生成 embedding
  let embedding: number[] | undefined
  if (embeddingClient.value) {
    try {
      embedding = await embeddingClient.value.embed(content)
    } catch (error) {
      console.warn('[MemoryManager] Failed to generate embedding:', error)
    }
  }

  return memoryManager.value.writeLongTermMemory(
    projectId,
    content,
    contentType,
    importance,
    embedding,
    metadata
  )
}

/**
 * 写入元记忆（项目创作指南、风格指南等）
 * @param projectId 项目 ID
 * @param content 内容
 * @param contentType 内容类型
 * @param metadata 元数据
 */
export async function writeMetaMemory(
  projectId: string,
  content: string,
  contentType: ContentType,
  metadata?: Record<string, any>
): Promise<string> {
  if (!memoryManager.value) {
    throw new Error('MemoryManager not initialized')
  }

  // 生成 embedding
  let embedding: number[] | undefined
  if (embeddingClient.value) {
    try {
      embedding = await embeddingClient.value.embed(content)
    } catch (error) {
      console.warn('[MemoryManager] Failed to generate embedding:', error)
    }
  }

  return memoryManager.value.writeMetaMemory(
    projectId,
    content,
    contentType,
    embedding,
    metadata
  )
}

/**
 * 检索记忆
 * @param options 检索选项
 */
export async function searchMemories(options: SearchOptions): Promise<MemoryRecord[]> {
  if (!memoryManager.value) {
    throw new Error('MemoryManager not initialized')
  }

  return memoryManager.value.searchByKeyword('', options)
}

/**
 * 按关键字检索记忆
 * @param query 查询关键字
 * @param options 检索选项
 */
export async function searchMemoriesByKeyword(
  query: string,
  options: SearchOptions
): Promise<MemoryRecord[]> {
  if (!memoryManager.value) {
    throw new Error('MemoryManager not initialized')
  }

  return memoryManager.value.searchByKeyword(query, options)
}

/**
 * 按语义检索记忆
 * @param query 查询文本
 * @param options 检索选项
 */
export async function searchMemoriesBySemantic(
  query: string,
  options: SearchOptions
): Promise<MemoryRecord[]> {
  if (!memoryManager.value || !embeddingClient.value) {
    throw new Error('MemoryManager or EmbeddingClient not initialized')
  }

  const embedding = await embeddingClient.value.embed(query)
  return memoryManager.value.searchBySemantic(embedding, options)
}

/**
 * 获取记忆 by ID
 * @param id 记忆 ID
 */
export async function getMemoryById(id: string): Promise<MemoryRecord | null> {
  if (!memoryManager.value) {
    throw new Error('MemoryManager not initialized')
  }

  return memoryManager.value.getMemoryById(id)
}

/**
 * 删除记忆
 * @param id 记忆 ID
 */
export async function deleteMemory(id: string): Promise<void> {
  if (!memoryManager.value) {
    throw new Error('MemoryManager not initialized')
  }

  return memoryManager.value.deleteMemory(id)
}

/**
 * 压缩短期记忆
 * @param chapterId 章节 ID
 */
export async function compressShortTermMemory(chapterId: string): Promise<string> {
  if (!memoryManager.value) {
    throw new Error('MemoryManager not initialized')
  }

  return memoryManager.value.compressShortTermMemory(chapterId)
}

/**
 * 压缩中期记忆
 * @param volumeId 卷 ID
 */
export async function compressMediumTermMemory(volumeId: string): Promise<string> {
  if (!memoryManager.value) {
    throw new Error('MemoryManager not initialized')
  }

  return memoryManager.value.compressMediumTermMemory(volumeId)
}

/**
 * 清理过期记忆
 * @param projectId 项目 ID
 * @param days 过期天数
 */
export async function cleanupExpiredMemories(
  projectId: string,
  days: number = 30
): Promise<number> {
  if (!memoryManager.value) {
    throw new Error('MemoryManager not initialized')
  }

  return memoryManager.value.cleanupExpiredMemories(projectId, days)
}

// ============================================================
// Getter 方法
// ============================================================

/**
 * 获取 MemoryManager 实例
 */
export function getMemoryManager(): MemoryManager | null {
  return memoryManager.value
}

/**
 * 获取 ChromaClientManager 实例
 */
export function getChromaManager(): ChromaClientManager | null {
  return chromaManager.value
}

/**
 * 获取 EmbeddingClient 实例
 */
export function getEmbeddingClient(): EmbeddingClient | null {
  return embeddingClient.value
}

/**
 * 检查记忆管理系统是否已初始化
 */
export function isMemoryReady(): boolean {
  return isMemoryInitialized.value
}

/**
 * 获取记忆管理错误
 */
export function getMemoryError(): string | null {
  return memoryError.value
}

/**
 * 计算记忆数量
 * @param projectId 项目 ID
 * @param memoryType 记忆类型（可选）
 */
export function countMemories(
  projectId: string,
  memoryType?: MemoryType
): number {
  if (!memoryManager.value) {
    return 0
  }

  return memoryManager.value.countMemories(projectId, memoryType)
}

// ============================================================
// 导出
// ============================================================

export default {
  initMemoryManager,
  destroyMemoryManager,
  writeShortTermMemory,
  writeMediumTermMemory,
  writeLongTermMemory,
  writeMetaMemory,
  searchMemories,
  searchMemoriesByKeyword,
  searchMemoriesBySemantic,
  getMemoryById,
  deleteMemory,
  compressShortTermMemory,
  compressMediumTermMemory,
  cleanupExpiredMemories,
  getMemoryManager,
  getChromaManager,
  getEmbeddingClient,
  isMemoryReady,
  getMemoryError,
  countMemories,
}
