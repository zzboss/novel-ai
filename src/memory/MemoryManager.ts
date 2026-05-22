/**
 * 记忆管理器
 * 
 * 职责：
 * 1. 管理四层记忆的读写
 * 2. 提供记忆检索接口（关键字）
 * 3. 管理记忆的过期和压缩
 * 4. 提供记忆导入/导出接口
 * 
 * 注意：本实现暂时只支持关键字检索（使用 SQLite FTS5），
 * 语义检索（向量搜索）将在后续阶段实现。
 */
import type { Database } from 'sql.js'
import type { 
  MemoryType, 
  ContentType, 
  MemoryRecord, 
  MemoryAccessLog,
  MemoryWriteOptions,
  MemoryUpdateOptions,
  MemorySearchOptions,
  MemoryCompressionOptions,
  MemoryCleanupOptions,
  IMemoryManager 
} from './types'

// 导入数据访问层
import {
  createMemory as repoCreateMemory,
  getMemoryById as repoGetMemoryById,
  updateMemory as repoUpdateMemory,
  deleteMemory as repoDeleteMemory,
  logMemoryAccess as repoLogMemoryAccess,
  searchMemoriesByKeyword as repoSearchMemoriesByKeyword,
  getMemoriesByProject as repoGetMemoriesByProject,
  getMemoriesByChapter as repoGetMemoriesByChapter,
  getMemoriesByCharacter as repoGetMemoriesByCharacter,
  compressShortTermMemory as repoCompressShortTermMemory,
  compressMediumTermMemory as repoCompressMediumTermMemory,
  cleanupExpiredMemories as repoCleanupExpiredMemories
} from '../../electron/database/repositories/memoryRepo'

// ==================== 常量 ====================

/**
 * 默认重要性
 */
const DEFAULT_IMPORTANCE = 5

/**
 * 短期记忆重要性
 */
const SHORT_TERM_IMPORTANCE = 3

/**
 * 中期记忆重要性
 */
const MEDIUM_TERM_IMPORTANCE = 7

/**
 * 长期记忆重要性
 */
const LONG_TERM_IMPORTANCE = 8

/**
 * 元记忆重要性
 */
const META_MEMORY_IMPORTANCE = 9

/**
 * 记忆过期天数（默认 90 天）
 */
const DEFAULT_EXPIRY_DAYS = 90

/**
 * 最大记忆数量（默认 1000 条）
 */
const DEFAULT_MAX_MEMORY_COUNT = 1000

// ==================== 记忆管理器类 ====================

/**
 * 记忆管理器
 * 
 * 实现 IMemoryManager 接口
 */
export class MemoryManager implements IMemoryManager {
  /** 数据库对象 */
  private db: Database
  
  /** 项目 ID */
  private projectId: string
  
  /** 缓存（用于减少数据库查询） */
  private cache: Map<string, { record: MemoryRecord; expiry: number }>
  
  /** 缓存有效期（毫秒，默认 5 分钟） */
  private cacheTTL: number = 5 * 60 * 1000
  
  /**
   * 构造函数
   * @param db - 数据库对象
   * @param projectId - 项目 ID
   */
  constructor(db: Database, projectId: string) {
    this.db = db
    this.projectId = projectId
    this.cache = new Map()
  }
  
  // ==================== 记忆写入 ====================
  
  /**
   * 写入短期记忆（当前章节内容）
   * @param chapterId - 章节 ID
   * @param content - 章节内容
   * @param options - 写入选项
   * @returns 创建的记忆 ID
   */
  async writeShortTermMemory(
    chapterId: string, 
    content: string, 
    options?: Partial<MemoryWriteOptions>
  ): Promise<number> {
    try {
      const memoryId = repoCreateMemory(this.db, {
        project_id: this.projectId,
        memory_type: 'short',
        content: content,
        content_type: options?.content_type || 'chapter',
        chapter_id: chapterId,
        character_id: options?.character_id,
        importance: options?.importance || SHORT_TERM_IMPORTANCE,
        metadata: options?.metadata ? JSON.stringify(options.metadata) : null
      })
      
      // 记录访问日志
      await this.logMemoryAccess(memoryId, 'write', { 
        action: 'write_short_term', 
        chapter_id: chapterId 
      })
      
      console.log(`[MemoryManager] 短期记忆写入成功，ID: ${memoryId}`)
      return memoryId
    } catch (error) {
      console.error('[MemoryManager] 写入短期记忆失败:', error)
      throw error
    }
  }
  
