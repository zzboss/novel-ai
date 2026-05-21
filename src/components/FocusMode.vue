<template>
  <div class="focus-mode fixed inset-0 bg-[var(--el-bg-color-page)] z-50 flex flex-col">
    <!-- 顶部最小化工具栏 -->
    <div class="flex items-center justify-between p-2 border-b border-[var(--el-border-color)]">
      <el-button text size="small" @click="$emit('exit')">
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

    <!-- 编辑器区域 -->
    <div class="flex-1 overflow-hidden">
      <div ref="editorContainer" class="h-full"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Check } from '@element-plus/icons-vue'
import { Editor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'

const props = defineProps<{
  content: string
  chapterTitle: string
}>()

const emit = defineEmits<{
  exit: []
  save: [content: string]
}>()

const editorContainer = ref<HTMLElement | null>(null)
const wordCount = ref<number>(0)
let editor: InstanceType<typeof Editor> | null = null

/**
 * 初始化编辑器
 */
function initEditor(): void {
  if (!editorContainer.value) return
  
  editor = new Editor({
    element: editorContainer.value,
    content: props.content,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: '开始写作...'
      })
    ],
    onUpdate: () => {
      if (editor) {
        // 统计字数：去空白后的字符数（适用于中文）
        const text = editor.state.doc.textContent || ''
        wordCount.value = text.replace(/\s/g, '').length
        // 自动保存（3秒无操作）
        autoSave()
      }
    }
  })
}

/**
 * 自动保存
 */
let autoSaveTimer: number | null = null
function autoSave(): void {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
  }
  
  autoSaveTimer = window.setTimeout(() => {
    saveContent()
  }, 3000)
}

/**
 * 保存内容
 */
function saveContent(): void {
  if (!editor) return
  
  const content = editor.getHTML()
  emit('save', content)
  ElMessage.success('已自动保存')
}

/**
 * 获取编辑器内容
 */
function getContent(): string {
  return editor?.getHTML() || ''
}

onMounted(() => {
  initEditor()
})

onBeforeUnmount(() => {
  if (editor) {
    editor.destroy()
    editor = null
  }
})

defineExpose({
  getContent
})
</script>

<style scoped>
.focus-mode :deep(.tiptap) {
  height: 100%;
  overflow-y: auto;
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

.focus-mode :deep(.tiptap:focus) {
  outline: none;
}
</style>
