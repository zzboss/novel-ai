/**
 * StoryState 数据访问层
 *
 * StoryState 包含 7 个子结构：
 * - worldState
 * - characterStates
 * - resourceLedger
 * - pendingHooks
 * - chapterSummaries
 * - emotionalArcs
 * - characterMatrix
 */
import type { Database } from 'sql.js'
import { queryAll, run } from '../index'

// ==================== World State ====================

export function getWorldState(db: Database): any {
  const r = queryAll(db, 'SELECT * FROM story_world_state WHERE id = 1')[0]
  if (!r) return { currentTimeline: '', activeConflicts: [], globalMood: '', lastUpdatedChapter: '' }
  return {
    currentTimeline: r.current_timeline || '',
    activeConflicts: JSON.parse(r.active_conflicts || '[]'),
    globalMood: r.global_mood || '',
    lastUpdatedChapter: r.last_updated_chapter || ''
  }
}

export function upsertWorldState(db: Database, state: any): void {
  const existing = queryAll(db, 'SELECT id FROM story_world_state WHERE id = 1')[0]
  if (existing) {
    run(db, `
      UPDATE story_world_state SET
        current_timeline = ?, active_conflicts = ?, global_mood = ?, last_updated_chapter = ?
      WHERE id = 1
    `, [
      state.currentTimeline || '',
      JSON.stringify(state.activeConflicts || []),
      state.globalMood || '',
      state.lastUpdatedChapter || ''
    ])
  } else {
    run(db, `
      INSERT INTO story_world_state (id, current_timeline, active_conflicts, global_mood, last_updated_chapter)
      VALUES (1, ?, ?, ?, ?)
    `, [
      state.currentTimeline || '',
      JSON.stringify(state.activeConflicts || []),
      state.globalMood || '',
      state.lastUpdatedChapter || ''
    ])
  }
}

// ==================== Character States ====================

export function getCharacterStates(db: Database): Record<string, any> {
  const rows = queryAll(db, 'SELECT * FROM story_character_states')
  const result: Record<string, any> = {}
  for (const r of rows) {
    result[r.character_id] = {
      name: r.character_name,
      location: r.location || '未知',
      knowledge: JSON.parse(r.knowledge || '[]'),
      inventory: JSON.parse(r.inventory || '[]'),
      relationships: JSON.parse(r.relationships || '{}'),
      physicalState: r.physical_state || '健康',
      emotionalState: r.emotional_state || '平静',
      lastAppearance: r.last_appearance || ''
    }
  }
  return result
}

export function upsertCharacterStates(db: Database, states: Record<string, any>): void {
  run(db, 'DELETE FROM story_character_states')
  for (const [charId, state] of Object.entries(states)) {
    run(db, `
      INSERT INTO story_character_states (
        character_id, character_name, location, knowledge, inventory,
        relationships, physical_state, emotional_state, last_appearance
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      charId,
      state.name || '',
      state.location || '未知',
      JSON.stringify(state.knowledge || []),
      JSON.stringify(state.inventory || []),
      JSON.stringify(state.relationships || {}),
      state.physicalState || '健康',
      state.emotionalState || '平静',
      state.lastAppearance || ''
    ])
  }
}

// ==================== Resource Ledger ====================

export function getResourceLedger(db: Database): Record<string, any> {
  const rows = queryAll(db, 'SELECT * FROM story_resource_ledger')
  const result: Record<string, any> = {}
  for (const r of rows) {
    result[r.resource_id] = {
      description: r.description || '',
      owner: r.owner || '',
      status: r.status || 'active',
      lastMentioned: r.last_mentioned || ''
    }
  }
  return result
}

export function upsertResourceLedger(db: Database, ledger: Record<string, any>): void {
  run(db, 'DELETE FROM story_resource_ledger')
  for (const [resId, entry] of Object.entries(ledger)) {
    run(db, `
      INSERT INTO story_resource_ledger (resource_id, description, owner, status, last_mentioned)
      VALUES (?, ?, ?, ?, ?)
    `, [
      resId,
      entry.description || '',
      entry.owner || '',
      entry.status || 'active',
      entry.lastMentioned || ''
    ])
  }
}

// ==================== Pending Hooks ====================

export function getPendingHooks(db: Database): any[] {
  const rows = queryAll(db, 'SELECT * FROM story_pending_hooks')
  return rows.map(r => ({
    id: r.hook_id,
    description: r.description || '',
    plantedChapter: r.planted_chapter || '',
    relatedCharacters: JSON.parse(r.related_characters || '[]'),
    status: r.status || 'open',
    resolution: r.resolution || undefined,
    resolvedChapter: r.resolved_chapter || undefined,
    urgency: r.urgency || 'medium'
  }))
}

export function upsertPendingHooks(db: Database, hooks: any[]): void {
  run(db, 'DELETE FROM story_pending_hooks')
  for (const hook of hooks) {
    run(db, `
      INSERT INTO story_pending_hooks (
        hook_id, description, planted_chapter, related_characters,
        status, resolution, resolved_chapter, urgency
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      hook.id,
      hook.description || '',
      hook.plantedChapter || '',
      JSON.stringify(hook.relatedCharacters || []),
      hook.status || 'open',
      hook.resolution || null,
      hook.resolvedChapter || null,
      hook.urgency || 'medium'
    ])
  }
}

