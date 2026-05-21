<template>
  <div class="chapter-editor-with-outline h-full flex flex-col">
    <!-- 顶部工具栏 -->
    <div class="editor-header shrink-0 flex items-center gap-2 px-4 py-2 border-b" style="border-color: var(--el-border-color); background: var(--el-bg-color-page)">
      <h3 class="text-base font-semibold m-0">{{ chapterTitle }}</h3>
      <div class="ml-auto flex items-center gap-2">
        <el-tag v-if="saving" size="small" type="info">保存中...</el-tag>
        <el-tag v-else-if="lastSaved" size="small" type="success">已保存</el-tag>
      </div>
    </div>

    <!-- 主体区域：细纲 + 正文 -->
    <div class="flex-1 overflow-hidden flex flex-col gap-2 p-2">
      <!-- 章节细纲区域 -->
      <div class="outline-section flex flex-col" style="min-height: 200px; max-height: 40vh;">
        <div class="section-header flex items-center justify-between px-3 py-2 border-b" style="border-color: var(--el-border-color);">
          <div class="flex items-center gap-2">
            <el-icon><EditPen /></el-icon>
            <span class="font-semibold">章节细纲</span>
            <el-tag v-if="outlineWordCount > 0" size="small" type="info">{{ outlineWordCount }} 字</el-tag>
          </div>
          <div class="flex items-center gap-1">
            <el-tooltip content="AI 生成细纲" placement="top">
              <el-button
                size="small"
                type="primary"
                :loading="generatingOutline"
                :disabled="generatingContent"
                @click="onGenerateOutline"
              >
                <el-icon><MagicStick /></el-icon>
                <span class="ml-1">AI 生成</span>
              </el-button>
            </el-tooltip>
            <el-tooltip content="AI 修改细纲" placement="top">
              <el-button
                size="small"
                :disabled="!outlineContent || generatingOutline || generatingContent"
                @click="onModifyOutline"
              >
                <el-icon><Edit /></el-icon>
                <span class="ml-1">AI 修改</span>
              </el-button>
            </el-tooltip>
            <el-tooltip content="清空细纲" placement="top">
              <el-button
                size="small"
                :disabled="!outlineContent"
                @click="onClearOutline"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </el-tooltip>
          </div>
        </div>
        <div class="outline-editor flex-1 overflow-y-auto p-3" style="background: var(--el-bg-color-page); border: 1px solid var(--el-border-color); border-radius: 4px;">
          <textarea
            v-model="outlineContent"
            class="w-full h-full border-none outline-none resize-none bg-transparent"
            style="font-size: 14px; line-height: 1.8; color: var(--el-text-color-primary);"
            placeholder="在此输入章节细纲，或点击「AI 生成」让 AI 帮你生成..."
            @input="onOutlineInput"
          ></textarea>
        </div>
      </div>

      <!-- 分割线（可拖动） -->
      <div class="divider h-1 hover:bg-blue-200 cursor-row-resize transition-colors" style="background: var(--el-border-color-lighter);" @mousedown="onDividerMouseDown"></div>

      <!-- 章节正文区域 -->
      <div class="content-section flex-1 flex flex-col overflow-hidden">
        <div class="section-header flex items-center justify-between px-3 py-2 border-b" style="border-color: var(--el-border-color);">
          <div class="flex items-center gap-2">
            <el-icon><Document /></el-icon>
            <span class="font-semibold">章节正文</span>
            <el-tag v-if="contentWordCount > 0" size="small" type="info">{{ contentWordCount }} 字</el-tag>
          </div>
          <div class="flex items-center gap-1">
            <el-tooltip content="AI 根据细纲生成正文" placement="top">
              <el-button
                size="small"
                type="primary"
                :loading="generatingContent"
                :disabled="generatingOutline || !outlineContent"
                @click="onGenerateContent"
              >
                <el-icon><MagicStick /></el-icon>
                <span class="ml-1">AI 生成正文</span>
              </el-button>
            </el-tooltip>
            <el-tooltip content="AI 修改选中内容" placement="top">
              <el-button
                size="small"
                :disabled="!editor || generatingContent || generatingOutline"
                @click="onModifyContent"
              >
                <el-icon><Edit /></el-icon>
                <span class="ml-1">AI 修改</span>
              </el-button>
            </el-tooltip>
          </div>
        </div>
        <div class="content-editor flex-1 overflow-hidden">
          <chapter-editor
            ref="contentEditorRef"
            :content="contentHtml"
            :editable="!generatingContent && !generatingOutline"
            @update="onContentUpdate"
            @ready="onEditorReady"
          />
        </div>
      </div>
    </div>

    <!-- AI 生成/修改对话框 -->
    <el-dialog
      v-model="aiDialogVisible"
      :title="aiDialogTitle"
      width="700px"
      :close-on-click-modal="false"
    >
      <div class="flex flex-col gap-4">
        <!-- 模型选择（临时切换） -->
        <div class="flex items-center gap-2">
          <span class="text-sm shrink-0" style="color: var(--el-text-color-regular);">使用模型：</span>
          <el-select
            v-model="selectedModelId"
            size="small"
            style="width: 200px;"
            placeholder="选择模型"
          >
            <el-option
              v-for="model in availableModels"
              :key="model.id"
              :label="model.name || model.model"
              :value="model.id"
            />
          </el-select>
          <el-tag v-if="isTemporaryModel" size="small" type="warning">临时切换</el-tag>
        </div>

        <!-- 用户输入区域 -->
        <div class="flex flex-col gap-2">
          <span class="text-sm" style="color: var(--el-text-color-regular);">
            {{ aiDialogType === 'generate-outline' ? '请输入章节要求（可选）：' : 
               aiDialogType === 'generate-content' ? '请输入正文要求（可选）：' :
               '请输入修改要求：' }}
          </span>
          <el-input
            v-model="aiUserInput"
            type="textarea"
            :rows="4"
            :placeholder="getPlaceholder()"
          />
        </div>

        <!-- 上下文信息（可选） -->
        <div v-if="aiDialogType === 'generate-outline' || aiDialogType === 'generate-content'" class="flex flex-col gap-2">
          <el-collapse>
            <el-collapse-item title="高级选项" name="advanced">
              <div class="flex flex-col gap-2">
                <label class="text-sm" style="color: var(--el-text-color-secondary);">参考前面章节：</label>
                <el-switch v-model="includePreviousChapters" active-text="包含" inactive-text="不包含" />
                <label v-if="includePreviousChapters" class="text-xs" style="color: var(--el-text-color-placeholder);">
                  将包含前面 {{ previousChaptersCount }} 章的内容作为上下文
                </label>
              </div>
            </el-collapse-item>
          </el-collapse>
        </div>

        <!-- 生成状态 -->
        <div v-if="aiGenerating" class="flex items-center gap-2">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>AI 正在生成，请稍候...</span>
        </div>

        <!-- 生成结果 -->
        <div v-if="aiGeneratedContent" class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold">生成结果：</span>
            <div class="flex items-center gap-2">
              <el-button size="small" @click="onRegenerate">重新生成</el-button>
              <el-button size="small" type="primary" @click="onAcceptAIGenerated">采纳</el-button>
            </div>
          </div>
          <div class="ai-result max-h-60 overflow-y-auto p-3 border rounded" style="background: var(--el-bg-color-page); border-color: var(--el-border-color);">
            <div v-html="renderMarkdown(aiGeneratedContent)"></div>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <el-button @click="aiDialogVisible = false">取消</el-button>
          <el-button
            v-if="!aiGeneratedContent"
            type="primary"
            :loading="aiGenerating"
            @click="onConfirmAIGenerate"
          >
            生成
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
// 使用 // @ts-ignore 忽略图标类型错误（@element-plus/icons-vue 类型定义问题）
import { EditPen, MagicStick, Delete, Document, Loading, Edit } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ChapterEditor from './ChapterEditor.vue'
import {
  generateChapterOutlineWithInput,
  generateChapterContentWithInput,
  modifyChapterOutline,
  modifyChapterContent
} from '@/stores/agent/generators/chapter'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import type { ProjectType } from '@/stores/project'
import type { ModelConfig } from '@/llm/types'
import { marked } from 'marked' // 需要安装：npm install marked

