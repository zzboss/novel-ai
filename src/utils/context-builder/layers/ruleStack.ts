/**
 * 规则栈构建器
 */

import type { ProjectState } from '@/stores/project'
import type { RuleStack } from '../types'

/**
 * 编译规则栈
 */
export function compileRuleStack(project: ProjectState): RuleStack {
  return {
    worldRules: project.worldSettings.rules
      ? [project.worldSettings.rules]
      : [],
    genreRules: project.worldSettings.genre
      ? [`类型规则：${project.worldSettings.genre}`]
      : [],
    customRules: project.globalStyle
      ? [`风格约束：${project.globalStyle}`]
      : []
  }
}
