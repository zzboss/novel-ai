/**
 * 章节细纲 API 调用层
 *
 * 封装 window.electronAPI.chapterOutline 调用
 */

import type { ChapterOutlineJSON } from '@/stores/agent/generators/chapter'
import { useProjectStore } from '@/stores/project'

/**
 * 获取章节细纲
 */
export async function getChapterOutline(chapterId: string): Promise<ChapterOutlineJSON | null> {
  const projectStore = useProjectStore()
  const projectPath = projectStore.project?.path
  if (!projectPath) return null

  try {
    const result = await window.electronAPI.chapterOutline.get(projectPath, chapterId)
    return result || null
  } catch (error) {
    console.error('[API] 获取章节细纲失败:', error)
    return null
  }
}

/**
 * 保存章节细纲
 */
export async function upsertChapterOutline(
  chapterId: string,
  outline: ChapterOutlineJSON
): Promise<void> {
  const projectStore = useProjectStore()
  const projectPath = projectStore.project?.path
  if (!projectPath) throw new Error('项目路径未设置')

  try {
    await window.electronAPI.chapterOutline.upsert(projectPath, chapterId, outline)
    projectStore.markDirty()
  } catch (error) {
    console.error('[API] 保存章节细纲失败:', error)
    throw error
  }
}

/**
 * 删除章节细纲
 */
export async function deleteChapterOutline(chapterId: string): Promise<void> {
  const projectStore = useProjectStore()
  const projectPath = projectStore.project?.path
  if (!projectPath) throw new Error('项目路径未设置')

  try {
    await window.electronAPI.chapterOutline.delete(projectPath, chapterId)
    projectStore.markDirty()
  } catch (error) {
    console.error('[API] 删除章节细纲失败:', error)
    throw error
  }
}
