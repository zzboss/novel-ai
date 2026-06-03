/**
 * 角色关系图状态管理 - 操作函数
 *
 * 与 Electron 主进程通信，调用角色关系图相关 API
 */
import { isLoading, isSaving, currentGraph, currentProjectId } from './state'
import * as service from '@/services/characterGraphService'
import type {
  CharacterGraph,
  CharacterNode,
  CharacterEdge,
  CreateCharacterGraphRequest,
  UpdateCharacterGraphRequest,
  AddCharacterNodeRequest,
  UpdateCharacterNodeRequest,
  AddCharacterEdgeRequest,
  UpdateCharacterEdgeRequest
} from '@/types/character-graph'

// ============================================================
// 图表操作
// ============================================================

/**
 * 加载项目所有关系图列表
 */
export async function loadGraphs(projectPath: string): Promise<Array<{ id: string; name: string; description: string | null; updated_at: number }>> {
  if (!currentProjectId.value) {
    throw new Error('项目ID未设置')
  }

  isLoading.value = true
  try {
    const graphs = await service.getGraphs(projectPath, currentProjectId.value)
    return graphs
  } finally {
    isLoading.value = false
  }
}

/**
 * 加载单个关系图
 */
export async function loadGraph(projectPath: string, graphId: string): Promise<void> {
  isLoading.value = true
  try {
    const graph = await service.getGraphById(projectPath, graphId)
    currentGraph.value = graph
  } finally {
    isLoading.value = false
  }
}

/**
 * 创建关系图
 */
export async function createGraph(projectPath: string, request: CreateCharacterGraphRequest): Promise<CharacterGraph> {
  if (!currentProjectId.value) {
    throw new Error('项目ID未设置')
  }

  isSaving.value = true
  try {
    const graph = await service.createGraph(projectPath, currentProjectId.value, request)
    currentGraph.value = graph
    return graph
  } finally {
    isSaving.value = false
  }
}

/**
 * 更新关系图
 */
export async function updateGraph(projectPath: string, graphId: string, request: UpdateCharacterGraphRequest): Promise<void> {
  isSaving.value = true
  try {
    await service.updateGraph(projectPath, graphId, request)
    // 更新当前图表
    if (currentGraph.value && currentGraph.value.id === graphId) {
      const updated = await service.getGraphById(projectPath, graphId)
      currentGraph.value = updated
    }
  } finally {
    isSaving.value = false
  }
}

/**
 * 删除关系图
 */
export async function deleteGraph(projectPath: string, graphId: string): Promise<void> {
  isSaving.value = true
  try {
    await service.deleteGraph(projectPath, graphId)
    if (currentGraph.value && currentGraph.value.id === graphId) {
      currentGraph.value = null
    }
  } finally {
    isSaving.value = false
  }
}

// ============================================================
// 节点操作
// ============================================================

/**
 * 添加角色节点
 */
export async function addNode(projectPath: string, graphId: string, request: AddCharacterNodeRequest): Promise<CharacterNode> {
  isSaving.value = true
  try {
    const node = await service.addNode(projectPath, graphId, request)
    if (currentGraph.value && currentGraph.value.id === graphId) {
      // 获取角色信息
      // TODO: 从角色列表获取名称
      currentGraph.value.nodes.push(node)
    }
    return node
  } finally {
    isSaving.value = false
  }
}

/**
 * 更新节点
 */
export async function updateNode(projectPath: string, nodeId: string, graphId: string, request: UpdateCharacterNodeRequest): Promise<void> {
  isSaving.value = true
  try {
    await service.updateNode(projectPath, nodeId, graphId, request)
    // 更新当前图表中的节点
    if (currentGraph.value) {
      const node = currentGraph.value.nodes.find(n => n.id === nodeId)
      if (node) {
        Object.assign(node, request)
      }
    }
  } finally {
    isSaving.value = false
  }
}

/**
 * 更新节点位置（批量）
 */
export async function updateNodePositions(
  projectPath: string,
  graphId: string,
  positions: Array<{ nodeId: string; x: number; y: number }>
): Promise<void> {
  try {
    await service.updateNodePositions(projectPath, graphId, positions)
    // 更新当前图表中的节点位置
    if (currentGraph.value) {
      for (const pos of positions) {
        const node = currentGraph.value.nodes.find(n => n.id === posnodeId)
        if (node) {
          node.x = pos.x
          node.y = pos.y
          node.fixed = true
        }
      }
    }
  } finally {
    isSaving.value = false
  }
}

