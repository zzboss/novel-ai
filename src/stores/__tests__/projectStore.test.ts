import { describe, it, expect } from 'vitest'
import {
  getStepIndex,
  getTotalSteps,
  getNextStep,
  getPrevStep,
  canSkipStep,
  requiresAiGeneration,
  STEP_LABELS,
  type CreationStep
} from '@/stores/stepUtils'

describe('项目步骤工具函数', () => {
  describe('getStepIndex', () => {
    it('应返回正确的步骤索引（从 1 开始）', () => {
      expect(getStepIndex('type-select')).toBe(1)
      expect(getStepIndex('idea')).toBe(2)
      expect(getStepIndex('world')).toBe(3)
      expect(getStepIndex('character')).toBe(4)
      expect(getStepIndex('outline-1')).toBe(5)
      expect(getStepIndex('complete')).toBe(6)
    })
  })

  describe('getTotalSteps', () => {
    it('应返回 6 个步骤', () => {
      expect(getTotalSteps()).toBe(6)
    })
  })

  describe('getNextStep', () => {
    it('应返回下一步', () => {
      expect(getNextStep('type-select')).toBe('idea')
      expect(getNextStep('idea')).toBe('world')
      expect(getNextStep('world')).toBe('character')
      expect(getNextStep('character')).toBe('outline-1')
      expect(getNextStep('outline-1')).toBe('complete')
    })

    it('最后一步应返回 null', () => {
      expect(getNextStep('complete')).toBeNull()
    })
  })

  describe('getPrevStep', () => {
    it('应返回上一步', () => {
      expect(getPrevStep('idea')).toBe('type-select')
      expect(getPrevStep('world')).toBe('idea')
      expect(getPrevStep('character')).toBe('world')
      expect(getPrevStep('outline-1')).toBe('character')
      expect(getPrevStep('complete')).toBe('outline-1')
    })

    it('第一步应返回 null', () => {
      expect(getPrevStep('type-select')).toBeNull()
    })
  })

  describe('canSkipStep', () => {
    it('世界和角色可跳过', () => {
      expect(canSkipStep('world')).toBe(true)
      expect(canSkipStep('character')).toBe(true)
    })

    it('type-select 和 complete 不可跳过', () => {
      expect(canSkipStep('type-select')).toBe(false)
      expect(canSkipStep('complete')).toBe(false)
    })

    it('idea 可跳过', () => {
      expect(canSkipStep('idea')).toBe(true)
    })
  })

  describe('requiresAiGeneration', () => {
    it('idea/world/character/outline-1 需要 AI 生成', () => {
      expect(requiresAiGeneration('idea')).toBe(true)
      expect(requiresAiGeneration('world')).toBe(true)
      expect(requiresAiGeneration('character')).toBe(true)
      expect(requiresAiGeneration('outline-1')).toBe(true)
    })

    it('type-select/complete 不需要 AI 生成', () => {
      expect(requiresAiGeneration('type-select')).toBe(false)
      expect(requiresAiGeneration('complete')).toBe(false)
    })
  })

  describe('STEP_LABELS', () => {
    it('应包含所有步骤的中文标签', () => {
      const steps: CreationStep[] = ['type-select', 'idea', 'world', 'character', 'outline-1', 'complete']
      for (const step of steps) {
        expect(STEP_LABELS[step]).toBeTruthy()
      }
    })
  })
})
