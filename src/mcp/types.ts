/**
 * MCP (Model Context Protocol) 类型定义
 * 
 * 根据 MCP 协议规范定义相关类型
 * 参考：https://modelcontextprotocol.io/
 */

// ==================== MCP 消息类型 ====================

/**
 * MCP 消息基础接口
 */
export interface MCPMessage {
  /** 消息 ID */
  id: string
  
  /** 消息方法 */
  method: string
  
  /** 消息参数 */
  params?: Record<string, unknown>
  
  /** 消息结果 */
  result?: unknown
  
  /** 错误消息 */
  error?: MCPError
  
  /** 消息时间戳 */
  timestamp: number
}

/**
 * MCP 错误消息
 */
export interface MCPError {
  /** 错误代码 */
  code: number
  
  /** 错误消息 */
  message: string
  
  /** 错误数据 */
  data?: unknown
}

/**
 * MCP 请求消息
 */
export interface MCPRequest extends MCPMessage {
  /** 请求方法 */
  method: string
  
  /** 请求参数 */
  params?: Record<string, unknown>
}

/**
 * MCP 响应消息
 */
export interface MCPResponse extends MCPMessage {
  /** 响应结果 */
  result?: unknown
  
  /** 响应错误 */
  error?: MCPError
}

/**
 * MCP 通知消息
 */
export interface MCPNotification extends MCPMessage {
  /** 通知方法 */
  method: string
  
  /** 通知参数 */
  params?: Record<string, unknown>
  
  /** 通知不需要响应 */
  result?: never
}

// ==================== MCP 工具类型 ====================

/**
 * MCP 工具定义
 */
export interface MCPTool {
  /** 工具名称 */
  name: string
  
  /** 工具描述 */
  description: string
  
  /** 工具输入模式（JSON Schema） */
  inputSchema: Record<string, unknown>
}

/**
 * MCP 工具调用参数
 */
export interface MCPToolCall {
  /** 工具名称 */
  name: string
  
  /** 工具参数 */
  arguments: Record<string, unknown>
}

/**
 * MCP 工具调用结果
 */
export interface MCPToolResult {
  /** 是否成功 */
  success: boolean
  
  /** 结果内容 */
  content?: Array<{
    /** 内容类型 */
    type: 'text' | 'image' | 'resource'
    
    /** 文本内容 */
    text?: string
    
    /** 图片内容（base64） */
    data?: string
    
    /** 资源内容 */
    resource?: MCPResource
  }>
  
  /** 错误信息 */
  error?: string
}

// ==================== MCP 资源类型 ====================

/**
 * MCP 资源定义
 */
export interface MCPResource {
  /** 资源 URI */
  uri: string
  
  /** 资源名称 */
  name: string
  
  /** 资源描述 */
  description?: string
  
  /** 资源 MIME 类型 */
  mimeType?: string
}

/**
 * MCP 资源内容
 */
export interface MCPResourceContent {
  /** 资源 URI */
  uri: string
  
  /** 资源内容（文本内容） */
  text?: string
  
  /** 资源内容（二进制内容，base64 编码） */
  blob?: string
  
  /** 资源 MIME 类型 */
  mimeType?: string
}

// ==================== MCP 服务器类型 ====================

/**
 * MCP 服务器配置
 */
export interface MCPServerConfig {
  /** 服务器 ID */
  id: string
  
  /** 服务器名称 */
  name: string
  
  /** 服务器描述 */
  description?: string
  
  /** 服务器类型 */
  type: 'stdio' | 'sse' | 'websocket'
  
  /** 服务器命令（stdio 类型） */
  command?: string
  
  /** 服务器参数（stdio 类型） */
  args?: string[]
  
  /** 服务器环境变量（stdio 类型） */
  env?: Record<string, string>
  
  /** 服务器 URL（sse/websocket 类型） */
  url?: string
  
  /** 是否自动启动 */
  autoStart?: boolean
  
  /** 是否启用 */
  enabled?: boolean
}

/**
 * MCP 服务器状态
 */
export interface MCPServerStatus {
  /** 服务器 ID */
  serverId: string
  
  /** 是否运行中 */
  isRunning: boolean
  
  /** 启动时间 */
  startTime?: number
  
  /** 停止时间 */
  stopTime?: number
  
  /** 错误信息 */
  error?: string
  
  /** 可用工具 */
  tools: MCPTool[]
  
  /** 可用资源 */
  resources: MCPResource[]
}

// ==================== MCP 客户端类型 ====================

/**
 * MCP 客户端配置
 */
export interface MCPClientConfig {
  /** 客户端 ID */
  id: string
  
  /** 客户端名称 */
  name: string
  
  /** 连接的服务器 ID */
  serverId: string
  
  /** 是否自动重连 */
  autoReconnect?: boolean
  
  /** 重连间隔（毫秒） */
  reconnectInterval?: number
  
  /** 最大重连次数 */
  maxReconnectAttempts?: number
}

// ==================== MCP 管理器类型 ====================

/**
 * MCP 管理器配置
 */
export interface MCPManagerConfig {
  /** 服务器配置列表 */
  servers: MCPServerConfig[]
  
  /** 客户端配置列表 */
  clients: MCPClientConfig[]
  
  /** 是否启用日志 */
  enableLogging?: boolean
  
  /** 日志级别 */
  logLevel?: 'debug' | 'info' | 'warn' | 'error'
  
  /** 默认超时时间（毫秒） */
  defaultTimeout?: number
}

/**
 * 默认 MCP 管理器配置
 */
export const DEFAULT_MCP_MANAGER_CONFIG: MCPManagerConfig = {
  servers: [],
  clients: [],
  enableLogging: true,
  logLevel: 'info',
  defaultTimeout: 30000 // 30 秒
}

// ==================== MCP 事件类型 ====================

/**
 * MCP 事件类型
 */
export type MCPEventType = 
  | 'server-started'
  | 'server-stopped'
  | 'server-error'
  | 'tool-called'
  | 'resource-read'
  | 'notification'

/**
 * MCP 事件
 */
export interface MCPEvent {
  /** 事件类型 */
  type: MCPEventType
  
  /** 服务器 ID */
  serverId: string
  
  /** 事件数据 */
  data?: unknown
  
  /** 事件时间戳 */
  timestamp: number
}

/**
 * MCP 事件处理器
 */
export type MCPEventHandler = (event: MCPEvent) => void | Promise<void>

// ==================== 导出所有类型 ====================

export type {
  MCPMessage,
  MCPError,
  MCPRequest,
  MCPResponse,
  MCPNotification,
  MCPTool,
  MCPToolCall,
  MCPToolResult,
  MCPResource,
  MCPResourceContent,
  MCPServerConfig,
  MCPServerStatus,
  MCPClientConfig,
  MCPManagerConfig,
  MCPEvent,
  MCPEventHandler
}
