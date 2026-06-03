/**
 * 枚举定义文件
 *
 * 使用 const 对象 + 类型定义替代 TypeScript 枚举，
 * 避免 Vite/esbuild 转译枚举时的兼容性问题。
 *
 * 值保持与原有字符串相同，确保 JSON 序列化/反序列化兼容。
 */

/** 项目类型 */
export const ProjectType = {
  NOVEL: 'novel',
  SHORT_STORY: 'short-story',
  SCRIPT: 'script'
} as const
export type ProjectType = (typeof ProjectType)[keyof typeof ProjectType]

/** 步骤输入模式 */
export const StepInputMode = {
  MANUAL: 'manual',
  AI: 'ai',
  ASSISTED: 'assisted'
} as const
export type StepInputMode = (typeof StepInputMode)[keyof typeof StepInputMode]

/** 章节状态 */
export const ChapterStatus = {
  DRAFT: 'draft',
  REVIEW: 'review',
  DONE: 'done'
} as const
export type ChapterStatus = (typeof ChapterStatus)[keyof typeof ChapterStatus]

/** 步骤状态 */
export const StepStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'completed',
  SKIPPED: 'skipped'
} as const
export type StepStatus = (typeof StepStatus)[keyof typeof StepStatus]

/** 角色定位 */
export const CharacterRole = {
  PROTAGONIST: 'protagonist',
  ANTAGONIST: 'antagonist',
  SUPPORTING: 'supporting',
  MINOR: 'minor'
} as const
export type CharacterRole = (typeof CharacterRole)[keyof typeof CharacterRole]

/** 角色性别 */
export const CharacterGender = {
  MALE: 'male',
  FEMALE: 'female',
  OTHER: 'other'
} as const
export type CharacterGender = (typeof CharacterGender)[keyof typeof CharacterGender]