  /**
   * 写入中期记忆（当前卷的章节）
   * @param volumeId - 卷 ID
   * @param chapters - 章节数组
   * @param options - 写入选项
   * @returns 创建的记忆 ID 数组
   */
  async writeMediumTermMemory(
    volumeId: string, 
    chapters: Array<{ id: string; content: string }>, 
    options?: Partial<MemoryWriteOptions>
  ): Promise<number[]> {
    try {
      const memoryIds: number[] = []
      
      for (const chapter of chapters) {
        const memoryId = repoCreateMemory(this.db, {
          project_id: this.projectId,
          memory_type: 'medium',
          content: chapter.content,
          content_type: options?.content_type || 'chapter',
          chapter_id: chapter.id,
          character_id: options?.character_id,
          importance: options?.importance || MEDIUM_TERM_IMPORTANCE,
          metadata: options?.metadata ? JSON.stringify(options.metadata) : null
        })
        
        memoryIds.push(memoryId)
        
        // 记录访问日志
        await this.logMemoryAccess(memoryId, 'write', { 
          action: 'write_medium_term', 
          volume_id: volumeId,
          chapter_id: chapter.id 
        })
      }
      
      console.log(`[MemoryManager] 中期记忆写入成功，共 ${memoryIds.length} 条`)
      return memoryIds
    } catch (error) {
      console.error('[MemoryManager] 写入中期记忆失败:', error)
      throw error
    }
  }
  
  /**
   * 写入长期记忆（章节摘要）
   * @param chapterId - 章节 ID
   * @param summary - 章节摘要
   * @param options - 写入选项
   * @returns 创建的记忆 ID
   */
  async writeLongTermMemory(
    chapterId: string, 
    summary: string, 
    options?: Partial<MemoryWriteOptions>
  ): Promise<number> {
    try {
      const memoryId = repoCreateMemory(this.db, {
        project_id: this.projectId,
        memory_type: 'long',
        content: summary,
        content_type: options?.content_type || 'chapter_summary',
        chapter_id: chapterId,
        character_id: options?.character_id,
        importance: options?.importance || LONG_TERM_IMPORTANCE,
        metadata: options?.metadata ? JSON.stringify(options.metadata) : null
      })
      
      // 记录访问日志
      await this.logMemoryAccess(memoryId, 'write', { 
        action: 'write_long_term', 
        chapter_id: chapterId 
      })
      
      console.log(`[MemoryManager] 长期记忆写入成功，ID: ${memoryId}`)
      return memoryId
    } catch (error) {
      console.error('[MemoryManager] 写入长期记忆失败:', error)
      throw error
    }
  }
  
  /**
   * 写入元记忆（项目创作指南）
   * @param type - 元记忆类型（'memory' | 'style' | 'character_map'）
   * @param content - 内容
   * @param options - 写入选项
   * @returns 创建的记忆 ID
   */
  async writeMetaMemory(
    type: 'memory' | 'style' | 'character_map', 
    content: string, 
    options?: Partial<MemoryWriteOptions>
  ): Promise<number> {
    try {
      const memoryId = repoCreateMemory(this.db, {
        project_id: this.projectId,
        memory_type: 'meta',
        content: content,
        content_type: type as ContentType,
        chapter_id: options?.chapter_id,
        character_id: options?.character_id,
        importance: options?.importance || META_MEMORY_IMPORTANCE,
        metadata: options?.metadata ? JSON.stringify(options.metadata) : null
      })
      
      // 记录访问日志
      await this.logMemoryAccess(memoryId, 'write', { 
        action: 'write_meta', 
        meta_type: type 
      })
      
      console.log(`[MemoryManager] 元记忆写入成功，ID: ${memoryId}`)
      return memoryId
    } catch (error) {
      console.error('[MemoryManager] 写入元记忆失败:', error)
      throw error
    }
  }
  