// ==================== Chapter Summaries ====================

export function getChapterSummaries(db: Database): any[] {
  const rows = queryAll(db, 'SELECT * FROM story_chapter_summaries')
  return rows.map(r => ({
    chapterId: r.chapter_id,
    summary: r.summary || '',
    keyEvents: JSON.parse(r.key_events || '[]'),
    characterChanges: JSON.parse(r.character_changes || '{}'),
    newHooks: JSON.parse(r.new_hooks || '[]'),
    resolvedHooks: JSON.parse(r.resolved_hooks || '[]'),
    wordCount: r.word_count || 0
  }))
}

export function upsertChapterSummaries(db: Database, summaries: any[]): void {
  run(db, 'DELETE FROM story_chapter_summaries')
  for (const cs of summaries) {
    run(db, `
      INSERT INTO story_chapter_summaries (
        chapter_id, summary, key_events, character_changes,
        new_hooks, resolved_hooks, word_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      cs.chapterId,
      cs.summary || '',
      JSON.stringify(cs.keyEvents || []),
      JSON.stringify(cs.characterChanges || {}),
      JSON.stringify(cs.newHooks || []),
      JSON.stringify(cs.resolvedHooks || []),
      cs.wordCount || 0
    ])
  }
}

// ==================== Emotional Arcs ====================

export function getEmotionalArcs(db: Database): Record<string, { trajectory: any[] }> {
  const rows = queryAll(db, 'SELECT * FROM story_emotion_trajectory')
  const result: Record<string, { trajectory: any[] }> = {}
  for (const r of rows) {
    if (!result[r.character_id]) {
      result[r.character_id] = { trajectory: [] }
    }
    result[r.character_id].trajectory.push({
      chapterId: r.chapter_id,
      emotion: r.emotion || '',
      intensity: r.intensity || 5
    })
  }
  return result
}

export function upsertEmotionalArcs(db: Database, arcs: Record<string, { trajectory: any[] }>): void {
  run(db, 'DELETE FROM story_emotion_trajectory')
  for (const [charId, arc] of Object.entries(arcs)) {
    for (const point of arc.trajectory || []) {
      run(db, `
        INSERT INTO story_emotion_trajectory (character_id, chapter_id, emotion, intensity)
        VALUES (?, ?, ?, ?)
      `, [charId, point.chapterId, point.emotion || '', point.intensity || 5])
    }
  }
}

// ==================== Character Matrix ====================

export function getCharacterMatrix(db: Database): Record<string, Record<string, any>> {
  const rows = queryAll(db, 'SELECT * FROM story_character_matrix')
  const result: Record<string, Record<string, any>> = {}
  for (const r of rows) {
    if (!result[r.character_a_id]) {
      result[r.character_a_id] = {}
    }
    result[r.character_a_id][r.character_b_id] = {
      hasMet: r.has_met === 1,
      sharedKnowledge: JSON.parse(r.shared_knowledge || '[]'),
      lastInteraction: r.last_interaction || ''
    }
  }
  return result
}

export function upsertCharacterMatrix(db: Database, matrix: Record<string, Record<string, any>>): void {
  run(db, 'DELETE FROM story_character_matrix')
  for (const [charAId, row] of Object.entries(matrix)) {
    for (const [charBId, entry] of Object.entries(row)) {
      run(db, `
        INSERT INTO story_character_matrix (
          character_a_id, character_b_id, has_met, shared_knowledge, last_interaction
        ) VALUES (?, ?, ?, ?, ?)
      `, [
        charAId, charBId,
        entry.hasMet ? 1 : 0,
        JSON.stringify(entry.sharedKnowledge || []),
        entry.lastInteraction || ''
      ])
    }
  }
}

// ==================== 完整 StoryState ====================

export function getStoryState(db: Database): any {
  return {
    worldState: getWorldState(db),
    characterStates: getCharacterStates(db),
    resourceLedger: getResourceLedger(db),
    pendingHooks: getPendingHooks(db),
    chapterSummaries: getChapterSummaries(db),
    emotionalArcs: getEmotionalArcs(db),
    characterMatrix: getCharacterMatrix(db)
  }
}

export function upsertStoryState(db: Database, storyState: any): void {
  upsertWorldState(db, storyState.worldState)
  upsertCharacterStates(db, storyState.characterStates)
  upsertResourceLedger(db, storyState.resourceLedger)
  upsertPendingHooks(db, storyState.pendingHooks)
  upsertChapterSummaries(db, storyState.chapterSummaries)
  upsertEmotionalArcs(db, storyState.emotionalArcs)
  upsertCharacterMatrix(db, storyState.characterMatrix)
}
