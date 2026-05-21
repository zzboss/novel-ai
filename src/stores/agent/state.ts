import { ref, computed } from 'vue'
import type { AgentTask } from '@/agent-queue/types'
import type { CreationStep } from '../project'

/**
 * ============================================================
 * Agent 状态管理
 * 管理 Agent 任务队列状态和流式输出内容
 * ============================================================
 */

/** 任务列表 */
export const tasks = ref<AgentTask[]>([])

/** 当前运行中的任务数量 */
export const runningCount = ref(0)

/** 当前流式输出内容 */
export const currentStreaming = ref('')

/** 当前处理步骤 */
export const currentStep = ref<CreationStep | null>(null)

/** 处理进度消息 */
export const progressMessage = ref('')

/** 处理错误 */
export const error = ref<string | null>(null)

/** AI处理状态 */
export const isAiProcessing = ref(false)

/** AI处理消息 */
export const aiProcessingMessage = ref('')

/** 管线执行状态 */
export const pipelineRunning = ref(false)

/** 管线当前步骤 */
export const pipelineCurrentStep = ref('')

/** 管线进度消息 */
export const pipelineProgress = ref('')

/**
 * 更新任务列表
 * @param newTasks - 新的任务列表
 */
export function updateTasks(newTasks: AgentTask[]) {
  tasks.value = newTasks
}

/**
 * 增加运行中的任务计数
 */
export function incrementRunning() {
  runningCount.value++
}

/**
 * 减少运行中的任务计数
 */
export function decrementRunning() {
  runningCount.value = Math.max(0, runningCount.value - 1)
}

/**
 * 设置当前流式输出内容（覆盖模式）
 * @param content - 新的流式输出内容
 */
export function setCurrentStreaming(content: string) {
  currentStreaming.value = content
}

/**
 * 追加 token 到流式输出内容
 * @param token - 要追加的 token 字符串
 */
export function appendToStreaming(token: string) {
  currentStreaming.value += token
}

/**
 * 清空流式输出内容
 */
export function clearStreaming() {
  currentStreaming.value = ''
}

/**
 * 设置当前处理步骤
 * @param step - 当前步骤
 */
export function setCurrentStep(step: CreationStep | null) {
  currentStep.value = step
}

/**
 * 设置进度消息
 * @param message - 进度消息
 */
export function setProgressMessage(message: string) {
  progressMessage.value = message
}

/**
 * 设置错误信息
 * @param err - 错误信息
 */
export function setError(err: string | null) {
  error.value = err
}

/**
 * 设置AI处理状态
 * @param processing - 是否正在处理
 * @param message - 处理消息（可选）
 */
export function setAiProcessing(processing: boolean, message?: string) {
  isAiProcessing.value = processing
  if (message !== undefined) {
    aiProcessingMessage.value = message
  }
}

/**
 * 清空所有状态
 */
export function clearAll() {
  currentStreaming.value = ''
  currentStep.value = null
  progressMessage.value = ''
  error.value = null
}

/** 是否有运行中的任务 */
export const hasRunningTasks = computed(() => runningCount.value > 0)

/** 是否有错误 */
export const hasError = computed(() => error.value !== null)