  // ==================== 记忆检索 ====================
  
  /**
   * 关键字检索（使用 SQLite FTS5）
   * @param query - 检索关键字
   * @param options - 检索选项
   * @returns 匹配的记忆记录数组
   */
  async searchByKeyword(query: string, options?: MemorySearchOptions): Promise<MemoryRecord[]> {
    try {
      const results = repoSearchMemoriesByKeyword(this.db, query, {
        ...options,
        project_id: this.projectId
      })
      
      // 更新缓存
      for (const record of results) {
        this.updateCache(record.id.toString(), record)
      }
      
      console.log(`[MemoryManager] 关键字检索完成，找到 ${results.length} 条记录`)
      return results
    } catch (error) {
      console.error('[MemoryManager] 关键字检索失败:', error)
      throw error
    }
  }
  
  /**
   * 语义检索（使用向量搜索，暂未实现）
   * @param queryEmbedding - 查询向量
   * @param options - 检索选项
   * @returns 匹配的记忆记录数组
   */
  async searchBySemantic(queryEmbedding: number[], options?: MemorySearchOptions): Promise<MemoryRecord[]> {
    // TODO: 实现语义检索（使用 sqlite-vss 或独立向量数据库）
    console.warn('[MemoryManager] 语义检索暂未实现，返回空数组')
    return []
  }
  
  /**
   * 混合检索（关键字 + 语义）
   * @param query - 检索关键字
   * @param queryEmbedding - 查询向量
   * @param options - 检索选项
   * @returns 匹配的记忆记录数组
   */
  async hybridSearch(query: string, queryEmbedding: number[], options?: MemorySearchOptions): Promise<MemoryRecord[]> {
    try {
      // 关键字检索
      const keywordResults = await this.searchByKeyword(query, options)
      
      // 语义检索（暂未实现，返回空数组）
      const semanticResults = await this.searchBySemantic(queryEmbedding, options)
      
      // 合并结果（去重）
      const mergedResults = this.mergeSearchResults(keywordResults, semanticResults)
      
      console.log(`[MemoryManager] 混合检索完成，找到 ${mergedResults.length} 条记录`)
      return mergedResults
    } catch (error) {
      console.error('[MemoryManager] 混合检索失败:', error)
      throw error
    }
  }
  
  /**
   * 根据 ID 获取记忆
   * @param id - 记忆 ID
   * @returns 记忆记录，如果不存在则返回 null
   */
  async getMemoryById(id: number): Promise<MemoryRecord | null> {
    try {
      // 先查缓存
      const cached = this.getFromCache(id.toString())
      if (cached) {
        return cached
      }
      
      // 查数据库
      const record = repoGetMemoryById(this.db, id)
      
      if (record) {
        // 更新缓存
        this.updateCache(id.toString(), record)
        
        // 记录访问日志
        await this.logMemoryAccess(id, 'read', { action: 'get_by_id' })
      }
      
      return record
    } catch (error) {
      console.error(`[MemoryManager] 获取记忆失败，ID: ${id}`, error)
      throw error
    }
  }
  
  /**
   * 获取项目所有记忆
   * @param projectId - 项目 ID
   * @param options - 检索选项
   * @returns 记忆记录数组
   */
  async getMemoriesByProject(projectId: string, options?: MemorySearchOptions): Promise<MemoryRecord[]> {
    try {
      const results = repoGetMemoriesByProject(this.db, projectId, options)
      
      // 更新缓存
      for (const record of results) {
        this.updateCache(record.id.toString(), record)
      }
      
      console.log(`[MemoryManager] 获取项目所有记忆完成，找到 ${results.length} 条记录`)
      return results
    } catch (error) {
      console.error(`[MemoryManager] 获取项目所有记忆失败，项目 ID: ${projectId}`, error)
      throw error
    }
  }
  
