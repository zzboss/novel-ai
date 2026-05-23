<template>
  <div class="chat-assistant h-full flex flex-col bg-[var(--el-bg-color-page)] border-l" style="border-color: var(--el-border-color); min-width: 300px; width: 300px">
    <!-- 面板头部 -->
    <div class="p-3 border-b flex items-center justify-between" style="border-color: var(--el-border-color)">
      <div class="text-sm font-medium">💬 AI 创作助手</div>
      <el-button
        size="small"
        text
        @click="clearChat"
        title="清空对话"
      >
        清空
      </el-button>
    </div>

    <!-- 对话区域 -->
    <div
      ref="messagesContainer"
      class="flex-1 overflow-y-auto p-3 space-y-3"
    >
      <!-- 上下文信息 -->
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-xs text-blue-800">
        <div class="font-medium mb-1">📖 创作上下文</div>
        <div v-if="chapterInfo" class="mb-1">{{ chapterInfo }}</div>
        <div v-if="storyStateSummary" class="mb-1">{{ storyStateSummary }}</div>
        <div v-if="previousSummary" class="text-blue-600">{{ previousSummary }}</div>
      </div>

      <ChatMessage
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
        @action="handleAction"
      />

      <!-- 加载状态 -->
      <div v-if="isLoading" class="flex gap-2">
        <div class="shrink-0 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">
          AI
        </div>
        <div class="text-sm text-[var(--el-text-color-placeholder)]">
          <el-icon class="is-loading"><Loading /></el-icon>
          正在思考...
        </div>
      </div>
    </div>

    <!-- 快捷操作栏 -->
    <div class="px-3 py-1.5 border-t flex flex-wrap gap-1" style="border-color: var(--el-border-color)">
      <el-button
        v-for="action in quickActions"
        :key="action.value"
        size="small"
        :type="action.type || 'default'"
        class="!text-xs"
        @click="handleQuickAction(action)"
      >
        {{ action.label }}
      </el-button>
    </div>

    <!-- 输入框 -->
    <div class="p-3 border-t" style="border-color: var(--el-border-color)">
      <div class="flex gap-2">
        <!-- 自定义输入框，支持行号标签 -->
        <div class="custom-input flex-1 min-h-[60px] max-h-[150px] overflow-y-auto border rounded p-2 text-sm" style="border-color: var(--el-border-color); background: var(--el-bg-color)">
          <div
            ref="inputAreaRef"
            class="input-area min-h-[40px] outline-none"
            contenteditable="true"
            @input="onInput"
            @keydown="onInputKeyDown"
            @keyup="onInputKeyUp"
            placeholder="和AI助手对话... Ctrl+Enter 发送"
          ></div>
        </div>
        <el-button
          v-if="isLoading"
          type="danger"
          @click="stopGeneration"
          class="self-end"
        >
          停止
        </el-button>
        <el-button
          v-else
          type="primary"
          :loading="false"
          :disabled="!hasInputContent"
          @click="sendMessage"
          class="self-end"
        >
          发送
        </el-button>
      </div>
      <div class="text-xs text-[var(--el-text-color-placeholder)] mt-1">
        Ctrl+Enter 发送 | Enter 换行
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onBeforeUnmount } from 'vue'
import { Loading, ChatDotRound } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import ChatMessage from './ChatMessage.vue'
import { WritingAssistantAgent } from '@/agents/WritingAssistantAgent'
import type { ChatAction } from '@/agents/WritingAssistantAgent'
import { useProjectStore } from '@/stores/project'
import { useAgentStore } from '@/stores/agent'
import { retrieve, enrichContext, isRAGReady } from '@/stores/project/ragRetriever'

// 自定义输入框引用
const inputAreaRef = ref<HTMLElement | null>(null)
const userInput = ref('') // 保留用于兼容
const hasInputContent = ref(false) // 使用 ref 而不是 computed，手动更新

// 更新 hasInputContent 状态
function updateInputStatus(): void {
  if (!inputAreaRef.value) {
    hasInputContent.value = false
    return
  }
  const text = inputAreaRef.value.textContent || ''
  const hasTags = inputAreaRef.value.querySelectorAll('.line-range-tag').length > 0
  hasInputContent.value = text.trim() !== '' || hasTags
}

