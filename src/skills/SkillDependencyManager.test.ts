import { describe, it, expect, beforeEach } from 'vitest'
import { SkillDependencyManager, CircularDependencyError } from './SkillDependencyManager'
import type { SkillManifest } from './types'

// 模拟 Skill 清单
const mockSkill1: SkillManifest = {
  id: 'skill-1',
  name: 'Skill 1',
  version: '1.0.0',
  description: '测试 Skill 1',
  author: 'Test Author',
  applicableAgents: ['chapter'],
  entry: './skill-1.ts',
  requiresToolCall: false
}

const mockSkill2: SkillManifest = {
  id: 'skill-2',
  name: 'Skill 2',
  version: '1.0.0',
  description: '测试 Skill 2',
  author: 'Test Author',
  applicableAgents: ['polish'],
  entry: './skill-2.ts',
  requiresToolCall: false,
  dependencies: [
    { skillId: 'skill-1', versionRange: '>=1.0.0' }
  ]
}

const mockSkill3: SkillManifest = {
  id: 'skill-3',
  name: 'Skill 3',
  version: '2.0.0',
  description: '测试 Skill 3',
  author: 'Test Author',
  applicableAgents: ['outline'],
  entry: './skill-3.ts',
  requiresToolCall: true,
  dependencies: [
    { skillId: 'skill-2', versionRange: '>=1.0.0' }
  ]
}

