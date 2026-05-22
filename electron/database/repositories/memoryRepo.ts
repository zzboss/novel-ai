/**
 * 记忆数据访问层
 * 
 * 职责：
 * 1. 管理 memories 表的 CRUD 操作
 * 2. 管理 memories_fts 表的全文搜索操作
 * 3. 管理 memory_access_logs 表的访问日志记录
 * 4. 提供记忆检索接口（关键字 + 全文搜索）
 */
import type { Database } from 'sql.js'
import { queryAll, queryOne, run } from '../index'

// ==================== 类型定义 ====================

export interface MemoryRecord {
  id: number
  project_id: string
  memory_type: 'short' | 'medium' | 'long' | 'meta'
  content: string
  content_type: string
  chapter_id?: string
  character_id?: string
  importance: number  // 1-10，10 为最重要
  created_at: number
  last_accessed_at: number
  access_count: number
  metadata?: string  // JSON 字符串
}

export interface MemoryAccessLog {
  id: number
  memory_id: number
  access_type: 'read' | 'write' | 'update'
  accessed_at: number
  context?: string  // JSON 字符串
}

export interface MemorySearchOptions {
  project_id?: string
  memory_type?: 'short' | 'medium' | 'long' | 'meta'
  content_type?: string
  chapter_id?: string
  character_id?: string
  min_importance?: number
  limit?: number
  offset?: number
}

// ==================== 记忆表操作 ====================

/**
 * 创建记忆
 * @param db - 数据库对象
 * @param memory - 记忆记录
 * @returns 创建的记忆 ID
 */
