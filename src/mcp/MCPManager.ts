/**
 * MCP 连接管理器
 * 
 * 核心职责：
 * - MCP 服务器连接管理（启动、停止、重启）
 * - MCP 工具调用（listTools, callTool）
 * - MCP 资源访问（listResources, readResource）
 * - MCP 消息处理（请求、响应、通知）
 * 
 * 设计模式：
 * - 单例模式（通过 getInstance() 获取实例）
 * - 观察者模式（事件监听）
 * - 连接池模式（管理多个 MCP 服务器连接）
 * 
 * 使用示例：
 * ```typescript
 * const manager = MCPManager.getInstance()
 * 
 * // 添加服务器配置
 * manager.addServerConfig({
 *   id: 'knowledge-base',
 *   name: '知识库服务器',
 *   type: 'stdio',
 *   command: 'node',
 *   args: ['mcp-servers/knowledge-base/server.js'],
 *   autoStart: true
 * })
 * 
 * // 启动服务器
 * await manager.startServer('knowledge-base')
 * 
 * // 调用工具
 * const result = await manager.callTool('knowledge-base', 'searchKnowledge', {
 *   query: '小说创作技巧',
 *   maxResults: 5
 * })
 * ```
 */

import type {
  MCPManagerConfig,
  MCPServerConfig,
  MCPServerStatus,
  MCPClientConfig,
  MCPTool,
  MCPToolCall,
  MCPToolResult,
  MCPResource,
  MCPResourceContent,
  MCPEvent,
  MCPEventHandler,
  MCPRequest,
  MCPResponse,
  MCPNotification
} from './types'

import {
  DEFAULT_MCP_MANAGER_CONFIG
} from './types'

/**
 * MCP 连接管理器类
 */
export class MCPManager {
  // ==================== 单例模式 ====================
  
  private static instance: MCPManager | null = null
  
  /**
   * 获取管理器单例
   */
  static getInstance(config?: Partial<MCPManagerConfig>): MCPManager {
    if (!MCPManager.instance) {
      MCPManager.instance = new MCPManager(config)
    } else if (config) {
      // 如果提供了新配置，更新现有实例的配置
      MCPManager.instance.updateConfig(config)
    }
    return MCPManager.instance
  }
  
  /**
   * 重置单例（主要用于测试）
   */
  static resetInstance(): void {
    MCPManager.instance = null
  }
  
  // ==================== 实例属性 ====================
  
  /** 管理器配置 */
  private config: MCPManagerConfig
  
  /** 服务器配置映射（serverId -> 配置） */
  private serverConfigs: Map<string, MCPServerConfig> = new Map()
  
  /** 服务器状态映射（serverId -> 状态） */
  private serverStatuses: Map<string, MCPServerStatus> = new Map()
  
  /** 服务器进程映射（serverId -> 进程） */
  private serverProcesses: Map<string, any> = new Map()
  
  /** 客户端配置映射（clientId -> 配置） */
  private clientConfigs: Map<string, MCPClientConfig> = new Map()
  
  /** 事件处理器映射（eventType -> 处理器数组） */
  private eventHandlers: Map<string, Set<MCPEventHandler>> = new Map()
  
  /** 请求映射（requestId -> 解析器） */
  private pendingRequests: Map<string, {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
    timeoutId: number
  }> = new Map()
  
  /** 请求 ID 计数器 */
  private requestIdCounter = 0
  
  // ==================== 构造函数 ====================
  
  private constructor(config?: Partial<MCPManagerConfig>) {
    this.config = {
      ...DEFAULT_MCP_MANAGER_CONFIG,
      ...config
    }
    
    // 加载配置的服务器和客户端
    for (const serverConfig of this.config.servers) {
      this.serverConfigs.set(serverConfig.id, serverConfig)
    }
    
    for (const clientConfig of this.config.clients) {
      this.clientConfigs.set(clientConfig.id, clientConfig)
    }
    
    if (this.config.enableLogging) {
      console.log('[MCPManager] 初始化完成，已加载', 
        this.serverConfigs.size, '个服务器配置，',
        this.clientConfigs.size, '个客户端配置')
    }
  }
  
