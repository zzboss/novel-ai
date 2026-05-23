/**
 * 角色档案层构建器（按需裁剪）
 */

import type { AgentInput } from '@/agents/types'
import type { ProjectState } from '@/stores/project'
import type { StoryState } from '@/schemas/storyState'
import { estimateTokensChinese, type TokenBudget } from '@/utils/tokenCounter'
import type { ContextBuildOptions } from '../types'

/**
 * 构建角色档案层
 */
export function buildCharacterProfilesLayer(
  input: AgentInput,
  project: ProjectState,
  storyState: StoryState | null,
  budget: TokenBudget,
  options: ContextBuildOptions
): string {
  const maxTokens = budget.characterProfiles
  let content = ''

  // 确定相关角色
  // 防御性检查：确保 characters 存在
  const safeCharacters = project.characters || []
  const relevantIds = getRelevantCharacterIds(input, project, storyState, options)
  const relevantChars = safeCharacters.filter(c =>
    relevantIds.size === 0 || relevantIds.has(c.id)
  )

  if (relevantChars.length === 0) return ''

  content += `# 角色档案\n`
  let currentTokens = estimateTokensChinese(content)

  for (const char of relevantChars) {
    let charProfile = `## ${char.name}（${getRoleText(char.role)}）\n`
    if (char.personality) charProfile += `性格：${char.personality}\n`
    if (char.motivation) charProfile += `动机：${char.motivation}\n`
    if (char.dialogueStyle) charProfile += `对话风格：${char.dialogueStyle}\n`

    // 从 StoryState 注入动态状态
    if (storyState?.characterStates[char.id]) {
      const cs = storyState.characterStates[char.id]
      charProfile += `当前位置：${cs.location}\n`
      charProfile += `身体状态：${cs.physicalState}\n`
      charProfile += `情绪：${cs.emotionalState}\n`
    }

    const profileTokens = estimateTokensChinese(charProfile)
    if (currentTokens + profileTokens > maxTokens) break

    content += charProfile
    currentTokens += profileTokens
  }

  return content
}

/**
 * 获取角色定位文本
 */
function getRoleText(role: string): string {
  switch (role) {
    case 'protagonist': return '主角'
    case 'antagonist': return '反派'
    case 'supporting': return '配角'
    default: return '龙套'
  }
}

/**
 * 获取相关角色ID集合
 */
function getRelevantCharacterIds(
  _input: AgentInput,
  project: ProjectState,
  storyState: StoryState | null,
  options: ContextBuildOptions
): Set<string> {
  const ids = new Set<string>()

  // 从意图中获取
  if (options.intent?.relevantCharacterIds) {
    for (const id of options.intent.relevantCharacterIds) {
      ids.add(id)
    }
    return ids
  }

  // 从 StoryState 获取最近出场的角色
  // 防御性检查：确保 characters 存在
  const characters = project.characters || []
  
  if (storyState) {
    for (const [charId, cs] of Object.entries(storyState.characterStates)) {
      // 主角始终包含
      const char = characters.find(c => c.id === charId)
      if (char?.role === 'protagonist') {
        ids.add(charId)
        continue
      }
      // 最近出场过
      if (cs.lastAppearance) {
        ids.add(charId)
      }
    }
  } else {
    // 无 StoryState 时包含所有主角
    // 防御性检查：确保 characters 存在
    for (const char of (project.characters || [])) {
      if (char.role === 'protagonist') {
        ids.add(char.id)
      }
    }
  }

  return ids
}