export function createMemory(db: Database, memory: Omit<MemoryRecord, 'id' | 'created_at' | 'last_accessed_at' | 'access_count'>): number {
  run(db, `
    INSERT INTO memories (
      project_id, memory_type, content, content_type,
      chapter_id, character_id, importance, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    memory.project_id,
    memory.memory_type,
    memory.content,
    memory.content_type,
    memory.chapter_id || null,
    memory.character_id || null,
    memory.importance || 5,
    memory.metadata || null
  ])
  
  // 同时插入到全文搜索表
  run(db, `
    INSERT INTO memories_fts (rowid, content, content_type, chapter_id, character_id, importance)
    VALUES (last_insert_rowid(), ?, ?, ?, ?, ?)
  `, [
    memory.content,
    memory.content_type,
    memory.chapter_id || '',
    memory.character_id || '',
    memory.importance || 5
  ])
  
  // 获取最后插入的 ID
  const result = queryOne(db, `SELECT last_insert_rowid() as id`)
  return result.id
}

/**
 * 根据 ID 获取记忆
 * @param db - 数据库对象
 * @param id - 记忆 ID
 * @returns 记忆记录，如果不存在则返回 null
 */
export function getMemoryById(db: Database, id: number): MemoryRecord | null {
  const record = queryOne(db, `SELECT * FROM memories WHERE id = ?`, [id])
  return record || null
}

/**
 * 更新记忆
 * @param db - 数据库对象
 * @param id - 记忆 ID
 * @param updates - 要更新的字段
 */
export function updateMemory(db: Database, id: number, updates: Partial<Omit<MemoryRecord, 'id' | 'created_at'>>): void {
  const setClauses: string[] = []
  const params: any[] = []
  
  if (updates.memory_type !== undefined) {
    setClauses.push('memory_type = ?')
    params.push(updates.memory_type)
  }
  
  if (updates.content !== undefined) {
    setClauses.push('content = ?')
    params.push(updates.content)
    
    // 同时更新全文搜索表
    run(db, `
      UPDATE memories_fts 
      SET content = ?, content_type = ?, chapter_id = ?, character_id = ?, importance = ?
      WHERE rowid = ?
    `, [
      updates.content,
      updates.content_type || '',
      updates.chapter_id || '',
      updates.character_id || '',
      updates.importance || 5,
      id
    ])
  }
  
  if (updates.content_type !== undefined) {
    setClauses.push('content_type = ?')
    params.push(updates.content_type)
  }
  
  if (updates.chapter_id !== undefined) {
    setClauses.push('chapter_id = ?')
    params.push(updates.chapter_id)
  }
  
  if (updates.character_id !== undefined) {
    setClauses.push('character_id = ?')
    params.push(updates.character_id)
  }
  
  if (updates.importance !== undefined) {
    setClauses.push('importance = ?')
    params.push(updates.importance)
  }
  
  if (updates.metadata !== undefined) {
    setClauses.push('metadata = ?')
    params.push(updates.metadata)
  }
  
  // 总是更新 last_accessed_at
  setClauses.push('last_accessed_at = strftime(\'%s\', \'now\')')
  
  if (setClauses.length === 0) {
    return
  }
  
  params.push(id)
  run(db, `UPDATE memories SET ${setClauses.join(', ')} WHERE id = ?`, params)
}

/**
 * 删除记忆
 * @param db - 数据库对象
 * @param id - 记忆 ID
 */
export function deleteMemory(db: Database, id: number): void {
  // 先从全文搜索表中删除
  run(db, `DELETE FROM memories_fts WHERE rowid = ?`, [id])
  
  // 再从主表中删除
  run(db, `DELETE FROM memories WHERE id = ?`, [id])
}

/**
 * 记录记忆访问
 * @param db - 数据库对象
 * @param memoryId - 记忆 ID
 * @param accessType - 访问类型
 * @param context - 访问上下文（可选）
 */
export function logMemoryAccess(db: Database, memoryId: number, accessType: 'read' | 'write' | 'update', context?: string): void {
  run(db, `
    INSERT INTO memory_access_logs (memory_id, access_type, context)
    VALUES (?, ?, ?)
  `, [memoryId, accessType, context || null])
  
  // 更新记忆的访问时间和访问次数
  run(db, `
    UPDATE memories 
    SET last_accessed_at = strftime('%s', 'now'), access_count = access_count + 1
    WHERE id = ?
  `, [memoryId])
}

// ==================== 记忆检索 ====================

/**
 * 关键字检索（使用 SQLite FTS5）
 * @param db - 数据库对象
 * @param query - 检索关键字
 * @param options - 检索选项
 * @returns 匹配的记忆记录数组
 */
export function searchMemoriesByKeyword(db: Database, query: string, options?: MemorySearchOptions): MemoryRecord[] {
  let sql = `
    SELECT m.* FROM memories m
    JOIN memories_fts fts ON m.id = fts.rowid
    WHERE memories_fts MATCH ?
  `
  
  const params: any[] = [query]
  
  // 添加过滤条件
  if (options) {
    if (options.project_id) {
      sql += ` AND m.project_id = ?`
      params.push(options.project_id)
    }
    
    if (options.memory_type) {
      sql += ` AND m.memory_type = ?`
      params.push(options.memory_type)
    }
    
    if (options.content_type) {
      sql += ` AND m.content_type = ?`
      params.push(options.content_type)
    }
    
    if (options.chapter_id) {
      sql += ` AND m.chapter_id = ?`
      params.push(options.chapter_id)
    }
    
    if (options.character_id) {
      sql += ` AND m.character_id = ?`
      params.push(options.character_id)
    }
    
    if (options.min_importance) {
      sql += ` AND m.importance >= ?`
      params.push(options.min_importance)
    }
  }
  
  // 按相关性排序（FTS5 默认按 BM25 算法排序）
  sql += ` ORDER BY rank`
  
  // 添加分页
  if (options?.limit) {
    sql += ` LIMIT ?`
    params.push(options.limit)
    
    if (options.offset) {
      sql += ` OFFSET ?`
      params.push(options.offset)
    }
  }
  
  return queryAll(db, sql, params)
}

/**
 * 获取项目所有记忆
 * @param db - 数据库对象
 * @param projectId - 项目 ID
 * @param options - 检索选项
 * @returns 记忆记录数组
 */
export function getMemoriesByProject(db: Database, projectId: string, options?: MemorySearchOptions): MemoryRecord[] {
  let sql = `SELECT * FROM memories WHERE project_id = ?`
  const params: any[] = [projectId]
  
  if (options) {
    if (options.memory_type) {
      sql += ` AND memory_type = ?`
      params.push(options.memory_type)
    }
    
    if (options.content_type) {
      sql += ` AND content_type = ?`
      params.push(options.content_type)
    }
    
    if (options.chapter_id) {
      sql += ` AND chapter_id = ?`
      params.push(options.chapter_id)
    }
    
    if (options.character_id) {
      sql += ` AND character_id = ?`
      params.push(options.character_id)
    }
    
    if (options.min_importance) {
      sql += ` AND importance >= ?`
      params.push(options.min_importance)
    }
  }
  
  // 按重要性排序，然后按最后访问时间排序
  sql += ` ORDER BY importance DESC, last_accessed_at DESC`
  
  // 添加分页
  if (options?.limit) {
    sql += ` LIMIT ?`
    params.push(options.limit)
    
    if (options.offset) {
      sql += ` OFFSET ?`
      params.push(options.offset)
    }
  }
  
  return queryAll(db, sql, params)
}

/**
 * 获取章节所有记忆
 * @param db - 数据库对象
 * @param chapterId - 章节 ID
 * @param options - 检索选项
 * @returns 记忆记录数组
 */
export function getMemoriesByChapter(db: Database, chapterId: string, options?: Omit<MemorySearchOptions, 'chapter_id'>): MemoryRecord[] {
  return getMemoriesByProject(db, '', { ...options, chapter_id: chapterId })
}

/**
 * 获取角色所有记忆
 * @param db - 数据库对象
 * @param characterId - 角色 ID
 * @param options - 检索选项
 * @returns 记忆记录数组
 */
export function getMemoriesByCharacter(db: Database, characterId: string, options?: Omit<MemorySearchOptions, 'character_id'>): MemoryRecord[] {
  return getMemoriesByProject(db, '', { ...options, character_id: characterId })
}

// ==================== 记忆压缩 ====================

/**
 * 压缩短期记忆（将短期记忆转换为中期记忆）
 * @param db - 数据库对象
 * @param projectId - 项目 ID
 * @param chapterId - 章节 ID
 * @param summary - 压缩后的摘要
 */
export function compressShortTermMemory(db: Database, projectId: string, chapterId: string, summary: string): void {
  // 开始事务
  run(db, `BEGIN TRANSACTION`)
  
  try {
    // 1. 创建中期记忆（存储章节摘要）
    const summaryMemoryId = createMemory(db, {
      project_id: projectId,
      memory_type: 'medium',
      content: summary,
      content_type: 'chapter_summary',
      chapter_id: chapterId,
      importance: 7  // 章节摘要比较重要
    })
    
    // 2. 删除短期记忆（该章节的短期记忆）
    const shortTermMemories = getMemoriesByChapter(db, chapterId, { memory_type: 'short' })
    for (const memory of shortTermMemories) {
      deleteMemory(db, memory.id)
    }
    
    // 3. 记录访问日志
    logMemoryAccess(db, summaryMemoryId, 'write', JSON.stringify({ action: 'compress_short_term', chapter_id: chapterId }))
    
    // 提交事务
    run(db, `COMMIT`)
  } catch (error) {
    // 回滚事务
    run(db, `ROLLBACK`)
    throw error
  }
}

/**
 * 压缩中期记忆（将中期记忆转换为长期记忆）
 * @param db - 数据库对象
 * @param projectId - 项目 ID
 * @param volumeId - 卷 ID
 * @param summary - 压缩后的摘要
 */
export function compressMediumTermMemory(db: Database, projectId: string, volumeId: string, summary: string): void {
  // 开始事务
  run(db, `BEGIN TRANSACTION`)
  
  try {
    // 1. 创建长期记忆（存储卷摘要）
    const summaryMemoryId = createMemory(db, {
      project_id: projectId,
      memory_type: 'long',
      content: summary,
      content_type: 'volume_summary',
      importance: 8  // 卷摘要非常重要
    })
    
    // 2. 删除中期记忆（该卷的中期记忆）
    const mediumTermMemories = getMemoriesByProject(db, projectId, { memory_type: 'medium' })
    for (const memory of mediumTermMemories) {
      deleteMemory(db, memory.id)
    }
    
    // 3. 记录访问日志
    logMemoryAccess(db, summaryMemoryId, 'write', JSON.stringify({ action: 'compress_medium_term', volume_id: volumeId }))
    
    // 提交事务
    run(db, `COMMIT`)
  } catch (error) {
    // 回滚事务
    run(db, `ROLLBACK`)
    throw error
  }
}

/**
 * 清理过期记忆
 * @param db - 数据库对象
 * @param projectId - 项目 ID
 * @param maxAgeDays - 最大年龄（天），超过这个年龄的记忆将被删除
 * @param maxCount - 最大记忆数量，超过这个数量的记忆将被删除（按最后访问时间排序）
 */
export function cleanupExpiredMemories(db: Database, projectId: string, maxAgeDays?: number, maxCount?: number): number {
  let deletedCount = 0
  
  // 按年龄清理
  if (maxAgeDays) {
    const result = queryOne(db, `
      SELECT COUNT(*) as count FROM memories 
      WHERE project_id = ? AND last_accessed_at < strftime('%s', 'now') - ?
    `, [projectId, maxAgeDays * 24 * 60 * 60])
    
    deletedCount += result.count
    
    // 删除过期记忆
    const expiredMemories = queryAll(db, `
      SELECT id FROM memories 
      WHERE project_id = ? AND last_accessed_at < strftime('%s', 'now') - ?
    `, [projectId, maxAgeDays * 24 * 60 * 60])
    
    for (const memory of expiredMemories) {
      deleteMemory(db, memory.id)
    }
  }
  
  // 按数量清理
  if (maxCount) {
    const totalCount = queryOne(db, `SELECT COUNT(*) as count FROM memories WHERE project_id = ?`, [projectId])
    
    if (totalCount.count > maxCount) {
      const memoriesToDelete = queryAll(db, `
        SELECT id FROM memories 
        WHERE project_id = ? 
        ORDER BY importance ASC, last_accessed_at ASC 
        LIMIT ?
      `, [projectId, totalCount.count - maxCount])
      
      for (const memory of memoriesToDelete) {
        deleteMemory(db, memory.id)
        deletedCount++
      }
    }
  }
  
  return deletedCount
}
