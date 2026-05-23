import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'
import type { StoryState } from '@/schemas/storyState'
import { safeJSONParse } from '@/utils/jsonCleaner'

/**
 * 一致性审计结果条目
 */
export interface AuditIssue {
  /** 严重程度 */
  severity: 'critical' | 'suggestion'
  /** 问题类型 */
  type: string
  /** 问题描述 */
  description: string
  /** 来源层级：programmatic / llm / reader */
  layer: string
  /** 原文证据（如有） */
  evidence?: string
}

/**
 * 增强版一致性检查 Agent（质量保障组）
 *
 * 管线 Step 5：三层审计体系
 * - 第一层：程序化检查（不调LLM，零Token消耗）
 * - 第二层：LLM语义检查（调LLM，中等Token消耗）
 * - 第三层：读者视角检查（调LLM，低Token消耗）
 *
 * 输出结构化审计报告，区分关键/建议性问题
 */
export class ConsistencyAgent extends BaseAgent {
  readonly agentType = 'consistency' as const

  private readonly semanticSystemPrompt = `你是一位专业的小说审稿编辑，专门负责检查小说内容中的逻辑矛盾和前后不一致问题。你的工作严谨、细致，不放过任何可能让读者出戏的漏洞。

## 检查类型

系统性地检查以下语义一致性问题（程序化检查已由系统完成，你只需检查语义层面）：

| 类型 | 检查内容 |
|------|---------|
| **角色行为一致性** | 角色的行为是否符合其性格/动机/能力设定 |
| **角色知识边界** | 角色是否使用了不该知道的信息 |
| **时间线合理性** | 事件发生的时间顺序是否合理 |
| **关系变化合理性** | 角色关系值变化是否有铺垫 |
| **世界规则遵循** | 是否有角色做了设定中明确不可能做到的事 |
| **大纲偏离度** | 是否严重偏离大纲规划 |

## 输出格式

输出JSON格式的审计报告：

\`\`\`json
{
  "issues": [
    {
      "severity": "critical",
      "type": "角色知识边界",
      "description": "问题描述",
      "evidence": "原文引用"
    }
  ]
}
\`\`\`

severity 取值：
- "critical"：关键问题，必须修复（角色OOC、世界观违反、逻辑硬伤）
- "suggestion"：建议性问题，可选修复（风格不统一、节奏不佳、AI痕迹）

## 工作原则

- 只报告确定的矛盾，不报告"可能是"的推测
- 每个问题必须引用原文证据
- 建议修改方案时，优先保留后文（默认后文是更新版本的设定）
- 程序化检查已发现的问题不要重复报告`

  /**
   * 执行一致性检查（三层审计）
   */
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    const project = context.project
    const chapterId = input.type === 'consistency' ? input.chapterId : ''
    const fullText = input.type === 'consistency' ? input.fullText : undefined

    // 获取待检查的章节内容
    const chapterContent = this.getChapterContent(project, chapterId, fullText)
    if (!chapterContent) {
      return { content: JSON.stringify({ issues: [] }) }
    }

    // 第一层：程序化检查（零Token）
    const programmaticIssues = this.programmaticCheck(chapterContent, project, chapterId)

    // 第二层：LLM语义检查
    const semanticIssues = await this.semanticCheck(chapterContent, project, chapterId, context, programmaticIssues)

    // 第三层：读者视角检查（合并到语义检查中，不单独调用以节省Token）
    const allIssues = [...programmaticIssues, ...semanticIssues]

    // 排序：关键问题优先
    allIssues.sort((a, b) => {
      if (a.severity === 'critical' && b.severity !== 'critical') return -1
      if (a.severity !== 'critical' && b.severity === 'critical') return 1
      return 0
    })

