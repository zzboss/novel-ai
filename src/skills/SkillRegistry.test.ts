import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SkillRegistry } from './SkillRegistry'
import type { SkillManifest } from './types'

// 模拟 Skill 清单
const mockSkill1: SkillManifest = {
  id: 'skill-1',
  name: 'Skill 1',
  version: '1.0.0',
  description: '测试 Skill 1',
  author: 'Test Author',
  applicableAgents: ['chapter', 'polish'],
  entry: './skill-1.ts',
  requiresToolCall: false
}

const mockSkill2: SkillManifest = {
  id: 'skill-2',
  name: 'Skill 2',
  version: '1.0.0',
  description: '测试 Skill 2',
  author: 'Test Author',
  applicableAgents: ['outline'],
  entry: './skill-2.ts',
  requiresToolCall: false,
  dependencies: [
    { skillId: 'skill-1', versionRange: '>=1.0.0' }
  ]
}

const mockSkill3: SkillManifest = {
  id: 'skill-3',
  name: 'Skill 3',
  version: '1.0.0',
  description: '测试 Skill 3',
  author: 'Test Author',
  applicableAgents: [], // 适用于所有 Agent
  entry: './skill-3.ts',
  requiresToolCall: true
}

describe('SkillRegistry', () => {
  let registry: SkillRegistry

  // 每个测试前重置注册中心
  beforeEach(() => {
    // 清除单例实例
    ;(SkillRegistry as any).instance = null
    registry = SkillRegistry.getInstance()
    registry.clear()
  })

  describe('单例模式', () => {
    it('应该返回相同的实例', () => {
      const instance1 = SkillRegistry.getInstance()
      const instance2 = SkillRegistry.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('register', () => {
    it('应该成功注册 Skill', () => {
      const result = registry.register(mockSkill1)

      expect(result.success).toBe(true)
      expect(registry.isRegistered('skill-1')).toBe(true)
      expect(registry.getRegistered()).toHaveLength(1)
    })

    it('应该检测依赖缺失', () => {
      // skill-2 依赖 skill-1，但 skill-1 未注册
      const result = registry.register(mockSkill2)

      expect(result.success).toBe(false)
      expect(result.errors).toContain('缺少依赖: skill-1')
      expect(registry.isRegistered('skill-2')).toBe(false)
    })

    it('应该成功注册有依赖的 Skill（当依赖已满足）', () => {
      // 先注册 skill-1
      registry.register(mockSkill1)

      // 再注册 skill-2
      const result = registry.register(mockSkill2)

      expect(result.success).toBe(true)
      expect(registry.isRegistered('skill-2')).toBe(true)
    })

    it('应该警告版本冲突', () => {
      // 注册初始版本
      registry.register(mockSkill1)

      // 注册新版本（应该警告但不阻止）
      const updatedSkill1 = { ...mockSkill1, version: '2.0.0' }
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      registry.register(updatedSkill1)

      expect(consoleSpy).toHaveBeenCalled()
      expect(consoleSpy.mock.calls[0][0]).toContain('版本冲突')
    })
  })

  describe('unregister', () => {
    beforeEach(() => {
      // 注册两个 Skill
      registry.register(mockSkill1)
      registry.register(mockSkill2)
    })

    it('应该成功卸载 Skill', () => {
      const result = registry.unregister('skill-1')

      expect(result.success).toBe(true)
      expect(registry.isRegistered('skill-1')).toBe(false)
    })

    it('应该警告依赖此 Skill 的其他 Skill', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = registry.unregister('skill-1')

      expect(result.warnings).toBeDefined()
      expect(result.warnings![0]).toContain('skill-2')
    })

    it('应该强制卸载（忽略依赖检查）', () => {
      const result = registry.unregister('skill-1', { force: true })

      expect(result.success).toBe(true)
      expect(result.warnings).toBeUndefined()
    })
  })

  describe('getRegistered', () => {
    it('应该返回所有已注册的 Skill', () => {
      registry.register(mockSkill1)
      registry.register(mockSkill2)

      const registered = registry.getRegistered()

      expect(registered).toHaveLength(2)
      expect(registered[0].id).toBe('skill-1')
      expect(registered[1].id).toBe('skill-2')
    })

    it('应该返回空数组当没有注册 Skill 时', () => {
      const registered = registry.getRegistered()
      expect(registered).toHaveLength(0)
    })
  })

  describe('getById', () => {
    it('应该返回指定 ID 的 Skill', () => {
      registry.register(mockSkill1)

      const skill = registry.getById('skill-1')
      expect(skill).toBeDefined()
      expect(skill!.id).toBe('skill-1')
    })

    it('应该返回 undefined 当 Skill 未注册时', () => {
      const skill = registry.getById('nonexistent')
      expect(skill).toBeUndefined()
    })
  })

  describe('isRegistered', () => {
    it('应该返回 true 当 Skill 已注册时', () => {
      registry.register(mockSkill1)
      expect(registry.isRegistered('skill-1')).toBe(true)
    })

    it('应该返回 false 当 Skill 未注册时', () => {
      expect(registry.isRegistered('skill-1')).toBe(false)
    })
  })

  describe('getApplicable', () => {
    beforeEach(() => {
      registry.register(mockSkill1) // applicableAgents: ['chapter', 'polish']
      registry.register(mockSkill2) // applicableAgents: ['outline']
      registry.register(mockSkill3) // applicableAgents: [] (所有)
    })

    it('应该返回适用于 chapter Agent 的 Skill', () => {
      const applicable = registry.getApplicable('chapter')

      expect(applicable).toHaveLength(2)
      expect(applicable[0].id).toBe('skill-1')
      expect(applicable[1].id).toBe('skill-3')
    })

    it('应该返回适用于 outline Agent 的 Skill', () => {
      const applicable = registry.getApplicable('outline')

      expect(applicable).toHaveLength(2)
      expect(applicable[0].id).toBe('skill-2')
      expect(applicable[1].id).toBe('skill-3')
    })

    it('应该返回所有 Skill 当 Agent 类型为 all 时', () => {
      const applicable = registry.getApplicable('all')

      expect(applicable).toHaveLength(3)
    })
  })

  describe('checkDependencies', () => {
    it('应该返回空数组当 Skill 没有依赖时', () => {
      const missing = registry.checkDependencies(mockSkill1)
      expect(missing).toHaveLength(0)
    })

    it('应该返回缺少的依赖列表', () => {
      // 不注册 skill-1，直接检查 skill-2 的依赖
      const missing = registry.checkDependencies(mockSkill2)
      expect(missing).toContain('skill-1')
    })

    it('应该返回空数组当依赖已满足时', () => {
      // 先注册 skill-1
      registry.register(mockSkill1)

      // 检查 skill-2 的依赖
      const missing = registry.checkDependencies(mockSkill2)
      expect(missing).toHaveLength(0)
    })
  })

  describe('getDependents', () => {
    it('应该返回依赖指定 Skill 的其他 Skill', () => {
      registry.register(mockSkill1)
      registry.register(mockSkill2)

      const dependents = registry.getDependents('skill-1')
      expect(dependents).toContain('skill-2')
    })

    it('应该返回空数组当没有其他 Skill 依赖此 Skill 时', () => {
      registry.register(mockSkill1)

      const dependents = registry.getDependents('skill-1')
      expect(dependents).toHaveLength(0)
    })
  })

  describe('getDependencyTree', () => {
    it('应该返回依赖树', () => {
      // 创建嵌套依赖：skill-3 -> skill-2 -> skill-1
      const mockSkill3WithDeps: SkillManifest = {
        ...mockSkill3,
        dependencies: [
          { skillId: 'skill-2' }
        ]
      }

      registry.register(mockSkill1)
      registry.register(mockSkill2)
      registry.register(mockSkill3WithDeps)

      const tree = registry.getDependencyTree('skill-3')

      expect(tree).toContain('skill-2')
      expect(tree).toContain('skill-1')
    })

    it('应该处理循环依赖（避免无限循环）', () => {
      // 创建循环依赖：skill-1 -> skill-2 -> skill-1
      const mockSkill1WithDeps: SkillManifest = {
        ...mockSkill1,
        dependencies: [
          { skillId: 'skill-2' }
        ]
      }

      const mockSkill2WithDeps: SkillManifest = {
        ...mockSkill2,
        dependencies: [
          { skillId: 'skill-1' }
        ]
      }

      // 使用 checkDependencies: false 绕过依赖检查，强制注册
      registry.register(mockSkill1WithDeps, { checkDependencies: false })
      registry.register(mockSkill2WithDeps, { checkDependencies: false })

      const tree = registry.getDependencyTree('skill-1')

      // 应该包含 skill-2，但不应该无限循环
      expect(tree).toContain('skill-2')
      expect(tree).toHaveLength(1) // 不包含重复的 skill-1
    })
  })

  describe('execute', () => {
    it('应该抛出错误当 Skill 未注册时', async () => {
      await expect(
        registry.execute('nonexistent', {} as any)
      ).rejects.toThrow()
    })

    it('应该成功执行已注册的 Skill', async () => {
      registry.register(mockSkill1)

      const result = await registry.execute('skill-1', {} as any)

      expect(result).toBeDefined()
      expect(result.output).toContain('Skill 1')
    })

    it('应该抛出错误当依赖不满足时', async () => {
      // 注册 skill-2（但 skill-1 未注册）
      registry.register(mockSkill1)
      registry.register(mockSkill2)

      // 卸载 skill-1
      registry.unregister('skill-1', { force: true })

      // 尝试执行 skill-2（应该失败，因为依赖缺失）
      await expect(
        registry.execute('skill-2', {} as any)
      ).rejects.toThrow()
    })
  })

  describe('executeMultiple', () => {
    beforeEach(() => {
      registry.register(mockSkill1)
      registry.register(mockSkill3)
    })

    it('应该批量执行多个 Skill', async () => {
      const results = await registry.executeMultiple(['skill-1', 'skill-3'], {} as any)

      expect(results).toHaveLength(2)
      expect(results[0].output).toContain('Skill 1')
      expect(results[1].output).toContain('Skill 3')
    })

    it('应该继续执行其他 Skill 当有 Skill 执行失败时', async () => {
      const results = await registry.executeMultiple(['skill-1', 'nonexistent', 'skill-3'], {} as any)

      expect(results).toHaveLength(3)
      expect(results[0].output).toBeDefined()
      expect(results[1].error).toBeDefined()
      expect(results[2].output).toBeDefined()
    })
  })

  describe('clear', () => {
    it('应该清除所有注册', () => {
      registry.register(mockSkill1)
      registry.register(mockSkill2)

      registry.clear()

      expect(registry.getRegistered()).toHaveLength(0)
      expect(registry.isRegistered('skill-1')).toBe(false)
    })
  })
})
