import type { AgentType, AgentInput, AgentOutput, AgentContext } from './types'
import type { SkillManifest } from '@/skills/types'
import type { ModelConfig } from '@/llm/types'
import { LLMClient } from '@/llm/LLMClient'
import { buildContext as buildContextUtil } from '@/utils/contextBuilder'
import { TASK_PARAMS } from '@/llm/types'

// 延迟导入 RAGRetriever 以避免循环依赖
// 注意：import() 类型运算符返回的是类的实例类型
type RAGRetrieverType = import('@/memory/RAGRetriever').RAGRetriever

// 延迟导入 MCPManager 以避免循环依赖
// 注意：import() 类型运算符返回的是类的实例类型
type MCPManagerType = import('@/mcp/MCPManager').MCPManager

/**
 * Agent 抽象基类
 * 
 * 设计说明：
 * - 所有具体 Agent 均需继承此类并实现 execute 方法
 * - 提供通用功能：Skill 挂载、上下文构建、LLM 调用
 * - 使用模板方法模式，子类只需关注具体业务逻辑
 * 
 * 使用示例：
 * ```typescript
 * export class IdeaAgent extends BaseAgent {
 *   readonly agentType = 'idea' as const
 *   
 *   async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
 *     const ctx = await this.buildContext(input, context)
 *     const response = await this.callLLM([{ role: 'user', content: input.prompt }], context)
 *     return { content: response }
 *   }
 * }
 * ```
 */
export abstract class BaseAgent {
  /** Agent 类型标识，子类必须实现 */
  abstract readonly agentType: AgentType
  
  /** 已挂载的 Skill 列表 */
  protected mountedSkills: SkillManifest[] = []
  
  /** RAG 检索器（可选，用于检索相关记忆） */
  protected ragRetriever?: RAGRetrieverType
  
  /** MCP 管理器（可选，用于调用 MCP 工具） */
  protected mcpManager?: MCPManagerType
  
  /**
   * 挂载 Skill
   * @param skill - 要挂载的 Skill 清单对象
   */
  mountSkill(skill: SkillManifest): void {
    if (!this.mountedSkills.find(s => s.id === skill.id)) {
      this.mountedSkills.push(skill)
    }
  }
  
  /**
   * 设置 RAG 检索器
   * @param retriever - RAG 检索器实例
   */
  setRAGRetriever(retriever: RAGRetrieverType): void {
    this.ragRetriever = retriever
  }
  
  /**
   * 清除 RAG 检索器
   */
  clearRAGRetriever(): void {
    this.ragRetriever = undefined
  }
  
  /**
   * 设置 MCP 管理器
   * @param manager - MCPManager 实例
   */
  setMCPManager(manager: MCPManagerType): void {
    this.mcpManager = manager
  }
  
  /**
   * 清除 MCP 管理器
   */
  clearMCPManager(): void {
    this.mcpManager = undefined
  }
  
  /**
   * 检索相关记忆
   * 
   * 功能说明：
   * - 使用 RAGRetriever 进行混合检索（关键字 + 语义）
   * - 返回相关的 MemoryRecord 数组
   * 
   * @param query - 检索查询文本
   * @param options - 检索选项（可选）
   * @returns Promise<MemoryRecord[]> - 相关的记忆记录数组
   */
  protected async retrieveRelevantMemories(
    query: string,
    options?: { maxResults?: number; strategy?: 'keyword' | 'semantic' | 'hybrid' }
  ): Promise<import('@/memory/MemoryManager').MemoryRecord[]> {
    if (!this.ragRetriever) {
      console.warn(`[BaseAgent] Agent "${this.agentType}" 未设置 RAG 检索器，跳过记忆检索`)
      return []
    }
    
    try {
      const results = await this.ragRetriever.retrieve(query, {
        maxResults: options?.maxResults || 5,
        strategy: options?.strategy || 'hybrid'
      })
      
      // 提取 MemoryRecord
      return results.map(r => r.record)
    } catch (error) {
      console.error(`[BaseAgent] Agent "${this.agentType}" 记忆检索失败:`, error)
      return []
    }
  }
  
  /**
   * 格式化记忆为上下文字符串
   * 
   * @param memories - 记忆记录数组
   * @returns 格式化后的上下文字符串
   */
  protected formatMemories(memories: import('@/memory/MemoryManager').MemoryRecord[]): string {
    if (memories.length === 0) {
      return ''
    }
    
    let formatted = '\n\n## 相关记忆\n'
    
    for (const memory of memories) {
      formatted += `\n### ${memory.memoryType || '记忆'}`
      
      if (memory.chapterId) {
        formatted += ` (章节: ${memory.chapterId})`
      }
      
      formatted += `\n${memory.content}\n`
    }
    
    return formatted
  }

