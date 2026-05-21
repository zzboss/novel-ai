import { project, markDirty, selectedVolumeId, currentChapterId } from './state'
import type { Volume, Chapter } from '@/types/project'
import { ChapterStatus } from '@/types/enums'
import { rollbackStoryState, deleteSnapshotsAfter } from './storyState'
import { createEmptyStoryState, initCharacterStatesFromProfiles } from '@/schemas/storyState'

/**
 * 设置当前章节
 */
export function setCurrentChapter(chapterId: string) {
  currentChapterId.value = chapterId
}

/**
 * 设置当前选中的卷 ID
 */
export function setSelectedVolume(volumeId: string): void {
  selectedVolumeId.value = volumeId
}

/**
 * 添加章节
 */
export function addChapter(volumeId: string, title: string): string {
  if (!project.value) throw new Error('项目未加载')

  const volume = project.value.volumes.find(v => v.id === volumeId)
  if (!volume) throw new Error('未找到指定的卷')

  const chapterId = `chapter-${Date.now()}`
  const chapterNumber = volume.chapters.length + 1
  
  volume.chapters.push({
    id: chapterId,
    title,
    chapterNumber,
    wordCount: 0,
    status: ChapterStatus.DRAFT
  })

  markDirty()
  return chapterId
}

/**
 * 删除章节
 * 会先回滚 StoryState 到该章节生成前的状态，再删除章节
 */
export function removeChapter(chapterId: string): void {
  if (!project.value) throw new Error('项目未加载')

  // 查找章节所在的卷和索引
  let targetVolume: typeof project.value.volumes[number] | null = null
  let targetIndex = -1

  for (const volume of project.value.volumes) {
    const index = volume.chapters.findIndex(c => c.id === chapterId)
    if (index !== -1) {
      targetVolume = volume
      targetIndex = index
      break
    }
  }

  if (!targetVolume || targetIndex === -1) {
    throw new Error('未找到指定的章节')
  }

  // 检查是否允许删除（只能从最后一章往前删除）
  const isLastChapter = targetIndex === targetVolume.chapters.length - 1
  if (!isLastChapter) {
    throw new Error('只能从最后一章开始往前删除，不能删除中间的章节，否则会导致状态异常')
  }

  // 回滚 StoryState 到该章节生成前的状态
  const rollbackSuccess = rollbackStoryState(chapterId)
  if (!rollbackSuccess) {
    console.warn(`[ProjectStore] 章节 ${chapterId} 无快照，将重置 StoryState`)
    project.value.storyState = createEmptyStoryState()
    project.value.storyState.characterStates = initCharacterStatesFromProfiles(project.value.characters)
  }

  // 删除该章节及之后所有章节的快照
  deleteSnapshotsAfter(chapterId)

  // 从卷中删除章节
  targetVolume.chapters.splice(targetIndex, 1)
  markDirty()

  console.log(`[ProjectStore] 已删除章节 ${chapterId}`)
}

/**
 * 更新章节标题
 */
export function updateChapterTitle(chapterId: string, title: string): void {
  if (!project.value) throw new Error('项目未加载')

  for (const volume of project.value.volumes) {
    const chapter = volume.chapters.find(c => c.id === chapterId)
    if (chapter) {
      chapter.title = title
      markDirty()
      return
    }
  }
}

/**
 * 更新章节字数
 */
export function updateChapterWordCount(chapterId: string, wordCount: number): void {
  if (!project.value) return

  for (const volume of project.value.volumes) {
    const chapter = volume.chapters.find(c => c.id === chapterId)
    if (chapter) {
      chapter.wordCount = wordCount
      return
    }
  }
}

/**
 * 添加新卷
 */
export function addVolume(title: string): string {
  if (!project.value) throw new Error('项目未加载')

  const volumeId = `vol-${Date.now()}`
  project.value.volumes.push({
    id: volumeId,
    title,
    content: '',
    chapters: []
  })

  markDirty()
  return volumeId
}

/**
 * 更新卷标题
 */
export function updateVolumeTitle(volumeId: string, newTitle: string): void {
  if (!project.value) throw new Error('项目未加载')

  const volume = project.value.volumes.find(v => v.id === volumeId)
  if (!volume) throw new Error('未找到指定的卷')

  volume.title = newTitle
  markDirty()
}

/**
 * 更新卷内容/简介
 */
export function updateVolumeContent(volumeId: string, newContent: string): void {
  if (!project.value) throw new Error('项目未加载')

  const volume = project.value.volumes.find(v => v.id === volumeId)
  if (!volume) throw new Error('未找到指定的卷')

  volume.content = newContent
  markDirty()
}
