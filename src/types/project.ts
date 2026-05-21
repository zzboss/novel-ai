/**
 * 项目相关接口类型定义
 * 
 * 从 project.ts 提取所有接口类型定义，
 * 使用枚举替代原字符串字面量类型。
 */

import { CreationStep } from '@/stores/stepUtils'
import type { ProjectType, StepInputMode, ChapterStatus, StepStatus, CharacterRole, CharacterGender } from './enums'
import type { StoryState } from '@/schemas/storyState'

/** 章节（Chapter）接口 */
export interface Chapter {
  id: string
  title: string
  chapterNumber: number  // 章节序号，从1开始
  wordCount: number
  status: ChapterStatus
  outline: string  // 章节细纲
}

/** 卷（Volume）接口 */
export interface Volume {
  id: string
  title: string
  content: string
  chapters: Chapter[]
}

/** 单步骤状态 */
export interface StepState {
  step: string  // CreationStep 类型，避免循环依赖
  mode: StepInputMode
  content: string
  aiGenerated: string
  status: StepStatus
  error?: string
  guidedAnswers: string[]
  volumes: Volume[]
}

/** 创建会话 */
export interface CreationSession {
  id: string
  projectType: ProjectType
  projectName: string
  projectPath: string
  currentStep: CreationStep  // CreationStep 类型，避免循环依赖
  steps: Partial<Record<string, StepState>>
  createdCharacters: Character[]
  createdAt: number
  updatedAt: number
  isEditMode: boolean
}

/** 角色（Character）接口 */
export interface Character {
  id: string
  name: string
  role: CharacterRole
  gender?: CharacterGender
  age?: number
  appearance?: string
  personality?: string
  background?: string
  abilities?: string
  motivation?: string
  arc?: string
  relationships?: Array<{ characterId: string; relation: string }>
  dialogueStyle?: string
  description: string
}

/** 世界观设定（WorldSettings）接口 */
export interface WorldSettings {
  genre: string
  tone: string
  rules: string
  locations: string[]
}

/** 项目状态（ProjectState）接口 */
export interface ProjectState {
  path: string
  name: string
  projectType: ProjectType
  creationVersion: string
  createdAt: number
  updatedAt: number
  volumes: Volume[]
  characters: Character[]
  worldSettings: WorldSettings
  globalStyle: string
  idea: string
  genre?: string
  tone?: string
  synopsis?: string
  targetWords?: string
  targetAudience?: string
  storyState: StoryState
  /** 状态快照：chapterId → 该章节生成前的StoryState */
  stateSnapshots?: Record<string, StoryState>
  scriptMeta?: {
    episodeCount: number
    sceneCount: number
    format: 'short-drama'
  }
}
