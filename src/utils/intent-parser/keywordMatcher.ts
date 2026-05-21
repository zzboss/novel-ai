/**
 * 关键词匹配降级方案
 * 当 LLM 解析失败时使用
 */

import type { ParsedIntent, EditorContext } from './types'

/**
 * 关键词匹配解析（LLM 失败时的降级方案）
 */
export function parseIntentFallback(input: string, context?: EditorContext): ParsedIntent {
  const lowerInput = input.toLowerCase()

  // 1. 确认/取消操作（最高优先级）
  if (matchConfirm(lowerInput)) {
    return {
      type: 'confirm',
      confidence: 0.95,
      customRequest: input
    }
  }

  if (matchCancel(lowerInput)) {
    return { type: 'cancel', confidence: 0.95 }
  }

  // 2. 生成章节
  const generateMatch = matchGenerate(lowerInput)
  if (generateMatch) {
    return {
      type: 'generate',
      confidence: 0.9,
      target: generateMatch.target,
      tone: generateMatch.tone
    }
  }

  // 3. 续写
  const continueMatch = matchContinue(lowerInput)
  if (continueMatch) {
    return {
      type: 'continue',
      confidence: 0.9,
      scope: context?.selectedText ? 'selection' : 'cursor',
      target: continueMatch.target
    }
  }

  // 4. 润色
  const polishMatch = matchPolish(lowerInput)
  if (polishMatch) {
    return {
      type: 'polish',
      confidence: 0.85,
      scope: context?.selectedText ? 'selection' : 'chapter',
      tone: polishMatch.tone
    }
  }

  // 5. 重写
  const rewriteMatch = matchRewrite(lowerInput)
  if (rewriteMatch) {
    return {
      type: 'rewrite',
      confidence: 0.85,
      scope: context?.selectedText ? 'selection' : 'chapter',
      customRequest: rewriteMatch.request,
      tone: rewriteMatch.tone
    }
  }

  // 6. 修改
  const modifyMatch = matchModify(lowerInput)
  if (modifyMatch) {
    return {
      type: 'modify',
      confidence: 0.8,
      scope: context?.selectedText ? 'selection' : 'chapter',
      customRequest: modifyMatch.request,
      tone: modifyMatch.tone
    }
  }

  // 7. 咨询建议
  const consultMatch = matchConsult(lowerInput)
  if (consultMatch) {
    return {
      type: 'consult',
      confidence: 0.7,
      customRequest: consultMatch.question
    }
  }

  // 8. 重新生成
  if (matchRegenerate(lowerInput)) {
    return {
      type: 'regenerate',
      confidence: 0.9,
      isRegenerate: true
    }
  }

  // 9. 满意
  if (matchSatisfied(lowerInput)) {
    return {
      type: 'confirm',
      confidence: 0.9,
      isSatisfied: true
    }
  }

  // 未知意图，但有输入内容（可能是描述需求）
  return {
    type: 'unknown',
    confidence: 0.3,
    customRequest: input
  }
}

// ============ 关键词匹配辅助函数 ============

function matchConfirm(input: string): boolean {
  return /^(好的|确认|可以|没问题|开始|执行|ok|yes|对|是的)$/.test(input)
}

function matchCancel(input: string): boolean {
  return /^(取消|不用了|算了|不|返回|cancel|no)$/.test(input)
}

function matchRegenerate(input: string): boolean {
  return /(重新生成|重来|不满意|不对|不是这样)/.test(input)
}

function matchSatisfied(input: string): boolean {
  return /(满意|不错|很好|可以了|就这样|ok)$/.test(input)
}

interface GenerateMatch {
  target?: string
  tone?: string
}

function matchGenerate(input: string): GenerateMatch | null {
  if (!/(生成|写一章|写这章|创建章节|开始写|帮我写|写一段)/.test(input)) {
    return null
  }

  const result: GenerateMatch = {}

  // 提取字数目标
  const wordCountMatch = input.match(/(\d+)\s*(字|千字|万字)/)
  if (wordCountMatch) {
    let count = parseInt(wordCountMatch[1])
    if (wordCountMatch[2] === '千字') count *= 1000
    if (wordCountMatch[2] === '万字') count *= 10000
    result.target = `${count}字`
  }

  // 提取风格要求
  const toneMatch = input.match(/(突出|侧重|强调|要)(.{2,8})([，,])/)
  if (toneMatch) {
    result.tone = toneMatch[2]
  }

  return result
}

interface ContinueMatch {
  target?: string
}

function matchContinue(input: string): ContinueMatch | null {
  if (!/(续写|接着写|继续写|接着来|往下写|继续|写下去)/.test(input)) {
    return null
  }

  const result: ContinueMatch = {}

  // 提取字数目标
  const wordCountMatch = input.match(/(\d+)\s*(字|千字)/)
  if (wordCountMatch) {
    let count = parseInt(wordCountMatch[1])
    if (wordCountMatch[2] === '千字') count *= 1000
    result.target = `${count}字`
  }

  return result
}

interface PolishMatch {
  tone?: string
}

function matchPolish(input: string): PolishMatch | null {
  if (!/(润色|优化文字|改得更好|优化一下|打磨一下|润色一下)/.test(input)) {
    return null
  }

  const result: PolishMatch = {}

  // 提取风格要求
  const toneKeywords = ['自然', '流畅', '文艺', '简洁', '有感染力', '口语化']
  for (const keyword of toneKeywords) {
    if (input.includes(keyword)) {
      result.tone = keyword
      break
    }
  }

  return result
}

interface RewriteMatch {
  request?: string
  tone?: string
}

function matchRewrite(input: string): RewriteMatch | null {
  if (!/(重写|重新写|换个写法|改写下|换种方式|重新来过)/.test(input)) {
    return null
  }

  const result: RewriteMatch = {}

  // 提取重写要求
  const requestMatch = input.match(/(改成|改为|用)(.{2,20})([，,])/)
  if (requestMatch) {
    result.request = requestMatch[2]
  }

  // 提取风格要求
  const toneKeywords = ['对话形式', '动作描写', '心理活动', '更短', '更详细']
  for (const keyword of toneKeywords) {
    if (input.includes(keyword)) {
      result.tone = keyword
      break
    }
  }

  return result
}

interface ModifyMatch {
  request?: string
  tone?: string
}

function matchModify(input: string): ModifyMatch | null {
  if (!/(修改|改一下|调整|变得)/.test(input)) {
    return null
  }

  const result: ModifyMatch = {}

  // 提取修改要求
  const requestMatch = input.match(/(修改|改|调整)(.{2,30})/)
  if (requestMatch) {
    result.request = requestMatch[2]
  }

  return result
}

interface ConsultMatch {
  question?: string
}

function matchConsult(input: string): ConsultMatch | null {
  if (!/(怎么写|应该|建议|帮我看看|这章|这一章|问问你)/.test(input)) {
    return null
  }

  return {
    question: input
  }
}
