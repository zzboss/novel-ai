/**
 * LLM 统一响应格式类型定义
 * 
 * 所有 Agent 的 LLM 调用都应返回此格式
 * 目的是统一数据格式，方便记录真相和追踪状态
 */

/**
 * 响应元数据 - 记录 LLM 调用的详细信息
 */
export interface ResponseMetadata {
  /** 响应生成时间戳（毫秒） */
  timestamp: number
  
  /** Token 使用情况 */
  tokenUsage?: TokenUsage
  
  /** 使用的模型名称 */
  model?: string
  
  /** 模型提供商（openai、anthropic、ollama 等） */
  provider?: string
  
  /** 处理耗时（毫秒） */
  processingTime?: number
  
  /** 质量评分（可选，0-100） */
  quality?: QualityScore
  
  /** 自定义元数据（各 Agent 可扩展） */
  [key: string]: any
}

/**
 * Token 使用情况
 */
export interface TokenUsage {
  /** 输入 token 数量 */
  promptTokens: number
  
  /** 输出 token 数量 */
  completionTokens: number
  
  /** 总 token 数量 */
  totalTokens: number
}

/**
 * 质量评分
 */
export interface QualityScore {
  /** 评分（0-100） */
  score: number
  
  /** 评分原因 */
  reason?: string
}

/**
 * 基础 LLM 响应格式
 * 所有 Agent 的响应都必须遵循此格式
 */
export interface BaseLLMResponse<T = any> {
  /** 是否成功 */
  success: boolean
  
  /** 业务数据（根据 Agent 类型不同） */
  data: T
  
  /** 错误信息（当 success=false 时） */
  message?: string
  
  /** 响应元数据 */
  metadata?: ResponseMetadata
}

/**
 * 章节生成响应数据
 */
export interface ChapterResponseData {
  /** 正文内容 */
  content: string
  
  /** 章节信息 */
  chapterInfo: ChapterInfo
  
  /** 元数据（由第二步提取） */
  metadata: ChapterMetadata
}

/**
 * 章节信息
 */
export interface ChapterInfo {
  /** 章节标题 */
  title: string
  
  /** 章节摘要（200字以内） */
  summary: string
  
  /** 字数统计 */
  wordCount: number
}

/**
 * 章节元数据
 */
export interface ChapterMetadata {
  /** 出现的角色 */
  characters: string[]
  
  /** 出现的地点 */
  locations: string[]
  
  /** 发生的关键事件 */
  events: string[]
  
  /** 情感变化 */
  emotions: string[]
  
  /** 伏笔 */
  foreshadowing: string[]
  
  /** 感官细节（第二步提取） */
  sensoryDetails?: {
    visual: string[]
    auditory: string[]
    olfactory: string[]
    tactile: string[]
    taste: string[]
  }
  
  /** 张力曲线（第二步提取） */
  tensionCurve?: Array<{
    position: string
    score: number
    description: string
  }>
  
  /** 角色状态变化（第二步提取） */
  characterStates?: Array<{
    characterId: string
    name: string
    stateChanges: string
    emotion: string
  }>
}

/**
 * 角色管理响应数据
 */
export interface CharacterResponseData {
  /** 角色信息 */
  character: CharacterInfo
}

/**
 * 角色信息
 */
export interface CharacterInfo {
  /** 角色 ID */
  id: string
  
  /** 角色名称 */
  name: string
  
  /** 别名 */
  alias?: string[]
  
  /** 性别 */
  gender?: 'male' | 'female' | 'unknown'
  
  /** 年龄 */
  age?: number
  
  /** 性格特征 */
  personality: string[]
  
  /** 外貌描述 */
  appearance: string
  
  /** 背景故事 */
  background: string
  
  /** 人际关系 */
  relationships: CharacterRelationship[]
  
  /** 目标 */
  goals: string[]
  
  /** 冲突 */
  conflicts: string[]
  
  /** 角色弧光 */
  arc: string
}

/**
 * 角色关系
 */
export interface CharacterRelationship {
  /** 相关角色 ID */
  characterId: string
  
  /** 相关角色名称 */
  characterName: string
  
  /** 关系类型 */
  relationType: string
  
  /** 关系描述 */
  description: string
}

/**
 * 大纲管理响应数据
 */
export interface OutlineResponseData {
  /** 大纲信息 */
  outline: OutlineInfo
}

