/**
 * 意图编译器（IntentCompiler）
 *
 * 管线 Step 1：意图编译（不调 LLM）
 * 输入：大纲章概要 + 当前 StoryState + 用户修改意图
 * 输出：章节意图书（必须包含/必须避免/冲突策略）
 *
 * 设计原则：
 * - 纯程序化，不消耗 Token
 * - 基于大纲结构和 StoryState 推导章节意图
 * - 支持用户手动覆盖/补充
 */

import type { ProjectState } from '@/stores/project'
import type { StoryState } from '@/schemas/storyState'

/** 章节意图书 */
export interface ChapterIntent {
  /** 章节ID */
  chapterId: string
  /** 章节标题 */
  chapterTitle: string
  /** 创作目标 */
  creativeGoal: string
  /** 必须包含的元素 */
  mustInclude: string[]
  /** 必须避免的元素 */
  mustAvoid: string[]
  /** 冲突策略 */
  conflictStrategy: string
  /** 相关角色ID列表 */
  relevantCharacterIds: string[]
  /** 相关伏笔ID列表 */
  relevantHookIds: string[]
  /** 目标字数 */
  targetWordCount: number
  /** 前情提要（由系统自动生成） */
  previousRecap: string
}

/** 意图编译选项 */
export interface IntentCompileOptions {
  /** 用户补充的修改意图 */
  userIntent?: string
  /** 目标字数覆盖 */
  targetWordCount?: number
  /** 是否包含前情提要 */
  includeRecap?: boolean
}

/**
 * 编译章节意图
 *
 * 根据大纲概要、StoryState 和用户意图，生成结构化的章节意图书。
 * 纯程序化操作，不调 LLM。
 *
 * @param chapterId - 章节ID
 * @param project - 项目状态
 * @param storyState - StoryState（可选，若无则仅用大纲信息）
 * @param options - 编译选项
 * @returns 章节意图书
 */
export function compileChapterIntent(
  chapterId: string,
  project: ProjectState,
  storyState: StoryState | null,
  options: IntentCompileOptions = {}
): ChapterIntent {
  // 1. 查找章节信息
  let chapterTitle = ''
  let volumeTitle = ''

  // 防御性检查：确保 volumes 存在
  const volumes = project.volumes || []
  for (const vol of volumes) {
    // 防御性检查：确保 chapters 存在
    const chapters = vol.chapters || []
    const chIdx = chapters.findIndex(c => c.id === chapterId)
    if (chIdx !== -1) {
      const chapter = chapters[chIdx]
      chapterTitle = chapter.title
      volumeTitle = vol.title
      break
    }
  }

  // 2. 从大纲推导创作目标
  const creativeGoal = deriveCreativeGoal(chapterTitle, volumeTitle, project.idea, options.userIntent)

  // 3. 从 StoryState 推导必须包含/避免
  const { mustInclude, mustAvoid, relevantCharacterIds, relevantHookIds } =
    deriveConstraintsFromStoryState(chapterId, project, storyState)

  // 4. 推导冲突策略
  const conflictStrategy = deriveConflictStrategy(storyState)

  // 5. 生成前情提要
  const previousRecap = options.includeRecap !== false
    ? generatePreviousRecap(chapterId, project, storyState)
    : ''

  // 6. 确定目标字数
  const targetWordCount = options.targetWordCount || 3000

  return {
    chapterId,
    chapterTitle,
    creativeGoal,
    mustInclude,
    mustAvoid,
    conflictStrategy,
    relevantCharacterIds,
    relevantHookIds,
    targetWordCount,
    previousRecap
  }
}

/**
 * 从大纲和项目信息推导创作目标
 */
function deriveCreativeGoal(
  chapterTitle: string,
  volumeTitle: string,
  idea: string | undefined,
  userIntent?: string
): string {
  const parts: string[] = []

  if (volumeTitle) {
    parts.push(`当前位于「${volumeTitle}」`)
  }
  if (chapterTitle) {
    parts.push(`本章标题「${chapterTitle}」`)
  }
  if (idea) {
    parts.push(`创作核心：${idea.substring(0, 100)}`)
  }
  if (userIntent) {
    parts.push(`用户意图：${userIntent}`)
  }

  return parts.join('；') || '按照大纲推进剧情'
}

/**
 * 从 StoryState 推导约束条件
 */
