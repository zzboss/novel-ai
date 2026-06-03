import type { AgentInput, AgentOutput, AgentContext, QualityEvaluation, QualityLoopConfig } from './types'
import { BaseAgent } from './base'
import { buildContextPackage, contextPackageToMessages } from '@/utils/contextBuilder'
import { compileChapterIntent } from '@/utils/intentCompiler'
import { estimateTokensChinese } from '@/utils/tokenCounter'
import { PromptLoader, AGENT_CATEGORY_MAP, AGENT_PROMPT_NAME_MAP } from '@/utils/promptLoader'
import { ConsistencyAgent } from './ConsistencyAgent'
import { AntiAIAgent } from './AntiAIAgent'
import { RevisionAgent } from './RevisionAgent'
import type { ProjectState } from '@/stores/project'
import { safeJSONParse } from '@/utils/jsonCleaner'
import type { ChapterResponseData } from '@/types/llm-response'

// 延迟导入 AgentOrchestrator 以避免循环依赖
type AgentOrchestratorType = import('./orchestrator').AgentOrchestrator

/**
 * 章节写作 Agent（写作执行组，核心 Agent）
 *
 * 管线 Step 3：根据意图书 + 上下文包 + 规则栈生成章节草稿
 * 调 LLM（推荐强模型），支持流式输出
 *
 * 重构要点：
 * - 接入 ContextBuilder 分层裁剪架构
 * - 接入 IntentCompiler 意图编译
 * - 内置字数治理（目标字数 ±20%）
 * - 支持从 StoryState 筛选相关上下文
 */
export class ChapterAgent extends BaseAgent {
  readonly agentType = 'chapter' as const
  
  /**
   * 从文件加载的 System Prompt（延迟加载，首次调用时加载并缓存）
   */
  private systemPromptCache: string | null = null
  
  /** Agent 编排器（可选，用于协作模式） */
  private orchestrator: AgentOrchestratorType | null = null

