<template>
  <div class="focus-mode fixed inset-0 bg-[var(--el-bg-color-page)] z-50 flex flex-col">
    <!-- 顶部最小化工具栏 -->
    <div class="flex items-center justify-between p-2 border-b border-[var(--el-border-color)] shrink-0">
      <el-button text size="small" @click="exitFocusMode">
        <el-icon><ArrowLeft /></el-icon>
        返回
      </el-button>

      <div class="text-sm text-[var(--el-text-color-secondary)]">
        {{ chapterTitle }}
      </div>

      <div class="flex items-center gap-2">
        <el-tag size="small" type="info">{{ wordCount }} 字</el-tag>
        <el-button size="small" @click="saveContent">
          <el-icon><Check /></el-icon>
          保存
        </el-button>
      </div>
    </div>

    <!-- 富文本编辑器（与普通模式一致） -->
    <div class="flex-1 overflow-hidden">
      <ChapterEditor
        ref="chapterEditorRef"
        :content="content"
        :editable="true"
        @update="onEditorUpdate"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ArrowLeft, Check } from '@element-plus/icons-vue'
import ChapterEditor from './ChapterEditor.vue'

const props = defineProps<{
  content: string
  chapterTitle: string
}>()

const emit = defineEmits<{
  exit: []
  save: [content: string, isAuto: boolean, done: () => void]
}>()

const chapterEditorRef = ref<InstanceType<typeof ChapterEditor> | null>(null)
const wordCount = ref(0)
const saving = ref(false) // 防止重复触发退出

/**
 * 监听编辑器内容变更，更新字数并触发自动保存
 */
let autoSaveTimer: number | null = null
function onEditorUpdate(_html: string, _text: string, wc: number): void {
  wordCount.value = wc
  // 自动保存（3秒无操作）
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = window.setTimeout(() => {
    const editor = chapterEditorRef.value
    if (!editor) return // 编辑器已销毁，跳过保存
    const content = editor.getHTML()
    if (!content) return // 内容为空，跳过保存（防止覆盖）
    // 自动保存不阻塞，直接发 save 事件即可
    emit('save', content, true, () => {})
  }, 3000)
}

/**
 * 手动保存
 */
function saveContent(): void {
  const editor = chapterEditorRef.value
  if (!editor) {
    ElMessage.warning('编辑器未就绪，无法保存')
    return
  }
  const content = editor.getHTML()
  if (!content) {
    ElMessage.warning('内容为空，无需保存')
    return
  }
  // 手动保存同样等待完成，给提示
  saving.value = true
  emit('save', content, false, () => { saving.value = false })
}

/**
 * 退出专注模式：先保存，等待保存完成后再退出
 * 关键修复：通过 done callback 确保父组件磁盘写入完成后再销毁组件
 */
async function exitFocusMode(): Promise<void> {
  if (saving.value) return // 防止重复触发
  saving.value = true

  // 关键修复：如果编辑器 ref 无效，说明内容已在自动保存中保存过，直接退出
  const editor = chapterEditorRef.value
  if (!editor) {
    console.warn('[FocusMode] 编辑器 ref 为 null，跳过保存，直接退出')
    saving.value = false
    emit('exit')
    return
  }

  const content = editor.getHTML()

  // 等待父组件保存完成（包括磁盘写入）
  await new Promise<void>((resolve) => {
    emit('save', content, true, () => resolve())
  })

  saving.value = false
  emit('exit')
}
</script>
