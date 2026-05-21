/**
 * 项目状态管理 - 统一导出入口
 * 
 * 此文件作为重新导出入口，确保向后兼容。
 * 实际实现已拆分到以下文件：
 * - src/types/enums.ts: 枚举定义
 * - src/types/project.ts: 接口类型定义
 * - src/stores/projectStore.ts: useProjectStore（包含项目和创建向导状态管理）
 */

// 重新导出枚举
export { 
  ProjectType, 
  StepInputMode, 
  ChapterStatus, 
  StepStatus, 
  CharacterRole, 
  CharacterGender 
} from '@/types/enums'

// 重新导出接口类型
export type { 
  Volume, 
  Chapter, 
  StepState, 
  CreationSession, 
  Character, 
  WorldSettings, 
  ProjectState 
} from '@/types/project'

// 重新导出 Store
export { useProjectStore } from './projectStore'

// 重新导出 stepUtils（CreationStep 类型及相关函数）
export { 
  CREATION_STEPS, 
  STEP_LABELS, 
  getStepIndex, 
  getTotalSteps, 
  getNextStep, 
  getPrevStep, 
  canSkipStep, 
  requiresAiGeneration, 
  type CreationStep 
} from './stepUtils'
