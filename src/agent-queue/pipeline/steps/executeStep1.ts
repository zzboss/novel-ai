/**
 * Step 1: 意图编译
 */

import type { StepResult, PipelineCallbacks } from '../../types'
import { compileChapterIntent } from '@/utils/intentCompiler'
import type { PipelineStep } from '../../types'
import { useProjectStore } from '@/stores/project'

/**
 * 执行 Step 1: 意图编译
 * @returns 执行结果和编译后的意图
 */
export async function executeStep1(
  chapterId: string,
  userIntent: string | undefined,
  targetWordCount: number | undefined,
  callbacks: PipelineCallbacks
): Promise<{ result: StepResult; intent: any }> {
  const step = getStepDefinition(1)
  callbacks.onStepStart?.(step)
  const startTime = Date.now()

  try {
    const projectStore = useProjectStore()
    const project = projectStore.project
    if (!project) throw new Error('没有打开的项目')

    const intent = compileChapterIntent(chapterId, project, project.storyState || null, {
      userIntent,
      targetWordCount
    })

    const result: StepResult = {
      step: 1,
      success: true,
      content: JSON.stringify(intent, null, 2),
      tokenEstimate: 0,
      duration: Date.now() - startTime,
      metadata: { intent }
    }

    return { result, intent }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    const result: StepResult = {
      step: 1,
      success: false,
      content: '',
      tokenEstimate: 0,
      duration: Date.now() - startTime,
      error
    }
    throw new Error(`步骤1「意图编译」失败: ${error}`)
  }
}

/**
 * 获取步骤定义
 */
function getStepDefinition(stepNumber: number): PipelineStep {
  const { PIPELINE_STEPS } = require('../../types')
  return PIPELINE_STEPS[stepNumber - 1]
}