  /**
   * 获取 System Prompt（从文件加载，带缓存）
   */
  private async getSystemPrompt(): Promise<string> {
    if (this.systemPromptCache) {
      return this.systemPromptCache
    }

    const category = AGENT_CATEGORY_MAP[this.agentType] || 'a_精密构造'
    const agentName = AGENT_PROMPT_NAME_MAP[this.agentType] || 'chapter_agent'
    
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
   * 设置 Agent 编排器（用于协作模式）
   * @param orchestrator - AgentOrchestrator 实例
   */
  setOrchestrator(orchestrator: AgentOrchestratorType): void {
    this.orchestrator = orchestrator
    
    // 同时为当前 Agent 设置 RAG 检索器（如果编排器有）
    // 注意：这里需要从编排器获取 RAGRetriever，暂时留空
    console.log('[ChapterAgent] AgentOrchestrator 已设置')
  }

  /**
   * 计算章节号（按卷内顺序累计）
   * @param chapterId - 目标章节ID
   * @param project - 项目状态
   * @returns 章节号（从1开始），未找到返回undefined
   */
  private getChapterNumber(chapterId: string, project: ProjectState): number | undefined {
    let count = 0
    for (const volume of project.volumes) {
      for (const chapter of volume.chapters) {
        count++
        if (chapter.id === chapterId) {
          return count
        }
      }
    }
    return undefined
  }

  /**
   * 构建章节写作的完整消息（异步，从文件加载提示词）
   */
  private async buildMessages(input: AgentInput, context: AgentContext): Promise<Array<{ role: 'system' | 'user'; content: string }>> {
    if (input.type !== 'chapter') {
      throw new Error('ChapterAgent 收到了错误的输入类型')
    }

    const { chapterId, outline, wordCount } = input
    const project = context.project

    // Step 1: 编译章节意图（不调LLM）
    const intent = compileChapterIntent(chapterId, project, project.storyState || null, {
      userIntent: outline,
      targetWordCount: wordCount
    })

    // Step 2: 构建上下文包（不调LLM，分层裁剪）
    const contextPackage = buildContextPackage(input, project, project.storyState || null, {
      intent,
      includeLastChapterEnding: true,
      lastChapterEndingWordCount: 500
    })

    // Step 3: 组装用户消息
    let userContent = ''

    // 注入章节号（用于触发黄金三章规则）
    const chapterNumber = this.getChapterNumber(chapterId, project)
    if (chapterNumber !== undefined) {
      userContent += `# 本章为第${chapterNumber}章\n\n`
      if (chapterNumber <= 3) {
        userContent += `> 黄金三章模式：请严格遵循 System Prompt 中的黄金三章特殊规则。\n\n`
      }
    }

    // 意图书
    userContent += `# 本章创作指令\n\n`
    userContent += `## 创作目标\n${intent.creativeGoal}\n\n`

    if (intent.mustInclude.length > 0) {
      userContent += `## 必须包含\n${intent.mustInclude.map(i => `- ${i}`).join('\n')}\n\n`
    }

    if (intent.mustAvoid.length > 0) {
      userContent += `## 必须避免\n${intent.mustAvoid.map(i => `- ${i}`).join('\n')}\n\n`
    }

    if (intent.conflictStrategy) {
      userContent += `## 冲突策略\n${intent.conflictStrategy}\n\n`
    }

    userContent += `## 目标字数\n${intent.targetWordCount}字（允许±20%浮动，即${Math.floor(intent.targetWordCount * 0.8)}-${Math.ceil(intent.targetWordCount * 1.2)}字）\n\n`

    if (intent.previousRecap) {
      userContent += `## 前情提要\n${intent.previousRecap}\n\n`
    }

    // 规则栈
    if (contextPackage.ruleStack.worldRules.length > 0 ||
        contextPackage.ruleStack.genreRules.length > 0 ||
        contextPackage.ruleStack.customRules.length > 0) {
      userContent += `## 规则栈\n\n`
      for (const rule of contextPackage.ruleStack.worldRules) {
        userContent += `【世界规则】${rule}\n`
      }
      for (const rule of contextPackage.ruleStack.genreRules) {
        userContent += `【类型规则】${rule}\n`
      }
      for (const rule of contextPackage.ruleStack.customRules) {
        userContent += `【风格约束】${rule}\n`
      }
      userContent += '\n'
    }

    // 转换为消息数组
    const messages = contextPackageToMessages(contextPackage, userContent)

    // 加载 System Prompt（从文件）
    const systemPrompt = await this.getSystemPrompt()

    // 在 system prompt 前面加上章节写作系统提示
    if (messages[0]?.role === 'system') {
      messages[0] = {
        ...messages[0],
        content: systemPrompt + '\n\n' + messages[0].content
      }
    } else {
      // 如果没有 system message，添加一个
      messages.unshift({ role: 'system', content: systemPrompt })
    }

    return messages
  }

  /**
   * 执行章节写作（非流式，分两步处理）
   * 
   * 流程：
   * 1. 第一步：生成正文（纯文本，不使用 JSON 格式）
   * 2. 第二步：根据正文提取元数据（返回 JSON 格式）
   * 3. 组合最终结果，返回 AgentOutput
   */
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    // ========== 第一步：生成正文 ==========
    console.log('[ChapterAgent] 第一步：生成正文...')
    
    // 构建用于生成正文的消息（system prompt 不要求 JSON 格式）
    const messagesForContent = await this.buildMessagesForContent(input, context)
    
    // 调用 LLM 生成正文（纯文本）
    const content = await this.callLLM(messagesForContent, context)
    
    console.log(`[ChapterAgent] 正文生成完成，字数：${this.countChineseWords(content)}`)
    
    // ========== 第二步：提取元数据 ==========
    console.log('[ChapterAgent] 第二步：提取元数据...')
    
    // 构建用于提取元数据的消息
    const messagesForMetadata = this.buildMessagesForMetadata(input, context, content)
    
    // 调用 LLM 提取元数据（返回 JSON 格式）
    const metadata = await this.callLLMJSON<ChapterResponseData>(messagesForMetadata, context)
    
    console.log('[ChapterAgent] 元数据提取完成')
    
    // ========== 组合最终结果 ==========
    
    // 字数统计
    const wordCount = this.countChineseWords(content)
    const inputWordCount = input.type === 'chapter' ? (input.wordCount || 3000) : 3000
    
    return {
      content,
      metadata: {
        wordCount,
        targetWordCount: inputWordCount,
        wordCountDiff: ((wordCount - inputWordCount) / inputWordCount * 100).toFixed(1) + '%',
        tokenEstimate: estimateTokensChinese(content),
        chapterInfo: metadata.chapterInfo || {},
        // 从第二步提取的元数据
        sensoryDetails: metadata.metadata?.sensoryDetails || {},
        tensionCurve: metadata.metadata?.tensionCurve || [],
        characterStates: metadata.metadata?.characterStates || []
      }
    }
  }
  
