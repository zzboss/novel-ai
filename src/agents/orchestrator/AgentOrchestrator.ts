/**
 * Agent 编排器
 * 
 * 核心职责：
 * - Agent 注册管理
 * - Agent 执行调度（单个、并行、Pipeline）
 * - Agent 协作协调
 * - Agent 消息传递
 * - Agent 记忆共享管理
 * 
 * 设计模式：
 * - 单例模式（通过 getInstance() 获取实例）
 * - 发布-订阅模式（Agent 消息传递）
 * - 模板方法模式（Agent 执行流程）
 * 
 * 使用示例：
 * ```typescript
 * const orchestrator = AgentOrchestrator.getInstance()
 * 
 * // 注册 Agent
 * orchestrator.registerAgent(new ChapterAgent())
 * orchestrator.registerAgent(new ConsistencyAgent())
 * 
 * // 单个执行
 * const result = await orchestrator.executeSingle(input, context)
 * 
 * // 并行执行
 * const results = await orchestrator.executeParallel([input1, input2], context)
 * 
 * // Pipeline 执行
 * const pipeline = { id: 'p1', name: '质量检查流水线', steps: [...] }
 * const results = await orchestrator.executePipeline(pipeline, context)
 * ```
 */

import type { 
  AgentType, 
  AgentInput, 
  AgentOutput, 
  AgentContext 
} from '../types'

import type {
  AgentMessage,
  AgentExecutionRecord,
  AgentPipeline,
  AgentPipelineStep,
  AgentMemoryRecord,
  AgentMessageHandler,
  AgentOrchestratorConfig
} from './types'

import { 
  DEFAULT_ORCHESTRATOR_CONFIG 
} from './types'

import { BaseAgent } from '../base'

// 延迟导入以避免循环依赖
type MemoryManagerType = import('@/memory/MemoryManager').MemoryManager
type EmbeddingClientType = import('@/memory/EmbeddingClient').default
type MCPManagerType = import('@/mcp/MCPManager').MCPManager

/**
 * Agent 编排器类
 */
export class AgentOrchestrator {
  // ==================== 单例模式 ====================
  
  private static instance: AgentOrchestrator | null = null
  
  /**
   * 获取编排器单例
   */
  static getInstance(config?: Partial<AgentOrchestratorConfig>): AgentOrchestrator {
    if (!AgentOrchestrator.instance) {
      AgentOrchestrator.instance = new AgentOrchestrator(config)
    } else if (config) {
      // 如果提供了新配置，更新现有实例的配置
      AgentOrchestrator.instance.updateConfig(config)
    }
    return AgentOrchestrator.instance
  }
  
  /**
   * 重置单例（主要用于测试）
   */
  static resetInstance(): void {
    AgentOrchestrator.instance = null
  }
  
  // ==================== 实例属性 ====================
  
  /** 已注册的 Agent 映射（agentType -> Agent 实例） */
  private agents: Map<AgentType, BaseAgent> = new Map()
  
  /** 编排器配置 */
  private config: AgentOrchestratorConfig
  
  /** 执行记录映射（executionId -> 执行记录） */
  private executionRecords: Map<string, AgentExecutionRecord> = new Map()
  
  /** 消息队列（接收者 -> 消息处理器数组） */
  private messageHandlers: Map<AgentType | 'broadcast', Set<AgentMessageHandler>> = new Map()
  
  /** 待处理消息队列 */
  private messageQueue: AgentMessage[] = []
  
  /** 是否正在处理消息 */
  private isProcessingMessages: boolean = false
  
  /** Agent 记忆存储（agentType -> MemoryRecord[]） */
  private agentMemories: Map<AgentType, AgentMemoryRecord[]> = new Map()
  
  /** 执行 ID 计数器 */
  private executionIdCounter: number = 0
  
  /** MemoryManager 实例（用于持久化 Agent 记忆） */
  private memoryManager: MemoryManagerType | null = null
  
  /** EmbeddingClient 实例（用于生成记忆向量） */
  private embeddingClient: EmbeddingClientType | null = null
  
