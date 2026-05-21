/**
 * Token 计数器
 *
 * 基于 tiktoken 实现 Token 计数，支持精确计数和中文字数估算降级方案。
 * 用于上下文预算控制和 Token 消耗统计。
 *
 * 推荐方案：tiktoken (cl100k_base) 为主，中文字数 × 1.5 为降级方案
 */

// tiktoken 类型声明（避免运行时直接 import 的 WASM 问题）
interface TiktokenEncoder {
  encode(text: string): Uint32Array | number[]
  decode(tokens: number[]): string
  free(): void
}

let encoder: TiktokenEncoder | null = null
let initPromise: Promise<void> | null = null
let useFallback = false

/**
 * 初始化 tiktoken 编码器
 * Electron 环境中 tiktoken 需要 WASM 支持，可能失败
 */
async function initEncoder(): Promise<void> {
  if (encoder || useFallback) return

  try {
    // 动态导入 tiktoken，避免 WASM 加载失败导致应用崩溃
    const tiktokenModule = await import('tiktoken')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const init = (tiktokenModule as any).init || (tiktokenModule as any).default
    if (typeof init === 'function') {
      await init(() => tiktokenModule)
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Tiktoken = (tiktokenModule as any).Tiktoken
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cl100k_base = (tiktokenModule as any).cl100k_base
    if (Tiktoken && cl100k_base) {
      encoder = new Tiktoken(
        cl100k_base.b64,
        cl100k_base.special_tokens || {},
        cl100k_base.pat_str
      ) as TiktokenEncoder
    }
  } catch (e) {
    console.warn('[TokenCounter] tiktoken 初始化失败，降级为中文字数估算:', e)
    useFallback = true
  }
}

/**
 * 确保 tiktoken 已初始化
 */
async function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = initEncoder()
  }
  await initPromise
}

/**
 * 计算 Token 数量
 *
 * 优先使用 tiktoken 精确计数，失败时降级为中文字数估算。
 *
 * @param text - 要计算 Token 的文本
 * @returns Token 数量
 */
export async function countTokens(text: string): Promise<number> {
  if (!text) return 0

  await ensureInitialized()

  if (encoder && !useFallback) {
    try {
      const tokens = encoder.encode(text)
      return tokens.length
    } catch (e) {
      console.warn('[TokenCounter] tiktoken 编码失败，降级估算:', e)
      useFallback = true
    }
  }

  return estimateTokensChinese(text)
}

/**
 * 同步版本的 Token 计算（使用估算）
 * 用于无法异步的场景
 */
export function countTokensSync(text: string): number {
  if (!text) return 0

  if (encoder && !useFallback) {
    try {
      return encoder.encode(text).length
    } catch {
      return estimateTokensChinese(text)
    }
  }

  return estimateTokensChinese(text)
}

/**
 * 中文字数估算 Token
 *
 * 规则：
 * - 中文字符约 1.5 token/字
 * - 英文单词约 1.3 token/词
 * - 标点符号约 1 token/个
 * - 混合文本使用加权平均
 *
 * @param text - 文本内容
 * @returns 估算的 Token 数量
 */
export function estimateTokensChinese(text: string): number {
  if (!text) return 0

  let chineseChars = 0
  let englishWords = 0
  let otherChars = 0

  // 统计中文字符
  const chineseRegex = /[\u4e00-\u9fff\u3400-\u4dbf]/
  // 统计英文单词
  const englishWordRegex = /[a-zA-Z]+/g

  for (const char of text) {
    if (chineseRegex.test(char)) {
      chineseChars++
    }
  }

  const engMatches = text.match(englishWordRegex)
  if (engMatches) {
    englishWords = engMatches.length
  }

  // 其他字符（数字、标点、空白等）
  const engMatchText = text.match(englishWordRegex)
  otherChars = text.length - chineseChars - (engMatchText?.join('').length || 0)

  // 加权估算
  const chineseTokens = Math.ceil(chineseChars * 1.5)
  const englishTokens = Math.ceil(englishWords * 1.3)
  const otherTokens = Math.ceil(otherChars * 0.5)

  return chineseTokens + englishTokens + otherTokens
}

/**
 * Token 预算分配方案
 *
 * 总预算 8000 token（可配置），按以下比例分配：
 * - 系统指令区：~500 token
 * - 世界观压缩区：~500 token
 * - 角色档案区：~1500 token
 * - 前文摘要区：~1500 token
 * - 本章上下文区：~500 token
 * - 伏笔/状态区：~500 token
 * - Skill注入区：~1000 token
 * - 用户自定义注入区：~2000 token
 */
export interface TokenBudget {
  /** 总预算 */
  total: number
  /** 系统指令区 */
  systemPrompt: number
  /** 世界观压缩区 */
  worldConstraints: number
  /** 角色档案区 */
  characterProfiles: number
  /** 前文摘要区 */
  previousSummaries: number
  /** 本章上下文区 */
  chapterContext: number
  /** 伏笔/状态区 */
  foreshadowState: number
  /** Skill注入区 */
  skillContext: number
  /** 用户自定义注入区 */
  userInjections: number
}

/** 默认 Token 预算（8000 token） */
export const DEFAULT_TOKEN_BUDGET: TokenBudget = {
  total: 8000,
  systemPrompt: 500,
  worldConstraints: 500,
  characterProfiles: 1500,
  previousSummaries: 1500,
  chapterContext: 500,
  foreshadowState: 500,
  skillContext: 1000,
  userInjections: 2000
}

/** 本地小模型 Token 预算（4000 token） */
export const LOCAL_MODEL_TOKEN_BUDGET: TokenBudget = {
  total: 4000,
  systemPrompt: 300,
  worldConstraints: 300,
  characterProfiles: 700,
  previousSummaries: 800,
  chapterContext: 300,
  foreshadowState: 300,
  skillContext: 500,
  userInjections: 800
}

/** 长上下文模型 Token 预算（16000 token） */
export const LONG_CONTEXT_TOKEN_BUDGET: TokenBudget = {
  total: 16000,
  systemPrompt: 800,
  worldConstraints: 1000,
  characterProfiles: 3000,
  previousSummaries: 3000,
  chapterContext: 1000,
  foreshadowState: 1000,
  skillContext: 2000,
  userInjections: 4000
}

/**
 * 根据模型配置选择合适的 Token 预算
 * @param isLocalModel - 是否为本地小模型（≤7B）
 * @param isLongContext - 是否为长上下文模型（128K+）
 */
export function selectTokenBudget(
  isLocalModel?: boolean,
  isLongContext?: boolean
): TokenBudget {
  if (isLocalModel) return { ...LOCAL_MODEL_TOKEN_BUDGET }
  if (isLongContext) return { ...LONG_CONTEXT_TOKEN_BUDGET }
  return { ...DEFAULT_TOKEN_BUDGET }
}

/**
 * 计算已使用的 Token 并返回各区消耗情况
 */
export interface TokenUsage extends TokenBudget {
  /** 各区实际消耗 */
  used: {
    systemPrompt: number
    worldConstraints: number
    characterProfiles: number
    previousSummaries: number
    chapterContext: number
    foreshadowState: number
    skillContext: number
    userInjections: number
  }
  /** 已用总量 */
  totalUsed: number
  /** 剩余预算 */
  remaining: number
}

/**
 * 释放 tiktoken 编码器
 * 在应用退出时调用
 */
export function disposeEncoder(): void {
  if (encoder) {
    try {
      encoder.free()
    } catch {
      // 忽略释放错误
    }
    encoder = null
  }
}