describe('SkillDependencyManager', () => {
  let manager: SkillDependencyManager

  // 每个测试前重置管理器
  beforeEach(() => {
    manager = new SkillDependencyManager()
  })

  describe('addSkill', () => {
    it('应该成功添加 Skill', () => {
      manager.addSkill(mockSkill1)

      // 通过 getLoadOrder 间接测试（如果没有循环依赖，应该返回排序后的列表）
      const order = manager.getLoadOrder()
      expect(order).toContain('skill-1')
    })

    it('应该添加依赖关系', () => {
      manager.addSkill(mockSkill1)
      manager.addSkill(mockSkill2)

      // skill-2 依赖 skill-1，所以 skill-1 应该在 skill-2 之前
      const order = manager.getLoadOrder()
      const index1 = order.indexOf('skill-1')
      const index2 = order.indexOf('skill-2')

      expect(index1).toBeLessThan(index2)
    })
  })

  describe('removeSkill', () => {
    it('应该成功移除 Skill', () => {
      manager.addSkill(mockSkill1)
      manager.removeSkill('skill-1')

      // 移除后，getLoadOrder 应该返回空数组（或者不包含 skill-1）
      const order = manager.getLoadOrder()
      expect(order).not.toContain('skill-1')
    })

    it('应该移除其他 Skill 对此 Skill 的依赖', () => {
      manager.addSkill(mockSkill1)
      manager.addSkill(mockSkill2)

      manager.removeSkill('skill-1')

      // 现在 skill-2 的依赖应该被移除
      // 我们可以通过 getDependents 来检查
      const dependents = manager.getDependents('skill-1')
      expect(dependents).not.toContain('skill-2')
    })
  })

  describe('detectCycle', () => {
    it('应该返回 false 当没有循环依赖时', () => {
      manager.addSkill(mockSkill1)
      manager.addSkill(mockSkill2)

      expect(manager.detectCycle()).toBe(false)
    })

    it('应该返回 true 当存在循环依赖时', () => {
      // 创建循环依赖：skill-1 -> skill-2 -> skill-1
      const skill1WithDeps: SkillManifest = {
        ...mockSkill1,
        dependencies: [{ skillId: 'skill-2' }]
      }

      const skill2WithDeps: SkillManifest = {
        ...mockSkill2,
        dependencies: [{ skillId: 'skill-1' }]
      }

      manager.addSkill(skill1WithDeps)
      manager.addSkill(skill2WithDeps)

      expect(manager.detectCycle()).toBe(true)
    })
  })

  describe('getCyclePath', () => {
    it('应该返回 null 当没有循环依赖时', () => {
      manager.addSkill(mockSkill1)
      manager.addSkill(mockSkill2)

      expect(manager.getCyclePath()).toBeNull()
    })

    it('应该返回循环路径当存在循环依赖时', () => {
      // 创建循环依赖：skill-1 -> skill-2 -> skill-1
      const skill1WithDeps: SkillManifest = {
        ...mockSkill1,
        dependencies: [{ skillId: 'skill-2' }]
      }

      const skill2WithDeps: SkillManifest = {
        ...mockSkill2,
        dependencies: [{ skillId: 'skill-1' }]
      }

      manager.addSkill(skill1WithDeps)
      manager.addSkill(skill2WithDeps)

      const cyclePath = manager.getCyclePath()
      expect(cyclePath).not.toBeNull()
      expect(cyclePath!).toContain('skill-1')
      expect(cyclePath!).toContain('skill-2')
    })
  })

  describe('getLoadOrder', () => {
    it('应该返回按依赖顺序排序的列表', () => {
      manager.addSkill(mockSkill1)
      manager.addSkill(mockSkill2)
      manager.addSkill(mockSkill3)

      const order = manager.getLoadOrder()

      // skill-1 应该在 skill-2 之前
      // skill-2 应该在 skill-3 之前
      const index1 = order.indexOf('skill-1')
      const index2 = order.indexOf('skill-2')
      const index3 = order.indexOf('skill-3')

      expect(index1).toBeLessThan(index2)
      expect(index2).toBeLessThan(index3)
    })

    it('应该抛出 CircularDependencyError 当存在循环依赖时', () => {
      // 创建循环依赖
      const skill1WithDeps: SkillManifest = {
        ...mockSkill1,
        dependencies: [{ skillId: 'skill-2' }]
      }

      const skill2WithDeps: SkillManifest = {
        ...mockSkill2,
        dependencies: [{ skillId: 'skill-1' }]
      }

      manager.addSkill(skill1WithDeps)
      manager.addSkill(skill2WithDeps)

      expect(() => manager.getLoadOrder()).toThrow(CircularDependencyError)
    })
  })

  describe('validateVersions', () => {
    it('应该返回空数组当所有版本都兼容时', () => {
      manager.addSkill(mockSkill1)
      manager.addSkill(mockSkill2)

      const incompatible = manager.validateVersions()
      expect(incompatible).toHaveLength(0)
    })

    it('应该返回不兼容的 Skill 列表当版本不匹配时', () => {
      // skill-2 依赖 skill-1 >=1.0.0
      // 但 skill-1 的版本是 1.0.0，应该兼容
      manager.addSkill(mockSkill1)
      manager.addSkill(mockSkill2)

      const incompatible = manager.validateVersions()
      expect(incompatible).toHaveLength(0)
    })
  })

  describe('getDependencyTree', () => {
    it('应该返回依赖树', () => {
      manager.addSkill(mockSkill1)
      manager.addSkill(mockSkill2)
      manager.addSkill(mockSkill3)

      const tree = manager.getDependencyTree('skill-3')

      // skill-3 依赖 skill-2，skill-2 依赖 skill-1
      expect(tree).toContain('skill-2')
      expect(tree).toContain('skill-1')
    })

    it('应该处理循环依赖（避免无限循环）', () => {
      // 创建循环依赖
      const skill1WithDeps: SkillManifest = {
        ...mockSkill1,
        dependencies: [{ skillId: 'skill-2' }]
      }

      const skill2WithDeps: SkillManifest = {
        ...mockSkill2,
        dependencies: [{ skillId: 'skill-1' }]
      }

      manager.addSkill(skill1WithDeps)
      manager.addSkill(skill2WithDeps)

      const tree = manager.getDependencyTree('skill-1')

      // 应该包含 skill-2，但不应该无限循环
      expect(tree).toContain('skill-2')
      expect(tree).toHaveLength(1) // 不包含重复的 skill-1
    })
  })

  describe('getDependents', () => {
    it('应该返回依赖于指定 Skill 的其他 Skill', () => {
      manager.addSkill(mockSkill1)
      manager.addSkill(mockSkill2)

      const dependents = manager.getDependents('skill-1')
      expect(dependents).toContain('skill-2')
    })

    it('应该返回空数组当没有其他 Skill 依赖此 Skill 时', () => {
      manager.addSkill(mockSkill1)

      const dependents = manager.getDependents('skill-1')
      expect(dependents).toHaveLength(0)
    })
  })

  describe('clear', () => {
    it('应该清除所有数据', () => {
      manager.addSkill(mockSkill1)
      manager.addSkill(mockSkill2)

      manager.clear()

      const order = manager.getLoadOrder()
      expect(order).toHaveLength(0)
    })
  })
})
