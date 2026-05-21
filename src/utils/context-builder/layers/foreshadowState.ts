/**
 * 伏笔/状态层构建器
 */

import type { StoryState } from '@/schemas/storyState'
import { estimateTokensChinese, type TokenBudget } from '@/utils/tokenCounter'
import type { ContextBuildOptions } from '../types'

/**
 * 构建伏笔/状态层
 */
export function buildForeshadowStateLayer(
  storyState: StoryState | null,
  budget: TokenBudget,
  options: ContextBuildOptions
): string {
  const maxTokens = budget.foreshadowState
  if (!storyState) return ''

  let content = ''
  const relevantHookIds = options.intent?.relevantHookIds || []

  // 未闭合伏笔
  const openHooks = storyState.pendingHooks.filter(h =>
    h.status !== 'resolved' &&
    (relevantHookIds.length === 0 || relevantHookIds.includes(h.id))
  )

  if (openHooks.length > 0) {
    content += `# 未闭合伏笔\n`
    let currentTokens = estimateTokensChinese(content)

    for (const hook of openHooks) {
      let hookText = `- [${hook.urgency}紧迫]「${hook.description}」（埋于${hook.plantedChapter}）`
      if (hook.relatedCharacters.length > 0) {
        hookText += ` 相关角色：${hook.relatedCharacters.join('、')}`
      }
      hookText += '\n'

      const tokens = estimateTokensChinese(hookText)
      if (currentTokens + tokens > maxTokens) break

      content += hookText
      currentTokens += tokens
    }
  }

  return content
}
