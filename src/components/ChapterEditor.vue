<template>
  <div class="chapter-editor h-full flex flex-col">
    <!-- 浮动工具栏 -->
    <div v-if="editor" class="editor-toolbar shrink-0 flex items-center gap-1 px-3 py-1.5 border-b" style="border-color: var(--el-border-color); background: var(--el-bg-color-page)">
      <el-tooltip content="撤销 (Ctrl+Z)" :show-after="500" placement="bottom">
        <el-button text size="small" :disabled="!editor.can().undo()" @click="editor.chain().focus().undo().run()">
          <el-icon><RefreshLeft /></el-icon>
        </el-button>
      </el-tooltip>
      <el-tooltip content="重做 (Ctrl+Shift+Z)" :show-after="500" placement="bottom">
        <el-button text size="small" :disabled="!editor.can().redo()" @click="editor.chain().focus().redo().run()">
          <el-icon><RefreshRight /></el-icon>
        </el-button>
      </el-tooltip>

      <el-divider direction="vertical" />

      <el-tooltip content="加粗 (Ctrl+B)" :show-after="500" placement="bottom">
        <el-button text size="small" :type="editor.isActive('bold') ? 'primary' : ''" @click="editor.chain().focus().toggleBold().run()">
          <strong>B</strong>
        </el-button>
      </el-tooltip>
      <el-tooltip content="斜体 (Ctrl+I)" :show-after="500" placement="bottom">
        <el-button text size="small" :type="editor.isActive('italic') ? 'primary' : ''" @click="editor.chain().focus().toggleItalic().run()">
          <em>I</em>
        </el-button>
      </el-tooltip>
      <el-tooltip content="删除线" :show-after="500" placement="bottom">
        <el-button text size="small" :type="editor.isActive('strike') ? 'primary' : ''" @click="editor.chain().focus().toggleStrike().run()">
          <s>S</s>
        </el-button>
      </el-tooltip>

      <el-divider direction="vertical" />

      <el-dropdown trigger="click" @command="onHeadingCommand">
        <el-button text size="small">
          标题 <el-icon class="el-icon--right"><ArrowDown /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="0" :class="{ 'is-active': !editor.isActive('heading') }">正文</el-dropdown-item>
            <el-dropdown-item command="1" :class="{ 'is-active': editor.isActive('heading', { level: 1 }) }">标题 1</el-dropdown-item>
            <el-dropdown-item command="2" :class="{ 'is-active': editor.isActive('heading', { level: 2 }) }">标题 2</el-dropdown-item>
            <el-dropdown-item command="3" :class="{ 'is-active': editor.isActive('heading', { level: 3 }) }">标题 3</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <el-divider direction="vertical" />

      <el-tooltip content="引用" :show-after="500" placement="bottom">
        <el-button text size="small" :type="editor.isActive('blockquote') ? 'primary' : ''" @click="editor.chain().focus().toggleBlockquote().run()">
          <el-icon><ChatLineSquare /></el-icon>
        </el-button>
      </el-tooltip>
      <el-tooltip content="分割线" :show-after="500" placement="bottom">
        <el-button text size="small" @click="editor.chain().focus().setHorizontalRule().run()">
          <el-icon><Minus /></el-icon>
        </el-button>
      </el-tooltip>

      <div class="ml-auto text-xs" style="color: var(--el-text-color-placeholder)">
        {{ wordCount }} 字
      </div>
    </div>

    <!-- 编辑器主体 -->
    <div class="flex-1 overflow-y-auto p-4">
      <div class="editor-with-linenums max-w-4xl mx-auto flex">
        <!-- 行号栏 -->
        <div class="linenums shrink-0 pr-2 text-right select-none" :style="{ width: '60px' }">
          <div
            v-for="n in lineCount"
            :key="n"
            class="linenum"
            :class="{ 'bg-blue-100 dark:bg-blue-900': isLineSelected(n) }"
          >
            {{ n }}
          </div>
        </div>
        <!-- 编辑器 -->
        <div class="editor-area tiptap flex-1 min-w-0">
          <editor-content :editor="editor" />
        </div>
      </div>
    </div>

    <!-- 右键菜单 -->
    <context-menu
      ref="contextMenuRef"
      :items="contextMenuItems"
      @select="onContextMenuSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, shallowRef, nextTick, computed } from 'vue'
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { RefreshLeft, RefreshRight, ArrowDown, ChatLineSquare, Minus } from '@element-plus/icons-vue'
import ContextMenu from './ContextMenu.vue'
import type { ContextMenuItem } from './ContextMenu.vue'

