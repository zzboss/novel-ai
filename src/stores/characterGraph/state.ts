/**
 * 角色关系图状态管理 - 状态定义
 */
import { ref, computed } from 'vue'
import type { CharacterGraph, CharacterNode, CharacterEdge, GraphLayoutConfig } from '@/types/character-graph'

// ============================================================
// 状态定义
// ============================================================

// 当前项目ID
export const currentProjectId = ref<string>('')

// 当前关系图
export const currentGraph = ref<CharacterGraph | null>(null)

// 当前选中的节点
export const selectedNodeId = ref<string>('')

// 当前选中的边
export const selectedEdgeId = ref<string>('')

// 加载状态
export const isLoading = ref(false)
export const isSaving = ref(false)

// 编辑模式
export const isEditMode = ref(false)

// 显示选项
export const showLabels = ref(true)
export const showIcons = ref(true)
export const highlightOnHover = ref(true)

// 缩放比例
export const zoomLevel = ref(1)

// ============================================================
// 计算属性
// ============================================================

// 当前选中的节点
export const selectedNode = computed(() => {
  if (!selectedNodeId.value || !currentGraph.value) return null
  return currentGraph.value.nodes.find(n => n.id === selectedNodeId.value) || null
})

// 当前选中的边
export const selectedEdge = computed(() => {
  if (!selectedEdgeId.value || !currentGraph.value) return null
  return currentGraph.value.edges.find(e => e.id === selectedEdgeId.value) || null
})

// 节点数量
export const nodeCount = computed(() => currentGraph.value?.nodes.length || 0)

// 边数量
export const edgeCount = computed(() => currentGraph.value?.edges.length || 0)

// 图表是否为空
export const isGraphEmpty = computed(() => {
  return !currentGraph.value || (nodeCount.value === 0 && edgeCount.value === 0)
})

// ============================================================
// 辅助函数
// ============================================================

/**
 * 设置当前项目ID
 */
export function setCurrentProjectId(projectId: string) {
  currentProjectId.value = projectId
}

/**
 * 设置当前关系图
 */
export function setCurrentGraph(graph: CharacterGraph | null) {
  currentGraph.value = graph
  selectedNodeId.value = ''
  selectedEdgeId.value = ''
}

/**
 * 更新节点位置
 */
export function updateNodePosition(nodeId: string, x: number, y: number) {
  if (!currentGraph.value) return
  const node = currentGraph.value.nodes.find(n => n.id === nodeId)
  if (node) {
    node.x = x
    node.y = y
    node.fixed = true
  }
}

/**
 * 批量更新节点位置
 */
export function updateNodePositions(positions: Array<{ nodeId: string; x: number; y: number }>) {
  for (const pos of positions) {
    updateNodePosition(posnodeId, pos.x, pos.y)
  }
}

/**
 * 添加节点到当前图表
 */
export function addNodeToCurrentGraph(node: CharacterNode) {
  if (!currentGraph.value) return
  currentGraph.value.nodes.push(node)
}

/**
 * 从当前图表移除节点
 */
export function removeNodeFromCurrentGraph(nodeId: string) {
  if (!currentGraph.value) return
  const index = currentGraph.value.nodes.findIndex(n => n.id === nodeId)
  if (index > -1) {
    currentGraph.value.nodes.splice(index, 1)
  }
  // 同时移除相关的边
  currentGraph.value.edges = currentGraph.value.edges.filter(
    e => e.source !== nodeId && e.target !== nodeId
  )
}

/**
 * 添加边到当前图表
 */
export function addEdgeToCurrentGraph(edge: CharacterEdge) {
  if (!currentGraph.value) return
  currentGraph.value.edges.push(edge)
}

/**
 * 从当前图表移除边
 */
export function removeEdgeFromCurrentGraph(edgeId: string) {
  if (!currentGraph.value) return
  const index = currentGraph.value.edges.findIndex(e => e.id === edgeId)
  if (index > -1) {
    currentGraph.value.edges.splice(index, 1)
  }
}

/**
 * 设置选中的节点
 */
export function setSelectedNode(nodeId: string) {
  selectedNodeId.value = nodeId
  selectedEdgeId.value = ''
}

/**
 * 设置选中的边
 */
export function setSelectedEdge(edgeId: string) {
  selectedEdgeId.value = edgeId
  selectedNodeId.value = ''
}

/**
 * 清除选中状态
 */
export function clearSelection() {
  selectedNodeId.value = ''
  selectedEdgeId.value = ''
}

/**
 * 设置缩放级别
 */
export function setZoomLevel(zoom: number) {
  zoomLevel.value = Math.max(0.1, Math.min(2, zoom))
}

/**
 * 重置视图
 */
export function resetView() {
  zoomLevel.value = 1
  clearSelection()
}
