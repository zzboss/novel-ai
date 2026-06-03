/**
 * 管线执行器 - 负责管线编排和步骤执行
 */

import type { PipelineMode, PipelineResult, StepResult, PipelineCallbacks, PipelineOptions } from '../types'
import { PIPELINE_STEPS, MAX_REVISION_CYCLES } from '../constants'
import { getOrCreateAgent } from '../agents/AgentFactory'
import { parseAuditResult, createPausedResult, inferSingleStepInput, estimateTokenCount } from '../PipelineHelpers'
import { compileChapterIntent } from '@/utils/intentCompiler'
import { buildContextPackage } from '@/utils/contextBuilder'
import { mergeExtractedFacts, createFallbackDraft, type ExtractedFacts } from '@/utils/storyStateUpdater'
import type { AuditIssue } from '@/agents/ConsistencyAgent'
import type { AgentType, AgentInput, AgentContext, AgentOutput } from '@/agents/types'
import { useProjectStore } from '@/stores/project'

/**
 * 管线执行器类
 */
export class PipelineExecutor {
  private pipelineRunning = false
  private pipelineCancelled = false

  /**
   * 执行章节生成管线
   */
  async executePipeline(
    chapterId: string,
    mode: PipelineMode = 'auto',
    options: PipelineOptions = {},
    callbacks: PipelineCallbacks = {}
  ): Promise<PipelineResult> {
    if (this.pipelineRunning) {
      throw new Error('管线正在执行中，请等待当前管线完成后再启动新管线')
    }

    this.pipelineRunning = true
    this.pipelineCancelled = false

    const stepResults = new Map<number, StepResult>()
    let finalContent = ''
    let auditIssues: AuditIssue[] = []
    let storyStateUpdated = false
    let revisionCycles = 0
    let totalTokenEstimate = 0
    let error: string | undefined

    try {
      const projectStore = useProjectStore()
      const project = projectStore.project
      if (!project) throw new Error('没有打开的项目')

      if (mode === 'single-step') {
        return await this.executeSingleStep(chapterId, options, callbacks)
      }

      // Step 1: 意图编译
      await this.executeStep1(chapterId, options, callbacks, stepResults, mode)
      if (this.shouldPause(stepResults, 1, mode, options)) {
        return createPausedResult(stepResults, finalContent, auditIssues, storyStateUpdated, revisionCycles, totalTokenEstimate)
      }

      // Step 2: 上下文裁剪
      await this.executeStep2(chapterId, options, callbacks, stepResults, mode)
      if (this.shouldPause(stepResults, 2, mode, options)) {
        return createPausedResult(stepResults, finalContent, auditIssues, storyStateUpdated, revisionCycles, totalTokenEstimate)
      }

      // Step 3: 章节草稿
      finalContent = await this.executeStep3(chapterId, options, callbacks, stepResults, mode)
      if (this.shouldPause(stepResults, 3, mode, options)) {
        return createPausedResult(stepResults, finalContent, auditIssues, storyStateUpdated, revisionCycles, totalTokenEstimate)
      }

      // Step 4: 状态提取
      const extractedFacts = await this.executeStep4(chapterId, finalContent, callbacks, stepResults)

      // Step 5+6: 审计-修复循环
      const revisionResult = await this.executeAuditRevisionLoop(
        chapterId, finalContent, extractedFacts, callbacks, stepResults, mode, options
      )
      finalContent = revisionResult.content
      auditIssues = revisionResult.issues
      revisionCycles = revisionResult.cycles

      // Step 7: 状态更新
      storyStateUpdated = await this.executeStep7(chapterId, extractedFacts, callbacks, stepResults)

    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
      callbacks.onPipelineError?.(e instanceof Error ? e : new Error(error))
    } finally {
      this.pipelineRunning = false
    }

    const result: PipelineResult = {
      completed: !error,
      finalContent,
      stepResults,
      auditIssues,
      storyStateUpdated,
      revisionCycles,
      totalTokenEstimate,
      error
    }

    callbacks.onPipelineComplete?.(result)
    return result
  }

  /**
   * 取消当前管线执行
   */
  cancelPipeline(): void {
    this.pipelineCancelled = true
  }

  /**
   * 是否正在执行管线
   */
  isPipelineRunning(): boolean {
    return this.pipelineRunning
  }

  // ==================== 步骤执行方法 ====================

