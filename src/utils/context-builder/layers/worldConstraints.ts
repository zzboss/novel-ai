/**
 * 世界观约束层构建器
 */

import type { ProjectState } from '@/stores/project'
import type { StoryState } from '@/schemas/storyState'
import { estimateTokensChinese, type TokenBudget } from '@/utils/tokenCounter'
import { trimToTokenBudget } from '../helpers'

/**
 * 构建世界观约束层
 */
export function buildWorldConstraintsLayer(
  project: ProjectState,
  storyState: StoryState | null,
  budget: TokenBudget
): string {
  const maxTokens = budget.worldConstraints
  let content = ''

  content += `# 世界观约束\n`
  content += `规则：${project.worldSettings.rules}\n`

  if (project.worldSettings.locations.length > 0) {
    content += `重要地点：${project.worldSettings.locations.join('、')}\n`
  }

  // 从 StoryState 注入世界当前状态
  if (storyState) {
    content += `\n# 当前世界状态\n`
    if (storyState.worldState.currentTimeline) {
      content += `时间线：${storyState.worldState.currentTimeline}\n`
    }
    if (storyState.worldState.globalMood) {
      content += `全局氛围：${storyState.worldState.globalMood}\n`
    }
    if (storyState.worldState.activeConflicts.length > 0) {
      content += `活跃冲突：${storyState.worldState.activeConflicts.join('、')}\n`
    }
  }

  return trimToTokenBudget(content, maxTokens)
}