  /**
   * 获取章节所有记忆
   * @param chapterId - 章节 ID
   * @param options - 检索选项
   * @returns 记忆记录数组
   */
  async getMemoriesByChapter(chapterId: string, options?: Omit<MemorySearchOptions, 'chapter_id'>): Promise<MemoryRecord[]> {
    try {
      const results = repoGetMemoriesByChapter(this.db, chapterId, options)
      
      // 更新缓存
      for (const record of results) {
        this.updateCache(record.id.toString(), record)
      }
      
      console.log(`[MemoryManager] 获取章节所有记忆完成，找到 ${results.length} 条记录`)
      return results
    } catch (error) {
      console.error(`[MemoryManager] 获取章节所有记忆失败，章节 ID: ${chapterId}`, error)
      throw error
    }
  }
  
  /**
   * 获取角色所有记忆
   * @param characterId - 角色 ID
   * @param options - 检索选项
   * @returns 记忆记录数组
   */
  async getMemoriesByCharacter(characterId: string, options?: Omit<MemorySearchOptions, 'character_id'>): Promise<MemoryRecord[]> {
    try {
      const results = repoGetMemoriesByCharacter(this.db, characterId, options)
      
      // 更新缓存
      for (const record of results) {
        this.updateCache(record.id.toString(), record)
      }
      
      console.log(`[MemoryManager] 获取角色所有记忆完成，找到 ${results.length} 条记录`)
      return results
    } catch (error) {
      console.error(`[MemoryManager] 获取角色所有记忆失败，角色 ID: ${characterId}`, error)
      throw error
    }
  }
  
  // ==================== 记忆更新 ====================
  
  /**
   * 更新记忆
   * @param id - 记忆 ID
   * @param updates - 要更新的字段
   */
  async updateMemory(id: number, updates: MemoryUpdateOptions): Promise<void> {
    try {
      repoUpdateMemory(this.db, id, {
        memory_type: updates.memory_type,
        content: updates.content,
        content_type: updates.content_type,
        chapter_id: updates.chapter_id,
        character_id: updates.character_id,
        importance: updates.importance,
        metadata: updates.metadata ? JSON.stringify(updates.metadata) : undefined
      })
      
      // 清除缓存
      this.removeFromCache(id.toString())
      
      // 记录访问日志
      await this.logMemoryAccess(id, 'update', { action: 'update_memory' })
      
      console.log(`[MemoryManager] 记忆更新成功，ID: ${id}`)
    } catch (error) {
      console.error(`[MemoryManager] 更新记忆失败，ID: ${id}`, error)
      throw error
    }
  }
  
  /**
   * 删除记忆
   * @param id - 记忆 ID
   */
  async deleteMemory(id: number): Promise<void> {
    try {
      repoDeleteMemory(this.db, id)
      
      // 清除缓存
      this.removeFromCache(id.toString())
      
      console.log(`[MemoryManager] 记忆删除成功，ID: ${id}`)
    } catch (error) {
      console.error(`[MemoryManager] 删除记忆失败，ID: ${id}`, error)
      throw error
    }
  }
  
  // ==================== 记忆管理 ====================
  
  /**
   * 压缩短期记忆（将短期记忆转换为中期记忆）
   * @param chapterId - 章节 ID
   * @param summary - 压缩后的摘要
   * @param options - 压缩选项
   */
  async compressShortTermMemory(
    chapterId: string, 
    summary: string, 
    options?: MemoryCompressionOptions
  ): Promise<void> {
    try {
      // 压缩短期记忆
      repoCompressShortTermMemory(this.db, this.projectId, chapterId, summary)
      
      // 如果需要删除原始记忆
      if (options?.delete_original !== false) {
        const shortTermMemories = await this.getMemoriesByChapter(chapterId, { memory_type: 'short' })
        for (const memory of shortTermMemories) {
          await this.deleteMemory(memory.id)
        }
      }
      
      console.log(`[MemoryManager] 短期记忆压缩完成，章节 ID: ${chapterId}`)
    } catch (error) {
      console.error(`[MemoryManager] 压缩短期记忆失败，章节 ID: ${chapterId}`, error)
      throw error
    }
  }
  