  /** MCPManager 实例（用于调用 MCP 工具） */
  private mcpManager: MCPManagerType | null = null
  
  /** 当前项目 ID（用于记忆持久化） */
  private currentProjectId: string | null = null
  
  /** AbortController 用于取消执行 */
  private abortController: AbortController | null = null
  
  // ==================== 构造函数 ====================
  
  private constructor(config?: Partial<AgentOrchestratorConfig>) {
    this.config = {
      ...DEFAULT_ORCHESTRATOR_CONFIG,
      ...config
    }
  }
  
  // ==================== 配置管理 ====================
  
  /**
   * 更新编排器配置
   */
  updateConfig(config: Partial<AgentOrchestratorConfig>): void {
    this.config = {
      ...this.config,
      ...config
    }
  }
  
  /**
   * 获取当前配置
   */
  getConfig(): AgentOrchestratorConfig {
    return { ...this.config }
  }
  
  /**
   * 停止当前执行
   * 
   * 功能说明：
   * - 调用 abortController.abort() 取消正在执行的任务
   * - 重置 abortController 为 null
   * - 更新所有 running 状态的执行记录为 failed
   */
  stopExecution(): void {
    if (this.abortController) {
      if (this.config.enableExecutionLog) {
        console.log('[AgentOrchestrator] 停止执行')
      }
      
      this.abortController.abort('用户取消执行')
      this.abortController = null
      
      // 更新所有 running 状态的执行记录为 failed
      for (const record of this.executionRecords.values()) {
        if (record.status === 'running') {
          record.status = 'failed'
          record.endTime = Date.now()
          record.error = '执行已被用户取消'
        }
      }
    }
  }
  
  /**
   * 检查是否已取消执行
   * @returns 如果已取消返回 true
   */
  private isAborted(): boolean {
    return this.abortController?.signal.aborted || false
  }
  
  /**
   * 检查并执行取消检查，如果已取消则抛出错误
   */
  private checkAborted(): void {
    if (this.isAborted()) {
      throw new Error('执行已取消')
    }
  }
  
  // ==================== MemoryManager 和 EmbeddingClient 管理 ====================
  
  /**
   * 设置 MemoryManager（用于持久化 Agent 记忆）
   * @param manager - MemoryManager 实例
   */
  setMemoryManager(manager: MemoryManagerType): void {
    this.memoryManager = manager
    
    if (this.config.enableExecutionLog) {
      console.log('[AgentOrchestrator] MemoryManager 已设置')
    }
  }
  
  /**
   * 设置 EmbeddingClient（用于生成记忆向量）
   * @param client - EmbeddingClient 实例
   */
  setEmbeddingClient(client: EmbeddingClientType): void {
    this.embeddingClient = client
    
    if (this.config.enableExecutionLog) {
      console.log('[AgentOrchestrator] EmbeddingClient 已设置')
    }
  }
  
  /**
   * 设置当前项目 ID（用于记忆持久化）
   * @param projectId - 项目 ID
   */
  setCurrentProject(projectId: string): void {
    this.currentProjectId = projectId
    
    if (this.config.enableExecutionLog) {
      console.log(`[AgentOrchestrator] 当前项目 ID: ${projectId}`)
    }
  }
  
  /**
   * 获取当前项目 ID
   * @returns 当前项目 ID 或 null
   */
  getCurrentProject(): string | null {
    return this.currentProjectId
  }
  
  // ==================== MCPManager 管理 ====================
  
  /**
   * 设置 MCPManager（用于调用 MCP 工具）
   * @param manager - MCPManager 实例
   */
  setMCPManager(manager: MCPManagerType): void {
    this.mcpManager = manager
    
    // 同时为所有已注册的 Agent 设置 MCPManager
    for (const agent of this.agents.values()) {
      agent.setMCPManager(manager)
    }
    
    if (this.config.enableExecutionLog) {
      console.log('[AgentOrchestrator] MCPManager 已设置')
    }
  }
  
