/**
 * 章节细纲数据访问层 - Chapter Outline Repository
 */

import type { Database } from 'sql.js'
import { queryAll, run } from '../index'
import type { ChapterOutlineJSON } from '../../types/project'

export interface ChapterOutlineRecord {
  id: string
  chapterId: string
  coreGoal: string
  plotProgression: string
  characterDevelopment: string
  nextChapterHook: string
  scenes: string // JSON string
  createdAt: number
  updatedAt: number
}

/**
 * 获取章节细纲
 */
export function getChapterOutline(db: Database, chapterId: string): ChapterOutlineJSON | null {
  const row = queryAll(db, 'SELECT * FROM chapter_outlines WHERE chapter_id = ?', [chapterId])[0]
  if (!row) return null

  try {
    return {
      chapterTitle: '', // 需要从 chapters 表获取
      chapterNumber: 0,  // 需要从 chapters 表和 volumes 表计算
      coreGoal: row.core_goal || '',
      plotProgression: row.plot_progression || '',
      characterDevelopment: row.character_development || '',
      nextChapterHook: row.next_chapter_hook || '',
      scenes: JSON.parse(row.scenes || '[]')
    }
  } catch (e) {
    console.error('[chapterOutlineRepo] 解析章节细纲失败:', e)
    return null
  }
}

/**
 * 插入或更新章节细纲
 */
export function upsertChapterOutline(
  db: Database,
  chapterId: string,
  data: ChapterOutlineJSON
): void {
  const now = Math.floor(Date.now() / 1000)
  const existing = queryAll(db, 'SELECT id FROM chapter_outlines WHERE chapter_id = ?', [chapterId])[0]

  const scenesJson = JSON.stringify(data.scenes || [])

  if (existing) {
    run(db, `
      UPDATE chapter_outlines SET
        core_goal = ?,
        plot_progression = ?,
        character_development = ?,
        next_chapter_hook = ?,
        scenes = ?,
        updated_at = ?
      WHERE chapter_id = ?
    `, [data.coreGoal, data.plotProgression, data.characterDevelopment,
        data.nextChapterHook,
        scenesJson, now, chapterId])
  } else {
    const id = `outline_${chapterId}`
    run(db, `
      INSERT INTO chapter_outlines (
        id, chapter_id, core_goal, plot_progression, character_development,
        next_chapter_hook,
        scenes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, chapterId, data.coreGoal, data.plotProgression, data.characterDevelopment,
        data.nextChapterHook,
        scenesJson, now, now])
  }
}

/**
 * 删除章节细纲
 */
export function deleteChapterOutline(db: Database, chapterId: string): void {
  run(db, 'DELETE FROM chapter_outlines WHERE chapter_id = ?', [chapterId])
}

/**
 * 获取章节标题和序号（用于填充 ChapterOutlineJSON）
 */
export function getChapterMeta(db: Database, chapterId: string): { title: string; chapterNumber: number } | null {
  const row = queryAll(db, `
    SELECT c.title, c.sort_order, v.sort_order as volume_sort
    FROM chapters c
    LEFT JOIN volumes v ON c.volume_id = v.id
    WHERE c.id = ?
  `, [chapterId])[0]

  if (!row) return null

  // 简单计算：章节序号 = sort_order + 1（如果没有卷结构）
  const chapterNumber = (row.sort_order || 0) + 1

  return {
    title: row.title || '',
    chapterNumber
  }
}

/**
 * 获取完整的章节细纲（包含 chapterTitle 和 chapterNumber）
 */
export function getFullChapterOutline(db: Database, chapterId: string): (ChapterOutlineJSON & { chapterTitle: string; chapterNumber: number }) | null {
  const outline = getChapterOutline(db, chapterId)
  const meta = getChapterMeta(db, chapterId)

  if (!outline || !meta) return null

  return {
    ...outline,
    chapterTitle: meta.title,
    chapterNumber: meta.chapterNumber
  }
}
