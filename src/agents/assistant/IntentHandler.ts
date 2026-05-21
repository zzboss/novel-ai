/**
 * IntentHandler - 意图处理器
 *
 * 负责处理各种意图的具体逻辑
 * 不直接生成内容，只做对话引导，内容生成由管线完成
 */

import type { EditorContext } from '@/utils/IntentParser'
import type { ChatAction, ConversationPhase } from '../WritingAssistantAgent'

export class IntentHandler {
  /**
   * 处理修改意图
   * 注意：不直接生成内容，只做对话引导
   */
  handleModifyIntent(
    userInput: string,
    context?: EditorContext
  ): { content: string; actions?: ChatAction[]; nextPhase?: ConversationPhase } {
    // 没有选中内容时，引导用户
    if (!context?.selectedText && !context?.chapterContent) {
      let hint = '⚠️ 未检测到修改内容。\n\n'
      hint += '你可以通过以下方式让我帮你修改：\n\n'
      hint += '1️⃣ **打开章节**：点击左侧章节标题打开章节\n'
      hint += '2️⃣ **选中文本**：在编辑器中选中要修改的文本\n'
      hint += '3️⃣ **告诉我修改要求**：打开章节或选中文本后，告诉我你想怎么改\n\n'
      hint += '例如：\n'
      hint += '- 打开章节后说："把这段对话改得更自然"\n'
      hint += '- 选中文本后说："把这段改得更简洁"\n'
      hint += '- 选中文本后说："修改这段，让主角更冷静"\n\n'
      hint += '请先打开章节或选中要修改的文本，然后告诉我你的修改要求。'

      return {
        content: hint,
        nextPhase: 'understanding'
      }
    }

    // 有选中内容，引导用户确认后触发管线
    const target = context?.selectedText ? '选中的内容' : '当前章节'
    return {
      content: `好的，我将帮你修改${target}。\n\n修改要求：「${userInput}」\n\n确认后，我会在编辑器中直接修改内容。`,
      actions: [
        { label: '确认修改', value: 'confirm_modify', type: 'primary' },
        { label: '调整要求', value: 'adjust' },
        { label: '取消', value: 'cancel' }
      ],
      nextPhase: 'planning'
    }
  }

  /**
   * 处理润色意图
   * 注意：不直接生成内容，只做对话引导
   */
  handlePolishIntent(
    userInput: string,
    context?: EditorContext
  ): { content: string; actions?: ChatAction[]; nextPhase?: ConversationPhase } {
    // 没有选中内容时，引导用户
    if (!context?.selectedText && !context?.chapterContent) {
      return {
        content: '请先选中要润色的内容，或者打开要润色的章节。',
        nextPhase: 'understanding'
      }
    }

    // 有选中内容，引导用户确认后触发管线
    const target = context?.selectedText ? '选中的内容' : '当前章节'
    return {
      content: `好的，我将帮你润色${target}。\n\n润色要求：「${userInput}」\n\n确认后，我会在编辑器中直接润色内容。`,
      actions: [
        { label: '确认润色', value: 'confirm_polish', type: 'primary' },
        { label: '调整要求', value: 'adjust' },
        { label: '取消', value: 'cancel' }
      ],
      nextPhase: 'planning'
    }
  }

  /**
   * 处理重写意图
   * 注意：不直接生成内容，只做对话引导
   */
  handleRewriteIntent(
    userInput: string,
    context?: EditorContext
  ): { content: string; actions?: ChatAction[]; nextPhase?: ConversationPhase } {
    // 没有选中内容时，引导用户
    if (!context?.selectedText && !context?.chapterContent) {
      return {
        content: '请先选中要重写的内容，或者打开要重写的章节。',
        nextPhase: 'understanding'
      }
    }

    // 有选中内容，引导用户确认后触发管线
    const target = context?.selectedText ? '选中的内容' : '当前章节'
    return {
      content: `好的，我将帮你重写${target}。\n\n重写要求：「${userInput}」\n\n确认后，我会在编辑器中直接重写内容。`,
      actions: [
        { label: '确认重写', value: 'confirm_rewrite', type: 'primary' },
        { label: '调整要求', value: 'adjust' },
        { label: '取消', value: 'cancel' }
      ],
      nextPhase: 'planning'
    }
  }

  /**
   * 生成操作按钮（显示在AI消息下方）
   */
  generateActions(phase: ConversationPhase, context?: EditorContext): ChatAction[] {
    if (phase === 'greeting' || phase === 'understanding') {
      const actions: ChatAction[] = []

      // 有选中内容时，添加选中相关的操作
      if (context?.selectedText) {
        actions.push(
          { label: '润色选中', value: 'polish_selection', type: 'primary' },
          { label: '重写选中', value: 'rewrite_selection' },
          { label: '修改选中', value: 'modify_selection' },
          { label: '解释选中', value: 'explain_selection' }
        )
      }

      // 添加咨询建议（固定按钮中没有的）
      actions.push({ label: '咨询建议', value: 'advice' })

      return actions
    }

    if (phase === 'planning') {
      return [
        { label: '确认，开始生成', value: 'confirm_generate', type: 'primary' },
        { label: '调整目标', value: 'adjust' },
        { label: '取消', value: 'cancel' }
      ]
    }

    if (phase === 'reviewing') {
      return [
        { label: '满意，接着写', value: 'satisfied', type: 'success' },
        { label: '修改这部分', value: 'modify' },
        { label: '重新生成', value: 'regenerate', type: 'warning' }
      ]
    }

    return []
  }
}
