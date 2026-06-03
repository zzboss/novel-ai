/**
 * 角色关系图 IPC 处理器
 *
 * 处理角色关系图的数据库操作
 */
import { ipcMain } from 'electron'
import type { Database } from 'sql.js'
import {
  getCharacterGraphs,
  getCharacterGraphById,
  createCharacterGraph,
  updateCharacterGraph,
  deleteCharacterGraph,
  addCharacterNode,
  updateCharacterNode,
  updateNodePositions,
  deleteCharacterNode,
  addCharacterEdge,
  updateCharacterEdge,
  deleteCharacterEdge,
  saveCharacterGraph,
  generateGraphFromCharacters,
  exportCharacterGraphToJSON,
  importCharacterGraphFromJSON
} from '../database/repositories/characterGraphRepo'
import { getDatabase, saveDatabase } from '../database'

// 存储项目路径到数据库实例的映射
const dbCache = new Map<string, Database>()

/**
 * 获取或加载数据库实例（异步）
 */
async function getDbAsync(projectPath: string): Promise<Database> {
  if (!dbCache.has(projectPath)) {
    const { db } = await getDatabase(projectPath)
    dbCache.set(projectPath, db)
  }
  return dbCache.get(projectPath)!
}

/**
 * 保存数据库
 */
function saveDb(projectPath: string): void {
  const db = dbCache.get(projectPath)
  if (db) {
    saveDatabase(projectPath, db)
  }
}

/**
 * 注册角色关系图相关的 IPC 处理器
 */
