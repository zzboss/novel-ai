/**
 * 角色关系图数据模型定义
 *
 * 定义角色关系图的数据结构，包括节点、边、布局配置等。
 * 用于实现角色关系可视化功能。
 */
import type { CharacterRole, CharacterGender } from './enums';
/** 角色关系类型枚举 */
export declare enum CharacterRelationType {
    FAMILY = "family",// 亲属
    FRIEND = "friend",// 朋友
    RIVAL = "rival",// 对手
    LOVER = "lover",// 恋人
    MENTOR = "mentor",// 导师
    STUDENT = "student",// 学生
    ENEMY = "enemy",// 敌人
    ALLY = "ally",// 盟友
    SUBORDINATE = "subordinate",// 下属
    LEADER = "leader",// 领导
    CUSTOM = "custom"
}
/** 角色节点（图结构） */
export interface CharacterNode {
    id: string;
    characterId: string;
    name: string;
    role: CharacterRole;
    gender?: CharacterGender;
    age?: number;
    x?: number;
    y?: number;
    fixed?: boolean;
    color?: string;
    size?: number;
    icon?: string;
    borderColor?: string;
    borderWidth?: number;
    fontColor?: string;
    fontSize?: number;
    collapsed?: boolean;
    hidden?: boolean;
    appearance?: string;
    personality?: string;
    description?: string;
}
/** 角色关系边（图结构） */
export interface CharacterEdge {
    id: string;
    source: string;
    target: string;
    relationType: CharacterRelationType;
    relationLabel: string;
    description?: string;
    directed: boolean;
    bidirectional: boolean;
    color?: string;
    lineWidth?: number;
    lineStyle?: 'solid' | 'dashed' | 'dotted';
    labelPosition?: 'middle' | 'source' | 'target';
    hidden?: boolean;
    weight?: number;
}
/** 图表布局配置 */
export interface GraphLayoutConfig {
    type: 'force' | 'hierarchical' | 'circular' | 'fixed';
    force?: {
        repulsion?: number;
        attraction?: number;
        gravity?: number;
        friction?: number;
    };
    hierarchical?: {
        direction: 'LR' | 'RL' | 'TB' | 'BT';
        nodeSpacing?: number;
        levelSpacing?: number;
    };
    circular?: {
        radius?: number;
        startAngle?: number;
        endAngle?: number;
    };
}
/** 角色关系图 */
export interface CharacterGraph {
    id: string;
    projectId: string;
    name: string;
    description?: string;
    nodes: CharacterNode[];
    edges: CharacterEdge[];
    layout: GraphLayoutConfig;
    showLabels: boolean;
    showIcons: boolean;
    highlightOnHover: boolean;
    createdAt: number;
    updatedAt: number;
    version: number;
}
/** 角色关系图摘要（列表显示用） */
export interface CharacterGraphSummary {
    id: string;
    name: string;
    description?: string;
    nodeCount: number;
    edgeCount: number;
    updatedAt: number;
}
/** 创建角色关系图请求 */
export interface CreateCharacterGraphRequest {
    name: string;
    description?: string;
    layout?: GraphLayoutConfig;
}
/** 更新角色关系图请求 */
export interface UpdateCharacterGraphRequest {
    name?: string;
    description?: string;
    layout?: GraphLayoutConfig;
    showLabels?: boolean;
    showIcons?: boolean;
    highlightOnHover?: boolean;
}
/** 添加角色节点请求 */
export interface AddCharacterNodeRequest {
    characterId: string;
    x?: number;
    y?: number;
    color?: string;
    size?: number;
    icon?: string;
}
/** 更新角色节点请求 */
export interface UpdateCharacterNodeRequest {
    x?: number;
    y?: number;
    fixed?: boolean;
    color?: string;
    size?: number;
    icon?: string;
    borderColor?: string;
    borderWidth?: number;
    fontColor?: string;
    fontSize?: number;
    collapsed?: boolean;
    hidden?: boolean;
}
/** 添加角色关系边请求 */
export interface AddCharacterEdgeRequest {
    source: string;
    target: string;
    relationType: CharacterRelationType;
    relationLabel: string;
    directed?: boolean;
    bidirectional?: boolean;
    color?: string;
    lineWidth?: number;
    lineStyle?: 'solid' | 'dashed' | 'dotted';
    weight?: number;
}
/** 更新角色关系边请求 */
export interface UpdateCharacterEdgeRequest {
    relationType?: CharacterRelationType;
    relationLabel?: string;
    description?: string;
    directed?: boolean;
    bidirectional?: boolean;
    color?: string;
    lineWidth?: number;
    lineStyle?: 'solid' | 'dashed' | 'dotted';
    labelPosition?: 'middle' | 'source' | 'target';
    hidden?: boolean;
    weight?: number;
}
