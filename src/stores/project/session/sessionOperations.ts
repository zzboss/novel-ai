import { session, isAiProcessing, aiProgressMessage, project, isDirty, markDirty } from '../state'
import type { ProjectState, Character } from '@/types/project'
import { ProjectType as PT, StepStatus } from '@/types/enums'
import type { CreationStep } from '@/stores/project'
import { canSkipStep } from '@/stores/project'
import { updateStepState, goToNextStep } from './stepManager'
import { saveSession, clearSavedSession } from '../session/sessionManager'
import { createEmptyStoryState, initCharacterStatesFromProfiles } from '@/schemas/storyState'

/** 安全的深拷贝 */
function deepClone<T>(data: T): T {
  try {
    return structuredClone(data)
  } catch {
    return JSON.parse(JSON.stringify(data)) as T
  }
}

/**
 * 完成当前步骤并进入下一步
 */
export function completeCurrentStep(): void {
  if (!session.value) return
  updateStepState(session.value.currentStep as CreationStep, { status: StepStatus.COMPLETED })
  goToNextStep()

  // 异步保存项目到文件（不阻塞UI）
  saveProjectToFile()
}

/**
 * 跳过当前步骤
 */
export function skipCurrentStep(): void {
  if (!session.value) return
  if (!canSkipStep(session.value.currentStep as CreationStep)) return
  // 只标记为跳过状态，保留原有内容（避免丢失用户已填写的设定）
  updateStepState(session.value.currentStep as CreationStep, { status: StepStatus.SKIPPED })
  goToNextStep()
}

/**
 * 设置项目类型
 */
export function setProjectType(type: typeof PT.NOVEL | typeof PT.SHORT_STORY | typeof PT.SCRIPT): void {
  if (!session.value) return
  session.value.projectType = type
  session.value.updatedAt = Date.now()
  // 自动保存到缓存
  saveSession()
  // 异步保存到文件（SQLite），确保数据持久化
  saveProjectToFile()
}

/**
 * 更新项目名称
 */
export function updateProjectName(name: string): void {
  if (!session.value) return
  session.value.projectName = name
  session.value.updatedAt = Date.now()
  // 自动保存到缓存
  saveSession()
  // 异步保存到文件（SQLite），确保数据持久化
  saveProjectToFile()
}

/**
 * 设置AI处理状态
 */
export function setAiProcessing(processing: boolean, message = ''): void {
  isAiProcessing.value = processing
  aiProgressMessage.value = message
}

/**
 * 清除创建会话
 */
export function clearSession(): void {
  session.value = null
  isAiProcessing.value = false
  aiProgressMessage.value = ''
  // 同时清除本地缓存（异步执行，不阻塞）
  clearSavedSession()
}

/**
 * 更新灵感描述
 * @param idea - 灵感内容（最大 10000 字，超出部分截断）
 */
export function updateIdea(idea: string): void {
  if (!project.value) {
    console.warn('[updateIdea] 项目未加载')
    return
  }
  // 限制最大长度 10000 字
  project.value.idea = idea.trim().slice(0, 10000)
  markDirty()
  console.log('[updateIdea] 灵感已更新')
}

/**
 * 保存当前会话状态到项目文件
 */
export async function saveProjectToFile(): Promise<void> {
  if (!session.value) return

  try {
    const projectState = generateProjectState()
    if (!projectState) return

    const path = session.value.projectPath
    if (!path) {
      console.warn('[Creation] 项目路径为空，无法保存')
      return
    }

    // 使用 writeProject 更新项目文件（而不是 createProject）
    await window.electronAPI.writeProject(path, deepClone(projectState))

    // 同步更新内存中的项目数据，确保 projectStore.project 与文件数据一致
    project.value = projectState
    isDirty.value = false

    console.log('[Creation] 项目已保存到文件并同步更新内存数据', projectState)
  } catch (error) {
    console.error('[Creation] 保存项目到文件失败:', error)
    // 不抛出错误，避免阻塞用户操作
  }
}

/**
 * 从创建会话生成项目状态
 */
export function generateProjectState(): ProjectState | null {
  if (!session.value) return null

  const now = Date.now()
  const ideaStep = session.value.steps['idea']
  const worldStep = session.value.steps['world']
  const outline1Step = session.value.steps['outline-1']

  // 直接从 outline1Step.volumes 获取卷数据（已包含 id, title, content, chapters）
  const stepVolumes = (outline1Step?.volumes || []) as Array<{
    id: string;
    title: string;
    content?: string;
    chapters: any[]
  }>

  // 调试：检查从 session 读取的 volumes 数据
  console.log('[generateProjectState] stepVolumes:', stepVolumes.map(v => ({
    id: v.id,
    title: v.title,
    contentLength: v.content?.length || 0,
    contentPreview: v.content ? v.content.substring(0, 50) + '...' : '(空)',
    chaptersCount: v.chapters?.length || 0
  })))

  // 转换卷数据，保留原始 ID 和完整内容
  const projectVolumes: ProjectState['volumes'] = stepVolumes.map((v, i) => ({
    id: v.id || `vol-${now}-${i}`,
    title: v.title || `第${i + 1}卷`,
    content: v.content || '',
    chapters: v.chapters || []
  }))

  // 如果没有卷，创建一个默认卷
  if (projectVolumes.length === 0) {
    projectVolumes.push({
      id: `vol-${now}`,
      title: '第一卷',
      content: '',
      chapters: []
    })
  }

  // 从创建会话中读取角色信息（使用 createdCharacters）
  const characters: Character[] = session.value.createdCharacters
    ? session.value.createdCharacters.map((c: Character) => ({ ...c, id: c.id || `char-${now}-${Math.random().toString(36).slice(2, 11)}` }))
    : []

  console.log('volumes', projectVolumes)

  return {
    path: session.value.projectPath,
    name: session.value.projectName,
    projectType: session.value.projectType,
    creationVersion: 'v1.2',
    createdAt: now,
    updatedAt: now,
    volumes: projectVolumes,
    characters,
    worldSettings: {
      genre: '',
      tone: '',
      rules: worldStep?.content || '',
      locations: []
    },
    globalStyle: '',
    idea: ideaStep?.content || '',
    storyState: {
      ...createEmptyStoryState(),
      characterStates: initCharacterStatesFromProfiles(characters)
    },
  }
}
