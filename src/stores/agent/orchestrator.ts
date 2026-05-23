/**
 * Agent 编排器 Pinia Store
 * 
 * 功能：
 * - 包装 AgentOrchestrator 实例
 * - 提供响应式状态（执行状态、执行记录、Agent 记忆等）
 * - 提供操作方法（注册 Agent、执行 Agent、Pipeline 等）
 * 
 * 使用示例：
 * ```vue
 * <script setup lang="ts">
 * import { useAgentOrchestratorStore } from '@/stores/agent/orchestrator'
 * 
 * const orchestratorStore = useAgentOrchestratorStore()
 * 
 * // 注册 Agent
 * orchestratorStore.registerAgent(new ChapterAgent())
 * 
 * // 执行 Agent
 * const result = await orchestratorStore.executeSingle(input, context)
 * 
 * // 监听执行状态
 * watch(() => orchestratorStore.isExecuting, (value) => {
 *   console.log('执行状态:', value)
 * })
 * ```
 */

import { defineStore } from 'pinia'
import { ref, computed, reactive } from 'vue'

import { AgentOrchestrator } from '@/agents/orchestrator'
import type { 
  AgentType, 
  AgentInput, 
  AgentOutput, 
  AgentContext 
} from '@/agents/types'

import type {
  AgentPipeline,
  AgentExecutionRecord,
  AgentMemoryRecord
} from '@/agents/orchestrator/types'

import { BaseAgent } from '@/agents/base'

// ==================== Store 定义 ====================