  /**
   * 卸载 Skill
   * @param skillId - 要卸载的 Skill ID
   */
  unmountSkill(skillId: string): void {
    this.mountedSkills = this.mountedSkills.filter(s => s.id !== skillId)
  }

  /**
   * 执行 Agent（非流式，返回完整结果）
   * @param input - Agent 输入参数
   * @param context - Agent 执行上下文
   * @returns Promise<AgentOutput> - Agent 输出结果
   */
  abstract execute(input: AgentInput, context: AgentContext): Promise<AgentOutput>


  /**
   * 构建 LLM 上下文（含已挂载 Skill 的 system prompt 注入和 RAG 检索）
   * 
   * 功能说明：
   * - 调用 contextBuilder 构建基础上下文
   * - 注入已挂载 Skill 的 systemPromptSnippet
   * - 如果设置了 RAG 检索器，自动检索相关记忆并注入上下文
   * - 子类可重写此方法以自定义上下文构建逻辑
   * 
   * @param input - Agent 输入参数
   * @param context - Agent 执行上下文
   * @returns 构建好的上下文字符串
   */
  protected async buildContext(input: AgentInput, context: AgentContext): Promise<string> {
    let ctx = buildContextUtil(context.project, input)

    // 注入已挂载 Skill 的 system prompt
    for (const skill of this.mountedSkills) {
      if (skill.systemPromptSnippet) {
        ctx += `\n\n[Skill: ${skill.name}]\n${skill.systemPromptSnippet}`
      }
    }
    
    // 集成 RAG 检索：自动检索相关记忆
    if (this.ragRetriever) {
      // 从输入中提取查询文本
      const query = this.extractQueryFromInput(input)
      
      if (query) {
        try {
          const memories = await this.retrieveRelevantMemories(query, { maxResults: 5 })
          const memoriesText = this.formatMemories(memories)
          ctx += memoriesText
          
          if (memories.length > 0) {
            console.log(`[BaseAgent] Agent "${this.agentType}" 检索到 ${memories.length} 条相关记忆`)
          }
        } catch (error) {
          console.error(`[BaseAgent] Agent "${this.agentType}" RAG 检索失败:`, error)
          // 检索失败时不影响主流程，继续构建上下文
        }
      }
    }
    
    return ctx
  }
  
  /**
   * 从 AgentInput 中提取查询文本
   * 
   * 功能说明：
   * - 尝试从 input 中提取合适的查询文本用于 RAG 检索
   * - 优先级：prompt > content > chapterId + outline
   * 
   * @param input - Agent 输入
   * @returns 查询文本，如果没有则返回空字符串
   */
  protected extractQueryFromInput(input: AgentInput): string {
    // 尝试不同的字段
    if ('prompt' in input && input.prompt) {
      return input.prompt
    }
    
    if ('content' in input && input.content) {
      return input.content
    }
    
    if ('outline' in input && input.outline) {
      return input.outline
    }
    
    // 如果没有合适的字段，使用 input.type 作为查询
    return input.type
  }

  /**
   * 调用 LLM（普通模式）
   *
   * 优先级：
   * 1. agentModelMapping 中当前 agentType 的专用模型
   * 2. 回退到全局 activeModelId
   * 3. 自动应用 TASK_PARAMS 中的参数（temperature、maxTokens）
   *
   * @param messages - 对话消息数组
   * @param context - Agent 执行上下文
   * @returns 模型生成的完整回复字符串
   */
  protected async callLLM(messages: { role: string; content: string }[], context: AgentContext): Promise<string> {
    const config = this.resolveModelConfig(context)
    if (!config) throw new Error(`未找到可用的模型配置，请在设置中配置模型（Agent: ${this.agentType}）`)
    
    // 自动应用 TASK_PARAMS 中的参数
    const taskParams = TASK_PARAMS[this.agentType] || TASK_PARAMS['default']
    const mergedConfig: ModelConfig = {
      ...config,
      temperature: taskParams.temperature ?? config.temperature ?? 0.7,
      maxTokens: taskParams.maxTokens ?? config.maxTokens ?? 4096
    }
    
    return LLMClient.chat(mergedConfig, messages as { role: 'system' | 'user' | 'assistant'; content: string }[], this.agentType)
  }