  /**
   * 清除 MCPManager
   */
  clearMCPManager(): void {
    this.mcpManager = null
    
    // 同时为所有已注册的 Agent 清除 MCPManager
    for (const agent of this.agents.values()) {
      agent.clearMCPManager()
    }
    
    if (this.config.enableExecutionLog) {
      console.log('[AgentOrchestrator] MCPManager 已清除')
    }
  }
  
  // ==================== Agent 注册管理 ====================
  
  /**
   * 注册 Agent
   * @param agent - Agent 实例
   */
  registerAgent(agent: BaseAgent): void {
    const agentType = agent.agentType
    
    if (this.agents.has(agentType)) {
      console.warn(`Agent "${agentType}" 已注册，将覆盖现有实例`)
    }
    
    this.agents.set(agentType, agent)
    
    if (this.config.enableExecutionLog) {
      console.log(`[AgentOrchestrator] 注册 Agent: ${agentType}`)
    }
  }
  
  /**
   * 注销 Agent
   * @param agentType - Agent 类型
   */
  unregisterAgent(agentType: AgentType): void {
    if (this.agents.delete(agentType)) {
      if (this.config.enableExecutionLog) {
        console.log(`[AgentOrchestrator] 注销 Agent: ${agentType}`)
      }
    }
  }
  
  /**
   * 获取已注册的 Agent
   * @param agentType - Agent 类型
   * @returns Agent 实例或 undefined
   */
  getAgent(agentType: AgentType): BaseAgent | undefined {
    return this.agents.get(agentType)
  }
  
  /**
   * 获取所有已注册的 Agent 类型
   */
  getRegisteredAgentTypes(): AgentType[] {
    return Array.from(this.agents.keys())
  }
  
  /**
   * 检查 Agent 是否已注册
   * @param agentType - Agent 类型
   */
  isAgentRegistered(agentType: AgentType): boolean {
    return this.agents.has(agentType)
  }
  
  /**
   * 批量注册 Agent
   * @param agents - Agent 实例数组
   */
  registerAgents(agents: BaseAgent[]): void {
    for (const agent of agents) {
      this.registerAgent(agent)
    }
  }
  
  // ==================== 单个 Agent 执行 ====================
  
  /**
   * 执行单个 Agent
   * 
   * @param input - Agent 输入
   * @param context - Agent 执行上下文
   * @param agentType - 可选，指定 Agent 类型（从 input.type 推断）
   * @returns Promise<AgentOutput> - Agent 输出
   */
  async executeSingle(
    input: AgentInput, 
    context: AgentContext,
    agentType?: AgentType
  ): Promise<AgentOutput> {
    // 确定要执行的 Agent 类型
    const targetAgentType = agentType || this.inferAgentTypeFromInput(input)
    
    // 检查 Agent 是否已注册
    const agent = this.agents.get(targetAgentType)
    if (!agent) {
      throw new Error(`Agent "${targetAgentType}" 未注册。请先调用 registerAgent() 注册该 Agent。`)
    }
    
    // 创建 AbortController（用于支持取消执行）
    this.abortController = new AbortController()
    const signal = this.abortController.signal
    
    // 创建执行记录
    const executionId = this.generateExecutionId()
    const record: AgentExecutionRecord = {
      agentType: targetAgentType,
      status: 'running',
      startTime: Date.now()
    }
    this.executionRecords.set(executionId, record)
    
    if (this.config.enableExecutionLog) {
      console.log(`[AgentOrchestrator] 开始执行 Agent: ${targetAgentType} (ID: ${executionId})`)
    }
    
    try {
      // 检查是否已取消
      this.checkAborted()
      
      // 执行 Agent（支持超时和取消）
      const output = await this.executeWithTimeout(
        () => agent.execute(input, context),
        this.config.defaultTimeout,
        signal
      )
      
      // 更新执行记录
      record.status = 'completed'
      record.endTime = Date.now()
      record.output = output
      record.tokensUsed = output.tokensUsed
      
      if (this.config.enableExecutionLog) {
        const duration = record.endTime - (record.startTime || 0)
        console.log(`[AgentOrchestrator] Agent "${targetAgentType}" 执行完成，耗时: ${duration}ms`)
      }
      
      // 如果启用了记忆共享，保存执行结果到记忆
      if (this.config.enableMemorySharing && output.content) {
        await this.saveAgentMemory(targetAgentType, output.content, {
          executionId,
          inputType: input.type
        })
      }
      
      return output
      
    } catch (error) {
      // 更新执行记录
      record.status = 'failed'
      record.endTime = Date.now()
      record.error = error instanceof Error ? error.message : String(error)
      
      if (this.config.enableExecutionLog) {
        const duration = record.endTime - (record.startTime || 0)
        console.error(`[AgentOrchestrator] Agent "${targetAgentType}" 执行失败，耗时: ${duration}ms，错误: ${record.error}`)
        // 输出完整堆栈方便定位问题
        if (error instanceof Error && error.stack) {
          console.error(`[AgentOrchestrator] 错误堆栈:`, error.stack)
        }
      }
      
      throw error
    }
  }
  