/**
 * 大纲信息
 */
export interface OutlineInfo {
  /** 大纲 ID */
  id: string
  
  /** 大纲标题 */
  title: string
  
  /** 大纲摘要 */
  summary: string
  
  /** 结构类型 */
  structure: 'linear' | 'branching' | 'multi-threaded'
  
  /** 故事弧 */
  arcs: OutlineArc[]
  
  /** 章节列表 */
  chapters: OutlineChapter[]
}

/**
 * 故事弧
 */
export interface OutlineArc {
  /** 弧 ID */
  id: string
  
  /** 弧名称 */
  name: string
  
  /** 弧描述 */
  description: string
  
  /** 包含的章节 ID */
  chapters: string[]
}

/**
 * 大纲章节
 */
export interface OutlineChapter {
  /** 章节 ID */
  id: string
  
  /** 章节编号 */
  number: number
  
  /** 章节标题 */
  title: string
  
  /** 章节摘要 */
  summary: string
  
  /** 关键事件 */
  keyEvents: string[]
}

/**
 * 世界观信息
 */
export interface WorldInfo {
  /** 世界观 ID */
  id: string
  
  /** 世界观名称 */
  name: string
  
  /** 描述 */
  description: string
  
  /** 历史 */
  history: string
  
  /** 地理 */
  geography: string
  
  /** 文化 */
  culture: string
  
  /** 魔法系统（可选） */
  magicSystem?: string
  
  /** 科技水平（可选） */
  technologyLevel?: string
  
  /** 派系 */
  factions: WorldFaction[]
}

/**
 * 世界观派系
 */
export interface WorldFaction {
  /** 派系 ID */
  id: string
  
  /** 派系名称 */
  name: string
  
  /** 派系类型 */
  type: 'political' | 'religious' | 'economic' | 'other'
  
  /** 派系描述 */
  description: string
}

/**
 * 总结响应数据
 */
export interface SummaryResponseData {
  /** 总结内容 */
  summary: string
  
  /** 关键点（别名：keyEvents） */
  keyPoints: string[]
  
  /** 关键事件（与 keyPoints 相同） */
  keyEvents?: string[]
  
  /** 角色变化 */
  characterChanges?: Record<string, string>
  
  /** 情感倾向 */
  sentiment: 'positive' | 'neutral' | 'negative'
}

/**
 * 一致性检查响应数据
 */
export interface ConsistencyResponseData {
  /** 问题列表 */
  issues: ConsistencyIssue[]
  
  /** 一致性评分（0-100） */
  score: number
}

/**
 * 状态提取响应数据
 */
export interface StateExtractorResponseData {
  /** 角色状态变化 */
  characterStates: Record<string, any>
  
  /** 资源更新 */
  resourceUpdates: Record<string, { action: 'add' | 'update' | 'remove'; data: any }>
  
  /** 伏笔更新 */
  hookUpdates: Array<{ action: 'add' | 'update' | 'resolve'; data: any }>
  
  /** 章节摘要 */
  chapterSummary: Record<string, any>
}

/**
 * 对话优化响应数据
 */
export interface DialogueResponseData {
  /** 优化后的对话段落 */
  optimizedDialogue: string
  
  /** 修改点列表 */
  changes: string[]
  
  /** 角色分析 */
  characterAnalysis: Record<string, string>
}

/**
 * 润色优化响应数据
 */
export interface PolishResponseData {
  /** 润色后的完整文本 */
  polishedText: string
  
  /** 修改点列表 */
  changes: string[]
  
  /** 修改数量 */
  changeCount: number
}

/**
 * 续写响应数据
 */
export interface ContinueResponseData {
  /** 续写内容 */
  continuedText: string
  
  /** 字数统计 */
  wordCount: number
  
  /** 续写分析 */
  analysis: {
    styleMatch: string
    plotAdvancement: string
    emotionContinuity?: string
  }
}

/**
 * 世界观构建响应数据
 */
export interface WorldResponseData {
  /** 世界观设定（Markdown 格式） */
  worldSetting: string
  
  /** 关键元素 */
  keyElements: {
    powerSystems: string[]
    factions: string[]
    locations: string[]
    historicalEvents: string[]
  }
  
  /** 分析 */
  analysis: {
    ruleConsistency: string
    tensionLevel: string
  }
}

/**
 * 创意激发响应数据
 */
