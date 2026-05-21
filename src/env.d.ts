/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

// Element Plus 类型声明
declare module 'element-plus' {
  export const ElMessage: any
  export const ElMessageBox: any
  export const ElLoading: any
  export const ElNotification: any
}

declare module '@element-plus/icons-vue' {
  import type { Component } from 'vue'
  export const ArrowLeft: Component
  export const Plus: Component
  export const Setting: Component
  export const FolderOpened: Component
  export const ArrowRight: Component
  export const FullScreen: Component
  export const Search: Component
  export const Check: Component
  export const Document: Component
  export const Loading: Component
  export const Moon: Component
  export const Sunny: Component
  export const Coffee: Component
  export const Refresh: Component
  export const Delete: Component
  // 添加其他需要的图标...
}

// Electron API 类型声明
interface Window {
  electronAPI: {
    // 持久化存储
    store: {
      get: (key: string) => Promise<unknown>
      set: (key: string, value: unknown) => Promise<void>
      delete: (key: string) => Promise<void>
      has: (key: string) => Promise<boolean>
    }
    // 项目文件操作
    readProject: (path: string) => Promise<unknown>
    writeProject: (path: string, data: unknown) => Promise<void>
    createProject: (path: string, data: unknown) => Promise<boolean>
    deleteProject: (path: string) => Promise<boolean>
    openProjectDialog: () => Promise<string | null>
    selectDirectoryDialog: () => Promise<string | null>
    scanProjectsDirectory: (dirPath: string) => Promise<Array<{ name: string; path: string; updatedAt: number }>>
    readChapter: (projectPath: string, chapterId: string) => Promise<string>
    writeChapter: (projectPath: string, chapterId: string, content: string) => Promise<void>
    // 密钥管理
    getApiKey: (provider: string) => Promise<string | null>
    setApiKey: (provider: string, key: string) => Promise<boolean>
    deleteApiKey: (provider: string) => Promise<boolean>
    // 版本快照
    saveSnapshot: (projectPath: string, chapterId: string, content: string) => Promise<string>
    listSnapshots: (projectPath: string, chapterId: string) => Promise<unknown[]>
    restoreSnapshot: (projectPath: string, chapterId: string, snapshotId: string) => Promise<string>
    // LLM API 代理
    llmChat: (request: unknown) => Promise<{ success: boolean; content?: string; error?: string }>
    llmStream: (request: unknown) => Promise<{ success: boolean; content?: string; models?: string[]; error?: string }>
    llmHealthCheck: (request: unknown) => Promise<{ success: boolean; models?: string[]; error?: string }>
    llmCancel: () => Promise<{ success: boolean; error?: string }>
    // 事件监听（用于流式输出）
    on: (channel: string, callback: (event: unknown, ...args: unknown[]) => void) => void
    off: (channel: string, callback: (event: unknown, ...args: unknown[]) => void) => void
    // 对话历史操作
    chatHistory: {
      saveMessage: (projectPath: string, message: { messageId: string; role: string; content: string; timestamp: number }, sessionId?: string) => Promise<void>
      saveMessages: (projectPath: string, messages: Array<{ messageId: string; role: string; content: string; timestamp: number }>, sessionId?: string) => Promise<void>
      getMessagesByDate: (projectPath: string, date: string) => Promise<any[]>
      getMessagesByDateRange: (projectPath: string, startDate: string, endDate: string) => Promise<any[]>
      getDistinctDates: (projectPath: string) => Promise<string[]>
      getDistinctDatesWithCount: (projectPath: string) => Promise<Array<{ date: string; count: number }>>
      getMessageById: (projectPath: string, id: number) => Promise<any>
      deleteMessageById: (projectPath: string, id: number) => Promise<void>
      deleteMessageByMessageId: (projectPath: string, messageId: string) => Promise<void>
      deleteByDate: (projectPath: string, date: string) => Promise<void>
      deleteByDateRange: (projectPath: string, startDate: string, endDate: string) => Promise<void>
      deleteBySessionId: (projectPath: string, sessionId: string) => Promise<void>
      getMessageCountByDate: (projectPath: string, date: string) => Promise<number>
      getTotalMessageCount: (projectPath: string) => Promise<number>
      clearAllHistory: (projectPath: string) => Promise<void>
    }
  }
}
