/**
 * 地图功能状态管理 - 操作函数
 *
 * 与 Electron 主进程通信，调用地图相关 API
 */
import { isLoading, isSaving, currentMap, currentProjectId } from './state'
import * as service from '@/services/mapService'
import type { Map, Location, LocationRelationship, LocationRelationType, LineStyle } from '@/types/project'

// ============================================================
// 地图操作
// ============================================================

/**
 * 加载项目所有地图列表
 */
export async function loadMaps(projectPath: string): Promise<Array<{ id: string; name: string; description: string | null; updated_at: number }>> {
  if (!currentProjectId.value) {
    throw new Error('项目ID未设置')
  }

  isLoading.value = true
  try {
    const maps = await service.getMaps(projectPath, currentProjectId.value)
    return maps
  } finally {
    isLoading.value = false
  }
}

/**
 * 加载单个地图
 */
export async function loadMap(projectPath: string, mapId: string): Promise<void> {
  isLoading.value = true
  try {
    const mapData = await service.getMapById(projectPath, mapId)
    currentMap.value = mapData
  } finally {
    isLoading.value = false
  }
}

/**
 * 创建地图
 */
export async function createMap(projectPath: string, name: string, description?: string): Promise<{ map: Map; locations: Location[]; relationships: LocationRelationship[] }> {
  if (!currentProjectId.value) {
    throw new Error('项目ID未设置')
  }

  isSaving.value = true
  try {
    const map = await service.createMap(projectPath, currentProjectId.value, name, description)
    const mapData = {
      map,
      locations: [],
      relationships: []
    }
    currentMap.value = mapData
    return mapData
  } finally {
    isSaving.value = false
  }
}

/**
 * 更新地图
 */
export async function updateMap(projectPath: string, mapId: string, name?: string, description?: string): Promise<void> {
  isSaving.value = true
  try {
    await service.updateMap(projectPath, mapId, name, description)
    // 更新当前地图
    if (currentMap.value && currentMap.value.map.id === mapId) {
      if (name !== undefined) currentMap.value.map.name = name
      if (description !== undefined) currentMap.value.map.description = description
    }
  } finally {
    isSaving.value = false
  }
}

/**
 * 删除地图
 */
export async function deleteMap(projectPath: string, mapId: string): Promise<void> {
  isSaving.value = true
  try {
    await service.deleteMap(projectPath, mapId)
    if (currentMap.value && currentMap.value.map.id === mapId) {
      currentMap.value = null
    }
  } finally {
    isSaving.value = false
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
  isSaving.value = true
  try {
    const location = await service.addLocation(projectPath, mapId, name, x, y, description, color, size, icon)
    if (currentMap.value && currentMap.value.map.id === mapId) {
      currentMap.value.locations.push(location)
    }
    return location
  } finally {
    isSaving.value = false
  }
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
  isSaving.value = true
  try {
    await service.updateLocation(projectPath, locationId, mapId, updates)
    // 更新当前地图中的地点
    if (currentMap.value) {
      const location = currentMap.value.locations.find(loc => loc.id === locationId)
      if (location) {
        Object.assign(location, updates)
      }
    }
  } finally {
    isSaving.value = false
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
  try {
    await service.updateLocationPositions(projectPath, mapId, positions)
    // 更新当前地图中的地点位置
    if (currentMap.value) {
      for (const pos of positions) {
        const location = currentMap.value.locations.find(loc => loc.id === pos.locationId)
        if (location) {
          location.x = pos.x
          location.y = pos.y
        }
      }
    }
  } finally {
    isSaving.value = false
  }
}

/**
 * 删除地点
 */
export async function deleteLocation(projectPath: string, locationId: string, mapId: string): Promise<void> {
  isSaving.value = true
  try {
    await service.deleteLocation(projectPath, locationId, mapId)
    // 从当前地图移除地点
    if (currentMap.value && currentMap.value.map.id === mapId) {
      currentMap.value.locations = currentMap.value.locations.filter(loc => loc.id !== locationId)
      // 同时移除相关的地点关系
      currentMap.value.relationships = currentMap.value.relationships.filter(
        rel => rel.sourceId !== locationId && rel.targetId !== locationId
      )
    }
  } finally {
    isSaving.value = false
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
  isSaving.value = true
  try {
    const relationship = await service.addLocationRelationship(
      projectPath, mapId, sourceId, targetId, relationType, relationLabel, description, color, lineWidth, lineStyle
    )
    if (currentMap.value && currentMap.value.map.id === mapId) {
      currentMap.value.relationships.push(relationship)
    }
    return relationship
  } finally {
    isSaving.value = false
  }
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
  isSaving.value = true
  try {
    await service.updateLocationRelationship(projectPath, relationshipId, mapId, updates)
    // 更新当前地图中的地点关系
    if (currentMap.value) {
      const relationship = currentMap.value.relationships.find(rel => rel.id === relationshipId)
      if (relationship) {
        Object.assign(relationship, updates)
      }
    }
  } finally {
    isSaving.value = false
  }
}

/**
 * 删除地点关系
 */
export async function deleteLocationRelationship(projectPath: string, relationshipId: string, mapId: string): Promise<void> {
  isSaving.value = true
  try {
    await service.deleteLocationRelationship(projectPath, relationshipId, mapId)
    // 从当前地图移除地点关系
    if (currentMap.value && currentMap.value.map.id === mapId) {
      currentMap.value.relationships = currentMap.value.relationships.filter(rel => rel.id !== relationshipId)
    }
  } finally {
    isSaving.value = false
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
  isSaving.value = true
  try {
    await service.saveMapData(projectPath, mapId, locations, relationships)
  } finally {
    isSaving.value = false
  }
}

/**
 * 导出地图为 JSON
 */
export async function exportMapToJSON(projectPath: string, mapId: string): Promise<string> {
  try {
    return await service.exportMapToJSON(projectPath, mapId)
  } catch (error: any) {
    throw new Error(`导出失败: ${error.message}`)
  }
}

/**
 * 从 JSON 导入地图
 */
export async function importMapFromJSON(projectPath: string, jsonString: string): Promise<{ map: Map; locations: Location[]; relationships: LocationRelationship[] }> {
  if (!currentProjectId.value) {
    throw new Error('项目ID未设置')
  }

  isSaving.value = true
  try {
    const mapData = await service.importMapFromJSON(projectPath, currentProjectId.value, jsonString)
    currentMap.value = mapData
    return mapData
  } finally {
    isSaving.value = false
  }
}
