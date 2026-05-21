/**
 * 枚举定义文件
 * 
 * 将所有字符串字面量类型改为 TypeScript 枚举，
 * 提升类型安全性和代码可维护性。
 * 
 * 枚举值保持与原有字符串相同，确保 JSON 序列化/反序列化兼容。
 */

/** 项目类型枚举 */
export enum ProjectType {
  NOVEL = 'novel',
  SHORT_STORY = 'short-story',
  SCRIPT = 'script'
}

/** 步骤输入模式枚举 */
export enum StepInputMode {
  MANUAL = 'manual',
  AI = 'ai',
  ASSISTED = 'assisted'
}

/** 章节状态枚举 */
export enum ChapterStatus {
  DRAFT = 'draft',
  REVIEW = 'review',
  DONE = 'done'
}

/** 步骤状态枚举 */
export enum StepStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  SKIPPED = 'skipped'
}

/** 角色定位枚举 */
export enum CharacterRole {
  PROTAGONIST = 'protagonist',
  ANTAGONIST = 'antagonist',
  SUPPORTING = 'supporting',
  MINOR = 'minor'
}

/** 角色性别枚举 */
export enum CharacterGender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other'
}
