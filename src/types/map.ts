/**
 * 地图功能类型定义
 *
 * 包含地图、地点、地点关系的完整类型定义，
 * 使用枚举替代字符串字面量类型，提高类型安全性。
 */

// ============================================================
// 枚举定义
// ============================================================

/** 地图类型 */
export const MapType = {
  /** 世界地图 */
  WORLD: 'world',
  /** 区域地图 */
  REGION: 'region',
  /** 城市地图 */
  CITY: 'city',
  /** 建筑地图 */
  BUILDING: 'building',
  /** 自定义地图 */
  CUSTOM: 'custom'
} as const
export type MapType = (typeof MapType)[keyof typeof MapType]

/** 地点类别 */
export const LocationCategory = {
  /** 城市 */
  CITY: 'city',
  /** 城镇 */
  TOWN: 'town',
  /** 村庄 */
  VILLAGE: 'village',
  /** 山脉 */
  MOUNTAIN: 'mountain',
  /** 河流 */
  RIVER: 'river',
  /** 森林 */
  FOREST: 'forest',
  /** 建筑 */
  BUILDING: 'building',
  /** 遗迹 */
  RUIN: 'ruin',
  /** 其他 */
  OTHER: 'other'
} as const
export type LocationCategory = (typeof LocationCategory)[keyof typeof LocationCategory]

/** 地点关系类型 */
export const LocationRelationType = {
  /** 连接 */
  CONNECTION: 'connection',
  /** 道路 */
  PATH: 'path',
  /** 边界 */
  BORDER: 'border',
  /** 河流 */
  RIVER: 'river',
  /** 贸易路线 */
  TRADE_ROUTE: 'trade_route',
  /** 军事路线 */
  MILITARY_ROUTE: 'military_route',
  /** 自定义 */
  CUSTOM: 'custom'
} as const
export type LocationRelationType = (typeof LocationRelationType)[keyof typeof LocationRelationType]

/** 线条样式 */
export const LineStyle = {
  /** 实线 */
  SOLID: 'solid',
  /** 虚线 */
  DASHED: 'dashed',
  /** 点线 */
  DOTTED: 'dotted',
  /** 双线 */
  DOUBLE: 'double'
} as const
export type LineStyle = (typeof LineStyle)[keyof typeof LineStyle]

/** 线条箭头类型 */
export const LineArrowType = {
  /** 无箭头 */
  NONE: 'none',
  /** 正向箭头 */
  FORWARD: 'forward',
  /** 反向箭头 */
  BACKWARD: 'backward',
  /** 双向箭头 */
  BOTH: 'both'
} as const
export type LineArrowType = (typeof LineArrowType)[keyof typeof LineArrowType]

/** 节点形状 */
export const NodeShape = {
  /** 圆形 */
  CIRCLE: 'circle',
  /** 矩形 */
  RECTANGLE: 'rectangle',
  /** 菱形 */
  DIAMOND: 'diamond',
  /** 自定义 */
  CUSTOM: 'custom'
} as const
export type NodeShape = (typeof NodeShape)[keyof typeof NodeShape]

// ============================================================
// 接口定义
// ============================================================

/** 地图元数据 */
export interface MapMetadata {
  /** 作者 */
  author?: string
  /** 版本 */
  version?: string
  /** 标签 */
  tags?: string[]
  /** 缩略图（Base64 或 URL） */
  thumbnail?: string
  /** 自定义属性 */
  [key: string]: unknown
}

/** 地图设置 */
export interface MapSettings {
  /** 默认地点颜色 */
  defaultLocationColor?: string
  /** 默认地点大小 */
  defaultLocationSize?: number
  /** 默认线条颜色 */
  defaultLineColor?: string
  /** 默认线条宽度 */
  defaultLineWidth?: number
  /** 默认线条样式 */
  defaultLineStyle?: LineStyle
  /** 是否显示网格 */
  showGrid?: boolean
  /** 网格大小 */
  gridSize?: number
  /** 是否吸附到网格 */
  snapToGrid?: boolean
  /** 是否显示缩略图 */
  showMinimap?: boolean
  /** 是否显示比例尺 */
  showScale?: boolean
}

/** 地点属性 */
export interface LocationProperties {
  /** 类别 */
  category?: LocationCategory
  /** 标签 */
  tags?: string[]
  /** 人口 */
  population?: number
  /** 面积 */
  area?: number
  /** 气候 */
  climate?: string
  /** 地形 */
  terrain?: string
  /** 资源 */
  resources?: string[]
  /** 文化 */
  culture?: string
  /** 宗教 */
  religion?: string
  /** 政治 */
  politics?: string
  /** 经济 */
  economy?: string
  /** 军事 */
  military?: string
  /** 历史 */
  history?: string
  /** 自定义属性 */
  [key: string]: unknown
}

/** 地点样式 */
export interface LocationStyle {
  /** 背景颜色 */
  backgroundColor?: string
  /** 边框颜色 */
  borderColor?: string
  /** 边框宽度 */
  borderWidth?: number
  /** 文本颜色 */
  textColor?: string
  /** 字体大小 */
  fontSize?: number
  /** 形状 */
  shape?: NodeShape
  /** 图标 */
  icon?: string
  /** 透明度 */
  opacity?: number
  /** 是否显示阴影 */
  showShadow?: boolean
}

