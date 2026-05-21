/**
 * StoryState 增量更新器（StoryStateUpdater）
 *
 * 管线 Step 7：状态更新（不调 LLM，程序化合并）
 * 输入：StateExtractorAgent 提取的事实 + 当前 StoryState
 * 输出：更新后的 StoryState
 *
 * 核心原则：
 * - 增量合并（Delta），不重写全量
 * - 不可变更新（Immutable Update）
 * - Schema 校验合并后的完整状态
 * - 校验失败则拒绝更新 + 降级保存草稿
 */

import type { StoryState, CharacterState, PendingHook, ChapterSummary } from '@/schemas/storyState'
import { validateStoryState } from '@/schemas/storyState'

/** 状态提取结果（StateExtractorAgent 输出的9维事实） */
export interface ExtractedFacts {
  /** 章节ID */
  chapterId: string

  /** 角色状态变更 */
  characterUpdates: Record<string, Partial<CharacterState>>

  /** 世界状态变更 */
  worldStateUpdate: {
    currentTimeline?: string
    activeConflicts?: string[]
    globalMood?: string
  }

  /** 新增资源 */
  newResources: Record<string, {
    description: string
    owner: string
    status: 'active' | 'consumed' | 'lost' | 'transferred'
  }>

  /** 资源状态变更 */
  resourceUpdates: Record<string, {
    owner?: string
    status?: 'active' | 'consumed' | 'lost' | 'transferred'
  }>

  /** 新埋伏笔 */
  newHooks: Array<{
    id: string
    description: string
    relatedCharacters: string[]
    urgency: 'low' | 'medium' | 'high'
  }>

  /** 伏笔状态变更 */
  hookUpdates: Record<string, {
    status: 'open' | 'progressing' | 'resolved'
    resolution?: string
  }>

  /** 章节摘要 */
  chapterSummary: {
    summary: string
    keyEvents: string[]
    characterChanges: Record<string, string>
    wordCount: number
  }

  /** 情感弧线变更 */
  emotionalUpdates: Record<string, {
    emotion: string
    intensity: number
  }>
}

/** 更新结果 */
export interface UpdateResult {
  /** 是否成功 */
  success: boolean
  /** 更新后的 StoryState（成功时） */
  updatedState?: StoryState
  /** 错误信息（失败时） */
  error?: string
  /** 合并的 Delta 摘要 */
  deltaSummary: {
    charactersUpdated: number
    resourcesUpdated: number
    hooksUpdated: number
    worldStateChanged: boolean
    newSummaryAdded: boolean
  }
}

/**
 * 增量合并提取的事实到 StoryState
 *
 * 流程：
 * 1. 校验事实 JSON 格式
 * 2. 与当前 StoryState diff（生成 Delta）
 * 3. 不可变合并（Immutable Update）
 * 4. Schema 校验合并后的完整状态
 *    - 通过 → 写入 ProjectState
 *    - 失败 → 拒绝更新 + 降级保存草稿
 *
 * @param currentState - 当前 StoryState
 * @param facts - 提取的事实
 * @returns 更新结果
 */
