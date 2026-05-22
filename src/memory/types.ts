/**
 * 记忆管理系统类型定义
 * 
 * 定义记忆管理系统的核心类型和接口
 */
import type { Database } from 'sql.js'

// ==================== 记忆类型枚举 ====================

/**
 * 记忆类型
 * - short: 短期记忆（当前章节内容、当前对话历史）
 * - medium: 中期记忆（当前卷的章节、当前卷的角色状态）
 * - long: 长期记忆（章节摘要、角色状态历史、世界观演变）
 * - meta: 元记忆（项目创作指南、风格指南、人物关系图）
 */
export type MemoryType = 'short' | 'medium' | 'long' | 'meta'

/**
 * 记忆内容类型
 * - chapter: 章节内容
 * - chapter_summary: 章节摘要
 * - character: 角色信息
 * - character_state: 角色状态
 * - world: 世界观信息
 * - event: 事件
 * - dialogue: 对话
 * - foreshadow: 伏笔
 * - emotion: 情感曲线
 * - resource: 资源
 * - user_input: 用户输入
 * - ai_output: AI 输出
 * - feedback: 反馈
 */
export type ContentType = 
  | 'chapter'
  | 'chapter_summary'
  | 'character'
  | 'character_state'
  | 'world'
  | 'event'
  | 'dialogue'
  | 'foreshadow'
  | 'emotion'
  | 'resource'
  | 'user_input'
  | 'ai_output'
  | 'feedback'

/**
 * 访问类型
 * - read: 读取
 * - write: 写入
 * - update: 更新
 */
export type AccessType = 'read' | 'write' | 'update'

// ==================== 核心接口 ====================

/**
 * 记忆记录
 */
export interface MemoryRecord {
  /** 记忆 ID */
  id: number
  
  /** 项目 ID */
  project_id: string
  
  /** 记忆类型 */
  memory_type: MemoryType
  
  /** 记忆内容 */
  content: string
  
  /** 内容类型 */
  content_type: ContentType
  
  /** 关联章节 ID（可选） */
  chapter_id?: string
  
  /** 关联角色 ID（可选） */
  character_id?: string
  
  /** 重要性（1-10，10 为最重要） */
  importance: number
  
  /** 创建时间戳（秒） */
  created_at: number
  
  /** 最后访问时间戳（秒） */
  last_accessed_at: number
  
  /** 访问次数 */
  access_count: number
  
  /** 元数据（JSON 字符串） */
  metadata?: string
}

/**
 * 记忆访问日志
 */
export interface MemoryAccessLog {
  /** 日志 ID */
  id: number
  
  /** 记忆 ID */
  memory_id: number
  
  /** 访问类型 */
  access_type: AccessType
  
  /** 访问时间戳（秒） */
  accessed_at: number
  
  /** 访问上下文（JSON 字符串） */
  context?: string
}

/**
 * 记忆检索选项
 */
export interface MemorySearchOptions {
  /** 项目 ID（可选，用于过滤） */
  project_id?: string
  
  /** 记忆类型（可选，用于过滤） */
  memory_type?: MemoryType
  
  /** 内容类型（可选，用于过滤） */
  content_type?: ContentType
  
  /** 关联章节 ID（可选，用于过滤） */
  chapter_id?: string
  
  /** 关联角色 ID（可选，用于过滤） */
  character_id?: string
  
  /** 最小重要性（可选，用于过滤） */
  min_importance?: number
  
  /** 限制返回数量（可选，用于分页） */
  limit?: number
  
  /** 偏移量（可选，用于分页） */
  offset?: number
}

/**
 * 记忆写入选项
 */
export interface MemoryWriteOptions {
  /** 项目 ID */
  project_id: string
  
  /** 记忆类型 */
  memory_type: MemoryType
  
  /** 记忆内容 */
  content: string
  
  /** 内容类型 */
  content_type: ContentType
  
  /** 关联章节 ID（可选） */
  chapter_id?: string
  
  /** 关联角色 ID（可选） */
  character_id?: string
  
  /** 重要性（1-10，10 为最重要，默认 5） */
  importance?: number
  
  /** 元数据（可选） */
  metadata?: Record<string, any>
}

/**
 * 记忆更新选项
 */
export interface MemoryUpdateOptions {
  /** 记忆类型（可选） */
  memory_type?: MemoryType
  