  // ==================== 并行执行 ====================
  
  /**
   * 并行执行多个 Agent
   * 
   * 功能说明：
   * - 使用 Promise.all() 实现并行执行
   * - 单个 Agent 失败不影响其他 Agent
   * - 返回所有执行结果（成功或失败）
   * 
   * @param inputs - Agent 输入数组（每个输入对应一个 Agent）
   * @param context - Agent 执行上下文
   * @param agentTypes - 可选，指定每个输入对应的 Agent 类型
   * @returns Promise<Array<{ success: boolean; output?: AgentOutput; error?: string }>>
   */
  async executeParallel(
    inputs: AgentInput[],
    context: AgentContext,
    agentTypes?: AgentType[]
  ): Promise<Array<{ success: boolean; output?: AgentOutput; error?: string; executionId: string }>> {
    if (inputs.length === 0) {
      return []
    }
    
    // 限制并行数
    const maxParallelism = Math.min(this.config.maxParallelism, inputs.length)
    
    if (this.config.enableExecutionLog) {
      console.log(`[AgentOrchestrator] 开始并行执行 ${inputs.length} 个 Agent（最大并发: ${maxParallelism}）`)
    }
    
    // 创建执行任务
    const tasks = inputs.map((input, index) => {
      const agentType = agentTypes ? agentTypes[index] : this.inferAgentTypeFromInput(input)
      
      return this.executeSingleSafely(input, context, agentType)
    })
    
    // 使用 Promise.all 并行执行（受 maxParallelism 限制）
    if (tasks.length <= maxParallelism) {
      // 任务数不超过最大并发数，直接并行执行
      const results = await Promise.all(tasks)
      
      if (this.config.enableExecutionLog) {
        const successCount = results.filter(r => r.success).length
        console.log(`[AgentOrchestrator] 并行执行完成，成功: ${successCount}/${results.length}`)
      }
      
      return results
    } else {
      // 任务数超过最大并发数，分批执行
      const results: Array<{ success: boolean; output?: AgentOutput; error?: string; executionId: string }> = []
      
      for (let i = 0; i < tasks.length; i += maxParallelism) {
        const batch = tasks.slice(i, i + maxParallelism)
        const batchResults = await Promise.all(batch)
        results.push(...batchResults)
      }
      
      if (this.config.enableExecutionLog) {
        const successCount = results.filter(r => r.success).length
        console.log(`[AgentOrchestrator] 并行执行完成，成功: ${successCount}/${results.length}`)
      }
      
      return results
    }
  }
  
  /**
   * 安全地执行单个 Agent（不抛出异常）
   */
  private async executeSingleSafely(
    input: AgentInput,
    context: AgentContext,
    agentType: AgentType
  ): Promise<{ success: boolean; output?: AgentOutput; error?: string; executionId: string }> {
    try {
      const output = await this.executeSingle(input, context, agentType)
      return {
        success: true,
        output,
        executionId: this.getLatestExecutionId()
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionId: this.getLatestExecutionId()
      }
    }
  }
  
  // ==================== Pipeline 执行 ====================
  
