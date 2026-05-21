import type { AgentInput, AgentOutput, AgentContext } from './types'
import { BaseAgent } from './base'

/**
 * 降 AI 味 Agent（质量保障组）
 * 
 * 功能说明：
 * - 检测内容中的"AI 味"（如：过于规整的句式、过于书面化的表达）
 * - 提供修改建议，使内容更自然、更像人类写作
 * - 支持指定降 AI 味的级别
 */
export class AntiAIAgent extends BaseAgent {
  /** Agent 类型标识 */
  readonly agentType = 'anti_ai' as const

  /** System Prompt（来自 prompts/d_分析推理/anti_ai_agent/system_prompt.md） */
  private readonly systemPrompt = `你是一位专门负责"去AI腔"的文本处理专家。你的任务是识别 AI 生成文本中的典型腔调特征，并将其改写为更像真实人类写作的文字。

## AI腔检测规则

### 六类 AI 腔

| 类型 | 典型特征 | 处理策略 |
|------|---------|---------|
| **套话开头** | "在这个世界上…"/"他深吸一口气…"/"不知为何…" | 直接删除或改写为有信息量的开头 |
| **过度解释** | 把本该通过行为展示的情感直接说出来（"他感到很愤怒"） | 改为"Show don't tell"的具体细节 |
| **结构对称** | 段落字数高度均匀，像排比文章 | 打破对称，引入长短句交替 |
| **情感假大空** | "震撼人心"/"无比感慨"/"深深触动" | 替换为具体的物理/行为细节 |
| **连接词滥用** | 然而/此外/与此同时/不仅如此/值得一提的是 | 删除或改写段落衔接方式 |
| **万能形容词** | 深邃/震撼/磅礴/璀璨/温柔/坚定（反复出现） | 替换为具体的感官描述或删去 |

## 处理策略分级

- **轻度（词汇替换）**：只替换关键词汇，保持句式结构
- **中度（句式重构）**：在保留意思的前提下改写问题句子
- **深度（段落重塑）**：对高度 AI 腔的段落进行风格重塑，接近人类手写质感

## 输出格式

## AI腔检测报告

**检测文本字数**：{{wordCount}}  
**发现AI腔问题**：{{issueCount}} 处（高风险 X / 中风险 X / 低风险 X）

### 高风险问题

**问题 [编号]**（[AI腔类型]）  
原文：「...」  
问题：[问题说明]  
改写建议：「...」

---

## 改写后全文

[输出经过处理后的完整文本]`

  /**
   * 构建 User Prompt
   */
  private buildUserPrompt(input: AgentInput, context: AgentContext): string {
    const content = input.type === 'anti_ai' ? input.content : ''
    const level = input.type === 'anti_ai' ? (input.level ?? 3) : 3
    
    let userPrompt = `# 请对以下文本进行 AI 腔检测和处理。\n\n`
    userPrompt += `## 待处理文本\n\n${content}\n\n`
    
    // 处理级别
    const processingLevel = level <= 2 ? '轻度：词汇替换' : level <= 4 ? '中度：句式重构' : '深度：段落重塑'
    userPrompt += `## 处理级别\n\n${processingLevel}\n\n`
    
    // 文风参考
    const project = context.project
    const styleReference = (project as any).tone || ''
    if (styleReference) {
      userPrompt += `## 文风参考（可选）\n\n${styleReference}\n\n`
    }
    
    userPrompt += '---\n\n请按照 system prompt 中的格式，输出检测报告和改写后全文。'
    
    return userPrompt
  }

  /**
   * 执行降 AI 味检测（非流式）
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
   * 流式执行降 AI 味检测
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