  /**
   * 压缩中期记忆（将中期记忆转换为长期记忆）
   * @param volumeId - 卷 ID
   * @param summary - 压缩后的摘要
   * @param options - 压缩选项
   */
  async compressMediumTermMemory(
    volumeId: string, 
    summary: string, 
    options?: MemoryCompressionOptions
  ): Promise<void> {
    try {
      // 压缩中期记忆
      repoCompressMediumTermMemory(this.db, this.projectId, volumeId, summary)
      
      // 如果需要删除原始记忆
      if (options?.delete_original !== false) {
        const mediumTermMemories = await this.getMemoriesByProject(this.projectId, { memory_type: 'medium' })
        for (const memory of mediumTermMemories) {
          await this.deleteMemory(memory.id)
        }
      }
      
      console.log(`[MemoryManager] 中期记忆压缩完成，卷 ID: ${volumeId}`)
    } catch (error) {
      console.error(`[MemoryManager] 压缩中期记忆失败，卷 ID: ${volumeId}`, error)
      throw error
    }
  }
  
  /**
   * 清理过期记忆
   * @param projectId - 项目 ID
   * @param options - 清理选项
   * @returns 删除的记忆数量
   */
  async cleanupExpiredMemories(projectId: string, options?: MemoryCleanupOptions): Promise<number> {
    try {
      const deletedCount = repoCleanupExpiredMemories(
        this.db, 
        projectId, 
        options?.max_age_days || DEFAULT_EXPIRY_DAYS,
        options?.max_count || DEFAULT_MAX_MEMORY_COUNT
      )
      
      // 清除缓存
      this.clearCache()
      
      console.log(`[MemoryManager] 过期记忆清理完成，删除了 ${deletedCount} 条记录`)
      return deletedCount
    } catch (error) {
      console.error(`[MemoryManager] 清理过期记忆失败，项目 ID: ${projectId}`, error)
      throw error
    }
  }
  
  /**
   * 记录记忆访问
   * @param memoryId - 记忆 ID
   * @param accessType - 访问类型
   * @param context - 访问上下文（可选）
   */
  async logMemoryAccess(
    memoryId: number, 
    accessType: 'read' | 'write' | 'update', 
    context?: Record<string, any>
  ): Promise<void> {
    try {
      repoLogMemoryAccess(this.db, memoryId, accessType, context ? JSON.stringify(context) : undefined)
    } catch (error) {
      console.error(`[MemoryManager] 记录记忆访问失败，记忆 ID: ${memoryId}`, error)
      // 不抛出错误，避免影响主流程
    }
  }
  
  // ==================== 缓存管理 ====================
  
  /**
   * 更新缓存
   * @param key - 缓存键
   * @param record - 记忆记录
   */
  private updateCache(key: string, record: MemoryRecord): void {
    this.cache.set(key, {
      record,
      expiry: Date.now() + this.cacheTTL
    })
  }
  
  /**
   * 从缓存获取
   * @param key - 缓存键
   * @returns 记忆记录，如果不存在或已过期则返回 null
   */
  private getFromCache(key: string): MemoryRecord | null {
    const cached = this.cache.get(key)
    
    if (!cached) {
      return null
    }
    
    // 检查是否过期
    if (Date.now() > cached.expiry) {
      this.cache.delete(key)
      return null
    }
    
    return cached.record
  }
  
  /**
   * 从缓存删除
   * @param key - 缓存键
   */
  private removeFromCache(key: string): void {
    this.cache.delete(key)
  }
  
  /**
   * 清除所有缓存
   */
  private clearCache(): void {
    this.cache.clear()
  }
  
  // ==================== 辅助方法 ====================
  
  /**
   * 合并搜索结果（去重）
   * @param results1 - 结果数组 1
   * @param results2 - 结果数组 2
   * @returns 合并后的结果数组
   */
  private mergeSearchResults(results1: MemoryRecord[], results2: MemoryRecord[]): MemoryRecord[] {
    const merged: MemoryRecord[] = [...results1]
    const existingIds = new Set(results1.map(r => r.id))
    
    for (const record of results2) {
      if (!existingIds.has(record.id)) {
        merged.push(record)
        existingIds.add(record.id)
      }
    }
    
    return merged
  }
}

// ==================== 导出 ====================

export default MemoryManager