const props = defineProps<{
  chapterId: string
  chapterTitle: string
  volumeOutline: string
}>()

const emit = defineEmits<{
  save: []
  'update:outline': [outline: string]
  'update:content': [html: string, text: string, wordCount: number]
}>()

// 状态
const outlineContent = ref('')
const contentHtml = ref('')
const contentEditorRef = ref<InstanceType<typeof ChapterEditor> | null>(null)
const saving = ref(false)
const lastSaved = ref(false)
let saveTimer: ReturnType<typeof setTimeout> | null = null

// AI 生成状态
const generatingOutline = ref(false)
const generatingContent = ref(false)
const aiDialogVisible = ref(false)
const aiDialogTitle = ref('')
const aiDialogType = ref<'generate-outline' | 'modify-outline' | 'generate-content' | 'modify-content'>('generate-outline')
const aiUserInput = ref('') // 用户输入
const aiGenerating = ref(false)
const aiGeneratedContent = ref('')
const selectedModelId = ref('') // 临时选择的模型
const includePreviousChapters = ref(true) // 是否包含前面章节

// 计算属性
const outlineWordCount = computed(() => {
  return outlineContent.value.replace(/\s/g, '').length
})

const contentWordCount = computed(() => {
  if (!contentEditorRef.value) return 0
  const text = contentEditorRef.value.getText()
  return text.replace(/\s/g, '').length
})

