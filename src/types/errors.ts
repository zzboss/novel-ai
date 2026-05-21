/**
 * 全局错误类型定义
 * 统一项目中所有错误处理的类型
 */

export type ErrorCode =
  | 'PROJECT_LOAD_FAILED'
  | 'PROJECT_SAVE_FAILED'
  | 'LLM_API_ERROR'
  | 'LLM_STREAM_ERROR'
  | 'DATABASE_ERROR'
  | 'DATABASE_MIGRATION_ERROR'
  | 'VALIDATION_ERROR'
  | 'STATE_UPDATE_FAILED'
  | 'AGENT_EXECUTION_FAILED'
  | 'SKILL_EXECUTION_FAILED'
  | 'UNKNOWN_ERROR'

/** 应用错误基类 */
export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly originalError?: unknown
  public readonly timestamp: number

  constructor(code: ErrorCode, message: string, originalError?: unknown) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.originalError = originalError
    this.timestamp = Date.now()
  }
}

/** LLM API 错误 */
export class LLMError extends AppError {
  public readonly modelName?: string

  constructor(message: string, originalError?: unknown, modelName?: string) {
    super('LLM_API_ERROR', message, originalError)
    this.name = 'LLMError'
    this.modelName = modelName
  }
}

/** 数据库错误 */
export class DatabaseError extends AppError {
  constructor(message: string, originalError?: unknown) {
    super('DATABASE_ERROR', message, originalError)
    this.name = 'DatabaseError'
  }
}

/** 校验错误 */
export class ValidationError extends AppError {
  constructor(message: string, originalError?: unknown) {
    super('VALIDATION_ERROR', message, originalError)
    this.name = 'ValidationError'
  }
}
