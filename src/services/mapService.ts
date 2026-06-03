/**
 * 地图功能服务层
 *
 * 封装与 Electron 主进程的 IPC 通信
 */
import type { Map, Location, LocationRelationship, LocationRelationType, LineStyle } from '@/types/project'

// ============================================================
// 地图操作
// ============================================================

/**
 * 获取项目所有地图
 */
export async function getMaps(projectPath: string, projectId: string): Promise<Array<{ id: string; name: string; description: string | null; updated_at: number }>> {
  const result = await window.electronAPI.map.getMaps(projectPath, projectId)
  if (!result.success) {
    throw new Error(result.error || '获取地图列表失败')
  }
  return result.data
}

/**
 * 获取单个地图（包含地点和关系）
 */
export async function getMapById(projectPath: string, mapId: string): Promise<{ map: Map; locations: Location[]; relationships: LocationRelationship[] }> {
  const result = await window.electronAPI.map.getMapById(projectPath, mapId)
  if (!result.success) {
    throw new Error(result.error || '获取地图失败')
  }
  return result.data
}

/**
 * 创建地图
 */
export async function createMap(projectPath: string, projectId: string, name: string, description?: string): Promise<Map> {
  const result = await window.electronAPI.map.createMap(projectPath, projectId, name, description)
  if (!result.success) {
    throw new Error(result.error || '创建地图失败')
  }
  return result.data
}

/**
 * 更新地图
 */
export async function updateMap(projectPath: string, mapId: string, name?: string, description?: string): Promise<void> {
  const result = await window.electronAPI.map.updateMap(projectPath, mapId, name, description)
  if (!result.success) {
    throw new Error(result.error || '更新地图失败')
  }
}

/**
 * 删除地图
 */
export async function deleteMap(projectPath: string, mapId: string): Promise<void> {
  const result = await window.electronAPI.map.deleteMap(projectPath, mapId)
  if (!result.success) {
    throw new Error(result.error || '删除地图失败')
  }
}

// ============================================================
// 地点操作
// ============================================================

/**
 * 添加地点
 */
export async function addLocation(
  projectPath: string,
  mapId: string,
  name: string,
  x: number,
  y: number,
  description?: string,
  color?: string,
  size?: number,
  icon?: string
): Promise<Location> {
  const result = await window.electronAPI.map.addLocation(projectPath, mapId, name, x, y, description, color, size, icon)
  if (!result.success) {
    throw new Error(result.error || '添加地点失败')
  }
  return result.data
}

/**
 * 更新地点
 */
export async function updateLocation(
  projectPath: string,
  locationId: string,
  mapId: string,
  updates: Partial<Pick<Location, 'name' | 'description' | 'x' | 'y' | 'color' | 'size' | 'icon'>>
): Promise<void> {
  const result = await window.electronAPI.map.updateLocation(projectPath, locationId, mapId, updates)
  if (!result.success) {
    throw new Error(result.error || '更新地点失败')
  }
}

/**
 * 更新地点位置（批量）
 */
export async function updateLocationPositions(
  projectPath: string,
  mapId: string,
  positions: Array<{ locationId: string; x: number; y: number }>
): Promise<void> {
  const result = await window.electronAPI.map.updateLocationPositions(projectPath, mapId, positions)
  if (!result.success) {
    throw new Error(result.error || '更新地点位置失败')
  }
}

/**
 * 删除地点
 */
export async function deleteLocation(projectPath: string, locationId: string, mapId: string): Promise<void> {
  const result = await window.electronAPI.map.deleteLocation(projectPath, locationId, mapId)
  if (!result.success) {
    throw new Error(result.error || '删除地点失败')
  }
}

// ============================================================
// 地点关系操作
// ============================================================

/**
 * 添加地点关系
 */
export async function addLocationRelationship(
  projectPath: string,
  mapId: string,
  sourceId: string,
  targetId: string,
  relationType: LocationRelationType,
  relationLabel: string,
  description?: string,
  color?: string,
  lineWidth?: number,
  lineStyle?: LineStyle
): Promise<LocationRelationship> {
  const result = await window.electronAPI.map.addLocationRelationship(
    projectPath, mapId, sourceId, targetId, relationType, relationLabel, description, color, lineWidth, lineStyle
  )
  if (!result.success) {
    throw new Error(result.error || '添加地点关系失败')
  }
  return result.data
}

/**
 * 更新地点关系
 */
export async function updateLocationRelationship(
  projectPath: string,
  relationshipId: string,
  mapId: string,
  updates: Partial<Pick<LocationRelationship, 'relationType' | 'relationLabel' | 'description' | 'color' | 'lineWidth' | 'lineStyle'>>
): Promise<void> {
  const result = await window.electronAPI.map.updateLocationRelationship(projectPath, relationshipId, mapId, updates)
  if (!result.success) {
    throw new Error(result.error || '更新地点关系失败')
  }
}

/**
 * 删除地点关系
 */
export async function deleteLocationRelationship(projectPath: string, relationshipId: string, mapId: string): Promise<void> {
  const result = await window.electronAPI.map.deleteLocationRelationship(projectPath, relationshipId, mapId)
  if (!result.success) {
    throw new Error(result.error || '删除地点关系失败')
  }
}

// ============================================================
// 高级操作
// ============================================================

/**
 * 保存完整地图数据（替换式）
 */
export async function saveMapData(
  projectPath: string,
  mapId: string,
  locations: Array<{ id: string; name: string; description?: string; x: number; y: number; color?: string; size?: number; icon?: string }>,
  relationships: Array<{ id: string; sourceId: string; targetId: string; relationType: LocationRelationType; relationLabel: string; description?: string; color?: string; lineWidth?: number; lineStyle?: LineStyle }>
): Promise<void> {
  const result = await window.electronAPI.map.saveMapData(projectPath, mapId, locations, relationships)
  if (!result.success) {
    throw new Error(result.error || '保存地图数据失败')
  }
}

/**
 * 导出地图为 JSON
 */
export async function exportMapToJSON(projectPath: string, mapId: string): Promise<string> {
  const result = await window.electronAPI.map.exportMapToJSON(projectPath, mapId)
  if (!result.success) {
    throw new Error(result.error || '导出地图失败')
  }
  return result.data
}

/**
 * 从 JSON 导入地图
 */
export async function importMapFromJSON(projectPath: string, projectId: string, jsonString: string): Promise<{ map: Map; locations: Location[]; relationships: LocationRelationship[] }> {
  const result = await window.electronAPI.map.importMapFromJSON(projectPath, projectId, jsonString)
  if (!result.success) {
    throw new Error(result.error || '导入地图失败')
  }
  return result.data
}
