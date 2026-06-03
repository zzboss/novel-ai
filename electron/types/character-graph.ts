/**
 * 角色关系图数据模型定义
 * 
 * 定义角色关系图的数据结构，包括节点、边、布局配置等。
 * 用于实现角色关系可视化功能。
 */

import type { CharacterRole, CharacterGender } from './enums'

/** 角色关系类型枚举 */
export enum CharacterRelationType {
  FAMILY = 'family',           // 亲属
  FRIEND = 'friend',           // 朋友
  RIVAL = 'rival',             // 对手
  LOVER = 'lover',             // 恋人
  MENTOR = 'mentor',           // 导师
  STUDENT = 'student',         // 学生
  ENEMY = 'enemy',             // 敌人
  ALLY = 'ally',               // 盟友
  SUBORDINATE = 'subordinate', // 下属
  LEADER = 'leader',           // 领导
  CUSTOM = 'custom'            // 自定义
}

/** 角色节点（图结构） */
export interface CharacterNode {
  id: string                    // 节点ID（唯一标识，可使用 characterId）
  characterId: string           // 角色ID（对应 Character.id）
  name: string                  // 角色名称
  role: CharacterRole           // 角色类型（主角/配角等）
  gender?: CharacterGender      // 性别
  age?: number                  // 年龄
  
  // 图布局属性
  x?: number                   // x 坐标（固定布局时使用）
  y?: number                   // y 坐标（固定布局时使用）
  fixed?: boolean              // 是否固定位置
  
  // 样式属性
  color?: string               // 节点颜色（十六进制，如 #409EFF）
  size?: number                // 节点大小（直径，默认 60）
  icon?: string                // 图标 URL 或 emoji
  borderColor?: string         // 边框颜色
  borderWidth?: number         // 边框宽度
  fontColor?: string           // 文字颜色
  fontSize?: number            // 字体大小
  
  // 显示控制
  collapsed?: boolean          // 是否折叠（隐藏关联节点）
  hidden?: boolean             // 是否隐藏
  
  // 扩展数据（从 Character 接口继承的附加信息）
  appearance?: string          // 外貌
  personality?: string         // 性格
  description?: string         // 描述
}

/** 角色关系边（图结构） */
export interface CharacterEdge {
  id: string                   // 边ID（唯一标识）
  source: string               // 源节点ID（characterId）
  target: string               // 目标节点ID（characterId）
  
  // 关系信息
  relationType: CharacterRelationType  // 关系类型
  relationLabel: string        // 关系标签（显示文本）
  description?: string         // 关系描述
  
  // 关系方向
  directed: boolean            // 是否有方向（true = 有向边）
  bidirectional: boolean       // 是否双向关系
  
  // 样式属性
  color?: string               // 边的颜色
  lineWidth?: number           // 线宽
  lineStyle?: 'solid' | 'dashed' | 'dotted'  // 线型
  labelPosition?: 'middle' | 'source' | 'target'  // 标签位置
  
  // 显示控制
  hidden?: boolean             // 是否隐藏
  
  // 关系强度（用于力导向布局）
  weight?: number              // 权重（0-10，影响布局）
}

/** 图表布局配置 */
export interface GraphLayoutConfig {
  type: 'force' | 'hierarchical' | 'circular' | 'fixed'  // 布局类型
  
  // 力导向布局参数
  force?: {
    repulsion?: number         // 节点斥力（默认 100）
    attraction?: number        // 边吸引力（默认 0.1）
    gravity?: number           // 重力（默认 0.1）
    friction?: number          // 摩擦力（默认 0.9）
  }
  
  // 层次布局参数
  hierarchical?: {
    direction: 'LR' | 'RL' | 'TB' | 'BT'  // 方向（左到右、右到左、上到下、下到上）
    nodeSpacing?: number      // 节点间距（默认 80）
    levelSpacing?: number     // 层级间距（默认 100）
  }
  
  // 环形布局参数
  circular?: {
    radius?: number           // 半径（默认自动计算）
    startAngle?: number       // 起始角度（默认 0）
    endAngle?: number         // 结束角度（默认 360）
  }
}

/** 角色关系图 */
export interface CharacterGraph {
  id: string                   // 图表ID
  projectId: string            // 所属项目ID
  name: string                 // 图表名称
  description?: string         // 图表描述
  
  // 图数据
  nodes: CharacterNode[]       // 节点列表
  edges: CharacterEdge[]       // 边列表
  
  // 布局配置
  layout: GraphLayoutConfig    // 布局配置
  
  // 显示配置
  showLabels: boolean          // 是否显示标签
  showIcons: boolean           // 是否显示图标
  highlightOnHover: boolean    // 悬停时高亮
  
  // 元数据
  createdAt: number            // 创建时间（时间戳）
  updatedAt: number            // 更新时间（时间戳）
  version: number              // 版本号（用于冲突检测）
}

/** 角色关系图摘要（列表显示用） */
export interface CharacterGraphSummary {
  id: string
  name: string
  description?: string
  nodeCount: number            // 节点数量
  edgeCount: number            // 边数量
  updatedAt: number
}

/** 创建角色关系图请求 */
export interface CreateCharacterGraphRequest {
  name: string
  description?: string
  layout?: GraphLayoutConfig
}

/** 更新角色关系图请求 */
export interface UpdateCharacterGraphRequest {
  name?: string
  description?: string
  layout?: GraphLayoutConfig
  showLabels?: boolean
  showIcons?: boolean
  highlightOnHover?: boolean
}

/** 添加角色节点请求 */
export interface AddCharacterNodeRequest {
  characterId: string
  x?: number
  y?: number
  color?: string
  size?: number
  icon?: string
}

/** 更新角色节点请求 */
export interface UpdateCharacterNodeRequest {
  x?: number
  y?: number
  fixed?: boolean
  color?: string
  size?: number
  icon?: string
  borderColor?: string
  borderWidth?: number
  fontColor?: string
  fontSize?: number
  collapsed?: boolean
  hidden?: boolean
}

/** 添加角色关系边请求 */
export interface AddCharacterEdgeRequest {
  source: string               // characterId
  target: string               // characterId
  relationType: CharacterRelationType
  relationLabel: string
  directed?: boolean
  bidirectional?: boolean
  color?: string
  lineWidth?: number
  lineStyle?: 'solid' | 'dashed' | 'dotted'
  weight?: number
}

/** 更新角色关系边请求 */
export interface UpdateCharacterEdgeRequest {
  relationType?: CharacterRelationType
  relationLabel?: string
  description?: string
  directed?: boolean
  bidirectional?: boolean
  color?: string
  lineWidth?: number
  lineStyle?: 'solid' | 'dashed' | 'dotted'
  labelPosition?: 'middle' | 'source' | 'target'
  hidden?: boolean
  weight?: number
}