  /**
   * 执行 Agent 流水线
   * 
   * 执行流程：
   * 1. 执行第一个 Agent
   * 2. 将输出作为第二个 Agent 的输入（通过 inputTransformer 转换）
   * 3. 依次执行，直到 Pipeline 结束
   * 
   * @param pipeline - 流水线定义
   * @param context - Agent 执行上下文
   * @param initialInput - 初始输入
   * @returns Promise<AgentOutput[]> - 每个步骤的输出
   */
  async executePipeline(
    pipeline: AgentPipeline,
    context: AgentContext,
    initialInput: AgentInput
  ): Promise<AgentOutput[]> {
    if (pipeline.steps.length === 0) {
      return []
    }
    
    if (this.config.enableExecutionLog) {
      console.log(`[AgentOrchestrator] 开始执行流水线: ${pipeline.name} (ID: ${pipeline.id})`)
    }
    
    // 创建 AbortController（用于支持取消执行）
    this.abortController = new AbortController()
    
    const outputs: AgentOutput[] = []
    let currentInput: AgentInput = initialInput
    
    try {
      for (let i = 0; i < pipeline.steps.length; i++) {
        // 检查是否已取消
        this.checkAborted()
        
        const step = pipeline.steps[i]
        
        // 检查是否跳过此步骤
        if (step.skipIf && outputs.length > 0) {
          const previousOutput = outputs[outputs.length - 1]
          if (step.skipIf(previousOutput, context)) {
            if (this.config.enableExecutionLog) {
              console.log(`[AgentOrchestrator] 跳过步骤 ${i + 1}: ${step.agentType}`)
            }
            continue
          }
        }
        
        if (this.config.enableExecutionLog) {
          console.log(`[AgentOrchestrator] 执行步骤 ${i + 1}/${pipeline.steps.length}: ${step.agentType}`)
        }
        
        try {
          // 执行当前步骤
          const output = await this.executeSingle(currentInput, context, step.agentType)
          outputs.push(output)
          
          // 如果有下一步，转换输入
          if (i < pipeline.steps.length - 1 && step.inputTransformer) {
            currentInput = step.inputTransformer(output, initialInput)
          }
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          
          if (this.config.enableExecutionLog) {
            console.error(`[AgentOrchestrator] 步骤 ${i + 1} 执行失败: ${errorMessage}`)
            // 输出完整堆栈方便定位问题
            if (error instanceof Error && error.stack) {
              console.error(`[AgentOrchestrator] 错误堆栈:`, error.stack)
            }
          }
          
          // 根据错误处理策略决定下一步
          if (pipeline.onStepError === 'stop') {
            throw new Error(`流水线 "${pipeline.name}" 在步骤 ${i + 1} 失败: ${errorMessage}`)
          } else if (pipeline.onStepError === 'retry') {
            // 重试逻辑（简化版，只重试一次）
            if (this.config.enableExecutionLog) {
              console.log(`[AgentOrchestrator] 重试步骤 ${i + 1}`)
            }
            const output = await this.executeSingle(currentInput, context, step.agentType)
            outputs.push(output)
          }
          // 'continue' 策略：跳过错误，继续执行下一步
        }
      }
      
      if (this.config.enableExecutionLog) {
        console.log(`[AgentOrchestrator] 流水线执行完成: ${pipeline.name}，共 ${outputs.length} 个输出`)
      }
      
      return outputs
    } finally {
      // 清理 AbortController
      this.abortController = null
    }
  }
  
  // ==================== 消息传递 ====================
  
  /**
   * 发送消息给指定 Agent
   * 
   * @param message - 消息对象
   */
  async sendMessage(message: AgentMessage): Promise<void> {
    if (!this.config.enableMessagePassing) {
      console.warn('[AgentOrchestrator] 消息传递功能未启用')
      return
    }
    
    // 将消息加入队列
    this.messageQueue.push(message)
    
    if (this.config.enableExecutionLog) {
      console.log(`[AgentOrchestrator] 发送消息: ${message.from} -> ${message.to || 'broadcast'}, 类型: ${message.type}`)
    }
    
    // 异步处理消息
    if (!this.isProcessingMessages) {
      this.processMessageQueue()
    }
  }
  
