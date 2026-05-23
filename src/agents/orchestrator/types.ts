/**
 * Agent 编排器类型定义
 * 
 * 定义 Agent 间协作、消息传递、流水线执行等相关类型
 */

import type { AgentType, AgentInput, AgentOutput, AgentContext } from '../types'

/**
 * Agent 消息类型
 * 
 * 用于 Agent 间的异步消息传递
 */
export interface AgentMessage {
  /** 消息 ID */
  id: string
  
  /** 发送者 Agent 类型 */
  from: AgentType
  
  /** 接收者 Agent 类型（undefined 表示广播） */
  to?: AgentType
  
  /** 消息类型 */
  type: 'data' | 'request' | 'response' | 'notification' | 'error'
  
  /** 消息内容 */
  payload: unknown
  
  /** 消息时间戳 */
  timestamp: number
  
  /** 关联的请求 ID（用于 request-response 模式） */
  correlationId?: string
}

/**
 * Agent 执行状态
 */
export type AgentExecutionStatus = 
  | 'idle'           // 空闲
  | 'running'        // 执行中
  | 'completed'      // 已完成
  | 'failed'         // 执行失败
  | 'cancelled'      // 已取消

/**
 * Agent 执行记录
 */
export interface AgentExecutionRecord {
  /** Agent 类型 */
  agentType: AgentType
  
  /** 执行状态 */
  status: AgentExecutionStatus
  
  /** 开始时间 */
  startTime?: number
  
  /** 结束时间 */
  endTime?: number
  
  /** 执行结果（成功时） */
  output?: AgentOutput
  
  /** 错误信息（失败时） */
  error?: string
  
  /** 消耗的 Token 数 */
  tokensUsed?: number
}

/**
 * Agent 流水线步骤
 */
export interface AgentPipelineStep {
  /** 步骤 ID */
  id: string
  
  /** Agent 类型 */
  agentType: AgentType
  
  /** 输入转换器（将上一步输出转换为当前步输入） */
  inputTransformer?: (previousOutput: AgentOutput, originalInput: AgentInput) => AgentInput
  
  /** 是否跳过此步骤（条件函数） */
  skipIf?: (previousOutput: AgentOutput, context: AgentContext) => boolean
  
  /** 步骤超时时间（毫秒） */
  timeout?: number
}

/**
 * Agent 流水线定义
 */
export interface AgentPipeline {
  /** 流水线 ID */
  id: string
  
  /** 流水线名称 */
  name: string
  
  /** 流水线步骤 */
  steps: AgentPipelineStep[]
  
  /** 流水线级联错误处理策略 */
  onStepError?: 'stop' | 'continue' | 'retry'
  
  /** 最大重试次数 */
  maxRetries?: number
}

/**
 * Agent 编排器配置
 */
export interface AgentOrchestratorConfig {
  /** 是否启用并行执行 */
  enableParallelExecution: boolean
  
  /** 并行执行最大并发数 */
  maxParallelism: number
  
  /** 是否启用 Agent 记忆共享 */
  enableMemorySharing: boolean
  
  /** 是否启用 Agent 消息传递 */
  enableMessagePassing: boolean
  
  /** 默认超时时间（毫秒） */
  defaultTimeout: number
  
  /** 是否启用执行日志 */
  enableExecutionLog: boolean
}

/**
 * 默认编排器配置
 */
export const DEFAULT_ORCHESTRATOR_CONFIG: AgentOrchestratorConfig = {
  enableParallelExecution: true,
  maxParallelism: 3,
  enableMemorySharing: true,
  enableMessagePassing: true,
  defaultTimeout: 300000, // 5 分钟
  enableExecutionLog: true
}

/**
 * Agent 记忆记录
 */
export interface AgentMemoryRecord {
  /** 记忆 ID */
  id: string
  
  /** 来源 Agent */
  sourceAgent: AgentType
  
  /** 记忆内容 */
  content: string
  
  /** 记忆向量（用于相似度检索） */
  embedding?: number[]
  
  /** 元数据 */
  metadata?: Record<string, unknown>
  
  /** 创建时间 */
  createdAt: number
  
  /** 最后访问时间 */
  lastAccessedAt?: number
}

/**
 * 消息处理器函数类型
 */
export type AgentMessageHandler = (message: AgentMessage) => void | Promise<void>
