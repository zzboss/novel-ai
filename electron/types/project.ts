/**
 * 项目相关数据模型定义
 *
 * 定义地图、地点、地点关系、章节细纲的数据结构。
 */

/** 地点关系类型 */
export type LocationRelationType = 'connection' | 'path' | 'border' | 'custom'

/** 地点关系线样式 */
export type LineStyle = 'solid' | 'dashed' | 'dotted'

/** 地图（Map）接口 */
export interface Map {
  id: string
  projectId: string
  name: string
  description?: string
  createdAt: number
  updatedAt: number
}

/** 地点（Location）接口 */
export interface Location {
  id: string
  mapId: string
  name: string
  description?: string
  x: number
  y: number
  color?: string
  size?: number
  icon?: string
  createdAt: number
  updatedAt: number
}

/** 地点关系（LocationRelationship）接口 */
export interface LocationRelationship {
  id: string
  mapId: string
  sourceId: string
  targetId: string
  relationType: LocationRelationType
  relationLabel: string
  description?: string
  color?: string
  lineWidth?: number
  lineStyle?: LineStyle
  createdAt: number
  updatedAt: number
}

// ==================== 章节细纲相关类型 ====================

/** 场景级细纲 */
export interface SceneOutline {
  /** 场景序号 */
  sceneNumber: number
  /** 场景标题 */
  title: string
  /** 场景地点 */
  location: string
  /** 情感基调 */
  emotionalTone: string
  /** 出场人物 */
  characters: string[]
  /** 人物关系变化 */
  characterRelationships: string
  /** 事件/动作 */
  events: string
  /** 情节功能 */
  plotFunction: string
  /** 关键对话/心理活动 */
  keyDialogues: string
  /** 伏笔 */
  foreshadowing: string
  /** 转折 */
  twists: string
}

/** 章节细纲 JSON 结构 */
export interface ChapterOutlineJSON {
  /** 章节标题 */
  chapterTitle: string
  /** 章节序号 */
  chapterNumber: number
  /** 本章核心目标 */
  coreGoal: string
  /** 情节推进 */
  plotProgression: string
  /** 人物发展 */
  characterDevelopment: string
  /** 整体伏笔 */
  overallForeshadowing: string[]
  /** 整体转折 */
  overallTwists: string[]
  /** 下章钩子 */
  nextChapterHook: string
  /** 场景列表 */
  scenes: SceneOutline[]
}
