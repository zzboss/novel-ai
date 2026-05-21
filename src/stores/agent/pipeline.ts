import { useSettingsStore } from '@/stores/settings'
import { useProjectStore } from '@/stores/project'
import { setError, setProgressMessage, clearStreaming, setAiProcessing, appendToStreaming, pipelineRunning, pipelineCurrentStep, pipelineProgress } from './state'

/**
 * 执行章节生成管线
 *
 * @param chapterId - 章节ID
 * @param mode - 执行模式（auto/semi-auto/single-step/breakpoint）
 * @param options - 管线选项
 * @returns 管线执行结果
 */
export async function executeChapterPipeline(
  chapterId: string,
  mode: import('@/agent-queue/AgentQueueManager').PipelineMode = 'auto',
  options: {
    targetWordCount?: number
    userIntent?: string
    breakpointStep?: number
    singleStepAgent?: import('@/agents/types').AgentType
    singleStepInput?: import('@/agents/types').AgentInput
  } = {}
): Promise<import('@/agent-queue/AgentQueueManager').PipelineResult> {
  const { AgentQueueManager } = await import('@/agent-queue/AgentQueueManager')
  const queue = AgentQueueManager.getInstance()

  pipelineRunning.value = true
  setError(null)
  clearStreaming()

  try {
    const result = await queue.executePipeline(chapterId, mode, options, {
      onStepStart: (step) => {
        pipelineCurrentStep.value = step.name
        pipelineProgress.value = `正在执行：${step.name}...`
        setAiProcessing(true, `管线步骤 ${step.step}/7：${step.name}`)
        setProgressMessage(`管线步骤 ${step.step}/7：${step.name}`)
      },
      onStepComplete: (_step, stepResult) => {
        if (stepResult.success) {
          pipelineProgress.value = `步骤完成：${_step.name}（耗时${stepResult.duration}ms）`
        } else {
          pipelineProgress.value = `步骤失败：${_step.name} - ${stepResult.error}`
        }
      },
      onToken: (token) => {
        appendToStreaming(token)
      },
      onPipelineComplete: () => {
        pipelineRunning.value = false
        setAiProcessing(false)
        pipelineProgress.value = '管线执行完成'
      },
      onPipelineError: (err) => {
        pipelineRunning.value = false
        setAiProcessing(false)
        setError(err.message)
        pipelineProgress.value = `管线执行失败：${err.message}`
      }
    })

    return result
  } catch (err) {
    pipelineRunning.value = false
    setAiProcessing(false)
    const errorMsg = err instanceof Error ? err.message : '管线执行失败'
    setError(errorMsg)
    throw err
  } finally {
    pipelineCurrentStep.value = ''
  }
}

/**
 * 章节保存后自动触发状态更新
 *
 * 流程：
 * 1. 使用 StateExtractorAgent 提取9维事实
 * 2. 使用 SummaryAgent 生成章节摘要
 * 3. 使用 StoryStateUpdater 增量合并
 *
 * @param chapterId - 章节ID
 * @param chapterContent - 章节正文内容
 */
export async function triggerPostSaveUpdate(chapterId: string, chapterContent: string): Promise<void> {
  if (!chapterContent || chapterContent.trim().length === 0) return

  setAiProcessing(true, '正在更新章节状态...')
  setError(null)

  try {
    const settingsStore = useSettingsStore()
    const modelConfig = settingsStore.activeModel
    if (!modelConfig) return // 无模型配置则跳过

    const { StateExtractorAgent } = await import('@/agents/StateExtractorAgent')
    const { SummaryAgent } = await import('@/agents/SummaryAgent')
    const { mergeExtractedFacts, createFallbackDraft } = await import('@/utils/storyStateUpdater')

    const agentContext = {
      project: useProjectStore().project!,
      config: settingsStore.settings,
      mountedSkills: []
    }

    // Step 1: 状态提取
    setProgressMessage('正在提取章节状态...')
    const stateExtractor = new StateExtractorAgent()
    const extractResult = await stateExtractor.execute(
      { type: 'state_extractor', chapterId, chapterContent },
      agentContext
    )

    const extractedFacts = extractResult.metadata?.extractedFacts as any || null

    // Step 2: 摘要生成
    setProgressMessage('正在生成章节摘要...')
    const summaryAgent = new SummaryAgent()
    const summaryResult = await summaryAgent.execute(
      { type: 'summary', chapterId, chapterContent },
      agentContext
    )

    // Step 3: 增量合并
    if (extractedFacts) {
      setProgressMessage('正在更新StoryState...')
      const projectStore = useProjectStore()
      const currentState = projectStore.project?.storyState
      if (currentState) {
        const updateResult = mergeExtractedFacts(currentState, extractedFacts)
        if (updateResult.success && updateResult.updatedState) {
          projectStore.updateStoryState(() => updateResult.updatedState!)
          setProgressMessage('StoryState更新完成')
        } else {
          // 降级保存
          const draft = createFallbackDraft(extractedFacts, updateResult.error || '未知错误')
          console.warn('[PostSaveUpdate] StoryState更新失败，已创建降级草稿:', draft)
          setProgressMessage('StoryState更新失败，已保存草稿')
        }
      }
    }

    // 将摘要信息写入chapterSummaries（如果摘要生成成功）
    if (summaryResult.metadata?.summary) {
      const projectStore = useProjectStore()
      const parsed = summaryResult.metadata.summary as { summary: string; keyEvents: string[] }
      if (parsed?.summary) {
        projectStore.updateStoryState((current) => {
          const newSummaries = [...current.chapterSummaries]
          const existingIdx = newSummaries.findIndex(s => s.chapterId === chapterId)
          const newSummary = {
            chapterId,
            summary: parsed.summary,
            keyEvents: parsed.keyEvents || [],
            characterChanges: {},
            newHooks: [],
            resolvedHooks: [],
            wordCount: chapterContent.length
          }
          if (existingIdx !== -1) {
            newSummaries[existingIdx] = newSummary
          } else {
            newSummaries.push(newSummary)
          }
          return { ...current, chapterSummaries: newSummaries }
        })
      }
    }

  } catch (err) {
    console.error('[PostSaveUpdate] 章节保存后状态更新失败:', err)
    // 不抛出错误，保存后更新是辅助功能，不应阻断保存流程
  } finally {
    setAiProcessing(false)
  }
}
