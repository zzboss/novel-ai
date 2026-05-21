/**
 * 编辑器上下文提取模块
 */

import type { Editor } from '@tiptap/vue-3'
import type { EditorContext } from './types'

/**
 * 从编辑器实例提取上下文
 */
export function extractEditorContext(editor: Editor | null): EditorContext {
  if (!editor) return {}

  const context: EditorContext = {}

  // 获取选中内容
  const { from, to } = editor.state.selection
  if (from !== to) {
    context.selectedText = editor.state.doc.textBetween(from, to, ' ')
    
    // 尝试获取 HTML
    try {
      const slice = editor.state.selection.content()
      const tempDoc = editor.schema.nodeFromJSON({
        type: 'doc',
        content: slice.content.toJSON()
      })
      // 暂时不设置 selectedHtml（需要正确处理）
    } catch {
      // 忽略错误
    }
  }

  // 获取光标位置
  context.cursorPosition = from

  // 获取全文
  context.chapterContent = editor.state.doc.textContent
  context.wordCount = context.chapterContent.replace(/\s/g, '').length

  return context
}