const editor = computed(() => {
  return contentEditorRef.value?.editor ?? null
})

// 项目 store
const projectStore = useProjectStore()
const settingsStore = useSettingsStore()

// 可用模型列表
const availableModels = computed(() => {
  return settingsStore.settings?.models || []
})

// 是否使用了临时模型
const isTemporaryModel = computed(() => {
  if (!selectedModelId.value) return false
  return selectedModelId.value !== settingsStore.activeModel?.id
})

// 前面章节数量
const previousChaptersCount = computed(() => {
  return getPreviousChapters().length
})

// 方法
function onOutlineInput(): void {
  emit('update:outline', outlineContent.value)
  debouncedSave()
}

function onContentUpdate(html: string, text: string, wordCount: number): void {
  contentHtml.value = html
  emit('update:content', html, text, wordCount)
  debouncedSave()
}

function onEditorReady(editorInstance: any): void {
  // 编辑器就绪
}

// 保存（防抖）
function debouncedSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  lastSaved.value = false
  saving.value = true
  saveTimer = setTimeout(() => {
    emit('save')
    saving.value = false
    lastSaved.value = true
    setTimeout(() => {
      lastSaved.value = false
    }, 2000)
  }, 1000)
}

// 获取占位符
function getPlaceholder(): string {
  if (aiDialogType.value === 'generate-outline') {
    return '例如：本章重点描写主角与反派的第一次正面交锋，节奏要紧张...'
  } else if (aiDialogType.value === 'generate-content') {
    return '例如：对话要更自然，增加环境描写，突出主角的内心矛盾...'
  } else if (aiDialogType.value === 'modify-outline') {
    return '例如：增加更多关于主角心理描写的场景、加快节奏...'
  } else if (aiDialogType.value === 'modify-content') {
    return '例如：让对话更自然、增加环境描写...'
  }
  return ''
}

// 渲染 Markdown
function renderMarkdown(content: string): string {
  try {
    return marked(content) as string
  } catch {
    return content
  }
}

// AI 生成细纲
async function onGenerateOutline(): Promise<void> {
  aiDialogType.value = 'generate-outline'
  aiDialogTitle.value = 'AI 生成章节细纲'
  aiUserInput.value = ''
  aiGeneratedContent.value = ''
  selectedModelId.value = '' // 重置为默认模型
  aiDialogVisible.value = true
}

// AI 修改细纲
async function onModifyOutline(): Promise<void> {
  if (!outlineContent.value) {
    ElMessage.warning('请先输入或生成章节细纲')
    return
  }
  aiDialogType.value = 'modify-outline'
  aiDialogTitle.value = 'AI 修改章节细纲'
  aiUserInput.value = ''
  aiGeneratedContent.value = ''
  selectedModelId.value = ''
  aiDialogVisible.value = true
}

// AI 生成正文
async function onGenerateContent(): Promise<void> {
  if (!outlineContent.value) {
    ElMessage.warning('请先生成或输入章节细纲')
    return
  }
  aiDialogType.value = 'generate-content'
  aiDialogTitle.value = 'AI 生成章节正文'
  aiUserInput.value = ''
  aiGeneratedContent.value = ''
  selectedModelId.value = ''
  aiDialogVisible.value = true
}

// AI 修改正文
async function onModifyContent(): Promise<void> {
  aiDialogType.value = 'modify-content'
  aiDialogTitle.value = 'AI 修改章节正文'
  aiUserInput.value = ''
  aiGeneratedContent.value = ''
  selectedModelId.value = ''
  aiDialogVisible.value = true
}

// 重新生成
async function onRegenerate(): Promise<void> {
  await onConfirmAIGenerate()
}

