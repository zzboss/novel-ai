/**
 * 地图功能 IPC 处理器
 *
 * 处理地图、地点、地点关系的数据库操作
 */
import { ipcMain } from 'electron'
import type { Database } from 'sql.js'
import {
  getMaps,
  getMapById,
  createMap,
  updateMap,
  deleteMap,
  addLocation,
  updateLocation,
  updateLocationPositions,
  deleteLocation,
  addLocationRelationship,
  updateLocationRelationship,
  deleteLocationRelationship,
  saveMapData,
  exportMapToJSON,
  importMapFromJSON
} from '../database/repositories/mapRepo'
import type { LocationRelationType, LineStyle } from '../types/project'
import { getDatabase, saveDatabase } from '../database'

/** 有效的地点关系类型 */
const VALID_RELATION_TYPES: LocationRelationType[] = ['connection', 'path', 'border', 'custom']

/** 有效的线样式 */
const VALID_LINE_STYLES: LineStyle[] = ['solid', 'dashed', 'dotted']

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
 * 保存数据库（改进版）
 */
async function saveDbAsync(projectPath: string): Promise<void> {
  try {
    const db = dbCache.get(projectPath)
    if (db) {
      console.log('[IPC] 开始保存数据库:', projectPath)
      saveDatabase(projectPath, db)
      console.log('[IPC] 数据库保存成功:', projectPath)
    } else {
      console.error('[IPC] 数据库实例未找到，无法保存:', projectPath)
      // 尝试重新加载并保存
      const { db: db2 } = await getDatabase(projectPath)
      dbCache.set(projectPath, db2)
      saveDatabase(projectPath, db2)
      console.log('[IPC] 数据库重新加载并保存成功:', projectPath)
    }
  } catch (error) {
    console.error('[IPC] 保存数据库失败:', error)
    throw error
  }
}

/**
 * 注册地图相关的 IPC 处理器
 */