  /**
   * 构建用于生成正文的消息（不要求 JSON 格式）
   */
  private async buildMessagesForContent(input: AgentInput, context: AgentContext): Promise<Array<{ role: 'system' | 'user'; content: string }>> {
    // 获取正常的 messages
    const messages = await this.buildMessages(input, context)
    
    // 修改 system prompt，不要求 JSON 格式
    if (messages[0]?.role === 'system') {
      messages[0] = {
        ...messages[0],
        content: messages[0].content + '\n\n**重要**：请直接返回章节正文，不需要 JSON 格式。'
      }
    }
    
    return messages
  }
  
  /**
   * 构建用于提取元数据的消息
   */
  private buildMessagesForMetadata(input: AgentInput, context: AgentContext, content: string): Array<{ role: 'system' | 'user'; content: string }> {
    // System Prompt：要求返回 JSON 格式
    const systemPrompt = `你是一位专业的小说章节分析专家。你的任务是分析章节正文，提取结构化元数据。

## 输出格式要求

**重要：你必须返回严格的 JSON 格式！**

输出格式如下：
\`\`\`json
{
  "chapterInfo": {
    "title": "章节标题",
    "summary": "章节摘要（100-200字）",
    "keyEvents": ["关键事件1", "关键事件2"],
    "characterStates": [
      {
        "characterId": "角色ID",
        "name": "角色名称",
        "stateChanges": "状态变化描述",
        "emotion": "情绪状态"
      }
    ],
    "foreshadowing": ["伏笔1", "伏笔2"],
    "tensionCurve": [
      {
        "position": "开头/发展/高潮/结尾",
        "score": 5,
        "description": "张力描述"
      }
    ]
  },
  "sensoryDetails": {
    "visual": ["视觉细节1"],
    "auditory": ["听觉细节1"],
    "olfactory": ["嗅觉细节1"],
    "tactile": ["触觉细节1"],
    "taste": ["味觉细节1"]
  },
  "tensionCurve": [
    {
      "position": "开头",
      "score": 5,
      "description": "张力描述"
    }
  ],
  "characterStates": [
    {
      "characterId": "角色ID",
      "name": "角色名称",
      "stateChanges": "状态变化描述",
      "emotion": "情绪状态"
    }
  ]
}
\`\`\`

---

**重要提醒：只返回 JSON，不要返回其他内容！**`
    
    // User Prompt：包含章节正文，要求提取元数据
    const userPrompt = `# 请分析以下章节正文，提取结构化元数据。

## 章节正文

${content}

---

## 任务

请仔细分析上述章节正文，提取以下元数据：

1. **章节信息**（chapterInfo）：标题、摘要、关键事件、角色状态、伏笔、张力曲线
2. **感官细节**（sensoryDetails）：视觉、听觉、嗅觉、触觉、味觉
3. **张力曲线**（tensionCurve）：章节的张力变化
4. **角色状态**（characterStates）：角色的状态变化

请按照 system prompt 中的 JSON 格式返回结果。`
    
    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
  }