  /**
   * 订阅消息
   * 
   * @param agentType - Agent 类型（或 'broadcast' 接收所有消息）
   * @param handler - 消息处理器
   */
  subscribeMessages(agentType: AgentType | 'broadcast', handler: AgentMessageHandler): void {
    if (!this.messageHandlers.has(agentType)) {
      this.messageHandlers.set(agentType, new Set())
    }
    
    this.messageHandlers.get(agentType)!.add(handler)
    
    if (this.config.enableExecutionLog) {
      console.log(`[AgentOrchestrator] Agent "${agentType}" 订阅消息`)
    }
  }
  
  /**
   * 取消订阅消息
   * 
   * @param agentType - Agent 类型
   * @param handler - 消息处理器
   */
  unsubscribeMessages(agentType: AgentType | 'broadcast', handler: AgentMessageHandler): void {
    const handlers = this.messageHandlers.get(agentType)
    if (handlers) {
      handlers.delete(handler)
      
      if (handlers.size === 0) {
        this.messageHandlers.delete(agentType)
      }
    }
  }
  
  /**
   * 处理消息队列
   */
  private async processMessageQueue(): Promise<void> {
    if (this.isProcessingMessages || this.messageQueue.length === 0) {
      return
    }
    
    this.isProcessingMessages = true
    
    try {
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift()!
        
        // 发送给指定接收者
        if (message.to) {
          const handlers = this.messageHandlers.get(message.to)
          if (handlers) {
            for (const handler of handlers) {
              await handler(message)
            }
          }
        }
        
        // 发送给广播订阅者
        const broadcastHandlers = this.messageHandlers.get('broadcast')
        if (broadcastHandlers) {
          for (const handler of broadcastHandlers) {
            await handler(message)
          }
        }
      }
    } finally {
      this.isProcessingMessages = false
    }
  }
  
  // ==================== 记忆共享 ====================
  
  /**
   * 保存 Agent 记忆
   * 
   * 功能说明：
   * - 如果设置了 MemoryManager，将记忆持久化到数据库和 Chroma
   * - 否则，仅保存在内存中
   * 
   * @param agentType - Agent 类型
   * @param content - 记忆内容
   * @param metadata - 元数据
   */
  async saveAgentMemory(
    agentType: AgentType,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!this.config.enableMemorySharing) {
      return
    }
    
    // 如果设置了 MemoryManager，持久化记忆
    if (this.memoryManager && this.currentProjectId) {
      try {
        // 生成向量（如果设置了 EmbeddingClient）
        let embedding: number[] | undefined = undefined
        if (this.embeddingClient) {
          try {
            embedding = await this.embeddingClient.embed(content)
          } catch (error) {
            console.warn(`[AgentOrchestrator] 生成向量失败，将仅保存到数据库:`, error)
          }
        }
        
        // 保存到 MemoryManager（短期记忆）
        const memoryId = await this.memoryManager.writeShortTermMemory(
          this.currentProjectId,
          metadata?.chapterId as string || `agent_${agentType}`,
          content,
          embedding,
          {
            sourceAgent: agentType,
            ...metadata
          }
        )
        
        if (this.config.enableExecutionLog) {
          console.log(`[AgentOrchestrator] Agent "${agentType}" 的记忆已持久化（ID: ${memoryId}）`)
        }
        
        // 同时保存在内存中（用于快速访问）
        this.saveMemoryToMemory(agentType, content, metadata)
        
      } catch (error) {
        console.error(`[AgentOrchestrator] 持久化 Agent "${agentType}" 的记忆失败:`, error)
        // 失败时降级到内存存储
        this.saveMemoryToMemory(agentType, content, metadata)
      }
    } else {
      // 未设置 MemoryManager 或 projectId，仅保存在内存中
      this.saveMemoryToMemory(agentType, content, metadata)
      
      if (this.config.enableExecutionLog) {
        if (!this.memoryManager) {
          console.warn(`[AgentOrchestrator] MemoryManager 未设置，记忆仅保存在内存中`)
        }
        if (!this.currentProjectId) {
          console.warn(`[AgentOrchestrator] 当前项目 ID 未设置，记忆仅保存在内存中`)
        }
      }
    }
  }
  
  /**
   * 将记忆保存到内存中（私有方法）
   */
  private saveMemoryToMemory(
    agentType: AgentType,
    content: string,
    metadata?: Record<string, unknown>
  ): void {
    const memory: AgentMemoryRecord = {
      id: this.generateMemoryId(),
      sourceAgent: agentType,
      content,
      metadata,
      createdAt: Date.now()
    }
    
    if (!this.agentMemories.has(agentType)) {
      this.agentMemories.set(agentType, [])
    }
    
    this.agentMemories.get(agentType)!.push(memory)
    
    if (this.config.enableExecutionLog) {
      console.log(`[AgentOrchestrator] 保存 Agent "${agentType}" 的记忆（共 ${this.agentMemories.get(agentType)!.length} 条）`)
    }
  }
  
  /**
   * 获取 Agent 记忆
   * 
   * @param agentType - Agent 类型（可选，不指定则返回所有 Agent 的记忆）
   * @param limit - 返回的最大记录数
   * @returns 记忆记录数组
   */
  getAgentMemories(agentType?: AgentType, limit: number = 100): AgentMemoryRecord[] {
    if (agentType) {
      const memories = this.agentMemories.get(agentType) || []
      return memories.slice(-limit)
    } else {
      // 返回所有 Agent 的记忆（按时间排序）
      const allMemories: AgentMemoryRecord[] = []
      for (const memories of this.agentMemories.values()) {
        allMemories.push(...memories)
      }
      return allMemories
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(-limit)
    }
  }
  
  /**
   * 清除 Agent 记忆
   * 
   * @param agentType - Agent 类型（可选，不指定则清除所有记忆）
   */
  clearAgentMemories(agentType?: AgentType): void {
    if (agentType) {
      this.agentMemories.delete(agentType)
    } else {
      this.agentMemories.clear()
    }
    
    if (this.config.enableExecutionLog) {
      console.log(`[AgentOrchestrator] 清除 Agent 记忆: ${agentType || 'all'}`)
    }
  }
  
  /**
   * 搜索 Agent 记忆
   * 
   * 功能说明：
   * - 如果设置了 MemoryManager，使用它进行检索（支持关键字和语义搜索）
   * - 否则，从内存中检索（简单文本匹配）
   * 
   * @param query - 搜索查询
   * @param options - 搜索选项
   * @returns Promise<MemoryRecord[]> - 相关的记忆记录数组
   */
  async searchAgentMemories(
    query: string,
    options?: {
      agentType?: AgentType
      maxResults?: number
      strategy?: 'keyword' | 'semantic' | 'hybrid'
    }
  ): Promise<import('@/memory/MemoryManager').MemoryRecord[]> {
    // 如果设置了 MemoryManager，使用它进行检索
    if (this.memoryManager && this.currentProjectId) {
      try {
        const results = await this.memoryManager.searchByKeyword(query, {
          projectId: this.currentProjectId,
          maxResults: options?.maxResults || 10
        })
        
        // 如果指定了 agentType，过滤结果
        if (options?.agentType) {
          return results.filter(r => 
            r.metadata && r.metadata['sourceAgent'] === options.agentType
          )
        }
        
        return results
      } catch (error) {
        console.error('[AgentOrchestrator] 从 MemoryManager 检索记忆失败:', error)
        // 失败时降级到内存检索
        return this.searchMemoriesFromMemory(query, options)
      }
    } else {
      // 未设置 MemoryManager 或 projectId，从内存中检索
      return this.searchMemoriesFromMemory(query, options)
    }
  }
  
  /**
   * 从内存中搜索记忆（私有方法）
   */
  private searchMemoriesFromMemory(
    query: string,
    options?: {
      agentType?: AgentType
      maxResults?: number
    }
  ): import('@/memory/MemoryManager').MemoryRecord[] {
    const queryLower = query.toLowerCase()
    let memories: AgentMemoryRecord[] = []
    
    // 收集记忆
    if (options?.agentType) {
      memories = this.agentMemories.get(options.agentType) || []
    } else {
      for (const mems of this.agentMemories.values()) {
        memories.push(...mems)
      }
    }
    
    // 简单文本匹配
    const matched = memories.filter(m => 
      m.content.toLowerCase().includes(queryLower)
    )
    
    // 按时间排序（新的在前）
    matched.sort((a, b) => b.createdAt - a.createdAt)
    
    // 限制结果数量
    const maxResults = options?.maxResults || 10
    const limited = matched.slice(0, maxResults)
    
    // 转换为 MemoryRecord 格式
    return limited.map(m => ({
      id: m.id,
      projectId: this.currentProjectId || '',
      memoryType: 'short' as const,
      contentType: 'chapter' as const,
      content: m.content,
      importance: 5,
      metadata: m.metadata,
      createdAt: m.createdAt,
      lastAccessedAt: m.createdAt
    }))
  }
  
  // ==================== 执行记录管理 ====================
  
  /**
   * 获取执行记录
   * 
   * @param executionId - 执行 ID
   */
  getExecutionRecord(executionId: string): AgentExecutionRecord | undefined {
    return this.executionRecords.get(executionId)
  }
  
  /**
   * 获取所有执行记录
   */
  getAllExecutionRecords(): AgentExecutionRecord[] {
    return Array.from(this.executionRecords.values())
  }
  
  /**
   * 清除执行记录
   */
  clearExecutionRecords(): void {
    this.executionRecords.clear()
  }
  
  // ==================== 工具方法 ====================
  
  /**
   * 从 AgentInput 推断 Agent 类型
   */
  private inferAgentTypeFromInput(input: AgentInput): AgentType {
    return input.type as AgentType
  }
  
  /**
   * 生成执行 ID
   */
  private generateExecutionId(): string {
    this.executionIdCounter++
    return `exec_${Date.now()}_${this.executionIdCounter}`
  }
  
  /**
   * 生成记忆 ID
   */
  private generateMemoryId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }
  
  /**
   * 获取最新的执行 ID
   */
  private getLatestExecutionId(): string {
    return `exec_${Date.now()}_${this.executionIdCounter}`
  }
  
  /**
   * 带超时和取消支持的执行
   * @param fn - 要执行的函数
   * @param timeoutMs - 超时时间（毫秒）
   * @param signal - 可选的 AbortSignal，用于支持取消
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    signal?: AbortSignal
  ): Promise<T> {
    // 如果已经取消，直接抛出错误
    if (signal?.aborted) {
      throw new Error('执行已取消')
    }
    
    // 创建超时 Promise
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`执行超时（${timeoutMs}ms）`))
      }, timeoutMs)
    })
    
    // 创建取消 Promise
    let abortPromise: Promise<T> | null = null
    if (signal) {
      abortPromise = new Promise<T>((_, reject) => {
        const onAbort = () => {
          reject(new Error('执行已取消'))
        }
        
        if (signal.aborted) {
          // 已经取消了，直接 reject
          onAbort()
        } else {
          signal.addEventListener('abort', onAbort, { once: true })
        }
      })
    }
    
    // 使用 Promise.race 来竞争
    const promises: Promise<T>[] = [fn(), timeoutPromise]
    if (abortPromise) {
      promises.push(abortPromise)
    }
    
    try {
      const result = await Promise.race(promises)
      // 清除超时
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      // 清理 abort listener
      if (signal) {
        signal.removeEventListener('abort', () => {})
      }
      return result
    } catch (error) {
      // 清除超时
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      throw error
    }
  }
  
  /**
   * 销毁编排器（清除所有状态）
   */
  destroy(): void {
    this.agents.clear()
    this.executionRecords.clear()
    this.messageHandlers.clear()
    this.messageQueue = []
    this.agentMemories.clear()
    this.executionIdCounter = 0
    
    if (this.config.enableExecutionLog) {
      console.log('[AgentOrchestrator] 编排器已销毁')
    }
  }
}