  /** 记忆内容（可选） */
  content?: string
  
  /** 内容类型（可选） */
  content_type?: ContentType
  
  /** 关联章节 ID（可选） */
  chapter_id?: string
  
  /** 关联角色 ID（可选） */
  character_id?: string
  
  /** 重要性（可选） */
  importance?: number
  
  /** 元数据（可选） */
  metadata?: Record<string, any>
}

/**
 * 记忆压缩选项
 */
export interface MemoryCompressionOptions {
  /** 是否删除原始记忆（默认 true） */
  delete_original?: boolean
  
  /** 压缩后的重要性（默认 7） */
  compressed_importance?: number
  
  /** 压缩后的内容类型（默认 'chapter_summary' 或 'volume_summary'） */
  compressed_content_type?: ContentType
}

/**
 * 记忆清理选项
 */
export interface MemoryCleanupOptions {
  /** 最大年龄（天），超过这个年龄的记忆将被删除 */
  max_age_days?: number
  
  /** 最大记忆数量，超过这个数量的记忆将被删除（按最后访问时间排序） */
  max_count?: number
  
  /** 是否清理低重要性的记忆（默认 false） */
  cleanup_low_importance?: boolean
  
  /** 低重要性阈值（默认 3） */
  low_importance_threshold?: number
}

// ==================== 记忆管理器接口 ====================

/**
 * 记忆管理器接口
 * 
 * 定义记忆管理器的核心方法
 */
export interface IMemoryManager {
  // ==================== 记忆写入 ====================
  
  /**
   * 写入短期记忆（当前章节内容）
   * @param chapterId - 章节 ID
   * @param content - 章节内容
   * @param options - 写入选项
   * @returns 创建的记忆 ID
   */
  writeShortTermMemory(chapterId: string, content: string, options?: Partial<MemoryWriteOptions>): Promise<number>
  
  /**
   * 写入中期记忆（当前卷的章节）
   * @param volumeId - 卷 ID
   * @param chapters - 章节数组
   * @param options - 写入选项
   * @returns 创建的记忆 ID 数组
   */
  writeMediumTermMemory(volumeId: string, chapters: Array<{ id: string; content: string }>, options?: Partial<MemoryWriteOptions>): Promise<number[]>
  
  /**
   * 写入长期记忆（章节摘要）
   * @param chapterId - 章节 ID
   * @param summary - 章节摘要
   * @param options - 写入选项
   * @returns 创建的记忆 ID
   */
  writeLongTermMemory(chapterId: string, summary: string, options?: Partial<MemoryWriteOptions>): Promise<number>
  
  /**
   * 写入元记忆（项目创作指南）
   * @param type - 元记忆类型（'memory' | 'style' | 'character_map'）
   * @param content - 内容
   * @param options - 写入选项
   * @returns 创建的记忆 ID
   */
  writeMetaMemory(type: 'memory' | 'style' | 'character_map', content: string, options?: Partial<MemoryWriteOptions>): Promise<number>
  
  // ==================== 记忆检索 ====================
  
  /**
   * 关键字检索（使用 SQLite FTS5）
   * @param query - 检索关键字
   * @param options - 检索选项
   * @returns 匹配的记忆记录数组
   */
  searchByKeyword(query: string, options?: MemorySearchOptions): Promise<MemoryRecord[]>
  
  /**
   * 语义检索（使用向量搜索，暂未实现）
   * @param queryEmbedding - 查询向量
   * @param options - 检索选项
   * @returns 匹配的记忆记录数组
   */
  searchBySemantic(queryEmbedding: number[], options?: MemorySearchOptions): Promise<MemoryRecord[]>
  
  /**
   * 混合检索（关键字 + 语义）
   * @param query - 检索关键字
   * @param queryEmbedding - 查询向量
   * @param options - 检索选项
   * @returns 匹配的记忆记录数组
   */
  hybridSearch(query: string, queryEmbedding: number[], options?: MemorySearchOptions): Promise<MemoryRecord[]>
  
  /**
   * 根据 ID 获取记忆
   * @param id - 记忆 ID
   * @returns 记忆记录，如果不存在则返回 null
   */
  getMemoryById(id: number): Promise<MemoryRecord | null>
  