  /**
   * 执行章节写作（带质量闭环）
   * 
   * 流程：生成 → 评估 → 如果评分<阈值 → 定点修复 → 再评估 → ...
   * 
   * @param input - Agent 输入
   * @param context - Agent 执行上下文
   * @param qualityConfig - 质量闭环配置（可选，使用默认值）
   * @returns Agent 输出（包含质量评估结果）
   */
  async executeWithQualityLoop(
    input: AgentInput,
    context: AgentContext,
    qualityConfig?: Partial<QualityLoopConfig>
  ): Promise<AgentOutput & { qualityEvaluation?: QualityEvaluation }> {
    // 默认质量配置
    const config: QualityLoopConfig = {
      scoreThreshold: 80,
      criticalIssueThreshold: 0,
      maxRevisions: 3,
      enabled: true,
      ...qualityConfig
    }

    // 如果质量闭环未启用，直接执行普通生成
    if (!config.enabled) {
      const result = await this.execute(input, context)
      return result
    }

    let bestContent = ''
    let bestScore = 0
    let lastEvaluation: QualityEvaluation | null = null

    for (let attempt = 0; attempt < config.maxRevisions; attempt++) {
      // 1. 生成（如果是第一次，正常生成；否则，基于评估报告重写）
      let content: string
      if (attempt === 0) {
        const result = await this.execute(input, context)
        content = result.content
      } else {
        // 使用 RevisionAgent 进行定点修复
        const revisionAgent = new RevisionAgent()
        content = await revisionAgent.revise(bestContent, lastEvaluation, context)
      }

      // 2. 评估（调用 ConsistencyAgent 和 AntiAIAgent）
      const evaluation = await this.evaluateQuality(content, context)
      lastEvaluation = evaluation

      // 3. 如果通过阈值，返回
      if (evaluation.passed) {
        return {
          content,
          metadata: {
            ...evaluation,
            attempts: attempt + 1,
            qualityLoopEnabled: true
          },
          qualityEvaluation: evaluation
        }
      }

      // 4. 否则，保留最佳版本
      if (evaluation.totalScore > bestScore) {
        bestScore = evaluation.totalScore
        bestContent = content
      }
    }

    // 达到最大尝试次数，返回最佳版本
    return {
      content: bestContent,
      metadata: {
        score: bestScore,
        attempts: config.maxRevisions,
        qualityLoopEnabled: true,
        warning: '未达到质量阈值，已返回最佳版本'
      },
      qualityEvaluation: lastEvaluation || undefined
    }
  }

  /**
   * 评估章节质量
   * 
   * @param content - 章节内容
   * @param context - Agent 执行上下文
   * @returns 质量评估结果
   */
  private async evaluateQuality(content: string, context: AgentContext): Promise<QualityEvaluation> {
    // 如果设置了编排器，使用编排器执行协作评估
    if (this.orchestrator) {
      return this.evaluateQualityWithOrchestrator(content, context)
    }
    
    // 否则，使用传统方式（直接创建 Agent 实例）
    
    // 调用 ConsistencyAgent 进行一致性检查
    const consistencyAgent = new ConsistencyAgent()
    const consistencyInput: AgentInput = {
      type: 'consistency',
      chapterId: '',
      fullText: content
    }
    const consistencyResult = await consistencyAgent.execute(consistencyInput, context)

    // 调用 AntiAIAgent 进行 AI 腔检测
    const antiAIAgent = new AntiAIAgent()
    const antiAIInput: AgentInput = {
      type: 'anti_ai',
      content,
      level: 2
    }
    const antiAIResult = await antiAIAgent.execute(antiAIInput, context)

    // 解析评估结果，计算总分
    const evaluation: QualityEvaluation = {
      totalScore: 0,
      passed: false,
      dimensions: [],
      criticalIssues: [],
      suggestionIssues: []
    }

    // TODO: 解析 consistencyResult.content 和 antiAIResult.content
    // 提取评分和问题列表，计算总分
    // 这里需要根据 ConsistencyAgent 和 AntiAIAgent 的实际输出格式进行解析

    // 临时实现：假设输出包含评分和问题列表
    try {
      // 使用统一的 JSON 清理工具函数
      const consistencyData = safeJSONParse<any>(consistencyResult.content)
      const antiAIData = safeJSONParse<any>(antiAIResult.content)
      
      if (!consistencyData || !antiAIData) {
        throw new Error('Failed to parse LLM output')
      }

      // 合并评分和问题
      evaluation.totalScore = (consistencyData.score || 0) * 0.6 + (antiAIData.score || 0) * 0.4
      evaluation.dimensions = [
        ...(consistencyData.dimensions || []),
        ...(antiAIData.dimensions || [])
      ]
      evaluation.criticalIssues = [
        ...(consistencyData.criticalIssues || []),
        ...(antiAIData.criticalIssues || [])
      ]
      evaluation.suggestionIssues = [
        ...(consistencyData.suggestionIssues || []),
        ...(antiAIData.suggestionIssues || [])
      ]
    } catch (error) {
      // 解析失败，使用默认值
      console.warn('[ChapterAgent] Failed to parse evaluation result:', error)
      evaluation.totalScore = 70 // 默认分数
      evaluation.dimensions = []
      evaluation.criticalIssues = []
      evaluation.suggestionIssues = []
    }

    // 判断是否通过阈值
    evaluation.passed = evaluation.totalScore >= 80 && evaluation.criticalIssues.length === 0

    return evaluation
  }
  