// 从自定义输入框获取内容（纯文本 + 标签信息）
function getInputContent(): string {
  if (!inputAreaRef.value) return ''
  
  let content = ''
  for (const child of inputAreaRef.value.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      content += child.textContent
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement
      if (el.classList.contains('line-range-tag')) {
        // 标签内容作为特殊格式添加到输入中
        content += `[${el.textContent}]`
      } else {
        content += el.textContent || ''
      }
    }
  }
  return content
}

// 清空输入框
function clearInput(): void {
  if (inputAreaRef.value) {
    inputAreaRef.value.innerHTML = ''
    userInput.value = ''
    // 更新输入状态
    updateInputStatus()
  }
}

// 输入框事件处理
function onInput(): void {
  // 更新 userInput（用于兼容）
  userInput.value = getInputContent()
  // 更新输入状态
  updateInputStatus()
}

// 输入框按键处理
function onInputKeyDown(e: KeyboardEvent): void {
  // Ctrl+Enter 或 Cmd+Enter 发送
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    sendMessage()
    return
  }
  
  // 单独按 Enter 换行（默认行为，不需要阻止）
}

// 输入框按键释放处理（用于检测标签删除）
function onInputKeyUp(): void {
  // 延迟一下，确保 DOM 已经更新
  nextTick(() => {
    updateInputStatus()
  })
}

// 插入行号标签到输入框
function insertLineRangeTag(lineRange: string, selectedText: string): void {
  if (!inputAreaRef.value) return
  
  // 创建一个不可编辑的标签元素
  const tag = document.createElement('span')
  tag.className = 'line-range-tag'
  tag.contentEditable = 'false' // 作为整体删除
  tag.setAttribute('data-line-range', lineRange)
  tag.setAttribute('data-selected-text', selectedText)
  tag.textContent = lineRange
  
  // 直接设置样式，确保动态创建的元素样式正确
  tag.style.display = 'inline-flex'
  tag.style.alignItems = 'center'
  tag.style.padding = '2px 8px'
  tag.style.borderRadius = '4px'
  tag.style.fontSize = '12px'
  tag.style.fontWeight = '500'
  tag.style.backgroundColor = 'rgb(219, 234, 254)'
  tag.style.color = 'rgb(30, 64, 175)'
  tag.style.marginRight = '4px'
  tag.style.whiteSpace = 'nowrap'
  
  // 在输入框末尾添加标签
  inputAreaRef.value.appendChild(tag)
  
  // 聚焦输入框，并将光标放在标签后面
  inputAreaRef.value.focus()
  const range = document.createRange()
  range.selectNodeContents(inputAreaRef.value)
  range.collapse(false) // 折叠到末尾
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
  
  // 更新输入状态
  updateInputStatus()
}

// 设置输入框内容（用于快捷操作）
function setInputContent(content: string): void {
  if (!inputAreaRef.value) return
  inputAreaRef.value.textContent = content
  userInput.value = content
  updateInputStatus()
}

// 在组件挂载时注册全局函数，供 ChapterEditor 调用
onMounted(() => {
  // 注册全局函数
  ;(window as any).__addLineRangeToAssistant = insertLineRangeTag
  
  // 立即更新一次
  updateEditorContext()
  // 每500ms更新一次（监听选择变化）
  contextUpdateTimer = setInterval(updateEditorContext, 500)
})

interface Props {
  isExecuting?: boolean
  executingAgentName?: string
}

const props = withDefaults(defineProps<Props>(), {
  isExecuting: false,
  executingAgentName: ''
})

const emit = defineEmits<{
  (e: 'run-agent', payload: { type: string; targetWordCount?: number }): void
  (e: 'stop-agent'): void
}>()

// 状态
const projectStore = useProjectStore()
const agentStore = useAgentStore()
const writingAssistant = ref(new WritingAssistantAgent())
const messages = ref< any[]>([])
const isLoading = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)
const lastUserInput = ref('') // 记录最后一次用户输入（用于"再改改"等场景）

// 响应式编辑器上下文（通过定时器更新，确保快捷按钮能正确更新）
const editorContext = ref<EditorContext>({})
let contextUpdateTimer: ReturnType<typeof setInterval> | null = null

// 更新编辑器上下文
function updateEditorContext(): void {
  editorContext.value = getEditorContext()
}

// 组件挂载时开始更新上下文
onMounted(() => {
  // 立即更新一次
  updateEditorContext()
  // 每500ms更新一次（监听选择变化）
  contextUpdateTimer = setInterval(updateEditorContext, 500)
})

