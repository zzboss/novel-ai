/**
 * 卷数据访问层 - Volume Repository
 */
import type { Database } from 'sql.js'
import { queryAll, run } from '../index'
import { getChaptersByVolumeId } from './chapterRepo'

/**
 * 确保 volumes 表有 content 列（迁移兜底）
 */
function ensureVolumeContentColumn(db: Database): void {
  try {
    const cols = queryAll(db, `PRAGMA table_info(volumes)`)
    const hasContent = cols.some(r => r.name === 'content')
    if (!hasContent) {
      db.exec(`ALTER TABLE volumes ADD COLUMN content TEXT DEFAULT ''`)
      console.log('[VolumeRepo] 迁移完成：volumes 表已添加 content 列')
    }
  } catch (e) {
    console.error('[VolumeRepo] 检查 content 列失败:', e)
  }
}

export function getVolumes(db: Database): Array<{ id: string; title: string; content: string; sortOrder: number }> {
  // 迁移兜底：确保 content 列存在
  ensureVolumeContentColumn(db)
  return queryAll(db, 'SELECT id, title, content, sort_order FROM volumes ORDER BY sort_order')
    .map(r => ({ id: r.id, title: r.title, content: r.content ?? '', sortOrder: r.sort_order }))
}

export function getVolumeById(db: Database, id: string): { id: string; title: string; content: string } | null {
  const r = queryAll(db, 'SELECT id, title, content FROM volumes WHERE id = ?', [id])[0]
  return r ? { id: r.id, title: r.title, content: r.content || '' } : null
}

export function upsertVolume(db: Database, id: string, title: string, sortOrder: number, content?: string): void {
  const existing = queryAll(db, 'SELECT id FROM volumes WHERE id = ?', [id])[0]
  if (existing) {
    run(db, 'UPDATE volumes SET title = ?, sort_order = ?, content = ? WHERE id = ?', [title, sortOrder, content || '', id])
  } else {
    run(db, 'INSERT INTO volumes (id, title, content, sort_order) VALUES (?, ?, ?, ?)', [id, title, content || '', sortOrder])
  }
}

export function deleteVolume(db: Database, id: string): void {
  // 将关联章节的 volume_id 设为 NULL（保留孤儿章节）
  run(db, 'UPDATE chapters SET volume_id = NULL WHERE volume_id = ?', [id])
  run(db, 'DELETE FROM volumes WHERE id = ?', [id])
}

export function reorderVolumes(db: Database, order: Array<{ id: string; sortOrder: number }>): void {
  for (const item of order) {
    run(db, 'UPDATE volumes SET sort_order = ? WHERE id = ?', [item.sortOrder, item.id])
  }
}

export function getVolumesWithChapters(db: Database): Array<{ id: string; title: string; content: string; sortOrder: number; chapters: any[] }> {
  const volumes = getVolumes(db)
  return volumes.map(vol => ({
    ...vol,
    chapters: getChaptersByVolumeId(db, vol.id)
  }))
}
