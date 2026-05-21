/**
 * 对话历史操作 IPC 接口
 *
 * 提供渲染进程调用数据库的操作接口
 */
import { ipcMain } from 'electron'
import { getDatabase } from '../database/index'
import {
  saveMessage,
  saveMessages,
  getMessagesByDate,
  getMessagesByDateRange,
  getDistinctDates,
  getDistinctDatesWithCount,
  getMessageById,
  getMessageByMessageId,
  deleteMessageById,
  deleteMessageByMessageId,
  deleteMessagesByDate,
  deleteMessagesByDateRange,
  deleteMessagesBySessionId,
  getMessageCountByDate,
  getTotalMessageCount,
  clearAllHistory
} from '../database/repositories/chatHistoryRepo'

// ==================== IPC 接口 ====================

/**
 * 保存单条消息
 * IPC 签名：chatHistory:saveMessage(projectPath, message, sessionId) => void
 */
ipcMain.handle('chatHistory:saveMessage', async (_event, projectPath: string, message: { messageId: string; role: 'user' | 'assistant' | 'system'; content: string; timestamp: number }, sessionId: string = '') => {
  try {
    const { db, save } = await getDatabase(projectPath)
    try {
      saveMessage(db, message, sessionId)
      save()
    } finally {
      db.close()
    }
  } catch (error) {
    console.error('[ChatHistory IPC] 保存消息失败:', error)
    throw error
  }
})

/**
 * 批量保存消息
 * IPC 签名：chatHistory:saveMessages(projectPath, messages, sessionId) => void
 */
ipcMain.handle('chatHistory:saveMessages', async (_event, projectPath: string, messages: Array<{ messageId: string; role: 'user' | 'assistant' | 'system'; content: string; timestamp: number }>, sessionId: string = '') => {
  try {
    const { db, save } = await getDatabase(projectPath)
    try {
      saveMessages(db, messages, sessionId)
      save()
    } finally {
      db.close()
    }
  } catch (error) {
    console.error('[ChatHistory IPC] 批量保存消息失败:', error)
    throw error
  }
})

/**
 * 按日期查询消息
 * IPC 签名：chatHistory:getMessagesByDate(projectPath, date) => ChatHistoryMessage[]
 */
ipcMain.handle('chatHistory:getMessagesByDate', async (_event, projectPath: string, date: string) => {
  try {
    const { db, close } = await getDatabase(projectPath)
    try {
      return getMessagesByDate(db, date)
    } finally {
      close()
    }
  } catch (error) {
    console.error('[ChatHistory IPC] 查询消息失败:', error)
    throw error
  }
})

/**
 * 按日期范围查询消息
 * IPC 签名：chatHistory:getMessagesByDateRange(projectPath, startDate, endDate) => ChatHistoryMessage[]
 */
ipcMain.handle('chatHistory:getMessagesByDateRange', async (_event, projectPath: string, startDate: string, endDate: string) => {
  try {
    const { db, close } = await getDatabase(projectPath)
    try {
      return getMessagesByDateRange(db, startDate, endDate)
    } finally {
      close()
    }
  } catch (error) {
    console.error('[ChatHistory IPC] 查询消息范围失败:', error)
    throw error
  }
})

/**
 * 获取所有有记录的日期列表
 * IPC 签名：chatHistory:getDistinctDates(projectPath) => string[]
 */
ipcMain.handle('chatHistory:getDistinctDates', async (_event, projectPath: string) => {
  try {
    const { db, close } = await getDatabase(projectPath)
    try {
      return getDistinctDates(db)
    } finally {
      close()
    }
  } catch (error) {
    console.error('[ChatHistory IPC] 获取日期列表失败:', error)
    throw error
  }
})

/**
 * 获取所有有记录的日期列表（包含消息数量）
 * IPC 签名：chatHistory:getDistinctDatesWithCount(projectPath) => Array<{ date: string; count: number }>
 */
ipcMain.handle('chatHistory:getDistinctDatesWithCount', async (_event, projectPath: string) => {
  try {
    const { db, close } = await getDatabase(projectPath)
    try {
      return getDistinctDatesWithCount(db)
    } finally {
      close()
    }
  } catch (error) {
    console.error('[ChatHistory IPC] 获取日期列表（含数量）失败:', error)
    throw error
  }
})

/**
 * 根据 ID 获取单条消息
 * IPC 签名：chatHistory:getMessageById(projectPath, id) => ChatHistoryMessage | null
 */