  // ==================== 配置管理 ====================
  
  /**
   * 更新管理器配置
   */
  updateConfig(config: Partial<MCPManagerConfig>): void {
    this.config = {
      ...this.config,
      ...config
    }
  }
  
  /**
   * 获取当前配置
   */
  getConfig(): MCPManagerConfig {
    return { ...this.config }
  }
  
  // ==================== 服务器配置管理 ====================
  
  /**
   * 添加服务器配置
   * @param config - 服务器配置
   */
  addServerConfig(config: MCPServerConfig): void {
    this.serverConfigs.set(config.id, config)
    
    // 初始化服务器状态
    this.serverStatuses.set(config.id, {
      serverId: config.id,
      isRunning: false,
      tools: [],
      resources: []
    })
    
    if (this.config.enableLogging) {
      console.log(`[MCPManager] 添加服务器配置: ${config.name} (${config.id})`)
    }
  }
  
  /**
   * 移除服务器配置
   * @param serverId - 服务器 ID
   */
  removeServerConfig(serverId: string): void {
    // 先停止服务器
    if (this.isServerRunning(serverId)) {
      this.stopServer(serverId).catch(error => {
        console.error(`[MCPManager] 停止服务器失败: ${serverId}`, error)
      })
    }
    
    this.serverConfigs.delete(serverId)
    this.serverStatuses.delete(serverId)
    
    if (this.config.enableLogging) {
      console.log(`[MCPManager] 移除服务器配置: ${serverId}`)
    }
  }
  
  /**
   * 获取服务器配置
   * @param serverId - 服务器 ID
   * @returns 服务器配置或 undefined
   */
  getServerConfig(serverId: string): MCPServerConfig | undefined {
    return this.serverConfigs.get(serverId)
  }
  
  /**
   * 获取所有服务器配置
   * @returns 服务器配置数组
   */
  getAllServerConfigs(): MCPServerConfig[] {
    return Array.from(this.serverConfigs.values())
  }
  
  /**
   * 更新服务器配置
   * @param serverId - 服务器 ID
   * @param config - 新的配置（部分）
   */
  updateServerConfig(serverId: string, config: Partial<MCPServerConfig>): void {
    const existingConfig = this.serverConfigs.get(serverId)
    if (!existingConfig) {
      throw new Error(`服务器配置不存在: ${serverId}`)
    }
    
    const updatedConfig = {
      ...existingConfig,
      ...config
    }
    
    this.serverConfigs.set(serverId, updatedConfig)
    
    if (this.config.enableLogging) {
      console.log(`[MCPManager] 更新服务器配置: ${serverId}`)
    }
  }
  
  // ==================== 服务器连接管理 ====================
  
  /**
   * 启动服务器
   * @param serverId - 服务器 ID
   * @returns Promise<void>
   */
  async startServer(serverId: string): Promise<void> {
    const config = this.serverConfigs.get(serverId)
    if (!config) {
      throw new Error(`服务器配置不存在: ${serverId}`)
    }
    
    if (!config.enabled) {
      throw new Error(`服务器已禁用: ${serverId}`)
    }
    
    if (this.isServerRunning(serverId)) {
      if (this.config.enableLogging) {
        console.warn(`[MCPManager] 服务器已在运行: ${serverId}`)
      }
      return
    }
    
    try {
      if (this.config.enableLogging) {
        console.log(`[MCPManager] 启动服务器: ${config.name} (${serverId})`)
      }
      
      // 根据服务器类型启动
      if (config.type === 'stdio') {
        await this.startStdioServer(config)
      } else if (config.type === 'sse') {
        await this.startSSEServer(config)
      } else if (config.type === 'websocket') {
        await this.startWebSocketServer(config)
      } else {
        throw new Error(`不支持的服务器类型: ${config.type}`)
      }
      
      // 更新状态
      const status = this.serverStatuses.get(serverId)
      if (status) {
        status.isRunning = true
        status.startTime = Date.now()
        status.stopTime = undefined
        status.error = undefined
      }
      
      // 触发事件
      this.emitEvent({
        type: 'server-started',
        serverId,
        timestamp: Date.now()
      })
      
      if (this.config.enableLogging) {
        console.log(`[MCPManager] 服务器启动成功: ${serverId}`)
      }
    } catch (error) {
      // 更新状态
      const status = this.serverStatuses.get(serverId)
      if (status) {
        status.error = error instanceof Error ? error.message : String(error)
      }
      
      // 触发事件
      this.emitEvent({
        type: 'server-error',
        serverId,
        data: { error },
        timestamp: Date.now()
      })
      
      throw error
    }
  }
  
