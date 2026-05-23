/**
 * Agent 编排器模块导出
 * 
 * 导出内容：
 * - AgentOrchestrator: 核心编排器类
 * - 类型定义: AgentMessage, AgentPipeline, AgentExecutionRecord 等
 * - 默认配置: DEFAULT_ORCHESTRATOR_CONFIG
 */

// 核心类
export { AgentOrchestrator } from './AgentOrchestrator'

// 类型定义
export type {
  AgentMessage,
  AgentExecutionRecord,
  AgentPipeline,
  AgentPipelineStep,
  AgentMemoryRecord,
  AgentMessageHandler,
  AgentOrchestratorConfig
} from './types'

// 常量
export { DEFAULT_ORCHESTRATOR_CONFIG } from './types'

// 类型别名（重新导出 Agent 基础类型）
export type {
  AgentType,
  AgentInput,
  AgentOutput,
  AgentContext
} from '../types'