// 确认 AI 生成/修改
async function onConfirmAIGenerate(): Promise<void> {
  aiGenerating.value = true
  aiGeneratedContent.value = ''

  try {
    const project = projectStore.project
    if (!project) throw new Error('项目未加载')

    const characters = project.characters?.map((ch: any) => ch.description || ch.name).join('\n') || ''
    const worldSettings = project.worldSettings ? JSON.stringify(project.worldSettings) : ''
    const projectType = project.projectType || 'novel'

    // 获取模型配置（支持临时切换）
    let modelConfig = settingsStore.activeModel
    if (selectedModelId.value) {
      const tempModel = settingsStore.settings?.models?.find((m: ModelConfig) => m.id === selectedModelId.value)
      if (tempModel) {
        modelConfig = tempModel
        ElMessage.info(`使用临时模型：${tempModel.name || tempModel.model}`)
      }
    }
    if (!modelConfig) throw new Error('未配置模型，请在设置中配置AI模型')

    if (aiDialogType.value === 'generate-outline') {
      // 获取前面章节的细纲
      const previousChapters = includePreviousChapters.value ? getPreviousChapters() : []

      // 调用 AI 生成，传入用户输入
      const result = await generateChapterOutlineWithInput(
        props.chapterTitle,
        getChapterNumber(),
        props.volumeOutline,
        previousChapters,
        characters,
        worldSettings,
        projectType as ProjectType,
        aiUserInput.value || undefined,
        modelConfig
      )
      aiGeneratedContent.value = result
    } else if (aiDialogType.value === 'modify-outline') {
      const result = await modifyChapterOutline(
        outlineContent.value,
        aiUserInput.value || '请优化这段细纲，使其更具体、更可操作',
        props.chapterTitle,
        getChapterNumber(),
        {
          volumeOutline: props.volumeOutline,
          characters,
          worldSettings
        }
      )
      aiGeneratedContent.value = result
    } else if (aiDialogType.value === 'generate-content') {
      // 获取前面章节的摘要
      const previousChapters = includePreviousChapters.value ? getPreviousChaptersSummary() : []

      const result = await generateChapterContentWithInput(
        props.chapterTitle,
        getChapterNumber(),
        outlineContent.value,
        props.volumeOutline,
        previousChapters,
        characters,
        worldSettings,
        projectType as ProjectType,
        aiUserInput.value || undefined,
        modelConfig
      )
      aiGeneratedContent.value = result
    } else if (aiDialogType.value === 'modify-content') {
      // 获取选中的内容
      const selectedText = contentEditorRef.value?.getSelectedText() || ''
      const result = await modifyChapterContent(
        contentEditorRef.value?.getHTML() || '',
        selectedText,
        aiUserInput.value || '请优化选中内容',
        modelConfig
      )
      aiGeneratedContent.value = result
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI 生成失败'
    ElMessage.error(msg)
  } finally {
    aiGenerating.value = false
  }
}

// 采纳 AI 生成的内容
function onAcceptAIGenerated(): void {
  if (aiDialogType.value === 'generate-outline' || aiDialogType.value === 'modify-outline') {
    outlineContent.value = aiGeneratedContent.value
    emit('update:outline', outlineContent.value)
    ElMessage.success('已更新章节细纲')
  } else if (aiDialogType.value === 'generate-content' || aiDialogType.value === 'modify-content') {
    contentEditorRef.value?.setContent(aiGeneratedContent.value)
    ElMessage.success('已更新章节正文')
  }
  aiDialogVisible.value = false
}

// 清空细纲
async function onClearOutline(): Promise<void> {
  try {
    await ElMessageBox.confirm('确定要清空章节细纲吗？', '确认', { type: 'warning' })
    outlineContent.value = ''
    emit('update:outline', '')
    ElMessage.success('已清空')
  } catch {
    // 用户取消
  }
}

// 分割线拖动
function onDividerMouseDown(e: MouseEvent): void {
  e.preventDefault()
  const container = (e.target as HTMLElement).closest('.flex-col') as HTMLElement
  if (!container) return

  const startY = e.clientY
  const outlineSection = container.querySelector('.outline-section') as HTMLElement
  const startHeight = outlineSection?.offsetHeight || 200

  function onMouseMove(e: MouseEvent): void {
    if (!outlineSection) return
    const delta = e.clientY - startY
    const newHeight = Math.max(100, Math.min(startHeight + delta, container.offsetHeight - 200))
    outlineSection.style.maxHeight = `${newHeight}px`
    outlineSection.style.minHeight = `${newHeight}px`
  }

  function onMouseUp(): void {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

// 辅助方法
function getChapterNumber(): number {
  const chapter = projectStore.project?.volumes
    ?.flatMap((v: any) => v.chapters)
    ?.find((ch: any) => ch.id === props.chapterId)
  return chapter?.chapterNumber || 1
}

function getPreviousChapters(): Array<{ title: string; outline: string }> {
  const chapters: Array<{ title: string; outline: string }> = []
  const project = projectStore.project
  if (!project) return chapters

  let foundCurrent = false
  for (const volume of project.volumes) {
    for (const chapter of volume.chapters) {
      if (chapter.id === props.chapterId) {
        foundCurrent = true
        break
      }
      chapters.push({
        title: chapter.title,
        outline: chapter.outline || ''
      })
      if (foundCurrent) break
    }
    if (foundCurrent) break
  }
  return chapters
}

function getPreviousChaptersSummary(): Array<{ title: string; summary: string }> {
  return getPreviousChapters().map(ch => ({
    title: ch.title,
    summary: ch.outline || ''
  }))
}

// 挂载时加载已保存的内容
onMounted(async () => {
  if (!props.chapterId || !projectStore.project) return

  // 加载细纲（从 store 中读取）
  for (const volume of projectStore.project.volumes || []) {
    const chapter = volume.chapters.find((ch: any) => ch.id === props.chapterId)
    if (chapter) {
      outlineContent.value = chapter.outline || ''
      break
    }
  }

  // 加载正文（从磁盘读取）
  try {
    if (window.electronAPI?.readChapter) {
      const content = await window.electronAPI.readChapter(projectStore.project.path, props.chapterId)
      if (content) {
        contentHtml.value = content
        nextTick(() => {
          contentEditorRef.value?.setContent(content)
          // 通知父组件内容已加载
          nextTick(() => {
            const html = contentEditorRef.value?.getHTML() || content
            const text = contentEditorRef.value?.getText() || ''
            const wordCount = text.replace(/\s/g, '').length
            emit('update:content', html, text, wordCount)
          })
        })
      }
    }
  } catch (err) {
    console.error('加载章节正文失败:', err)
  }
})

// 监听 chapterId 变化（切换章节时重新加载）
watch(() => props.chapterId, async (newId) => {
  if (!newId || !projectStore.project) return

  // 加载细纲
  for (const volume of projectStore.project.volumes || []) {
    const chapter = volume.chapters.find((ch: any) => ch.id === newId)
    if (chapter) {
      outlineContent.value = chapter.outline || ''
      break
    }
  }

  // 加载正文
  try {
    if (window.electronAPI?.readChapter) {
      const content = await window.electronAPI.readChapter(projectStore.project.path, newId)
      if (content) {
        contentHtml.value = content
        nextTick(() => {
          contentEditorRef.value?.setContent(content)
          // 通知父组件内容已加载
          nextTick(() => {
            const html = contentEditorRef.value?.getHTML() || content
            const text = contentEditorRef.value?.getText() || ''
            const wordCount = text.replace(/\s/g, '').length
            emit('update:content', html, text, wordCount)
          })
        })
      } else {
        contentHtml.value = ''
        nextTick(() => {
          contentEditorRef.value?.clearContent()
          // 通知父组件内容已清空
          emit('update:content', '', '', 0)
        })
      }
    }
  } catch (err) {
    console.error('加载章节正文失败:', err)
  }
})

// 公开方法
function setOutline(html: string): void {
  outlineContent.value = html
}

function setContent(html: string): void {
  contentHtml.value = html
  nextTick(() => {
    contentEditorRef.value?.setContent(html)
  })
}

function getOutline(): string {
  return outlineContent.value
}

function getContent(): string {
  return contentEditorRef.value?.getHTML() || ''
}

function getHTML(): string {
  return contentEditorRef.value?.getHTML() || ''
}

function getText(): string {
  return contentEditorRef.value?.getText() || ''
}

// 需要安装 marked：npm install marked @types/marked
defineExpose({
  setOutline,
  setContent,
  getOutline,
  getContent,
  getHTML,
  getText,
  outlineContent,
  contentEditorRef
})
</script>

<style scoped>
.chapter-editor-with-outline {
  background: var(--el-bg-color);
}

.outline-editor textarea {
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
}

.outline-editor textarea::placeholder {
  color: var(--el-text-color-placeholder);
}

.divider {
  transition: background 0.2s;
}

.divider:hover {
  background: var(--el-color-primary-light-5) !important;
}

.ai-result {
  font-size: 14px;
  line-height: 1.8;
}

.ai-result :deep(h1),
.ai-result :deep(h2),
.ai-result :deep(h3) {
  margin-top: 0.5em;
  margin-bottom: 0.5em;
  font-weight: 600;
}

.ai-result :deep(p) {
  margin-bottom: 0.5em;
}

.ai-result :deep(ul),
.ai-result :deep(ol) {
  padding-left: 1.5em;
  margin-bottom: 0.5em;
}
</style>
