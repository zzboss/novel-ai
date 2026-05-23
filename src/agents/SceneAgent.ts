import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'
import { PromptLoader, AGENT_CATEGORY_MAP, AGENT_PROMPT_NAME_MAP } from '@/utils/promptLoader'
import type { SceneResponseData } from '@/types/llm-response'

/**
 * 场景扩写 Agent（写作辅助组）
 * 
 * 功能说明：
 * - 对场景描述进行扩写，增加画面感和沉浸感
 * - 支持指定场景地点
 * - 强调五感描写（视觉、听觉、嗅觉、触觉、味觉）
 * - 从文件加载提示词：prompts/b_精准指令/scene_agent/system_prompt.md
 */
export class SceneAgent extends BaseAgent {
  /** Agent 类型标识 */
  readonly agentType = 'scene' as const

  /** 
   * 加载 System Prompt（从文件）
   */
  private async getSystemPrompt(): Promise<string> {
    try {
      const prompt = await PromptLoader.loadSystemPrompt(
        AGENT_CATEGORY_MAP.scene,
        AGENT_PROMPT_NAME_MAP.scene
      )
      return prompt
    } catch (error) {
      console.error('[SceneAgent] 加载 system_prompt 失败，使用默认提示词:', error)
      // 返回默认提示词（简化版）
      return `你是一位场景描写专家，擅长将"一句话场景"扩写成充满感官细节、情绪浸透的沉浸式场景。
      
## 输出格式要求
      
**重要：你必须返回严格的 JSON 格式！**
      
输出格式如下：
\`\`\`json
{
  "success": true,
  "data": {
    "sceneText": "扩写后的场景正文",
    "sensoryDetails": {
      "visual": ["视觉细节1"],
      "auditory": ["听觉细节1"],
      "olfactory": ["嗅觉细节1"],
      "tactile": ["触觉细节1"],
      "taste": ["味觉细节1"]
    },
    "mood": "场景的情绪氛围",
    "anchoringDetails": ["细节锚点1"]
  }
}
\`\`\`

---

**重要提醒：只返回 JSON，不要返回其他内容！**`
    }
  }

  /**
   * 构建 User Prompt
   */
  private buildUserPrompt(input: AgentInput, context: AgentContext): string {
    const prompt = input.type === 'scene' ? input.prompt : ''
    
    let userPrompt = `# 请将以下简短场景描述扩写为沉浸式场景描写。\n\n`
    
    // 场景描述
    userPrompt += `## 场景描述\n\n${prompt}\n\n`
    
    // 场景用途
    const scenePurpose = (input as any).scenePurpose || '标准场景'
    userPrompt += `## 场景用途\n\n${scenePurpose}\n\n`
    
    // 角色情绪状态
    const characterEmotion = (input as any).characterEmotion || ''
    if (characterEmotion) {
      userPrompt += `## 角色情绪状态\n\n${characterEmotion}\n\n`
    }
    
    // 输出字数
    const wordCount = (input as any).wordCount || '300'
    userPrompt += `## 输出字数\n\n${wordCount}字标准版\n\n`
    
    // 文风要求
    const project = context.project
    const styleNotes = (project as any).tone || ''
    if (styleNotes) {
      userPrompt += `## 文风要求（可选）\n\n${styleNotes}\n\n`
    }
    
    // 注入已挂载 Skill 的内容
    const skillSnippets = this.mountedSkills
      .map(s => s.systemPromptSnippet)
      .filter(Boolean)
      .join('\n\n')
    
    if (skillSnippets) {
      userPrompt += `## Skill 注入（如有）\n\n${skillSnippets}\n\n`
    }
    
    userPrompt += '---\n\n请按照 system prompt 中的要求，返回严格的 JSON 格式。'
    
    return userPrompt
  }

  /**
   * 执行场景扩写（非流式，返回 JSON 格式）
   * 
   * 流程：
   * 1. 构建上下文和 User Prompt
   * 2. 加载 System Prompt（从文件）
   * 3. 调用 LLM 并解析 JSON 响应
   * 4. 提取场景扩写结果
   * 5. 返回 AgentOutput
   */
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    const ctx = await this.buildContext(input, context)
    const userPrompt = this.buildUserPrompt(input, context)
    
    // 加载 System Prompt
    const systemPrompt = await this.getSystemPrompt()
    
    const messages = [
      { role: 'system' as const, content: systemPrompt + '\n\n' + ctx },
      { role: 'user' as const, content: userPrompt }
    ]
    
    // 使用 callLLMJSON 调用 LLM 并解析 JSON
    const response = await this.callLLMJSON<{ success: boolean; data: SceneResponseData; message?: string }>(messages, context)
    
    // 检查响应是否成功
    if (!response.success) {
      console.error('[SceneAgent] LLM 调用失败:', response.message)
      return {
        content: '',
        metadata: {
          error: response.message || 'LLM 调用失败',
          sceneExpansion: true
        }
      }
    }
    
    // 返回场景扩写结果
    const { sceneText, sensoryDetails, mood, anchoringDetails } = response.data
    
    return {
      content: sceneText || '',
      metadata: {
        sensoryDetails: sensoryDetails || {},
        mood: mood || '',
        anchoringDetails: anchoringDetails || [],
        sceneExpansion: true
      }
    }
  }
}
