/**
 * ContextBuilder 类型定义
 */

import type { AgentInput } from '@/agents/types'
import type { ProjectState } from '@/stores/project'
import type { StoryState } from '@/schemas/storyState'
import type { TokenBudget } from '@/utils/tokenCounter'
import type { ChapterIntent } from '@/utils/intentCompiler'

/**
 * 上下文包 — 分层结构
 */
export interface ContextPackage {
  /** 系统指令 */
  systemPrompt: string
  /** 世界观压缩 */
  worldConstraints: string
  /** 相关角色档案 */
  characterProfiles: string
  /** 前N章摘要 */
  previousSummaries: string
  /** 本章上下文 */
  chapterContext: string
  /** 伏笔状态 */
  foreshadowState: string
  /** Skill注入 */
  skillContext: string
  /** 用户自定义注入 */
  userInjections: string
  /** Token 预算与实际消耗 */
  tokenBudget: TokenBudget & {
    used: Record<keyof TokenBudget, number>
    totalUsed: number
    remaining: number
  }
  /** 规则优先级栈 */
  ruleStack: RuleStack
}

/**
 * 规则栈
 */
export interface RuleStack {
  /** 世界观规则（最高优先级） */
  worldRules: string[]
  /** 类型规则 */
  genreRules: string[]
  /** 用户自定义规则 */
  customRules: string[]
}

/**
 * 上下文构建选项
 */
export interface ContextBuildOptions {
  /** 是否为本地小模型（≤7B），收紧预算 */
  isLocalModel?: boolean
  /** 是否为长上下文模型（128K+），放宽预算 */
  isLongContext?: boolean
  /** 预编译的章节意图（可选，提供则使用） */
  intent?: ChapterIntent
  /** 用户自定义注入内容 */
  userInjections?: string
  /** Skill 注入内容 */
  skillInjections?: string
  /** 最大前文摘要章数 */
  maxPreviousSummaries?: number
  /** 是否包含上一章末尾 */
  includeLastChapterEnding?: boolean
  /** 上一章末尾字数 */
  lastChapterEndingWordCount?: number
}