const props = defineProps<{
  /** 编辑器初始内容（HTML） */
  content: string
  /** 是否可编辑（流式输出时禁用） */
  editable: boolean
}>()

const emit = defineEmits<{
  /** 内容变更 */
  update: [html: string, text: string, wordCount: number]
  /** 创建编辑器实例，供父组件调用 */
  ready: [editor: Editor]
  /** 选中内容添加到创作助手 */
  addToAssistant: [lineRange: string, selectedText: string]
}>()

const wordCount = ref(0)
const editor = shallowRef<Editor | null>(null)
const contextMenuRef = ref<InstanceType<typeof ContextMenu> | null>(null)
const selectedLineRange = ref<{ start: number; end: number } | null>(null)

// 右键菜单项
const contextMenuItems = ref<ContextMenuItem[]>([
  { id: 'add-to-assistant', label: '添加到创作助手', icon: undefined }
])

// 计算行号
const lineCount = computed(() => {
  if (!editor.value) return 0
  const text = editor.value.state.doc.textContent || ''
  // 按换行符分割计算行数
  const lines = text.split('\n').filter(line => line.trim() !== '')
  return Math.max(lines.length, 1)
})

// 获取选中内容的行号范围
function getSelectedLineRange(): { startLine: number; endLine: number; selectedText: string } | null {
  if (!editor.value) return null
  
  const { from, to } = editor.value.state.selection
  if (from === to) return null // 没有选中内容
  
  const selectedText = editor.value.state.doc.textBetween(from, to, '\n')
  
  // 计算起始行号：计算从文档开始到 from 位置有多少行
  const textBeforeFrom = editor.value.state.doc.textBetween(0, from, '\n')
  const startLine = textBeforeFrom.split('\n').filter(line => line.trim() !== '').length + 1
  
  // 计算结束行号
  const textBeforeTo = editor.value.state.doc.textBetween(0, to, '\n')
  const endLine = textBeforeTo.split('\n').filter(line => line.trim() !== '').length
  
  // 更新选中行号范围（用于高亮）
  selectedLineRange.value = { start: startLine, end: endLine }
  
  return { startLine, endLine, selectedText }
}

// 判断某行是否被选中
function isLineSelected(lineNum: number): boolean {
  if (!selectedLineRange.value) return false
  return lineNum >= selectedLineRange.value.start && lineNum <= selectedLineRange.value.end
}

// 监听选择变化，更新选中行号范围
function onSelectionUpdate(): void {
  if (!editor.value) return
  const { from, to } = editor.value.state.selection
  if (from === to) {
    selectedLineRange.value = null
    return
  }
  getSelectedLineRange()
}

// 右键菜单选择处理
function onContextMenuSelect(item: ContextMenuItem): void {
  if (item.id === 'add-to-assistant') {
    const range = getSelectedLineRange()
    if (range) {
      const lineRangeText = `L${range.start}${range.start !== range.end ? `-L${range.end}` : ''}`
      emit('addToAssistant', lineRangeText, range.selectedText)
      // 通知 ChatAssistant 添加行号标签
      ;(window as any).__addLineRangeToAssistant?.(lineRangeText, range.selectedText)
    }
  }
}

// 编辑器右键事件
function onEditorContextMenu(event: MouseEvent): void {
  const range = getSelectedLineRange()
  if (!range) {
    event.preventDefault()
    return
  }
  event.preventDefault()
  contextMenuRef.value?.show(event)
}

function initEditor(): void {
  const instance = new Editor({
    content: props.content || '',
    editable: props.editable,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] }
      }),
      Placeholder.configure({
        placeholder: '开始写作...'
      }),
      CharacterCount
    ],
    onUpdate: ({ editor: ed }) => {
      const text = ed.state.doc.textContent || ''
      const wc = text.replace(/\s/g, '').length
      wordCount.value = wc
      emit('update', ed.getHTML(), text, wc)
    },
    onCreate: ({ editor: ed }) => {
      // 初始化字数
      const text = ed.state.doc.textContent || ''
      wordCount.value = text.replace(/\s/g, '').length
      emit('ready', ed)
    },
    onSelectionUpdate: ({ editor: ed }) => {
      // 选择变化时更新选中行号范围
      onSelectionUpdate()
    }
  })

  editor.value = instance

  // 添加右键菜单事件
  setTimeout(() => {
    const editorDom = document.querySelector('.editor-area .tiptap')
    if (editorDom) {
      editorDom.addEventListener('contextmenu', onEditorContextMenu)
    }
  }, 100)
}

