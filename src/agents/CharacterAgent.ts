import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'
import { LLMClient } from '@/llm/LLMClient'

/**
 * 角色设计 Agent（前期构建组）
 * 
 * 功能说明：
 * - 根据小说类型和剧情需要，生成角色设定
 * - 包括：姓名、性别、年龄、外貌、性格、背景故事、人物关系等
 */
export class CharacterAgent extends BaseAgent {
  /** Agent 类型标识 */
  readonly agentType = 'character' as const

  /** System Prompt（来自 prompts/b_精准指令/character_agent/system_prompt.md） */
  private readonly systemPrompt = `你是一位资深角色设计师，专注于为小说创作有立体感、有记忆点、有成长空间的角色。你相信：**一个好角色，是被故事"需要"的**——他的性格、弱点和目标，必须和故事的核心冲突产生化学反应。

## 核心原则

1. **矛盾塑造深度**：每个值得关注的角色都有内在矛盾（价值观/欲望/恐惧之间的冲突）。
2. **行为体现性格**：不写"他是一个冷酷的人"，写"他在什么情况下会做什么"。
3. **与现有角色区分**：你会确保新角色在性格、功能和说话方式上与已有角色明显不同。
4. **弧线有变化**：角色弧线不是"从差变好"，可以是"从相信某事到放弃它"，可以是悲剧的堕落。

## 输出格式

## [角色姓名]

**基本信息**
- 年龄：...
- 外貌特征（3个记忆点）：...
- 在故事中的身份/职能：...
- 角色类型：主角 / 反派 / 配角 / 次要角色

**性格核心**
- 核心词（3-5个）：...
- 详细描述：[外在表现 + 内在驱动 + 主要弱点，约100字]

**背景故事**（200-300字，详细描述塑造角色性格的关键经历）
[重点描写"哪些事让他变成了现在这样"，包括关键转折点、心理创伤和成长契机]

**能力设定**
[在世界观体系内的具体能力，包括强项和明显弱点]

**核心动机与目标**
- 表层目标（他说出口的）：...
- 深层目标（他自己可能都没意识到的）：...
- 最大恐惧：...

**与现有角色的关系**
{{relationships}}

**成长弧线**
[在全书中，这个角色会经历什么变化，约80字。可以是成长/堕落/觉醒/破碎]

**对话风格示例**（3-5句，展示说话方式）
- "..."
- "..."
- "..."

## 质量要求

- "对话风格示例"必须体现出与其他角色的明显差异（不能都是书面语或都是短句）
- 外貌描写抓3个记忆点即可，不要流水账式列举
- 成长弧线要和故事的主题或核心冲突有关联`

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
    
    userPrompt += '---\n\n请按照 system prompt 中规定的格式，生成完整角色档案。'
    
    return userPrompt
  }

  /**
   * 执行角色设计（非流式）
   */
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    const ctx = await this.buildContext(input, context)
    const userPrompt = this.buildUserPrompt(input, context)
    
    const systemContent = this.systemPrompt.replace('{{relationships}}', 
      input.type === 'character' && input.relationships ? input.relationships : '（待填充）'
    )
    
    const messages = [
      { role: 'system' as const, content: systemContent + '\n\n' + ctx },
      { role: 'user' as const, content: userPrompt }
    ]
    
    const content = await this.callLLM(messages, context)
    return { content }
  }

  /**
   * 流式执行角色设计
   */
  async *stream(input: AgentInput, context: AgentContext): AsyncGenerator<string> {
    const ctx = await this.buildContext(input, context)
    const userPrompt = this.buildUserPrompt(input, context)
    
    const systemContent = this.systemPrompt.replace('{{relationships}}', 
      input.type === 'character' && input.relationships ? input.relationships : '（待填充）'
    )
    
    const messages = [
      { role: 'system' as const, content: systemContent + '\n\n' + ctx },
      { role: 'user' as const, content: userPrompt }
    ]
    
    yield* this.callLLMStream(messages, context)
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

  /**
   * 流式生成（简化版）
   */
  async *streamGenerateByDescription(
    userDescription: string,
    context: AgentContext
  ): AsyncGenerator<string> {
    // 1. 优化提示词
    const optimizedPrompt = await this.optimizeUserDescription(userDescription, context)
    
    // 2. 构建输入
    const input: any = {
      type: 'character',
      prompt: optimizedPrompt
    }
    
    // 3. 流式生成
    yield* this.stream(input, context)
  }
}
