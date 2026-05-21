import { describe, it, expect } from 'vitest'

// 仅导入类型，避免触发 Pinia/Electron 依赖
import type { CreationStep } from '@/stores/stepUtils'
import type { CreationSession, StepState, ProjectType } from '@/stores/project'

describe('类型定义验证', () => {
  describe('CreationSession', () => {
    it('应有正确的默认结构', () => {
      const session: CreationSession = {
        id: 'test-session-1',
        projectType: 'novel' as ProjectType,
        projectName: '测试小说',
        projectPath: '/test/path',
        currentStep: 'idea' as CreationStep,
        steps: {},
        createdCharacters: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      expect(session.id).toBe('test-session-1')
      expect(session.projectType).toBe('novel')
      expect(session.currentStep).toBe('idea')
    })

    it('可选字段应有正确的默认行为', () => {
      const session: CreationSession = {
        id: 'test-session-2',
        projectType: 'short-story',
        projectName: '测试短篇',
        projectPath: '/test/path2',
        currentStep: 'type-select',
        steps: {},
        createdCharacters: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isEditMode: true
      }

      expect(session.isEditMode).toBe(true)
    })
  })

  describe('StepState', () => {
    it('应有正确的状态值', () => {
      const state: StepState = {
        step: 'idea' as CreationStep,
        mode: 'ai',
        content: '测试内容',
        status: 'completed'
      }

      expect(state.step).toBe('idea')
      expect(state.mode).toBe('ai')
      expect(state.content).toBe('测试内容')
      expect(state.status).toBe('completed')
    })

    it('volumes 字段应为可选', () => {
      const state: StepState = {
        step: 'outline-1' as CreationStep,
        mode: 'manual',
        content: '',
        status: 'pending',
        volumes: [
          {
            id: 'vol-1',
            title: '第一卷',
            content: '大纲内容',
            chapters: [
              { id: 'ch-1', title: '第一章', wordCount: 3000, status: 'draft' }
            ]
          }
        ]
      }

      expect(state.volumes).toHaveLength(1)
      expect(state.volumes![0].title).toBe('第一卷')
      expect(state.volumes![0].chapters).toHaveLength(1)
    })
  })
})
