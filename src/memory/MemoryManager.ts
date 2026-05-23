/**
 * 记忆管理器
 * 
 * 职责：
 * 1. 管理四层记忆的读写（短期/中期/长期/元记忆）
 * 2. 提供记忆检索接口（关键字 + 语义 + 混合）
 * 3. 管理记忆的过期和压缩
 * 4. 提供记忆导入/导出接口
 * 5. 集成 Chroma 向量数据库
 */

import { Database } from 'sql.js'
import ChromaClientManager, { 
  getOrCreateCollection, 
  addVectors, 
  queryVectors, 
  deleteVectors,
  CHROMA_COLLECTION_SCHEMA 
} from './ChromaClient'

// ============================================================
// 类型定义
// ============================================================

export type MemoryType = 'short' | 'medium' | 'long' | 'meta'
export type ContentType = 'chapter' | 'character' | 'world' | 'dialogue' | 'event' | 'summary'

export interface MemoryRecord {
  id: string
  projectId: string
  memoryType: MemoryType
  contentType: ContentType
  content: string
  chapterId?: string
  characterId?: string
  importance: number  // 1-10，10 为最重要
  embedding?: number[]  // 向量表示
  metadata?: Record<string, any>
  createdAt: number
  lastAccessedAt: number
}

export interface SearchOptions {
  projectId?: string
  memoryType?: MemoryType | MemoryType[]
  contentType?: ContentType | ContentType[]
  chapterId?: string
  characterId?: string
  minImportance?: number
  maxResults?: number
  includeEmbeddings?: boolean
}

export interface MemoryManagerOptions {
  embeddingDimension?: number  // 向量维度，默认 1536 (OpenAI text-embedding-ada-002)
  lruCacheSize?: number  // LRU 缓存大小，默认 100
  enableAutoCompression?: boolean  // 是否启用自动压缩，默认 true
  compressionThreshold?: number  // 压缩阈值（记忆数量），默认 1000
}

// ============================================================
// 核心类定义
// ============================================================

/**
 * 记忆管理器
 */
export class MemoryManager {
  private db: Database
  private chromaManager: ChromaClientManager
  private chromaCollections: Map<string, any> = new Map()
  private cache: Map<string, MemoryRecord>
  private options: Required<MemoryManagerOptions>
  private isInitialized: boolean = false

  constructor(
    db: Database, 
    chromaManager: ChromaClientManager, 
    options?: MemoryManagerOptions
  ) {
    this.db = db
    this.chromaManager = chromaManager
    this.options = {
      embeddingDimension: 1536,
      lruCacheSize: 100,
      enableAutoCompression: true,
      compressionThreshold: 1000,
      ...options,
    }
    this.cache = new Map()
  }

