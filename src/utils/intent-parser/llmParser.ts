/**
 * LLM 语义理解模块
 */

import { z } from 'zod'
import { LLMClient } from '@/llm/LLMClient'
import { useSettingsStore } from '@/stores/settings'
import type { ModelConfig } from '@/llm/types'
import type { ParsedIntent, EditorContext } from './types'

/**
 * LLM 输出 Schema（使用 Zod 校验）
 */
const IntentOutputSchema = z.object({
  type: z.enum(['generate', 'continue', 'polish', 'rewrite', 'modify', 'consult', 'confirm', 'cancel', 'regenerate', 'satisfied', 'unknown']),
  confidence: z.number().min(0).max(1),
  target: z.string().optional(),
  scope: z.enum(['selection', 'cursor', 'chapter']).optional(),
  tone: z.string().optional(),
  customRequest: z.string().optional(),
  isRegenerate: z.boolean().optional(),
  isSatisfied: z.boolean().optional(),
  reasoning: z.string().optional()
})

type IntentOutput = z.infer<typeof IntentOutputSchema>

/**
 * 使用 LLM 进行意图解析（主方法）
 */
export async function parseIntentWithLLM(
  userInput: string,
  context?: EditorContext
): Promise<ParsedIntent> {
  const settingsStore = useSettingsStore()
  const modelConfig: ModelConfig | null = settingsStore.activeModel

  if (!modelConfig) {
    throw new Error('未配置模型')
  }

  // 构建上下文描述
  const contextDesc = buildContextDescription(context)

  // 构建系统提示词
  const systemPrompt = buildSystemPrompt()

  // 构建用户消息（包含上下文）
  let userMessage = `用户输入：${userInput}`
  if (contextDesc) {
    userMessage += `\n\n上下文信息：\n${contextDesc}`
  }

  // 调用 LLM
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userMessage }
  ]

  const reply = await LLMClient.chat(modelConfig, messages, 'intent-parser')

  // 解析 LLM 返回的 JSON
  const parsed = parseLLMJsonOutput(reply)

  // 使用 Zod 校验
  const validated = IntentOutputSchema.parse(parsed)

  // 转换为 ParsedIntent
  return {
    type: validated.type as ParsedIntent['type'],
    confidence: validated.confidence,
    target: validated.target,
    scope: validated.scope,
    tone: validated.tone,
    customRequest: validated.customRequest,
    isRegenerate: validated.isRegenerate,
    isSatisfied: validated.isSatisfied,
    reasoning: validated.reasoning
  }
}

/**
 * 构建系统提示词
 */
function buildSystemPrompt(): string {
  return `你是一个智能意图解析器，专门理解小说创作场景下的用户意图。

你的任务是分析用户的输入，识别其创作意图，并以 JSON 格式输出结果。

## 支持的意图类型

1. **generate** - 生成新章节/新内容
2. **continue** - 续写/接着写
3. **polish** - 润色文字
4. **rewrite** - 重写
5. **modify** - 修改选中内容
6. **consult** - 咨询建议
7. **confirm** - 确认操作
8. **cancel** - 取消操作
9. **regenerate** - 重新生成
10. **satisfied** - 满意

## 输出格式

你必须严格按照以下 JSON 格式输出，不要输出任何其他内容：

\`\`\`
{
  "type": "意图类型",
  "confidence": 0.95,
  "target": "提取的目标信息",
  "scope": "selection/cursor/chapter",
  "tone": "风格要求",
  "customRequest": "用户的具体要求",
  "isRegenerate": false,
  "isSatisfied": false,
  "reasoning": "简短的推理过程"
}
\`\`\`

## 判断规则

1. **置信度**：根据你的理解程度给出 0-1 之间的数值
2. **作用范围**：如果有选中内容，scope 为 "selection"；如果光标在章节中，scope 为 "cursor"；如果是针对整个章节，scope 为 "chapter"
3. **目标提取**：从输入中提取具体的目标（如"800字"、"突出冲突"）
4. **风格要求**：提取用户提到的风格要求（如"自然"、"简洁"、"文艺"）`
}

/**
 * 解析 LLM 返回的 JSON（处理可能的 Markdown 代码块包裹）
 */
function parseLLMJsonOutput(output: string): Record<string, any> {
  let cleanOutput = output.trim()

  // 去除 Markdown 代码块包裹
  const codeBlockMatch = cleanOutput.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```$/)
  if (codeBlockMatch) {
    cleanOutput = codeBlockMatch[1].trim()
  }

  // 尝试解析 JSON
  try {
    return JSON.parse(cleanOutput)
  } catch (err) {
    // 尝试提取 JSON 部分
    const jsonMatch = cleanOutput.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    throw new Error(`无法解析 LLM 输出为 JSON: ${output.slice(0, 200)}`)
  }
}

/**
 * 构建上下文描述
 */
function buildContextDescription(context?: EditorContext): string {
  if (!context) return ''

  const parts: string[] = []

  if (context.selectedText) {
    parts.push(`[选中内容]：${context.selectedText.slice(0, 200)}`)
  }

  if (context.chapterContent) {
    const preview = context.chapterContent.length > 500 
      ? context.chapterContent.slice(0, 500) + '...' 
      : context.chapterContent
    parts.push(`[章节内容]（节选）：${preview}`)
  }

  if (context.wordCount) {
    parts.push(`[章节字数]：${context.wordCount}`)
  }

  if (context.cursorPosition !== undefined) {
    parts.push(`[光标位置]：第 ${context.cursorPosition} 字符`)
  }

  return parts.join('\n')
}
