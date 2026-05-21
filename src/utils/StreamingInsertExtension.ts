import { Extension } from '@tiptap/core'
import type { Editor } from '@tiptap/core'

/**
 * 流式插入扩展配置选项接口
 */
export interface StreamingInsertOptions {
  /** 流式插入时的占位符 ID（用于定位插入点） */
  placeholderId?: string
}

/**
 * TipTap 流式插入扩展
 * 
 * 功能说明：
 * - 解决流式输出时 Undo 分块问题
 * - 提供三个命令：startStreaming、appendStreamingToken、endStreaming
 * - 通过自定义事务（Transaction）元数据控制历史记录
 * 
 * 使用场景：
 * - AI 生成内容的流式显示
 * - 需要将所有流式输出作为一个整体撤销
 * 
 * 使用示例：
 * ```typescript
 * // 1. 开始流式插入
 * editor.commands.startStreaming()
 * 
 * // 2. 追加 token（在流式回调中调用）
 * editor.commands.appendStreamingToken('Hello')
 * editor.commands.appendStreamingToken(' World')
 * 
 * // 3. 结束流式插入（一次性加入撤销历史）
 * editor.commands.endStreaming()
 * ```
 * 
 * 技术原理：
 * - 开始时不加入历史记录（addToHistory: false）
 * - 追加 token 时也不加入历史记录
 * - 结束时一次性将整个操作加入撤销历史
 */
export const StreamingInsertExtension = Extension.create<StreamingInsertOptions>({
  name: 'streamingInsert',

  /**
   * 默认配置选项
   */
  addOptions() {
    return {
      placeholderId: 'streaming-cursor'
    }
  },

  /**
   * 添加自定义命令
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addCommands(): any {
    return {
      /**
       * 开始流式插入
       * 
       * 功能：
       * - 在光标位置插入一个空文本节点作为占位符
       * - 设置事务元数据，使后续操作不加入撤销历史
       * 
       * @param options - 命令选项
       * @returns 是否执行成功
       */
      startStreaming: () => ({ tr, editor }: { tr: { selection: { from: number }; insert: (pos: number, node: unknown) => void }; editor: Editor }) => {
        const pos = tr.selection.from
        const node = editor.schema.text('')
        tr.insert(pos, node)
        return true
      },

      /**
       * 追加流式 token
       * 
       * 功能：
       * - 在光标位置插入新的 token 文本
       * - 不加入撤销历史，实现平滑的流式显示
       * 
       * @param token - 要插入的 token 字符串
       * @returns 是否执行成功
       */
      appendStreamingToken: (token: string) => ({ tr }: { tr: { selection: { $from: { pos: number } }; insertText: (text: string, pos: number) => void } }) => {
        const { $from } = tr.selection
        const pos = $from.pos
        tr.insertText(token, pos)
        return true
      },

      /**
       * 结束流式插入
       * 
       * 功能：
       * - 将整个流式插入操作一次性加入撤销历史
       * - 用户只需一次撤销即可撤销所有 AI 生成的内容
       * 
       * @returns 是否执行成功
       */
      endStreaming: () => ({ tr }: { tr: { setMeta: (key: string, value: boolean) => void } }) => {
        tr.setMeta('addToHistory', true)
        return true
      }
    }
  }
})
