import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'
import { PromptLoader, AGENT_CATEGORY_MAP, AGENT_PROMPT_NAME_MAP } from '@/utils/promptLoader'
import type { ForeshadowResponseData } from '@/types/llm-response'

/**
 * 伏笔管理 Agent（质量保障组）
 * 
 * 功能说明：
 * - 扫描章节，识别和追踪伏笔
 * - 支持三种工作模式：scan（扫描）、status（状态查询）、remind（写作提醒）
 * - 接入 StoryState.pendingHooks，实现伏笔的自动追踪和管理
 * 
 * 已从文件加载提示词：prompts/d_分析推理/foreshadow_agent/system_prompt.md
 */
export class ForeshadowAgent extends BaseAgent {
  /** Agent 类型标识 */
  readonly agentType = 'foreshadow' as const

  /** 
   * 加载 System Prompt（从文件，带缓存）
   */
  private systemPromptCache: string | null = null

  /**
   * 获取 System Prompt（从文件加载，带缓存）
   */
  private async getSystemPrompt(): Promise<string> {
    if (this.systemPromptCache) {
      return this.systemPromptCache
    }

    const category = AGENT_CATEGORY_MAP[this.agentType] || 'd_分析推理'
    const agentName = AGENT_PROMPT_NAME_MAP[this.agentType] || 'foreshadow_agent'

    // 加载 System Prompt
    const systemPrompt = await PromptLoader.loadSystemPrompt(category, agentName)

    // 加载 Few-shot 示例（如果有），追加到 System Prompt 后面
    const fewShot = await PromptLoader.loadFewShotExamples(category, agentName)

    // 组装最终 System Prompt
    this.systemPromptCache = systemPrompt + (fewShot ? '\n\n---\n\n' + fewShot : '')

    return this.systemPromptCache
  }

  /**
   * 清除提示词缓存（当提示词文件更新时调用）
   */
  clearPromptCache(): void {
    this.systemPromptCache = null
    PromptLoader.clearCache()
  }

  /**
   * 构建 User Prompt
   */
  private buildUserPrompt(input: AgentInput, context: AgentContext): string {
    const project = context.project
    const chapterId = input.type === 'foreshadow' ? (input as any).chapterId : ''
    const mode = input.type === 'foreshadow' ? (input as any).mode : 'scan'

    let userPrompt = `# 伏笔管理工作模式：${mode}\n\n`

    // ★ 从 StoryState.pendingHooks 读取伏笔库
    if (project.storyState?.pendingHooks) {
      const hooks = project.storyState.pendingHooks
      if (hooks.length > 0) {
        userPrompt += `## 当前伏笔库（来自StoryState）\n\n`
        
        const openHooks = hooks.filter((h: any) => h.status === 'open')
        const progressingHooks = hooks.filter((h: any) => h.status === 'progressing')
        const resolvedHooks = hooks.filter((h: any) => h.status === 'resolved')

        if (openHooks.length > 0) {
          userPrompt += `### 待回收伏笔（${openHooks.length}条）\n\n`
          for (const hook of openHooks) {
            userPrompt += `- ID: ${hook.id} | [${hook.urgency}紧迫] 「${hook.description}」`
            if (hook.relatedCharacters && hook.relatedCharacters.length > 0) {
              const charNames = hook.relatedCharacters.map((id: string) => {
                const char = project.characters.find((c: any) => c.id === id)
                return char?.name || id
              })
              userPrompt += ` | 相关角色：${charNames.join('、')}`
            }
            userPrompt += ` | 埋于：${hook.plantedChapter}\n`
          }
          userPrompt += '\n'
        }

        if (progressingHooks.length > 0) {
          userPrompt += `### 推进中的伏笔（${progressingHooks.length}条）\n\n`
          for (const hook of progressingHooks) {
            userPrompt += `- ID: ${hook.id} | 「${hook.description}」 | 埋于：${hook.plantedChapter}\n`
          }
          userPrompt += '\n'
        }

        if (mode === 'status' && resolvedHooks.length > 0) {
          userPrompt += `### 已回收伏笔（${resolvedHooks.length}条）\n\n`
          for (const hook of resolvedHooks) {
            userPrompt += `- ID: ${hook.id} | 「${hook.description}」 | 回收于：${hook.resolvedChapter || '?'} | 回收方式：${hook.resolution || '?'}\n`
          }
          userPrompt += '\n'
        }
      } else {
        userPrompt += `## 当前伏笔库\n\n暂无记录的伏笔。\n\n`
      }
    }

    // 当前章节内容（提取伏笔模式）
    if (mode === 'scan' && chapterId) {
      for (const vol of project.volumes) {
        const chapter = vol.chapters.find((c: any) => c.id === chapterId)
        if (chapter && chapter.content) {
          userPrompt += `## 当前章节内容\n\n${chapter.content}\n\n`
          break
        }
      }
    }

    // 即将写作的章节信息（写作前提醒模式）
    if (mode === 'remind' && chapterId) {
      userPrompt += `## 即将写作的章节信息\n\n`
      userPrompt += `章节ID：${chapterId}\n\n`
      
      // 提供高紧迫度伏笔提醒
      const highUrgencyHooks = project.storyState?.pendingHooks.filter(
        (h: any) => h.status !== 'resolved' && h.urgency === 'high'
      ) || []
      
      if (highUrgencyHooks.length > 0) {
        userPrompt += `### 高紧迫度伏笔提醒\n\n`
        for (const hook of highUrgencyHooks) {
          userPrompt += `- 「${hook.description}」应在本章或近期回收\n`
        }
        userPrompt += '\n'
      }
    }

    // 世界观摘要
    if (project.worldSettings?.rules) {
      userPrompt += `## 相关背景信息\n\n${project.worldSettings.rules}\n\n`
    }

    userPrompt += '---\n\n请根据工作模式，按照 system prompt 中的 JSON 格式输出结果。'

    return userPrompt
  }

  /**
   * 执行伏笔管理（非流式，返回 JSON 格式）
   * 
   * 流程：
   * 1. 检查输入类型
   * 2. 构建上下文和 User Prompt
   * 3. 加载 System Prompt（从文件）
   * 4. 调用 LLM 并解析 JSON 响应
   * 5. 返回 AgentOutput
   */
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    if (input.type !== 'foreshadow') {
      throw new Error('ForeshadowAgent 收到了错误的输入类型')
    }

    const mode = (input as any).mode || 'scan'
    const ctx = await this.buildContext(input, context)
    const userPrompt = this.buildUserPrompt(input, context)

    // 加载 System Prompt
    const systemPrompt = await this.getSystemPrompt()

    const messages = [
      { role: 'system' as const, content: systemPrompt + '\n\n' + ctx },
      { role: 'user' as const, content: userPrompt }
    ]

    // 使用 callLLMJSON 调用 LLM 并解析 JSON
    const response = await this.callLLMJSON<{ success: boolean; data: ForeshadowResponseData; message?: string }>(messages, context)

    // 检查响应是否成功
    if (!response.success) {
      throw new Error(response.message || '伏笔管理失败')
    }

    // 返回伏笔管理结果
    const { hooks, statistics } = response.data

    return {
      content: JSON.stringify(response.data, null, 2),
      metadata: {
        foreshadowManagement: true,
        mode,
        hookCount: hooks?.length || 0,
        statistics
      }
    }
  }
}
