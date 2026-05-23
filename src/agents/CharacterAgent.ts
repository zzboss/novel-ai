import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'
import { LLMClient } from '@/llm/LLMClient'
import type { CharacterResponseData } from '@/types/llm-response'
import { PromptLoader, AGENT_CATEGORY_MAP, AGENT_PROMPT_NAME_MAP } from '@/utils/promptLoader'

/**
 * 角色设计 Agent（前期构建组）
 * 
 * 功能说明：
 * - 根据小说类型和剧情需要，生成角色设定
 * - 包括：姓名、性别、年龄、外貌、性格、背景故事、人物关系等
 * - 从文件加载提示词：prompts/b_精准指令/character_agent/system_prompt.md
 */
export class CharacterAgent extends BaseAgent {
  /** Agent 类型标识 */
  readonly agentType = 'character' as const

  /** 
   * 加载 System Prompt（从文件）
   */
  private async getSystemPrompt(): Promise<string> {
    try {
      const prompt = await PromptLoader.loadSystemPrompt(
        AGENT_CATEGORY_MAP.character,
        AGENT_PROMPT_NAME_MAP.character
      )
      return prompt
    } catch (error) {
      console.error('[CharacterAgent] 加载 system_prompt 失败，使用默认提示词:', error)
      // 返回默认提示词（简化版）
      return `你是一位资深角色设计师，专注于为小说创作有立体感、有记忆点、有成长空间的角色。

## 输出格式要求

**重要：你必须返回严格的 JSON 格式！**

输出格式如下：
\`\`\`json
{
  "success": true,
  "data": {
    "character": {
      "id": "char_001",
      "name": "角色名称",
      "gender": "male",
      "personality": ["性格特征1", "性格特征2"],
      "background": "背景故事",
      "goals": ["目标1", "目标2"],
      "relationships": []
    }
  }
}
\`\`\`

---\n\n**重要提醒：只返回 JSON，不要返回其他内容！**`
    }
  }

  /**
   * 构建 User Prompt
   */
  private buildUserPrompt(input: AgentInput, context: AgentContext): string {
    const project = context.project
    const prompt = input.type === 'character' ? input.prompt : ''
    const relationships = input.type === 'character' ? input.relationships : undefined
    
    let userPrompt = `# 请根据以下信息，为这个角色生成完整的角色档案。\n\n`
    
    userPrompt += `## 项目背景\n\n`
    userPrompt += `**故事简介**：${(project as any).idea || '未填写'}\n`
    userPrompt += `**类型**：${project.projectType || '不限'}\n`
    userPrompt += `**世界观摘要**：${(project as any).worldSettings?.summary || '未填写'}\n\n`
    
    // 已有角色列表
    const existingChars = (project as any).characters || []
    if (existingChars.length > 0) {
      userPrompt += `## 已有角色列表（避免重复）\n\n`
      userPrompt += existingChars.map((c: any) => `${c.name} | ${c.role || '配角'} | ${c.personality || '...'}`).join('\n') + '\n\n'
    }
    
    userPrompt += `## 新角色需求\n\n`
    userPrompt += `**用户描述**：\n${prompt}\n\n`
    
    if (relationships) {
      userPrompt += `**与现有角色的关系**：\n${relationships}\n\n`
    }
    
    // 注入已挂载 Skill 的内容
    const skillSnippets = this.mountedSkills
      .map(s => s.systemPromptSnippet)
      .filter(Boolean)
      .join('\n\n')
    
    if (skillSnippets) {
      userPrompt += `## Skill 注入（如有）\n${skillSnippets}\n\n`
    }
    
    userPrompt += '---\n\n请按照 system prompt 中规定的 JSON 格式，生成完整角色档案。'
    
    return userPrompt
  }

  /**
   * 执行角色设计（非流式，返回 JSON 格式）
   * 
   * 流程：
   * 1. 加载 System Prompt（从文件）
   * 2. 构建上下文和 User Prompt
   * 3. 调用 LLM 并解析 JSON 响应
   * 4. 提取角色数据
   * 5. 返回 AgentOutput
   */
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    const ctx = await this.buildContext(input, context)
    const userPrompt = this.buildUserPrompt(input, context)
    
    // 加载 System Prompt（从文件）
    const systemPrompt = await this.getSystemPrompt()
    
    const messages = [
      { role: 'system' as const, content: systemPrompt + '\n\n' + ctx },
      { role: 'user' as const, content: userPrompt }
    ]
    
    // 调用 LLM 并解析 JSON 响应
    const response = await this.callLLMJSON<{ success: boolean; data: CharacterResponseData; message?: string }>(messages, context)
    
    // 检查响应是否成功
    if (!response.success) {
      throw new Error(response.message || '角色生成失败')
    }
    
    const { character } = response.data
    
    // 返回角色内容（JSON 字符串）
    return {
      content: JSON.stringify(character, null, 2),
      metadata: {
        characterId: character.id,
        characterName: character.name,
        gender: character.gender,
        personalityCount: character.personality.length,
        hasRelationships: character.relationships && character.relationships.length > 0
      }
    }
  }

  /**
   * 根据用户描述生成角色（简化版）
   * @param userDescription 用户描述或关键词
   * @param context 上下文
   */
  async generateByDescription(
    userDescription: string,
    context: AgentContext
  ): Promise<string> {
    // 1. 构建优化后的提示词
    const optimizedPrompt = await this.optimizeUserDescription(userDescription, context)
    
    // 2. 构建输入
    const input: any = {
      type: 'character',
      prompt: optimizedPrompt
    }
    
    // 3. 执行生成
    const output = await this.execute(input, context)
    
    return output.content
  }

  /**
   * 优化用户描述（私有方法）
   */
  private async optimizeUserDescription(
    userDescription: string,
    context: AgentContext
  ): Promise<string> {
    const project = context.project
    
    const optimizationPrompt = `你是角色生成的提示词优化专家。请将用户的简单描述优化为专业的角色生成提示词。

用户原始输入:
${userDescription}

项目背景:
- 故事类型: ${project.projectType || '未指定'}
- 故事简介: ${(project as any).idea || '未指定'}
- 世界观: ${(project as any).worldSettings?.summary || '未指定'}

已有角色:
${(project as any).characters?.map((c: any) => `- ${c.name} (${c.role})`).join('\n') || '无'}

请执行以下优化:
1. 提取用户描述中的关键信息（性别、年龄、性格、背景、能力等）
2. 补充缺失的重要信息（基于项目背景和已有角色）
3. 结构化输出，确保包含: 基本信息、性格核心、背景故事、能力设定、核心动机、人物关系、成长弧线、对话风格
4. 避免与已有角色重复

输出格式: 直接输出优化后的角色生成提示词，不要添加任何解释。`

    // 调用LLM优化（使用低温度，保证稳定性）
    const messages = [
      { role: 'system' as const, content: '你是提示词优化专家，擅长将简单描述转化为结构化提示词。' },
      { role: 'user' as const, content: optimizationPrompt }
    ]
    
    // 直接调用 LLMClient，传递 temperature 选项（通过修改 config）
    const config = this.resolveModelConfig(context)
    if (!config) throw new Error('未找到可用的模型配置')
    
    // 注意：LLMClient.chat 不支持第3个参数，若需调整 temperature，需在 config 中设置
    const optimizedPrompt = await LLMClient.chat(config, messages)
    
    return optimizedPrompt
  }
}