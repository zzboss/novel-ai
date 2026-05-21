import { describe, it, expect } from 'vitest'
import {
  mergeExtractedFacts,
  createFallbackDraft,
  type ExtractedFacts
} from '@/utils/storyStateUpdater'
import { createEmptyStoryState } from '@/schemas/storyState'

describe('storyStateUpdater', () => {
  describe('mergeExtractedFacts', () => {
    it('应合并角色更新', () => {
      const state = createEmptyStoryState()
      const facts: ExtractedFacts = {
        chapterId: 'ch-1',
        characterUpdates: {
          'char-1': { location: '京都', emotionalState: '愤怒' }
        },
        worldStateUpdate: {},
        newResources: {},
        resourceUpdates: {},
        newHooks: [],
        hookUpdates: {},
        chapterSummary: {
          summary: '测试摘要',
          keyEvents: ['事件1'],
          characterChanges: {},
          wordCount: 1000
        },
        emotionalUpdates: {}
      }

      const result = mergeExtractedFacts(state, facts)

      // 验证更新结果
      expect(result.success).toBe(true)
      expect(result.updatedState).toBeDefined()
      // 角色状态应该在 updatedState 中
      if (result.updatedState?.characterStates['char-1']) {
        expect(result.updatedState.characterStates['char-1'].location).toBe('京都')
      }
    })

    it('应处理空更新', () => {
      const state = createEmptyStoryState()
      const facts: ExtractedFacts = {
        chapterId: 'ch-1',
        characterUpdates: {},
        worldStateUpdate: {},
        newResources: {},
        resourceUpdates: {},
        newHooks: [],
        hookUpdates: {},
        chapterSummary: {
          summary: '',
          keyEvents: [],
          characterChanges: {},
          wordCount: 0
        },
        emotionalUpdates: {}
      }

      const result = mergeExtractedFacts(state, facts)
      expect(result).toBeDefined()
      expect(result.success).toBeDefined()
      expect(result.deltaSummary).toBeDefined()
    })
  })

  describe('createFallbackDraft', () => {
    it('应生成回退更新', () => {
      const facts: ExtractedFacts = {
        chapterId: 'ch-test',
        characterUpdates: {},
        worldStateUpdate: {},
        newResources: {},
        resourceUpdates: {},
        newHooks: [],
        hookUpdates: {},
        chapterSummary: {
          summary: '测试',
          keyEvents: [],
          characterChanges: {},
          wordCount: 0
        },
        emotionalUpdates: {}
      }
      const result = createFallbackDraft(facts, '测试错误')

      expect(result).toBeDefined()
      expect(result.chapterId).toBe('ch-test')
      expect(result.error).toBe('测试错误')
    })
  })
})