/**
 * 删除节点
 */
export async function deleteNode(projectPath: string, nodeId: string, graphId: string): Promise<void> {
  isSaving.value = true
  try {
    await service.deleteNode(projectPath, nodeId, graphId)
    // 从当前图表移除节点
    if (currentGraph.value && currentGraph.value.id === graphId) {
      currentGraph.value.nodes = currentGraph.value.nodes.filter(n => n.id !== nodeId)
      // 同时移除相关的边
      currentGraph.value.edges = currentGraph.value.edges.filter(
        e => e.source !== nodeId && e.target !== nodeId
      )
    }
  } finally {
    isSaving.value = false
  }
}

// ============================================================
// 边操作
// ============================================================

/**
 * 添加关系边
 */
export async function addEdge(projectPath: string, graphId: string, request: AddCharacterEdgeRequest): Promise<CharacterEdge> {
  isSaving.value = true
  try {
    const edge = await service.addEdge(projectPath, graphId, request)
    if (currentGraph.value && currentGraph.value.id === graphId) {
      currentGraph.value.edges.push(edge)
    }
    return edge
  } finally {
    isSaving.value = false
  }
}

/**
 * 更新关系边
 */
export async function updateEdge(projectPath: string, edgeId: string, graphId: string, request: UpdateCharacterEdgeRequest): Promise<void> {
  isSaving.value = true
  try {
    await service.updateEdge(projectPath, edgeId, graphId, request)
    // 更新当前图表中的边
    if (currentGraph.value) {
      const edge = currentGraph.value.edges.find(e => e.id === edgeId)
      if (edge) {
        Object.assign(edge, request)
      }
    }
  } finally {
    isSaving.value = false
  }
}

/**
 * 删除关系边
 */
export async function deleteEdge(projectPath: string, edgeId: string, graphId: string): Promise<void> {
  isSaving.value = true
  try {
    await service.deleteEdge(projectPath, edgeId, graphId)
    // 从当前图表移除边
    if (currentGraph.value && currentGraph.value.id === graphId) {
      currentGraph.value.edges = currentGraph.value.edges.filter(e => e.id !== edgeId)
    }
  } finally {
    isSaving.value = false
  }
}

// ============================================================
// 高级操作
// ============================================================

/**
 * 保存完整关系图
 */
export async function saveGraphData(
  projectPath: string,
  graphId: string,
  nodes: Array<{ id: string; characterId: string; x?: number; y?: number; fixed?: boolean; color?: string; size?: number }>,
  edges: Array<{ id: string; source: string; target: string; relationType: string; relationLabel: string; color?: string; lineWidth?: number }>
): Promise<void> {
  isSaving.value = true
  try {
    await service.saveGraph(projectPath, graphId, nodes, edges)
  } finally {
    isSaving.value = false
  }
}

/**
 * 从角色自动生成关系图
 */
export async function generateFromCharacters(projectPath: string, graphName: string): Promise<CharacterGraph> {
  if (!currentProjectId.value) {
    throw new Error('项目ID未设置')
  }

  isSaving.value = true
  try {
    const graph = await service.generateFromCharacters(projectPath, currentProjectId.value, graphName)
    currentGraph.value = graph
    return graph
  } finally {
    isSaving.value = false
  }
}

/**
 * 导出关系图为 JSON
 */
export async function exportToJSON(projectPath: string, graphId: string): Promise<string> {
  try {
    return await service.exportToJSON(projectPath, graphId)
  } catch (error: any) {
    throw new Error(`导出失败: ${error.message}`)
  }
}

/**
 * 从 JSON 导入关系图
 */
export async function importFromJSON(projectPath: string, jsonString: string): Promise<CharacterGraph> {
  if (!currentProjectId.value) {
    throw new Error('项目ID未设置')
  }

  isSaving.value = true
  try {
    const graph = await service.importFromJSON(projectPath, currentProjectId.value, jsonString)
    currentGraph.value = graph
    return graph
  } finally {
    isSaving.value = false
  }
}