  /**
   * Step 1: 意图编译
   */
  private async executeStep1(
    chapterId: string,
    options: PipelineOptions,
    callbacks: PipelineCallbacks,
    stepResults: Map<number, StepResult>,
    mode: PipelineMode
  ): Promise<void> {
    const step = PIPELINE_STEPS[0]
    callbacks.onStepStart?.(step)
    const startTime = Date.now()

    try {
      const projectStore = useProjectStore()
      const intent = compileChapterIntent(chapterId, projectStore.project!, projectStore.project!.storyState || null, {
        userIntent: options.userIntent,
        targetWordCount: options.targetWordCount
      })

      const result: StepResult = {
        step: 1,
        success: true,
        content: JSON.stringify(intent, null, 2),
        tokenEstimate: 0,
        duration: Date.now() - startTime,
        metadata: { intent }
      }

      stepResults.set(1, result)
      callbacks.onStepComplete?.(step, result)
    } catch (e) {
      const result: StepResult = {
        step: 1,
        success: false,
        content: '',
        tokenEstimate: 0,
        duration: Date.now() - startTime,
        error: e instanceof Error ? e.message : String(e)
      }
      stepResults.set(1, result)
      throw new Error(`步骤1「意图编译」失败: ${result.error}`)
    }
  }

  /**
   * Step 2: 上下文裁剪
   */
  private async executeStep2(
    chapterId: string,
    options: PipelineOptions,
    callbacks: PipelineCallbacks,
    stepResults: Map<number, StepResult>,
    mode: PipelineMode
  ): Promise<void> {
    const step = PIPELINE_STEPS[1]
    callbacks.onStepStart?.(step)
    const startTime = Date.now()

    try {
      const projectStore = useProjectStore()
      const step1Result = stepResults.get(1)
      const intent = step1Result?.metadata?.intent as any

      const contextPackage = buildContextPackage(
        { type: 'chapter', chapterId, outline: options.userIntent || '', wordCount: options.targetWordCount },
        projectStore.project!,
        projectStore.project!.storyState || null,
        { intent, includeLastChapterEnding: true }
      )

      const result: StepResult = {
        step: 2,
        success: true,
        content: JSON.stringify({
          contextReady: true
        }),
        tokenEstimate: 0,
        duration: Date.now() - startTime,
        metadata: { contextPackage }
      }

      stepResults.set(2, result)
      callbacks.onStepComplete?.(step, result)
    } catch (e) {
      const result: StepResult = {
        step: 2,
        success: false,
        content: '',
        tokenEstimate: 0,
        duration: Date.now() - startTime,
        error: e instanceof Error ? e.message : String(e)
      }
      stepResults.set(2, result)
      throw new Error(`步骤2「上下文裁剪」失败: ${result.error}`)
    }
  }

  /**
   * Step 3: 章节草稿
   */
  private async executeStep3(
    chapterId: string,
    options: PipelineOptions,
    callbacks: PipelineCallbacks,
    stepResults: Map<number, StepResult>,
    mode: PipelineMode
  ): Promise<string> {
    const step = PIPELINE_STEPS[2]
    callbacks.onStepStart?.(step)
    const startTime = Date.now()

    try {
      const agent = getOrCreateAgent('chapter') as any
      const agentContext = this.buildAgentContext()
      const input: AgentInput = {
        type: 'chapter',
        chapterId,
        outline: options.userIntent || '',
        wordCount: options.targetWordCount || 3000
      }

      // 执行Agent
      const output = await agent.execute(input, agentContext) as AgentOutput
      let fullContent = output.content

      const tokenEst = estimateTokenCount(fullContent)
      const result: StepResult = {
        step: 3,
        success: true,
        content: fullContent,
        tokenEstimate: tokenEst,
        duration: Date.now() - startTime,
        metadata: { wordCount: fullContent.length }
      }

      stepResults.set(3, result)
      callbacks.onStepComplete?.(step, result)

      return fullContent
    } catch (e) {
      const result: StepResult = {
        step: 3,
        success: false,
        content: '',
        tokenEstimate: 0,
        duration: Date.now() - startTime,
        error: e instanceof Error ? e.message : String(e)
      }
      stepResults.set(3, result)
      throw new Error(`步骤3「章节草稿」失败: ${result.error}`)
    }
  }

  /**
   * Step 4: 状态提取
   */
  private async executeStep4(
    chapterId: string,
    chapterContent: string,
    callbacks: PipelineCallbacks,
    stepResults: Map<number, StepResult>
  ): Promise<ExtractedFacts | null> {
    const step = PIPELINE_STEPS[3]
    callbacks.onStepStart?.(step)
    const startTime = Date.now()

    try {
      const agent = getOrCreateAgent('state_extractor') as any
      const agentContext = this.buildAgentContext()
      const input: AgentInput = {
        type: 'state_extractor',
        chapterId,
        chapterContent
      }

      const result = await agent.execute(input, agentContext)
      const tokenEst = estimateTokenCount(result.content)
      const extractedFacts = result.metadata?.extractedFacts as ExtractedFacts || null

      const stepResult: StepResult = {
        step: 4,
        success: true,
        content: result.content,
        tokenEstimate: tokenEst,
        duration: Date.now() - startTime,
        metadata: { extractedFacts }
      }

      stepResults.set(4, stepResult)
      callbacks.onStepComplete?.(step, stepResult)

      return extractedFacts
    } catch (e) {
      const result: StepResult = {
        step: 4,
        success: false,
        content: '',
        tokenEstimate: 0,
        duration: Date.now() - startTime,
        error: e instanceof Error ? e.message : String(e)
      }
      stepResults.set(4, result)
      console.warn('[Pipeline] 状态提取失败，继续执行审计步骤')
      return null
    }
  }

