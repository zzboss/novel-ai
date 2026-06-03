/**
 * 角色关系图数据访问层 - Character Graph Repository
 *
 * 管理角色关系图的 CRUD 操作，包括图表、节点和边的数据访问
 */
import type { Database } from 'sql.js'
import { queryAll, run, transaction } from '../index'
import type {
  CharacterGraph,
  CharacterNode,
  CharacterEdge,
  GraphLayoutConfig,
  CharacterRelationType,
  CreateCharacterGraphRequest,
  UpdateCharacterGraphRequest,
  AddCharacterNodeRequest,
  UpdateCharacterNodeRequest,
  AddCharacterEdgeRequest,
  UpdateCharacterEdgeRequest
} from '../../types/character-graph'
import { CharacterRole } from '../../types/enums'

// ============================================================
// 数据库记录接口
// ============================================================

interface CharacterGraphRecord {
  id: string
  project_id: string
  name: string
  description: string | null
  layout_type: string
  show_labels: number
  show_icons: number
  highlight_on_hover: number
  version: number
  created_at: number
  updated_at: number
}

interface CharacterGraphNodeRecord {
  id: string
  graph_id: string
  character_id: string
  x: number | null
  y: number | null
  fixed: number
  color: string | null
  size: number
  icon: string | null
  border_color: string | null
  border_width: number
  font_color: string
  font_size: number
  collapsed: number
  hidden: number
}

interface CharacterGraphEdgeRecord {
  id: string
  graph_id: string
  source_id: string
  target_id: string
  relation_type: string
  relation_label: string
  description: string | null
  directed: number
  bidirectional: number
  color: string | null
  line_width: number
  line_style: string
  label_position: string
  hidden: number
  weight: number
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 生成 UUID
 */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * 将数据库记录转换为 CharacterGraph 对象
 */
function mapToCharacterGraph(record: CharacterGraphRecord, nodes: CharacterNode[], edges: CharacterEdge[]): CharacterGraph {
  // 解析布局配置
  let layout: GraphLayoutConfig = { type: 'force' }
  try {
    // 根据 layout_type 构建布局配置
    const layoutType = record.layout_type as GraphLayoutConfig['type']
    layout = { type: layoutType }
  } catch {
    layout = { type: 'force' }
  }

  return {
    id: record.id,
    projectId: record.project_id,
    name: record.name,
    description: record.description || undefined,
    nodes,
    edges,
    layout,
    showLabels: record.show_labels === 1,
    showIcons: record.show_icons === 1,
    highlightOnHover: record.highlight_on_hover === 1,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    version: record.version
  }
}

/**
 * 将数据库记录转换为 CharacterNode 对象
 */
function mapToCharacterNode(record: CharacterGraphNodeRecord): CharacterNode {
  return {
    id: record.id,
    characterId: record.character_id,
    name: '', // 需要从 characters 表获取
    role: CharacterRole.SUPPORTING, // 需要从 characters 表获取
    x: record.x ?? undefined,
    y: record.y ?? undefined,
    fixed: record.fixed === 1,
    color: record.color || undefined,
    size: record.size,
    icon: record.icon || undefined,
    borderColor: record.border_color || undefined,
    borderWidth: record.border_width,
    fontColor: record.font_color,
    fontSize: record.font_size,
    collapsed: record.collapsed === 1,
    hidden: record.hidden === 1
  }
}

/**
 * 将数据库记录转换为 CharacterEdge 对象
 */
function mapToCharacterEdge(record: CharacterGraphEdgeRecord): CharacterEdge {
  return {
    id: record.id,
    source: record.source_id,
    target: record.target_id,
    relationType: record.relation_type as CharacterRelationType,
    relationLabel: record.relation_label,
    description: record.description || undefined,
    directed: record.directed === 1,
    bidirectional: record.bidirectional === 1,
    color: record.color || undefined,
    lineWidth: record.line_width,
    lineStyle: record.line_style as 'solid' | 'dashed' | 'dotted',
    labelPosition: record.label_position as 'middle' | 'source' | 'target',
    hidden: record.hidden === 1,
    weight: record.weight
  }
}

// ============================================================
// 图表操作
// ============================================================

/**
 * 获取项目所有关系图列表（摘要信息）
 */
export function getCharacterGraphs(db: Database, projectId: string): Array<{ id: string; name: string; description: string | null; updated_at: number }> {
  const rows = queryAll(db, 'SELECT id, name, description, updated_at FROM character_graphs WHERE project_id = ? ORDER BY updated_at DESC', [projectId])
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    updated_at: r.updated_at
  }))
}