// 组件卸载时清理定时器
onBeforeUnmount(() => {
  if (contextUpdateTimer) {
    clearInterval(contextUpdateTimer)
    contextUpdateTimer = null
  }
})

// 监听项目路径变化，设置到 agent
watch(
  () => projectStore.project?.path,
  (newPath) => {
    if (newPath) {
      writingAssistant.value.setProjectPath(newPath)
    }
  },
  { immediate: true }
)

// 上下文信息（从 ConversationManager 获取）
const chapterInfo = computed(() => {
  const chapter = projectStore.currentChapter
  if (!chapter) return '未选择章节'
  return `当前章节：${chapter.title}（${chapter.wordCount}字，${chapter.status === 'completed' ? '已完成' : '草稿中'}）`
})

const storyStateSummary = computed(() => {
  const state = projectStore.project?.storyState
  if (!state) return ''

  const parts: string[] = []

  // 世界状态
  if (state.worldState.activeConflicts.length > 0) {
    parts.push(`活跃冲突：${state.worldState.activeConflicts.join('；')}`)
  }

  // 未回收的伏笔
  const openHooks = state.pendingHooks.filter(h => h.status === 'open')
  if (openHooks.length > 0) {
    parts.push(`未回收伏笔：${openHooks.length}个`)
  }

  return parts.join(' | ')
})

const previousSummary = computed(() => {
  const summaries = projectStore.project?.storyState?.chapterSummaries
  if (!summaries || summaries.length === 0) return ''

  const recent = summaries.slice(-2)
  return `前文：${recent.map(s => s.summary.slice(0, 50) + '...').join(' → ')}`
})

// 快捷操作（固定在输入框上方，只保留通用操作，避免与AI消息下方按钮重复）
const quickActions = computed(() => {
  const context = editorContext.value
  const hasSelection = context.selectedText
  const hasChapter = context.chapterContent

  // 有选中内容时，显示选中相关的快捷操作
  if (hasSelection) {
    return [
      { label: '润色选中', value: 'polish_selection', type: 'primary' },
      { label: '重写选中', value: 'rewrite_selection' },
      { label: '修改选中', value: 'modify_selection' },
      { label: '解释选中', value: 'explain_selection' }
    ]
  }

  // 无选中内容时，只显示通用操作（AI消息下方会有上下文相关的操作按钮）
  const actions = [
    { label: '生成章节', value: 'generate', type: 'primary' },
    { label: '续写', value: 'continue' }
  ]

  // 如果有章节内容，添加修改按钮
  if (hasChapter) {
    actions.push({ label: '修改章节', value: 'modify', type: 'default' })
  }

  // 添加咨询建议按钮
  actions.push({ label: '咨询建议', value: 'advice' })

  // 添加智能问答按钮（如果 RAG 已初始化）
  if (isRAGReady()) {
    actions.push({ label: '🧠 智能问答', value: 'rag_qa', type: 'success' })
  }

  return actions
})

// 初始化
watch(
  () => projectStore.currentChapterId,
  (newId) => {
    writingAssistant.value.setCurrentChapter(newId, projectStore.project)
    messages.value = writingAssistant.value.getHistory()
  },
  { immediate: true }
)

// 停止生成
function stopGeneration(): void {
  writingAssistant.value.stop()
  isLoading.value = false
  ElMessage.info('已停止生成')
}

