/**
 * 状态更新器（对应 InkOS 的 Reflector）
 * 
 * 功能：
 * 1. 将 StateExtractorAgent 提取的事实增量合并到 StoryState
 * 2. 使用不可变更新（返回新的 StoryState 对象，不修改原对象）
 * 3. 通过 Zod Schema 校验更新后的 StoryState
 * 
 * 设计思路：
 * - 参考 InkOS 的 Reflector 模式
 * - 每次更新都生成新的 StoryState 对象（不可变）
 * - 使用 Zod Schema 校验，确保数据合法性
 */

import type { StoryState, CharacterState, PendingHook, ChapterSummary } from '@/schemas/storyState'
import { StoryStateSchema, CharacterStateSchema, PendingHookSchema, ChapterSummarySchema } from '@/schemas/storyState'

/**
 * 状态增量（State Delta）
 * 由 StateExtractorAgent.extract() 返回
 */
export interface StateDelta {
  /** 角色状态更新（角色ID → 部分角色状态） */
  characterStates: Record<string, Partial<CharacterState>>
  
  /** 资源台账更新（物品ID → 更新操作） */
  resourceUpdates: Record<string, {
    action: 'add' | 'update' | 'remove'
    data: any  // ResourceLedgerEntry 或部分字段
  }>
  
  /** 伏笔更新（添加/更新/回收） */
  hookUpdates: Array<{
    action: 'add' | 'update' | 'resolve'
    data: Partial<PendingHook>
  }>
  
  /** 章节摘要 */
  chapterSummary: Partial<ChapterSummary>
}

/**
 * 将状态增量合并到 StoryState（不可变更新）
 * 
 * @param currentState - 当前 StoryState
 * @param delta - 状态增量
 * @returns 新的 StoryState（通过 Zod Schema 校验）
 * 
 * @example
 * const newState = applyStateDelta(currentState, delta)
 * // currentState 不变，newState 是新的对象
 */
export function applyStateDelta(
  currentState: StoryState,
  delta: StateDelta
): StoryState {
  // 创建新的 StoryState 对象（不可变更新）
  const newState: StoryState = {
    // 深拷贝 worldState
    worldState: { ...currentState.worldState },
    
    // 深拷贝 characterStates
    characterStates: { ...currentState.characterStates },
    
    // 深拷贝 resourceLedger
    resourceLedger: { ...currentState.resourceLedger },
    
    // 深拷贝 pendingHooks（数组需要深拷贝）
    pendingHooks: [...currentState.pendingHooks],
    
    // 深拷贝 chapterSummaries（数组需要深拷贝）
    chapterSummaries: [...currentState.chapterSummaries],
    
    // 深拷贝 emotionalArcs
    emotionalArcs: { ...currentState.emotionalArcs },
    
    // 深拷贝 characterMatrix
    characterMatrix: { ...currentState.characterMatrix }
  }
  
  // 1. 更新 characterStates
  for (const [charId, partialState] of Object.entries(delta.characterStates)) {
    const existing = newState.characterStates[charId]
    
    if (existing) {
      // 更新现有角色状态
      newState.characterStates[charId] = {
        ...existing,
        ...partialState
      }
    } else {
      // 添加新角色状态（需要校验）
      const result = CharacterStateSchema.safeParse(partialState)
      if (result.success) {
        newState.characterStates[charId] = result.data
      } else {
        console.warn(`[StateUpdater] Invalid character state for ${charId}:`, result.error)
      }
    }
  }
  
  // 2. 更新 resourceLedger
  for (const [itemId, update] of Object.entries(delta.resourceUpdates)) {
    if (update.action === 'add') {
      // 添加新物品
      newState.resourceLedger[itemId] = update.data
    } else if (update.action === 'update') {
      // 更新现有物品
      if (newState.resourceLedger[itemId]) {
        newState.resourceLedger[itemId] = {
          ...newState.resourceLedger[itemId],
          ...update.data
        }
      }
    } else if (update.action === 'remove') {
      // 删除物品
      delete newState.resourceLedger[itemId]
    }
  }
  
  // 3. 更新 pendingHooks
  for (const hookUpdate of delta.hookUpdates) {
    if (hookUpdate.action === 'add') {
      // 添加新伏笔
      const result = PendingHookSchema.safeParse(hookUpdate.data)
      if (result.success) {
        newState.pendingHooks.push(result.data)
      } else {
        console.warn(`[StateUpdater] Invalid hook:`, result.error)
      }
    } else if (hookUpdate.action === 'update' || hookUpdate.action === 'resolve') {
      // 更新或回收现有伏笔
      const hookId = hookUpdate.data.id
      if (hookId) {
        const index = newState.pendingHooks.findIndex(h => h.id === hookId)
        if (index >= 0) {
          newState.pendingHooks[index] = {
            ...newState.pendingHooks[index],
            ...hookUpdate.data
          }
        }
      }
    }
  }
  
  // 4. 更新 chapterSummaries
  if (delta.chapterSummary && delta.chapterSummary.chapterId) {
    const chapterId = delta.chapterSummary.chapterId
    const index = newState.chapterSummaries.findIndex(s => s.chapterId === chapterId)
    
    if (index >= 0) {
      // 更新现有摘要
      newState.chapterSummaries[index] = {
        ...newState.chapterSummaries[index],
        ...delta.chapterSummary
      }
    } else {
      // 添加新摘要
      const result = ChapterSummarySchema.safeParse(delta.chapterSummary)
      if (result.success) {
        newState.chapterSummaries.push(result.data)
      } else {
        console.warn(`[StateUpdater] Invalid chapter summary:`, result.error)
      }
    }
  }
  
  // 5. 通过 Zod Schema 校验最终状态
  const validationResult = StoryStateSchema.safeParse(newState)
  if (!validationResult.success) {
    console.error('[StateUpdater] Invalid StoryState after merge:', validationResult.error)
    // 返回原状态，避免破坏数据
    return currentState
  }
  
  return validationResult.data
}

/**
 * 批量应用多个状态增量（不可变更新）
 * 
 * @param currentState - 当前 StoryState
 * @param deltas - 状态增量数组（按章节顺序）
 * @returns 新的 StoryState
 */
export function applyStateDeltas(
  currentState: StoryState,
  deltas: StateDelta[]
): StoryState {
  let state = currentState
  
  for (const delta of deltas) {
    state = applyStateDelta(state, delta)
  }
  
  return state
}

/**
 * 创建空的 StateDelta
 * 用于初始化或清空
 */
export function createEmptyStateDelta(): StateDelta {
  return {
    characterStates: {},
    resourceUpdates: {},
    hookUpdates: [],
    chapterSummary: {}
  }
}
