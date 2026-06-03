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
    // 角色关系图操作
    characterGraph: {
      getGraphs: (projectPath: string, projectId: string) => Promise<{ success: boolean; data: any[] }>
      getGraphById: (projectPath: string, graphId: string) => Promise<{ success: boolean; data: any }>
      createGraph: (projectPath: string, projectId: string, options: { name: string; description?: string }) => Promise<{ success: boolean; data: any }>
      updateGraph: (projectPath: string, graphId: string, options: any) => Promise<{ success: boolean }>
      deleteGraph: (projectPath: string, graphId: string) => Promise<{ success: boolean }>
      addNode: (projectPath: string, graphId: string, node: any) => Promise<{ success: boolean; data: any }>
      updateNode: (projectPath: string, nodeId: string, graphId: string, data: any) => Promise<{ success: boolean }>
      deleteNode: (projectPath: string, nodeId: string, graphId: string) => Promise<{ success: boolean }>
      deleteNodeByCharacterId: (projectPath: string, graphId: string, characterId: string) => Promise<{ success: boolean }>
      addEdge: (projectPath: string, graphId: string, edge: any) => Promise<{ success: boolean; data: any }>
      updateEdge: (projectPath: string, edgeId: string, graphId: string, data: any) => Promise<{ success: boolean }>
      deleteEdge: (projectPath: string, edgeId: string, graphId: string) => Promise<{ success: boolean }>
      generateFromCharacters: (projectPath: string, projectId: string, graphName: string) => Promise<{ success: boolean; data: any }>
      importFromJSON: (projectPath: string, projectId: string, json: string) => Promise<{ success: boolean; data: any }>
      exportToJSON: (projectPath: string, graphId: string) => Promise<{ success: boolean; data: string }>
    }
    // 地图操作
    map: {
      getMaps: (projectPath: string, projectId: string) => Promise<{ success: boolean; data: Array<{ id: string; name: string; description: string | null; updated_at: number }> }>
      getMapById: (projectPath: string, mapId: string) => Promise<{ success: boolean; data: { map: any; locations: any[]; relationships: any[] } | null }>
      createMap: (projectPath: string, projectId: string, name: string, description?: string) => Promise<{ success: boolean; data: any }>
      updateMap: (projectPath: string, mapId: string, name?: string, description?: string) => Promise<{ success: boolean }>
      deleteMap: (projectPath: string, mapId: string) => Promise<{ success: boolean }>
      addLocation: (projectPath: string, mapId: string, name: string, x: number, y: number, description?: string, color?: string, size?: number, icon?: string) => Promise<{ success: boolean; data: any }>
      updateLocation: (projectPath: string, locationId: string, mapId: string, updates: Record<string, unknown>) => Promise<{ success: boolean }>
      updateLocationPositions: (projectPath: string, mapId: string, positions: Array<{ locationId: string; x: number; y: number }>) => Promise<{ success: boolean }>
      deleteLocation: (projectPath: string, locationId: string, mapId: string) => Promise<{ success: boolean }>
      addLocationRelationship: (projectPath: string, mapId: string, sourceId: string, targetId: string, relationType: string, relationLabel: string, description?: string, color?: string, lineWidth?: number, lineStyle?: string) => Promise<{ success: boolean; data: any }>
      updateLocationRelationship: (projectPath: string, relationshipId: string, mapId: string, updates: Record<string, unknown>) => Promise<{ success: boolean }>
      deleteLocationRelationship: (projectPath: string, relationshipId: string, mapId: string) => Promise<{ success: boolean }>
      saveMapData: (projectPath: string, mapId: string, locations: any[], relationships: any[]) => Promise<{ success: boolean }>
      exportMapToJSON: (projectPath: string, mapId: string) => Promise<{ success: boolean; data: string }>
      importMapFromJSON: (projectPath: string, projectId: string, jsonString: string) => Promise<{ success: boolean; data: any }>
    }
  }
}
