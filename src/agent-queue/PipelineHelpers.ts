/**
 * 管线执行辅助函数
 */

import type { PipelineStep, PipelineResult, StepResult, PipelineCallbacks, PipelineOptions } from '../types'
import type { AuditIssue } from '@/agents/ConsistencyAgent'
import type { AgentType, AgentInput } from '@/agents/types'

/**
 * 解析审计结果
 */
export function parseAuditResult(content: string): { issues: AuditIssue[] } {
  try {
    const parsed = JSON.parse(content)
    if (parsed.issues && Array.isArray(parsed.issues)) {
      return { issues: parsed.issues }
    }
  } catch {
    // 尝试从代码块提取
    const jsonMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1])
        if (parsed.issues) return { issues: parsed.issues }
      } catch {
        // fallthrough
      }
    }
  }
  return { issues: [] }
}

/**
 * 创建暂停状态的结果
 */
export function createPausedResult(
  stepResults: Map<number, StepResult>,
  finalContent: string,
  auditIssues: AuditIssue[],
  storyStateUpdated: boolean,
  revisionCycles: number,
  totalTokenEstimate: number
): PipelineResult {
  return {
    completed: false,
    finalContent,
    stepResults,
    auditIssues,
    storyStateUpdated,
    revisionCycles,
    totalTokenEstimate,
    error: '管线在用户确认点暂停'
  }
}

/**
 * 根据Agent类型推断单步输入
 */
export function inferSingleStepInput(agentType: AgentType, chapterId: string): AgentInput {
  switch (agentType) {
    case 'chapter':
      return { type: 'chapter', chapterId, outline: '', wordCount: 3000 }
    case 'consistency':
      return { type: 'consistency', chapterId }
    case 'foreshadow':
      return { type: 'foreshadow', chapterId, mode: 'scan' }
    case 'state_extractor':
      return { type: 'state_extractor', chapterId, chapterContent: '' }
    case 'summary':
      return { type: 'summary', chapterId, chapterContent: '' }
    case 'reviser':
      return { type: 'reviser', chapterId, content: '', auditIssues: [] }
    default:
      return { type: agentType, chapterId } as any
  }
}

/**
 * 估算Token数量（中文字符）
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length * 1.5)
}
