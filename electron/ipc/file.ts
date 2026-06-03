/**
 * 项目文件操作 IPC 接口
 *
 * 重构说明：
 * - 原实现：meta.json + chapters/*.md 文件系统存储
 * - 新实现：SQLite 数据库（sql.js）存储
 * - IPC 接口签名保持兼容，渲染进程无需修改调用方式
 *
 * 数据库文件：<projectPath>/project.db
 */
import { ipcMain, dialog } from 'electron'
import { writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { rm, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { app } from 'electron'
import {
  getDatabase,
  loadDatabase,
  createDatabase,
  databaseExists,
  getDatabasePath,
  queryAll,
  queryOne,
  run,
  transaction
} from '../database/index'
import type { Database } from 'sql.js'
import { getFullProjectState, saveFullProjectState } from '../database/repositories/projectRepo'
import { getChapterById, updateChapterContent } from '../database/repositories/chapterRepo'

// ==================== 辅助函数 ====================

/**
 * 确保数据库目录存在
 */
function ensureDbDir(projectPath: string): void {
  const dir = dirname(getDatabasePath(projectPath))
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

/**
 * 从数据库加载完整项目状态（兼容现有 ProjectState 接口）
 */
function loadProjectStateFromDb(db: Database, projectPath: string): Record<string, any> {
  return getFullProjectState(db, projectPath)
}

/**
 * 将项目状态保存到数据库
 */
function saveProjectStateToDb(db: Database, projectPath: string, state: Record<string, any>): void {
  saveFullProjectState(db, state)
  // 保存到文件
  const data = db.export()
  writeFileSync(getDatabasePath(projectPath), Buffer.from(data))
}

// ==================== IPC 接口 ====================

/**
 * 读取项目元数据
 * IPC 签名：fs:readProject(projectPath) => ProjectState
 *
 * 兼容现有渲染进程调用方式
 */
ipcMain.handle('fs:readProject', async (_event, projectPath: string) => {
  try {
    const { db, save } = await getDatabase(projectPath)
    try {
      const state = loadProjectStateFromDb(db, projectPath)
      return state
    } finally {
      db.close()
    }
  } catch (error) {
    console.error('[DB] 读取项目失败:', error)
    throw error
  }
})

/**
 * 写入项目元数据
 * IPC 签名：fs:writeProject(projectPath, data) => void
 *
 * 兼容现有渲染进程调用方式
 */
ipcMain.handle('fs:writeProject', async (_event, projectPath: string, data: unknown) => {
  try {
    ensureDbDir(projectPath)
    let db: Database
    try {
      db = await loadDatabase(projectPath)
    } catch {
      db = await createDatabase(projectPath)
    }
    try {
      // data 是完整的 ProjectState，直接保存
      saveProjectStateToDb(db, projectPath, data as Record<string, any>)
    } finally {
      db.close()
    }
  } catch (error) {
    console.error('[DB] 写入项目失败:', error)
    throw error
  }
})

/**
 * 读取章节内容
 * IPC 签名：fs:readChapter(projectPath, chapterId) => string
 *
 * 章节正文存储在 chapters 表的 content 字段
 */
ipcMain.handle('fs:readChapter', async (_event, projectPath: string, chapterId: string) => {
  try {
    const { db } = await getDatabase(projectPath)
    try {
      const chapter = getChapterById(db, chapterId)
      return chapter?.content || ''
    } finally {
      db.close()
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return ''
    }
    console.error('[DB] 读取章节失败:', error)
    throw error
  }
})

/**
 * 写入章节内容
 * IPC 签名：fs:writeChapter(projectPath, chapterId, content) => void
 */
ipcMain.handle('fs:writeChapter', async (_event, projectPath: string, chapterId: string, content: string) => {
  try {
    const { db, save } = await getDatabase(projectPath)
    try {
      updateChapterContent(db, chapterId, content, content.length)
      save()
    } finally {
      db.close()
    }
  } catch (error) {
    console.error('[DB] 写入章节失败:', error)
    throw error
  }
})

/**
 * 创建新项目
 * IPC 签名：fs:createProject(projectPath, projectData) => boolean
 * 
 * 使用 saveProjectStateToDb 保存完整项目状态，确保数据一致性
 */
ipcMain.handle('fs:createProject', async (_event, projectPath: string, projectData: unknown) => {
  try {
    ensureDbDir(projectPath)
    
    const { db, save } = await getDatabase(projectPath)
    try {
      // 使用 saveProjectStateToDb 保存完整项目状态
      const state = projectData as Record<string, any>
      saveProjectStateToDb(db, projectPath, state)
      save()
    } finally {
      db.close()
    }

    return true
  } catch (error) {
    console.error('[DB] 创建项目失败:', error)
    throw error
  }
})

/**
 * 显示打开项目对话框
 */
ipcMain.handle('fs:openProjectDialog', async (_event) => {
  try {
    const result = await dialog.showOpenDialog({
      title: '打开项目',
      properties: ['openDirectory'],
      buttonLabel: '选择项目文件夹'
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const selectedPath = result.filePaths[0]
    const dbPath = getDatabasePath(selectedPath)

    // 验证是否是有效的项目目录
    if (!existsSync(dbPath)) {
      // 尝试迁移旧项目
      const metaPath = join(selectedPath, 'meta.json')
      if (existsSync(metaPath)) {
        await migrateFromMetaJson(selectedPath)
      } else {
        throw new Error('所选文件夹不是有效的项目目录（缺少 project.db 或 meta.json 文件）')
      }
    }

    return selectedPath
  } catch (error) {
    console.error('[DB] 打开项目对话框失败:', error)
    throw error
  }
})

/**
 * 显示选择目录对话框
 */
ipcMain.handle('fs:selectDirectoryDialog', async (_event) => {
  try {
    const result = await dialog.showOpenDialog({
      title: '选择项目存放位置',
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: '选择'
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  } catch (error) {
    console.error('[DB] 选择目录失败:', error)
    throw error
  }
})

/**
 * 删除项目目录
 */
ipcMain.handle('fs:deleteProject', async (_event, projectPath: string) => {
  try {
    if (!existsSync(projectPath)) {
      console.warn('[DB] 项目目录不存在:', projectPath)
      return true
    }

    await rm(projectPath, { recursive: true, force: true })
    return true
  } catch (error) {
    console.error('[DB] 删除项目失败:', error)
    throw error
  }
})

// ==================== 项目列表扫描 ====================

/**
 * 扫描项目目录，返回所有项目信息
 * IPC 签名：fs:scanProjectsDirectory(dirPath) => Array<{name, path, updatedAt}>
 *
 * 扫描指定目录下的所有子目录，查找包含 project.db 或 meta.json 的项目
 */
ipcMain.handle('fs:scanProjectsDirectory', async (_event, dirPath: string) => {
  try {
    if (!existsSync(dirPath)) {
      return []
    }

    const entries = readdirSync(dirPath, { withFileTypes: true })
    const projects: Array<{ name: string, path: string, updatedAt: number }> = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const projectPath = join(dirPath, entry.name)
      const dbPath = getDatabasePath(projectPath)
      const metaPath = join(projectPath, 'meta.json')

      // 检查是否是有效的项目目录
      if (!existsSync(dbPath) && !existsSync(metaPath)) continue

      try {
        let name = entry.name
        let updatedAt = 0

        if (existsSync(dbPath)) {
          // 从数据库读取项目信息
          const { db } = await getDatabase(projectPath)
          try {
            const project = queryOne(db, 'SELECT name, updated_at FROM projects LIMIT 1')
            if (project) {
              name = project.name || entry.name
              updatedAt = project.updated_at || 0
            }
          } finally {
            db.close()
          }
        } else if (existsSync(metaPath)) {
          // 从 meta.json 读取项目信息
          const metaContent = await readFile(metaPath, 'utf-8')
          const state = JSON.parse(metaContent)
          name = state.name || entry.name
          updatedAt = state.updatedAt || 0
        }

        projects.push({
          name,
          path: projectPath,
          updatedAt
        })
      } catch (err) {
        console.warn(`[Scan] 读取项目失败: ${projectPath}`, err)
        // 跳过无效项目，继续扫描
      }
    }

    // 按更新时间倒序排列
    projects.sort((a, b) => b.updatedAt - a.updatedAt)

    return projects
  } catch (error) {
    console.error('[Scan] 扫描项目目录失败:', error)
    throw error
  }
})

// ==================== 数据迁移 ====================

/**
 * 从 meta.json 迁移到 SQLite
 * @param projectPath - 项目根目录路径
 */
async function migrateFromMetaJson(projectPath: string): Promise<void> {
  const metaPath = join(projectPath, 'meta.json')

  if (!existsSync(metaPath)) {
    throw new Error(`meta.json 不存在: ${metaPath}`)
  }

  console.log(`[Migration] 开始迁移项目: ${projectPath}`)

  const metaContent = await readFile(metaPath, 'utf-8')
  const state = JSON.parse(metaContent)

  // 创建数据库
  const { db, save } = await getDatabase(projectPath)
  try {
    // 迁移项目基本信息
    run(db, `
      INSERT OR REPLACE INTO projects (
        id, name, project_type, creation_version,
        global_style, idea, created_at, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
    `, [
      state.name || '',
      state.projectType || 'novel',
      state.creationVersion || 'v1.0',
      state.globalStyle || '',
      state.idea || '',
      state.createdAt || Date.now(),
      state.updatedAt || Date.now()
    ])

    // 迁移世界观
    if (state.worldSettings) {
      const ws = state.worldSettings
      run(db, 'INSERT OR REPLACE INTO world_settings (id, genre, tone, rules) VALUES (1, ?, ?, ?)', [
        ws.genre || '', ws.tone || '', ws.rules || ''
      ])
      if (ws.locations) {
        for (const loc of ws.locations) {
          run(db, 'INSERT INTO world_locations (name) VALUES (?)', [loc])
        }
      }
    }

    // 迁移卷和章节
    if (state.volumes) {
      for (let i = 0; i < state.volumes.length; i++) {
        const vol = state.volumes[i]
        run(db, 'INSERT INTO volumes (id, title, sort_order) VALUES (?, ?, ?)', [
          vol.id, vol.title, i
        ])

        if (vol.chapters) {
          for (let j = 0; j < vol.chapters.length; j++) {
            const ch = vol.chapters[j]
            // 尝试读取章节正文
            let content = ''
            try {
              const chPath = join(projectPath, 'chapters', `${ch.id}.md`)
              if (existsSync(chPath)) {
                content = await readFile(chPath, 'utf-8')
              }
            } catch {
              // 忽略读取失败
            }

            run(db, `
              INSERT INTO chapters (id, volume_id, title, word_count, status, outline, content, sort_order)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              ch.id, vol.id, ch.title,
              content.length, ch.status || 'draft',
              (ch as any).outline || '',
              content, j
            ])
          }
        }
      }
    }

    // 迁移角色
    if (state.characters) {
      for (const char of state.characters) {
        run(db, `
          INSERT OR REPLACE INTO characters (
            id, name, role, gender, age, appearance, personality,
            background, abilities, motivation, arc, dialogue_style, description
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          char.id, char.name, char.role || 'supporting',
          char.gender || null, char.age || null,
          char.appearance || '', char.personality || '',
          char.background || '', char.abilities || '',
          char.motivation || '', char.arc || '',
          char.dialogueStyle || '', char.description || ''
        ])

        // 迁移角色关系
        if (char.relationships) {
          for (const rel of char.relationships) {
            run(db, `
              INSERT INTO character_relationships (character_id, related_character_id, relation)
              VALUES (?, ?, ?)
            `, [char.id, rel.characterId, rel.relation])
          }
        }
      }
    }

    // 迁移 StoryState
    if (state.storyState) {
      // story_world_state
      if (state.storyState.worldState) {
        const ws = state.storyState.worldState
        run(db, `
          INSERT OR REPLACE INTO story_world_state (
            id, current_timeline, active_conflicts, global_mood, last_updated_chapter
          ) VALUES (1, ?, ?, ?, ?)
        `, [
          ws.currentTimeline || '',
          JSON.stringify(ws.activeConflicts || []),
          ws.globalMood || '',
          ws.lastUpdatedChapter || ''
        ])
      }

      // story_character_states
      if (state.storyState.characterStates) {
        for (const [charId, s] of Object.entries(state.storyState.characterStates)) {
          const state_ = s as any
          run(db, `
            INSERT OR REPLACE INTO story_character_states (
              character_id, character_name, location, knowledge, inventory,
              relationships, physical_state, emotional_state, last_appearance
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            charId,
            state_.name || '',
            state_.location || '未知',
            JSON.stringify(state_.knowledge || []),
            JSON.stringify(state_.inventory || []),
            JSON.stringify(state_.relationships || {}),
            state_.physicalState || '健康',
            state_.emotionalState || '平静',
            state_.lastAppearance || ''
          ])
        }
      }

      // story_resource_ledger
      if (state.storyState.resourceLedger) {
        for (const [resId, entry] of Object.entries(state.storyState.resourceLedger)) {
          const e = entry as any
          run(db, `
            INSERT OR REPLACE INTO story_resource_ledger (resource_id, description, owner, status, last_mentioned)
            VALUES (?, ?, ?, ?, ?)
          `, [resId, e.description || '', e.owner || '', e.status || 'active', e.lastMentioned || ''])
        }
      }

      // story_pending_hooks
      if (state.storyState.pendingHooks) {
        for (const hook of state.storyState.pendingHooks) {
          run(db, `
            INSERT OR REPLACE INTO story_pending_hooks (
              hook_id, description, planted_chapter, related_characters,
              status, resolution, resolved_chapter, urgency
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            hook.id, hook.description || '', hook.plantedChapter || '',
            JSON.stringify(hook.relatedCharacters || []),
            hook.status || 'open', hook.resolution || null,
            hook.resolvedChapter || null, hook.urgency || 'medium'
          ])
        }
      }

      // story_chapter_summaries
      if (state.storyState.chapterSummaries) {
        for (const cs of state.storyState.chapterSummaries) {
          run(db, `
            INSERT OR REPLACE INTO story_chapter_summaries (
              chapter_id, summary, key_events, character_changes,
              new_hooks, resolved_hooks, word_count
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
            cs.chapterId, cs.summary || '',
            JSON.stringify(cs.keyEvents || []),
            JSON.stringify(cs.characterChanges || {}),
            JSON.stringify(cs.newHooks || []),
            JSON.stringify(cs.resolvedHooks || []),
            cs.wordCount || 0
          ])
        }
      }

      // story_emotion_trajectory
      if (state.storyState.emotionalArcs) {
        for (const [charId, arc] of Object.entries(state.storyState.emotionalArcs)) {
          for (const point of (arc as any).trajectory || []) {
            run(db, `
              INSERT OR REPLACE INTO story_emotion_trajectory (character_id, chapter_id, emotion, intensity)
              VALUES (?, ?, ?, ?)
            `, [charId, point.chapterId, point.emotion || '', point.intensity || 5])
          }
        }
      }

      // story_character_matrix
      if (state.storyState.characterMatrix) {
        for (const [charAId, row] of Object.entries(state.storyState.characterMatrix)) {
          for (const [charBId, entry] of Object.entries((row as any))) {
            const e = entry as any
            run(db, `
              INSERT OR REPLACE INTO story_character_matrix (
                character_a_id, character_b_id, has_met, shared_knowledge, last_interaction
              ) VALUES (?, ?, ?, ?, ?)
            `, [
              charAId, charBId,
              e.hasMet ? 1 : 0,
              JSON.stringify(e.sharedKnowledge || []),
              e.lastInteraction || ''
            ])
          }
        }
      }
    }

    save()
    console.log(`[Migration] 迁移完成: ${projectPath}`)
  } catch (error) {
    console.error('[Migration] 迁移失败:', error)
    throw error
  } finally {
    db.close()
  }
}