  /**
   * 初始化记忆管理器
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    // 确保 Chroma 客户端已初始化
    if (!this.chromaManager.isReady()) {
      await this.chromaManager.initialize()
    }

    // 初始化 Chroma 集合
    for (const [key, name] of Object.entries(CHROMA_COLLECTION_SCHEMA)) {
      const collection = await getOrCreateCollection(this.chromaManager, name, {
        description: `${key} collection for novel writing`,
      })
      this.chromaCollections.set(key, collection)
    }

    // 确保数据库表存在
    this.ensureTablesExist()

    this.isInitialized = true
    console.log('[MemoryManager] Initialized successfully')
  }

  /**
   * 确保数据库表存在
   */
  private ensureTablesExist(): void {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        memory_type TEXT NOT NULL,
        content_type TEXT NOT NULL,
        content TEXT NOT NULL,
        chapter_id TEXT,
        character_id TEXT,
        importance INTEGER DEFAULT 5,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        last_accessed_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `
    
    const createIndexesSQL = [
      `CREATE INDEX IF NOT EXISTS idx_memories_project_id ON memories(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_memories_memory_type ON memories(memory_type)`,
      `CREATE INDEX IF NOT EXISTS idx_memories_content_type ON memories(content_type)`,
      `CREATE INDEX IF NOT EXISTS idx_memories_chapter_id ON memories(chapter_id)`,
      `CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance)`,
      `CREATE INDEX IF NOT EXISTS idx_memories_last_accessed ON memories(last_accessed_at)`,
    ]

    this.db.exec(createTableSQL)
    for (const sql of createIndexesSQL) {
      this.db.exec(sql)
    }
  }

  // ==================== 记忆写入 ====================

  /**
   * 写入短期记忆（当前章节内容）
   */
  async writeShortTermMemory(
    projectId: string,
    chapterId: string,
    content: string,
    embedding?: number[],
    metadata?: Record<string, any>
  ): Promise<string> {
    const id = `short_${chapterId}_${Date.now()}`
    const now = Date.now()
    
    // 写入数据库
    const stmt = this.db.prepare(`
      INSERT INTO memories (id, project_id, memory_type, content_type, content, chapter_id, importance, metadata, created_at, last_accessed_at)
      VALUES (?, ?, 'short', 'chapter', ?, ?, 8, ?, ?, ?)
    `)
    stmt.run([id, projectId, content, chapterId, JSON.stringify(metadata || {}), now, now])
    stmt.free()

    // 写入 Chroma（如果有向量）
    if (embedding && this.chromaCollections.has('MEMORIES')) {
      const collection = this.chromaCollections.get('MEMORIES')
      await addVectors(
        collection,
        [id],
        [embedding],
        [{
          memory_id: id,
          project_id: projectId,
          memory_type: 'short',
          content_type: 'chapter',
          chapter_id: chapterId,
          importance: 8,
          created_at: now,
          last_accessed_at: now,
        }],
        [content]
      )
    }

    // 更新缓存
    this.cache.set(id, {
      id,
      projectId,
      memoryType: 'short',
      contentType: 'chapter',
      content,
      chapterId,
      importance: 8,
      embedding,
      metadata,
      createdAt: now,
      lastAccessedAt: now,
    })

    // 检查是否需要自动压缩
    if (this.options.enableAutoCompression) {
      const count = this.countMemories(projectId, 'short')
      if (count > this.options.compressionThreshold) {
        await this.compressShortTermMemory(chapterId)
      }
    }

    return id
  }

  /**
   * 写入中期记忆（当前卷的章节）
   */
  async writeMediumTermMemory(
    projectId: string,
    volumeId: string,
    chapters: Array<{ id: string; title: string; content: string }>,
    embeddings?: number[][],
  ): Promise<string[]> {
    const ids: string[] = []
    const now = Date.now()

    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i]
      const id = `medium_${chapter.id}_${now}`
      ids.push(id)

      // 写入数据库
      const stmt = this.db.prepare(`
        INSERT INTO memories (id, project_id, memory_type, content_type, content, chapter_id, importance, metadata, created_at, last_accessed_at)
        VALUES (?, ?, 'medium', 'chapter', ?, ?, 6, ?, ?, ?)
      `)
      stmt.run([id, projectId, chapter.content, chapter.id, JSON.stringify({ title: chapter.title }), now, now])
      stmt.free()

      // 写入 Chroma（如果有向量）
      if (embeddings && embeddings[i] && this.chromaCollections.has('MEMORIES')) {
        const collection = this.chromaCollections.get('MEMORIES')
        await addVectors(
          collection,
          [id],
          [embeddings[i]],
          [{
            memory_id: id,
            project_id: projectId,
            memory_type: 'medium',
            content_type: 'chapter',
            chapter_id: chapter.id,
            importance: 6,
            created_at: now,
            last_accessed_at: now,
          }],
          [chapter.content]
        )
      }

      // 更新缓存
      this.cache.set(id, {
        id,
        projectId,
        memoryType: 'medium',
        contentType: 'chapter',
        content: chapter.content,
        chapterId: chapter.id,
        importance: 6,
        embedding: embeddings?.[i],
        metadata: { title: chapter.title },
        createdAt: now,
        lastAccessedAt: now,
      })
    }

    return ids
  }

  /**
   * 写入长期记忆（章节摘要 + 向量索引）
   */
  async writeLongTermMemory(
    projectId: string,
    chapterId: string,
    summary: string,
    embedding: number[],
    metadata?: Record<string, any>
  ): Promise<string> {
    const id = `long_${chapterId}_${Date.now()}`
    const now = Date.now()

    // 写入数据库
    const stmt = this.db.prepare(`
      INSERT INTO memories (id, project_id, memory_type, content_type, content, chapter_id, importance, metadata, created_at, last_accessed_at)
      VALUES (?, ?, 'long', 'summary', ?, ?, 7, ?, ?, ?)
    `)
    stmt.run([id, projectId, summary, chapterId, JSON.stringify(metadata || {}), now, now])
    stmt.free()

    // 写入 Chroma（必须有向量）
    if (this.chromaCollections.has('MEMORIES')) {
      const collection = this.chromaCollections.get('MEMORIES')
      await addVectors(
        collection,
        [id],
        [embedding],
        [{
          memory_id: id,
          project_id: projectId,
          memory_type: 'long',
          content_type: 'summary',
          chapter_id: chapterId,
          importance: 7,
          created_at: now,
          last_accessed_at: now,
        }],
        [summary]
      )
    }

    // 更新缓存
    this.cache.set(id, {
      id,
      projectId,
      memoryType: 'long',
      contentType: 'summary',
      content: summary,
      chapterId,
      importance: 7,
      embedding,
      metadata,
      createdAt: now,
      lastAccessedAt: now,
    })

    return id
  }

  /**
   * 写入元记忆（项目创作指南）
   */
  async writeMetaMemory(
    projectId: string,
    type: 'memory' | 'style' | 'character_map',
    content: string,
    metadata?: Record<string, any>
  ): Promise<string> {
    const id = `meta_${type}_${Date.now()}`
    const now = Date.now()

    // 写入数据库
    const stmt = this.db.prepare(`
      INSERT INTO memories (id, project_id, memory_type, content_type, content, importance, metadata, created_at, last_accessed_at)
      VALUES (?, ?, 'meta', ?, ?, 9, ?, ?, ?)
    `)
    stmt.run([id, projectId, type, content, JSON.stringify(metadata || {}), now, now])
    stmt.free()

    // 元记忆通常不写入 Chroma（除非需要语义搜索）

    // 更新缓存
    this.cache.set(id, {
      id,
      projectId,
      memoryType: 'meta',
      contentType: type as any,
      content,
      importance: 9,
      metadata,
      createdAt: now,
      lastAccessedAt: now,
    })

    return id
  }

  // ==================== 记忆检索 ====================

  /**
   * 关键字检索（使用 SQL LIKE）
   */
  async searchByKeyword(
    query: string,
    options?: SearchOptions
  ): Promise<MemoryRecord[]> {
    const opts = this.getDefaultOptions(options)
    
    let sql = `
      SELECT * FROM memories 
      WHERE content LIKE ?
    `
    const params: any[] = [`%${query}%`]

    // 添加过滤条件
    if (opts.projectId) {
      sql += ` AND project_id = ?`
      params.push(opts.projectId)
    }
    if (opts.memoryType) {
      const types = Array.isArray(opts.memoryType) ? opts.memoryType : [opts.memoryType]
      sql += ` AND memory_type IN (${types.map(() => '?').join(',')})`
      params.push(...types)
    }
    if (opts.contentType) {
      const types = Array.isArray(opts.contentType) ? opts.contentType : [opts.contentType]
      sql += ` AND content_type IN (${types.map(() => '?').join(',')})`
      params.push(...types)
    }
    if (opts.chapterId) {
      sql += ` AND chapter_id = ?`
      params.push(opts.chapterId)
    }
    if (opts.characterId) {
      sql += ` AND character_id = ?`
      params.push(opts.characterId)
    }
    if (opts.minImportance) {
      sql += ` AND importance >= ?`
      params.push(opts.minImportance)
    }

    // 排序和限制
    sql += ` ORDER BY importance DESC, last_accessed_at DESC`
    if (opts.maxResults) {
      sql += ` LIMIT ?`
      params.push(opts.maxResults)
    }

    const stmt = this.db.prepare(sql)
    const results = stmt.exec(params)
    stmt.free()

    // 转换为 MemoryRecord 数组
    return results.map(row => this.rowToMemoryRecord(row))
  }

  /**
   * 语义检索（使用 Chroma 向量搜索）
   */
  async searchBySemantic(
    queryEmbedding: number[],
    options?: SearchOptions
  ): Promise<MemoryRecord[]> {
    if (!this.chromaCollections.has('MEMORIES')) {
      throw new Error('Chroma memories 集合未初始化')
    }

    const opts = this.getDefaultOptions(options)
    const collection = this.chromaCollections.get('MEMORIES')

    // 构建 where 条件
    const where: Record<string, any> = {}
    if (opts.projectId) {
      where.project_id = opts.projectId
    }
    if (opts.memoryType) {
      const types = Array.isArray(opts.memoryType) ? opts.memoryType : [opts.memoryType]
      where.memory_type = { '$in': types }
    }
    if (opts.contentType) {
      const types = Array.isArray(opts.contentType) ? opts.contentType : [opts.contentType]
      where.content_type = { '$in': types }
    }
    if (opts.chapterId) {
      where.chapter_id = opts.chapterId
    }
    if (opts.characterId) {
      where.character_id = opts.characterId
    }
    if (opts.minImportance) {
      where.importance = { '$gte': opts.minImportance }
    }

    // 查询 Chroma
    const results = await queryVectors(
      collection,
      [queryEmbedding],
      opts.maxResults || 10,
      Object.keys(where).length > 0 ? where : undefined
    )

    // 将结果转换为 MemoryRecord 数组
    const records: MemoryRecord[] = []
    if (results.ids && results.ids[0]) {
      for (let i = 0; i < results.ids[0].length; i++) {
        const id = results.ids[0][i]
        
        // 从缓存获取，如果未命中则从数据库加载
        let record = this.cache.get(id)
        if (!record) {
          record = await this.getMemoryById(id)
        }
        
        if (record) {
          // 更新向量（如果请求）
          if (opts.includeEmbeddings && results.embeddings && results.embeddings[0]) {
            record.embedding = results.embeddings[0][i]
          }
          records.push(record)
        }
      }
    }

    return records
  }

  /**
   * 混合检索（关键字 + 语义）
   */
  async hybridSearch(
    query: string,
    queryEmbedding: number[],
    options?: SearchOptions
  ): Promise<MemoryRecord[]> {
    const opts = this.getDefaultOptions(options)
    
    // 并行执行关键字检索和语义检索
    const [keywordResults, semanticResults] = await Promise.all([
      this.searchByKeyword(query, { ...opts, maxResults: opts.maxResults ? opts.maxResults * 2 : 20 }),
      this.searchBySemantic(queryEmbedding, { ...opts, maxResults: opts.maxResults ? opts.maxResults * 2 : 20 }),
    ])

    // 合并结果（去重）
    const mergedMap = new Map<string, MemoryRecord>()
    
    // 关键字结果权重：1.0
    for (const record of keywordResults) {
      record.metadata = { ...record.metadata, hybridScore: 1.0 }
      mergedMap.set(record.id, record)
    }
    
    // 语义结果权重：1.5（语义匹配更重要）
    for (const record of semanticResults) {
      if (mergedMap.has(record.id)) {
        // 已存在，提高分数
        const existing = mergedMap.get(record.id)!
        existing.metadata = { 
          ...existing.metadata, 
          hybridScore: (existing.metadata?.hybridScore || 1.0) + 1.5 
        }
      } else {
        record.metadata = { ...record.metadata, hybridScore: 1.5 }
        mergedMap.set(record.id, record)
      }
    }

    // 按混合分数排序
    const merged = Array.from(mergedMap.values())
    merged.sort((a, b) => {
      const scoreA = a.metadata?.hybridScore || 0
      const scoreB = b.metadata?.hybridScore || 0
      return scoreB - scoreA
    })

    // 限制结果数量
    if (opts.maxResults && merged.length > opts.maxResults) {
      return merged.slice(0, opts.maxResults)
    }

    return merged
  }

  // ==================== 记忆管理 ====================

  /**
   * 压缩短期记忆（将当前章节内容压缩为章节摘要，移入长期记忆）
   */
  async compressShortTermMemory(chapterId: string): Promise<void> {
    // 获取短期记忆
    const shortMemories = await this.searchByKeyword('', {
      chapterId,
      memoryType: 'short',
    })

    if (shortMemories.length === 0) {
      return
    }

    // 合并内容
    const mergedContent = shortMemories.map(m => m.content).join('\n')

    // 生成摘要（这里需要调用 LLM，暂时用简单截断代替）
    const summary = mergedContent.length > 500 
      ? mergedContent.substring(0, 500) + '...' 
      : mergedContent

    // 生成向量（这里需要调用 Embedding API，暂时用空数组代替）
    const embedding: number[] = []  // TODO: 调用 Embedding API

    // 写入长期记忆
    const projectId = shortMemories[0].projectId
    await this.writeLongTermMemory(projectId, chapterId, summary, embedding, {
      compressedFrom: shortMemories.map(m => m.id),
    })

    // 删除短期记忆
    for (const memory of shortMemories) {
      await this.deleteMemory(memory.id)
    }

    console.log(`[MemoryManager] Compressed ${shortMemories.length} short-term memories into long-term memory for chapter ${chapterId}`)
  }

  /**
   * 删除记忆
   */
  async deleteMemory(id: string): Promise<void> {
    // 从数据库删除
    const stmt = this.db.prepare(`DELETE FROM memories WHERE id = ?`)
    stmt.run([id])
    stmt.free()

    // 从 Chroma 删除
    if (this.chromaCollections.has('MEMORIES')) {
      const collection = this.chromaCollections.get('MEMORIES')
      await deleteVectors(collection, [id])
    }

    // 从缓存删除
    this.cache.delete(id)
  }

  /**
   * 更新记忆的最后访问时间
   */
  async updateLastAccessed(id: string): Promise<void> {
    const now = Date.now()
    
    // 更新数据库
    const stmt = this.db.prepare(`UPDATE memories SET last_accessed_at = ? WHERE id = ?`)
    stmt.run([now, id])
    stmt.free()

    // 更新缓存
    const cached = this.cache.get(id)
    if (cached) {
      cached.lastAccessedAt = now
    }
  }

  // ==================== 辅助方法 ====================

  /**
   * 获取默认选项
   */
  private getDefaultOptions(options?: SearchOptions): Required<SearchOptions> {
    return {
      projectId: '',
      memoryType: undefined,
      contentType: undefined,
      chapterId: undefined,
      characterId: undefined,
      minImportance: 0,
      maxResults: 10,
      includeEmbeddings: false,
      ...options,
    }
  }

  /**
   * 将数据库行转换为 MemoryRecord
   */
  private rowToMemoryRecord(row: any): MemoryRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      memoryType: row.memory_type as MemoryType,
      contentType: row.content_type as ContentType,
      content: row.content,
      chapterId: row.chapter_id,
      characterId: row.character_id,
      importance: row.importance,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at,
      lastAccessedAt: row.last_accessed_at,
    }
  }

  /**
   * 根据 ID 获取记忆
   */
  private async getMemoryById(id: string): Promise<MemoryRecord | null> {
    const stmt = this.db.prepare(`SELECT * FROM memories WHERE id = ?`)
    const result = stmt.exec([id])
    stmt.free()

    if (result.length === 0) {
      return null
    }

    return this.rowToMemoryRecord(result[0])
  }

  /**
   * 计算记忆数量
   */
  private countMemories(projectId: string, memoryType: MemoryType): number {
    const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM memories WHERE project_id = ? AND memory_type = ?`)
    const result = stmt.exec([projectId, memoryType])
    stmt.free()

    return result[0]?.count || 0
  }
}

// ============================================================
// 导出
// ============================================================

export default MemoryManager
