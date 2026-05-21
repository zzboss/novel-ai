/**
 * LLM 交互记录 IPC 接口
 * 
 * 提供渲染进程调用数据库的操作接口
 * 用于记录完整的大模型交互过程（输入 prompt + 输出 response + 元数据）
 */

import { ipcMain } from 'electron';
import { getDatabase } from '../database/index';
import {
  saveLLMInteraction,
  getLLMInteractionByInteractionId,
  getLLMInteractionById,
  getLLMInteractionsByDate,
  getLLMInteractionsByDateRange,
  getLLMInteractionsByOperationType,
  getLLMDistinctDatesWithCount,
  getLLMInteractionCountByDate,
  getTotalLLMInteractionCount,
  getRecentLLMInteractions,
  deleteLLMInteractionById,
  deleteLLMInteractionByInteractionId,
  deleteLLMInteractionsByDate,
  deleteLLMInteractionsByDateRange,
  deleteLLMInteractionsByOperationType,
  clearAllLLMInteractions
} from '../database/repositories/llmInteractionRepo';

import type { LLMInteraction, LLMInteractionCreateInput } from '../database/repositories/llmInteractionRepo';

// ==================== IPC 接口 ====================

/**
 * 保存单条 LLM 交互记录
 * IPC 签名：llmInteraction:save(projectPath, input) => LLMInteraction
 */
ipcMain.handle('llmInteraction:save', async (_event, projectPath: string, input: LLMInteractionCreateInput) => {
  try {
    const { db, save } = await getDatabase(projectPath);
    try {
      const result = saveLLMInteraction(db, input);
      save();
      return result;
    } finally {
      db.close();
    }
  } catch (error) {
    console.error('[LLMInteraction IPC] 保存交互记录失败:', error);
    throw error;
  }
});

/**
 * 根据 interaction_id 获取记录
 * IPC 签名：llmInteraction:getByInteractionId(projectPath, interactionId) => LLMInteraction | null
 */
ipcMain.handle('llmInteraction:getByInteractionId', async (_event, projectPath: string, interactionId: string) => {
  try {
    const { db, close } = await getDatabase(projectPath);
    try {
      return getLLMInteractionByInteractionId(db, interactionId);
    } finally {
      close();
    }
  } catch (error) {
    console.error('[LLMInteraction IPC] 获取记录失败:', error);
    throw error;
  }
});

/**
 * 根据 ID 获取记录
 * IPC 签名：llmInteraction:getById(projectPath, id) => LLMInteraction | null
 */
ipcMain.handle('llmInteraction:getById', async (_event, projectPath: string, id: number) => {
  try {
    const { db, close } = await getDatabase(projectPath);
    try {
      return getLLMInteractionById(db, id);
    } finally {
      close();
    }
  } catch (error) {
    console.error('[LLMInteraction IPC] 获取记录失败:', error);
    throw error;
  }
});

/**
 * 按日期查询记录
 * IPC 签名：llmInteraction:getByDate(projectPath, date) => LLMInteraction[]
 */
ipcMain.handle('llmInteraction:getByDate', async (_event, projectPath: string, date: string) => {
  try {
    const { db, close } = await getDatabase(projectPath);
    try {
      return getLLMInteractionsByDate(db, date);
    } finally {
      close();
    }
  } catch (error) {
    console.error('[LLMInteraction IPC] 按日期查询失败:', error);
    throw error;
  }
});

/**
 * 按日期范围查询记录
 * IPC 签名：llmInteraction:getByDateRange(projectPath, startDate, endDate) => LLMInteraction[]
 */
ipcMain.handle('llmInteraction:getByDateRange', async (_event, projectPath: string, startDate: string, endDate: string) => {
  try {
    const { db, close } = await getDatabase(projectPath);
    try {
      return getLLMInteractionsByDateRange(db, startDate, endDate);
    } finally {
      close();
    }
  } catch (error) {
    console.error('[LLMInteraction IPC] 按日期范围查询失败:', error);
    throw error;
  }
});

/**
 * 按操作类型查询记录
 * IPC 签名：llmInteraction:getByOperationType(projectPath, operationType) => LLMInteraction[]
 */
ipcMain.handle('llmInteraction:getByOperationType', async (_event, projectPath: string, operationType: string) => {
  try {
    const { db, close } = await getDatabase(projectPath);
    try {
      return getLLMInteractionsByOperationType(db, operationType);
    } finally {
      close();
    }
  } catch (error) {
    console.error('[LLMInteraction IPC] 按操作类型查询失败:', error);
    throw error;
  }
});

/**
 * 获取所有有记录的日期列表（包含记录数量）
 * IPC 签名：llmInteraction:getDistinctDatesWithCount(projectPath) => Array<{ date: string; count: number }>
 */
ipcMain.handle('llmInteraction:getDistinctDatesWithCount', async (_event, projectPath: string) => {
  try {
    const { db, close } = await getDatabase(projectPath);
    try {
      return getLLMDistinctDatesWithCount(db);
    } finally {
      close();
    }
  } catch (error) {
    console.error('[LLMInteraction IPC] 获取日期列表失败:', error);
    throw error;
  }
});