  /**
   * 调用 LLM 并解析 JSON 响应
   * 
   * 功能说明：
   * - 调用 LLM 获取完整响应
   * - 自动清理并解析 JSON
   * - 返回解析后的对象
   * 
   * 优先级：
   * 1. agentModelMapping 中当前 agentType 的专用模型
   * 2. 回退到全局 activeModelId
   * 3. 自动应用 TASK_PARAMS 中的参数（temperature、maxTokens）
   *
   * @param messages - 对话消息数组
   * @param context - Agent 执行上下文
   * @returns 解析后的 JSON 对象
   */
  protected async callLLMJSON<T = any>(
    messages: { role: string; content: string }[],
    context: AgentContext
  ): Promise<T> {
    const config = this.resolveModelConfig(context)
    if (!config) throw new Error(`未找到可用的模型配置，请在设置中配置模型（Agent: ${this.agentType}）`)
    
    // 自动应用 TASK_PARAMS 中的参数
    const taskParams = TASK_PARAMS[this.agentType] || TASK_PARAMS['default']
    const mergedConfig: ModelConfig = {
      ...config,
      temperature: taskParams.temperature ?? config.temperature ?? 0.7,
      maxTokens: taskParams.maxTokens ?? config.maxTokens ?? 4096
    }
    
    return LLMClient.callJSON<T>(mergedConfig, messages as { role: 'system' | 'user' | 'assistant'; content: string }[], this.agentType)
  }

  /**
   * 调用 LLM（流式模式）
   *
   * 优先级：
   * 1. agentModelMapping 中当前 agentType 的专用模型
   * 2. 回退到全局 activeModelId
  /**
   * 解析当前 Agent 应使用的模型配置
   * 优先读 agentModelMapping，未配置则回退到 activeModelId
   */
  protected resolveModelConfig(context: AgentContext): ModelConfig | null {
    const mapping = context.config.agentModelMapping || {}
    const modelId = mapping[this.agentType] || context.config.activeModelId
    
    // 防御性检查：确保 models 数组存在
    const models = context.config.models || []
    if (models.length === 0) {
      console.warn(`[BaseAgent] Agent "${this.agentType}" 没有可用的模型配置`)
      return null
    }
    
    return models.find((m: ModelConfig) => m.id === modelId) || null
  }
  
  // ==================== MCP 工具调用 ====================
  
  /**
   * 调用 MCP 工具
   * 
   * 功能说明：
   * - 如果设置了 MCPManager，调用指定服务器的工具
   * - 返回工具执行结果
   * 
   * @param serverId - MCP 服务器 ID
   * @param toolName - 工具名称
   * @param args - 工具参数
   * @returns Promise<MCPToolResult> - 工具执行结果
   */
  protected async callMCPTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<import('@/mcp/types').MCPToolResult> {
    if (!this.mcpManager) {
      throw new Error(`Agent "${this.agentType}" 未设置 MCPManager，无法调用 MCP 工具`)
    }
    
    try {
      const result = await this.mcpManager.callTool(serverId, toolName, args)
      return result
    } catch (error) {
      console.error(`[BaseAgent] Agent "${this.agentType}" 调用 MCP 工具失败:`, error)
      throw error
    }
  }
  
  /**
   * 获取 MCP 服务器可用工具列表
   * 
   * @param serverId - MCP 服务器 ID
   * @returns Promise<MCPTool[]> - 工具列表
   */
  protected async listMCPTools(
    serverId: string
  ): Promise<import('@/mcp/types').MCPTool[]> {
    if (!this.mcpManager) {
      throw new Error(`Agent "${this.agentType}" 未设置 MCPManager，无法获取 MCP 工具列表`)
    }
    
    try {
      const tools = await this.mcpManager.listTools(serverId)
      return tools
    } catch (error) {
      console.error(`[BaseAgent] Agent "${this.agentType}" 获取 MCP 工具列表失败:`, error)
      throw error
    }
  }
  
  /**
   * 读取 MCP 资源
   * 
   * @param serverId - MCP 服务器 ID
   * @param uri - 资源 URI
   * @returns Promise<MCPResourceContent> - 资源内容
   */
  protected async readMCPResource(
    serverId: string,
    uri: string
  ): Promise<import('@/mcp/types').MCPResourceContent> {
    if (!this.mcpManager) {
      throw new Error(`Agent "${this.agentType}" 未设置 MCPManager，无法读取 MCP 资源`)
    }
    
    try {
      const content = await this.mcpManager.readResource(serverId, uri)
      return content
    } catch (error) {
      console.error(`[BaseAgent] Agent "${this.agentType}" 读取 MCP 资源失败:`, error)
      throw error
    }
  }
  
  /**
   * 获取 MCP 服务器可用资源列表
   * 
   * @param serverId - MCP 服务器 ID
   * @returns Promise<MCPResource[]> - 资源列表
   */
  protected async listMCPResources(
    serverId: string
  ): Promise<import('@/mcp/types').MCPResource[]> {
    if (!this.mcpManager) {
      throw new Error(`Agent "${this.agentType}" 未设置 MCPManager，无法获取 MCP 资源列表`)
    }
    
    try {
      const resources = await this.mcpManager.listResources(serverId)
      return resources
    } catch (error) {
      console.error(`[BaseAgent] Agent "${this.agentType}" 获取 MCP 资源列表失败:`, error)
      throw error
    }
  }
}