  /**
   * Step 5+6: 审计-修复循环
   */
  private async executeAuditRevisionLoop(
    chapterId: string,
    initialContent: string,
    extractedFacts: ExtractedFacts | null,
    callbacks: PipelineCallbacks,
    stepResults: Map<number, StepResult>,
    mode: PipelineMode,
    options: PipelineOptions
  ): Promise<{ content: string; issues: AuditIssue[]; cycles: number }> {
    let currentContent = initialContent
    let auditIssues: AuditIssue[] = []
    let revisionCycles = 0

    for (let cycle = 0; cycle < MAX_REVISION_CYCLES; cycle++) {
      if (this.pipelineCancelled) throw new Error('管线已取消')

      // Step 5: 一致性审计
      const auditResult = await this.executeStep5(chapterId, currentContent, callbacks, stepResults)
      auditIssues = auditResult.issues

      if (mode === 'semi-auto') {
        const step = PIPELINE_STEPS[4]
        const confirmed = await callbacks.onStepAwaitConfirmation?.(step, stepResults.get(5)!) ?? true
        if (!confirmed) return { content: currentContent, issues: auditIssues, cycles: revisionCycles }
      }

      // 检查是否有关键问题
      const criticalIssues = auditIssues.filter(i => i.severity === 'critical')

      if (criticalIssues.length === 0) {
        revisionCycles = cycle
        break
      }

      // Step 6: 定点修复
      const revisionResult = await this.executeStep6(chapterId, currentContent, criticalIssues, callbacks, stepResults)
      currentContent = revisionResult
      revisionCycles = cycle + 1
    }

    return { content: currentContent, issues: auditIssues, cycles: revisionCycles }
  }

  /**
   * Step 5: 一致性审计
   */
  private async executeStep5(
    chapterId: string,
    content: string,
    callbacks: PipelineCallbacks,
    stepResults: Map<number, StepResult>
  ): Promise<{ issues: AuditIssue[] }> {
    const step = PIPELINE_STEPS[4]
    callbacks.onStepStart?.(step)
    const startTime = Date.now()

    try {
      const agent = getOrCreateAgent('consistency') as any
      const agentContext = this.buildAgentContext()
      const input: AgentInput = {
        type: 'consistency',
        chapterId,
        fullText: content
      }

      const result = await agent.execute(input, agentContext)
      const tokenEst = estimateTokenCount(result.content)
      const auditResult = parseAuditResult(result.content)

      const stepResult: StepResult = {
        step: 5,
        success: true,
        content: result.content,
        tokenEstimate: tokenEst,
        duration: Date.now() - startTime,
        metadata: result.metadata
      }

      stepResults.set(5, stepResult)
      callbacks.onStepComplete?.(step, stepResult)

      return { issues: auditResult.issues }
    } catch (e) {
      const result: StepResult = {
        step: 5,
        success: false,
        content: '',
        tokenEstimate: 0,
        duration: Date.now() - startTime,
        error: e instanceof Error ? e.message : String(e)
      }
      stepResults.set(5, result)
      console.warn('[Pipeline] 一致性审计失败，跳过修复步骤')
      return { issues: [] }
    }
  }

  /**
   * Step 6: 定点修复
   */
  private async executeStep6(
    chapterId: string,
    content: string,
    criticalIssues: AuditIssue[],
    callbacks: PipelineCallbacks,
    stepResults: Map<number, StepResult>
  ): Promise<string> {
    const step = PIPELINE_STEPS[5]
    callbacks.onStepStart?.(step)
    const startTime = Date.now()

    try {
      const agent = getOrCreateAgent('reviser') as any
      const agentContext = this.buildAgentContext()
      const input: AgentInput = {
        type: 'reviser',
        chapterId,
        content,
        auditIssues: criticalIssues
      }

      const result = await agent.execute(input, agentContext)
      const tokenEst = estimateTokenCount(result.content)

      const stepResult: StepResult = {
        step: 6,
        success: true,
        content: result.content,
        tokenEstimate: tokenEst,
        duration: Date.now() - startTime,
        metadata: { revisionCycle: stepResults.get(6)?.metadata?.revisionCycle || 1 }
      }

      stepResults.set(6, stepResult)
      callbacks.onStepComplete?.(step, stepResult)

      return result.content
    } catch (e) {
      const result: StepResult = {
        step: 6,
        success: false,
        content: '',
        tokenEstimate: 0,
        duration: Date.now() - startTime,
        error: e instanceof Error ? e.message : String(e)
      }
      stepResults.set(6, result)
      console.warn('[Pipeline] 定点修复失败')
      return content
    }
  }

