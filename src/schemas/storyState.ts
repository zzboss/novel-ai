/**
 * StoryState — 结构化状态管理
 *
 * 借鉴 InkOS 的 7 个真相文件，定义 AIWT 的结构化状态。
 * 所有事实存储在 StoryState 中，不依赖 LLM 记忆。
 *
 * 与 ProjectState 的关系：
 * - worldSettings/characters/outline 是静态设定（创建流程中确定）
 * - storyState 是动态状态（随章节生成自动更新）
 * - storyState 是静态设定的运行时投影
 */
import { z } from 'zod'

// ==================== Zod Schema 定义 ====================

/** 世界当前状态 */
export const WorldStateSchema = z.object({
  currentTimeline: z.string().describe('当前时间线描述'),
  activeConflicts: z.array(z.string()).default([]).describe('活跃冲突'),
  globalMood: z.string().default('').describe('全局氛围'),
  lastUpdatedChapter: z.string().default('').describe('最后更新章节ID')
})
export type WorldState = z.infer<typeof WorldStateSchema>

/** 角色状态 */
export const CharacterStateSchema = z.object({
  name: z.string().describe('角色名'),
  location: z.string().default('未知').describe('当前位置'),
  knowledge: z.array(z.string()).default([]).describe('角色已知信息（信息隔离）'),
  inventory: z.array(z.string()).default([]).describe('持有物品'),
  relationships: z.record(z.number()).default({}).describe('与其他角色关系值(-10~+10)'),
  physicalState: z.string().default('健康').describe('身体状态'),
  emotionalState: z.string().default('平静').describe('情绪状态'),
  lastAppearance: z.string().default('').describe('最后出场章节ID')
})
export type CharacterState = z.infer<typeof CharacterStateSchema>

/** 资源台账条目 */
export const ResourceLedgerEntrySchema = z.object({
  description: z.string().describe('物品描述'),
  owner: z.string().default('').describe('持有者'),
  status: z.enum(['active', 'consumed', 'lost', 'transferred']).default('active'),
  lastMentioned: z.string().default('').describe('最后提及章节ID')
})
export type ResourceLedgerEntry = z.infer<typeof ResourceLedgerEntrySchema>

/** 伏笔追踪条目 */
export const PendingHookSchema = z.object({
  id: z.string().describe('伏笔ID'),
  description: z.string().describe('伏笔描述'),
  plantedChapter: z.string().describe('埋下章节ID'),
  relatedCharacters: z.array(z.string()).default([]).describe('相关角色'),
  status: z.enum(['open', 'progressing', 'resolved']).default('open'),
  resolution: z.string().optional().describe('回收方式'),
  resolvedChapter: z.string().optional().describe('回收章节ID'),
  urgency: z.enum(['low', 'medium', 'high']).default('medium').describe('紧迫度')
})
export type PendingHook = z.infer<typeof PendingHookSchema>

/** 章节摘要 */
export const ChapterSummarySchema = z.object({
  chapterId: z.string().describe('章节ID'),
  summary: z.string().describe('200字摘要'),
  keyEvents: z.array(z.string()).default([]).describe('关键事件'),
  characterChanges: z.record(z.string()).default({}).describe('角色状态变更'),
  newHooks: z.array(z.string()).default([]).describe('新埋伏笔ID'),
  resolvedHooks: z.array(z.string()).default([]).describe('已回收伏笔ID'),
  wordCount: z.number().default(0).describe('字数')
})
export type ChapterSummary = z.infer<typeof ChapterSummarySchema>

/** 情感弧线轨迹点 */
export const EmotionTrajectoryPointSchema = z.object({
  chapterId: z.string().describe('章节ID'),
  emotion: z.string().describe('情感'),
  intensity: z.number().min(1).max(10).describe('强度1-10')
})
export type EmotionTrajectoryPoint = z.infer<typeof EmotionTrajectoryPointSchema>

/** 角色矩阵条目（信息边界） */
export const CharacterMatrixEntrySchema = z.object({
  hasMet: z.boolean().default(false).describe('是否相遇'),
  sharedKnowledge: z.array(z.string()).default([]).describe('共享信息'),
  lastInteraction: z.string().default('').describe('最后互动章节ID')
})
export type CharacterMatrixEntry = z.infer<typeof CharacterMatrixEntrySchema>

// ==================== StoryState 主 Schema ====================

/**
 * StoryState 完整数据模型
 *
 * 映射 InkOS 的 7 个真相文件：
 * - worldState         ← current_state.json
 * - characterStates     ← character_matrix.json (部分)
 * - resourceLedger      ← particle_ledger.json
 * - pendingHooks        ← pending_hooks.json
 * - chapterSummaries    ← chapter_summaries.json
 * - emotionalArcs       ← emotional_arcs.json
 * - characterMatrix     ← character_matrix.json (信息边界)
 */
export const StoryStateSchema = z.object({
  /** 世界当前状态 */
  worldState: WorldStateSchema,

  /** 角色状态追踪（角色ID → 状态） */
  characterStates: z.record(CharacterStateSchema).default({}),

  /** 资源台账（物品ID → 条目） */
  resourceLedger: z.record(ResourceLedgerEntrySchema).default({}),

  /** 伏笔追踪 */
  pendingHooks: z.array(PendingHookSchema).default([]),

  /** 章节摘要 */
  chapterSummaries: z.array(ChapterSummarySchema).default([]),

  /** 情感弧线（角色ID → 轨迹） */
  emotionalArcs: z.record(
    z.object({
      trajectory: z.array(EmotionTrajectoryPointSchema).default([])
    })
  ).default({}),

  /** 角色矩阵/信息边界（角色A ID → 角色B ID → 条目） */
  characterMatrix: z.record(z.record(CharacterMatrixEntrySchema)).default({})
})
export type StoryState = z.infer<typeof StoryStateSchema>

// ==================== 辅助函数 ====================

/**
 * 创建空的 StoryState
 */
export function createEmptyStoryState(): StoryState {
  return {
    worldState: {
      currentTimeline: '',
      activeConflicts: [],
      globalMood: '',
      lastUpdatedChapter: ''
    },
    characterStates: {},
    resourceLedger: {},
    pendingHooks: [],
    chapterSummaries: [],
    emotionalArcs: {},
    characterMatrix: {}
  }
}

/**
 * 校验 StoryState 是否合法
 * @returns 校验结果，包含成功/失败和错误信息
 */
export function validateStoryState(data: unknown): {
  success: boolean
  data?: StoryState
  errors?: z.ZodError
} {
  const result = StoryStateSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, errors: result.error }
}

/**
 * 从角色档案列表初始化 StoryState 的 characterStates
 */
export function initCharacterStatesFromProfiles(
  characters: Array<{ id: string; name: string }>
): Record<string, CharacterState> {
  const states: Record<string, CharacterState> = {}
  for (const char of characters) {
    states[char.id] = {
      name: char.name,
      location: '未知',
      knowledge: [],
      inventory: [],
      relationships: {},
      physicalState: '健康',
      emotionalState: '平静',
      lastAppearance: ''
    }
  }
  return states
}
