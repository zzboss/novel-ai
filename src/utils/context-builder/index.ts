/**
 * ContextBuilder 主入口
 * 
 * 上下文构建器（ContextBuilder）— 分层裁剪架构
 */

import type { AgentInput } from '@/agents/types'
import type { ProjectState } from '@/stores/project'
import type { StoryState } from '@/schemas/storyState'
import type { ChapterIntent } from '@/utils/intentCompiler'
import { estimateTokensChinese, selectTokenBudget, type TokenBudget } from '@/utils/tokenCounter'
import type { ContextPackage, ContextBuildOptions } from './types'
import { buildSystemPromptLayer } from './layers/systemPrompt'
import { buildWorldConstraintsLayer } from './layers/worldConstraints'
import { buildCharacterProfilesLayer } from './layers/characterProfiles'
import { buildPreviousSummariesLayer } from './layers/previousSummaries'
import { buildChapterContextLayer } from './layers/chapterContext'
import { buildForeshadowStateLayer } from './layers/foreshadowState'
import { compileRuleStack } from './layers/ruleStack'

/**
 * 构建完整的上下文包
 *
 * @param input - Agent 输入
 * @param project - 项目状态
 * @param storyState - StoryState（可选）
 * @param options - 构建选项
 * @returns 上下文包
 */
export function buildContextPackage(
  input: AgentInput,
  project: ProjectState,
  storyState: StoryState | null,
  options: ContextBuildOptions = {}
): ContextPackage {
  const budget = selectTokenBudget(options.isLocalModel, options.isLongContext)

  // 逐层构建并按预算裁剪
  const systemPrompt = buildSystemPromptLayer(input, project, budget)
  const worldConstraints = buildWorldConstraintsLayer(project, storyState, budget)
  const characterProfiles = buildCharacterProfilesLayer(input, project, storyState, budget, options)
  const previousSummaries = buildPreviousSummariesLayer(input, project, storyState, budget, options)
  const chapterContext = buildChapterContextLayer(input, project, options, budget)
  const foreshadowState = buildForeshadowStateLayer(storyState, budget, options)
  const skillContext = options.skillInjections || ''
  const userInjections = options.userInjections || ''

  // 编译规则栈
  const ruleStack = compileRuleStack(project)

  // 计算 Token 消耗
  const used = {
    total: 0,
    systemPrompt: estimateTokensChinese(systemPrompt),
    worldConstraints: estimateTokensChinese(worldConstraints),
    characterProfiles: estimateTokensChinese(characterProfiles),
    previousSummaries: estimateTokensChinese(previousSummaries),
    chapterContext: estimateTokensChinese(chapterContext),
    foreshadowState: estimateTokensChinese(foreshadowState),
    skillContext: estimateTokensChinese(skillContext),
    userInjections: estimateTokensChinese(userInjections)
  }
  used.total = used.systemPrompt + used.worldConstraints + used.characterProfiles +
    used.previousSummaries + used.chapterContext + used.foreshadowState +
    used.skillContext + used.userInjections

  return {
    systemPrompt,
    worldConstraints,
    characterProfiles,
    previousSummaries,
    chapterContext,
    foreshadowState,
    skillContext,
    userInjections,
    tokenBudget: {
      ...budget,
      used,
      totalUsed: used.total,
      remaining: budget.total - used.total
    },
    ruleStack
  }
}

/**
 * 将 ContextPackage 转换为 LLM messages 数组
 */
export function contextPackageToMessages(
  pkg: ContextPackage,
  userMessage: string
): Array<{ role: 'system' | 'user'; content: string }> {
  // 组装 system prompt
  const systemParts: string[] = []
  if (pkg.systemPrompt) systemParts.push(pkg.systemPrompt)
  if (pkg.worldConstraints) systemParts.push(pkg.worldConstraints)
  if (pkg.characterProfiles) systemParts.push(pkg.characterProfiles)
  if (pkg.foreshadowState) systemParts.push(pkg.foreshadowState)
  if (pkg.skillContext) systemParts.push(pkg.skillContext)

  // 组装 user message
  const userParts: string[] = []
  if (pkg.previousSummaries) userParts.push(pkg.previousSummaries)
  if (pkg.chapterContext) userParts.push(pkg.chapterContext)
  if (pkg.userInjections) userParts.push(`\n【用户补充】\n${pkg.userInjections}`)
  userParts.push(`\n${userMessage}`)

  return [
    { role: 'system', content: systemParts.join('\n\n') },
    { role: 'user', content: userParts.join('\n') }
  ]
}

// 重新导出类型
export type { ContextPackage, RuleStack, ContextBuildOptions } from './types'