  /**
   * 停止服务器
   * @param serverId - 服务器 ID
   * @returns Promise<void>
   */
  async stopServer(serverId: string): Promise<void> {
    const config = this.serverConfigs.get(serverId)
    if (!config) {
      throw new Error(`服务器配置不存在: ${serverId}`)
    }
    
    if (!this.isServerRunning(serverId)) {
      if (this.config.enableLogging) {
        console.warn(`[MCPManager] 服务器未在运行: ${serverId}`)
      }
      return
    }
    
    try {
      if (this.config.enableLogging) {
        console.log(`[MCPManager] 停止服务器: ${config.name} (${serverId})`)
      }
      
      // 根据服务器类型停止
      if (config.type === 'stdio') {
        await this.stopStdioServer(config)
      } else if (config.type === 'sse') {
        await this.stopSSEServer(config)
      } else if (config.type === 'websocket') {
        await this.stopWebSocketServer(config)
      }
      
      // 更新状态
      const status = this.serverStatuses.get(serverId)
      if (status) {
        status.isRunning = false
        status.stopTime = Date.now()
      }
      
      // 触发事件
      this.emitEvent({
        type: 'server-stopped',
        serverId,
        timestamp: Date.now()
      })
      
      if (this.config.enableLogging) {
        console.log(`[MCPManager] 服务器停止成功: ${serverId}`)
      }
    } catch (error) {
      // 更新状态
      const status = this.serverStatuses.get(serverId)
      if (status) {
        status.error = error instanceof Error ? error.message : String(error)
      }
      
      // 触发事件
      this.emitEvent({
        type: 'server-error',
        serverId,
        data: { error },
        timestamp: Date.now()
      })
      
      throw error
    }
  }
  
  /**
   * 重启服务器
   * @param serverId - 服务器 ID
   * @returns Promise<void>
   */
  async restartServer(serverId: string): Promise<void> {
    if (this.isServerRunning(serverId)) {
      await this.stopServer(serverId)
    }
    
    await this.startServer(serverId)
  }
  
  /**
   * 检查服务器是否正在运行
   * @param serverId - 服务器 ID
   * @returns 是否正在运行
   */
  isServerRunning(serverId: string): boolean {
    const status = this.serverStatuses.get(serverId)
    return status?.isRunning || false
  }
  
  /**
   * 获取服务器状态
   * @param serverId - 服务器 ID
   * @returns 服务器状态或 undefined
   */
  getServerStatus(serverId: string): MCPServerStatus | undefined {
    return this.serverStatuses.get(serverId)
  }
  
  /**
   * 获取所有服务器状态
   * @returns 服务器状态数组
   */
  getAllServerStatuses(): MCPServerStatus[] {
    return Array.from(this.serverStatuses.values())
  }
  
  // ==================== MCP 工具调用 ====================
  
  /**
   * 获取服务器可用工具列表
   * @param serverId - 服务器 ID
   * @returns Promise<MCPTool[]>
   */
  async listTools(serverId: string): Promise<MCPTool[]> {
    if (!this.isServerRunning(serverId)) {
      throw new Error(`服务器未在运行: ${serverId}`)
    }
    
    // TODO: 实际实现需要发送 MCP 请求到服务器
    // 暂时返回空数组
    if (this.config.enableLogging) {
      console.log(`[MCPManager] 获取服务器工具列表: ${serverId}`)
    }
    
    const status = this.serverStatuses.get(serverId)
    return status?.tools || []
  }
  
