import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SkillLoader, SkillLoadError } from './SkillLoader'
import type { SkillManifest } from './types'

// 模拟有效的 manifest.json 内容
const mockManifest: SkillManifest = {
  id: 'test-skill',
  name: '测试 Skill',
  version: '1.0.0',
  description: '用于测试的 Skill',
  author: 'Test Author',
  applicableAgents: ['chapter', 'polish'],
  entry: './test-skill.ts',
  requiresToolCall: false
}

describe('SkillLoader', () => {
  // 每个测试前重置配置和缓存
  beforeEach(() => {
    SkillLoader.clearCache()
    SkillLoader.configure({
      cacheTimeout: 5 * 60 * 1000,
      enableCache: true,
      verbose: false
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('configure', () => {
    it('应该能够更新配置', () => {
      SkillLoader.configure({ verbose: true, cacheTimeout: 10 * 60 * 1000 })
      
      // 通过加载来验证配置生效（间接测试）
      const stats = SkillLoader.getCacheStats()
      expect(stats.size).toBe(0)
    })
  })

  describe('loadFromDirectory', () => {
    it('应该成功加载有效的 manifest.json', async () => {
      // 模拟 fetch 返回成功的响应
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockManifest)
      }
      
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as any)

      const result = await SkillLoader.loadFromDirectory('/path/to/skill')
      
      expect(result).not.toBeNull()
      expect(result!.id).toBe('test-skill')
      expect(result!.name).toBe('测试 Skill')
      expect(fetch).toHaveBeenCalledWith('file:///path/to/skill/manifest.json')
    })

    it('应该抛出 FILE_NOT_FOUND 错误当文件不存在', async () => {
      // 模拟 fetch 返回 404
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found'
      }
      
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as any)

      await expect(
        SkillLoader.loadFromDirectory('/path/to/nonexistent')
      ).rejects.toThrow(SkillLoadError)

      try {
        await SkillLoader.loadFromDirectory('/path/to/nonexistent')
      } catch (error) {
        expect(error).toBeInstanceOf(SkillLoadError)
        expect((error as SkillLoadError).code).toBe('FILE_NOT_FOUND')
      }
    })

    it('应该抛出 INVALID_JSON 错误当 JSON 解析失败', async () => {
      // 模拟 fetch 返回无效 JSON
      const mockResponse = {
        ok: true,
        json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token'))
      }
      
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as any)

      await expect(
        SkillLoader.loadFromDirectory('/path/to/invalid-json')
      ).rejects.toThrow(SkillLoadError)

      try {
        await SkillLoader.loadFromDirectory('/path/to/invalid-json')
      } catch (error) {
        expect(error).toBeInstanceOf(SkillLoadError)
        expect((error as SkillLoadError).code).toBe('INVALID_JSON')
      }
    })

    it('应该抛出 VALIDATION_FAILED 错误当缺少必填字段', async () => {
      // 模拟 fetch 返回缺少字段的 manifest
      const invalidManifest = { id: 'test' } // 缺少 name, version, entry
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(invalidManifest)
      }
      
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as any)

      await expect(
        SkillLoader.loadFromDirectory('/path/to/missing-fields')
      ).rejects.toThrow(SkillLoadError)

      try {
        await SkillLoader.loadFromDirectory('/path/to/missing-fields')
      } catch (error) {
        expect(error).toBeInstanceOf(SkillLoadError)
        expect((error as SkillLoadError).code).toBe('VALIDATION_FAILED')
        expect((error as SkillLoadError).message).toContain('缺少必填字段')
      }
    })

    it('应该抛出 FETCH_FAILED 错误当 fetch 失败', async () => {
      // 模拟 fetch 抛出网络错误
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

      await expect(
        SkillLoader.loadFromDirectory('/path/to/network-error')
      ).rejects.toThrow(SkillLoadError)

      try {
        await SkillLoader.loadFromDirectory('/path/to/network-error')
      } catch (error) {
        expect(error).toBeInstanceOf(SkillLoadError)
        expect((error as SkillLoadError).code).toBe('FETCH_FAILED')
      }
    })
  })

  describe('缓存机制', () => {
    beforeEach(() => {
      SkillLoader.clearCache()
    })

    it('应该从缓存返回 manifest（当启用缓存时）', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockManifest)
      }
      
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as any)

      // 第一次加载
      const result1 = await SkillLoader.loadFromDirectory('/path/to/skill')
      expect(result1).not.toBeNull()
      expect(fetchSpy).toHaveBeenCalledTimes(1)

      // 第二次加载（应该使用缓存）
      const result2 = await SkillLoader.loadFromDirectory('/path/to/skill')
      expect(result2).not.toBeNull()
      expect(fetchSpy).toHaveBeenCalledTimes(1) // 仍然是 1 次
      expect(result2!.id).toBe(result1!.id)
    })

    it('应该重新加载当缓存过期时', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockManifest)
      }
      
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as any)

      // 设置短超时时间
      SkillLoader.configure({ cacheTimeout: 100 }) // 100ms

      // 第一次加载
      await SkillLoader.loadFromDirectory('/path/to/skill')
      expect(fetchSpy).toHaveBeenCalledTimes(1)

      // 等待缓存过期
      await new Promise(resolve => setTimeout(resolve, 150))

      // 第二次加载（缓存已过期，应该重新加载）
      await SkillLoader.loadFromDirectory('/path/to/skill')
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    it('应该跳过缓存当 useCache=false 时', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockManifest)
      }
      
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as any)

      // 第一次加载（使用缓存）
      await SkillLoader.loadFromDirectory('/path/to/skill')
      expect(fetchSpy).toHaveBeenCalledTimes(1)

      // 第二次加载（跳过缓存）
      await SkillLoader.loadFromDirectory('/path/to/skill', { useCache: false })
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    it('应该能够手动清除缓存', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockManifest)
      }
      
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as any)

      // 加载并缓存
      await SkillLoader.loadFromDirectory('/path/to/skill')
      expect(fetchSpy).toHaveBeenCalledTimes(1)

      // 清除缓存
      SkillLoader.clearCache()

      // 重新加载
      await SkillLoader.loadFromDirectory('/path/to/skill')
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })

    it('应该能够使指定目录的缓存失效', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockManifest)
      }
      
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as any)

      // 加载并缓存
      await SkillLoader.loadFromDirectory('/path/to/skill')
      expect(fetchSpy).toHaveBeenCalledTimes(1)

      // 使缓存失效
      const removed = SkillLoader.invalidateCache('/path/to/skill')
      expect(removed).toBe(true)

      // 重新加载
      await SkillLoader.loadFromDirectory('/path/to/skill')
      expect(fetchSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe('loadMultiple', () => {
    it('应该批量加载多个 Skill', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockManifest)
      }
      
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as any)

      const results = await SkillLoader.loadMultiple([
        '/path/to/skill1',
        '/path/to/skill2',
        '/path/to/skill3'
      ])

      expect(results).toHaveLength(3)
      expect(results[0]).not.toBeNull()
      expect(results[1]).not.toBeNull()
      expect(results[2]).not.toBeNull()
    })

    it('应该继续加载其他 Skill 当 continueOnError=true 时', async () => {
      // 第一个成功，第二个失败，第三个成功
      let callCount = 0
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        callCount++
        if (callCount === 2) {
          return {
            ok: false,
            status: 404,
            statusText: 'Not Found'
          } as any
        }
        return {
          ok: true,
          json: vi.fn().mockResolvedValue(mockManifest)
        } as any
      })

      const results = await SkillLoader.loadMultiple([
        '/path/to/skill1',
        '/path/to/skill2',
        '/path/to/skill3'
      ])

      expect(results).toHaveLength(3)
      expect(results[0]).not.toBeNull()
      expect(results[1]).toBeNull()
      expect(results[2]).not.toBeNull()
    })
  })

  describe('loadBuiltinSkills', () => {
    it('应该返回 5 个内置 Skill', () => {
      const builtin = SkillLoader.loadBuiltinSkills()
      
      expect(builtin).toBeInstanceOf(Array)
      expect(builtin.length).toBe(5)
      expect(builtin[0].id).toBe('web-search')
      expect(builtin[1].id).toBe('reference-lookup')
      expect(builtin[2].id).toBe('style-transfer')
      expect(builtin[3].id).toBe('genre-rules')
      expect(builtin[4].id).toBe('translation')
    })

    it('应该包含所有必填字段', () => {
      const builtin = SkillLoader.loadBuiltinSkills()
      
      builtin.forEach(skill => {
        expect(skill.id).toBeTruthy()
        expect(skill.name).toBeTruthy()
        expect(skill.version).toBeTruthy()
        expect(skill.entry).toBeTruthy()
        expect(skill.description).toBeTruthy()
        expect(skill.author).toBeTruthy()
        expect(skill.applicableAgents).toBeInstanceOf(Array)
        expect(typeof skill.requiresToolCall).toBe('boolean')
      })
    })
  })

  describe('getCacheStats', () => {
    it('应该返回正确的缓存统计信息', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue(mockManifest)
      }
      
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as any)

      // 加载两个 Skill
      await SkillLoader.loadFromDirectory('/path/to/skill1')
      await SkillLoader.loadFromDirectory('/path/to/skill2')

      const stats = SkillLoader.getCacheStats()
      
      expect(stats.size).toBe(2)
      expect(stats.entries).toHaveLength(2)
      expect(stats.entries[0].directory).toBe('/path/to/skill1')
      expect(stats.entries[1].directory).toBe('/path/to/skill2')
    })

    it('应该返回空统计当缓存为空时', () => {
      const stats = SkillLoader.getCacheStats()
      
      expect(stats.size).toBe(0)
      expect(stats.entries).toHaveLength(0)
    })
  })
})