  /**
   * 使用编排器执行协作评估
   * 
   * 功能说明：
   * - 使用 AgentOrchestrator 并行执行 ConsistencyAgent 和 AntiAIAgent
   * - 合并两个 Agent 的评估结果
   * 
   * @param content - 章节内容
   * @param context - Agent 执行上下文
   * @returns 质量评估结果
   */
  private async evaluateQualityWithOrchestrator(content: string, context: AgentContext): Promise<QualityEvaluation> {
    if (!this.orchestrator) {
      throw new Error('AgentOrchestrator 未设置')
    }
    
    // 准备输入
    const consistencyInput: AgentInput = {
      type: 'consistency',
      chapterId: '',
      fullText: content
    }
    
    const antiAIInput: AgentInput = {
      type: 'anti_ai',
      content,
      level: 2
    }
    
    // 并行执行 ConsistencyAgent 和 AntiAIAgent
    const results = await this.orchestrator.executeParallel(
      [consistencyInput, antiAIInput],
      context,
      ['consistency', 'anti_ai']
    )
    
    // 解析结果
    const evaluation: QualityEvaluation = {
      totalScore: 0,
      passed: false,
      dimensions: [],
      criticalIssues: [],
      suggestionIssues: []
    }
    
    try {
      // 清理 LLM 返回结果，去除可能的 Markdown 代码块包裹
      const cleanJSON = (str: string): string => {
        const trimmed = str.trim()
        const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```$/)
        return codeBlockMatch ? codeBlockMatch[1].trim() : trimmed
      }
      
      // 解析 ConsistencyAgent 结果
      if (results[0]?.success && results[0].output) {
        const consistencyData = JSON.parse(cleanJSON(results[0].output.content))
        evaluation.totalScore += (consistencyData.score || 0) * 0.6
        evaluation.dimensions.push(...(consistencyData.dimensions || []))
        evaluation.criticalIssues.push(...(consistencyData.criticalIssues || []))
        evaluation.suggestionIssues.push(...(consistencyData.suggestionIssues || []))
      }
      
      // 解析 AntiAIAgent 结果
      if (results[1]?.success && results[1].output) {
        const antiAIData = JSON.parse(cleanJSON(results[1].output.content))
        evaluation.totalScore += (antiAIData.score || 0) * 0.4
        evaluation.dimensions.push(...(antiAIData.dimensions || []))
        evaluation.criticalIssues.push(...(antiAIData.criticalIssues || []))
        evaluation.suggestionIssues.push(...(antiAIData.suggestionIssues || []))
      }
      
    } catch (error) {
      // 解析失败，使用默认值
      console.warn('[ChapterAgent] Failed to parse orchestrator evaluation result:', error)
      evaluation.totalScore = 70 // 默认分数
    }
    
    // 判断是否通过阈值
    evaluation.passed = evaluation.totalScore >= 80 && evaluation.criticalIssues.length === 0
    
    return evaluation
  }

  /**
   * 统计中文字数
   * 中文按字计数，英文按词计数
   */
  private countChineseWords(text: string): number {
    // 移除Markdown标记
    const cleanText = text
      .replace(/```[\s\S]*?```/g, '') // 代码块
      .replace(/#{1,6}\s/g, '')        // 标题
      .replace(/\*\*|__/g, '')          // 粗体
      .replace(/\*|_/g, '')             // 斜体
      .replace(/\[.*?\]\(.*?\)/g, '')   // 链接
      .replace(/!\[.*?\]\(.*?\)/g, '')  // 图片

    // 中文+标点
    const chineseChars = (cleanText.match(/[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/g) || []).length
    // 英文单词
    const englishWords = (cleanText.match(/[a-zA-Z]+/g) || []).length

    return chineseChars + englishWords
  }
}