function deriveConstraintsFromStoryState(
  _chapterId: string,
  project: ProjectState,
  storyState: StoryState | null
): {
  mustInclude: string[]
  mustAvoid: string[]
  relevantCharacterIds: string[]
  relevantHookIds: string[]
} {
  const mustInclude: string[] = []
  const mustAvoid: string[] = []
  const relevantCharacterIds: string[] = []
  const relevantHookIds: string[] = []

  if (!storyState) {
    // 无 StoryState 时，从角色列表推导
    // 防御性检查：确保 characters 存在
    const characters = project.characters || []
    for (const char of characters) {
      if (char.role === 'protagonist') {
        relevantCharacterIds.push(char.id)
        mustInclude.push(`主角${char.name}出场`)
      }
    }
    return { mustInclude, mustAvoid, relevantCharacterIds, relevantHookIds }
  }

  // 1. 识别相关角色：最后出场在附近章节或主要角色
  // 防御性检查：确保 characters 存在
  const characters = project.characters || []
  for (const [charId, charState] of Object.entries(storyState.characterStates)) {
    const char = characters.find(c => c.id === charId)
    if (!char) continue

    // 主角始终相关
    if (char.role === 'protagonist') {
      relevantCharacterIds.push(charId)
      mustInclude.push(`${charState.name}出场，当前位置：${charState.location}，状态：${charState.physicalState}`)
      continue
    }

    // 最近出场过的角色也相关
    if (charState.lastAppearance) {
      relevantCharacterIds.push(charId)
    }
  }

  // 2. 识别相关伏笔：未闭合的高紧迫度伏笔
  for (const hook of storyState.pendingHooks) {
    if (hook.status === 'resolved') continue

    relevantHookIds.push(hook.id)

    if (hook.urgency === 'high') {
      mustInclude.push(`推进伏笔「${hook.description}」`)
    }

    // 如果伏笔的相关角色与本章角色有交集，也标记为相关
    const hasCharOverlap = hook.relatedCharacters.some(rc =>
      relevantCharacterIds.includes(rc)
    )
    if (hasCharOverlap && hook.urgency !== 'low') {
      mustInclude.push(`伏笔「${hook.description.substring(0, 30)}」可能需要推进`)
    }
  }

  // 3. 推导必须避免
  for (const [_charId, charState] of Object.entries(storyState.characterStates)) {
    // 避免角色瞬移
    if (charState.location && charState.location !== '未知') {
      mustAvoid.push(`${charState.name}不应从${charState.location}瞬移到远处`)
    }
    // 避免角色使用不该知道的信息
    if (charState.knowledge.length > 0) {
      mustAvoid.push(`${charState.name}不应知道其知识范围外的事件（知识边界）`)
    }
  }

  // 4. 避免已回收伏笔再次出现
  const resolvedHooks = storyState.pendingHooks.filter(h => h.status === 'resolved')
  for (const hook of resolvedHooks) {
    mustAvoid.push(`伏笔「${hook.description.substring(0, 30)}」已回收，不应再次埋设`)
  }

  return { mustInclude, mustAvoid, relevantCharacterIds, relevantHookIds }
}

/**
 * 推导冲突策略
 */
function deriveConflictStrategy(storyState: StoryState | null): string {
  if (!storyState) return '推进主线剧情发展'

  const conflicts = storyState.worldState.activeConflicts
  if (conflicts.length === 0) return '维持当前剧情节奏'

  return `当前活跃冲突：${conflicts.join('、')}。应在章节中推进或深化冲突`
}

/**
 * 生成前情提要
 *
 * 规则：
 * - 注入前 3 章摘要
 * - 注入上一章末尾 500 字
 */
function generatePreviousRecap(
  chapterId: string,
  project: ProjectState,
  storyState: StoryState | null
): string {
  if (!storyState || storyState.chapterSummaries.length === 0) {
    return ''
  }

  // 找到当前章节在项目中的位置
  let currentChapterIndex = -1
  const allChapters: Array<{ id: string; title: string }> = []
  for (const vol of project.volumes) {
    for (const ch of vol.chapters) {
      allChapters.push({ id: ch.id, title: ch.title })
      if (ch.id === chapterId) {
        currentChapterIndex = allChapters.length - 1
      }
    }
  }

  if (currentChapterIndex <= 0) return ''

  // 取前3章摘要
  const startIdx = Math.max(0, currentChapterIndex - 3)
  const previousSummaries = storyState.chapterSummaries.filter(s => {
    const idx = allChapters.findIndex(c => c.id === s.chapterId)
    return idx >= startIdx && idx < currentChapterIndex
  })

  if (previousSummaries.length === 0) return ''

  const parts: string[] = ['【前情提要】']
  for (const summary of previousSummaries) {
    const ch = allChapters.find(c => c.id === summary.chapterId)
    parts.push(`「${ch?.title || '未知'}」：${summary.summary}`)
  }

  return parts.join('\n')
}
