/**
 * 记忆管理系统单元测试
 * 
 * 测试 MemoryManager 和 memoryRepo 的功能
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MemoryManager } from '../MemoryManager'
import { 
  createMemory, 
  getMemoryById, 
  updateMemory, 
  deleteMemory, 
  logMemoryAccess,
  searchMemoriesByKeyword,
  getMemoriesByProject,
  getMemoriesByChapter,
  getMemoriesByCharacter,
  compressShortTermMemory,
  compressMediumTermMemory,
  cleanupExpiredMemories
} from '../../../electron/database/repositories/memoryRepo'
import initSqlJs, { type Database } from 'sql.js'

// ==================== 测试夹具 ====================

/**
 * 创建内存数据库 for 测试
 */
async function createTestDatabase(): Promise<Database> {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  
  // 创建测试表
  db.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
    
    CREATE TABLE chapters (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL
    );
    
    CREATE TABLE characters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
    
    CREATE TABLE memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      memory_type TEXT NOT NULL CHECK(memory_type IN ('short', 'medium', 'long', 'meta')),
      content TEXT NOT NULL,
      content_type TEXT NOT NULL,
      chapter_id TEXT,
      character_id TEXT,
      importance INTEGER NOT NULL DEFAULT 5,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      last_accessed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      access_count INTEGER NOT NULL DEFAULT 0,
      metadata TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (chapter_id) REFERENCES chapters(id),
      FOREIGN KEY (character_id) REFERENCES characters(id)
    );
    
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      content,
      content_type,
      chapter_id,
      character_id,
      importance
    );
    
    CREATE TABLE memory_access_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      memory_id INTEGER NOT NULL,
      access_type TEXT NOT NULL CHECK(access_type IN ('read', 'write', 'update')),
      accessed_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      context TEXT,
      FOREIGN KEY (memory_id) REFERENCES memories(id)
    );
    
    CREATE INDEX idx_memories_project_id ON memories(project_id);
    CREATE INDEX idx_memories_memory_type ON memories(memory_type);
    CREATE INDEX idx_memories_content_type ON memories(content_type);
    CREATE INDEX idx_memories_chapter_id ON memories(chapter_id);
    CREATE INDEX idx_memories_character_id ON memories(character_id);
    CREATE INDEX idx_memories_importance ON memories(importance);
    CREATE INDEX idx_memories_last_accessed ON memories(last_accessed_at);
    CREATE INDEX idx_memory_access_logs_memory_id ON memory_access_logs(memory_id);
  `)
  
  // 插入测试数据
  db.exec(`
    INSERT INTO projects (id, name) VALUES ('project1', '测试项目');
    INSERT INTO chapters (id, title) VALUES ('chapter1', '第一章');
    INSERT INTO chapters (id, title) VALUES ('chapter2', '第二章');
    INSERT INTO characters (id, name) VALUES ('char1', '张三');
    INSERT INTO characters (id, name) VALUES ('char2', '李四');
  `)
  
  return db
}

/**
 * 创建测试用 MemoryManager 实例
 */
function createTestMemoryManager(db: Database): MemoryManager {
  return new MemoryManager(db, 'project1')
}

// ==================== 测试用例 ====================

describe('记忆管理系统', () => {
  let db: Database
  let memoryManager: MemoryManager
  
  beforeEach(async () => {
    db = await createTestDatabase()
    memoryManager = createTestMemoryManager(db)
  })
  
  afterEach(() => {
    db.close()
  })
  
  // ==================== 记忆写入测试 ====================
  
  describe('记忆写入', () => {
    it('应该成功写入短期记忆', async () => {
      const memoryId = await memoryManager.writeShortTermMemory(
        'chapter1',
        '这是第一章的内容，讲述了张三的冒险故事。',
        { importance: 3 }
      )
      
      expect(memoryId).toBeDefined()
      expect(typeof memoryId).toBe('number')
      
      // 验证记忆已写入数据库
      const memory = getMemoryById(db, memoryId)
      expect(memory).not.toBeNull()
      expect(memory?.memory_type).toBe('short')
      expect(memory?.content).toBe('这是第一章的内容，讲述了张三的冒险故事。')
      expect(memory?.importance).toBe(3)
    })
    
    it('应该成功写入中期记忆', async () => {
      const memoryIds = await memoryManager.writeMediumTermMemory(
        'volume1',
        [
          { id: 'chapter1', content: '第一章内容' },
          { id: 'chapter2', content: '第二章内容' }
        ],
        { importance: 7 }
      )
      
      expect(memoryIds).toHaveLength(2)
      
      // 验证记忆已写入数据库
      for (const memoryId of memoryIds) {
        const memory = getMemoryById(db, memoryId)
        expect(memory).not.toBeNull()
        expect(memory?.memory_type).toBe('medium')
        expect(memory?.importance).toBe(7)
      }
    })
    
    it('应该成功写入长期记忆', async () => {
      const memoryId = await memoryManager.writeLongTermMemory(
        'chapter1',
        '第一章摘要：张三开始了他的冒险之旅，遇到了李四。',
        { importance: 8 }
      )
      
      expect(memoryId).toBeDefined()
      
      // 验证记忆已写入数据库
      const memory = getMemoryById(db, memoryId)
      expect(memory).not.toBeNull()
      expect(memory?.memory_type).toBe('long')
      expect(memory?.content_type).toBe('chapter_summary')
      expect(memory?.importance).toBe(8)
    })
    
    it('应该成功写入元记忆', async () => {
      const memoryId = await memoryManager.writeMetaMemory(
        'memory',
        '# 项目创作指南\n\n这是一个测试项目。',
        { importance: 9 }
      )
      
      expect(memoryId).toBeDefined()
      
      // 验证记忆已写入数据库
      const memory = getMemoryById(db, memoryId)
      expect(memory).not.toBeNull()
      expect(memory?.memory_type).toBe('meta')
      expect(memory?.content_type).toBe('memory')
      expect(memory?.importance).toBe(9)
    })
  })
  
  // ==================== 记忆检索测试 ====================
  
  describe('记忆检索', () => {
    beforeEach(async () => {
      // 插入测试记忆数据
      await memoryManager.writeShortTermMemory(
        'chapter1',
        '张三来到了神秘森林，遇到了李四。',
        { importance: 3 }
      )
      
      await memoryManager.writeShortTermMemory(
        'chapter2',
        '李四告诉张三关于魔法宝石的秘密。',
        { importance: 4 }
      )
      
      await memoryManager.writeLongTermMemory(
        'chapter1',
        '第一章摘要：张三在森林中遇到了李四，得知了魔法宝石的秘密。',
        { importance: 8 }
      )
    })
    
    it('应该通过关键字检索记忆', async () => {
      const results = await memoryManager.searchByKeyword('张三')
      
      expect(results.length).toBeGreaterThan(0)
      expect(results.some(r => r.content.includes('张三'))).toBe(true)
    })
    
    it('应该通过 ID 获取记忆', async () => {
      // 先写入一个记忆
      const memoryId = await memoryManager.writeShortTermMemory(
        'chapter1',
        '测试内容',
        { importance: 5 }
      )
      
      // 通过 ID 获取
      const memory = await memoryManager.getMemoryById(memoryId)
      
      expect(memory).not.toBeNull()
      expect(memory?.id).toBe(memoryId)
      expect(memory?.content).toBe('测试内容')
    })
    
    it('应该获取项目所有记忆', async () => {
      const memories = await memoryManager.getMemoriesByProject('project1')
      
      expect(memories.length).toBeGreaterThan(0)
      expect(memories.every(m => m.project_id === 'project1')).toBe(true)
    })
    
    it('应该获取章节所有记忆', async () => {
      const memories = await memoryManager.getMemoriesByChapter('chapter1')
      
      expect(memories.length).toBeGreaterThan(0)
      expect(memories.every(m => m.chapter_id === 'chapter1')).toBe(true)
    })
    
    it('应该获取角色所有记忆', async () => {
      // 先写入一个与角色相关的记忆
      await memoryManager.writeShortTermMemory(
        'chapter1',
        '张三和李四的对话。',
        { character_id: 'char1', importance: 5 }
      )
      
      const memories = await memoryManager.getMemoriesByCharacter('char1')
      
      expect(memories.length).toBeGreaterThan(0)
      expect(memories.every(m => m.character_id === 'char1')).toBe(true)
    })
  })
  
  // ==================== 记忆更新测试 ====================
  
  describe('记忆更新', () => {
    it('应该成功更新记忆', async () => {
      // 先写入一个记忆
      const memoryId = await memoryManager.writeShortTermMemory(
        'chapter1',
        '原始内容',
        { importance: 5 }
      )
      
      // 更新记忆
      await memoryManager.updateMemory(memoryId, {
        content: '更新后的内容',
        importance: 8
      })
      
      // 验证更新
      const memory = await memoryManager.getMemoryById(memoryId)
      expect(memory?.content).toBe('更新后的内容')
      expect(memory?.importance).toBe(8)
    })
    
    it('应该成功删除记忆', async () => {
      // 先写入一个记忆
      const memoryId = await memoryManager.writeShortTermMemory(
        'chapter1',
        '要删除的内容',
        { importance: 5 }
      )
      
      // 删除记忆
      await memoryManager.deleteMemory(memoryId)
      
      // 验证删除
      const memory = await memoryManager.getMemoryById(memoryId)
      expect(memory).toBeNull()
    })
  })
  
  // ==================== 记忆压缩测试 ====================
  
  describe('记忆压缩', () => {
    it('应该成功压缩短期记忆', async () => {
      // 先写入短期记忆
      await memoryManager.writeShortTermMemory(
        'chapter1',
        '这是第一章的详细内容，包含了很多细节。',
        { importance: 3 }
      )
      
      // 压缩短期记忆
      await memoryManager.compressShortTermMemory(
        'chapter1',
        '第一章摘要：张三开始了冒险。',
        { compressed_importance: 7 }
      )
      
      // 验证中期记忆已创建
      const mediumTermMemories = await memoryManager.getMemoriesByChapter('chapter1', { memory_type: 'medium' })
      expect(mediumTermMemories.length).toBeGreaterThan(0)
      
      // 验证短期记忆已删除
      const shortTermMemories = await memoryManager.getMemoriesByChapter('chapter1', { memory_type: 'short' })
      expect(shortTermMemories.length).toBe(0)
    })
    
    it('应该成功压缩中期记忆', async () => {
      // 先写入中期记忆
      await memoryManager.writeMediumTermMemory(
        'volume1',
        [
          { id: 'chapter1', content: '第一章内容' },
          { id: 'chapter2', content: '第二章内容' }
        ],
        { importance: 7 }
      )
      
      // 压缩中期记忆
      await memoryManager.compressMediumTermMemory(
        'volume1',
        '第一卷摘要：张三和李四的冒险。',
        { compressed_importance: 8 }
      )
      
      // 验证长期记忆已创建
      const longTermMemories = await memoryManager.getMemoriesByProject('project1', { memory_type: 'long' })
      expect(longTermMemories.length).toBeGreaterThan(0)
      
      // 验证中期记忆已删除
      const mediumTermMemories = await memoryManager.getMemoriesByProject('project1', { memory_type: 'medium' })
      expect(mediumTermMemories.length).toBe(0)
    })
  })
  
  // ==================== 记忆清理测试 ====================
  
  describe('记忆清理', () => {
    it('应该成功清理过期记忆', async () => {
      // 先写入一些记忆
      await memoryManager.writeShortTermMemory(
        'chapter1',
        '即将过期的记忆',
        { importance: 2 }
      )
      
      // 清理过期记忆（设置 max_age_days 为 0，使刚创建的记忆过期）
      const deletedCount = await memoryManager.cleanupExpiredMemories(
        'project1',
        { max_age_days: 0, max_count: 1000 }
      )
      
      // 验证清理
      expect(deletedCount).toBeGreaterThan(0)
    })
    
    it('应该成功清理低重要性记忆', async () => {
      // 先写入一些低重要性的记忆
      for (let i = 0; i < 10; i++) {
        await memoryManager.writeShortTermMemory(
          `chapter${i}`,
          `低重要性记忆 ${i}`,
          { importance: 1 }
        )
      }
      
      // 清理低重要性记忆
      const deletedCount = await memoryManager.cleanupExpiredMemories(
        'project1',
        { max_count: 5, cleanup_low_importance: true, low_importance_threshold: 3 }
      )
      
      // 验证清理
      expect(deletedCount).toBeGreaterThan(0)
    })
  })
  
  // ==================== 记忆访问日志测试 ====================
  
  describe('记忆访问日志', () => {
    it('应该成功记录记忆访问', async () => {
      // 先写入一个记忆
      const memoryId = await memoryManager.writeShortTermMemory(
        'chapter1',
        '测试内容',
        { importance: 5 }
      )
      
      // 记录访问日志
      await memoryManager.logMemoryAccess(memoryId, 'read', { action: 'test' })
      
      // 验证访问日志已记录
      const logs = db.exec(`
        SELECT * FROM memory_access_logs WHERE memory_id = ${memoryId}
      `)
      
      expect(logs.length).toBeGreaterThan(0)
    })
  })
})

// ==================== 数据访问层单元测试 ====================

describe('memoryRepo 数据访问层', () => {
  let db: Database
  
  beforeEach(async () => {
    db = await createTestDatabase()
  })
  
  afterEach(() => {
    db.close()
  })
  
  it('应该成功创建记忆', () => {
    const memoryId = createMemory(db, {
      project_id: 'project1',
      memory_type: 'short',
      content: '测试内容',
      content_type: 'chapter',
      chapter_id: 'chapter1',
      importance: 5
    })
    
    expect(memoryId).toBeDefined()
    expect(typeof memoryId).toBe('number')
  })
  
  it('应该成功获取记忆 by ID', () => {
    const memoryId = createMemory(db, {
      project_id: 'project1',
      memory_type: 'short',
      content: '测试内容',
      content_type: 'chapter',
      importance: 5
    })
    
    const memory = getMemoryById(db, memoryId)
    
    expect(memory).not.toBeNull()
    expect(memory?.id).toBe(memoryId)
  })
  
  it('应该成功更新记忆', () => {
    const memoryId = createMemory(db, {
      project_id: 'project1',
      memory_type: 'short',
      content: '原始内容',
      content_type: 'chapter',
      importance: 5
    })
    
    updateMemory(db, memoryId, {
      content: '更新后的内容',
      importance: 8
    })
    
    const memory = getMemoryById(db, memoryId)
    expect(memory?.content).toBe('更新后的内容')
    expect(memory?.importance).toBe(8)
  })
  
  it('应该成功删除记忆', () => {
    const memoryId = createMemory(db, {
      project_id: 'project1',
      memory_type: 'short',
      content: '要删除的内容',
      content_type: 'chapter',
      importance: 5
    })
    
    deleteMemory(db, memoryId)
    
    const memory = getMemoryById(db, memoryId)
    expect(memory).toBeNull()
  })
  
  it('应该成功通过关键字检索记忆', () => {
    // 插入测试数据
    createMemory(db, {
      project_id: 'project1',
      memory_type: 'short',
      content: '张三和李四的故事',
      content_type: 'chapter',
      importance: 5
    })
    
    createMemory(db, {
      project_id: 'project1',
      memory_type: 'short',
      content: '王五的冒险',
      content_type: 'chapter',
      importance: 5
    })
    
    // 关键字检索
    const results = searchMemoriesByKeyword(db, '张三')
    
    expect(results.length).toBeGreaterThan(0)
    expect(results.some(r => r.content.includes('张三'))).toBe(true)
  })
})
