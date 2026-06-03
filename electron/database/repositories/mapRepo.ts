/**
 * 地图功能数据访问层 - Map Repository
 *
 * 管理地图、地点、地点关系 的 CRUD 操作
 */

import type { Database } from 'sql.js'
import { queryAll, run, transaction } from '../index'
import type { Map, Location, LocationRelationship, LocationRelationType, LineStyle } from '../../types/project'

// ============================================================
// 数据库记录接口
// ============================================================

interface MapRecord {
  id: string
  project_id: string
  name: string
  description: string | null
  created_at: number
  updated_at: number
}

interface LocationRecord {
  id: string
  map_id: string
  name: string
  description: string | null
  x: number
  y: number
  color: string | null
  size: number
  icon: string | null
  created_at: number
  updated_at: number
}

interface LocationRelationshipRecord {
  id: string
  map_id: string
  source_id: string
  target_id: string
  relation_type: string
  relation_label: string
  description: string | null
  color: string | null
  line_width: number
  line_style: string
  created_at: number
  updated_at: number
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
 * 将数据库记录转换为 Map 对象
 */
function mapToMap(record: MapRecord): Map {
  return {
    id: record.id,
    projectId: record.project_id,
    name: record.name,
    description: record.description || undefined,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  }
}

/**
 * 将数据库记录转换为 Location 对象
 */
function mapToLocation(record: LocationRecord): Location {
  return {
    id: record.id,
    mapId: record.map_id,
    name: record.name,
    description: record.description || undefined,
    x: record.x,
    y: record.y,
    color: record.color || undefined,
    size: record.size,
    icon: record.icon || undefined,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  }
}

/**
 * 将数据库记录转换为 LocationRelationship 对象
 */
function mapToLocationRelationship(record: LocationRelationshipRecord): LocationRelationship {
  return {
    id: record.id,
    mapId: record.map_id,
    sourceId: record.source_id,
    targetId: record.target_id,
    relationType: record.relation_type as LocationRelationType,
    relationLabel: record.relation_label,
    description: record.description || undefined,
    color: record.color || undefined,
    lineWidth: record.line_width,
    lineStyle: record.line_style as LineStyle,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  }
}

// ============================================================
// 地图操作
// ============================================================

/**
 * 获取项目所有地图列表（摘要信息）
 */
export function getMaps(db: Database, projectId: string): Array<{ id: string; name: string; description: string | null; updated_at: number }> {
  const rows = queryAll(db, 'SELECT id, name, description, updated_at FROM maps WHERE project_id = ? ORDER BY updated_at DESC', [projectId])
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    updated_at: r.updated_at
  }))
}

/**
 * 获取单个地图（包含地点和关系）
 */
export function getMapById(db: Database, mapId: string): { map: Map; locations: Location[]; relationships: LocationRelationship[] } | null {
  const row = queryAll(db, 'SELECT * FROM maps WHERE id = ?', [mapId])[0]
  if (!row) return null

  const map = mapToMap(row as unknown as MapRecord)

  // 获取地点
  const locationRows = queryAll(db, 'SELECT * FROM locations WHERE map_id = ?', [mapId])
  const locations: Location[] = locationRows.map(r => mapToLocation(r as unknown as LocationRecord))

  // 获取地点关系
  const relationshipRows = queryAll(db, 'SELECT * FROM location_relationships WHERE map_id = ?', [mapId])
  const relationships: LocationRelationship[] = relationshipRows.map(r => mapToLocationRelationship(r as unknown as LocationRelationshipRecord))

  return { map, locations, relationships }
}

/**
 * 创建地图
 */
export function createMap(db: Database, projectId: string, name: string, description?: string): Map {
  const now = Date.now()
  const mapId = generateId()

  run(db, `
    INSERT INTO maps (id, project_id, name, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [mapId, projectId, name, description || null, now, now])

  return {
    id: mapId,
    projectId,
    name,
    description,
    createdAt: now,
    updatedAt: now
  }
}

/**
 * 更新地图基本信息
 */
export function updateMap(db: Database, mapId: string, name?: string, description?: string): void {
  const updates: string[] = []
  const params: unknown[] = []

  if (name !== undefined) {
    updates.push('name = ?')
    params.push(name)
  }
  if (description !== undefined) {
    updates.push('description = ?')
    params.push(description)
  }

  if (updates.length === 0) return

  updates.push('updated_at = ?')
  params.push(Date.now())

  params.push(mapId)

  run(db, `UPDATE maps SET ${updates.join(', ')} WHERE id = ?`, params)
}

/**
 * 删除地图（级联删除地点和关系）
 */
export function deleteMap(db: Database, mapId: string): void {
  // 由于设置了 ON DELETE CASCADE，只需要删除主表记录
  run(db, 'DELETE FROM maps WHERE id = ?', [mapId])
}

// ============================================================
// 地点操作
// ============================================================

/**
 * 添加地点到地图
 */
export function addLocation(db: Database, mapId: string, name: string, x: number, y: number, description?: string, color?: string, size?: number, icon?: string): Location {
  const locationId = generateId()
  const now = Date.now()

  run(db, `
    INSERT INTO locations (id, map_id, name, description, x, y, color, size, icon, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    locationId,
    mapId,
    name,
    description || null,
    x,
    y,
    color || null,
    size || 30,
    icon || null,
    now,
    now
  ])

  // 更新地图 updated_at
  run(db, 'UPDATE maps SET updated_at = ? WHERE id = ?', [now, mapId])

  return {
    id: locationId,
    mapId,
    name,
    description,
    x,
    y,
    color,
    size: size || 30,
    icon,
    createdAt: now,
    updatedAt: now
  }
}