export function registerCharacterGraphIPC(): void {
  // ============================================================
  // 图表操作
  // ============================================================

  /**
   * 获取项目所有关系图
   */
  ipcMain.handle('characterGraph:getGraphs', async (_, projectPath: string, projectId: string) => {
    try {
      const db = await getDbAsync(projectPath)
      const graphs = getCharacterGraphs(db, projectId)
      return { success: true, data: graphs }
    } catch (error: any) {
      console.error('[IPC] characterGraph:getGraphs 失败:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * 获取单个关系图
   */
  ipcMain.handle('characterGraph:getGraphById', async (_, projectPath: string, graphId: string) => {
    try {
      const db = await getDbAsync(projectPath)
      const graph = getCharacterGraphById(db, graphId)
      if (!graph) {
        return { success: false, error: '关系图不存在' }
      }
      return { success: true, data: graph }
    } catch (error: any) {
      console.error('[IPC] characterGraph:getGraphById 失败:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * 创建关系图
   */
  ipcMain.handle('characterGraph:createGraph', async (_, projectPath: string, projectId: string, request: any) => {
    try {
      const db = await getDbAsync(projectPath)
      const graph = createCharacterGraph(db, projectId, request)
      saveDb(projectPath)
      return { success: true, data: graph }
    } catch (error: any) {
      console.error('[IPC] characterGraph:createGraph 失败:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * 更新关系图
   */
  ipcMain.handle('characterGraph:updateGraph', async (_, projectPath: string, graphId: string, request: any) => {
    try {
      const db = await getDbAsync(projectPath)
      updateCharacterGraph(db, graphId, request)
      saveDb(projectPath)
      return { success: true }
    } catch (error: any) {
      console.error('[IPC] characterGraph:updateGraph 失败:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * 删除关系图
   */
  ipcMain.handle('characterGraph:deleteGraph', async (_, projectPath: string, graphId: string) => {
    try {
      const db = await getDbAsync(projectPath)
      deleteCharacterGraph(db, graphId)
      saveDb(projectPath)
      return { success: true }
    } catch (error: any) {
      console.error('[IPC] characterGraph:deleteGraph 失败:', error)
      return { success: false, error: error.message }
    }
  })

  // ============================================================
  // 节点操作
  // ============================================================

  /**
   * 添加角色节点
   */
  ipcMain.handle('characterGraph:addNode', async (_, projectPath: string, graphId: string, request: any) => {
    try {
      const db = await getDbAsync(projectPath)
      const node = addCharacterNode(db, graphId, request)
      saveDb(projectPath)
      return { success: true, data: node }
    } catch (error: any) {
      console.error('[IPC] characterGraph:addNode 失败:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * 更新节点
   */
  ipcMain.handle('characterGraph:updateNode', async (_, projectPath: string, nodeId: string, graphId: string, request: any) => {
    try {
      const db = await getDbAsync(projectPath)
      updateCharacterNode(db, nodeId, graphId, request)
      saveDb(projectPath)
      return { success: true }
    } catch (error: any) {
      console.error('[IPC] characterGraph:updateNode 失败:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * 更新节点位置（批量）
   */
  ipcMain.handle('characterGraph:updateNodePositions', async (_, projectPath: string, graphId: string, positions: any[]) => {
    try {
      const db = await getDbAsync(projectPath)
      updateNodePositions(db, graphId, positions)
      saveDb(projectPath)
      return { success: true }
    } catch (error: any) {
      console.error('[IPC] characterGraph:updateNodePositions 失败:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * 删除节点
   */
  ipcMain.handle('characterGraph:deleteNode', async (_, projectPath: string, nodeId: string, graphId: string) => {
    try {
      const db = await getDbAsync(projectPath)
      deleteCharacterNode(db, nodeId, graphId)
      saveDb(projectPath)
      return { success: true }
    } catch (error: any) {
      console.error('[IPC] characterGraph:deleteNode 失败:', error)
      return { success: false, error: error.message }
    }
  })

  // ============================================================
  // 边操作
  // ============================================================

  /**
   * 添加关系边
   */
  ipcMain.handle('characterGraph:addEdge', async (_, projectPath: string, graphId: string, request: any) => {
    try {
      const db = await getDbAsync(projectPath)
      const edge = addCharacterEdge(db, graphId, request)
      saveDb(projectPath)
      return { success: true, data: edge }
    } catch (error: any) {
      console.error('[IPC] characterGraph:addEdge 失败:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * 更新关系边
   */
  ipcMain.handle('characterGraph:updateEdge', async (_, projectPath: string, edgeId: string, graphId: string, request: any) => {
    try {
      const db = await getDbAsync(projectPath)
      updateCharacterEdge(db, edgeId, graphId, request)
      saveDb(projectPath)
      return { success: true }
    } catch (error: any) {
      console.error('[IPC] characterGraph:updateEdge 失败:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * 删除关系边
   */
  ipcMain.handle('characterGraph:deleteEdge', async (_, projectPath: string, edgeId: string, graphId: string) => {
    try {
      const db = await getDbAsync(projectPath)
      deleteCharacterEdge(db, edgeId, graphId)
      saveDb(projectPath)
      return { success: true }
    } catch (error: any) {
      console.error('[IPC] characterGraph:deleteEdge 失败:', error)
      return { success: false, error: error.message }
    }
  })

  // ============================================================
  // 高级操作
  // ============================================================

  /**
   * 保存完整关系图（替换式）
   */
  ipcMain.handle('characterGraph:saveGraph', async (_, projectPath: string, graphId: string, nodes: any[], edges: any[]) => {
    try {
      const db = await getDbAsync(projectPath)
      saveCharacterGraph(db, graphId, nodes, edges)
      saveDb(projectPath)
      return { success: true }
    } catch (error: any) {
      console.error('[IPC] characterGraph:saveGraph 失败:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * 从角色自动生成关系图
   */
  ipcMain.handle('characterGraph:generateFromCharacters', async (_, projectPath: string, projectId: string, graphName: string) => {
    try {
      const db = await getDbAsync(projectPath)
      const graph = generateGraphFromCharacters(db, projectId, graphName)
      saveDb(projectPath)
      return { success: true, data: graph }
    } catch (error: any) {
      console.error('[IPC] characterGraph:generateFromCharacters 失败:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * 导出关系图为 JSON
   */
  ipcMain.handle('characterGraph:exportToJSON', async (_, projectPath: string, graphId: string) => {
    try {
      const db = await getDbAsync(projectPath)
      const json = exportCharacterGraphToJSON(db, graphId)
      return { success: true, data: json }
    } catch (error: any) {
      console.error('[IPC] characterGraph:exportToJSON 失败:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * 从 JSON 导入关系图
   */
  ipcMain.handle('characterGraph:importFromJSON', async (_, projectPath: string, projectId: string, jsonString: string) => {
    try {
      const db = await getDbAsync(projectPath)
      const graph = importCharacterGraphFromJSON(db, projectId, jsonString)
      saveDb(projectPath)
      return { success: true, data: graph }
    } catch (error: any) {
      console.error('[IPC] characterGraph:importFromJSON 失败:', error)
      return { success: false, error: error.message }
    }
  })

  console.log('[IPC] 角色关系图 IPC 处理器已注册')
}

// 自动注册 IPC 处理器
registerCharacterGraphIPC()


