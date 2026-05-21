import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'

/**
 * 读者反馈 Agent（写作辅助组，唯一使用读者视角）
 * 
 * 功能说明：
 * - 模拟读者视角，提供阅读反馈
 * - 分析：哪里吸引人、哪里枯燥、哪里看不懂
 * - 支持指定反馈视角（如：新读者、老读者）
 */
export class ReaderAgent extends BaseAgent {
  /** Agent 类型标识 */
  readonly agentType = 'reader' as const

  /** System Prompt（来自 prompts/d_分析推理/reader_agent/system_prompt.md） */
  private readonly systemPrompt = `你是一位模拟读者反馈专家，能够从不同类型读者的视角真实感受并评价小说章节。你不是文学评论家，你是在模拟真实读者——有各自喜好、偏见、阅读习惯的普通人。

## 四类读者视角

### 1. 核心粉丝（类型深度读者）
- 读过大量同类小说，对类型套路和金手指设计有成熟期待
- 关注：爽感密度、主角成长节奏、是否符合类型惯例
- 典型反馈风格：直接、主观、有对比（"比某某书的这段强多了"）

### 2. 路人读者（泛阅读群体）
- 不熟悉类型套路，第一次接触这类小说
- 关注：是否能看懂、角色是否讨喜、有没有想继续读下去的欲望
- 典型反馈风格：直觉性的、情绪化的（"这段我看得有点闷"）

### 3. 挑剔批评者（专业视角）
- 对文笔、逻辑、人物塑造有较高要求
- 关注：逻辑漏洞、人物行为是否合理、对话是否自然、有没有AI腔
- 典型反馈风格：尖锐、具体指出问题，不留情面

### 4. 类型粉（粉丝视角）
- 专门喜欢这个类型，关注特定元素的呈现质量
- 关注：特定情节类型的执行（打斗/感情/逆袭/热血），情感代入感
- 典型反馈风格：激动、有代入感、会说"这段我emo了"

## 输出格式

## 读者反馈模拟报告

**章节**：{{chapterTitle}}

---

### 🎯 核心粉丝视角
[以核心粉丝的口吻写出真实反应，约150字。包含：整体感受 + 具体好在哪/差在哪 + 期待下章的什么]

---

### 👤 路人读者视角
[以路人读者的口吻写出直觉反应，约100字]

---

### 🔍 挑剔批评者视角
[以评论者视角指出最主要的1-3个问题，约150字，必须具体到段落或行为]

---

### ❤️ 类型粉视角
[以热情粉丝视角写出情感反应，约100字]

---

### 综合建议
[基于四类反馈提炼出1-3条最值得作者考虑的修改方向，约100字]

## 质量要求

- 每类读者的语气和关注点必须明显不同
- 不能全是正面反馈或全是负面，要有针对性
- "挑剔批评者"必须指出具体问题，不能泛泛而谈。`

  /**
   * 构建 User Prompt
   */
  private buildUserPrompt(input: AgentInput, context: AgentContext): string {
    const project = context.project
    const chapterId = input.type === 'reader' ? input.chapterId : ''
    
    let userPrompt = `# 请从四类读者视角，对以下章节内容进行真实反馈模拟。\n\n`
    
    // 章节信息
    const chapters = (project as any).chapters || []
    const chapter = chapterId ? chapters.find((c: any) => c.id === chapterId) : null
    
    if (chapter) {
      userPrompt += `## 章节信息\n\n`
      userPrompt += `**章节标题**：${chapter.title || '...'}\n`
      userPrompt += `**章节在全书中的位置**：${chapter.chapterNumber || '...'}\n\n`
    }
    
    // 章节内容
    if (chapter?.content) {
      userPrompt += `## 章节内容\n\n${chapter.content}\n\n`
    }
    
    // 类型
    userPrompt += `## 类型\n\n${project.genre || '不限'}\n\n`
    
    // 故事背景简介
    if (project.synopsis) {
      userPrompt += `## 故事背景简介（帮助读者理解上下文）\n\n${project.synopsis}\n\n`
    }
    
    // 用户希望重点关注的方面
    const focusAreas = (input as any).focusAreas || ''
    if (focusAreas) {
      userPrompt += `## 用户希望重点关注的方面（可选）\n\n${focusAreas}\n\n`
    }
    
    userPrompt += '---\n\n请按照 system prompt 中的格式，输出四类读者反馈报告。'
    
    return userPrompt
  }

  /**
   * 执行读者反馈分析（非流式）
   */
  async execute(input: AgentInput, context: AgentContext): Promise<AgentOutput> {
    const ctx = await this.buildContext(input, context)
    const userPrompt = this.buildUserPrompt(input, context)
    
    const messages = [
      { role: 'system' as const, content: this.systemPrompt + '\n\n' + ctx },
      { role: 'user' as const, content: userPrompt }
    ]
    
    const content = await this.callLLM(messages, context)
    return { content }
  }

  /**
   * 流式执行读者反馈分析
   */
  async *stream(input: AgentInput, context: AgentContext): AsyncGenerator<string> {
    const ctx = await this.buildContext(input, context)
    const userPrompt = this.buildUserPrompt(input, context)
    
    const messages = [
      { role: 'system' as const, content: this.systemPrompt + '\n\n' + ctx },
      { role: 'user' as const, content: userPrompt }
    ]
    
    yield* this.callLLMStream(messages, context)
  }
}
