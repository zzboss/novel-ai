/**
 * LLM 提供商类型
 * 支持云端模型（OpenAI/Claude/通义/DeepSeek/豆包/GLM/Gemini）
 * 以及本地模型（Ollama/LM Studio）
 */
export type LLMProviderType =
  | 'openai'
  | 'claude'
  | 'qwen'
  | 'deepseek'
  | 'doubao'
  | 'GLM'
  | 'gemini'
  | 'ollama'
  | 'lmstudio'
  | 'custom'

/**
 * 任务类型到模型参数的映射
 * 不同的 Agent 使用不同的 temperature 和 maxTokens 参数
 * 
 * 设计原则：
 * - 需要稳定性的任务（outline、consistency）→ 低 temperature
 * - 需要创造力的任务（chapter、character）→ 中高 temperature
 * - 需要精确性的任务（polish、continue）→ 低 temperature
 * - 需要多样性的任务（dialogue）→ 高 temperature
 */
export const TASK_PARAMS: Record<string, Partial<ModelConfig>> = {
  /** 大纲规划：需要稳定性，确保结构正确 */
  outline:   { temperature: 0.5, maxTokens: 4096 },
  
  /** 章节写作：需要创造力，但也要保证质量 */
  chapter:   { temperature: 0.4, maxTokens: 6144 },
  
  /** 角色创建：需要多样性，生成不同特点的角色 */
  character: { temperature: 0.6, maxTokens: 2048 },
  
  /** 世界构建：需要逻辑性，确保设定自洽 */
  world:     { temperature: 0.3, maxTokens: 4096 },
  
  /** 创意生成：需要多样性，激发创意 */
  idea:      { temperature: 0.7, maxTokens: 2048 },
  
  /** 场景描写：需要创造力，生成生动的场景 */
  scene:     { temperature: 0.6, maxTokens: 3072 },
  
  /** 一致性检查：需要严谨性，准确发现问题 */
  consistency: { temperature: 0.2, maxTokens: 2048 },
  
  /** 润色修改：需要精确性，精准修改 */
  polish:    { temperature: 0.3, maxTokens: 4096 },
  
  /** 续写：需要平衡，既要连贯又要创新 */
  continue:  { temperature: 0.5, maxTokens: 4096 },
  
  /** 默认参数（兜底） */
  default:   { temperature: 0.7, maxTokens: 4096 }
}

/** 消息角色类型 */
export type MessageRole = 'system' | 'user' | 'assistant'

/**
 * 对话消息接口
 * 用于与 LLM API 进行交互的标准消息格式
 */
export interface LLMMessage {
  /** 消息角色 */
  role: MessageRole
  /** 消息内容 */
  content: string
}

/**
 * 模型配置接口
 * 存储每个 LLM 提供商的具体配置信息
 */
export interface ModelConfig {
  /** 唯一标识符 */
  id: string
  /** 用户自定义的模型名称 */
  name: string
  /** LLM 提供商类型 */
  provider: LLMProviderType
  /** 模型名称（如 gpt-4, claude-3 等） */
  model: string
  /** 自定义 API 端点（可选，用于私有化部署） */
  baseURL?: string
  /** API 密钥（仅云端模型需要） */
  apiKey?: string
  /** 温度参数，控制生成随机性（0-2，默认 0.7） */
  temperature?: number
  /** 最大生成 token 数 */
  maxTokens?: number
  /** 超时时间（毫秒），默认：本地模型 300000，云端模型 120000 */
  timeout?: number
  /** 上下文窗口大小（token 数） */
  contextWindow?: number
  /** 是否为本地模型（本地模型无需 API Key） */
  isLocal: boolean
  /** 是否为默认模型 */
  isDefault: boolean
}

/**
 * LLM 适配器接口
 * 所有 LLM 提供商适配器均需实现此接口
 */
export interface LLMAdapter {
  /**
   * 普通对话调用
   * @param messages - 对话消息数组
   * @param config - 模型配置
   * @returns 模型生成的完整回复字符串
   */
  chat(messages: LLMMessage[], config: ModelConfig): Promise<string>

  /**
   * 流式对话调用
   * @param messages - 对话消息数组
   * @param config - 模型配置
   * @returns 异步生成器，逐 token 产出生成内容
   */
  stream(messages: LLMMessage[], config: ModelConfig): AsyncGenerator<string>

  /**
   * 健康检查（可选）
   * @param config - 模型配置
   * @returns 健康状态对象
   */
  healthCheck?(config: ModelConfig): Promise<{ ok: boolean; models?: string[]; error?: string }>
}

/**
 * 流式输出回调函数接口
 * 用于监听流式输出的各个阶段
 */
export interface StreamCallbacks {
  /** 收到新 token 时的回调 */
  onToken: (token: string) => void
  /** 流式输出完成时的回调 */
  onDone: () => void
  /** 发生错误时的回调 */
  onError: (error: Error) => void
}

/**
 * 健康状态接口
 * 用于记录 LLM 提供商的健康检查状态
 */
export interface HealthStatus {
  /** LLM 提供商类型 */
  provider: LLMProviderType
  /** 是否健康可用 */
  ok: boolean
  /** 错误信息（如有） */
  error?: string
  /** 响应延迟（毫秒） */
  latency?: number
}