// 发送消息
async function sendMessage(): Promise<void> {
  const input = getInputContent().trim()
  if (!input || isLoading.value) return

  // 记录最后一次用户输入（用于"再改改"等场景）
  lastUserInput.value = input
  
  // 收集行号标签信息
  const lineRanges: string[] = []
  if (inputAreaRef.value) {
    const tags = inputAreaRef.value.querySelectorAll('.line-range-tag')
    tags.forEach(tag => {
      const lineRange = tag.getAttribute('data-line-range')
      if (lineRange) lineRanges.push(lineRange)
    })
  }
  
  // 立即添加用户消息到列表（先显示用户消息）
  const userMsg: any = {
    id: `msg-${Date.now()}-user`,
    role: 'user' as const,
    content: input,
    timestamp: Date.now()
  }
  // 如果有行号标签，附加到消息中
  if (lineRanges.length > 0) {
    userMsg.lineRanges = lineRanges
  }
  messages.value = [...messages.value, userMsg]
  
  // 清空输入框
  clearInput()
  isLoading.value = true

  // 滚动到底部（显示用户消息）
  await scrollToBottom()

  try {
    // 获取编辑器上下文（包含行号信息）
    const context = getEditorContext()
    if (lineRanges.length > 0) {
      context.lineRanges = lineRanges
      // 获取标签对应的选中文本
      const selectedTexts: string[] = []
      if (inputAreaRef.value) {
        const tags = inputAreaRef.value.querySelectorAll('.line-range-tag')
        tags.forEach(tag => {
          const selectedText = tag.getAttribute('data-selected-text')
          if (selectedText) selectedTexts.push(selectedText)
        })
      }
      if (selectedTexts.length > 0) {
        context.selectedTextFromTag = selectedTexts.join('\n')
      }
    }

    // RAG 检索：如果有初始化 RAG，则检索相关记忆
    if (isRAGReady()) {
      try {
        ElMessage.info('正在检索相关记忆...')
        const results = await retrieve(input, {
          strategy: 'hybrid',
          maxResults: 5
        })
        
        if (results && results.length > 0) {
          // 将检索结果格式化为上下文
          const ragContext = await enrichContext(results, input)
          context.ragContext = ragContext
          console.log(`[ChatAssistant] RAG 检索到 ${results.length} 条相关记忆`)
        }
      } catch (ragErr) {
        console.error('[ChatAssistant] RAG 检索失败:', ragErr)
        // RAG 检索失败不影响正常对话
      }
    }

    // 处理消息
    const reply = await writingAssistant.value.processMessage(input, context)

    // 更新消息列表
    messages.value = writingAssistant.value.getHistory()

    // 滚动到底部（显示AI回复）
    await scrollToBottom()

    // 检查是否需要执行Agent
    checkAndExecuteAgent(reply)
  } catch (err: any) {
    console.error('发送消息失败:', err)
    
    // 检查是否是用户取消（停止生成）
    const errorMsg = err instanceof Error ? err.message : String(err)
    if (errorMsg.includes('取消') || errorMsg.includes('cancel')) {
      // 用户主动取消，不显示错误提示
      ElMessage.info('已停止生成')
    } else {
      ElMessage.error('发送失败，请重试')
    }
  } finally {
    isLoading.value = false
    // 强制更新输入状态，确保按钮状态正确
    nextTick(() => {
      updateInputStatus()
    })
  }
}

// 处理快捷操作
function handleQuickAction(action: ChatAction): void {
  const value = action.value

  // 根据操作类型直接触发
  if (value === 'generate') {
    setInputContent('帮我生成这一章的内容')
    sendMessage()
  } else if (value === 'continue') {
    setInputContent('接着当前内容继续写')
    sendMessage()
  } else if (value === 'polish' || value === 'polish_selection') {
    setInputContent('帮我润色' + (value === 'polish_selection' ? '选中的内容' : '当前章节'))
    sendMessage()
  } else if (value === 'rewrite_selection') {
    setInputContent('帮我重写选中的内容')
    sendMessage()
  } else if (value === 'modify_selection') {
    // 修改选中内容 - 检查是否有选中文本
    const context = getEditorContext()
    if (!context.selectedText) {
      ElMessage.warning('请先选中要修改的内容')
      return
    }
    setInputContent('帮我修改选中的内容')
    sendMessage()
  } else if (value === 'explain_selection') {
    setInputContent('解释一下选中的内容')
    sendMessage()
  } else if (value === 'confirm_generate') {
    emit('run-agent', { type: 'chapter' })
  } else if (value === 'modify') {
    // 进入修改模式 - 检查是否有选中内容
    const context = getEditorContext()
    if (!context.selectedText && !context.chapterContent) {
      ElMessage.warning('请先选中要修改的内容，或打开要修改的章节')
      return
    }
    setInputContent('我想修改这部分内容')
    sendMessage()
  } else if (value === 'regenerate') {
    setInputContent('重新生成')
    sendMessage()
  } else if (value === 'adjust') {
    setInputContent('我想调整一下目标')
    sendMessage()
  } else if (value === 'cancel') {
    writingAssistant.value.clearHistory()
    messages.value = writingAssistant.value.getHistory()
  } else if (value === 'advice') {
    setInputContent('给我一些创作建议')
    sendMessage()
  } else if (value === 'rag_qa') {
    // 智能问答：引导用户输入问题
    setInputContent('请根据我的小说内容回答：')
    ElMessage.success('已启用智能问答模式，请输入您的问题')
  } else {
    // 其他情况，填入输入框让用户补充
    setInputContent(action.label)
  }
}

