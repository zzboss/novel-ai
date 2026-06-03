/**
 * 角色关系图状态管理 Store
 *
 * 组合状态定义和操作函数
 */
import { defineStore } from 'pinia'

// 从各模块导入所有内容
import {
  currentProjectId,
  currentGraph,
  selectedNodeId,
  selectedEdgeId,
  isLoading,
  isSaving,
  isEditMode,
  showLabels,
  showIcons,
  highlightOnHover,
  zoomLevel,
  selectedNode,
  selectedEdge,
  nodeCount,
  edgeCount,
  isGraphEmpty,
  setCurrentProjectId,
  setCurrentGraph,
  updateNodePosition,
  updateNodePositions,
  addNodeToCurrentGraph,
  removeNodeFromCurrentGraph,
  addEdgeToCurrentGraph,
  removeEdgeFromCurrentGraph,
  setSelectedNode,
  setSelectedEdge,
  clearSelection,
  setZoomLevel,
  resetView
} from './characterGraph/state'

import {
  loadGraphs,
  loadGraph,
  createGraph,
  updateGraph,
  deleteGraph,
  addNode,
  updateNode,
  updateNodePositions as saveNodePositions,
  deleteNode,
  addEdge,
  updateEdge,
  deleteEdge,
  saveGraphData,
  generateFromCharacters,
  exportToJSON,
  importFromJSON
} from './characterGraph/operations'

/**
 * ============================================================
 * 角色关系图状态管理 Store
 * ============================================================
 */
export const useCharacterGraphStore = defineStore('characterGraph', () => {
  // 返回所有状态和方法的组合
  return {
    // 状态
    currentProjectId,
    currentGraph,
    selectedNodeId,
    selectedEdgeId,
    isLoading,
    isSaving,
    isEditMode,
    showLabels,
    showIcons,
    highlightOnHover,
    zoomLevel,

    // 计算属性
    selectedNode,
    selectedEdge,
    nodeCount,
    edgeCount,
    isGraphEmpty,

    // 状态管理方法
    setCurrentProjectId,
    setCurrentGraph,
    updateNodePosition,
    updateNodePositions,
    addNodeToCurrentGraph,
    removeNodeFromCurrentGraph,
    addEdgeToCurrentGraph,
    removeEdgeFromCurrentGraph,
    setSelectedNode,
    setSelectedEdge,
    clearSelection,
    setZoomLevel,
    resetView,

    // 操作函数（与 Electron 主进程通信）
    loadGraphs,
    loadGraph,
    createGraph,
    updateGraph,
    deleteGraph,
    addNode,
    updateNode,
    saveNodePositions,
    deleteNode,
    addEdge,
    updateEdge,
    deleteEdge,
    saveGraphData,
    generateFromCharacters,
    exportToJSON,
    importFromJSON
  }
})
