/**
 * 预定义的 Agent 流水线
 * 
 * 包含所有常用的 Agent 协作流水线定义
 */

import type { AgentPipeline } from './types'
import type { AgentOutput, AgentInput } from '../types'

/**
 * 流水线 1: Outline -> Chapter（大纲驱动章节生成）
 * 
 * 工作流程：
 * 1. OutlineAgent 生成大纲
 * 2. 将大纲转换为 ChapterAgent 的输入
 * 3. ChapterAgent 根据大纲生成章节
 */
export const OUTLINE_TO_CHAPTER_PIPELINE: AgentPipeline = {
  id: 'outline-to-chapter',
  name: '大纲驱动章节生成',
  steps: [
    {
      id: 'step-1-outline',
      agentType: 'outline',
      inputTransformer: (prevOutput: AgentOutput, originalInput: AgentInput) => originalInput,
      timeout: 300000 // 5分钟
    },
    {
      id: 'step-2-chapter',
      agentType: 'chapter',
      inputTransformer: (prevOutput: AgentOutput, originalInput: AgentInput) => {
        // 将 OutlineAgent 的输出转换为 ChapterAgent 的输入
        return {
          ...originalInput,
          type: 'chapter',
          outline: prevOutput.content, // 大纲内容作为章节生成的输入
          chapterId: originalInput.chapterId || 'chapter-1'
        }
      },
      timeout: 600000 // 10分钟
    }
  ],
  onStepError: 'stop',
  maxRetries: 1
}

/**
 * 流水线 2: Chapter -> Outline（章节生成 + 大纲优化）
 * 
 * 工作流程：
 * 1. ChapterAgent 生成章节
 * 2. OutlineAgent 优化大纲
 */
export const CHAPTER_TO_OUTLINE_PIPELINE: AgentPipeline = {
  id: 'chapter-to-outline',
  name: '章节生成 + 大纲优化',
  steps: [
    {
      id: 'step-1-chapter',
      agentType: 'chapter',
      inputTransformer: (prevOutput: AgentOutput, originalInput: AgentInput) => originalInput,
      timeout: 600000 // 10分钟
    },
    {
      id: 'step-2-outline',
      agentType: 'outline',
      inputTransformer: (prevOutput: AgentOutput, originalInput: AgentInput) => {
        // 将 ChapterAgent 的输出作为 OutlineAgent 的输入
        return {
          ...originalInput,
          type: 'outline',
          prompt: prevOutput.content // 章节内容作为大纲优化的输入
        }
      },
      timeout: 300000 // 5分钟
    }
  ],
  onStepError: 'continue',
  maxRetries: 1
}

/**
 * 流水线 3: Chapter -> Character（章节生成 + 角色优化）
 * 
 * 工作流程：
 * 1. ChapterAgent 生成章节
 * 2. CharacterAgent 优化角色
 */
export const CHAPTER_TO_CHARACTER_PIPELINE: AgentPipeline = {
  id: 'chapter-to-character',
  name: '章节生成 + 角色优化',
  steps: [
    {
      id: 'step-1-chapter',
      agentType: 'chapter',
      inputTransformer: (prevOutput: AgentOutput, originalInput: AgentInput) => originalInput,
      timeout: 600000 // 10分钟
    },
    {
      id: 'step-2-character',
      agentType: 'character',
      inputTransformer: (prevOutput: AgentOutput, originalInput: AgentInput) => {
        return {
          ...originalInput,
          type: 'character',
          prompt: prevOutput.content // 章节内容作为角色优化的输入
        }
      },
      timeout: 300000 // 5分钟
    }
  ],
  onStepError: 'continue',
  maxRetries: 1
}

/**
 * 流水线 4: Idea -> World -> Outline（灵感 -> 世界观 -> 大纲）
 * 
 * 工作流程：
 * 1. IdeaAgent 生成灵感
 * 2. WorldAgent 生成世界观
 * 3. OutlineAgent 生成大纲
 */
export const IDEA_TO_WORLD_TO_OUTLINE_PIPELINE: AgentPipeline = {
  id: 'idea-to-world-to-outline',
  name: '灵感 -> 世界观 -> 大纲',
  steps: [
    {
      id: 'step-1-idea',
      agentType: 'idea',
      inputTransformer: (prevOutput: AgentOutput, originalInput: AgentInput) => originalInput,
      timeout: 300000 // 5分钟
    },
    {
      id: 'step-2-world',
      agentType: 'world',
      inputTransformer: (prevOutput: AgentOutput, originalInput: AgentInput) => {
        return {
          ...originalInput,
          type: 'world',
          prompt: prevOutput.content // 灵感内容作为世界观生成的输入
        }
      },
      timeout: 300000 // 5分钟
    },
    {
      id: 'step-3-outline',
      agentType: 'outline',
      inputTransformer: (prevOutput: AgentOutput, originalInput: AgentInput) => {
        return {
          ...originalInput,
          type: 'outline',
          prompt: prevOutput.content // 世界观内容作为大纲生成的输入
        }
      },
      timeout: 300000 // 5分钟
    }
  ],
  onStepError: 'stop',
  maxRetries: 1
}

/**
 * 获取所有预定义的流水线
 */
export function getAllPipelines(): AgentPipeline[] {
  return [
    OUTLINE_TO_CHAPTER_PIPELINE,
    CHAPTER_TO_OUTLINE_PIPELINE,
    CHAPTER_TO_CHARACTER_PIPELINE,
    IDEA_TO_WORLD_TO_OUTLINE_PIPELINE
  ]
}

/**
 * 根据 ID 获取流水线
 * @param pipelineId - 流水线 ID
 * @returns 流水线定义或 undefined
 */
export function getPipelineById(pipelineId: string): AgentPipeline | undefined {
  const pipelines = getAllPipelines()
  if (!pipelines) {
    console.warn('[pipelines] getAllPipelines() 返回 undefined')
    return undefined
  }
  return pipelines.find(p => p.id === pipelineId)
}