/**
 * 更新地点属性（位置、样式等）
 */
export function updateLocation(db: Database, locationId: string, mapId: string, updates_data: Partial<Pick<Location, 'name' | 'description' | 'x' | 'y' | 'color' | 'size' | 'icon'>>): void {
  const updates: string[] = []
  const params: unknown[] = []

  if (updates_data.name !== undefined) {
    updates.push('name = ?')
    params.push(updates_data.name)
  }
  if (updates_data.description !== undefined) {
    updates.push('description = ?')
    params.push(updates_data.description)
  }
  if (updates_data.x !== undefined) {
    updates.push('x = ?')
    params.push(updates_data.x)
  }
  if (updates_data.y !== undefined) {
    updates.push('y = ?')
    params.push(updates_data.y)
  }
  if (updates_data.color !== undefined) {
    updates.push('color = ?')
    params.push(updates_data.color)
  }
  if (updates_data.size !== undefined) {
    updates.push('size = ?')
    params.push(updates_data.size)
  }
  if (updates_data.icon !== undefined) {
    updates.push('icon = ?')
    params.push(updates_data.icon)
  }

  if (updates.length === 0) return

  updates.push('updated_at = ?')
  params.push(Date.now())

  params.push(locationId)

  run(db, `UPDATE locations SET ${updates.join(', ')} WHERE id = ? AND map_id = ?`, [...params, mapId])

  // 更新地图 updated_at
  run(db, 'UPDATE maps SET updated_at = ? WHERE id = ?', [Date.now(), mapId])
}

/**
 * 更新地点位置（批量更新，用于拖拽后保存）
 */
export function updateLocationPositions(db: Database, mapId: string, positions: Array<{ locationId: string; x: number; y: number }>): void {
  for (const pos of positions) {
    run(db, `UPDATE locations SET x = ?, y = ?, updated_at = ? WHERE id = ? AND map_id = ?`, [pos.x, pos.y, Date.now(), pos.locationId, mapId])
  }

  // 更新地图 updated_at
  run(db, 'UPDATE maps SET updated_at = ? WHERE id = ?', [Date.now(), mapId])
}

/**
 * 删除地点（同时删除相关的地点关系）
 */
export function deleteLocation(db: Database, locationId: string, mapId: string): void {
  // 删除相关的地点关系
  run(db, `DELETE FROM location_relationships WHERE (source_id = ? OR target_id = ?) AND map_id = ?`, [locationId, locationId, mapId])

  // 删除地点
  run(db, `DELETE FROM locations WHERE id = ? AND map_id = ?`, [locationId, mapId])

  // 更新地图 updated_at
  run(db, 'UPDATE maps SET updated_at = ? WHERE id = ?', [Date.now(), mapId])
}

// ============================================================
// 地点关系操作
// ============================================================

/**
 * 添加地点关系
 */