export interface IdeaResponseData {
  /** 故事概念数组 */
  ideas: Array<{
    conceptName: string
    corePremise: string
    protagonistDirection: string
    coreConflict: string
    uniqueSellingPoint: string
    endingDirection: string
  }>
}

/**
 * 场景扩写响应数据
 */
export interface SceneResponseData {
  /** 扩写后的场景正文 */
  sceneText: string
  
  /** 感官细节 */
  sensoryDetails: {
    visual: string[]
    auditory: string[]
    olfactory: string[]
    tactile: string[]
    taste: string[]
  }
  
  /** 场景的情绪氛围 */
  mood: string
  
  /** 细节锚点 */
  anchoringDetails: string[]
}

/**
 * 降 AI 味响应数据
 */
export interface AntiAIResponseData {
  /** AI 检测报告 */
  aiDetectionReport: {
    wordCount: number
    issueCount: number
    highRiskCount: number
    mediumRiskCount: number
    lowRiskCount: number
    highRiskIssues: Array<{
      issueNumber: number
      type: string
      originalText: string
      problem: string
      suggestion: string
    }>
    mediumRiskIssues: any[]
    lowRiskIssues: any[]
  }
  
  /** 改写后的文本 */
  rewrittenText: string
}

/**
 * 情感曲线响应数据
 */
export interface EmotionResponseData {
  /** 工作模式 */
  mode: 'single_chapter' | 'full_book' | 'diagnosis'
  
  /** 单章分析数据（mode = 'single_chapter'） */
  chapterAnalysis?: {
    chapterId: string
    chapterTitle: string
    emotionCurve: Array<{
      position: string
      score: number
      emotion: string
      keywords: string[]
    }>
    turningPoints: string[]
    overallScore: number
    overallEmotion: string
  }
  
  /** 全书情感曲线数据（mode = 'full_book'） */
  bookEmotionCurve?: Array<{
    chapterNumber: number
    chapterTitle: string
    score: number
    dominantEmotion: string
    keywords: string[]
  }>
  
  /** 问题诊断数据（mode = 'diagnosis'） */
  problems?: Array<{
    type: string
    description: string
    chapters: string
    suggestion: string
  }>
  
  /** 优化建议（mode = 'diagnosis'） */
  optimizationSuggestions?: string
}

/**
 * 伏笔管理响应数据
 */
export interface ForeshadowResponseData {
  /** 工作模式 */
  mode: 'scan' | 'status' | 'remind' | 'resolve'
  
  /** 提取的伏笔列表（mode = 'scan'） */
  foreshadows?: Array<{
    description: string
    type: string
    urgency: string
    relatedCharacters: string[]
    expectedResolve: string
    evidence: string
  }>
  
  /** 状态摘要（mode = 'status'） */
  summary?: {
    total: number
    open: number
    progressing: number
    resolved: number
    overdue: number
  }
  
  /** 待回收伏笔（mode = 'status'） */
  openHooks?: any[]
  
  /** 推进中的伏笔（mode = 'status'） */
  progressingHooks?: any[]
  
  /** 已回收伏笔（mode = 'status'） */
  resolvedHooks?: any[]
  
  /** 提醒列表（mode = 'remind'） */
  reminders?: Array<{
    hookId: string
    description: string
    urgency: string
    suggestion: string
  }>
  
  /** 伏笔描述（mode = 'resolve'） */
  hookDescription?: string
  
  /** 回收方案（mode = 'resolve'） */
  resolutionPlans?: Array<{
    planNumber: number
    style: string
    description: string
    expectedEffect: string
  }>
}

/**
 * 命名工厂响应数据
 */
export interface NameResponseData {
  /** 命名类型 */
  nameType: string
  
  /** 风格偏好 */
  style: string
  
  /** 候选名称列表 */
  candidates: Array<{
    /** 名称 */
    name: string
    /** 拼音 */
    pinyin: string
    /** 寓意说明 */
    meaning: string
    /** 给人的感觉或适合的角色类型 */
    impression: string
  }>
}

/**
 * 节奏把控响应数据
 */
export interface PacingResponseData {
  /** 章节标题 */
  chapter: string
  
  /** 字数 */
  wordCount: number
  