/**
 * 获取单个关系图（包含节点和边）
 */
export function getCharacterGraphById(db: Database, graphId: string): CharacterGraph | null {
  const row = queryAll(db, 'SELECT * FROM character_graphs WHERE id = ?', [graphId])[0]
  if (!row) return null

  // 获取节点
  const nodeRows = queryAll(db, 'SELECT * FROM character_graph_nodes WHERE graph_id = ?', [graphId])
  const nodes: CharacterNode[] = nodeRows.map(r => {
    const node = mapToCharacterNode(r)
    // 获取角色信息
    const charRow = queryAll(db, 'SELECT name, role FROM characters WHERE id = ?', [r.character_id])[0]
    if (charRow) {
      node.name = charRow.name
      node.role = charRow.role
    }
    return node
  })

  // 获取边
  const edgeRows = queryAll(db, 'SELECT * FROM character_graph_edges WHERE graph_id = ?', [graphId])
  const edges: CharacterEdge[] = edgeRows.map(r => mapToCharacterEdge(r))

  return mapToCharacterGraph(row, nodes, edges)
}

/**
 * 创建关系图
 */
export function createCharacterGraph(db: Database, projectId: string, request: CreateCharacterGraphRequest): CharacterGraph {
  const now = Date.now()
  const graphId = generateId()

  const graph: CharacterGraphRecord = {
    id: graphId,
    project_id: projectId,
    name: request.name,
    description: request.description || null,
    layout_type: request.layout?.type || 'force',
    show_labels: 1,
    show_icons: 1,
    highlight_on_hover: 1,
    version: 1,
    created_at: now,
    updated_at: now
  }

  run(db, `
    INSERT INTO character_graphs (id, project_id, name, description, layout_type, show_labels, show_icons, highlight_on_hover, version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [graph.id, graph.project_id, graph.name, graph.description, graph.layout_type, graph.show_labels, graph.show_icons, graph.highlight_on_hover, graph.version, graph.created_at, graph.updated_at])

  return {
    id: graphId,
    projectId,
    name: request.name,
    description: request.description,
    nodes: [],
    edges: [],
    layout: request.layout || { type: 'force' },
    showLabels: true,
    showIcons: true,
    highlightOnHover: true,
    createdAt: now,
    updatedAt: now,
    version: 1
  }
}

/**
 * 更新关系图基本信息
 */
export function updateCharacterGraph(db: Database, graphId: string, request: UpdateCharacterGraphRequest): void {
  const updates: string[] = []
  const params: any[] = []

  if (request.name !== undefined) {
    updates.push('name = ?')
    params.push(request.name)
  }
  if (request.description !== undefined) {
    updates.push('description = ?')
    params.push(request.description)
  }
  if (request.layout !== undefined) {
    updates.push('layout_type = ?')
    params.push(request.layout.type)
  }
  if (request.showLabels !== undefined) {
    updates.push('show_labels = ?')
    params.push(request.showLabels ? 1 : 0)
  }
  if (request.showIcons !== undefined) {
    updates.push('show_icons = ?')
    params.push(request.showIcons ? 1 : 0)
  }
  if (request.highlightOnHover !== undefined) {
    updates.push('highlight_on_hover = ?')
    params.push(request.highlightOnHover ? 1 : 0)
  }

  updates.push('updated_at = ?')
  params.push(Date.now())

  params.push(graphId)

  run(db, `UPDATE character_graphs SET ${updates.join(', ')} WHERE id = ?`, params)
}

/**
 * 删除关系图
 */
export function deleteCharacterGraph(db: Database, graphId: string): void {
  // 由于设置了 ON DELETE CASCADE，只需要删除主表记录
  run(db, 'DELETE FROM character_graphs WHERE id = ?', [graphId])
}

// ============================================================
// 节点操作
// ============================================================

/**
 * 添加角色节点到关系图
 */
export function addCharacterNode(db: Database, graphId: string, request: AddCharacterNodeRequest): CharacterNode {
  const nodeId = generateId()
  const now = Date.now()

  run(db, `
    INSERT INTO character_graph_nodes (
      id, graph_id, character_id, x, y, fixed, color, size, icon,
      border_color, border_width, font_color, font_size, collapsed, hidden
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    nodeId,
    graphId,
    request.characterId,
    request.x ?? null,
    request.y ?? null,
    0, // fixed
    request.color || null,
    request.size || 60,
    request.icon || null,
    null, // border_color
    2, // border_width
    '#FFFFFF', // font_color
    14, // font_size
    0, // collapsed
    0  // hidden
  ])

  // 获取角色信息
  const charRow = queryAll(db, 'SELECT name, role FROM characters WHERE id = ?', [request.characterId])[0]

  // 更新图表 updated_at
  run(db, 'UPDATE character_graphs SET updated_at = ? WHERE id = ?', [now, graphId])

  return {
    id: nodeId,
    characterId: request.characterId,
    name: charRow?.name || '',
    role: charRow?.role || 'supporting',
    x: request.x,
    y: request.y,
    color: request.color,
    size: request.size || 60,
    icon: request.icon
  }
}