export function addLocationRelationship(
  db: Database,
  mapId: string,
  sourceId: string,
  targetId: string,
  relationType: LocationRelationType,
  relationLabel: string,
  description?: string,
  color?: string,
  lineWidth?: number,
  lineStyle?: LineStyle
): LocationRelationship {
  const relationshipId = generateId()
  const now = Date.now()

  run(db, `
    INSERT INTO location_relationships (id, map_id, source_id, target_id, relation_type, relation_label, description, color, line_width, line_style, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    relationshipId,
    mapId,
    sourceId,
    targetId,
    relationType,
    relationLabel,
    description || '',
    color || null,
    lineWidth || 2,
    lineStyle || 'solid',
    now,
    now
  ])

  // 更新地图 updated_at
  run(db, 'UPDATE maps SET updated_at = ? WHERE id = ?', [now, mapId])

  return {
    id: relationshipId,
    mapId,
    sourceId,
    targetId,
    relationType,
    relationLabel,
    description,
    color,
    lineWidth: lineWidth || 2,
    lineStyle: lineStyle || 'solid',
    createdAt: now,
    updatedAt: now
  }
}

/**
 * 更新地点关系
 */
export function updateLocationRelationship(db: Database, relationshipId: string, mapId: string, updates_data: Partial<Pick<LocationRelationship, 'relationType' | 'relationLabel' | 'description' | 'color' | 'lineWidth' | 'lineStyle'>>): void {
  const updates: string[] = []
  const params: unknown[] = []

  if (updates_data.relationType !== undefined) {
    updates.push('relation_type = ?')
    params.push(updates_data.relationType)
  }
  if (updates_data.relationLabel !== undefined) {
    updates.push('relation_label = ?')
    params.push(updates_data.relationLabel)
  }
  if (updates_data.description !== undefined) {
    updates.push('description = ?')
    params.push(updates_data.description)
  }
  if (updates_data.color !== undefined) {
    updates.push('color = ?')
    params.push(updates_data.color)
  }
  if (updates_data.lineWidth !== undefined) {
    updates.push('line_width = ?')
    params.push(updates_data.lineWidth)
  }
  if (updates_data.lineStyle !== undefined) {
    updates.push('line_style = ?')
    params.push(updates_data.lineStyle)
  }

  if (updates.length === 0) return

  updates.push('updated_at = ?')
  params.push(Date.now())

  params.push(relationshipId)

  run(db, `UPDATE location_relationships SET ${updates.join(', ')} WHERE id = ? AND map_id = ?`, [...params, mapId])

  // 更新地图 updated_at
  run(db, 'UPDATE maps SET updated_at = ? WHERE id = ?', [Date.now(), mapId])
}

/**
 * 删除地点关系
 */
export function deleteLocationRelationship(db: Database, relationshipId: string, mapId: string): void {
  run(db, `DELETE FROM location_relationships WHERE id = ? AND map_id = ?`, [relationshipId, mapId])

  // 更新地图 updated_at
  run(db, 'UPDATE maps SET updated_at = ? WHERE id = ?', [Date.now(), mapId])
}

// ============================================================
// 批量操作
// ============================================================

/**
 * 保存完整的地图数据（替换式保存）
 * 用于前端编辑后一次性保存所有地点和关系
 */
export function saveMapData(
  db: Database,
  mapId: string,
  locations: Array<{ id: string; name: string; description?: string; x: number; y: number; color?: string; size?: number; icon?: string }>,
  relationships: Array<{ id: string; sourceId: string; targetId: string; relationType: LocationRelationType; relationLabel: string; description?: string; color?: string; lineWidth?: number; lineStyle?: LineStyle }>
): void {
  transaction(db, () => {
    // 删除现有的地点和关系
    run(db, `DELETE FROM location_relationships WHERE map_id = ?`, [mapId])
    run(db, `DELETE FROM locations WHERE map_id = ?`, [mapId])

    // 插入新的地点
    for (const location of locations) {
      run(db, `
        INSERT INTO locations (id, map_id, name, description, x, y, color, size, icon, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        location.id,
        mapId,
        location.name,
        location.description || '',
        location.x,
        location.y,
        location.color || null,
        location.size || 30,
        location.icon || null,
        Date.now(),
        Date.now()
      ])
    }

    // 插入新的关系
    for (const relationship of relationships) {
      run(db, `
        INSERT INTO location_relationships (id, map_id, source_id, target_id, relation_type, relation_label, description, color, line_width, line_style, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        relationship.id,
        mapId,
        relationship.sourceId,
        relationship.targetId,
        relationship.relationType,
        relationship.relationLabel,
        relationship.description || '',
        relationship.color || null,
        relationship.lineWidth || 2,
        relationship.lineStyle || 'solid',
        Date.now(),
        Date.now()
      ])
    }

    // 更新地图 updated_at
    run(db, 'UPDATE maps SET updated_at = ? WHERE id = ?', [Date.now(), mapId])
  })
}

/**
 * 导出地图为 JSON
 */
export function exportMapToJSON(db: Database, mapId: string): string {
  const mapData = getMapById(db, mapId)
  if (!mapData) {
    throw new Error(`地图不存在: ${mapId}`)
  }

  return JSON.stringify(mapData, null, 2)
}

/**
 * 从 JSON 导入地图
 */
export function importMapFromJSON(db: Database, projectId: string, jsonString: string): { map: Map; locations: Location[]; relationships: LocationRelationship[] } {
  const mapData = JSON.parse(jsonString) as { map: Map; locations: Location[]; relationships: LocationRelationship[] }

  // 创建新地图
  const map = createMap(db, projectId, mapData.map.name + ' (导入)', mapData.map.description)

  // 导入地点
  for (const location of mapData.locations) {
    addLocation(db, map.id, location.name, location.x, location.y, location.description, location.color, location.size, location.icon)
  }

  // 导入地点关系
  for (const relationship of mapData.relationships) {
    try {
      addLocationRelationship(db, map.id, relationship.sourceId, relationship.targetId, relationship.relationType, relationship.relationLabel, relationship.description, relationship.color, relationship.lineWidth, relationship.lineStyle)
    } catch (e) {
      console.warn(`导入地点关系失败: ${relationship.id}`, e)
    }
  }

  return getMapById(db, map.id)!
}