// 处理消息中的操作按钮
function handleAction(action: ChatAction): void {
  const value = action.value

  // 清除所有消息的 actions（按钮点击后消失）
  messages.value = messages.value.map(msg => ({
    ...msg,
    actions: undefined
  }))

  if (value === 'confirm_generate') {
    // 执行生成，内容流式输出到编辑器
    emit('run-agent', { type: 'chapter' })
  } else if (value === 'confirm_modify') {
    // 执行修改，内容流式输出到编辑器
    emit('run-agent', { type: 'modify' })
  } else if (value === 'confirm_polish') {
    // 执行润色，内容流式输出到编辑器
    emit('run-agent', { type: 'polish' })
  } else if (value === 'confirm_rewrite') {
    // 执行重写，内容流式输出到编辑器
    emit('run-agent', { type: 'rewrite' })
  } else if (value === 'cancel') {
    writingAssistant.value.clearHistory()
    messages.value = writingAssistant.value.getHistory()
  } else if (value === 'adjust') {
    // 调整目标，让用户在输入框中补充
    setInputContent('我想调整一下：')
  } else {
    // 将操作作为用户消息发送
    setInputContent(action.label)
    sendMessage()
  }
}

// 清空对话
function clearChat(): void {
  writingAssistant.value.clearHistory()
  messages.value = writingAssistant.value.getHistory()
}

// 获取当前对话阶段（从助手获取）
function getCurrentPhase(): string {
  // 简化：根据最后一条AI消息判断
  const lastMsg = messages.value.filter(m => m.role === 'assistant').pop()
  if (!lastMsg) return 'greeting'

  if (lastMsg.actions?.some(a => a.value === 'confirm_generate')) return 'planning'
  if (lastMsg.actions?.some(a => a.value === 'satisfied')) return 'reviewing'

  return 'understanding'
}

// 获取编辑器上下文
function getEditorContext(): any {
  // 从 window 获取编辑器实例（由 Workbench.vue 暴露）
  const editor = (window as any).__chapterEditor as any
  if (!editor) {
    // 编辑器未就绪，返回空对象（但允许继续对话）
    return {}
  }

  const context: any = {}

  try {
    // 获取选中内容
    const { from, to } = editor.state.selection
    if (from !== to) {
      context.selectedText = editor.state.doc.textBetween(from, to, ' ')
    }

    // 获取光标位置
    context.cursorPosition = from

    // 获取全文
    context.chapterContent = editor.state.doc.textContent
    context.wordCount = context.chapterContent.replace(/\s/g, '').length
  } catch (err) {
    console.error('获取编辑器上下文失败:', err)
    // 返回空对象，允许继续对话
    return {}
  }

  return context
}

// 检查并自动执行Agent
// 注意：已移除自动执行逻辑，避免 AI 还在确认阶段时就触发 Agent
// 用户需要手动点击 AI 回复中的"确认生成"等按钮来执行
function checkAndExecuteAgent(_reply: any): void {
  // 自动执行逻辑已禁用，所有执行需要用户手动确认
  // 原来的逻辑会在 AI 回复包含"开始生成"等词时自动执行，但会导致：
  // AI 还在和用户确认需求时，编辑器就开始输出了
  return
}

// 滚动到底部
async function scrollToBottom(): Promise<void> {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// 监听外部Agent执行状态
watch(() => props.isExecuting, (executing) => {
  if (!executing) {
    // Agent执行完成，通知助手
    const msg = writingAssistant.value.getHistory().find(m => m.role === 'assistant' && m.isStreaming)
    if (msg) {
      msg.isStreaming = false
    }
  }
})
</script>

<style scoped>
.chat-assistant {
  font-size: 14px;
}

.custom-input {
  font-size: 13px;
  line-height: 1.6;
  min-height: 60px;
}

.input-area {
  white-space: pre-wrap;
  word-break: break-word;
  outline: none;
}

.input-area:empty::before {
  content: attr(placeholder);
  color: var(--el-text-color-placeholder);
  pointer-events: none;
}

:deep(.line-range-tag) {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  background-color: rgb(219, 234, 254);
  color: rgb(30, 64, 175);
  margin-right: 4px;
  white-space: nowrap;
}

:deep(.dark .line-range-tag) {
  background-color: rgb(30, 58, 138);
  color: rgb(191, 219, 254);
}
</style>
