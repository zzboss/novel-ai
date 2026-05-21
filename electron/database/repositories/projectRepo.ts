/**
 * 项目数据访问层 - Project Repository
 *
 * 负责 projects 表和 world_settings 表的读写操作
 */
import type { Database } from 'sql.js'
import { queryOne, queryAll, run, transaction } from '../index'
import { getChaptersByVolumeId } from './chapterRepo'

// ==================== 项目表操作 ====================

export function getProject(db: Database): any | null {
  const row = queryOne(db, 'SELECT * FROM projects WHERE id = 1')
  if (!row) return null

  return {
    id: row.id,
    name: row.name,
    projectType: row.project_type,
    creationVersion: row.creation_version,
    globalStyle: row.global_style,
    idea: row.idea,
    scriptMeta: row.script_meta ? JSON.parse(row.script_meta) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function upsertProject(db: Database, project: any): void {
  const existing = queryOne(db, 'SELECT id FROM projects WHERE id = 1')

  if (existing) {
    const fields: string[] = []
    const params: any[] = []
    if (project.name !== undefined) { fields.push('name = ?'); params.push(project.name) }
    if (project.projectType !== undefined) { fields.push('project_type = ?'); params.push(project.projectType) }
    if (project.creationVersion !== undefined) { fields.push('creation_version = ?'); params.push(project.creationVersion) }
    if (project.globalStyle !== undefined) { fields.push('global_style = ?'); params.push(project.globalStyle) }
    if (project.idea !== undefined) { fields.push('idea = ?'); params.push(project.idea) }
    if (project.scriptMeta !== undefined) { fields.push('script_meta = ?'); params.push(JSON.stringify(project.scriptMeta)) }
    if (project.updatedAt !== undefined) { fields.push('updated_at = ?'); params.push(project.updatedAt) }
    params.push(1)
    run(db, `UPDATE projects SET ${fields.join(', ')} WHERE id = ?`, params)
  } else {
    run(db, `
      INSERT INTO projects (id, name, project_type, creation_version, global_style, idea, script_meta, created_at, updated_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      project.name ?? null,
      project.projectType ?? null,
      project.creationVersion || 'v1.0',
      project.globalStyle || '',
      project.idea || '',
      project.scriptMeta ? JSON.stringify(project.scriptMeta) : null,
      project.createdAt ?? null,
      project.updatedAt ?? null
    ])
  }
}

// ==================== 世界观设定操作 ====================

export function getWorldSettings(db: Database): any {
  const row = queryOne(db, 'SELECT * FROM world_settings WHERE id = 1')
  if (!row) {
    return { genre: '', tone: '', rules: '', locations: [] }
  }

  // 获取地点列表
  const locations = queryAll(db, 'SELECT name FROM world_locations ORDER BY id')
    .map(r => r.name)

  return {
    genre: row.genre || '',
    tone: row.tone || '',
    rules: row.rules || '',
    locations
  }
}

export function upsertWorldSettings(db: Database, settings: any): void {
  const existing = queryOne(db, 'SELECT id FROM world_settings WHERE id = 1')

  if (existing) {
    const fields: string[] = []
    const params: any[] = []
    if (settings.genre !== undefined) { fields.push('genre = ?'); params.push(settings.genre) }
    if (settings.tone !== undefined) { fields.push('tone = ?'); params.push(settings.tone) }
    if (settings.rules !== undefined) { fields.push('rules = ?'); params.push(settings.rules) }
    params.push(1)
    run(db, `UPDATE world_settings SET ${fields.join(', ')} WHERE id = ?`, params)
  } else {
    run(db, `
      INSERT INTO world_settings (id, genre, tone, rules)
      VALUES (1, ?, ?, ?)
    `, [
      settings.genre || '',
      settings.tone || '',
      settings.rules || ''
    ])
  }

  // 同步更新地点表
  if (settings.locations !== undefined) {
    // 先删除旧地点
    run(db, 'DELETE FROM world_locations')
    // 插入新地点
    for (const loc of settings.locations) {
      run(db, 'INSERT INTO world_locations (name) VALUES (?)', [loc])
    }
  }
}

// ==================== 完整项目状态读写 ====================

/**
 * 从数据库读取完整 ProjectState
 */
export function getFullProjectState(db: Database, projectPath: string): any {
  const project = getProject(db)
  if (!project) return null

  const worldSettings = getWorldSettings(db)
  let volumes = getVolumesWithChapters(db)
  const characters = getCharacters(db)
  const storyState = getStoryState(db)

  // 防御性兜底：确保每个 volume 都有 content 字段
  volumes = volumes.map(vol => ({
    ...vol,
    content: vol.content ?? ''
  }))

  return {
    path: projectPath,
    name: project.name,
    projectType: project.projectType,
    creationVersion: project.creationVersion,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    globalStyle: project.globalStyle || '',
    idea: project.idea || '',
    scriptMeta: project.scriptMeta,
    worldSettings,
    volumes,
    characters,
    storyState
  }
}

/**
 * 将完整 ProjectState 写入数据库
 */
export function saveFullProjectState(db: Database, state: any): void {
  transaction(db, () => {
    // 保存项目基本信息
    upsertProject(db, {
      name: state.name,
      projectType: state.projectType,
      creationVersion: state.creationVersion,
      globalStyle: state.globalStyle,
      idea: state.idea,
      scriptMeta: state.scriptMeta,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt
    })

    // 保存世界观
    if (state.worldSettings) {
      upsertWorldSettings(db, state.worldSettings)
    }

    // 保存卷和章节
    if (state.volumes) {
      // 获取已有的章节完整数据，避免丢失
      const existingChapters = new Map()
      const allChapters = queryAll(db, 'SELECT * FROM chapters')
      for (const row of allChapters) {
        existingChapters.set(row.id, {
          volumeId: row.volume_id,
          title: row.title,
          wordCount: row.word_count,
          status: row.status,
          outline: row.outline || '',
          content: row.content || ''
        })
      }

      // 先删除已不存在的卷（保留orphan章节）
      const newVolumeIds = state.volumes.map((v: any) => v.id)
      const existingVolumes = queryAll(db, 'SELECT id FROM volumes')
      for (const row of existingVolumes) {
        if (!newVolumeIds.includes(row.id)) {
          // 将关联章节的 volume_id 设为 NULL
          run(db, 'UPDATE chapters SET volume_id = NULL WHERE volume_id = ?', [row.id])
          run(db, 'DELETE FROM volumes WHERE id = ?', [row.id])
        }
      }

      for (let i = 0; i < state.volumes.length; i++) {
        const vol = state.volumes[i]
        // Upsert 卷
        const existingVol = queryOne(db, 'SELECT id FROM volumes WHERE id = ?', [vol.id])
        if (existingVol) {
          run(db, 'UPDATE volumes SET title = ?, content = ?, sort_order = ? WHERE id = ?', [
            vol.title, (vol as any).content || '', i, vol.id
          ])
        } else {
          run(db, 'INSERT INTO volumes (id, title, content, sort_order) VALUES (?, ?, ?, ?)', [
            vol.id, vol.title, (vol as any).content || '', i
          ])
        }

        if (vol.chapters) {
          // 获取已有的章节 ID
          const newChapterIds = vol.chapters.map((ch: any) => ch.id)

          // 删除已不存在的章节
          const existingChaptersInVol = queryAll(db, 'SELECT id FROM chapters WHERE volume_id = ?', [vol.id])
          for (const row of existingChaptersInVol) {
            if (!newChapterIds.includes(row.id)) {
              run(db, 'DELETE FROM chapters WHERE id = ?', [row.id])
            }
          }

          for (let j = 0; j < vol.chapters.length; j++) {
            const ch = vol.chapters[j]
            const existing = existingChapters.get(ch.id)

            // Upsert 章节，保留已有数据
            const existingCh = queryOne(db, 'SELECT id FROM chapters WHERE id = ?', [ch.id])
            if (existingCh) {
              // 更新，但保留已有的 content 和 outline（如果新状态中没有）
              const content = (ch as any).content !== undefined ? (ch as any).content : (existing?.content || '')
              const outline = (ch as any).outline !== undefined ? (ch as any).outline : (existing?.outline || '')
              run(db, `
                UPDATE chapters SET
                  volume_id = ?, title = ?, word_count = ?, status = ?, outline = ?, content = ?, sort_order = ?
                WHERE id = ?
              `, [
                vol.id,
                ch.title,
                ch.wordCount ?? existing?.wordCount ?? 0,
                ch.status || existing?.status || 'draft',
                outline,
                content,
                j,
                ch.id
              ])
            } else {
              // 插入新章节
              run(db, `
                INSERT INTO chapters (id, volume_id, title, word_count, status, outline, content, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `, [
                ch.id, vol.id, ch.title,
                ch.wordCount || 0, ch.status || 'draft',
                (ch as any).outline || existing?.outline || '',
                existing?.content || '',
                j
              ])
            }
          }
        }
      }
    }

    // 保存角色
    if (state.characters) {
      run(db, 'DELETE FROM character_relationships')
      run(db, 'DELETE FROM characters')

      for (const char of state.characters) {
        run(db, `
          INSERT INTO characters (
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

        // 保存角色关系
        if (char.relationships && Array.isArray(char.relationships)) {
          for (const rel of char.relationships) {
            // 防御性：只有当 characterId 和 relation 都存在时才保存
            if (rel.characterId && rel.relation && char.id) {
              run(db, `
                INSERT INTO character_relationships (character_id, related_character_id, relation)
                VALUES (?, ?, ?)
              `, [char.id, rel.characterId, rel.relation])
            } else {
              console.warn('[saveFullProjectState] 跳过无效的角色关系:', {
                characterId: char.id,
                relatedCharacterId: rel.characterId,
                relation: rel.relation
              })
            }
          }
        }
      }
    }

    // 保存 StoryState
    if (state.storyState) {
      saveStoryState(db, state.storyState)
    }
  })
}

// ==================== 卷和章节操作（内部函数）====================

function getVolumesWithChapters(db: Database): any[] {
  const volumes = queryAll(db, 'SELECT * FROM volumes ORDER BY sort_order')
  return volumes.map(v => ({
    id: v.id,
    title: v.title,
    content: v.content || '',
    chapters: getChaptersByVolumeId(db, v.id).map(ch => ({
      ...ch,
      outline: ch.outline || ''
    }))
  }))
}

function getCharacters(db: Database): any[] {
  const rows = queryAll(db, 'SELECT * FROM characters')
  return rows.map(r => {
    const char: any = {
      id: r.id,
      name: r.name,
      role: r.role,
      gender: r.gender,
      age: r.age,
      appearance: r.appearance,
      personality: r.personality,
      background: r.background,
      abilities: r.abilities,
      motivation: r.motivation,
      arc: r.arc,
      dialogueStyle: r.dialogue_style,
      description: r.description
    }

    // 加载角色关系
    const rels = queryAll(db, 'SELECT * FROM character_relationships WHERE character_id = ?', [r.id])
    char.relationships = rels.map(rel => ({
      characterId: rel.related_character_id,
      relation: rel.relation
    }))

    return char
  })
}

// ==================== StoryState 操作（简化版，详细见 storyStateRepo）====================

function getStoryState(db: Database): any {
  // 读取 story_world_state
  const wsRow = queryOne(db, 'SELECT * FROM story_world_state WHERE id = 1')
  const worldState = wsRow ? {
    currentTimeline: wsRow.current_timeline || '',
    activeConflicts: JSON.parse(wsRow.active_conflicts || '[]'),
    globalMood: wsRow.global_mood || '',
    lastUpdatedChapter: wsRow.last_updated_chapter || ''
  } : { currentTimeline: '', activeConflicts: [], globalMood: '', lastUpdatedChapter: '' }

  // 读取 story_character_states
  const cssRows = queryAll(db, 'SELECT * FROM story_character_states')
  const characterStates: any = {}
  for (const row of cssRows) {
    characterStates[row.character_id] = {
      name: row.character_name,
      location: row.location,
      knowledge: JSON.parse(row.knowledge || '[]'),
      inventory: JSON.parse(row.inventory || '[]'),
      relationships: JSON.parse(row.relationships || '{}'),
      physicalState: row.physical_state,
      emotionalState: row.emotional_state,
      lastAppearance: row.last_appearance
    }
  }

  // 读取 story_resource_ledger
  const rlRows = queryAll(db, 'SELECT * FROM story_resource_ledger')
  const resourceLedger: any = {}
  for (const row of rlRows) {
    resourceLedger[row.resource_id] = {
      description: row.description || '',
      owner: row.owner || '',
      status: row.status || 'active',
      lastMentioned: row.last_mentioned || ''
    }
  }

  // 读取 story_pending_hooks
  const phRows = queryAll(db, 'SELECT * FROM story_pending_hooks')
  const pendingHooks = phRows.map(r => ({
    id: r.hook_id,
    description: r.description || '',
    plantedChapter: r.planted_chapter || '',
    relatedCharacters: JSON.parse(r.related_characters || '[]'),
    status: r.status || 'open',
    resolution: r.resolution || undefined,
    resolvedChapter: r.resolved_chapter || undefined,
    urgency: r.urgency || 'medium'
  }))

  // 读取 story_chapter_summaries
  const csRows = queryAll(db, 'SELECT * FROM story_chapter_summaries')
  const chapterSummaries = csRows.map(r => ({
    chapterId: r.chapter_id,
    summary: r.summary || '',
    keyEvents: JSON.parse(r.key_events || '[]'),
    characterChanges: JSON.parse(r.character_changes || '{}'),
    newHooks: JSON.parse(r.new_hooks || '[]'),
    resolvedHooks: JSON.parse(r.resolved_hooks || '[]'),
    wordCount: r.word_count || 0
  }))

  // 读取 story_emotion_trajectory
  const etRows = queryAll(db, 'SELECT * FROM story_emotion_trajectory')
  const emotionalArcs: any = {}
  for (const row of etRows) {
    if (!emotionalArcs[row.character_id]) {
      emotionalArcs[row.character_id] = { trajectory: [] }
    }
    emotionalArcs[row.character_id].trajectory.push({
      chapterId: row.chapter_id,
      emotion: row.emotion || '',
      intensity: row.intensity || 5
    })
  }

  // 读取 story_character_matrix
  const cmRows = queryAll(db, 'SELECT * FROM story_character_matrix')
  const characterMatrix: any = {}
  for (const row of cmRows) {
    if (!characterMatrix[row.character_a_id]) {
      characterMatrix[row.character_a_id] = {}
    }
    characterMatrix[row.character_a_id][row.character_b_id] = {
      hasMet: row.has_met === 1,
      sharedKnowledge: JSON.parse(row.shared_knowledge || '[]'),
      lastInteraction: row.last_interaction || ''
    }
  }

  return {
    worldState,
    characterStates,
    resourceLedger,
    pendingHooks,
    chapterSummaries,
    emotionalArcs,
    characterMatrix
  }
}

function saveStoryState(db: Database, storyState: any): void {
  // 保存 worldState
  const existingWs = queryOne(db, 'SELECT id FROM story_world_state WHERE id = 1')
  if (existingWs) {
    run(db, `
      UPDATE story_world_state SET
        current_timeline = ?, active_conflicts = ?, global_mood = ?, last_updated_chapter = ?
      WHERE id = 1
    `, [
      storyState.worldState?.currentTimeline || '',
      JSON.stringify(storyState.worldState?.activeConflicts || []),
      storyState.worldState?.globalMood || '',
      storyState.worldState?.lastUpdatedChapter || ''
    ])
  } else {
    run(db, `
      INSERT INTO story_world_state (id, current_timeline, active_conflicts, global_mood, last_updated_chapter)
      VALUES (1, ?, ?, ?, ?)
    `, [
      storyState.worldState?.currentTimeline || '',
      JSON.stringify(storyState.worldState?.activeConflicts || []),
      storyState.worldState?.globalMood || '',
      storyState.worldState?.lastUpdatedChapter || ''
    ])
  }

  // 保存 characterStates
  run(db, 'DELETE FROM story_character_states')
  if (storyState.characterStates) {
    for (const [charId, state] of Object.entries(storyState.characterStates)) {
      const s = state as any
      run(db, `
        INSERT INTO story_character_states (
          character_id, character_name, location, knowledge, inventory,
          relationships, physical_state, emotional_state, last_appearance
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        charId, s.name || '', s.location || '未知',
        JSON.stringify(s.knowledge || []),
        JSON.stringify(s.inventory || []),
        JSON.stringify(s.relationships || {}),
        s.physicalState || '健康',
        s.emotionalState || '平静',
        s.lastAppearance || ''
      ])
    }
  }

  // 保存 resourceLedger
  run(db, 'DELETE FROM story_resource_ledger')
  if (storyState.resourceLedger) {
    for (const [resId, entry] of Object.entries(storyState.resourceLedger)) {
      const e = entry as any
      run(db, `
        INSERT INTO story_resource_ledger (resource_id, description, owner, status, last_mentioned)
        VALUES (?, ?, ?, ?, ?)
      `, [resId, e.description || '', e.owner || '', e.status || 'active', e.lastMentioned || ''])
    }
  }

  // 保存 pendingHooks
  run(db, 'DELETE FROM story_pending_hooks')
  if (storyState.pendingHooks) {
    for (const hook of storyState.pendingHooks) {
      run(db, `
        INSERT INTO story_pending_hooks (
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

  // 保存 chapterSummaries
  run(db, 'DELETE FROM story_chapter_summaries')
  if (storyState.chapterSummaries) {
    for (const cs of storyState.chapterSummaries) {
      run(db, `
        INSERT INTO story_chapter_summaries (
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

  // 保存 emotionalArcs
  run(db, 'DELETE FROM story_emotion_trajectory')
  if (storyState.emotionalArcs) {
    for (const [charId, arc] of Object.entries(storyState.emotionalArcs)) {
      for (const point of (arc as any).trajectory || []) {
        run(db, `
          INSERT INTO story_emotion_trajectory (character_id, chapter_id, emotion, intensity)
          VALUES (?, ?, ?, ?)
        `, [charId, point.chapterId, point.emotion || '', point.intensity || 5])
      }
    }
  }

  // 保存 characterMatrix
  run(db, 'DELETE FROM story_character_matrix')
  if (storyState.characterMatrix) {
    for (const [charAId, row] of Object.entries(storyState.characterMatrix)) {
      for (const [charBId, entry] of Object.entries((row as any))) {
        const e = entry as any
        run(db, `
          INSERT INTO story_character_matrix (
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
