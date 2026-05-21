/**
 * 辅助函数模块
 */

import { estimateTokensChinese } from '@/utils/tokenCounter'

/**
 * 按预算裁剪文本
 */
export function trimToTokenBudget(text: string, maxTokens: number): string {
  const currentTokens = estimateTokensChinese(text)
  if (currentTokens <= maxTokens) return text

  // 估算：1个中文字 ≈ 1.5 token
  const maxChars = Math.floor(maxTokens / 1.5)
  return text.substring(0, maxChars) + '\n...（已裁剪）'
}
