/**
 * IntentParser 类型定义
 */

export type IntentType = 
  | 'generate'    // 生成新章节
  | 'continue'    // 续写
  | 'polish'      // 润色
  | 'rewrite'     // 重写
  | 'modify'      // 修改
  | 'consult'     // 咨询建议
  | 'confirm'     // 确认操作
  | 'cancel'      // 取消操作
  | 'regenerate'  // 重新生成
  | 'satisfied'    // 满意
  | 'unknown'     // 未知

export interface ParsedIntent {
  type: IntentType
  /** 置信度 0-1 */
  confidence: number
  /** 目标（如"800字"、"突出冲突"） */
  target?: string
  /** 作用范围 */
  scope?: 'selection' | 'cursor' | 'chapter'
  /** 语气/风格要求 */
  tone?: string
  /** 用户自定义要求 */
  customRequest?: string
  /** 是否要求重新生成 */
  isRegenerate?: boolean
  /** 是否满意 */
  isSatisfied?: boolean
  /** LLM 推理过程（调试用） */
  reasoning?: string
}

export interface EditorContext {
  /** 选中内容 */
  selectedText?: string
  /** 选中内容HTML */
  selectedHtml?: string
  /** 光标位置（字符偏移） */
  cursorPosition?: number
  /** 章节全文 */
  chapterContent?: string
  /** 章节字数 */
  wordCount?: number
}