/** 关系样式 */
export interface RelationshipStyle {
  /** 线条颜色 */
  color?: string
  /** 线条宽度 */
  lineWidth?: number
  /** 线条样式 */
  lineStyle?: LineStyle
  /** 箭头类型 */
  arrowType?: LineArrowType
  /** 标签颜色 */
  labelColor?: string
  /** 标签背景颜色 */
  labelBackgroundColor?: string
  /** 标签字体大小 */
  labelFontSize?: number
  /** 曲线类型 */
  curveType?: 'straight' | 'bezier' | 'arc'
}

/** 地图视口 */
export interface MapViewport {
  /** 缩放级别 */
  zoom: number
  /** 中心点 X 坐标 */
  centerX: number
  /** 中心点 Y 坐标 */
  centerY: number
}

// ============================================================
// 核心接口
// ============================================================

/** 地图（Map）接口 */
export interface Map {
  /** 唯一标识符 */
  id: string
  /** 项目 ID */
  projectId: string
  /** 地图名称 */
  name: string
  /** 地图描述 */
  description?: string
  /** 地图类型 */
  mapType?: MapType
  /** 地图设置 */
  settings?: MapSettings
  /** 元数据 */
  metadata?: MapMetadata
  /** 视口 */
  viewport?: MapViewport
  /** 创建时间（时间戳） */
  createdAt: number
  /** 更新时间（时间戳） */
  updatedAt: number
}

/** 地点（Location）接口 */
export interface Location {
  /** 唯一标识符 */
  id: string
  /** 地图 ID */
  mapId: string
  /** 地点名称 */
  name: string
  /** 地点描述 */
  description?: string
  /** X 坐标 */
  x: number
  /** Y 坐标 */
  y: number
  /** 宽度 */
  width?: number
  /** 高度 */
  height?: number
  /** 颜色 */
  color?: string
  /** 大小（半径或缩放比例） */
  size?: number
  /** 图标 */
  icon?: string
  /** 属性 */
  properties?: LocationProperties
  /** 样式 */
  style?: LocationStyle
  /** 创建时间（时间戳） */
  createdAt: number
  /** 更新时间（时间戳） */
  updatedAt: number
}

/** 地点关系（LocationRelationship）接口 */
export interface LocationRelationship {
  /** 唯一标识符 */
  id: string
  /** 地图 ID */
  mapId: string
  /** 源地点 ID */
  sourceId: string
  /** 目标地点 ID */
  targetId: string
  /** 关系类型 */
  relationType: LocationRelationType
  /** 关系标签 */
  relationLabel: string
  /** 关系描述 */
  description?: string
  /** 样式 */
  style?: RelationshipStyle
  /** 创建时间（时间戳） */
  createdAt: number
  /** 更新时间（时间戳） */
  updatedAt: number
}

// ============================================================
// 辅助接口
// ============================================================

/** 地图摘要（用于列表显示） */
export interface MapSummary {
  /** 唯一标识符 */
  id: string
  /** 地图名称 */
  name: string
  /** 地图描述 */
  description?: string
  /** 地图类型 */
  mapType?: MapType
  /** 地点数量 */
  locationCount: number
  /** 关系数量 */
  relationshipCount: number
  /** 更新时间（时间戳） */
  updatedAt: number
}

/** 地点摘要（用于下拉选择等） */
export interface LocationSummary {
  /** 唯一标识符 */
  id: string
  /** 地点名称 */
  name: string
  /** 地点类别 */
  category?: LocationCategory
}

/** 关系摘要 */
export interface RelationshipSummary {
  /** 唯一标识符 */
  id: string
  /** 源地点名称 */
  sourceName: string
  /** 目标地点名称 */
  targetName: string
  /** 关系类型 */
  relationType: LocationRelationType
  /** 关系标签 */
  relationLabel: string
}

/** 地图数据（包含地点和关系） */
export interface MapData {
  /** 地图 */
  map: Map
  /** 地点列表 */
  locations: Location[]
  /** 关系列表 */
  relationships: LocationRelationship[]
}

/** 地图导出选项 */
export interface MapExportOptions {
  /** 导出格式 */
  format: 'json' | 'png' | 'svg' | 'pdf'
  /** 是否包含地点 */
  includeLocations?: boolean
  /** 是否包含关系 */
  includeRelationships?: boolean
  /** 是否包含描述 */
  includeDescriptions?: boolean
  /** 图片宽度（仅图片格式） */
  width?: number
  /** 图片高度（仅图片格式） */
  height?: number
  /** 图片缩放比例（仅图片格式） */
  scale?: number
}

/** 地图导入结果 */
export interface MapImportResult {
  /** 地图 */
  map: Map
  /** 地点列表 */
  locations: Location[]
  /** 关系列表 */
  relationships: LocationRelationship[]
  /** 导入警告 */
  warnings?: string[]
}