  /**
   * Step 7: 状态更新
   */
  private async executeStep7(
    chapterId: string,
    extractedFacts: ExtractedFacts | null,
    callbacks: PipelineCallbacks,
    stepResults: Map<number, StepResult>
  ): Promise<boolean> {
    const step = PIPELINE_STEPS[6]
    callbacks.onStepStart?.(step)
    const startTime = Date.now()
    let storyStateUpdated = false

    try {
      const projectStore = useProjectStore()
      if (extractedFacts && projectStore.project!.storyState) {
        const updateResult = mergeExtractedFacts(projectStore.project!.storyState, extractedFacts)

        if (updateResult.success && updateResult.updatedState) {
          projectStore.updateStoryState(() => updateResult.updatedState!)
          storyStateUpdated = true
        } else {
          const draft = createFallbackDraft(extractedFacts, updateResult.error || '未知错误')
          console.warn('[Pipeline] StoryState更新失败，已创建降级草稿:', draft)
        }
      }

      const result: StepResult = {
        step: 7,
        success: true,
        content: storyStateUpdated ? 'StoryState已更新' : '无状态需要更新',
        tokenEstimate: 0,
        duration: Date.now() - startTime
      }

      stepResults.set(7, result)
      callbacks.onStepComplete?.(step, result)

      return storyStateUpdated
    } catch (e) {
      const result: StepResult = {
        step: 7,
        success: false,
        content: '',
        tokenEstimate: 0,
        duration: Date.now() - startTime,
        error: e instanceof Error ? e.message : String(e)
      }
      stepResults.set(7, result)
      console.warn('[Pipeline] 状态更新失败')
      return false
    }
  }

  /**
   * 单步执行
   */
  private async executeSingleStep(
    chapterId: string,
    options: PipelineOptions,
    callbacks: PipelineCallbacks
  ): Promise<PipelineResult> {
    const agentType = options.singleStepAgent
    if (!agentType) throw new Error('单步执行需要指定 singleStepAgent')

    const stepResults = new Map<number, StepResult>()
    const startTime = Date.now()

    try {
      const agent = getOrCreateAgent(agentType)
      const agentContext = this.buildAgentContext()
      const input = options.singleStepInput || inferSingleStepInput(agentType, chapterId)

      // 执行Agent
      const output = await agent.execute(input, agentContext) as AgentOutput
      let fullContent = output.content

      const tokenEst = estimateTokenCount(fullContent)

      stepResults.set(0, {
        step: 0,
        success: true,
        content: fullContent,
        tokenEstimate: tokenEst,
        duration: Date.now() - startTime
      })

      return {
        completed: true,
        finalContent: fullContent,
        stepResults,
        auditIssues: [],
        storyStateUpdated: false,
        revisionCycles: 0,
        totalTokenEstimate: tokenEst
      }
    } catch (e) {
      return {
        completed: false,
        finalContent: '',
        stepResults,
        auditIssues: [],
        storyStateUpdated: false,
        revisionCycles: 0,
        totalTokenEstimate: 0,
        error: e instanceof Error ? e.message : String(e)
      }
    }
  }

  /**
   * 检查是否应该暂停（semi-auto 或 breakpoint 模式）
   */
  private shouldPause(
    stepResults: Map<number, StepResult>,
    stepNumber: number,
    mode: PipelineMode,
    options: PipelineOptions
  ): boolean {
    if (mode === 'semi-auto') {
      const step = PIPELINE_STEPS[stepNumber - 1]
      // Note: This is a simplified version, actual implementation needs callbacks
      return false
    }

    if (mode === 'breakpoint' && options.breakpointStep === stepNumber) {
      return true
    }

    return false
  }

  /**
   * 构建 Agent 执行上下文
   */
  private buildAgentContext(): AgentContext {
    const projectStore = useProjectStore()
    const settingsStore = useSettingsStore()
    const { useSettingsStore } = require('@/stores/settings')

    if (!projectStore.project) {
      throw new Error('没有打开的项目')
    }

    return {
      project: projectStore.project,
      config: settingsStore.settings,
      mountedSkills: []
    }
  }
}