  /**
   * 获取项目所有记忆
   * @param projectId - 项目 ID
   * @param options - 检索选项
   * @returns 记忆记录数组
   */
  getMemoriesByProject(projectId: string, options?: MemorySearchOptions): Promise<MemoryRecord[]>
  
  /**
   * 获取章节所有记忆
   * @param chapterId - 章节 ID
   * @param options - 检索选项
   * @returns 记忆记录数组
   */
  getMemoriesByChapter(chapterId: string, options?: Omit<MemorySearchOptions, 'chapter_id'>): Promise<MemoryRecord[]>
  
  /**
   * 获取角色所有记忆
   * @param characterId - 角色 ID
   * @param options - 检索选项
   * @returns 记忆记录数组
   */
  getMemoriesByCharacter(characterId: string, options?: Omit<MemorySearchOptions, 'character_id'>): Promise<MemoryRecord[]>
  
  // ==================== 记忆更新 ====================
  
  /**
   * 更新记忆
   * @param id - 记忆 ID
   * @param updates - 要更新的字段
   */
  updateMemory(id: number, updates: MemoryUpdateOptions): Promise<void>
  
  /**
   * 删除记忆
   * @param id - 记忆 ID
   */
  deleteMemory(id: number): Promise<void>
  
  // ==================== 记忆管理 ====================
  
  /**
   * 压缩短期记忆（将短期记忆转换为中期记忆）
   * @param chapterId - 章节 ID
   * @param summary - 压缩后的摘要
   * @param options - 压缩选项
   */
  compressShortTermMemory(chapterId: string, summary: string, options?: MemoryCompressionOptions): Promise<void>
  
  /**
   * 压缩中期记忆（将中期记忆转换为长期记忆）
   * @param volumeId - 卷 ID
   * @param summary - 压缩后的摘要
   * @param options - 压缩选项
   */
  compressMediumTermMemory(volumeId: string, summary: string, options?: MemoryCompressionOptions): Promise<void>
  
  /**
   * 清理过期记忆
   * @param projectId - 项目 ID
   * @param options - 清理选项
   * @returns 删除的记忆数量
   */
  cleanupExpiredMemories(projectId: string, options?: MemoryCleanupOptions): Promise<number>
  
  /**
   * 记录记忆访问
   * @param memoryId - 记忆 ID
   * @param accessType - 访问类型
   * @param context - 访问上下文（可选）
   */
  logMemoryAccess(memoryId: number, accessType: AccessType, context?: Record<string, any>): Promise<void>
}

// ==================== 工具类型 ====================

/**
 * 部分记忆记录（用于创建记忆）
 */
export type PartialMemoryRecord = Partial<Omit<MemoryRecord, 'id' | 'created_at' | 'last_accessed_at' | 'access_count'>>

/**
 * 记忆过滤器（用于复杂查询）
 */
export interface MemoryFilter {
  /** 项目 ID */
  project_id?: string
  
  /** 记忆类型数组（满足其中一个即可） */
  memory_types?: MemoryType[]
  
  /** 内容类型数组（满足其中一个即可） */
  content_types?: ContentType[]
  
  /** 关联章节 ID 数组（满足其中一个即可） */
  chapter_ids?: string[]
  
  /** 关联角色 ID 数组（满足其中一个即可） */
  character_ids?: string[]
  
  /** 最小重要性 */
  min_importance?: number
  
  /** 最大重要性 */
  max_importance?: number
  
  /** 创建时间起始（时间戳，秒） */
  created_after?: number
  
  /** 创建时间结束（时间戳，秒） */
  created_before?: number
  
  /** 最后访问时间起始（时间戳，秒） */
  last_accessed_after?: number
  
  /** 最后访问时间结束（时间戳，秒） */
  last_accessed_before?: number
  
  /** 最小访问次数 */
  min_access_count?: number
  
  /** 关键字（在内容中搜索） */
  keyword?: string
}

/**
 * 记忆排序选项
 */
export interface MemorySortOptions {
  /** 排序字段 */
  sort_by?: 'importance' | 'created_at' | 'last_accessed_at' | 'access_count'
  
  /** 排序方向 */
  sort_order?: 'asc' | 'desc'
}

/**
 * 记忆分页选项
 */
export interface MemoryPaginationOptions {
  /** 限制返回数量 */
  limit?: number
  
  /** 偏移量 */
  offset?: number
}
