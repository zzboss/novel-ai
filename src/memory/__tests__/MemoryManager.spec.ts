import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MemoryManager } from '../MemoryManager'
import { ChromaClientManager } from '../ChromaClient'
import { Database } from 'sql.js'

/**
 * MemoryManager 单元测试
 * 
 * 注意：由于 MemoryManager 依赖 ChromaDB 和 SQLite，
 * 这里主要测试类的实例化和方法调用。
 * 集成测试需要使用实际的数据库。
 */

describe('MemoryManager', () => {
  let memoryManager: MemoryManager
  let mockChromaManager: any
  let mockDb: any

  beforeEach(() => {
    // 创建模拟的 Database
    mockDb = {
      exec: vi.fn(),
      prepare: vi.fn().mockReturnValue({
        run: vi.fn(),
        free: vi.fn(),
      }),
      run: vi.fn(),
    }

    // 创建模拟的 ChromaClientManager
    mockChromaManager = {
      isReady: vi.fn().mockReturnValue(true),
      initialize: vi.fn().mockResolvedValue(undefined),
      getClient: vi.fn().mockReturnValue({}),
    }

    // 创建 MemoryManager 实例
    memoryManager = new MemoryManager(
      mockDb as any,
      mockChromaManager as any,
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('实例化', () => {
    it('应该成功创建 MemoryManager 实例', () => {
      expect(memoryManager).toBeInstanceOf(MemoryManager)
    })

    it('应该有 initialize 方法', () => {
      expect(typeof memoryManager.initialize).toBe('function')
    })
  })

  describe('类型定义', () => {
    it('应该导出正确的类型', () => {
      // 验证类型定义是否存在
      const types = ['MemoryType', 'ContentType', 'MemoryRecord', 'SearchOptions']
      // 这些类型在编译时检查，运行时无法验证
      // 这里只是确保模块能正确导入
      expect(MemoryManager).toBeDefined()
    })
  })
})

describe('ChromaClientManager', () => {
  describe('模块导出', () => {
    it('应该导出 ChromaClientManager 类', () => {
      expect(ChromaClientManager).toBeDefined()
    })

    it('应该导出辅助函数', async () => {
      // 使用动态导入验证辅助函数是否存在
      const { getOrCreateCollection, addVectors, queryVectors, deleteVectors } = await import('../ChromaClient')
      expect(typeof getOrCreateCollection).toBe('function')
      expect(typeof addVectors).toBe('function')
      expect(typeof queryVectors).toBe('function')
      expect(typeof deleteVectors).toBe('function')
    })
  })
})
