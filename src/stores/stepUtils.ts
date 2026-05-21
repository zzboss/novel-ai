/**
 * 创建流程步骤标识
 * 
 * 定义小说创作流程中的各个步骤类型。
 * 流程顺序：选择类型 → 灵感描述 → 世界观 → 角色 → 大纲 → 完成
 */
export type CreationStep =
  | 'type-select'   // 项目类型选择
  | 'idea'          // 灵感描述
  | 'world'         // 世界观设定
  | 'character'     // 角色设定
  | 'outline-1'     // 大纲创建
  | 'complete'      // 完成创建

/**
 * 创建流程步骤列表（按顺序）
 * 
 * 定义完整的创建流程步骤顺序。
 * 新用户引导流程严格按照此顺序执行。
 */
export const CREATION_STEPS: CreationStep[] = [
  'type-select',
  'idea',
  'world',
  'character',
  'outline-1',
  'complete'
]

/**
 * 步骤中文名称映射
 * 
 * 用于UI显示，将步骤标识转换为用户友好的中文名称。
 */
export const STEP_LABELS: Record<CreationStep, string> = {
  'type-select': '选择类型',
  'idea': '灵感描述',
  'world': '世界观',
  'character': '角色',
  'outline-1': '大纲',
  'complete': '完成创建'
}

/**
 * 获取步骤序号（从 1 开始）
 * @param step - 步骤标识
 * @returns 步骤在流程中的序号（1-based），如果步骤不存在返回 -1
 * 
 * @example
 * ```typescript
 * getStepIndex('idea') // 返回 2
 * getStepIndex('world') // 返回 3
 * ```
 */
export function getStepIndex(step: CreationStep): number {
  return CREATION_STEPS.indexOf(step) + 1
}

/**
 * 获取总步骤数
 * @returns 创建流程的总步骤数（包括类型选择和完成步骤）
 * 
 * @example
 * ```typescript
 * getTotalSteps() // 返回 6
 * ```
 */
export function getTotalSteps(): number {
  return CREATION_STEPS.length
}

/**
 * 获取下一步
 * @param current - 当前步骤
 * @returns 下一步骤标识，如果当前是最后一步则返回 null
 * 
 * @example
 * ```typescript
 * getNextStep('idea') // 返回 'world'
 * getNextStep('complete') // 返回 null
 * ```
 */
export function getNextStep(current: CreationStep): CreationStep | null {
  const index = CREATION_STEPS.indexOf(current)
  if (index === -1 || index === CREATION_STEPS.length - 1) return null
  return CREATION_STEPS[index + 1]
}

/**
 * 获取上一步
 * @param current - 当前步骤
 * @returns 上一步骤标识，如果当前是第一步则返回 null
 * 
 * @example
 * ```typescript
 * getPrevStep('world') // 返回 'idea'
 * getPrevStep('type-select') // 返回 null
 * ```
 */
export function getPrevStep(current: CreationStep): CreationStep | null {
  const index = CREATION_STEPS.indexOf(current)
  if (index <= 0) return null
  return CREATION_STEPS[index - 1]
}

/**
 * 步骤是否可以跳过
 * @param step - 步骤标识
 * @returns true表示可以跳过，false表示必须完成
 * 
 * 注意：'type-select'和'complete'步骤不能跳过。
 * 
 * @example
 * ```typescript
 * canSkipStep('idea') // 返回 true
 * canSkipStep('type-select') // 返回 false
 * ```
 */
export function canSkipStep(step: CreationStep): boolean {
  return !['type-select', 'complete'].includes(step)
}

/**
 * 步骤是否需要 AI 生成
 * @param step - 步骤标识
 * @returns true表示该步骤支持AI生成内容
 * 
 * 以下步步骤支持AI生成：'idea', 'world', 'character', 'outline-1'
 * 
 * @example
 * ```typescript
 * requiresAiGeneration('idea') // 返回 true
 * requiresAiGeneration('type-select') // 返回 false
 * ```
 */
export function requiresAiGeneration(step: CreationStep): boolean {
  return ['idea', 'world', 'character', 'outline-1'].includes(step)
}