/**
 * 获取指定日期的记录数量
 * IPC 签名：llmInteraction:getCountByDate(projectPath, date) => number
 */
ipcMain.handle('llmInteraction:getCountByDate', async (_event, projectPath: string, date: string) => {
  try {
    const { db, close } = await getDatabase(projectPath);
    try {
      return getLLMInteractionCountByDate(db, date);
    } finally {
      close();
    }
  } catch (error) {
    console.error('[LLMInteraction IPC] 获取记录数量失败:', error);
    throw error;
  }
});

/**
 * 获取总记录数量
 * IPC 签名：llmInteraction:getTotalCount(projectPath) => number
 */
ipcMain.handle('llmInteraction:getTotalCount', async (_event, projectPath: string) => {
  try {
    const { db, close } = await getDatabase(projectPath);
    try {
      return getTotalLLMInteractionCount(db);
    } finally {
      close();
    }
  } catch (error) {
    console.error('[LLMInteraction IPC] 获取总记录数量失败:', error);
    throw error;
  }
});

/**
 * 获取最近 N 条记录
 * IPC 签名：llmInteraction:getRecent(projectPath, limit) => LLMInteraction[]
 */
ipcMain.handle('llmInteraction:getRecent', async (_event, projectPath: string, limit: number = 50) => {
  try {
    const { db, close } = await getDatabase(projectPath);
    try {
      return getRecentLLMInteractions(db, limit);
    } finally {
      close();
    }
  } catch (error) {
    console.error('[LLMInteraction IPC] 获取最近记录失败:', error);
    throw error;
  }
});

// ==================== 删除操作 ====================

/**
 * 根据 ID 删除记录
 * IPC 签名：llmInteraction:deleteById(projectPath, id) => void
 */
ipcMain.handle('llmInteraction:deleteById', async (_event, projectPath: string, id: number) => {
  try {
    const { db, save, close } = await getDatabase(projectPath);
    try {
      deleteLLMInteractionById(db, id);
      save();
    } finally {
      close();
    }
  } catch (error) {
    console.error('[LLMInteraction IPC] 删除记录失败:', error);
    throw error;
  }
});

/**
 * 根据 interaction_id 删除记录
 * IPC 签名：llmInteraction:deleteByInteractionId(projectPath, interactionId) => void
 */
ipcMain.handle('llmInteraction:deleteByInteractionId', async (_event, projectPath: string, interactionId: string) => {
  try {
    const { db, save, close } = await getDatabase(projectPath);
    try {
      deleteLLMInteractionByInteractionId(db, interactionId);
      save();
    } finally {
      close();
    }
  } catch (error) {
    console.error('[LLMInteraction IPC] 删除记录失败:', error);
    throw error;
  }
});

/**
 * 按日期批量删除
 * IPC 签名：llmInteraction:deleteByDate(projectPath, date) => void
 */
ipcMain.handle('llmInteraction:deleteByDate', async (_event, projectPath: string, date: string) => {
  try {
    const { db, save, close } = await getDatabase(projectPath);
    try {
      deleteLLMInteractionsByDate(db, date);
      save();
    } finally {
      close();
    }
  } catch (error) {
    console.error('[LLMInteraction IPC] 按日期批量删除失败:', error);
    throw error;
  }
});

/**
 * 按日期范围删除
 * IPC 签名：llmInteraction:deleteByDateRange(projectPath, startDate, endDate) => void
 */
ipcMain.handle('llmInteraction:deleteByDateRange', async (_event, projectPath: string, startDate: string, endDate: string) => {
  try {
    const { db, save, close } = await getDatabase(projectPath);
    try {
      deleteLLMInteractionsByDateRange(db, startDate, endDate);
      save();
    } finally {
      close();
    }
  } catch (error) {
    console.error('[LLMInteraction IPC] 按日期范围删除失败:', error);
    throw error;
  }
});

/**
 * 按操作类型删除
 * IPC 签名：llmInteraction:deleteByOperationType(projectPath, operationType) => void
 */
ipcMain.handle('llmInteraction:deleteByOperationType', async (_event, projectPath: string, operationType: string) => {
  try {
    const { db, save, close } = await getDatabase(projectPath);
    try {
      deleteLLMInteractionsByOperationType(db, operationType);
      save();
    } finally {
      close();
    }
  } catch (error) {
    console.error('[LLMInteraction IPC] 按操作类型删除失败:', error);
    throw error;
  }
});

/**
 * 清空所有记录
 * IPC 签名：llmInteraction:clearAll(projectPath) => void
 */
ipcMain.handle('llmInteraction:clearAll', async (_event, projectPath: string) => {
  try {
    const { db, save, close } = await getDatabase(projectPath);
    try {
      clearAllLLMInteractions(db);
      save();
    } finally {
      close();
    }
  } catch (error) {
    console.error('[LLMInteraction IPC] 清空记录失败:', error);
    throw error;
  }
});
