/**
 * 地图功能状态管理 - 状态定义
 */

import { ref, computed } from 'vue'
import type { Map, Location, LocationRelationship } from '@/types/project'

// ============================================================
// 状态定义
// ============================================================

// 当前项目ID
export const currentProjectId = ref<string>('')

// 当前地图
export const currentMap = ref<{ map: Map; locations: Location[]; relationships: LocationRelationship[] } | null>(null)

// 当前选中的地点ID
export const selectedLocationId = ref<string>('')

// 当前选中的地点关系ID
export const selectedRelationshipId = ref<string>('')

// 加载状态
export const isLoading = ref(false)
export const isSaving = ref(false)

// 编辑模式
export const isEditMode = ref(false)

// ============================================================
// 计算属性
// ============================================================

// 当前选中的地点
export const selectedLocation = computed(() => {
  if (!selectedLocationId.value || !currentMap.value) return null
  return currentMap.value.locations.find(loc => loc.id === selectedLocationId.value) || null
})

// 当前选中的地点关系
export const selectedRelationship = computed(() => {
  if (!selectedRelationshipId.value || !currentMap.value) return null
  return currentMap.value.relationships.find(rel => rel.id === selectedRelationshipId.value) || null
})

// 地点数量
export const locationCount = computed(() => currentMap.value?.locations.length || 0)

// 地点关系数量
export const relationshipCount = computed(() => currentMap.value?.relationships.length || 0)

// 地图是否为空
export const isMapEmpty = computed(() => {
  return !currentMap.value || (locationCount.value === 0 && relationshipCount.value === 0)
})

// ============================================================
// 辅助函数
// ============================================================

/**
 * 设置当前项目ID
 */
export function setCurrentProjectId(projectId: string): void {
  currentProjectId.value = projectId
}

/**
 * 设置当前地图
 */
export function setCurrentMap(mapData: { map: Map; locations: Location[]; relationships: LocationRelationship[] } | null): void {
  currentMap.value = mapData
  selectedLocationId.value = ''
  selectedRelationshipId.value = ''
}

/**
 * 更新地点位置
 */
export function updateLocationPosition(locationId: string, x: number, y: number): void {
  if (!currentMap.value) return
  const location = currentMap.value.locations.find(loc => loc.id === locationId)
  if (location) {
    location.x = x
    location.y = y
  }
}

/**
 * 批量更新地点位置
 */
export function updateLocationPositions(positions: Array<{ locationId: string; x: number; y: number }>): void {
  for (const pos of positions) {
    updateLocationPosition(pos.locationId, pos.x, pos.y)
  }
}

/**
 * 添加地点到当前地图
 */
export function addLocationToCurrentMap(location: Location): void {
  if (!currentMap.value) return
  currentMap.value.locations.push(location)
}

/**
 * 从当前地图移除地点
 */
export function removeLocationFromCurrentMap(locationId: string): void {
  if (!currentMap.value) return
  const index = currentMap.value.locations.findIndex(loc => loc.id === locationId)
  if (index > -1) {
    currentMap.value.locations.splice(index, 1)
  }
  // 同时移除相关的地点关系
  currentMap.value.relationships = currentMap.value.relationships.filter(
    rel => rel.sourceId !== locationId && rel.targetId !== locationId
  )
}

/**
 * 添加地点关系到当前地图
 */
export function addRelationshipToCurrentMap(relationship: LocationRelationship): void {
  if (!currentMap.value) return
  currentMap.value.relationships.push(relationship)
}

/**
 * 从当前地图移除地点关系
 */
export function removeRelationshipFromCurrentMap(relationshipId: string): void {
  if (!currentMap.value) return
  const index = currentMap.value.relationships.findIndex(rel => rel.id === relationshipId)
  if (index > -1) {
    currentMap.value.relationships.splice(index, 1)
  }
}

/**
 * 设置选中的地点
 */
export function setSelectedLocation(locationId: string): void {
  selectedLocationId.value = locationId
  selectedRelationshipId.value = ''
}

/**
 * 设置选中的地点关系
 */
export function setSelectedRelationship(relationshipId: string): void {
  selectedRelationshipId.value = relationshipId
  selectedLocationId.value = ''
}

/**
 * 清除选中状态
 */
export function clearSelection(): void {
  selectedLocationId.value = ''
  selectedRelationshipId.value = ''
}

/**
 * 设置编辑模式
 */
export function setEditMode(editMode: boolean): void {
  isEditMode.value = editMode
}
