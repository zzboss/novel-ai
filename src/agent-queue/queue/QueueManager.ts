/**
 * 队列管理器 - 负责任务队列的管理
 */

import type { AgentTask, AgentType, AgentInput } from '@/agents/types'
import { getOrCreateAgent } from '../agents/AgentFactory'
import { buildAgentContext } from '../PipelineExecutor'
import { useAgentStore } from '@/stores/agent'

/**
 * 队列管理器类
 */
export class QueueManager {
  private queue: AgentTask[] = []
  private runningTasks: Set<string> = new Set()
  private maxConcurrency = 3

  /**
   * 提交任务到队列
   */
  enqueue(
    agentType: AgentType,
    input: AgentInput,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): string {
    const task: AgentTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(1, 9)}`,
      agentType,
      input,
      priority,
      status: 'queued',
      progress: 0
    }

    this.queue.push(task)
    this.sortQueue()
    this.updateStore()
    this.processQueue()

    return task.id
  }

  /**
   * 取消任务
   */
  cancel(taskId: string): boolean {
    const queueIndex = this.queue.findIndex(t => t.id === taskId)
    if (queueIndex !== -1) {
      this.queue.splice(queueIndex, 1)
      this.updateStore()
      return true
    }

    if (this.runningTasks.has(taskId)) {
      console.warn(`任务 ${taskId} 正在运行，取消功能尚未实现`)
      return false
    }

    return false
  }

  /**
   * 获取队列状态
   */
  getStatus() {
    return {
      queued: this.queue.length,
      running: this.runningTasks.size,
      maxConcurrency: this.maxConcurrency
    }
  }

  /**
   * 设置最大并发数
   */
  setMaxConcurrency(count: number): void {
    this.maxConcurrency = count
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    this.queue = []
    this.updateStore()
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): AgentTask[] {
    return [...this.queue]
  }

  /**
   * 处理队列
   */
  private async processQueue(): Promise<void> {
    if (this.runningTasks.size >= this.maxConcurrency) return
    if (this.queue.length === 0) return

    const task = this.queue.shift()!
    task.status = 'running'
    task.startedAt = Date.now()
    this.runningTasks.add(task.id)
    this.updateStore()

    this.executeTask(task).then(() => {
      this.runningTasks.delete(task.id)
      this.updateStore()
      this.processQueue()
    })
  }

  /**
   * 执行任务
   */
  private async executeTask(task: AgentTask): Promise<void> {
    try {
      const agent = getOrCreateAgent(task.agentType)
      const context = buildAgentContext()
      await agent.execute(task.input, context)

      task.status = 'completed'
      task.completedAt = Date.now()
      task.progress = 100
    } catch (error) {
      task.status = 'failed'
      task.error = error instanceof Error ? error.message : String(error)
    } finally {
      this.updateStore()
    }
  }

  /**
   * 排序队列（按优先级）
   */
  private sortQueue(): void {
    const priorityWeight = { high: 0, normal: 1, low: 2 }
    this.queue.sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority])
  }

  /**
   * 更新 Store
   */
  private updateStore(): void {
    const agentStore = useAgentStore()
    agentStore.updateTasks([...this.queue])
  }
}
