<template>
  <div class="chat-message mb-3" :class="message.role">
    <!-- AI消息 -->
    <div v-if="message.role === 'assistant'" class="flex gap-2">
      <div class="shrink-0 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">
        AI
      </div>
      <div class="flex-1">
        <div class="text-xs text-[var(--el-text-color-secondary)] mb-1">AI 助手</div>
        <!-- Markdown 渲染的AI回复 -->
        <div
          class="text-sm leading-relaxed break-words markdown-content"
          v-html="renderMarkdown(message.content)"
        ></div>
        <!-- 操作按钮 -->
        <div v-if="message.actions && message.actions.length > 0" class="mt-2 flex flex-wrap gap-1">
          <el-button
            v-for="action in message.actions"
            :key="action.value"
            size="small"
            :type="action.type || 'default'"
            @click="$emit('action', action)"
          >
            {{ action.label }}
          </el-button>
        </div>
      </div>
    </div>

    <!-- 用户消息 -->
    <div v-else-if="message.role === 'user'" class="flex gap-2 flex-row-reverse">
      <div class="shrink-0 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">
        我
      </div>
      <div class="flex-1 text-right">
        <div class="text-xs text-[var(--el-text-color-secondary)] mb-1">你</div>
        <div class="text-sm leading-relaxed whitespace-pre-wrap break-words text-[var(--el-text-color-regular)]">
          {{ message.content }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChatMessage, ChatAction } from '@/agents/WritingAssistantAgent'

defineProps<{
  message: ChatMessage
}>()

defineEmits<{
  (e: 'action', action: ChatAction): void
}>()

/**
 * 简单的 Markdown 渲染（不依赖外部库）
 * 支持：加粗、斜体、行内代码、代码块、标题、列表、引用、链接
 */
function renderMarkdown(text: string): string {
  if (!text) return ''

  let html = text
    // 代码块（必须在行内代码之前处理）
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre class="markdown-code-block"><code class="language-${lang}">${escapeHtml(code.trim())}</code></pre>`
    })
    // 行内代码
    .replace(/`([^`]+)`/g, '<code class="markdown-inline-code">$1</code>')
    // 标题（h1-h3）
    .replace(/^### (.+)$/gm, '<h3 class="markdown-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="markdown-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="markdown-h1">$1</h1>')
    // 加粗（**text** 或 __text__）
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // 斜体（*text* 或 _text_）
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // 引用块
    .replace(/^> (.+)$/gm, '<blockquote class="markdown-blockquote">$1</blockquote>')
    // 无序列表
    .replace(/^- (.+)$/gm, '<li class="markdown-li">$1</li>')
    // 有序列表
    .replace(/^\d+\. (.+)$/gm, '<li class="markdown-li-ordered">$1</li>')
    // 链接
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="markdown-link">$1</a>')
    // 换行
    .replace(/\n\n/g, '<br><br>')
    .replace(/(?<!<br>)\n/g, '<br>')

  return html
}

/**
 * HTML 转义（防止 XSS）
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
</script>

<style scoped>
.chat-message.assistant :deep(.text-sm) {
  color: var(--el-text-color-primary);
}

.chat-message.user :deep(.text-sm) {
  background: var(--el-color-primary-light-9);
  padding: 8px 12px;
  border-radius: 8px;
  display: inline-block;
  max-width: 85%;
}

/* Markdown 样式 */
:deep(.markdown-content) {
  word-wrap: break-word;
  overflow-wrap: break-word;
}

:deep(.markdown-content strong) {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

:deep(.markdown-content em) {
  font-style: italic;
}

:deep(.markdown-inline-code) {
  background: var(--el-fill-color-light);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 0.9em;
  color: var(--el-color-primary);
}

:deep(.markdown-code-block) {
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  padding: 12px;
  margin: 8px 0;
  overflow-x: auto;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 0.85em;
  line-height: 1.5;
}

:deep(.markdown-h1),
:deep(.markdown-h2),
:deep(.markdown-h3) {
  margin: 12px 0 8px 0;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

:deep(.markdown-h1) { font-size: 1.4em; }
:deep(.markdown-h2) { font-size: 1.2em; }
:deep(.markdown-h3) { font-size: 1.1em; }

:deep(.markdown-blockquote) {
  border-left: 3px solid var(--el-color-primary);
  padding-left: 12px;
  margin: 8px 0;
  color: var(--el-text-color-secondary);
  font-style: italic;
}

:deep(.markdown-li) {
  margin: 4px 0;
  padding-left: 20px;
  position: relative;
}

:deep(.markdown-li::before) {
  content: '•';
  position: absolute;
  left: 4px;
  color: var(--el-color-primary);
}

:deep(.markdown-li-ordered) {
  margin: 4px 0;
  padding-left: 20px;
}

:deep(.markdown-link) {
  color: var(--el-color-primary);
  text-decoration: underline;
}

:deep(.markdown-link:hover) {
  color: var(--el-color-primary-light-3);
}
</style>
