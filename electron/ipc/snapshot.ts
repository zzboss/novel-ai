import { ipcMain } from 'electron'
import { readFile, writeFile, readdir, mkdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join, basename } from 'path'

/** 每个章节最多保留的快照数量 */
const MAX_SNAPSHOTS_PER_CHAPTER = 20

/** 快照元数据接口 */
interface SnapshotMeta {
  id: string
  chapterId: string
  timestamp: number
  wordCount: number
  label?: string
}

/**
 * 保存版本快照
 * @param _event - IPC 事件对象
 * @param projectPath - 项目根目录路径
 * @param chapterId - 章节 ID
 * @param content - 章节内容
 * @returns 快照 ID
 */
ipcMain.handle('snapshot:save', async (_event, projectPath: string, chapterId: string, content: string) => {
  try {
    const snapshotDir = join(projectPath, 'snapshots', chapterId)
    if (!existsSync(snapshotDir)) {
      await mkdir(snapshotDir, { recursive: true })
    }

    const timestamp = Date.now()
    const snapshotId = `${timestamp}`
    const snapshotPath = join(snapshotDir, `${snapshotId}.md`)
    const metaPath = join(snapshotDir, 'meta.json')

    // 保存快照内容
    await writeFile(snapshotPath, content, 'utf-8')

    // 更新元数据
    let metas: SnapshotMeta[] = []
    try {
      const metaContent = await readFile(metaPath, 'utf-8')
      metas = JSON.parse(metaContent)
    } catch {
      // 元数据文件不存在，创建新的
    }

    metas.push({
      id: snapshotId,
      chapterId,
      timestamp,
      wordCount: content.length
    })

    // 超出上限，删除最旧的快照
    if (metas.length > MAX_SNAPSHOTS_PER_CHAPTER) {
      const toDelete = metas.shift()!
      const deletePath = join(snapshotDir, `${toDelete.id}.md`)
      try {
        await unlink(deletePath)
      } catch (e) {
        console.error('删除旧快照失败:', e)
      }
    }

    await writeFile(metaPath, JSON.stringify(metas, null, 2), 'utf-8')
    return snapshotId
  } catch (error) {
    console.error('保存快照失败:', error)
    throw error
  }
})

/**
 * 列出章节的所有快照
 * @param _event - IPC 事件对象
 * @param projectPath - 项目根目录路径
 * @param chapterId - 章节 ID
 * @returns 快照元数据数组（按时间倒序）
 */
ipcMain.handle('snapshot:list', async (_event, projectPath: string, chapterId: string) => {
  try {
    const snapshotDir = join(projectPath, 'snapshots', chapterId)
    const metaPath = join(snapshotDir, 'meta.json')

    if (!existsSync(metaPath)) {
      return []
    }

    const metaContent = await readFile(metaPath, 'utf-8')
    const metas: SnapshotMeta[] = JSON.parse(metaContent)
    return metas.sort((a, b) => b.timestamp - a.timestamp)
  } catch (error) {
    console.error('列出快照失败:', error)
    return []
  }
})

/**
 * 还原快照
 * @param _event - IPC 事件对象
 * @param projectPath - 项目根目录路径
 * @param chapterId - 章节 ID
 * @param snapshotId - 快照 ID
 * @returns 快照内容字符串
 */
ipcMain.handle('snapshot:restore', async (_event, projectPath: string, chapterId: string, snapshotId: string) => {
  try {
    const snapshotPath = join(projectPath, 'snapshots', chapterId, `${snapshotId}.md`)
    const content = await readFile(snapshotPath, 'utf-8')
    return content
  } catch (error) {
    console.error('还原快照失败:', error)
    throw error
  }
})