  /**
   * 调用 MCP 工具
   * @param serverId - 服务器 ID
   * @param toolName - 工具名称
   * @param args - 工具参数
   * @returns Promise<MCPToolResult>
   */
  async callTool(
    serverId: string, 
    toolName: string, 
    args: Record<string, unknown>
  ): Promise<MCPToolResult> {
    if (!this.isServerRunning(serverId)) {
      throw new Error(`服务器未在运行: ${serverId}`)
    }
    
    const requestId = this.generateRequestId()
    
    if (this.config.enableLogging) {
      console.log(`[MCPManager] 调用工具: ${serverId}/${toolName}`, args)
    }
    
    try {
      // 构造 MCP 请求
      const request: MCPRequest = {
        id: requestId,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        },
        timestamp: Date.now()
      }
      
      // TODO: 实际实现需要发送请求到服务器并等待响应
      // 暂时返回模拟结果
      const result: MCPToolResult = {
        success: true,
        content: [
          {
            type: 'text',
            text: `模拟工具调用结果: ${toolName}`
          }
        ]
      }
      
      // 触发事件
      this.emitEvent({
        type: 'tool-called',
        serverId,
        data: { toolName, args, result },
        timestamp: Date.now()
      })
      
      if (this.config.enableLogging) {
        console.log(`[MCPManager] 工具调用成功: ${serverId}/${toolName}`)
      }
      
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // 触发事件
      this.emitEvent({
        type: 'server-error',
        serverId,
        data: { error, toolName, args },
        timestamp: Date.now()
      })
      
      return {
        success: false,
        error: errorMessage
      }
    }
  }
  
  // ==================== MCP 资源访问 ====================
  
  /**
   * 获取服务器可用资源列表
   * @param serverId - 服务器 ID
   * @returns Promise<MCPResource[]>
   */
  async listResources(serverId: string): Promise<MCPResource[]> {
    if (!this.isServerRunning(serverId)) {
      throw new Error(`服务器未在运行: ${serverId}`)
    }
    
    // TODO: 实际实现需要发送 MCP 请求到服务器
    // 暂时返回空数组
    if (this.config.enableLogging) {
      console.log(`[MCPManager] 获取服务器资源列表: ${serverId}`)
    }
    
    const status = this.serverStatuses.get(serverId)
    return status?.resources || []
  }
  
  /**
   * 读取 MCP 资源
   * @param serverId - 服务器 ID
   * @param uri - 资源 URI
   * @returns Promise<MCPResourceContent>
   */
  async readResource(serverId: string, uri: string): Promise<MCPResourceContent> {
    if (!this.isServerRunning(serverId)) {
      throw new Error(`服务器未在运行: ${serverId}`)
    }
    
    if (this.config.enableLogging) {
      console.log(`[MCPManager] 读取资源: ${serverId}/${uri}`)
    }
    
    try {
      // 构造 MCP 请求
      const requestId = this.generateRequestId()
      const request: MCPRequest = {
        id: requestId,
        method: 'resources/read',
        params: {
          uri
        },
        timestamp: Date.now()
      }
      
      // TODO: 实际实现需要发送请求到服务器并等待响应
      // 暂时返回模拟结果
      const content: MCPResourceContent = {
        uri,
        text: `模拟资源内容: ${uri}`,
        mimeType: 'text/plain'
      }
      
      // 触发事件
      this.emitEvent({
        type: 'resource-read',
        serverId,
        data: { uri, content },
        timestamp: Date.now()
      })
      
      if (this.config.enableLogging) {
        console.log(`[MCPManager] 资源读取成功: ${serverId}/${uri}`)
      }
      
      return content
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // 触发事件
      this.emitEvent({
        type: 'server-error',
        serverId,
        data: { error, uri },
        timestamp: Date.now()
      })
      
      throw error
    }
  }
  
  // ==================== 事件管理 ====================
  
  /**
   * 添加事件监听器
   * @param eventType - 事件类型
   * @param handler - 事件处理器
   */
  on(eventType: string, handler: MCPEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set())
    }
    
    this.eventHandlers.get(eventType)!.add(handler)
  }
  
  /**
   * 移除事件监听器
   * @param eventType - 事件类型
   * @param handler - 事件处理器
   */
  off(eventType: string, handler: MCPEventHandler): void {
    const handlers = this.eventHandlers.get(eventType)
    if (handlers) {
      handlers.delete(handler)
    }
  }
  
  /**
   * 触发事件
   * @param event - 事件
   */
  private emitEvent(event: MCPEvent): void {
    const handlers = this.eventHandlers.get(event.type)
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event)
        } catch (error) {
          console.error(`[MCPManager] 事件处理器错误: ${event.type}`, error)
        }
      }
    }
  }
  
  // ==================== 私有方法 ====================
  
  /**
   * 启动 stdio 类型服务器
   * @param config - 服务器配置
   */
  private async startStdioServer(config: MCPServerConfig): Promise<void> {
    // TODO: 实际实现需要启动子进程
    // 暂时模拟启动
    if (this.config.enableLogging) {
      console.log(`[MCPManager] 启动 stdio 服务器: ${config.command} ${config.args?.join(' ')}`)
    }
    
    // 模拟启动延迟
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  /**
   * 停止 stdio 类型服务器
   * @param config - 服务器配置
   */
  private async stopStdioServer(config: MCPServerConfig): Promise<void> {
    // TODO: 实际实现需要终止子进程
    // 暂时模拟停止
    if (this.config.enableLogging) {
      console.log(`[MCPManager] 停止 stdio 服务器: ${config.id}`)
    }
    
    // 模拟停止延迟
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  /**
   * 启动 SSE 类型服务器
   * @param config - 服务器配置
   */
  private async startSSEServer(config: MCPServerConfig): Promise<void> {
    // TODO: 实际实现需要建立 SSE 连接
    // 暂时模拟启动
    if (this.config.enableLogging) {
      console.log(`[MCPManager] 启动 SSE 服务器: ${config.url}`)
    }
    
    // 模拟启动延迟
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  /**
   * 停止 SSE 类型服务器
   * @param config - 服务器配置
   */
  private async stopSSEServer(config: MCPServerConfig): Promise<void> {
    // TODO: 实际实现需要关闭 SSE 连接
    // 暂时模拟停止
    if (this.config.enableLogging) {
      console.log(`[MCPManager] 停止 SSE 服务器: ${config.id}`)
    }
    
    // 模拟停止延迟
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  /**
   * 启动 WebSocket 类型服务器
   * @param config - 服务器配置
   */
  private async startWebSocketServer(config: MCPServerConfig): Promise<void> {
    // TODO: 实际实现需要建立 WebSocket 连接
    // 暂时模拟启动
    if (this.config.enableLogging) {
      console.log(`[MCPManager] 启动 WebSocket 服务器: ${config.url}`)
    }
    
    // 模拟启动延迟
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  /**
   * 停止 WebSocket 类型服务器
   * @param config - 服务器配置
   */
  private async stopWebSocketServer(config: MCPServerConfig): Promise<void> {
    // TODO: 实际实现需要关闭 WebSocket 连接
    // 暂时模拟停止
    if (this.config.enableLogging) {
      console.log(`[MCPManager] 停止 WebSocket 服务器: ${config.id}`)
    }
    
    // 模拟停止延迟
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  /**
   * 生成请求 ID
   * @returns 请求 ID
   */
  private generateRequestId(): string {
    this.requestIdCounter++
    return `req_${Date.now()}_${this.requestIdCounter}`
  }
  
  /**
   * 销毁管理器（清除所有状态）
   */
  destroy(): void {
    // 停止所有服务器
    for (const serverId of this.serverConfigs.keys()) {
      if (this.isServerRunning(serverId)) {
        this.stopServer(serverId).catch(error => {
          console.error(`[MCPManager] 停止服务器失败: ${serverId}`, error)
        })
      }
    }
    
    // 清除所有状态
    this.serverConfigs.clear()
    this.serverStatuses.clear()
    this.serverProcesses.clear()
    this.clientConfigs.clear()
    this.eventHandlers.clear()
    this.pendingRequests.clear()
    this.requestIdCounter = 0
    
    if (this.config.enableLogging) {
      console.log('[MCPManager] 管理器已销毁')
    }
  }
}
