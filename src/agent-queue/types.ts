/**
 * AgentQueueManager 类型定义
 */

import type { AgentType, AgentInput } from '@/agents/types'
import type { AuditIssue } from '@/agents/ConsistencyAgent'
import type { ExtractedFacts } from '@/utils/storyStateUpdater'

/**
 * 管线执行模式
 */
export type PipelineMode = 'auto' | 'semi-auto' | 'single-step' | 'breakpoint'

/**
 * 管线步骤定义
 */
export interface PipelineStep {
  /** 步骤编号 */
  step: number
  /** 步骤名称 */
  name: string
  /** 对应的Agent类型 */
  agentType: AgentType | 'intent_compiler' | 'context_builder' | 'state_updater'
  /** 是否调LLM */
  usesLLM: boolean
  /** 步骤描述 */
  description: string
}

/**
 * 管线执行结果
 */
export interface PipelineResult {
  /** 是否全部完成 */
  completed: boolean
  /** 最终章节内容 */
  finalContent: string
  /** 各步骤结果 */
  stepResults: Map<number, StepResult>
  /** 审计问题 */
  auditIssues: AuditIssue[]
  /** StoryState是否已更新 */
  storyStateUpdated: boolean
  /** 循环修复次数 */
  revisionCycles: number
  /** 总Token估算 */
  totalTokenEstimate: number
  /** 错误信息 */
  error?: string
}

/**
 * 单步骤执行结果
 */
export interface StepResult {
  /** 步骤编号 */
  step: number
  /** 是否成功 */
  success: boolean
  /** 输出内容 */
  content: string
  /** 消耗Token估算 */
  tokenEstimate: number
  /** 执行耗时（毫秒） */
  duration: number
  /** 错误信息 */
  error?: string
  /** 元数据 */
  metadata?: Record<string, unknown>
}

/**
 * 管线进度回调
 */
export interface PipelineCallbacks {
  /** 步骤开始 */
  onStepStart?: (step: PipelineStep) => void
  /** 步骤完成 */
  onStepComplete?: (step: PipelineStep, result: StepResult) => void
  /** 流式token输出 */
  onToken?: (token: string) => void
  /** 管线完成 */
  onPipelineComplete?: (result: PipelineResult) => void
  /** 管线错误 */
  onPipelineError?: (error: Error) => void
  /** 半自动模式等待确认 */
  onStepAwaitConfirmation?: (step: PipelineStep, result: StepResult) => Promise<boolean>
}

/**
 * 管线执行选项
 */
export interface PipelineOptions {
  /** 目标字数 */
  targetWordCount?: number
  /** 用户修改意图 */
  userIntent?: string
  /** 断点步骤（breakpoint模式时，执行到该步骤后暂停） */
  breakpointStep?: number
  /** 单步执行的Agent类型 */
  singleStepAgent?: AgentType
  /** 单步执行的输入 */
  singleStepInput?: AgentInput
}
