import { ref, watch, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Editor } from '@tiptap/vue-3'

interface RunAgentOptions {
  type: string
  targetWordCount?: number
}

interface UseAgentRunnerOptions {
  projectStore: any
  agentStore: any
  chapterEditorRef: any
  tipTapEditor: Ref<Editor | null>
}

export interface UseAgentRunnerReturn {
  isStreaming: typeof isStreaming
  executingAgentName: typeof executingAgentName
  runAgent: typeof runAgent
  stopStreaming: typeof stopStreaming
}

const isStreaming = ref(false)
const executingAgentName = ref('')
const abortController = ref<AbortController | null>(null)
const lastStreamingLength = ref(0)

let _projectStore: any
let _agentStore: any
let _chapterEditorRef: any
let _tipTapEditor: Ref<Editor | null>

export function runAgent(optionsOrType: string | RunAgentOptions): Promise<void> {
  const opts: RunAgentOptions = typeof optionsOrType === 'string' ? { type: optionsOrType } : optionsOrType
  const { type, targetWordCount } = opts

  if (isStreaming.value) {
    ElMessage.warning('AI 正在生成中，请等待完成或停止')
    return Promise.resolve()
  }

  const chapterId = _projectStore.currentChapterId
  if (!chapterId) {
    ElMessage.warning('请先选择一个章节')
    return Promise.resolve()
  }

  abortController.value = new AbortController()
  isStreaming.value = true

  const nameMap: Record<string, string> = {
    chapter: '生成章节',
    continue: '续写',
    polish: '润色',
    modify: '修改',
    rewrite: '重写',
    dialogue: '对话优化'
  }
  executingAgentName.value = nameMap[type] || type

  if (type === 'chapter') {
    _chapterEditorRef.value?.clearContent()
    lastStreamingLength.value = 0
  } else {
    lastStreamingLength.value = 0
  }

  const pipelineOptions: Record<string, any> = { userIntent: type }
  if (targetWordCount) {
    pipelineOptions.targetWordCount = targetWordCount
  }

  return _agentStore.executeChapterPipeline(chapterId, 'auto', pipelineOptions)
    .then(() => {
      ElMessage.success('AI 生成完成')
    })
    .catch((err: Error) => {
      if (abortController.value?.signal.aborted) {
        ElMessage.info('已停止 AI 生成')
      } else {
        console.error('AI 生成失败:', err)
        ElMessage.error('AI 生成失败')
      }
    })
    .finally(() => {
      isStreaming.value = false
      executingAgentName.value = ''
      abortController.value = null
      lastStreamingLength.value = 0
      _projectStore.markDirty()
    })
}

export function stopStreaming(): void {
  if (abortController.value) {
    abortController.value.abort()
  }
  isStreaming.value = false
  executingAgentName.value = ''
  abortController.value = null
}

export function useAgentRunner(options: UseAgentRunnerOptions): UseAgentRunnerReturn {
  _projectStore = options.projectStore
  _agentStore = options.agentStore
  _chapterEditorRef = options.chapterEditorRef
  _tipTapEditor = options.tipTapEditor

  // 监听 agentStore 的流式输出，追加到编辑器
  watch(
    () => _agentStore.currentStreaming,
    (newContent: string) => {
      if (!isStreaming.value || !_tipTapEditor.value || !newContent) return

      const incremental = newContent.slice(lastStreamingLength.value)
      if (!incremental) return

      const html = incremental
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>')

      _tipTapEditor.value.commands.insertContent(html)
      lastStreamingLength.value = newContent.length
    }
  )

  return {
    isStreaming,
    executingAgentName,
    runAgent,
    stopStreaming,
  }
}
