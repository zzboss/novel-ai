import { project, markDirty, isDirty, currentChapterId, selectedVolumeId } from './state'
import type { ProjectState, ProjectType } from '@/types/project'
import { createEmptyStoryState, initCharacterStatesFromProfiles } from '@/schemas/storyState'

/** 本地缓存键名 */
const STORAGE_KEY = 'aiwt-creation-session'

/**
 * 安全的深拷贝，优先使用 structuredClone，降级到 JSON 序列化
 */
function deepClone<T>(data: T): T {
  try {
    return structuredClone(data)
  } catch {
    return JSON.parse(JSON.stringify(data)) as T
  }
}

/**
 * 创建新项目
 */
export async function createProject(name: string, path: string, type: ProjectType = ProjectType.NOVEL): Promise<void> {
  const now = Date.now()
  const newProject: ProjectState = {
    path,
    name,
    projectType: type,
    creationVersion: 'v1.2',
    createdAt: now,
    updatedAt: now,
    volumes: [],
    characters: [],
    worldSettings: {
      genre: '',
      tone: '',
      rules: '',
      locations: []
    },
    globalStyle: '',
    idea: '',
    storyState: createEmptyStoryState()
  }

  // 创建项目文件
  await createProjectFile(newProject)

  // 加载到store
  project.value = newProject
  currentChapterId.value = ''
  selectedVolumeId.value = ''
}

/**
 * 打开已有项目
 */
export async function openProject(path: string): Promise<void> {
  try {
    const data = await window.electronAPI.readProject(path)
    const state: ProjectState = deepClone(data) as ProjectState

    project.value = state
    currentChapterId.value = ''
    selectedVolumeId.value = ''

    // 自动切换到第一个章节
    if (state.volumes[0]?.chapters[0]) {
      currentChapterId.value = state.volumes[0].chapters[0].id
      selectedVolumeId.value = state.volumes[0].id
    }
  } catch (error) {
    console.error('打开项目失败:', error)
    throw error
  }
}

/**
 * 删除项目
 */
export async function deleteProject(path: string, removeFiles: boolean = true): Promise<void> {
  try {
    // 如果当前打开的是被删除的项目，清空当前项目
    if (project.value && project.value.path === path) {
      project.value = null
      currentChapterId.value = ''
      selectedVolumeId.value = ''
      isDirty.value = false
    }

    // 删除项目文件
    if (removeFiles) {
      await window.electronAPI.deleteProject(path)
    }

  } catch (error) {
    console.error('删除项目失败:', error)
    throw error
  }
}

/**
 * 加载项目状态
 */
export function loadProject(projectState: ProjectState) {
  project.value = projectState
  isDirty.value = false
  currentChapterId.value = projectState.volumes.length > 0
    ? projectState.volumes[0].chapters[0]?.id || ''
    : ''
  selectedVolumeId.value = ''

  // 调试：检查加载的项目数据中 volumes[*].content 是否有内容
  console.log('[loadProject] 加载项目:', projectState.name, {
    volumesCount: projectState.volumes.length,
    volumes: projectState.volumes.map(v => ({
      id: v.id,
      title: v.title,
      contentLength: v.content?.length || 0,
      contentPreview: v.content ? v.content.substring(0, 50) + '...' : '(空)',
      chaptersCount: v.chapters?.length || 0
    }))
  })
}

/**
 * 创建新项目文件（内部方法）
 */
async function createProjectFile(state: ProjectState): Promise<void> {
  try {
    await window.electronAPI.createProject(state.path, deepClone(state))
  } catch (error) {
    console.error('创建项目文件失败:', error)
    throw error
  }
}
