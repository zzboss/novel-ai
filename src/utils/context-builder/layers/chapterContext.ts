/**
 * 本章上下文层构建器
 */

import type { AgentInput } from '@/agents/types'
import type { ProjectState } from '@/stores/project'
import { estimateTokensChinese, type TokenBudget } from '@/utils/tokenCounter'
import type { ContextBuildOptions } from '../types'
import { trimToTokenBudget } from '../helpers'

/**
 * 构建本章上下文层
 */
export function buildChapterContextLayer(
  input: AgentInput,
  project: ProjectState,
  options: ContextBuildOptions,
  budget: TokenBudget
): string {
  const maxTokens = budget.chapterContext
  let content = ''

  if (options.intent) {
    // 使用预编译的章节意图
    const intent = options.intent
    content += `# 本章意图\n`
    content += `标题：${intent.chapterTitle}\n`
    content += `创作目标：${intent.creativeGoal}\n`

    if (intent.mustInclude.length > 0) {
      content += `必须包含：\n${intent.mustInclude.map(i => `- ${i}`).join('\n')}\n`
    }
    if (intent.mustAvoid.length > 0) {
      content += `必须避免：\n${intent.mustAvoid.map(i => `- ${i}`).join('\n')}\n`
    }
    if (intent.conflictStrategy) {
      content += `冲突策略：${intent.conflictStrategy}\n`
    }
    content += `目标字数：${intent.targetWordCount}字\n`

    if (intent.previousRecap) {
      content += `\n${intent.previousRecap}\n`
    }
  } else {
    // 降级：从 AgentInput 推导
    const chapterId = getChapterIdFromInput(input)
    if (chapterId) {
      const chapter = findChapter(project, chapterId)
      if (chapter) {
        content += `# 章节信息\n`
        content += `标题：${chapter.title}\n`
        content += `状态：${chapter.status}\n`
        content += `当前字数：${chapter.wordCount}\n`
      }
    }

    if (input.type === 'chapter' && input.outline) {
      content += `大纲概要：${input.outline}\n`
    }

    if (input.type === 'polish' || input.type === 'dialogue') {
      if ('content' in input && input.content) {
        content += `待处理内容：\n${input.content}\n`
      }
    }
  }

  return trimToTokenBudget(content, maxTokens)
}

/**
 * 从 AgentInput 中获取 chapterId
 */
function getChapterIdFromInput(input: AgentInput): string | null {
  if ('chapterId' in input && input.chapterId) {
    return input.chapterId
  }
  return null
}

/**
 * 在项目中查找章节
 */
function findChapter(
  project: ProjectState,
  chapterId: string
): { id: string; title: string; wordCount: number; status: string } | null {
  // 防御性检查：确保 volumes 和 chapters 存在
  for (const vol of (project.volumes || [])) {
    const ch = (vol.chapters || []).find(c => c.id === chapterId)
    if (ch) return ch
  }
  return null
}
