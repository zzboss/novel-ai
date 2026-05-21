/**
 * IntentParser 主入口
 * 
 * 使用 LLM 进行语义理解，替代关键词匹配
 * 保留关键词匹配作为 LLM 失败时的降级方案
 */

import type { ParsedIntent, EditorContext } from './types'
import { parseIntentWithLLM } from './llmParser'
import { parseIntentFallback } from './keywordMatcher'

/**
 * 解析用户输入，提取意图（主入口）
 * 
 * 策略：
 * 1. 优先使用 LLM 语义理解（准确率高）
 * 2. LLM 失败时降级到关键词匹配（保证可用性）
 */
export async function parseIntent(
  userInput: string,
  context?: EditorContext
): Promise<ParsedIntent> {
  const input = userInput.trim()

  // 空输入直接返回
  if (!input) {
    return { type: 'unknown', confidence: 0 }
  }

  // 1. 尝试使用 LLM 解析（主路径）
  try {
    const result = await parseIntentWithLLM(input, context)
    // 置信度 >= 0.6 才接受 LLM 结果
    if (result.confidence >= 0.6) {
      return result
    }
    console.warn('[IntentParser] LLM 置信度过低，降级到关键词匹配:', result.confidence)
  } catch (err) {
    console.warn('[IntentParser] LLM 解析失败，降级到关键词匹配:', err)
  }

  // 2. LLM 失败或置信度低，降级到关键词匹配（保底）
  return parseIntentFallback(input, context)
}

// 重新导出类型和函数
export type { IntentType } from './types'
export type { ParsedIntent, EditorContext } from './types'
export { extractEditorContext } from './contextExtractor'
