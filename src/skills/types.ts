/**
 * Skill 依赖接口
 */
export interface SkillDependency {
  /** 依赖的 Skill ID */
  skillId: string
  /** 版本要求（语义化版本范围，可选） */
  versionRange?: string
}

/**
 * Skill 清单（Manifest）接口
 * 
 * 功能说明：
 * - 定义 Skill 的元数据信息
 * - 描述 Skill 的适用场景和权限需求
 * - 作为 Skill 注册和发现的基础
 * - 支持依赖管理
 * 
 * 使用场景：
 * - Skill 注册时提供元数据
 * - Agent 执行前查找适用的 Skill
 * - UI 展示 Skill 信息
 * - 依赖检查和管理
 */
export interface SkillManifest {
  /** Skill 唯一标识符 */
  id: string
  /** Skill 显示名称 */
  name: string
  /** 版本号（语义化版本） */
  version: string
  /** Skill 功能描述 */
  description: string
  /** 作者信息 */
  author: string
  /** 适用的 Agent 类型列表，空数组表示全部适用 */
  applicableAgents: string[]
  /** 注入到 system prompt 的片段（可选） */
  systemPromptSnippet?: string
  /** Skill 入口文件相对路径 */
  entry: string
  /** 是否需要 tool-call 权限（需用户显式授权） */
  requiresToolCall: boolean
  /** 依赖的 Skill 列表（可选） */
  dependencies?: SkillDependency[]
}

/**
 * Skill 执行上下文接口
 * 
 * 功能说明：
 * - 提供 Skill 执行时所需的全部上下文信息
 * - 包含项目状态、Agent 输入和 LLM 客户端
 * 
 * 使用场景：
 * - Web Worker 沙箱中执行 Skill 时传入
 * - Skill 需要访问项目数据或调用 LLM 时使用
 */
export interface SkillContext {
  /** 项目状态，包含世界观、角色、章节等信息 */
  project: import('@/stores/project').ProjectState
  /** Agent 输入参数，包含任务类型和具体参数 */
  input: import('@/agents/types').AgentInput
  /** LLM 客户端，用于调用大模型（可选） */
  llmClient: typeof import('@/llm/LLMClient').LLMClient
}

/**
 * Skill 执行结果接口
 * 
 * 功能说明：
 * - 定义 Skill 执行后的返回结果格式
 * - 包含输出内容、Token 使用情况和错误信息
 */
export interface SkillResult {
  /** Skill 生成的输出内容 */
  output: string
  /** Token 使用情况（可选） */
  usage?: { promptTokens: number; completionTokens: number }
  /** 错误信息（如有） */
  error?: string
}
