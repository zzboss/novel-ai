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
              </el-tooltip>
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
      width="600px"
      :close-on-click-modal="false"
    >
      <div class="flex flex-col gap-4">
        <div v-if="aiDialogType === 'modify-outline'" class="flex flex-col gap-2">
          <span class="text-sm" style="color: var(--el-text-color-regular);">请输入你对细纲的修改要求：</span>
          <el-input
            v-model="aiModifyRequest"
            type="textarea"
            :rows="4"
            placeholder="例如：增加更多关于主角心理描写的场景、加快节奏..."
          />
        </div>
        <div v-else-if="aiDialogType === 'modify-content'" class="flex flex-col gap-2">
          <span class="text-sm" style="color: var(--el-text-color-regular);">请输入你对正文的修改要求（留空则优化选中内容）：</span>
          <el-input
            v-model="aiModifyRequest"
            type="textarea"
            :rows="4"
            placeholder="例如：让对话更自然、增加环境描写..."
          />
        </div>
        <div v-if="aiGenerating" class="flex items-center gap-2">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>AI 正在生成，请稍候...</span>
        </div>
        <div v-if="aiGeneratedContent" class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold">生成结果：</span>
            <el-button size="small" @click="onAcceptAIGenerated">采纳</el-button>
          </div>
          <div class="ai-result max-h-60 overflow-y-auto p-3 border rounded" style="background: var(--el-bg-color-page); border-color: var(--el-border-color);">
            <div v-html="aiGeneratedContent"></div>
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
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { EditPen, MagicStick, Edit, Delete, Document, Loading } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import ChapterEditor from './ChapterEditor.vue'
import {
  generateChapterOutline,
  generateChapterContent,
  modifyChapterOutline
} from '@/stores/agent/generators/chapter'
import { useProjectStore } from '@/stores/project'
import type { ProjectType } from '@/stores/project'

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
const aiModifyRequest = ref('')
const aiGenerating = ref(false)
const aiGeneratedContent = ref('')

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

// AI 生成细纲
async function onGenerateOutline(): Promise<void> {
  aiDialogType.value = 'generate-outline'
  aiDialogTitle.value = 'AI 生成章节细纲'
  aiModifyRequest.value = ''
  aiGeneratedContent.value = ''
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
  aiModifyRequest.value = ''
  aiGeneratedContent.value = ''
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
  aiModifyRequest.value = ''
  aiGeneratedContent.value = ''
  aiDialogVisible.value = true
}

// AI 修改正文
async function onModifyContent(): Promise<void> {
  aiDialogType.value = 'modify-content'
  aiDialogTitle.value = 'AI 修改章节正文'
  aiModifyRequest.value = ''
  aiGeneratedContent.value = ''
  aiDialogVisible.value = true
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

    if (aiDialogType.value === 'generate-outline') {
      // 获取前面章节的细纲
      const previousChapters = getPreviousChapters()

      const result = await generateChapterOutline(
        props.chapterTitle,
        getChapterNumber(),
        props.volumeOutline,
        previousChapters,
        characters,
        worldSettings,
        projectType as ProjectType
      )
      aiGeneratedContent.value = result
    } else if (aiDialogType.value === 'modify-outline') {
      const result = await modifyChapterOutline(
        outlineContent.value,
        aiModifyRequest.value,
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
      const previousChapters = getPreviousChaptersSummary()

      const result = await generateChapterContent(
        props.chapterTitle,
        getChapterNumber(),
        outlineContent.value,
        props.volumeOutline,
        previousChapters,
        characters,
        worldSettings,
        projectType as ProjectType
      )
      aiGeneratedContent.value = result
    } else if (aiDialogType.value === 'modify-content') {
      // TODO: 实现正文修改
      ElMessage.info('正文修改功能开发中...')
      aiGenerating.value = false
      return
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
  } else if (aiDialogType.value === 'generate-content') {
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

defineExpose({
  setOutline,
  setContent,
  getOutline,
  getContent,
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