export function mergeExtractedFacts(
  currentState: StoryState,
  facts: ExtractedFacts
): UpdateResult {
  let charactersUpdated = 0
  let resourcesUpdated = 0
  let hooksUpdated = 0
  let worldStateChanged = false
  let newSummaryAdded = false

  try {
    // 1. 深拷贝当前状态（不可变更新）
    const newState: StoryState = JSON.parse(JSON.stringify(currentState))

    // 2. 合并世界状态
    if (facts.worldStateUpdate) {
      const ws = facts.worldStateUpdate
      if (ws.currentTimeline) {
        newState.worldState.currentTimeline = ws.currentTimeline
        worldStateChanged = true
      }
      if (ws.activeConflicts) {
        newState.worldState.activeConflicts = ws.activeConflicts
        worldStateChanged = true
      }
      if (ws.globalMood) {
        newState.worldState.globalMood = ws.globalMood
        worldStateChanged = true
      }
      newState.worldState.lastUpdatedChapter = facts.chapterId
    }

    // 3. 合并角色状态
    for (const [charId, updates] of Object.entries(facts.characterUpdates)) {
      const existing = newState.characterStates[charId]
      if (existing) {
        newState.characterStates[charId] = {
          ...existing,
          ...updates,
          // 确保 knowledge 和 inventory 是合并而非替换
          knowledge: updates.knowledge
            ? [...new Set([...existing.knowledge, ...updates.knowledge])]
            : existing.knowledge,
          inventory: updates.inventory
            ? [...new Set([...existing.inventory, ...updates.inventory])]
            : existing.inventory
        }
        charactersUpdated++
      } else {
        // 新角色，创建初始状态
        newState.characterStates[charId] = {
          name: updates.name || `角色${charId}`,
          location: updates.location || '未知',
          knowledge: updates.knowledge || [],
          inventory: updates.inventory || [],
          relationships: updates.relationships || {},
          physicalState: updates.physicalState || '健康',
          emotionalState: updates.emotionalState || '平静',
          lastAppearance: facts.chapterId
        }
        charactersUpdated++
      }
    }

    // 更新角色最后出场章节
    for (const charId of Object.keys(facts.characterUpdates)) {
      if (newState.characterStates[charId]) {
        newState.characterStates[charId].lastAppearance = facts.chapterId
      }
    }

    // 4. 合并资源台账
    for (const [resId, newRes] of Object.entries(facts.newResources)) {
      newState.resourceLedger[resId] = {
        description: newRes.description,
        owner: newRes.owner,
        status: newRes.status,
        lastMentioned: facts.chapterId
      }
      resourcesUpdated++
    }

    for (const [resId, resUpdate] of Object.entries(facts.resourceUpdates)) {
      const existing = newState.resourceLedger[resId]
      if (existing) {
        newState.resourceLedger[resId] = {
          ...existing,
          ...resUpdate,
          lastMentioned: facts.chapterId
        }
        resourcesUpdated++
      }
    }

    // 5. 合并伏笔
    for (const newHook of facts.newHooks) {
      const hook: PendingHook = {
        id: newHook.id,
        description: newHook.description,
        plantedChapter: facts.chapterId,
        relatedCharacters: newHook.relatedCharacters,
        status: 'open',
        urgency: newHook.urgency
      }
      newState.pendingHooks.push(hook)
      hooksUpdated++
    }

    for (const [hookId, hookUpdate] of Object.entries(facts.hookUpdates)) {
      const hookIdx = newState.pendingHooks.findIndex(h => h.id === hookId)
      if (hookIdx !== -1) {
        newState.pendingHooks[hookIdx] = {
          ...newState.pendingHooks[hookIdx],
          ...hookUpdate
        }
        if (hookUpdate.status === 'resolved') {
          newState.pendingHooks[hookIdx].resolvedChapter = facts.chapterId
        }
        hooksUpdated++
      }
    }

    // 6. 添加章节摘要
    const summary: ChapterSummary = {
      chapterId: facts.chapterId,
      summary: facts.chapterSummary.summary,
      keyEvents: facts.chapterSummary.keyEvents,
      characterChanges: facts.chapterSummary.characterChanges,
      newHooks: facts.newHooks.map(h => h.id),
      resolvedHooks: Object.entries(facts.hookUpdates)
        .filter(([, u]) => u.status === 'resolved')
        .map(([id]) => id),
      wordCount: facts.chapterSummary.wordCount
    }
    // 替换已有摘要或追加
    const existingIdx = newState.chapterSummaries.findIndex(
      s => s.chapterId === facts.chapterId
    )
    if (existingIdx !== -1) {
      newState.chapterSummaries[existingIdx] = summary
    } else {
      newState.chapterSummaries.push(summary)
    }
    newSummaryAdded = true

    // 7. 合并情感弧线
    for (const [charId, emotionalUpdate] of Object.entries(facts.emotionalUpdates)) {
      if (!newState.emotionalArcs[charId]) {
        newState.emotionalArcs[charId] = { trajectory: [] }
      }
      newState.emotionalArcs[charId].trajectory.push({
        chapterId: facts.chapterId,
        emotion: emotionalUpdate.emotion,
        intensity: emotionalUpdate.intensity
      })
    }

    // 8. 更新角色矩阵（信息边界）
    updateCharacterMatrix(newState, facts)

    // 9. Schema 校验
    const validation = validateStoryState(newState)
    if (!validation.success) {
      console.error('[StoryStateUpdater] Schema 校验失败:', validation.errors)
      return {
        success: false,
        error: `Schema 校验失败: ${validation.errors?.errors?.[0]?.message || '未知错误'}`,
        deltaSummary: { charactersUpdated, resourcesUpdated, hooksUpdated, worldStateChanged, newSummaryAdded }
      }
    }

    return {
      success: true,
      updatedState: newState,
      deltaSummary: { charactersUpdated, resourcesUpdated, hooksUpdated, worldStateChanged, newSummaryAdded }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[StoryStateUpdater] 合并失败:', error)
    return {
      success: false,
      error: `合并失败: ${message}`,
      deltaSummary: { charactersUpdated, resourcesUpdated, hooksUpdated, worldStateChanged, newSummaryAdded }
    }
  }
}

/**
 * 更新角色矩阵（信息边界）
 *
 * 规则：
 * - 同一章出场的角色互为「已相遇」
 * - 同一章出场的角色共享本章关键事件信息
 */
function updateCharacterMatrix(state: StoryState, facts: ExtractedFacts): void {
  const characterIds = Object.keys(facts.characterUpdates)
  if (characterIds.length < 2) return

  for (let i = 0; i < characterIds.length; i++) {
    for (let j = i + 1; j < characterIds.length; j++) {
      const charA = characterIds[i]
      const charB = characterIds[j]

      // 确保 A → B 和 B → A 都存在
      if (!state.characterMatrix[charA]) state.characterMatrix[charA] = {}
      if (!state.characterMatrix[charB]) state.characterMatrix[charB] = {}

      // 更新 A → B
      state.characterMatrix[charA][charB] = {
        hasMet: true,
        sharedKnowledge: [
          ...(state.characterMatrix[charA][charB]?.sharedKnowledge || []),
          ...facts.chapterSummary.keyEvents
        ].slice(-10), // 最多保留10条共享信息
        lastInteraction: facts.chapterId
      }

      // 更新 B → A
      state.characterMatrix[charB][charA] = {
        hasMet: true,
        sharedKnowledge: [
          ...(state.characterMatrix[charB][charA]?.sharedKnowledge || []),
          ...facts.chapterSummary.keyEvents
        ].slice(-10),
        lastInteraction: facts.chapterId
      }
    }
  }
}

/**
 * 从章节内容生成降级保存的草稿
 * 当 Schema 校验失败时，将原始事实保存为草稿以供手动修复
 */
export function createFallbackDraft(
  facts: ExtractedFacts,
  error: string
): {
  chapterId: string
  timestamp: number
  facts: ExtractedFacts
  error: string
} {
  return {
    chapterId: facts.chapterId,
    timestamp: Date.now(),
    facts,
    error
  }
}
