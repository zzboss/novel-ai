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
      <div class="editor-wrapper">
        <editor-content :editor="editor" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Check } from '@element-plus/icons-vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
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

const wordCount = ref<number>(0)

/**
 * 计算编辑器字数
 */
function updateWordCount(editorInstance: any): void {
  if (!editorInstance) return
  const text = editorInstance.state.doc.textContent || ''
  wordCount.value = text.replace(/\s/g, '').length
}

/**
 * 初始化编辑器（使用 Tiptap Vue 集成）
 */
const editor = useEditor({
  content: props.content,
  extensions: [
    StarterKit,
    Placeholder.configure({
      placeholder: '开始写作...'
    })
  ],
  onUpdate: ({ editor: editorInstance }) => {
    // 统计字数：去空白后的字符数（适用于中文）
    const text = editorInstance.state.doc.textContent || ''
    wordCount.value = text.replace(/\s/g, '').length
    // 自动保存（3秒无操作）
    autoSave()
  },
  onCreate: ({ editor: editorInstance }) => {
    // 初始化时计算字数
    updateWordCount(editorInstance)
  }
})

/**
 * 监听 content prop 变化，更新编辑器内容
 */
watch(() => props.content, (newContent) => {
  if (editor.value && newContent) {
    // 只有在内容真正变化时才更新，避免循环
    const currentContent = editor.value.getHTML()
    if (currentContent !== newContent) {
      editor.value.commands.setContent(newContent, false)
      // 更新字数统计
      updateWordCount(editor.value)
    }
  }
}, { immediate: true })


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
  if (!editor.value) return
  
  const content = editor.value.getHTML()
  emit('save', content)
  ElMessage.success('已自动保存')
}

/**
 * 获取编辑器内容
 */
function getContent(): string {
  return editor.value?.getHTML() || ''
}

onBeforeUnmount(() => {
  if (editor.value) {
    editor.value.destroy()
  }
})

defineExpose({
  getContent
})
</script>

<style scoped>
.editor-wrapper {
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
  height: 100%;
  overflow-y: auto;
}

.editor-wrapper :deep(.ProseMirror) {
  min-height: 100%;
  outline: none;
}

.editor-wrapper :deep(.ProseMirror p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: var(--el-text-color-placeholder);
  pointer-events: none;
  height: 0;
}
</style>
