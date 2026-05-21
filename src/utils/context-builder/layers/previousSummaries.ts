/**
 * 前文摘要层构建器（递减）
 */

import type { ProjectState } from '@/stores/project'
import type { StoryState } from '@/schemas/storyState'
import { estimateTokensChinese, type TokenBudget } from '@/utils/tokenCounter'
import type { ContextBuildOptions } from '../types'

/**
 * 构建前文摘要层
 */
export function buildPreviousSummariesLayer(
  input: any, // AgentInput
  project: ProjectState,
  storyState: StoryState | null,
  budget: TokenBudget,
  options: ContextBuildOptions
): string {
  const maxTokens = budget.previousSummaries
  const maxChapters = options.maxPreviousSummaries || 3

  if (!storyState || storyState.chapterSummaries.length === 0) return ''

  // 确定当前章节位置
  const chapterId = getChapterIdFromInput(input)
  if (!chapterId) return ''

  const allChapters = getAllChapterIds(project)
  const currentIdx = allChapters.indexOf(chapterId)
  if (currentIdx <= 0) return ''

  let content = `# 前文摘要\n`
  let currentTokens = estimateTokensChinese(content)

  // 取前 N 章摘要
  const summaries = storyState.chapterSummaries.filter(s => {
    const idx = allChapters.indexOf(s.chapterId)
    const startIdx = Math.max(0, currentIdx - maxChapters)
    return idx >= startIdx && idx < currentIdx
  }).sort((a, b) => {
    const idxA = allChapters.indexOf(a.chapterId)
    const idxB = allChapters.indexOf(b.chapterId)
    return idxA - idxB
  })

  for (const summary of summaries) {
    const ch = findChapter(project, summary.chapterId)
    let summaryText = `「${ch?.title || '未知'}」：${summary.summary}\n`

    const tokens = estimateTokensChinese(summaryText)
    if (currentTokens + tokens > maxTokens) break

    content += summaryText
    currentTokens += tokens
  }

  // 包含上一章末尾
  if (options.includeLastChapterEnding !== false && currentIdx > 0) {
    const endingCount = options.lastChapterEndingWordCount || 500
    // 注意：上一章正文需要从文件读取，此处仅放占位标记
    content += `\n[上一章末尾${endingCount}字]\n`
  }

  return content
}

/**
 * 从 AgentInput 中获取 chapterId
 */
function getChapterIdFromInput(input: any): string | null {
  if ('chapterId' in input && input.chapterId) {
    return input.chapterId
  }
  return null
}

/**
 * 获取项目中所有章节ID的有序列表
 */
function getAllChapterIds(project: ProjectState): string[] {
  const ids: string[] = []
  for (const vol of project.volumes) {
    for (const ch of vol.chapters) {
      ids.push(ch.id)
    }
  }
  return ids
}

/**
 * 在项目中查找章节
 */
function findChapter(
  project: ProjectState,
  chapterId: string
): { id: string; title: string; wordCount: number; status: string } | null {
  for (const vol of project.volumes) {
    const ch = vol.chapters.find(c => c.id === chapterId)
    if (ch) return ch
  }
  return null
}
