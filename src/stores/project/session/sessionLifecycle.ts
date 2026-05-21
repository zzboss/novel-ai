import { session } from '../state'
import { saveSession } from './sessionManager'
import type { ProjectState, CreationSession, Character } from '@/types/project'
import { ProjectType as PT, StepInputMode, StepStatus } from '@/types/enums'
import type { CreationStep } from '@/stores/project'

/**
 * 创建新的创建会话
 */
export function startSession(projectName: string, projectPath: string): CreationSession {
  const now = Date.now()
  const newSession: CreationSession = {
    id: `session-${now}`,
    projectType: PT.NOVEL,
    projectName,
    projectPath,
    currentStep: 'type-select',
    steps: {},
    createdCharacters: [],
    createdAt: now,
    updatedAt: now,
    isEditMode: false
  }
  session.value = newSession
  // 自动保存到缓存
  saveSession()
  return newSession
}

/**
 * 从现有项目状态启动编辑模式的创建会话
 */
export function startEditSession(projectState: ProjectState): CreationSession {
  const now = Date.now()
  const steps: Partial<Record<CreationStep, any>> = {}

  // 灵感描述
  if (projectState.idea) {
    steps['idea'] = {
      step: 'idea',
      mode: StepInputMode.MANUAL,
      content: projectState.idea,
      aiGenerated: '',
      guidedAnswers: [],
      volumes: [],
      status: StepStatus.COMPLETED
    }
  }

  // 世界观：直接从项目数据恢复
  if (projectState.worldSettings?.rules?.trim()) {
    steps['world'] = {
      step: 'world',
      mode: StepInputMode.MANUAL,
      content: projectState.worldSettings.rules,
      aiGenerated: '',
      guidedAnswers: [],
      volumes: [],
      status: StepStatus.COMPLETED
    }
  }

  // 大纲：从 project.volumes 恢复（正确使用 content 字段）
  if (projectState.volumes?.length > 0) {
    // 构造 volumes 数据（带 content 和 chapters）
    const volumesForStep = projectState.volumes.map((v: ProjectState['volumes'][number], i: number) => ({
      id: v.id || `vol-${now}-${i}`,
      title: v.title.replace(/^第\d+[卷部分集]\s*[：:]\s*/, '').trim(),
      content: v.content || '',
      chapters: v.chapters || []
    }))

    steps['outline-1'] = {
      step: 'outline-1',
      mode: StepInputMode.MANUAL,
      content: '',
      aiGenerated: '',
      guidedAnswers: [],
      volumes: volumesForStep,
      status: StepStatus.COMPLETED
    }

    console.log('[startEditSession] 从 project.volumes 恢复 outline-1 步骤，卷数:', volumesForStep.length,
      'volumes 数据:', JSON.stringify(volumesForStep.map(v => ({ id: v.id, title: v.title, hasContent: !!(v.content?.trim()), chaptersCount: v.chapters?.length || 0 }))))
  }

  // 角色：加载到 createdCharacters（不存 step.content）
  const createdCharacters: Character[] = projectState.characters ? [...projectState.characters] : []

  const newSession: CreationSession = {
    id: `edit-session-${now}`,
    projectType: projectState.projectType || PT.NOVEL,
    projectName: projectState.name,
    projectPath: projectState.path,
    currentStep: 'idea',
    steps,
    createdCharacters,
    createdAt: now,
    updatedAt: now,
    isEditMode: true,
  }

  session.value = newSession
  // 自动保存到缓存
  saveSession()
  return newSession
}
