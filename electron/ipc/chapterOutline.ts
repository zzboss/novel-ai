/**
 * 章节细纲 IPC 接口
 *
 * 处理章节细纲的 CRUD 操作
 */

import { ipcMain } from 'electron'
import { getDatabase } from '../database/index'
import {
  getFullChapterOutline,
  upsertChapterOutline,
  deleteChapterOutline
} from '../database/repositories/chapterOutlineRepo'

/**
 * 获取章节细纲
 * 参数：projectPath: string, chapterId: string
 * 返回：ChapterOutlineJSON | null
 */
ipcMain.handle('chapterOutline:get', async (_, projectPath: string, chapterId: string) => {
  const dbObj = await getDatabase(projectPath)
  if (!dbObj) {
    console.error('[chapterOutlineIPC] 数据库未加载:', projectPath)
    return null
  }
  return getFullChapterOutline(dbObj.db, chapterId)
})

/**
 * 保存章节细纲
 * 参数：projectPath: string, chapterId: string, outline: ChapterOutlineJSON
 */
ipcMain.handle('chapterOutline:upsert', async (_, projectPath: string, chapterId: string, outline: any) => {
  const dbObj = await getDatabase(projectPath)
  if (!dbObj) {
    console.error('[chapterOutlineIPC] 数据库未加载:', projectPath)
    throw new Error('数据库未加载')
  }
  const result = upsertChapterOutline(dbObj.db, chapterId, outline)
  dbObj.save()
  return result
})

/**
 * 删除章节细纲
 * 参数：projectPath: string, chapterId: string
 */
ipcMain.handle('chapterOutline:delete', async (_, projectPath: string, chapterId: string) => {
  const dbObj = await getDatabase(projectPath)
  if (!dbObj) {
    console.error('[chapterOutlineIPC] 数据库未加载:', projectPath)
    throw new Error('数据库未加载')
  }
  const result = deleteChapterOutline(dbObj.db, chapterId)
  dbObj.save()
  return result
})
