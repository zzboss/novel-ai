// 导入类型定义
import type { ProjectState } from '@/stores/project'
import type { SkillManifest } from '@/skills/types'

// 延迟导入 SettingsState 以避免循环依赖（仅用于类型注解）
type SettingsStateType = import('@/stores/settings').SettingsState

/**
 * Agent 类型枚举
 * 
 * 分类说明：
 * - 前期构建组：创意、世界观、角色、大纲
 * - 写作执行组：章节写作、续写、对话、润色
 * - 质量保障组：一致性、伏笔、降 AI 味、节奏、情感
 * - 写作辅助组：场景扩写、命名、读者反馈
 */
export type AgentType =
  // 前期构建组
  | 'idea'
  | 'world'
  | 'character'
  | 'outline'
  // 写作执行组
  | 'chapter'
  | 'continue'
  | 'dialogue'
  | 'polish'
  // 质量保障组
  | 'consistency'
  | 'foreshadow'
  | 'anti_ai'
  | 'pacing'
  | 'emotion'
  // 写作辅助组
  | 'scene'
  | 'name'
  | 'reader'
  // ★ 管线新增 Agent（Phase 2）
  | 'state_extractor'   // 状态提取 Agent
  | 'summary'           // 摘要生成 Agent
  | 'reviser'           // 定点修复 Agent

/**
 * Agent 输入（Tagged Union 模式）
 * 
 * 设计说明：
 * - 使用 Tagged Union 模式，通过 type 字段区分不同类型的输入
 * - 每种输入类型包含该 Agent 所需的特定参数
 * - 新增 Agent 时只需在此处添加新的联合类型成员
 * 
 * 类型分类：
 * - idea: 创意激发，需要提示词和可选的类型
 * - world: 世界观构建，需要提示词和可选的项目上下文
 * - character: 角色设计，需要提示词和可选的关系描述
 * - outline: 大纲规划，需要提示词和可选的卷数
 * - chapter: 章节写作，需要章节 ID、大纲和可选的目标字数
 * - continue: 续写，需要章节 ID 和光标位置
 * - polish: 润色，需要内容和可选的风格/强度参数
 * - dialogue: 对话优化，需要内容和可选的角色列表
 * - consistency: 一致性检查，需要章节 ID 和可选的全文
 * - foreshadow: 伏笔管理，需要章节 ID 和模式（扫描/解决/提醒）
 * - anti_ai: 降 AI 味，需要内容和可选的级别
 * - pacing: 节奏把控，需要章节 ID 和可选的目标节奏
 * - emotion: 情感曲线，需要章节 ID 和可选的情感弧线类型
 * - scene: 场景扩写，需要提示词和可选的地点
 * - name: 命名工厂，需要命名类型和可选的数量/风格
 * - reader: 读者反馈，需要章节 ID 和可选的视角
 */
export type AgentInput =
  | { type: 'idea'; prompt: string; genre?: string }
  | { type: 'world'; prompt: string; projectContext?: string }
  | { type: 'character'; prompt: string; relationships?: string }
  | { type: 'outline'; prompt: string; volumeCount?: number }
  | { type: 'chapter'; chapterId: string; outline: string; wordCount?: number }
  | { type: 'continue'; chapterId: string; cursorPosition: number }
  | { type: 'polish'; content: string; options?: { style?: string; intensity?: number } }
  | { type: 'dialogue'; content: string; characters?: string[] }
  | { type: 'consistency'; chapterId: string; fullText?: string }
  | { type: 'foreshadow'; chapterId: string; mode: 'scan' | 'resolve' | 'remind' | 'status' }
  | { type: 'anti_ai'; content: string; level?: number }
  | { type: 'pacing'; chapterId: string; targetPace?: string }
  | { type: 'emotion'; chapterId: string; arcType?: string }
  | { type: 'scene'; prompt: string; location?: string }
  | { type: 'name'; nameType: string; count?: number; style?: string; meaningDirection?: string }
  | { type: 'reader'; chapterId: string; perspective?: string }
  // ★ 管线新增 Agent 输入
  | { type: 'state_extractor'; chapterId: string; chapterContent: string }
  | { type: 'summary'; chapterId: string; chapterContent: string }
  | { type: 'reviser'; chapterId: string; content: string; auditIssues: Array<{ severity: string; description: string }> }

/**
 * Agent 输出
 */
export interface AgentOutput {
  /** 生成的内容 */
  content: string
  
  /** 额外的元数据（可选） */
  metadata?: Record<string, unknown>
  
  /** 消耗的 Token 数（可选） */
  tokensUsed?: number
}

/**
 * Agent 执行上下文接口
 * 
 * 功能说明：
 * - 提供 Agent 执行时所需的全部上下文信息
 * - 包含项目状态、用户配置和已挂载的 Skill
 * 
 * 字段说明：
 * - project: 项目状态，包含世界观、角色、章节等信息
 * - config: 用户设置，包含模型配置、主题等
 * - mountedSkills: 当前已挂载的 Skill 清单
 */
export interface AgentContext {
  /** 项目状态 */
  project: ProjectState
  
  /** 用户设置 */
  config: SettingsStateType
  
  /** 已挂载的 Skill 清单 */
  mountedSkills: SkillManifest[]
}

/**
 * Agent 执行结果
 */
export interface AgentExecutionResult {
  /** 是否成功 */
  success: boolean
  
  /** 生成的内容（成功时） */
  content?: string
    
  /** 错误信息（失败时） */
  error?: string
    
  /** 消耗的 Token 数 */
  tokensUsed?: number
    
  /** 执行耗时（毫秒） */
  executionTime?: number
}

/**
 * 质量评估结果
 * 
 * 用于"生成-评估-重写"质量闭环
 */
export interface QualityEvaluation {
  /** 总分（0-100） */
  totalScore: number
  
  /** 是否通过阈值 */
  passed: boolean
  
  /** 各维度评分 */
  dimensions: Array<{
    name: string
    score: number  // 0-10
    weight: number  // 0-1
    issues?: Array<{
      severity: 'critical' | 'suggestion'
      description: string
      evidence?: string
    }>
  }>
  
  /** 关键问题列表（severity=critical） */
  criticalIssues: Array<{
    dimension: string
    description: string
    evidence?: string
  }>
  
  /** 建议性问题列表（severity=suggestion） */
  suggestionIssues: Array<{
    dimension: string
    description: string
  }>
}

/**
 * 质量闭环配置
 */
export interface QualityLoopConfig {
  /** 质量阈值（总分低于此分数触发重写） */
  scoreThreshold: number  // 建议 80 分
  
  /** 关键问题数量阈值（>0 触发重写） */
  criticalIssueThreshold: number  // 建议 0（零容忍）
  
  /** 最大重写次数 */
  maxRevisions: number  // 建议 3 次
  
  /** 是否启用质量闭环（用户可配置） */
  enabled: boolean
}
