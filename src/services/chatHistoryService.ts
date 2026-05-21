/**
 * 对话历史服务层 - 封装 Electron IPC 调用
 */
import type { ChatHistoryMessage } from '@/types/chatHistory'

export interface DateCount {
  date: string
  count: number
}

/**
 * 保存单条消息
 */
export async function saveMessage(
  projectPath: string,
  message: { messageId: string; role: string; content: string; timestamp: number },
  sessionId: string = ''
): Promise<void> {
  return window.electronAPI?.chatHistory?.saveMessage(projectPath, message, sessionId)
}

/**
 * 批量保存消息
 */
export async function saveMessages(
  projectPath: string,
  messages: Array<{ messageId: string; role: string; content: string; timestamp: number }>,
  sessionId: string = ''
): Promise<void> {
  return window.electronAPI?.chatHistory?.saveMessages(projectPath, messages, sessionId)
}

/**
 * 按日期查询消息
 */
export async function getMessagesByDate(
  projectPath: string,
  date: string
): Promise<ChatHistoryMessage[]> {
  return window.electronAPI?.chatHistory?.getMessagesByDate(projectPath, date) || []
}

/**
 * 按日期范围查询消息
 */
export async function getMessagesByDateRange(
  projectPath: string,
  startDate: string,
  endDate: string
): Promise<ChatHistoryMessage[]> {
  return window.electronAPI?.chatHistory?.getMessagesByDateRange(projectPath, startDate, endDate) || []
}

/**
 * 获取所有有记录的日期列表
 */
export async function getDistinctDates(
  projectPath: string
): Promise<string[]> {
  return window.electronAPI?.chatHistory?.getDistinctDates(projectPath) || []
}

/**
 * 获取所有有记录的日期列表（包含消息数量）
 */
export async function getDistinctDatesWithCount(
  projectPath: string
): Promise<DateCount[]> {
  return window.electronAPI?.chatHistory?.getDistinctDatesWithCount(projectPath) || []
}

/**
 * 根据 ID 获取单条消息
 */
export async function getMessageById(
  projectPath: string,
  id: number
): Promise<ChatHistoryMessage | null> {
  return window.electronAPI?.chatHistory?.getMessageById(projectPath, id) || null
}

/**
 * 删除单条消息（根据自增 ID）
 */
export async function deleteMessageById(
  projectPath: string,
  id: number
): Promise<void> {
  return window.electronAPI?.chatHistory?.deleteMessageById(projectPath, id)
}

/**
 * 删除单条消息（根据 message_id）
 */
export async function deleteMessageByMessageId(
  projectPath: string,
  messageId: string
): Promise<void> {
  return window.electronAPI?.chatHistory?.deleteMessageByMessageId(projectPath, messageId)
}

/**
 * 按日期批量删除
 */
export async function deleteByDate(
  projectPath: string,
  date: string
): Promise<void> {
  return window.electronAPI?.chatHistory?.deleteByDate(projectPath, date)
}

/**
 * 按日期范围删除
 */
export async function deleteByDateRange(
  projectPath: string,
  startDate: string,
  endDate: string
): Promise<void> {
  return window.electronAPI?.chatHistory?.deleteByDateRange(projectPath, startDate, endDate)
}

/**
 * 删除指定 session 的所有消息
 */
export async function deleteBySessionId(
  projectPath: string,
  sessionId: string
): Promise<void> {
  return window.electronAPI?.chatHistory?.deleteBySessionId(projectPath, sessionId)
}

/**
 * 获取指定日期的消息数量
 */
export async function getMessageCountByDate(
  projectPath: string,
  date: string
): Promise<number> {
  return window.electronAPI?.chatHistory?.getMessageCountByDate(projectPath, date) || 0
}

/**
 * 获取总消息数量
 */
export async function getTotalMessageCount(
  projectPath: string
): Promise<number> {
  return window.electronAPI?.chatHistory?.getTotalMessageCount(projectPath) || 0
}

/**
 * 清空所有对话历史
 */
export async function clearAllHistory(
  projectPath: string
): Promise<void> {
  return window.electronAPI?.chatHistory?.clearAllHistory(projectPath)
}
