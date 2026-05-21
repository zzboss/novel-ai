/**
 * 章节数据访问层 - Chapter Repository
 */
import type { Database } from 'sql.js'
import { queryAll, run } from '../index'

export interface ChapterRecord {
  id: string
  volumeId: string | null
  title: string
  wordCount: number
  status: string
  content: string
  sortOrder: number
}

export function getChapters(db: Database): ChapterRecord[] {
  return queryAll(db, 'SELECT * FROM chapters ORDER BY sort_order')
    .map(r => ({
      id: r.id,
      volumeId: r.volume_id || null,
      title: r.title,
      wordCount: r.word_count,
      status: r.status,
      content: r.content || '',
      sortOrder: r.sort_order
    }))
}

export function getChaptersByVolumeId(db: Database, volumeId: string): ChapterRecord[] {
  return queryAll(db, 'SELECT * FROM chapters WHERE volume_id = ? ORDER BY sort_order', [volumeId])
    .map(r => ({
      id: r.id,
      volumeId: r.volume_id || null,
      title: r.title,
      wordCount: r.word_count,
      status: r.status,
      content: r.content || '',
      sortOrder: r.sort_order
    }))
}

export function getChapterById(db: Database, id: string): ChapterRecord | null {
  const r = queryAll(db, 'SELECT * FROM chapters WHERE id = ?', [id])[0]
  if (!r) return null
  return {
    id: r.id,
    volumeId: r.volume_id || null,
    title: r.title,
    wordCount: r.word_count,
    status: r.status,
    content: r.content || '',
    sortOrder: r.sort_order
  }
}

export function upsertChapter(
  db: Database,
  id: string,
  volumeId: string | null,
  title: string,
  wordCount: number,
  status: string,
  content: string,
  sortOrder: number
): void {
  const existing = queryAll(db, 'SELECT id FROM chapters WHERE id = ?', [id])[0]
  if (existing) {
    run(db, `
      UPDATE chapters SET
        volume_id = ?, title = ?, word_count = ?, status = ?, content = ?, sort_order = ?
      WHERE id = ?
    `, [volumeId, title, wordCount, status, content, sortOrder, id])
  } else {
    run(db, `
      INSERT INTO chapters (id, volume_id, title, word_count, status, content, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, volumeId, title, wordCount, status, content, sortOrder])
  }
}

export function deleteChapter(db: Database, id: string): void {
  run(db, 'DELETE FROM chapters WHERE id = ?', [id])
}

export function updateChapterContent(db: Database, id: string, content: string, wordCount: number): void {
  run(db, 'UPDATE chapters SET content = ?, word_count = ? WHERE id = ?', [content, wordCount, id])
}

export function getOrphanedChapters(db: Database): ChapterRecord[] {
  return queryAll(db, 'SELECT * FROM chapters WHERE volume_id IS NULL ORDER BY sort_order')
    .map(r => ({
      id: r.id,
      volumeId: null,
      title: r.title,
      wordCount: r.word_count,
      status: r.status,
      content: r.content || '',
      sortOrder: r.sort_order
    }))
}
