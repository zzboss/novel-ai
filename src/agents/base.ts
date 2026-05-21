import type { AgentType, AgentInput, AgentOutput, AgentContext } from './types'
import type { SkillManifest } from '@/skills/types'
import type { ModelConfig } from '@/llm/types'
import { LLMClient } from '@/llm/LLMClient'
import { buildContext as buildContextUtil } from '@/utils/contextBuilder'
import { TASK_PARAMS } from '@/llm/types'

/**
 * Agent 抽象基类
 * 
 * 设计说明：
 * - 所有具体 Agent 均需继承此类并实现 execute / stream 方法
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
 *   
 *   async *stream(input: AgentInput, context: AgentContext): AsyncGenerator<string> {
 *     const ctx = await this.buildContext(input, context)
 *     yield* this.callLLMStream([{ role: 'user', content: input.prompt }], context)
 *   }
 * }
 * ```
 */
export abstract class BaseAgent {
  /** Agent 类型标识，子类必须实现 */
  abstract readonly agentType: AgentType

  /** 已挂载的 Skill 列表 */
  protected mountedSkills: SkillManifest[] = []

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
   * 流式执行 Agent（逐 token 产出）
   * @param input - Agent 输入参数
   * @param context - Agent 执行上下文
   * @returns AsyncGenerator<string> - 异步生成器，逐 token 产出
   */
  abstract stream(input: AgentInput, context: AgentContext): AsyncGenerator<string>

  /**
   * 构建 LLM 上下文（含已挂载 Skill 的 system prompt 注入）
   * 
   * 功能说明：
   * - 调用 contextBuilder 构建基础上下文
   * - 注入已挂载 Skill 的 systemPromptSnippet
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
    return ctx
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
   * 调用 LLM（流式模式）
   *
   * 优先级：
   * 1. agentModelMapping 中当前 agentType 的专用模型
   * 2. 回退到全局 activeModelId
   * 3. 自动应用 TASK_PARAMS 中的参数（temperature、maxTokens）
   *
   * @param messages - 对话消息数组
   * @param context - Agent 执行上下文
   * @returns AsyncGenerator<string> - 异步生成器，逐 token 产出
   */
  protected async *callLLMStream(
    messages: { role: string; content: string }[],
    context: AgentContext
  ): AsyncGenerator<string> {
    const config = this.resolveModelConfig(context)
    if (!config) throw new Error(`未找到可用的模型配置，请在设置中配置模型（Agent: ${this.agentType}）`)
    
    // 自动应用 TASK_PARAMS 中的参数
    const taskParams = TASK_PARAMS[this.agentType] || TASK_PARAMS['default']
    const mergedConfig: ModelConfig = {
      ...config,
      temperature: taskParams.temperature ?? config.temperature ?? 0.7,
      maxTokens: taskParams.maxTokens ?? config.maxTokens ?? 4096
    }
    
    yield* LLMClient.stream(mergedConfig, messages as { role: 'system' | 'user' | 'assistant'; content: string }[], this.agentType)
  }

  /**
   * 解析当前 Agent 应使用的模型配置
   * 优先读 agentModelMapping，未配置则回退到 activeModelId
   */
  protected resolveModelConfig(context: AgentContext): ModelConfig | null {
    const mapping = context.config.agentModelMapping || {}
    const modelId = mapping[this.agentType] || context.config.activeModelId
    return context.config.models.find((m: ModelConfig) => m.id === modelId) || null
  }
}
