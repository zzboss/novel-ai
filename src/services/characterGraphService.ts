/**
 * 角色关系图服务层
 *
 * 封装与 Electron 主进程的 IPC 通信
 */
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

/**
 * 获取项目所有关系图
 */
export async function getGraphs(projectPath: string, projectId: string): Promise<Array<{ id: string; name: string; description: string | null; updated_at: number }>> {
  const result = await window.electronAPI.characterGraph.getGraphs(projectPath, projectId)
  if (!result.success) {
    throw new Error(result.error || '获取关系图列表失败')
  }
  return result.data
}

/**
 * 获取单个关系图
 */
export async function getGraphById(projectPath: string, graphId: string): Promise<CharacterGraph> {
  const result = await window.electronAPI.characterGraph.getGraphById(projectPath, graphId)
  if (!result.success) {
    throw new Error(result.error || '获取关系图失败')
  }
  return result.data
}

/**
 * 创建关系图
 */
export async function createGraph(projectPath: string, projectId: string, request: CreateCharacterGraphRequest): Promise<CharacterGraph> {
  const result = await window.electronAPI.characterGraph.createGraph(projectPath, projectId, request)
  if (!result.success) {
    throw new Error(result.error || '创建关系图失败')
  }
  return result.data
}

/**
 * 更新关系图
 */
export async function updateGraph(projectPath: string, graphId: string, request: UpdateCharacterGraphRequest): Promise<void> {
  const result = await window.electronAPI.characterGraph.updateGraph(projectPath, graphId, request)
  if (!result.success) {
    throw new Error(result.error || '更新关系图失败')
  }
}

/**
 * 删除关系图
 */
export async function deleteGraph(projectPath: string, graphId: string): Promise<void> {
  const result = await window.electronAPI.characterGraph.deleteGraph(projectPath, graphId)
  if (!result.success) {
    throw new Error(result.error || '删除关系图失败')
  }
}

// ============================================================
// 节点操作
// ============================================================

/**
 * 添加角色节点
 */
export async function addNode(projectPath: string, graphId: string, request: AddCharacterNodeRequest): Promise<CharacterNode> {
  const result = await window.electronAPI.characterGraph.addNode(projectPath, graphId, request)
  if (!result.success) {
    throw new Error(result.error || '添加节点失败')
  }
  return result.data
}

/**
 * 更新节点
 */
export async function updateNode(projectPath: string, nodeId: string, graphId: string, request: UpdateCharacterNodeRequest): Promise<void> {
  const result = await window.electronAPI.characterGraph.updateNode(projectPath, nodeId, graphId, request)
  if (!result.success) {
    throw new Error(result.error || '更新节点失败')
  }
}

/**
 * 更新节点位置（批量）
 */
export async function updateNodePositions(projectPath: string, graphId: string, positions: Array<{ nodeId: string; x: number; y: number }>): Promise<void> {
  const result = await window.electronAPI.characterGraph.updateNodePositions(projectPath, graphId, positions)
  if (!result.success) {
    throw new Error(result.error || '更新节点位置失败')
  }
}

/**
 * 删除节点
 */
export async function deleteNode(projectPath: string, nodeId: string, graphId: string): Promise<void> {
  const result = await window.electronAPI.characterGraph.deleteNode(projectPath, nodeId, graphId)
  if (!result.success) {
    throw new Error(result.error || '删除节点失败')
  }
}

// ============================================================
// 边操作
// ============================================================

/**
 * 添加关系边
 */
export async function addEdge(projectPath: string, graphId: string, request: AddCharacterEdgeRequest): Promise<CharacterEdge> {
  const result = await window.electronAPI.characterGraph.addEdge(projectPath, graphId, request)
  if (!result.success) {
    throw new Error(result.error || '添加关系边失败')
  }
  return result.data
}

/**
 * 更新关系边
 */
export async function updateEdge(projectPath: string, edgeId: string, graphId: string, request: UpdateCharacterEdgeRequest): Promise<void> {
  const result = await window.electronAPI.characterGraph.updateEdge(projectPath, edgeId, graphId, request)
  if (!result.success) {
    throw new Error(result.error || '更新关系边失败')
  }
}

/**
 * 删除关系边
 */
export async function deleteEdge(projectPath: string, edgeId: string, graphId: string): Promise<void> {
  const result = await window.electronAPI.characterGraph.deleteEdge(projectPath, edgeId, graphId)
  if (!result.success) {
    throw new Error(result.error || '删除关系边失败')
  }
}

// ============================================================
// 高级操作
// ============================================================

/**
 * 保存完整关系图（替换式）
 */
export async function saveGraph(
  projectPath: string,
  graphId: string,
  nodes: Array<{ id: string; characterId: string; x?: number; y?: number; fixed?: boolean; color?: string; size?: number }>,
  edges: Array<{ id: string; source: string; target: string; relationType: string; relationLabel: string; color?: string; lineWidth?: number }>
): Promise<void> {
  const result = await window.electronAPI.characterGraph.saveGraph(projectPath, graphId, nodes, edges)
  if (!result.success) {
    throw new Error(result.error || '保存关系图失败')
  }
}

/**
 * 从角色自动生成关系图
 */
export async function generateFromCharacters(projectPath: string, projectId: string, graphName: string): Promise<CharacterGraph> {
  const result = await window.electronAPI.characterGraph.generateFromCharacters(projectPath, projectId, graphName)
  if (!result.success) {
    throw new Error(result.error || '生成关系图失败')
  }
  return result.data
}

/**
 * 导出关系图为 JSON
 */
export async function exportToJSON(projectPath: string, graphId: string): Promise<string> {
  const result = await window.electronAPI.characterGraph.exportToJSON(projectPath, graphId)
  if (!result.success) {
    throw new Error(result.error || '导出关系图失败')
  }
  return result.data
}

/**
 * 从 JSON 导入关系图
 */
export async function importFromJSON(projectPath: string, projectId: string, jsonString: string): Promise<CharacterGraph> {
  const result = await window.electronAPI.characterGraph.importFromJSON(projectPath, projectId, jsonString)
  if (!result.success) {
    throw new Error(result.error || '导入关系图失败')
  }
  return result.data
}
