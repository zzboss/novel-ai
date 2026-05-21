import { contextBridge, ipcRenderer } from 'electron'

// electron-store 持久化存储
const store = {
  get: (key: string) => ipcRenderer.invoke('store:get', key),
  set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
  delete: (key: string) => ipcRenderer.invoke('store:delete', key),
  has: (key: string) => ipcRenderer.invoke('store:has', key)
}

// 暴露受保护的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 持久化存储
  store,

  // 项目文件操作
  readProject: (path: string) => ipcRenderer.invoke('fs:readProject', path),
  writeProject: (path: string, data: unknown) => ipcRenderer.invoke('fs:writeProject', path, data),
  createProject: (path: string, data: unknown) => ipcRenderer.invoke('fs:createProject', path, data),
  deleteProject: (path: string) => ipcRenderer.invoke('fs:deleteProject', path),
  openProjectDialog: () => ipcRenderer.invoke('fs:openProjectDialog'),
  selectDirectoryDialog: () => ipcRenderer.invoke('fs:selectDirectoryDialog'),
  readChapter: (projectPath: string, chapterId: string) => ipcRenderer.invoke('fs:readChapter', projectPath, chapterId),
  writeChapter: (projectPath: string, chapterId: string, content: string) => ipcRenderer.invoke('fs:writeChapter', projectPath, chapterId, content),
  scanProjectsDirectory: (dirPath: string) => ipcRenderer.invoke('fs:scanProjectsDirectory', dirPath),

  // 密钥管理
  getApiKey: (provider: string) => ipcRenderer.invoke('keytar:get', provider),
  setApiKey: (provider: string, key: string) => ipcRenderer.invoke('keytar:set', provider, key),
  deleteApiKey: (provider: string) => ipcRenderer.invoke('keytar:delete', provider),

  // 版本快照
  saveSnapshot: (projectPath: string, chapterId: string, content: string) => ipcRenderer.invoke('snapshot:save', projectPath, chapterId, content),
  listSnapshots: (projectPath: string, chapterId: string) => ipcRenderer.invoke('snapshot:list', projectPath, chapterId),
  restoreSnapshot: (projectPath: string, chapterId: string, snapshotId: string) => ipcRenderer.invoke('snapshot:restore', projectPath, chapterId, snapshotId),

  // LLM API 代理（在主进程中执行，避免 CORS 问题）
  llmChat: (request: unknown) => ipcRenderer.invoke('llm:chat', request),
  llmStream: (request: unknown) => ipcRenderer.invoke('llm:stream', request),
  llmHealthCheck: (request: unknown) => ipcRenderer.invoke('llm:healthCheck', request),
  llmCancel: () => ipcRenderer.invoke('llm:cancel'),

  // 对话历史操作
  chatHistory: {
    saveMessage: (projectPath: string, message: { messageId: string; role: string; content: string; timestamp: number }, sessionId?: string) => 
      ipcRenderer.invoke('chatHistory:saveMessage', projectPath, message, sessionId),
    saveMessages: (projectPath: string, messages: Array<{ messageId: string; role: string; content: string; timestamp: number }>, sessionId?: string) => 
      ipcRenderer.invoke('chatHistory:saveMessages', projectPath, messages, sessionId),
    getMessagesByDate: (projectPath: string, date: string) => 
      ipcRenderer.invoke('chatHistory:getMessagesByDate', projectPath, date),
    getMessagesByDateRange: (projectPath: string, startDate: string, endDate: string) => 
      ipcRenderer.invoke('chatHistory:getMessagesByDateRange', projectPath, startDate, endDate),
    getDistinctDates: (projectPath: string) => 
      ipcRenderer.invoke('chatHistory:getDistinctDates', projectPath),
    getDistinctDatesWithCount: (projectPath: string) => 
      ipcRenderer.invoke('chatHistory:getDistinctDatesWithCount', projectPath),
    getMessageById: (projectPath: string, id: number) => 
      ipcRenderer.invoke('chatHistory:getMessageById', projectPath, id),
    deleteMessageById: (projectPath: string, id: number) => 
      ipcRenderer.invoke('chatHistory:deleteMessageById', projectPath, id),
    deleteMessageByMessageId: (projectPath: string, messageId: string) => 
      ipcRenderer.invoke('chatHistory:deleteMessageByMessageId', projectPath, messageId),
    deleteByDate: (projectPath: string, date: string) => 
      ipcRenderer.invoke('chatHistory:deleteByDate', projectPath, date),
    deleteByDateRange: (projectPath: string, startDate: string, endDate: string) => 
      ipcRenderer.invoke('chatHistory:deleteByDateRange', projectPath, startDate, endDate),
    deleteBySessionId: (projectPath: string, sessionId: string) => 
      ipcRenderer.invoke('chatHistory:deleteBySessionId', projectPath, sessionId),
    getMessageCountByDate: (projectPath: string, date: string) => 
      ipcRenderer.invoke('chatHistory:getMessageCountByDate', projectPath, date),
    getTotalMessageCount: (projectPath: string) => 
      ipcRenderer.invoke('chatHistory:getTotalMessageCount', projectPath),
    clearAllHistory: (projectPath: string) => 
      ipcRenderer.invoke('chatHistory:clearAllHistory', projectPath)
  },

  // LLM 交互记录操作（独立功能，记录完整的大模型交互过程）
  llmInteraction: {
    save: (projectPath: string, input: unknown) => 
      ipcRenderer.invoke('llmInteraction:save', projectPath, input),
    getByInteractionId: (projectPath: string, interactionId: string) => 
      ipcRenderer.invoke('llmInteraction:getByInteractionId', projectPath, interactionId),
    getById: (projectPath: string, id: number) => 
      ipcRenderer.invoke('llmInteraction:getById', projectPath, id),
    getByDate: (projectPath: string, date: string) => 
      ipcRenderer.invoke('llmInteraction:getByDate', projectPath, date),
    getByDateRange: (projectPath: string, startDate: string, endDate: string) => 
      ipcRenderer.invoke('llmInteraction:getByDateRange', projectPath, startDate, endDate),
    getByOperationType: (projectPath: string, operationType: string) => 
      ipcRenderer.invoke('llmInteraction:getByOperationType', projectPath, operationType),
    getDistinctDatesWithCount: (projectPath: string) => 
      ipcRenderer.invoke('llmInteraction:getDistinctDatesWithCount', projectPath),
    getCountByDate: (projectPath: string, date: string) => 
      ipcRenderer.invoke('llmInteraction:getCountByDate', projectPath, date),
    getTotalCount: (projectPath: string) => 
      ipcRenderer.invoke('llmInteraction:getTotalCount', projectPath),
    getRecent: (projectPath: string, limit?: number) => 
      ipcRenderer.invoke('llmInteraction:getRecent', projectPath, limit),
    deleteById: (projectPath: string, id: number) => 
      ipcRenderer.invoke('llmInteraction:deleteById', projectPath, id),
    deleteByInteractionId: (projectPath: string, interactionId: string) => 
      ipcRenderer.invoke('llmInteraction:deleteByInteractionId', projectPath, interactionId),
    deleteByDate: (projectPath: string, date: string) => 
      ipcRenderer.invoke('llmInteraction:deleteByDate', projectPath, date),
    deleteByDateRange: (projectPath: string, startDate: string, endDate: string) => 
      ipcRenderer.invoke('llmInteraction:deleteByDateRange', projectPath, startDate, endDate),
    deleteByOperationType: (projectPath: string, operationType: string) => 
      ipcRenderer.invoke('llmInteraction:deleteByOperationType', projectPath, operationType),
    clearAll: (projectPath: string) => 
      ipcRenderer.invoke('llmInteraction:clearAll', projectPath)
  },

  // 事件监听（用于流式输出）
  on: (channel: string, callback: (event: any, ...args: any[]) => void) => {
    ipcRenderer.on(channel, callback)
  },
  off: (channel: string, callback: (event: any, ...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback)
  }
})
