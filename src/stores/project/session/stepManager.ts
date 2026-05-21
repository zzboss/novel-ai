import { session } from '../state'
import { saveSession } from './sessionManager'
import { saveProjectToFile } from './sessionOperations'
import type { CreationStep, StepState } from '@/stores/project'
import { getNextStep, getPrevStep, StepInputMode, StepStatus } from '@/stores/project'

/**
 * 获取当前步骤
 */
export function getCurrentStep(): CreationStep | null {
  return session.value?.currentStep || null
}

/**
 * 获取当前步骤状态
 */
export function getCurrentStepState(): StepState | null {
  if (!session.value) return null
  return session.value.steps[session.value.currentStep] || null
}

/**
 * 更新步骤状态
 */
export function updateStepState(step: CreationStep, updates: Partial<StepState>): void {
  if (!session.value) return

  const existing = session.value.steps[step] || {
    step,
    mode: StepInputMode.MANUAL,
    content: '',
    aiGenerated: '',
    status: StepStatus.PENDING,
    guidedAnswers: [],
    volumes: []
  }
  session.value.steps[step] = { ...existing, ...updates }
  session.value.updatedAt = Date.now()
  // 自动保存到缓存
  saveSession()
  
  // 异步保存到文件（SQLite），确保数据持久化，不阻塞UI
  saveProjectToFile()
}

/**
 * 切换到指定步骤
 */
export function goToStep(step: CreationStep): boolean {
  if (!session.value) return false
  session.value.currentStep = step
  session.value.updatedAt = Date.now()
  // 自动保存到缓存
  saveSession()
  return true
}

/**
 * 切换到下一步
 */
export function goToNextStep(): boolean {
  if (!session.value) return false
  const next = getNextStep(session.value.currentStep as CreationStep)
  if (!next) return false
  return goToStep(next)
}

/**
 * 切换到上一步
 */
export function goToPrevStep(): boolean {
  if (!session.value) return false
  const prev = getPrevStep(session.value.currentStep as CreationStep)
  if (!prev) return false
  return goToStep(prev)
}
