/**
 * 对话历史数据访问层 - Chat History Repository
 */
import type { Database } from 'sql.js'
import { queryAll, run } from '../index'

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

/**
 * 保存单条消息
 */
export function saveMessage(
  db: Database,
  message: { messageId: string; role: 'user' | 'assistant' | 'system'; content: string; timestamp: number },
  sessionId: string = ''
): void {
  const date = new Date(message.timestamp).toISOString().split('T')[0] // YYYY-MM-DD 格式
  run(db, `
    INSERT INTO chat_history (message_id, role, content, timestamp, date, session_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [message.messageId, message.role, message.content, message.timestamp, date, sessionId])
}

/**
 * 批量保存消息
 */
export function saveMessages(
  db: Database,
  messages: Array<{ messageId: string; role: 'user' | 'assistant' | 'system'; content: string; timestamp: number }>,
  sessionId: string = ''
): void {
  for (const message of messages) {
    saveMessage(db, message, sessionId)
  }
}

/**
 * 按日期查询消息
 */
export function getMessagesByDate(db: Database, date: string): ChatHistoryMessage[] {
  return queryAll(db, `
    SELECT * FROM chat_history 
    WHERE date = ? 
    ORDER BY timestamp ASC
  `, [date]).map(r => ({
    id: r.id,
    messageId: r.message_id,
    role: r.role,
    content: r.content,
    timestamp: r.timestamp,
    date: r.date,
    sessionId: r.session_id,
    createdAt: r.created_at
  }))
}

/**
 * 按日期范围查询消息
 */
export function getMessagesByDateRange(db: Database, startDate: string, endDate: string): ChatHistoryMessage[] {
  return queryAll(db, `
    SELECT * FROM chat_history 
    WHERE date >= ? AND date <= ? 
    ORDER BY timestamp ASC
  `, [startDate, endDate]).map(r => ({
    id: r.id,
    messageId: r.message_id,
    role: r.role,
    content: r.content,
    timestamp: r.timestamp,
    date: r.date,
    sessionId: r.session_id,
    createdAt: r.created_at
  }))
}

/**
 * 获取所有有记录的日期列表（按日期倒序）
 */
export function getDistinctDates(db: Database): string[] {
  const results = queryAll(db, `
    SELECT DISTINCT date FROM chat_history 
    ORDER BY date DESC
  `)
  return results.map(r => r.date)
}

/**
 * 获取所有有记录的日期列表（包含消息数量）
 */
export function getDistinctDatesWithCount(db: Database): Array<{ date: string; count: number }> {
  const results = queryAll(db, `
    SELECT date, COUNT(*) as count FROM chat_history 
    GROUP BY date 
    ORDER BY date DESC
  `)
  return results.map(r => ({
    date: r.date,
    count: r.count
  }))
}

/**
 * 根据 ID 获取单条消息
 */
export function getMessageById(db: Database, id: number): ChatHistoryMessage | null {
  const r = queryAll(db, `SELECT * FROM chat_history WHERE id = ?`, [id])[0]
  if (!r) return null
  return {
    id: r.id,
    messageId: r.message_id,
    role: r.role,
    content: r.content,
    timestamp: r.timestamp,
    date: r.date,
    sessionId: r.session_id,
    createdAt: r.created_at
  }
}

/**
 * 根据 message_id 获取单条消息
 */
export function getMessageByMessageId(db: Database, messageId: string): ChatHistoryMessage | null {
  const r = queryAll(db, `SELECT * FROM chat_history WHERE message_id = ?`, [messageId])[0]
  if (!r) return null
  return {
    id: r.id,
    messageId: r.message_id,
    role: r.role,
    content: r.content,
    timestamp: r.timestamp,
    date: r.date,
    sessionId: r.session_id,
    createdAt: r.created_at
  }
}

/**
 * 删除单条消息（根据自增 ID）
 */
export function deleteMessageById(db: Database, id: number): void {
  run(db, `DELETE FROM chat_history WHERE id = ?`, [id])
}

/**
 * 删除单条消息（根据 message_id）
 */
export function deleteMessageByMessageId(db: Database, messageId: string): void {
  run(db, `DELETE FROM chat_history WHERE message_id = ?`, [messageId])
}

/**
 * 按日期批量删除
 */
export function deleteMessagesByDate(db: Database, date: string): void {
  run(db, `DELETE FROM chat_history WHERE date = ?`, [date])
}

/**
 * 按日期范围删除
 */
export function deleteMessagesByDateRange(db: Database, startDate: string, endDate: string): void {
  run(db, `
    DELETE FROM chat_history 
    WHERE date >= ? AND date <= ?
  `, [startDate, endDate])
}

/**
 * 删除指定 session 的所有消息
 */
export function deleteMessagesBySessionId(db: Database, sessionId: string): void {
  run(db, `DELETE FROM chat_history WHERE session_id = ?`, [sessionId])
}

/**
 * 获取指定日期的消息数量
 */
export function getMessageCountByDate(db: Database, date: string): number {
  const r = queryAll(db, `SELECT COUNT(*) as count FROM chat_history WHERE date = ?`, [date])[0]
  return r ? r.count : 0
}

/**
 * 获取总消息数量
 */
export function getTotalMessageCount(db: Database): number {
  const r = queryAll(db, `SELECT COUNT(*) as count FROM chat_history`)[0]
  return r ? r.count : 0
}

/**
 * 清空所有对话历史
 */
export function clearAllHistory(db: Database): void {
  run(db, `DELETE FROM chat_history`)
}