/**
 * 更新节点属性（位置、样式等）
 */
export function updateCharacterNode(db: Database, nodeId: string, graphId: string, request: UpdateCharacterNodeRequest): void {
  const updates: string[] = []
  const params: any[] = []

  if (request.x !== undefined) {
    updates.push('x = ?')
    params.push(request.x)
  }
  if (request.y !== undefined) {
    updates.push('y = ?')
    params.push(request.y)
  }
  if (request.fixed !== undefined) {
    updates.push('fixed = ?')
    params.push(request.fixed ? 1 : 0)
  }
  if (request.color !== undefined) {
    updates.push('color = ?')
    params.push(request.color)
  }
  if (request.size !== undefined) {
    updates.push('size = ?')
    params.push(request.size)
  }
  if (request.icon !== undefined) {
    updates.push('icon = ?')
    params.push(request.icon)
  }
  if (request.borderColor !== undefined) {
    updates.push('border_color = ?')
    params.push(request.borderColor)
  }
  if (request.borderWidth !== undefined) {
    updates.push('border_width = ?')
    params.push(request.borderWidth)
  }
  if (request.fontColor !== undefined) {
    updates.push('font_color = ?')
    params.push(request.fontColor)
  }
  if (request.fontSize !== undefined) {
    updates.push('font_size = ?')
    params.push(request.fontSize)
  }
  if (request.collapsed !== undefined) {
    updates.push('collapsed = ?')
    params.push(request.collapsed ? 1 : 0)
  }
  if (request.hidden !== undefined) {
    updates.push('hidden = ?')
    params.push(request.hidden ? 1 : 0)
  }

  if (updates.length === 0) return

  params.push(nodeId)

  run(db, `UPDATE character_graph_nodes SET ${updates.join(', ')} WHERE id = ? AND graph_id = ?`, [...params, graphId])

  // 更新图表 updated_at
  run(db, 'UPDATE character_graphs SET updated_at = ? WHERE id = ?', [Date.now(), graphId])
}

/**
 * 更新节点位置（批量更新，用于拖拽后保存）
 */
export function updateNodePositions(db: Database, graphId: string, positions: Array<{ nodeId: string; x: number; y: number }>): void {
  for (const pos of positions) {
    run(db, `UPDATE character_graph_nodes SET x = ?, y = ?, fixed = 1 WHERE id = ? AND graph_id = ?`, [pos.x, pos.y, 1, pos.nodeId, graphId])
  }

  // 更新图表 updated_at
  run(db, 'UPDATE character_graphs SET updated_at = ? WHERE id = ?', [Date.now(), graphId])
}

