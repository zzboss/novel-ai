/**
 * Agent 任务队列管理器 + 管线编排（重构版）
 *
 * 重构说明：
 * - 本文件已重构为模块化架构，原始实现已备份至 AgentQueueManager.ts.bak
 * - 新架构采用外观模式（Facade Pattern）：
 *   - PipelineExecutor: 管线编排逻辑
 *   - QueueManager: 任务队列管理
 *   - AgentFactory: Agent 实例管理
 *   - PipelineHelpers: 辅助函数
 * - 本类保持单例模式，向后兼容所有现有接口
 *
 * 新架构优势：
 * - 职责分离：管线编排、队列管理、Agent管理各自独立
 * - 便于维护：每个模块职责清晰，易于理解和修改
 * - 便于测试：可独立测试各个模块
 * - 便于扩展：新增功能只需在对应模块中添加
 */

import type { PipelineMode, PipelineResult, PipelineCallbacks, PipelineOptions } from './types'
import { PipelineExecutor } from './pipeline/PipelineExecutor'
import { QueueManager } from './queue/QueueManager'

/**
 * Agent 任务队列管理器 + 管线编排
 *
 * 使用外观模式组合各个模块，保持向后兼容
 */
export class AgentQueueManager {
  private static instance: AgentQueueManager | null = null

  /** 管线执行器 */
  private pipelineExecutor: PipelineExecutor

  /** 队列管理器 */
  private queueManager: QueueManager

  static getInstance(): AgentQueueManager {
    if (!this.instance) {
      this.instance = new AgentQueueManager()
    }
    return this.instance
  }

  constructor() {
    this.pipelineExecutor = new PipelineExecutor()
    this.queueManager = new QueueManager()
  }

  // ==================== 管线编排接口 ====================

  async executePipeline(
    chapterId: string,
    mode: PipelineMode = 'auto',
    options: PipelineOptions = {},
    callbacks: PipelineCallbacks = {}
  ): Promise<PipelineResult> {
    return this.pipelineExecutor.executePipeline(chapterId, mode, options, callbacks)
  }

  cancelPipeline(): void {
    this.pipelineExecutor.cancelPipeline()
  }

  isPipelineRunning(): boolean {
    return this.pipelineExecutor.isPipelineRunning()
  }

  // ==================== 队列管理接口（保留旧接口） ====================

  enqueue(agentType: any, input: any, priority: 'high' | 'normal' | 'low' = 'normal'): string {
    return this.queueManager.enqueue(agentType, input, priority)
  }

  cancel(taskId: string): boolean {
    return this.queueManager.cancel(taskId)
  }

  getStatus() {
    return this.queueManager.getStatus()
  }

  setMaxConcurrency(count: number): void {
    this.queueManager.setMaxConcurrency(count)
  }

  clearQueue(): void {
    this.queueManager.clearQueue()
  }

  getAllTasks(): any[] {
    return this.queueManager.getAllTasks()
  }
}

// ==================== 重新导出类型和常量（向后兼容） ====================

export type { PipelineMode, PipelineResult, StepResult, PipelineCallbacks, PipelineOptions } from './types'
export { PIPELINE_STEPS, MAX_REVISION_CYCLES } from './constants'
export type { PipelineStep } from './types'