/** 设置编辑器内容（切换章节时调用） */
function setContent(html: string): void {
  if (!editor.value) return
  // 使用 commands 避免触发 onUpdate
  editor.value.commands.setContent(html, false)
  // 手动更新字数
  const text = editor.value.state.doc.textContent || ''
  wordCount.value = text.replace(/\s/g, '').length
}

/** 获取编辑器 HTML 内容 */
function getHTML(): string {
  return editor.value?.getHTML() || ''
}

/** 获取纯文本内容 */
function getText(): string {
  return editor.value?.state.doc.textContent || ''
}

/** 追加内容（流式输出用） */
function appendContent(html: string): void {
  if (!editor.value) return
  // 在文档末尾插入内容
  editor.value.commands.insertContent(html)
}

/** 清空内容 */
function clearContent(): void {
  if (!editor.value) return
  editor.value.commands.clearContent(false)
  wordCount.value = 0
}

/** 聚焦编辑器 */
function focus(): void {
  editor.value?.commands.focus()
}

/** 标题下拉命令 */
function onHeadingCommand(level: string): void {
  if (!editor.value) return
  const n = parseInt(level)
  if (n === 0) {
    editor.value.chain().focus().setParagraph().run()
  } else {
    editor.value.chain().focus().toggleHeading({ level: n as 1 | 2 | 3 }).run()
  }
}

// 监听 editable 变化
watch(() => props.editable, (val) => {
  editor.value?.setEditable(val)
})

onMounted(() => {
  initEditor()
})

onBeforeUnmount(() => {
  // 清理右键菜单事件监听器
  const editorDom = document.querySelector('.editor-area .tiptap')
  if (editorDom) {
    editorDom.removeEventListener('contextmenu', onEditorContextMenu)
  }
  editor.value?.destroy()
  editor.value = null
})

// 提供给 ChatAssistant 使用的获取选中行号范围的方法
function getSelectedLineInfo(): { lineRange: string; selectedText: string } | null {
  const range = getSelectedLineRange()
  if (!range) return null
  const lineRange = `L${range.startLine}${range.startLine !== range.endLine ? `-L${range.endLine}` : ''}`
  return { lineRange, selectedText: range.selectedText }
}

// 获取选中的文本内容
function getSelectedText(): string {
  if (!editor.value) return ''
  const { from, to } = editor.value.state.selection
  if (from === to) return ''
  return editor.value.state.doc.textBetween(from, to, '\n')
}

// 添加到 window，供 ChatAssistant 调用
onMounted(() => {
  ;(window as any).__getSelectedLineInfo = getSelectedLineInfo
})

defineExpose({
  setContent,
  getHTML,
  getText,
  appendContent,
  clearContent,
  focus,
  editor,
  getSelectedLineInfo,
  getSelectedText
})
</script>

<style scoped>
.editor-area {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.editor-with-linenums {
  display: flex;
}

.linenums {
  color: var(--el-text-color-placeholder);
  font-size: 14px;
  line-height: 1.8;
  padding-top: 24px;
  user-select: none;
}

.linenum {
  height: 1.8em;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding-right: 8px;
}

.editor-area :deep(.tiptap) {
  outline: none;
  padding: 24px;
  min-height: 60vh;
  font-size: 16px;
  line-height: 1.8;
  color: var(--el-text-color-primary);
  caret-color: var(--el-color-primary);
}

.editor-area :deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: var(--el-text-color-placeholder);
  pointer-events: none;
  height: 0;
}

.editor-area :deep(.tiptap p) {
  margin-bottom: 0.5em;
}

.editor-area :deep(.tiptap h1),
.editor-area :deep(.tiptap h2),
.editor-area :deep(.tiptap h3) {
  margin-top: 1em;
  margin-bottom: 0.5em;
  font-weight: 600;
}

.editor-area :deep(.tiptap h1) { font-size: 2em; }
.editor-area :deep(.tiptap h2) { font-size: 1.5em; }
.editor-area :deep(.tiptap h3) { font-size: 1.25em; }

.editor-area :deep(.tiptap blockquote) {
  border-left: 3px solid var(--el-border-color);
  padding-left: 1em;
  margin-left: 0;
  color: var(--el-text-color-secondary);
}

.editor-area :deep(.tiptap hr) {
  border: none;
  border-top: 1px solid var(--el-border-color);
  margin: 1.5em 0;
}

.editor-area :deep(.tiptap strong) {
  font-weight: 700;
}

.editor-area :deep(.tiptap em) {
  font-style: italic;
}
</style>