/**
 * 删除节点（同时删除相关的边）
 */
export function deleteCharacterNode(db: Database, nodeId: string, graphId: string): void {
  // 删除相关的边
  run(db, `DELETE FROM character_graph_edges WHERE (source_id = ? OR target_id = ?) AND graph_id = ?`, [nodeId, nodeId, graphId])

  // 删除节点
  run(db, `DELETE FROM character_graph_nodes WHERE id = ? AND graph_id = ?`, [nodeId, graphId])

  // 更新图表 updated_at
  run(db, 'UPDATE character_graphs SET updated_at = ? WHERE id = ?', [Date.now(), graphId])
}

/**
 * 从关系图中移除角色节点（不删除角色本身）
 */
export function removeNodeFromGraph(db: Database, nodeId: string, graphId: string): void {
  deleteCharacterNode(db, nodeId, graphId)
}

// ============================================================
// 边操作
// ============================================================

/**
 * 添加关系边
 */
export function addCharacterEdge(db: Database, graphId: string, request: AddCharacterEdgeRequest): CharacterEdge {
  const edgeId = generateId()
  const now = Date.now()

  run(db, `
    INSERT INTO character_graph_edges (
      id, graph_id, source_id, target_id, relation_type, relation_label,
      description, directed, bidirectional, color, line_width, line_style,
      label_position, hidden, weight
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    edgeId,
    graphId,
    request.source,
    request.target,
    request.relationType,
    request.relationLabel,
    '', // description
    request.directed ? 1 : 0,
    request.bidirectional ? 1 : 0,
    request.color || null,
    request.lineWidth || 2,
    request.lineStyle || 'solid',
    'middle', // label_position
    0, // hidden
    request.weight || 5
  ])

  // 更新图表 updated_at
  run(db, 'UPDATE character_graphs SET updated_at = ? WHERE id = ?', [now, graphId])

  return {
    id: edgeId,
    source: request.source,
    target: request.target,
    relationType: request.relationType,
    relationLabel: request.relationLabel,
    directed: request.directed || true,
    bidirectional: request.bidirectional || false,
    color: request.color,
    lineWidth: request.lineWidth || 2,
    lineStyle: request.lineStyle || 'solid',
    weight: request.weight || 5
  }
}

/**
 * 更新关系边
 */
export function updateCharacterEdge(db: Database, edgeId: string, graphId: string, request: UpdateCharacterEdgeRequest): void {
  const updates: string[] = []
  const params: any[] = []

  if (request.relationType !== undefined) {
    updates.push('relation_type = ?')
    params.push(request.relationType)
  }
  if (request.relationLabel !== undefined) {
    updates.push('relation_label = ?')
    params.push(request.relationLabel)
  }
  if (request.description !== undefined) {
    updates.push('description = ?')
    params.push(request.description)
  }
  if (request.directed !== undefined) {
    updates.push('directed = ?')
    params.push(request.directed ? 1 : 0)
  }
  if (request.bidirectional !== undefined) {
    updates.push('bidirectional = ?')
    params.push(request.bidirectional ? 1 : 0)
  }
  if (request.color !== undefined) {
    updates.push('color = ?')
    params.push(request.color)
  }
  if (request.lineWidth !== undefined) {
    updates.push('line_width = ?')
    params.push(request.lineWidth)
  }
  if (request.lineStyle !== undefined) {
    updates.push('line_style = ?')
    params.push(request.lineStyle)
  }
  if (request.labelPosition !== undefined) {
    updates.push('label_position = ?')
    params.push(request.labelPosition)
  }
  if (request.hidden !== undefined) {
    updates.push('hidden = ?')
    params.push(request.hidden ? 1 : 0)
  }
  if (request.weight !== undefined) {
    updates.push('weight = ?')
    params.push(request.weight)
  }

  if (updates.length === 0) return

  params.push(edgeId)

  run(db, `UPDATE character_graph_edges SET ${updates.join(', ')} WHERE id = ? AND graph_id = ?`, [...params, graphId])

  // 更新图表 updated_at
  run(db, 'UPDATE character_graphs SET updated_at = ? WHERE id = ?', [Date.now(), graphId])
}

/**
 * 删除关系边
 */
export function deleteCharacterEdge(db: Database, edgeId: string, graphId: string): void {
  run(db, `DELETE FROM character_graph_edges WHERE id = ? AND graph_id = ?`, [edgeId, graphId])

  // 更新图表 updated_at
  run(db, 'UPDATE character_graphs SET updated_at = ? WHERE id = ?', [Date.now(), graphId])
}

// ============================================================
// 批量操作
// ============================================================

/**
 * 保存完整的关系图数据（替换式保存）
 * 用于前端编辑后一次性保存所有节点和边
 */
export function saveCharacterGraph(
  db: Database,
  graphId: string,
  nodes: Array<{ id: string; characterId: string; x?: number; y?: number; fixed?: boolean; color?: string; size?: number }>,
  edges: Array<{ id: string; source: string; target: string; relationType: CharacterRelationType; relationLabel: string; color?: string; lineWidth?: number }>
): void {
  transaction(db, () => {
    // 删除现有的节点和边
    run(db, `DELETE FROM character_graph_nodes WHERE graph_id = ?`, [graphId])
    run(db, `DELETE FROM character_graph_edges WHERE graph_id = ?`, [graphId])

    // 插入新的节点
    for (const node of nodes) {
      run(db, `
        INSERT INTO character_graph_nodes (id, graph_id, character_id, x, y, fixed, color, size, icon, border_color, border_width, font_color, font_size, collapsed, hidden)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        node.id,
        graphId,
        node.characterId,
        node.x ?? null,
        node.y ?? null,
        node.fixed ? 1 : 0,
        node.color || null,
        node.size || 60,
        null, // icon
        null, // border_color
        2, // border_width
        '#FFFFFF', // font_color
        14, // font_size
        0, // collapsed
        0  // hidden
      ])
    }

    // 插入新的边
    for (const edge of edges) {
      run(db, `
        INSERT INTO character_graph_edges (id, graph_id, source_id, target_id, relation_type, relation_label, description, directed, bidirectional, color, line_width, line_style, label_position, hidden, weight)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        edge.id,
        graphId,
        edge.source,
        edge.target,
        edge.relationType,
        edge.relationLabel,
        '', // description
        1, // directed
        0, // bidirectional
        edge.color || null,
        edge.lineWidth || 2,
        'solid', // line_style
        'middle', // label_position
        0, // hidden
        5  // weight
      ])
    }

    // 更新图表 updated_at
    run(db, 'UPDATE character_graphs SET updated_at = ? WHERE id = ?', [Date.now(), graphId])
  })
}

/**
 * 从现有角色数据自动生成关系图
 */
export function generateGraphFromCharacters(db: Database, projectId: string, graphName: string): CharacterGraph {
  // 获取所有角色
  const characters = queryAll(db, 'SELECT id, name, role FROM characters')

  if (characters.length === 0) {
    throw new Error('项目中没有角色，无法生成关系图')
  }

  // 创建关系图
  const graph = createCharacterGraph(db, projectId, { name: graphName })

  // 为所有角色创建节点，同时建立 characterId -> nodeId 的映射
  const characterIdToNodeId = new Map<string, string>()
  for (const char of characters) {
    const node = addCharacterNode(db, graph.id, {
      characterId: char.id,
      color: getColorByRole(char.role)
    })
    characterIdToNodeId.set(char.id, node.id)
  }

  // 从 character_relationships 表导入关系
  // 使用节点UUID作为 source/target，而非角色ID
  for (const char of characters) {
    const rels = queryAll(db, 'SELECT related_character_id, relation FROM character_relationships WHERE character_id = ?', [char.id])
    for (const rel of rels) {
      const sourceNodeId = characterIdToNodeId.get(char.id)
      const targetNodeId = characterIdToNodeId.get(rel.related_character_id)

      if (!sourceNodeId || !targetNodeId) {
        console.warn(`[generateGraphFromCharacters] 跳过关系: ${char.id} -> ${rel.related_character_id}, 未找到对应节点`)
        continue
      }

      // 检查边是否已存在（使用节点UUID查询）
      const existingEdges = queryAll(db, `
        SELECT id FROM character_graph_edges
        WHERE graph_id = ? AND source_id = ? AND target_id = ?
      `, [graph.id, sourceNodeId, targetNodeId])

      if (existingEdges.length === 0) {
        addCharacterEdge(db, graph.id, {
          source: sourceNodeId,
          target: targetNodeId,
          relationType: inferRelationType(rel.relation),
          relationLabel: rel.relation
        })
      }
    }
  }

  // 返回完整的关系图
  return getCharacterGraphById(db, graph.id)!
}

/**
 * 根据角色类型获取默认颜色
 */
function getColorByRole(role: string): string {
  const colorMap: Record<string, string> = {
    'protagonist': '#FFD700',    // 金色
    'antagonist': '#DC143C',     // 深红色
    'supporting': '#4169E1',    // 蓝色
    'minor': '#808080'           // 灰色
  }
  return colorMap[role] || '#409EFF'
}

/**
 * 根据关系描述推断关系类型
 */
function inferRelationType(relation: string): CharacterRelationType {
  const lower = relation.toLowerCase()

  if (lower.includes('父') || lower.includes('母') || lower.includes('子') || lower.includes('女') || lower.includes('兄') || lower.includes('弟') || lower.includes('姐') || lower.includes('妹')) {
    return 'family' as CharacterRelationType
  }
  if (lower.includes('朋友') || lower.includes('好友')) {
    return 'friend' as CharacterRelationType
  }
  if (lower.includes('敌人') || lower.includes('敌对')) {
    return 'enemy' as CharacterRelationType
  }
  if (lower.includes('恋') || lower.includes('爱')) {
    return 'lover' as CharacterRelationType
  }
  if (lower.includes('导师') || lower.includes('老师')) {
    return 'mentor' as CharacterRelationType
  }

  return 'custom' as CharacterRelationType
}

/**
 * 导出关系图为 JSON
 */
export function exportCharacterGraphToJSON(db: Database, graphId: string): string {
  const graph = getCharacterGraphById(db, graphId)
  if (!graph) {
    throw new Error(`关系图不存在: ${graphId}`)
  }

  return JSON.stringify(graph, null, 2)
}

/**
 * 从 JSON 导入关系图
 */
export function importCharacterGraphFromJSON(db: Database, projectId: string, jsonString: string): CharacterGraph {
  const graphData = JSON.parse(jsonString) as CharacterGraph

  // 创建新关系图
  const graph = createCharacterGraph(db, projectId, {
    name: graphData.name + ' (导入)',
    description: graphData.description
  })

  // 导入节点
  for (const node of graphData.nodes) {
    addCharacterNode(db, graph.id, {
      characterId: node.characterId,
      x: node.x,
      y: node.y,
      color: node.color,
      size: node.size,
      icon: node.icon
    })

    // 更新节点样式属性
    if (node.borderColor || node.borderWidth || node.fontColor || node.fontSize) {
      const nodeId = queryAll(db, 'SELECT id FROM character_graph_nodes WHERE graph_id = ? AND character_id = ?', [graph.id, node.characterId])[0]?.id
      if (nodeId) {
        updateCharacterNode(db, nodeId, graph.id, {
          borderColor: node.borderColor,
          borderWidth: node.borderWidth,
          fontColor: node.fontColor,
          fontSize: node.fontSize,
          fixed: node.fixed,
          collapsed: node.collapsed,
          hidden: node.hidden
        })
      }
    }
  }

  // 导入边
  for (const edge of graphData.edges) {
    try {
      addCharacterEdge(db, graph.id, {
        source: edge.source,
        target: edge.target,
        relationType: edge.relationType,
        relationLabel: edge.relationLabel,
        directed: edge.directed,
        bidirectional: edge.bidirectional,
        color: edge.color,
        lineWidth: edge.lineWidth,
        lineStyle: edge.lineStyle,
        weight: edge.weight
      })
    } catch (e) {
      console.warn(`导入边失败: ${edge.id}`, e)
    }
  }

  return getCharacterGraphById(db, graph.id)!
}
