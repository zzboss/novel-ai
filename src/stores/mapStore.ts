/**
 * 地图功能状态管理 Store
 *
 * 组合状态定义和操作函数
 */
import { defineStore } from 'pinia'

// 从各模块导入所有内容
import {
  currentProjectId,
  currentMap,
  selectedLocationId,
  selectedRelationshipId,
  isLoading,
  isSaving,
  isEditMode,
  selectedLocation,
  selectedRelationship,
  locationCount,
  relationshipCount,
  isMapEmpty,
  setCurrentProjectId,
  setCurrentMap,
  updateLocationPosition,
  updateLocationPositions,
  addLocationToCurrentMap,
  removeLocationFromCurrentMap,
  addRelationshipToCurrentMap,
  removeRelationshipFromCurrentMap,
  setSelectedLocation,
  setSelectedRelationship,
  clearSelection,
  setEditMode
} from './map/state'

import {
  loadMaps,
  loadMap,
  createMap,
  updateMap,
  deleteMap,
  addLocation,
  updateLocation,
  updateLocationPositions as saveLocationPositions,
  deleteLocation,
  addLocationRelationship,
  updateLocationRelationship,
  deleteLocationRelationship,
  saveMapData,
  exportMapToJSON,
  importMapFromJSON
} from './map/operations'

/**
 * ============================================================
 * 地图功能状态管理 Store
 * ============================================================
 */
export const useMapStore = defineStore('map', () => {
  // 返回所有状态和方法的组合
  return {
    // 状态
    currentProjectId,
    currentMap,
    selectedLocationId,
    selectedRelationshipId,
    isLoading,
    isSaving,
    isEditMode,

    // 计算属性
    selectedLocation,
    selectedRelationship,
    locationCount,
    relationshipCount,
    isMapEmpty,

    // 状态管理方法
    setCurrentProjectId,
    setCurrentMap,
    updateLocationPosition,
    updateLocationPositions,
    addLocationToCurrentMap,
    removeLocationFromCurrentMap,
    addRelationshipToCurrentMap,
    removeRelationshipFromCurrentMap,
    setSelectedLocation,
    setSelectedRelationship,
    clearSelection,
    setEditMode,

    // 操作函数（与 Electron 主进程通信）
    loadMaps,
    loadMap,
    createMap,
    updateMap,
    deleteMap,
    addLocation,
    updateLocation,
    saveLocationPositions,
    deleteLocation,
    addLocationRelationship,
    updateLocationRelationship,
    deleteLocationRelationship,
    saveMapData,
    exportMapToJSON,
    importMapFromJSON
  }
})