export const useAgentOrchestratorStore = defineStore('agent-orchestrator', () => {
  // ==================== 状态 ====================
  
  /** Agent 编排器实例 */
  const orchestrator = AgentOrchestrator.getInstance()
  
  /** 是否正在执行 */
  const isExecuting = ref(false)
  
  /** 当前执行的 Agent 类型 */
  const currentExecutingAgent = ref<AgentType | null>(null)
  
  /** 执行记录（响应式） */
  const executionRecords = ref<AgentExecutionRecord[]>([])
  
  /** Agent 记忆（响应式） */
  const agentMemories = ref<Record<string, AgentMemoryRecord[]>>({})
  
  /** 执行日志 */
  const executionLogs = reactive<Array<{
    timestamp: number
    agentType: AgentType | null
    action: string
    detail: string
  }>>([])
  
  /** 最大日志条数 */
  const MAX_LOGS = 100
  
  /** 已注册的 Agent 类型列表（响应式） */
  const registeredAgentTypes = ref<AgentType[]>([])
  
  /** 是否有 Agent 已注册 */
  const hasRegisteredAgents = computed(() => {
    return registeredAgentTypes.value.length > 0
  })
  
  // ==================== 辅助函数 ====================
  
  /**
   * 刷新已注册 Agent 类型列表
   * 
   * 功能说明：
   * - 从 orchestrator 实例获取最新的注册状态
   * - 更新响应式的 registeredAgentTypes
   */
  function refreshRegisteredAgentTypes(): void {
    registeredAgentTypes.value = orchestrator.getRegisteredAgentTypes()
  }
  
  /** 执行记录数量 */
  const executionRecordCount = computed(() => {
    return executionRecords.value.length
  })
  
  /** 最近的执行记录（按时间倒序） */
  const recentExecutions = computed(() => {
    return [...executionRecords.value]
      .sort((a, b) => {
        const aTime = a.endTime || a.startTime || 0
        const bTime = b.endTime || b.startTime || 0
        return bTime - aTime
      })
      .slice(0, 20)
  })
  
  // ==================== 操作方法 ====================
  
  /**
   * 添加执行日志
   */
  function addLog(agentType: AgentType | null, action: string, detail: string): void {
    executionLogs.push({
      timestamp: Date.now(),
      agentType,
      action,
      detail
    })
    
    // 限制日志条数
    if (executionLogs.length > MAX_LOGS) {
      executionLogs.splice(0, executionLogs.length - MAX_LOGS)
    }
  }
  
  /**
   * 注册 Agent
   * @param agent - Agent 实例
   */
  function registerAgent(agent: BaseAgent): void {
    orchestrator.registerAgent(agent)
    addLog(agent.agentType, 'register', `注册 Agent: ${agent.agentType}`)
    // 刷新已注册 Agent 类型列表
    refreshRegisteredAgentTypes()
  }
  
  /**
   * 批量注册 Agent
   * @param agents - Agent 实例数组
   */
  function registerAgents(agents: BaseAgent[]): void {
    orchestrator.registerAgents(agents)
    addLog(null, 'register', `批量注册 ${agents.length} 个 Agent`)
    // 刷新已注册 Agent 类型列表
    refreshRegisteredAgentTypes()
  }
  
  /**
   * 注销 Agent
   * @param agentType - Agent 类型
   */
  function unregisterAgent(agentType: AgentType): void {
    orchestrator.unregisterAgent(agentType)
    addLog(agentType, 'unregister', `注销 Agent: ${agentType}`)
    // 刷新已注册 Agent 类型列表
    refreshRegisteredAgentTypes()
  }
  
  /**
   * 执行单个 Agent
   * @param input - Agent 输入
   * @param context - Agent 执行上下文
   * @param agentType - 可选，指定 Agent 类型
   * @returns Promise<AgentOutput>
   */
  async function executeSingle(
    input: AgentInput,
    context: AgentContext,
    agentType?: AgentType
  ): Promise<AgentOutput> {
    const targetAgentType = agentType || input.type as AgentType
    
    isExecuting.value = true
    currentExecutingAgent.value = targetAgentType
    addLog(targetAgentType, 'executeSingle', '开始执行')
    
    try {
      const result = await orchestrator.executeSingle(input, context, agentType)
      addLog(targetAgentType, 'executeSingle', '执行成功')
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      addLog(targetAgentType, 'executeSingle', `执行失败: ${errorMessage}`)
      throw error
    } finally {
      isExecuting.value = false
      currentExecutingAgent.value = null
      // 刷新执行记录
      refreshExecutionRecords()
    }
  }
  
  /**
   * 并行执行多个 Agent
   * @param inputs - Agent 输入数组
   * @param context - Agent 执行上下文
   * @param agentTypes - 可选，指定每个输入对应的 Agent 类型
   * @returns Promise<Array<{ success: boolean; output?: AgentOutput; error?: string }>>
   */
  async function executeParallel(
    inputs: AgentInput[],
    context: AgentContext,
    agentTypes?: AgentType[]
  ): Promise<Array<{ success: boolean; output?: AgentOutput; error?: string; executionId: string }>> {
    isExecuting.value = true
    addLog(null, 'executeParallel', `开始并行执行 ${inputs.length} 个 Agent`)
    
    try {
      const results = await orchestrator.executeParallel(inputs, context, agentTypes)
      const successCount = results.filter(r => r.success).length
      addLog(null, 'executeParallel', `并行执行完成，成功: ${successCount}/${results.length}`)
      return results
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      addLog(null, 'executeParallel', `并行执行失败: ${errorMessage}`)
      throw error
    } finally {
      isExecuting.value = false
      // 刷新执行记录
      refreshExecutionRecords()
    }
  }
  
  /**
   * 执行 Agent 流水线
   * @param pipeline - 流水线定义
   * @param context - Agent 执行上下文
   * @param initialInput - 初始输入
   * @returns Promise<AgentOutput[]>
   */
  async function executePipeline(
    pipeline: AgentPipeline,
    context: AgentContext,
    initialInput: AgentInput
  ): Promise<AgentOutput[]> {
    isExecuting.value = true
    addLog(null, 'executePipeline', `开始执行流水线: ${pipeline.name}`)
    
    try {
      const results = await orchestrator.executePipeline(pipeline, context, initialInput)
      addLog(null, 'executePipeline', `流水线执行完成，共 ${results.length} 个输出`)
      return results
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      addLog(null, 'executePipeline', `流水线执行失败: ${errorMessage}`)
      throw error
    } finally {
      isExecuting.value = false
      // 刷新执行记录
      refreshExecutionRecords()
    }
  }
  
  /**
   * 保存 Agent 记忆
   * @param agentType - Agent 类型
   * @param content - 记忆内容
   * @param metadata - 元数据
   */
  async function saveAgentMemory(
    agentType: AgentType,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await orchestrator.saveAgentMemory(agentType, content, metadata)
    addLog(agentType, 'saveMemory', `保存记忆，长度: ${content.length}`)
    // 刷新 Agent 记忆
    refreshAgentMemories()
  }
  
  /**
   * 获取 Agent 记忆
   * @param agentType - Agent 类型（可选）
   * @param limit - 返回的最大记录数
   * @returns 记忆记录数组
   */
  function getAgentMemories(agentType?: AgentType, limit: number = 100): AgentMemoryRecord[] {
    return orchestrator.getAgentMemories(agentType, limit)
  }
  
  /**
   * 清除 Agent 记忆
   * @param agentType - Agent 类型（可选，不指定则清除所有记忆）
   */
  function clearAgentMemories(agentType?: AgentType): void {
    orchestrator.clearAgentMemories(agentType)
    addLog(agentType || null, 'clearMemories', `清除记忆: ${agentType || 'all'}`)
    // 刷新 Agent 记忆
    refreshAgentMemories()
  }
  
  /**
   * 刷新执行记录（从 AgentOrchestrator 实例）
   */
  function refreshExecutionRecords(): void {
    executionRecords.value = orchestrator.getAllExecutionRecords()
  }
  
  /**
   * 刷新 Agent 记忆（从 AgentOrchestrator 实例）
   */
  function refreshAgentMemories(): void {
    const memories = orchestrator.getAgentMemories()
    const memoriesMap: Record<string, AgentMemoryRecord[]> = {}
    
    // 按 sourceAgent 分组
    for (const memory of memories) {
      const source = memory.sourceAgent || 'unknown'
      if (!memoriesMap[source]) {
        memoriesMap[source] = []
      }
      memoriesMap[source].push(memory)
    }
    
    agentMemories.value = memoriesMap
  }
  
  /**
   * 清除执行记录
   */
  function clearExecutionRecords(): void {
    orchestrator.clearExecutionRecords()
    executionRecords.value = []
    addLog(null, 'clearRecords', '清除执行记录')
  }
  
  /**
   * 清除执行日志
   */
  function clearExecutionLogs(): void {
    executionLogs.splice(0, executionLogs.length)
    addLog(null, 'clearLogs', '清除执行日志')
  }
  
  /**
   * 设置 MemoryManager（用于持久化 Agent 记忆）
   * @param manager - MemoryManager 实例
   */
  function setMemoryManager(manager: any): void {
    orchestrator.setMemoryManager(manager)
    addLog(null, 'setMemoryManager', '设置 MemoryManager')
  }
  
  /**
   * 设置 EmbeddingClient（用于生成记忆向量）
   * @param client - EmbeddingClient 实例
   */
  function setEmbeddingClient(client: any): void {
    orchestrator.setEmbeddingClient(client)
    addLog(null, 'setEmbeddingClient', '设置 EmbeddingClient')
  }
  
  /**
   * 设置当前项目 ID（用于记忆持久化）
   * @param projectId - 项目 ID
   */
  function setCurrentProject(projectId: string): void {
    orchestrator.setCurrentProject(projectId)
    addLog(null, 'setCurrentProject', `设置当前项目: ${projectId}`)
  }
  
  /**
   * 停止当前执行
   * 
   * 功能说明：
   * - 调用 AgentOrchestrator 的 stopExecution 方法
   * - 重置执行状态
   * - 添加停止日志
   */
  function stopExecution(): void {
    orchestrator.stopExecution()
    isExecuting.value = false
    currentExecutingAgent.value = null
    addLog(null, 'stop', '停止执行')
    
    if (config.enableExecutionLog) {
      console.log('[AgentOrchestratorStore] 已停止执行')
    }
  }
  
  /**
   * 销毁编排器（清除所有状态）
   */
  function destroy(): void {
    orchestrator.destroy()
    isExecuting.value = false
    currentExecutingAgent.value = null
    executionRecords.value = []
    agentMemories.value = {}
    executionLogs.splice(0, executionLogs.length)
    registeredAgentTypes.value = []
    addLog(null, 'destroy', '销毁编排器')
  }
  
  // ==================== 初始化 ====================
  
  // 初始加载执行记录和 Agent 记忆
  refreshExecutionRecords()
  refreshAgentMemories()
  
  // 初始加载已注册的 Agent 类型
  refreshRegisteredAgentTypes()
  
  // ==================== 返回 ====================
  
  return {
    // 状态
    isExecuting,
    currentExecutingAgent,
    executionRecords,
    agentMemories,
    executionLogs,
    
    // 计算属性
    registeredAgentTypes,
    hasRegisteredAgents,
    executionRecordCount,
    recentExecutions,
    
    // 操作方法
    registerAgent,
    registerAgents,
    unregisterAgent,
    executeSingle,
    executeParallel,
    executePipeline,
    stopExecution,
    saveAgentMemory,
    getAgentMemories,
    clearAgentMemories,
    refreshExecutionRecords,
    refreshAgentMemories,
    clearExecutionRecords,
    clearExecutionLogs,
    setMemoryManager,
    setEmbeddingClient,
    setCurrentProject,
    destroy
  }
})
