import { ipcMain } from 'electron'
import { writeFile, mkdir, readFile } from 'fs/promises'
import { join, basename } from 'path'
import { existsSync } from 'fs'

/**
 * 导出项目为 TXT 格式
 */
ipcMain.handle('export:txt', async (_event, projectPath: string, content: string, filename: string) => {
  try {
    const exportDir = join(projectPath, 'export')
    if (!existsSync(exportDir)) {
      await mkdir(exportDir, { recursive: true })
    }
    
    const filePath = join(exportDir, `${filename}.txt`)
    await writeFile(filePath, content, 'utf-8')
    return { success: true, filePath }
  } catch (error) {
    console.error('导出 TXT 失败:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 导出项目为 JSON 格式
 */
ipcMain.handle('export:json', async (_event, projectPath: string, data: any, filename: string) => {
  try {
    const exportDir = join(projectPath, 'export')
    if (!existsSync(exportDir)) {
      await mkdir(exportDir, { recursive: true })
    }
    
    const filePath = join(exportDir, `${filename}.json`)
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
    return { success: true, filePath }
  } catch (error) {
    console.error('导出 JSON 失败:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 导出项目为 Markdown 格式（支持分章节）
 */
ipcMain.handle('export:markdown', async (_event, projectPath: string, chapters: any[], title: string) => {
  try {
    const exportDir = join(projectPath, 'export')
    if (!existsSync(exportDir)) {
      await mkdir(exportDir, { recursive: true })
    }
    
    let markdown = `# ${title}\n\n`
    
    for (const chapter of chapters) {
      markdown += `## ${chapter.title || '未命名章节'}\n\n`
      markdown += `${chapter.content || ''}\n\n`
    }
    
    const filePath = join(exportDir, `${title}.md`)
    await writeFile(filePath, markdown, 'utf-8')
    return { success: true, filePath }
  } catch (error) {
    console.error('导出 Markdown 失败:', error)
    return { success: false, error: String(error) }
  }
})

/**
 * 获取导出目录路径
 */
ipcMain.handle('export:getDir', (_event, projectPath: string) => {
  return join(projectPath, 'export')
})
