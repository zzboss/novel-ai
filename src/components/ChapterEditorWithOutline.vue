<template>
  <div class="chapter-editor-layout h-full flex flex-col bg-[var(--el-bg-color)]">
    <!-- ========== 顶部操作栏 ========== -->
    <header class="editor-topbar shrink-0 flex items-center gap-3 px-4 py-2 border-b"
            style="border-color: var(--el-border-color); background: var(--el-bg-color-page)">
      <!-- 章节标识 -->
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-xs px-2 py-0.5 rounded-full font-mono shrink-0"
              style="background: var(--el-color-primary-light-9); color: var(--el-color-primary)">
          第{{ getChapterNumber() }}章
        </span>
        <h3 class="text-base font-semibold m-0 truncate">
          {{ props.chapterTitle }}
        </h3>
      </div>

      <!-- 字数统计 -->
      <span class="text-xs shrink-0" style="color: var(--el-text-color-placeholder)">
        {{ contentWordCount }} 字
      </span>

      <!-- 保存状态 -->
      <div class="flex items-center gap-1 shrink-0">
        <span v-if="saving" class="text-xs" style="color: var(--el-text-color-placeholder)">
          <el-icon class="is-loading"><Loading /></el-icon> 保存中
        </span>
        <span v-else-if="lastSaved" class="text-xs" style="color: var(--el-color-success)">
          <el-icon><CircleCheck /></el-icon> 已保存
        </span>
      </div>

      <!-- 操作按钮组 -->
      <div class="ml-auto flex items-center gap-1.5">
        <el-tooltip content="AI 生成正文" placement="bottom">
          <el-button size="small" :icon="MagicStick" type="primary" plain
                     @click="onGenerateContent">
            生成正文
          </el-button>
        </el-tooltip>
        <el-tooltip content="AI 修改选中段落" placement="bottom">
          <el-button size="small" :icon="Edit" plain
                     @click="onModifyContent">
            修改段落
          </el-button>
        </el-tooltip>
        <el-divider direction="vertical" style="height:20px" />
        <el-tooltip content="手动保存 (Ctrl+S)" placement="bottom">
          <el-button size="small" :icon="Upload" circle @click="manualSave" />
        </el-tooltip>
      </div>
    </header>

    <!-- ========== 正文编辑区域 ========== -->
    <div class="flex-1 overflow-hidden flex flex-col">
      <chapter-editor
        ref="contentEditorRef"
        :content="contentHtml"
        :editable="!generatingContent"
        @update="onContentUpdate"
        @ready="onEditorReady"
      />
    </div>

    <!-- ========== AI 生成/修改对话框 ========== -->
    <el-dialog
      v-model="aiDialogVisible"
      :title="aiDialogTitle"
      width="680px"
      :close-on-click-modal="false"
      class="ai-generation-dialog"
    >
      <div class="flex flex-col gap-5">
        <!-- 模型选择 -->
        <div class="flex items-center gap-3">
          <span class="text-sm shrink-0 font-medium" style="color: var(--el-text-color-regular)">
            使用模型：
          </span>
          <el-select
            v-model="selectedModelId"
            size="small"
            style="width: 220px"
            placeholder="选择模型（默认使用全局配置）"
            clearable
          >
            <el-option
              v-for="model in availableModels"
              :key="model.id"
              :label="`${model.name || model.model} (${model.provider})`"
              :value="model.id"
            />
          </el-select>
          <el-tag v-if="isTemporaryModel" size="small" type="warning" effect="plain">
            临时模型
          </el-tag>
        </div>

        <!-- 指令输入 -->
        <div class="flex flex-col gap-2">
          <span class="text-sm font-medium" style="color: var(--el-text-color-regular)">
            {{ aiDialogType === 'generate-content' ? '请输入正文要求（可选）：' : '请输入修改要求：' }}
          </span>
          <el-input
            v-model="aiUserInput"
            type="textarea"
            :rows="4"
            :placeholder="aiDialogType === 'generate-content'
              ? '例如：本章重点描写主角与反派的交锋，加入环境描写来烘托紧张气氛...'
              : '例如：让对话更加口语化，增加心理描写...'"
          />
        </div>

        <!-- 高级选项（仅 AI 生成时显示） -->
        <el-collapse v-if="aiDialogType === 'generate-content'">
          <el-collapse-item title="高级选项" name="advanced">
            <div class="flex flex-col gap-3 pt-2">
              <div class="flex items-center justify-between px-1">
                <span class="text-sm" style="color: var(--el-text-color-secondary)">
                  参考前面章节
                </span>
                <el-switch v-model="includePreviousChapters" size="small" />
              </div>
              <span v-if="includePreviousChapters" class="text-xs" style="color: var(--el-text-color-placeholder)">
                将包含前面 {{ previousChaptersCount }} 章的内容作为写作上下文
              </span>
            </div>
          </el-collapse-item>
        </el-collapse>

        <!-- 生成进度 -->
        <div v-if="aiGenerating" class="flex items-center gap-3 p-3 rounded-lg"
             style="background: var(--el-color-primary-light-9)">
          <el-icon class="is-loading" style="color: var(--el-color-primary)">
            <Loading />
          </el-icon>
          <span class="text-sm" style="color: var(--el-color-primary)">AI 正在生成中，请稍候...</span>
        </div>

        <!-- 生成结果预览 -->
        <div v-if="aiGeneratedContent" class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold">生成结果：</span>
            <div class="flex items-center gap-2">
              <el-button size="small" @click="onRegenerate" :loading="aiGenerating">
                <el-icon><Refresh /></el-icon> 重新生成
              </el-button>
              <el-button size="small" type="primary" @click="onAcceptAIGenerated">
                <el-icon><CircleCheck /></el-icon> 采纳
              </el-button>
            </div>
          </div>
          <div class="ai-result-panel p-4 border rounded-lg overflow-y-auto"
               style="max-height: 320px; background: var(--el-bg-color-page); border-color: var(--el-border-color)">
            <div v-html="aiGeneratedContent" />
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
            开始生成
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, onActivated, nextTick } from 'vue'
import { Loading, CircleCheck, MagicStick, Edit, Upload, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import ChapterEditor from './ChapterEditor.vue'
import {
  generateChapterContentWithInput,
  modifyChapterContent
} from '@/stores/agent/generators/chapter'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import type { ProjectType } from '@/stores/project'
import type { ModelConfig } from '@/llm/types'

// ==================== Props & Emits ====================
const props = defineProps<{
  chapterId: string
  chapterTitle: string
  volumeOutline: string
}>()

const emit = defineEmits<{
  save: []
  'update:content': [html: string, text: string, wordCount: number]
}>()

// ==================== 状态管理 ====================
const projectStore = useProjectStore()
const settingsStore = useSettingsStore()

// 编辑器
const contentHtml = ref('')
const contentEditorRef = ref<InstanceType<typeof ChapterEditor> | null>(null)

// 保存状态
const saving = ref(false)
const lastSaved = ref(false)
let saveTimer: ReturnType<typeof setTimeout> | null = null

// AI 生成状态
const generatingContent = ref(false)
const aiDialogVisible = ref(false)
const aiDialogTitle = ref('')
const aiDialogType = ref<'generate-content' | 'modify-content'>('generate-content')
const aiUserInput = ref('')
const aiGenerating = ref(false)
const aiGeneratedContent = ref('')
const selectedModelId = ref('')
const includePreviousChapters = ref(true)

// ==================== 计算属性 ====================
const contentWordCount = computed(() => {
  if (!contentEditorRef.value) return 0
  const text = contentEditorRef.value.getText()
  return text.replace(/\s/g, '').length
})

const availableModels = computed(() => {
  return settingsStore.settings?.models || []
})

const isTemporaryModel = computed(() => {
  if (!selectedModelId.value) return false
  return selectedModelId.value !== settingsStore.activeModel?.id
})

const previousChaptersCount = computed(() => {
  return getPreviousChapters().length
})

// ==================== 保存逻辑 ====================
function onContentUpdate(html: string, text: string, wordCount: number): void {
  contentHtml.value = html
  emit('update:content', html, text, wordCount)
  debouncedSave()
}

function onEditorReady(_editorInstance: unknown): void {
  // 编辑器就绪回调
}

function debouncedSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  lastSaved.value = false
  saving.value = true
  saveTimer = setTimeout(() => {
    emit('save')
    saving.value = false
    lastSaved.value = true
    setTimeout(() => { lastSaved.value = false }, 2000)
  }, 1000)
}

function manualSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saving.value = true
  emit('save')
  saving.value = false
  lastSaved.value = true
  setTimeout(() => { lastSaved.value = false }, 2000)
}

// ==================== AI 生成 ====================
function onGenerateContent(): void {
  aiDialogType.value = 'generate-content'
  aiDialogTitle.value = 'AI 生成章节正文'
  aiUserInput.value = ''
  aiGeneratedContent.value = ''
  selectedModelId.value = ''
  aiDialogVisible.value = true
}

function onModifyContent(): void {
  aiDialogType.value = 'modify-content'
  aiDialogTitle.value = 'AI 修改章节正文'
  aiUserInput.value = ''
  aiGeneratedContent.value = ''
  selectedModelId.value = ''
  aiDialogVisible.value = true
}

async function onRegenerate(): Promise<void> {
  await onConfirmAIGenerate()
}

async function onConfirmAIGenerate(): Promise<void> {
  aiGenerating.value = true
  aiGeneratedContent.value = ''

  try {
    const project = projectStore.project
    if (!project) throw new Error('项目未加载')

    const characters = project.characters?.map((ch: Record<string, unknown>) => {
      const parts = [`姓名：${ch.name || '未命名'}`]
      if (ch.role) parts.push(`角色定位：${ch.role}`)
      return parts.join('；')
    }).join('\n') || ''
    const worldSettings = project.worldSettings ? JSON.stringify(project.worldSettings) : ''
    const projectType = project.projectType || 'novel'

    let modelConfig: ModelConfig | null = settingsStore.activeModel as ModelConfig | null
    if (selectedModelId.value) {
      const tempModel = settingsStore.settings?.models?.find(
        (m: ModelConfig) => m.id === selectedModelId.value
      )
      if (tempModel) modelConfig = tempModel
    }
    if (!modelConfig) throw new Error('未配置模型')

    if (aiDialogType.value === 'generate-content') {
      const previousChapters = includePreviousChapters.value ? getPreviousChaptersSummary() : []
      const outline = getChapterOutline()
      const result = await generateChapterContentWithInput(
        props.chapterTitle,
        getChapterNumber(),
        outline,
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
      const selectedText = contentEditorRef.value?.getSelectedText() || ''
      const result = await modifyChapterContent(
        contentEditorRef.value?.getHTML() || '',
        selectedText,
        aiUserInput.value || '请优化选中内容',
        modelConfig
      )
      aiGeneratedContent.value = result
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI 生成失败'
    ElMessage.error(msg)
  } finally {
    aiGenerating.value = false
  }
}

function onAcceptAIGenerated(): void {
  if (aiDialogType.value === 'generate-content' || aiDialogType.value === 'modify-content') {
    contentEditorRef.value?.setContent(aiGeneratedContent.value)
    contentHtml.value = aiGeneratedContent.value
    const text = aiGeneratedContent.value.replace(/<[^>]*>/g, '')
    const wc = text.replace(/\s/g, '').length
    emit('update:content', aiGeneratedContent.value, text, wc)
    ElMessage.success('已更新章节正文')
  }
  aiDialogVisible.value = false
}

// ==================== 辅助方法 ====================
function getChapterNumber(): number {
  const chapter = projectStore.project?.volumes
    ?.flatMap((v: Record<string, unknown>) => (v.chapters as Array<Record<string, unknown>>))
    ?.find((ch: Record<string, unknown>) => ch.id === props.chapterId)
  return (chapter?.chapterNumber as number) || 1
}

function getPreviousChapters(): Array<{ title: string; outline: string }> {
  const chapters: Array<{ title: string; outline: string }> = []
  const project = projectStore.project
  if (!project) return chapters

  let foundCurrent = false
  for (const volume of project.volumes as Array<Record<string, unknown>>) {
    for (const chapter of (volume.chapters as Array<Record<string, unknown>>)) {
      if (chapter.id === props.chapterId) {
        foundCurrent = true
        break
      }
      chapters.push({
        title: (chapter.title as string) || '',
        outline: (chapter.outline as string) || ''
      })
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

function getChapterOutline(): string {
  if (!props.chapterId || !projectStore.project) return ''
  for (const volume of projectStore.project.volumes as Array<Record<string, unknown>>) {
    const chapter = (volume.chapters as Array<Record<string, unknown>>)
      .find((ch: Record<string, unknown>) => ch.id === props.chapterId)
    if (chapter) return (chapter.outline as string) || ''
  }
  return ''
}

// ==================== 生命周期 ====================
onMounted(async () => {
  if (!props.chapterId || !projectStore.project) return
  try {
    if (window.electronAPI?.readChapter) {
      const content = await window.electronAPI.readChapter(projectStore.project.path, props.chapterId)
      if (content) {
        contentHtml.value = content
        let retries = 0
        const trySetContent = () => {
          if (contentEditorRef.value) {
            contentEditorRef.value.setContent(content)
            nextTick(() => {
              const html = contentEditorRef.value?.getHTML() || content
              const text = contentEditorRef.value?.getText() || ''
              const wc = text.replace(/\s/g, '').length
              emit('update:content', html, text, wc)
            })
          } else if (retries < 10) {
            retries++
            setTimeout(trySetContent, 50)
          }
        }
        nextTick(trySetContent)
      }
    }
  } catch (err) {
    console.error('加载章节正文失败:', err)
  }
})

onBeforeUnmount(async () => {
  if (!props.chapterId || !projectStore.project) return
  const html = contentEditorRef.value?.getHTML?.() || contentHtml.value
  if (!html) return
  try {
    await window.electronAPI.writeChapter(projectStore.project.path, props.chapterId, html)
  } catch (err) {
    console.error('[ChapterEditorWithOutline] 组件销毁前保存失败:', err)
  }
})

onActivated(async () => {
  if (!props.chapterId || !projectStore.project) return
  try {
    const content = await window.electronAPI.readChapter(projectStore.project.path, props.chapterId)
    if (content && content !== contentHtml.value) {
      contentHtml.value = content
      contentEditorRef.value?.setContent(content)
      const html = contentEditorRef.value?.getHTML() || content
      const text = contentEditorRef.value?.getText() || ''
      const wordCount = text.replace(/\s/g, '').length
      emit('update:content', html, text, wordCount)
    }
  } catch (err) {
    console.error('[ChapterEditorWithOutline] onActivated 读取磁盘失败:', err)
  }
})

watch(() => props.chapterId, async (newId) => {
  if (!newId || !projectStore.project) return
  try {
    if (window.electronAPI?.readChapter) {
      const content = await window.electronAPI.readChapter(projectStore.project.path, newId)
      if (content) {
        contentHtml.value = content
        let retries = 0
        const trySetContent = () => {
          if (contentEditorRef.value) {
            contentEditorRef.value.setContent(content)
            nextTick(() => {
              const html = contentEditorRef.value?.getHTML() || content
              const text = contentEditorRef.value?.getText() || ''
              const wc = text.replace(/\s/g, '').length
              emit('update:content', html, text, wc)
            })
          } else if (retries < 10) {
            retries++
            setTimeout(trySetContent, 50)
          }
        }
        nextTick(trySetContent)
      } else {
        contentHtml.value = ''
        nextTick(() => {
          contentEditorRef.value?.clearContent()
          emit('update:content', '', '', 0)
        })
      }
    }
  } catch (err) {
    console.error('加载章节正文失败:', err)
  }
})

// ==================== 公开方法 ====================
function setContent(html: string): void {
  contentHtml.value = html
  nextTick(() => { contentEditorRef.value?.setContent(html) })
}

function getContent(): string { return contentEditorRef.value?.getHTML() || '' }
function getHTML(): string { return contentEditorRef.value?.getHTML() || '' }
function getText(): string { return contentEditorRef.value?.getText() || '' }

function clearContent(): void {
  contentHtml.value = ''
  nextTick(() => { contentEditorRef.value?.clearContent() })
}

defineExpose({
  setContent,
  getContent,
  getHTML,
  getText,
  clearContent,
  contentEditorRef
})
</script>

<style scoped>
/* ========== 总体布局 ========== */
.chapter-editor-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* ========== 顶部操作栏 ========== */
.editor-topbar {
  --topbar-height: 44px;
  min-height: var(--topbar-height);
}

.editor-topbar .el-divider--vertical {
  margin: 0 4px;
}

/* ========== AI 结果面板 ========== */
.ai-result-panel {
  font-size: 15px;
  line-height: 1.85;
}

.ai-result-panel :deep(p) {
  margin-bottom: 0.6em;
}

.ai-result-panel :deep(blockquote) {
  border-left: 3px solid var(--el-color-primary-light-5);
  padding-left: 1em;
  margin: 0.5em 0;
  color: var(--el-text-color-secondary);
}

/* ========== AI 对话框 ========== */
.ai-generation-dialog :deep(.el-dialog__header) {
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--el-border-color);
  margin-right: 0;
}

.ai-generation-dialog :deep(.el-dialog__body) {
  padding: 20px 24px;
}

.ai-generation-dialog :deep(.el-dialog__footer) {
  padding: 12px 24px 20px;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