  /** 节奏分析 */
  rhythmAnalysis: {
    /** 信息密度 */
    informationDensity: {
      status: string
      score: number
      analysis: string
    }
    /** 场景切换 */
    sceneSwitching: {
      status: string
      score: number
      analysis: string
    }
    /** 对话/描写比例 */
    dialogueDescriptionRatio: {
      dialoguePercentage: number
      descriptionPercentage: number
      status: string
      score: number
      analysis: string
    }
    /** 动作/静态比例 */
    actionStaticRatio: {
      actionPercentage: number
      staticPercentage: number
      status: string
      score: number
      analysis: string
    }
    /** 张弛节奏 */
    tensionRhythm: {
      hasRhythm: boolean
      score: number
      analysis: string
    }
  }
  
  /** 节奏热力图 */
  rhythmHeatmap: {
    segments: number
    intensity: string[]
    problem: string
  }
  
  /** 优化建议 */
  optimizationSuggestions: Array<{
    paragraph: string
    suggestion: string
    reason: string
  }>
}

/**
 * 读者反馈响应数据
 */
export interface ReaderResponseData {
  /** 章节标题 */
  chapter: string
  
  /** 四类读者反馈 */
  readerFeedback: {
    /** 核心粉丝视角 */
    coreFan: {
      role: string
      tone: string
      feedback: string
      highlights: string[]
      complaints: string[]
    }
    /** 路人读者视角 */
    casualReader: {
      role: string
      tone: string
      feedback: string
      understanding: string
      continueDesire: string
    }
    /** 挑剔批评者视角 */
    critic: {
      role: string
      tone: string
      feedback: string
      issues: string[]
    }
    /** 类型粉视角 */
    genreFan: {
      role: string
      tone: string
      feedback: string
      emotionalMoments: string[]
    }
  }
  
  /** 综合建议 */
  synthesis: {
    summary: string
    topSuggestions: Array<{
      priority: string
      suggestion: string
      reason: string
    }>
  }
}

/**
 * 定点修复响应数据
 */
export interface ReviserResponseData {
  /** 修复后的完整章节正文 */
  revisedContent: string
  
  /** 修复的段落列表 */
  fixedParagraphs: Array<{
    /** 段落索引 */
    index: number
    /** 原文段落 */
    originalText: string
    /** 修复后的段落 */
    revisedText: string
    /** 修复原因 */
    reason: string
  }>
  
  /** 摘要 */
  summary: {
    /** 总问题数 */
    totalIssues: number
    /** 已修复问题数 */
    fixedIssues: number
    /** 未修改段落数 */
    unchangedParagraphs: number
    /** 整体评估 */
    overallAssessment: string
  }
}

/**
 * 修订响应数据
 */
export interface RevisionResponseData {
  /** 修复后的完整章节正文 */
  revisedContent: string
  
  /** 修复的问题列表 */
  fixedIssues: Array<{
    /** 问题索引 */
    issueIndex: number
    /** 问题维度 */
    dimension: string
    /** 原文段落 */
    originalText: string
    /** 修复后的段落 */
    revisedText: string
    /** 修复原因 */
    reason: string
  }>
  
  /** 摘要 */
  summary: {
    /** 总问题数 */
    totalIssues: number
    /** 已修复问题数 */
    fixedIssuesCount: number
    /** 保留内容比例 */
    preservedContent: string
    /** 整体评估 */
    overallAssessment: string
  }
}

/**
 * 一致性问题
 */
export interface ConsistencyIssue {
  /** 问题类型 */
  type: 'character' | 'plot' | 'world' | 'timeline'
  
  /** 严重级别 */
  severity: 'low' | 'medium' | 'high'
  
  /** 问题描述 */
  description: string
  
  /** 建议修复方案 */
  suggestion: string
}

/**
 * 类型守卫：检查是否为有效的 LLM 响应
 */
export function isValidLLMResponse(obj: any): obj is BaseLLMResponse {
  return (
    obj &&
    typeof obj.success === 'boolean' &&
    'data' in obj
  )
}

/**
 * 类型守卫：检查 LLM 响应是否成功
 */
export function isSuccessResponse(obj: any): obj is BaseLLMResponse & { success: true } {
  return isValidLLMResponse(obj) && obj.success === true
}

/**
 * 类型守卫：检查 LLM 响应是否失败
 */
export function isErrorResponse(obj: any): obj is BaseLLMResponse & { success: false } {
  return isValidLLMResponse(obj) && obj.success === false
}
