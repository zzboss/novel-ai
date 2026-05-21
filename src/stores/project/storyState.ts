import { project, markDirty } from './state'
import { createEmptyStoryState, initCharacterStatesFromProfiles } from '@/schemas/storyState'
import type { StoryState } from '@/schemas/storyState'

/** 安全的深拷贝，优先使用 structuredClone，降级到 JSON 序列化 */
function deepClone<T>(data: T): T {
  try {
    return structuredClone(data)
  } catch {
    return JSON.parse(JSON.stringify(data)) as T
  }
}

/**
 * 更新 StoryState
 */
export function updateStoryState(updater: (current: StoryState) => StoryState): void {
  if (!project.value) throw new Error('项目未加载')
  project.value.storyState = updater(project.value.storyState)
  markDirty()
}

/**
 * 保存当前 StoryState 为指定章节的快照
 * 应在章节内容保存后、StateExtractor 更新 StoryState 前调用
 * @param chapterId - 章节ID
 */
export function saveStateSnapshot(chapterId: string): void {
  if (!project.value) throw new Error('项目未加载')
  
  // 初始化 stateSnapshots
  if (!project.value.stateSnapshots) {
    project.value.stateSnapshots = {}
  }
  
  // 保存深拷贝
  project.value.stateSnapshots[chapterId] = deepClone(project.value.storyState)
  markDirty()
  
  console.log(`[ProjectStore] 已保存章节 ${chapterId} 的状态快照`)
}

/**
 * 回滚 StoryState 到指定章节生成前的状态
 * @param chapterId - 章节ID（该章节生成前的状态）
 * @returns 是否回滚成功
 */
export function rollbackStoryState(chapterId: string): boolean {
  if (!project.value) return false
  
  const snapshots = project.value.stateSnapshots
  if (!snapshots || !snapshots[chapterId]) {
    console.warn(`[ProjectStore] 未找到章节 ${chapterId} 的状态快照，无法回滚`)
    return false
  }
  
  // 回滚到快照状态
  project.value.storyState = deepClone(snapshots[chapterId])
  markDirty()
  
  console.log(`[ProjectStore] 已回滚章节 ${chapterId} 的状态`)
  return true
}

/**
 * 删除指定章节之后的所有状态快照（用于章节删除后清理）
 * @param chapterId - 起始章节ID
 */
export function deleteSnapshotsAfter(chapterId: string): void {
  if (!project.value?.stateSnapshots) return
  
  const snapshots = project.value.stateSnapshots
  
  // 找到该章节在全书中的位置
  let found = false
  for (const volume of project.value.volumes) {
    for (const chapter of volume.chapters) {
      if (found) {
        // 删除该章节之后的所有快照
        delete snapshots[chapter.id]
      }
      if (chapter.id === chapterId) {
        found = true
        delete snapshots[chapter.id] // 也删除当前章节的快照
      }
    }
  }
}