export function registerMapIPC(): void {
  // ============================================================
  // 地图操作
  // ============================================================

  /**
   * 获取项目所有地图
   */
  ipcMain.handle('map:getMaps', async (_, projectPath: string, projectId: string) => {
    try {
      const db = await getDbAsync(projectPath)
      const maps = getMaps(db, projectId)
      return { success: true, data: maps }
    } catch (error: any) {
      console.error('[IPC] map:getMaps 失败:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * 获取单个地图（包含地点和关系）
   */
  ipcMain.handle('map:getMapById', async (_, projectPath: string, mapId: string) => {
    try {
      console.log('[IPC] map:getMapById 被调用，projectPath:', projectPath, 'mapId:', mapId)

      const db = await getDbAsync(projectPath)
      const mapData = getMapById(db, mapId)

      console.log('[IPC] map:getMapById 查询结果:', mapData ? {
        map: mapData.map,
        locationsCount: mapData.locations?.length || 0,
        relationshipsCount: mapData.relationships?.length || 0
      } : null)

      if (!mapData) {
        return { success: false, error: '地图不存在' }
      }
      return { success: true, data: mapData }
    } catch (error: any) {
      console.error('[IPC] map:getMapById 失败:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * 创建地图
   */
  ipcMain.handle('map:createMap', async (_, projectPath: string, projectId: string, name: string, description?: string) => {
    try {
      const db = await getDbAsync(projectPath)
      const map = createMap(db, projectId, name, description)
      await saveDbAsync(projectPath)
      return { success: true, data: map }
    } catch (error: any) {
      console.error('[IPC] map:createMap 失败:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * 更新地图
   */
  ipcMain.handle('map:updateMap', async (_, projectPath: string, mapId: string, name?: string, description?: string) => {
    try {
      const db = await getDbAsync(projectPath)
      updateMap(db, mapId, name, description)
      await saveDbAsync(projectPath)
      return { success: true }
    } catch (error: any) {
      console.error('[IPC] map:updateMap 失败:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * 删除地图
   */
  ipcMain.handle('map:deleteMap', async (_, projectPath: string, mapId: string) => {
    try {
      const db = await getDbAsync(projectPath)
      deleteMap(db, mapId)
      await saveDbAsync(projectPath)
      return { success: true }
    } catch (error: any) {
      console.error('[IPC] map:deleteMap 失败:', error)
      return { success: false, error: error.message }
    }
  })

  // ============================================================
  // 地点操作
  // ============================================================

  /**
   * 添加地点
   */
  ipcMain.handle('map:addLocation', async (_, projectPath: string, mapId: string, name: string, x: number, y: number, description?: string, color?: string, size?: number, icon?: string) => {
    try {
      console.log('[IPC] map:addLocation 被调用:', { projectPath, mapId, name, x, y, description, color, size })

      const db = await getDbAsync(projectPath)
      const location = addLocation(db, mapId, name, x, y, description, color, size, icon)

      console.log('[IPC] 地点已添加到数据库，location:', location)

      await saveDbAsync(projectPath)

      console.log('[IPC] 数据库已保存')

      return { success: true, data: location }
    } catch (error: any) {
      console.error('[IPC] map:addLocation 失败:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * 更新地点
   */
  ipcMain.handle('map:updateLocation', async (_, projectPath: string, locationId: string, mapId: string, updates: any) => {
    try {
      const db = await getDbAsync(projectPath)
      updateLocation(db, locationId, mapId, updates)
      await saveDbAsync(projectPath)
      return { success: true }
    } catch (error: any) {
      console.error('[IPC] map:updateLocation 失败:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * 更新地点位置（批量）
   */
  ipcMain.handle('map:updateLocationPositions', async (_, projectPath: string, mapId: string, positions: any[]) => {
    try {
      const db = await getDbAsync(projectPath)
      updateLocationPositions(db, mapId, positions)
      await saveDbAsync(projectPath)
      return { success: true }
    } catch (error: any) {
      console.error('[IPC] map:updateLocationPositions 失败:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  /**
   * 删除地点
   */
  ipcMain.handle('map:deleteLocation', async (_, projectPath: string, locationId: string, mapId: string) => {
    try {
      const db = await getDbAsync(projectPath)
      deleteLocation(db, locationId, mapId)
      await saveDbAsync(projectPath)
      return { success: true }
    } catch (error: any) {
      console.error('[IPC] map:deleteLocation 失败:', error)
      return { success: false, error: error.message }
    }
  })

  // ============================================================
  // 地点关系操作
  // ============================================================

  /**
   * 添加地点关系
   */
  ipcMain.handle('map:addLocationRelationship', async (_, projectPath: string, mapId: string, sourceId: string, targetId: string, relationType: string, relationLabel: string, description?: string, color?: string, lineWidth?: number, lineStyle?: string) => {
    try {
      console.log('[IPC] map:addLocationRelationship 被调用:', { projectPath, mapId, sourceId, targetId, relationType, relationLabel })

      // 验证 relationType
      if (!VALID_RELATION_TYPES.includes(relationType as LocationRelationType)) {
        console.error('[IPC] 无效的地点关系类型:', relationType)
        return { success: false, error: `无效的地点关系类型: ${relationType}` }
      }

      // 验证 lineStyle（如果提供）
      let validatedLineStyle: LineStyle | undefined = undefined
      if (lineStyle !== undefined) {
        if (!VALID_LINE_STYLES.includes(lineStyle as LineStyle)) {
          console.error('[IPC] 无效的线样式:', lineStyle)
          return { success: false, error: `无效的线样式: ${lineStyle}` }
        }
        validatedLineStyle = lineStyle as LineStyle
      }

      const db = await getDbAsync(projectPath)
      const relationship = addLocationRelationship(
        db,
        mapId,
        sourceId,
        targetId,
        relationType as LocationRelationType,
        relationLabel,
        description,
        color,
        lineWidth,
        validatedLineStyle
      )

      console.log('[IPC] 地点关系已添加到数据库:', relationship)

      await saveDbAsync(projectPath)

      console.log('[IPC] 数据库已保存')

      return { success: true, data: relationship }
    } catch (error: any) {
      console.error('[IPC] map:addLocationRelationship 失败:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  /**
   * 更新地点关系
   */
  ipcMain.handle('map:updateLocationRelationship', async (_, projectPath: string, relationshipId: string, mapId: string, updates: any) => {
    try {
      const db = await getDbAsync(projectPath)
      updateLocationRelationship(db, relationshipId, mapId, updates)
      await saveDbAsync(projectPath)
      return { success: true }
    } catch (error: any) {
      console.error('[IPC] map:updateLocationRelationship 失败:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * 删除地点关系
   */
  ipcMain.handle('map:deleteLocationRelationship', async (_, projectPath: string, relationshipId: string, mapId: string) => {
    try {
      const db = await getDbAsync(projectPath)
      deleteLocationRelationship(db, relationshipId, mapId)
      await saveDbAsync(projectPath)
      return { success: true }
    } catch (error: any) {
      console.error('[IPC] map:deleteLocationRelationship 失败:', error)
      return { success: false, error: error.message }
    }
  })

  // ============================================================
  // 高级操作
  // ============================================================

  /**
   * 保存完整地图数据（替换式）
   */
  ipcMain.handle('map:saveMapData', async (_, projectPath: string, mapId: string, locations: any[], relationships: any[]) => {
    try {
      const db = await getDbAsync(projectPath)
      saveMapData(db, mapId, locations, relationships)
      await saveDbAsync(projectPath)
      return { success: true }
    } catch (error: any) {
      console.error('[IPC] map:saveMapData 失败:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * 导出地图为 JSON
   */
  ipcMain.handle('map:exportMapToJSON', async (_, projectPath: string, mapId: string) => {
    try {
      const db = await getDbAsync(projectPath)
      const json = exportMapToJSON(db, mapId)
      return { success: true, data: json }
    } catch (error: any) {
      console.error('[IPC] map:exportMapToJSON 失败:', error)
      return { success: false, error: error.message }
    }
  })

  /**
   * 从 JSON 导入地图
   */
  ipcMain.handle('map:importMapFromJSON', async (_, projectPath: string, projectId: string, jsonString: string) => {
    try {
      const db = await getDbAsync(projectPath)
      const mapData = importMapFromJSON(db, projectId, jsonString)
      await saveDbAsync(projectPath)
      return { success: true, data: mapData }
    } catch (error: any) {
      console.error('[IPC] map:importMapFromJSON 失败:', error)
      return { success: false, error: error.message }
    }
  })

  console.log('[IPC] 地图功能 IPC 处理器已注册')
}

// 自动注册 IPC 处理器
registerMapIPC()

