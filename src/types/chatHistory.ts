/**
 * 对话历史相关类型定义
 */

export interface ChatHistoryMessage {
  id: number
  messageId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  date: string
  sessionId: string
  createdAt: number
}

export interface DateCount {
  date: string
  count: number
}