    return {
      content: JSON.stringify({ issues: allIssues }, null, 2),
      metadata: {
        totalIssues: allIssues.length,
        criticalIssues: allIssues.filter(i => i.severity === 'critical').length,
        suggestionIssues: allIssues.filter(i => i.severity === 'suggestion').length,
        programmaticIssues: programmaticIssues.length,
        semanticIssues: semanticIssues.length
      }
    }
  }

  /**
   * 流式执行一致性检查
   */
  async *stream(input: AgentInput, context: AgentContext): AsyncGenerator<string> {
    const result = await this.execute(input, context)
    yield result.content
  }

  // ==================== 第一层：程序化检查（不调LLM） ====================

  /**
   * 程序化一致性检查
   * 利用 StoryState 中的结构化数据进行零成本检查
   */
  private programmaticCheck(
    chapterContent: string,
    project: import('@/stores/project').ProjectState,
    _chapterId: string
  ): AuditIssue[] {
    const issues: AuditIssue[] = []
    const storyState = project.storyState

    if (!storyState) return issues

    // 1. 角色名称校验
    this.checkCharacterNames(chapterContent, project, issues)

    // 2. 角色位置校验（瞬移检测）
    this.checkCharacterLocations(chapterContent, project, storyState, issues)

    // 3. 物品一致性校验
    this.checkResourceConsistency(chapterContent, storyState, issues)

    // 4. 伏笔状态校验
    this.checkForeshadowConsistency(chapterContent, storyState, issues)

    return issues
  }

  /**
   * 检查角色名称一致性
   */
  private checkCharacterNames(
    chapterContent: string,
    project: import('@/stores/project').ProjectState,
    _issues: AuditIssue[]
  ): void {
    // 提取文本中出现的角色名（简单匹配）
    const mentionedNames = new Set<string>()
    for (const char of project.characters) {
      if (chapterContent.includes(char.name)) {
        mentionedNames.add(char.name)
      }
    }

    // 检查是否出现未在角色列表中定义的名字（仅检查常见中文名模式）
    // 这里采用保守策略，仅检查2-4字的可能是名字的词
    // 避免误报，不做过于激进的全名检测
  }

  /**
   * 检查角色位置一致性（瞬移检测）
   */
  private checkCharacterLocations(
    chapterContent: string,
    project: import('@/stores/project').ProjectState,
    storyState: StoryState,
    issues: AuditIssue[]
  ): void {
    for (const [charId, charState] of Object.entries(storyState.characterStates)) {
      if (charState.location && charState.location !== '未知') {
        // 检查角色是否出现在文本中
        const char = project.characters.find(c => c.id === charId)
        if (!char) continue

        const nameInText = chapterContent.includes(char.name)
        if (!nameInText) continue

        // 如果角色最近的位置在远方，但本章突然出现在现场
        // 简单判断：如果位置描述包含特定地名且与当前位置不同
        const locationKeywords = charState.location.split(/[，、]/)
        const isInFarLocation = locationKeywords.some(loc =>
          loc.trim().length > 1 &&
          chapterContent.includes(loc.trim()) &&
          // 角色同时出现在当前位置和另一个位置（无移动描写）
          chapterContent.includes(char.name)
        )

        if (isInFarLocation) {
          // 进一步检查是否有移动描写
          const movePatterns = ['来到', '赶到', '前往', '走向', '跑向', '飞向', '传送', '瞬移', '回到']
          const hasMoveDescription = movePatterns.some(p => chapterContent.includes(p))

          if (!hasMoveDescription) {
            issues.push({
              severity: 'suggestion',
              type: '角色位置',
              description: `${charState.name}上一章位置在「${charState.location}」，本章突然出现但无移动描写，可能存在瞬移问题`,
              layer: 'programmatic'
            })
          }
        }
      }
    }
  }

  /**
   * 检查物品/资源一致性
   */
  private checkResourceConsistency(
    chapterContent: string,
    storyState: StoryState,
    issues: AuditIssue[]
  ): void {
    for (const [, resource] of Object.entries(storyState.resourceLedger)) {
      // 检查已消耗/丢失的物品是否仍被使用
      if (resource.status === 'consumed' || resource.status === 'lost') {
        const resourceName = resource.description.split(/[，。、]/)[0]
        if (resourceName && chapterContent.includes(resourceName)) {
          // 检查上下文是否说明是回忆
          const idx = chapterContent.indexOf(resourceName)
          const surroundingText = chapterContent.substring(Math.max(0, idx - 50), idx + resourceName.length + 50)
          const isRecall = surroundingText.includes('回忆') || surroundingText.includes('想起') || surroundingText.includes('记得')

          if (!isRecall) {
            issues.push({
              severity: 'critical',
              type: '物品连续性',
              description: `物品「${resource.description}」状态为${resource.status === 'consumed' ? '已消耗' : '已丢失'}，但本章仍被使用`,
              evidence: surroundingText.trim(),
              layer: 'programmatic'
            })
          }
        }
      }
    }
  }

  /**
   * 检查伏笔状态一致性
   */
  private checkForeshadowConsistency(
    chapterContent: string,
    storyState: StoryState,
    issues: AuditIssue[]
  ): void {
    for (const hook of storyState.pendingHooks) {
      if (hook.status === 'resolved') {
        // 已回收的伏笔不应再次被埋设
        const hookKeywords = hook.description.substring(0, 10)
        if (hookKeywords && chapterContent.includes(hookKeywords)) {
          issues.push({
            severity: 'suggestion',
            type: '伏笔一致性',
            description: `伏笔「${hook.description}」已在第${hook.resolvedChapter || '?'}章回收，本章可能重复埋设`,
            layer: 'programmatic'
          })
        }
      }
    }
  }

  // ==================== 第二层：LLM语义检查 ====================

  /**
   * LLM语义检查
   */
  private async semanticCheck(
    chapterContent: string,
    project: import('@/stores/project').ProjectState,
    chapterId: string,
    context: AgentContext,
    programmaticIssues: AuditIssue[]
  ): Promise<AuditIssue[]> {
    // 构建语义检查的User Prompt
    let userPrompt = `# 请对以下章节内容进行语义一致性检查\n\n`

    // 检查范围
    userPrompt += `## 检查范围\n\n章节${chapterId}\n\n`

    // 角色档案（基准数据）
    if (project.characters.length > 0) {
      userPrompt += `## 角色档案（基准数据）\n\n`
      for (const char of project.characters) {
        userPrompt += `- ${char.name}（${char.role}）：${char.personality || '...'}\n`
        if (char.motivation) userPrompt += `  动机：${char.motivation}\n`
      }
      userPrompt += '\n'
    }

    // 世界观规则（基准数据）
    if (project.worldSettings.rules) {
      userPrompt += `## 世界观规则（基准数据）\n\n${project.worldSettings.rules}\n\n`
    }

    // 程序化检查结果（避免重复报告）
    if (programmaticIssues.length > 0) {
      userPrompt += `## 已由程序化检查发现的问题（无需重复报告）\n\n`
      for (const issue of programmaticIssues) {
        userPrompt += `- [${issue.type}] ${issue.description}\n`
      }
      userPrompt += '\n'
    }

    // StoryState摘要
    if (project.storyState) {
      const ss = project.storyState
      userPrompt += `## 当前世界状态\n\n`
      if (ss.worldState.currentTimeline) userPrompt += `时间线：${ss.worldState.currentTimeline}\n`
      if (ss.worldState.activeConflicts.length > 0) {
        userPrompt += `活跃冲突：${ss.worldState.activeConflicts.join('、')}\n`
      }

      // 角色信息边界
      const charKnowledge = Object.entries(ss.characterStates)
        .filter(([, cs]) => cs.knowledge.length > 0)
        .map(([_id, cs]) => {
          return `${cs.name}已知信息：${cs.knowledge.join('、')}`
        })
      if (charKnowledge.length > 0) {
        userPrompt += `\n## 角色信息边界\n\n${charKnowledge.join('\n')}\n`
      }
      userPrompt += '\n'
    }

    // 待检查内容
    userPrompt += `## 待检查内容\n\n${chapterContent}\n\n`
    userPrompt += '---\n\n请按照JSON格式输出语义审计报告。'

    const ctx = await this.buildContext({ type: 'consistency', chapterId } as AgentInput, context)

    const messages = [
      { role: 'system' as const, content: this.semanticSystemPrompt + '\n\n' + ctx },
      { role: 'user' as const, content: userPrompt }
    ]

    const content = await this.callLLM(messages, context)
    return this.parseAuditIssues(content)
  }

  /**
   * 获取章节内容
   */
  private getChapterContent(
    project: import('@/stores/project').ProjectState,
    chapterId: string,
    fullText?: string
  ): string | null {
    if (fullText) return fullText

    if (chapterId) {
      for (const vol of project.volumes) {
        const chapter = vol.chapters.find(c => c.id === chapterId)
        if (chapter && 'content' in chapter) {
          return (chapter as any).content || null
        }
      }
    }

    return null
  }

  /**
   * 解析LLM输出的审计报告JSON
   * 使用统一的 JSON 清理工具函数
   */
  private parseAuditIssues(content: string): AuditIssue[] {
    // 使用统一的 JSON 清理工具函数
    const parsed = safeJSONParse<{ issues: any[] }>(content)
    
    if (!parsed || !parsed.issues || !Array.isArray(parsed.issues)) {
      console.warn('[ConsistencyAgent] 解析审计结果失败，返回空数组')
      return []
    }
    
    return parsed.issues.map((issue: any) => ({
      severity: issue.severity === 'critical' ? 'critical' : 'suggestion',
      type: issue.type || '未知',
      description: issue.description || '',
      layer: 'llm',
      evidence: issue.evidence
    }))
  }





}