ipcMain.handle('chatHistory:getMessageById', async (_event, projectPath: string, id: number) => {
  try {
    const { db, close } = await getDatabase(projectPath)
    try {
      return getMessageById(db, id)
    } finally {
      close()
    }
  } catch (error) {
    console.error('[ChatHistory IPC] 获取消息失败:', error)
    throw error
  }
})

/**
 * 删除单条消息（根据自增 ID）
 * IPC 签名：chatHistory:deleteMessageById(projectPath, id) => void
 */
ipcMain.handle('chatHistory:deleteMessageById', async (_event, projectPath: string, id: number) => {
  try {
    const { db, save, close } = await getDatabase(projectPath)
    try {
      deleteMessageById(db, id)
      save()
    } finally {
      close()
    }
  } catch (error) {
    console.error('[ChatHistory IPC] 删除消息失败:', error)
    throw error
  }
})

/**
 * 删除单条消息（根据 message_id）
 * IPC 签名：chatHistory:deleteMessageByMessageId(projectPath, messageId) => void
 */
ipcMain.handle('chatHistory:deleteMessageByMessageId', async (_event, projectPath: string, messageId: string) => {
  try {
    const { db, save, close } = await getDatabase(projectPath)
    try {
      deleteMessageByMessageId(db, messageId)
      save()
    } finally {
      close()
    }
  } catch (error) {
    console.error('[ChatHistory IPC] 删除消息失败:', error)
    throw error
  }
})

/**
 * 按日期批量删除
 * IPC 签名：chatHistory:deleteByDate(projectPath, date) => void
 */
ipcMain.handle('chatHistory:deleteByDate', async (_event, projectPath: string, date: string) => {
  try {
    const { db, save, close } = await getDatabase(projectPath)
    try {
      deleteMessagesByDate(db, date)
      save()
    } finally {
      close()
    }
  } catch (error) {
    console.error('[ChatHistory IPC] 批量删除消息失败:', error)
    throw error
  }
})

/**
 * 按日期范围删除
 * IPC 签名：chatHistory:deleteByDateRange(projectPath, startDate, endDate) => void
 */
ipcMain.handle('chatHistory:deleteByDateRange', async (_event, projectPath: string, startDate: string, endDate: string) => {
  try {
    const { db, save, close } = await getDatabase(projectPath)
    try {
      deleteMessagesByDateRange(db, startDate, endDate)
      save()
    } finally {
      close()
    }
  } catch (error) {
    console.error('[ChatHistory IPC] 按日期范围删除消息失败:', error)
    throw error
  }
})

/**
 * 删除指定 session 的所有消息
 * IPC 签名：chatHistory:deleteBySessionId(projectPath, sessionId) => void
 */
ipcMain.handle('chatHistory:deleteBySessionId', async (_event, projectPath: string, sessionId: string) => {
  try {
    const { db, save, close } = await getDatabase(projectPath)
    try {
      deleteMessagesBySessionId(db, sessionId)
      save()
    } finally {
      close()
    }
  } catch (error) {
    console.error('[ChatHistory IPC] 删除 session 消息失败:', error)
    throw error
  }
})

/**
 * 获取指定日期的消息数量
 * IPC 签名：chatHistory:getMessageCountByDate(projectPath, date) => number
 */
ipcMain.handle('chatHistory:getMessageCountByDate', async (_event, projectPath: string, date: string) => {
  try {
    const { db, close } = await getDatabase(projectPath)
    try {
      return getMessageCountByDate(db, date)
    } finally {
      close()
    }
  } catch (error) {
    console.error('[ChatHistory IPC] 获取消息数量失败:', error)
    throw error
  }
})

/**
 * 获取总消息数量
 * IPC 签名：chatHistory:getTotalMessageCount(projectPath) => number
 */
ipcMain.handle('chatHistory:getTotalMessageCount', async (_event, projectPath: string) => {
  try {
    const { db, close } = await getDatabase(projectPath)
    try {
      return getTotalMessageCount(db)
    } finally {
      close()
    }
  } catch (error) {
    console.error('[ChatHistory IPC] 获取总消息数量失败:', error)
    throw error
  }
})

/**
 * 清空所有对话历史
 * IPC 签名：chatHistory:clearAllHistory(projectPath) => void
 */
ipcMain.handle('chatHistory:clearAllHistory', async (_event, projectPath: string) => {
  try {
    const { db, save, close } = await getDatabase(projectPath)
    try {
      clearAllHistory(db)
      save()
    } finally {
      close()
    }
  } catch (error) {
    console.error('[ChatHistory IPC] 清空历史失败:', error)
    throw error
  }
})
