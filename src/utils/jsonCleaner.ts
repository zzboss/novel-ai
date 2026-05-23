/**
 * JSON 清理工具函数
 * 
 * 功能：
 * 1. 清理 LLM 返回的 JSON 字符串
 * 2. 处理 Markdown 代码块包裹、BOM、解释性文本等
 * 3. 提供安全的 JSON 解析函数
 * 
 * 目标：
 * 1. 移除所有基于正则匹配的数据解析逻辑
 * 2. 提供统一的 JSON 解析工具函数
 * 3. 确保所有 Agent 都使用统一的 JSON 解析工具函数
 */

/**
 * 清理 LLM 返回的 JSON 字符串
 * 处理 Markdown 代码块包裹、BOM、解释性文本等
 * 
 * @param raw 原始字符串
 * @returns 清理后的 JSON 字符串
 */
export function cleanJSONResponse(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    return ''
  }
  
  let cleaned = raw.trim()
  
  // 1. 移除 BOM (Byte Order Mark)
  cleaned = cleaned.replace(/^\uFEFF/, '')
  
  // 2. 提取 Markdown 代码块（增强正则，支持代码块在文本任何位置）
  // 匹配 ```json ... ``` 或 ``` ... ```
  const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)```/g
  const matches = [...cleaned.matchAll(codeBlockRegex)]
  
  if (matches.length === 1) {
    // 如果只有一个代码块，直接使用
    cleaned = matches[0][1].trim()
  } else if (matches.length > 1) {
    // 如果有多个代码块，尝试合并或报错
    console.warn('[cleanJSONResponse] 检测到多个代码块，使用第一个')
    cleaned = matches[0][1].trim()
  }
  
  // 3. 如果没有代码块，尝试找到 JSON 对象的边界
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    const startIdx = cleaned.indexOf('{')
    const endIdx = cleaned.lastIndexOf('}')
    
    if (startIdx !== -1 && endIdx > startIdx) {
      cleaned = cleaned.substring(startIdx, endIdx + 1)
    } else {
      // 尝试查找数组
      const arrayStartIdx = cleaned.indexOf('[')
      const arrayEndIdx = cleaned.lastIndexOf(']')
      
      if (arrayStartIdx !== -1 && arrayEndIdx > arrayStartIdx) {
        cleaned = cleaned.substring(arrayStartIdx, arrayEndIdx + 1)
      }
    }
  }
  
  // 4. 移除可能的解释性文本（如 "好的，这是JSON..."）
  // 查找第一个 { 或 [
  const firstBrace = cleaned.indexOf('{')
  const firstBracket = cleaned.indexOf('[')
  
  let firstJSONChar = -1
  if (firstBrace !== -1 && firstBracket !== -1) {
    firstJSONChar = Math.min(firstBrace, firstBracket)
  } else if (firstBrace !== -1) {
    firstJSONChar = firstBrace
  } else if (firstBracket !== -1) {
    firstJSONChar = firstBracket
  }
  
  if (firstJSONChar > 0) {
    cleaned = cleaned.substring(firstJSONChar)
  }
  
  return cleaned.trim()
}

/**
 * 安全解析 JSON，带多层 fallback
 * 
 * @param raw 原始字符串
 * @param fallback 解析失败时的返回值
 * @returns 解析后的对象，或 fallback
 */
export function safeJSONParse<T = any>(raw: string, fallback: T | null = null): T | null {
  try {
    const cleaned = cleanJSONResponse(raw)
    return JSON.parse(cleaned)
  } catch (error) {
    console.error('[safeJSONParse] JSON 解析失败:', error)
    console.error('[safeJSONParse] 原始内容:', raw.substring(0, 500))
    return fallback
  }
}

/**
 * 验证 JSON 字符串是否合法
 * 
 * @param str 待验证的字符串
 * @returns 是否合法
 */
export function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}

/**
 * 尝试修复常见的 JSON 格式错误
 * 
 * @param str 可能包含格式错误的 JSON 字符串
 * @returns 修复后的 JSON 字符串
 */
export function tryFixJSON(str: string): string {
  let fixed = str.trim()
  
  // 1. 修复缺少引号的键名
  fixed = fixed.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')
  
  // 2. 修复单引号为双引号
  fixed = fixed.replace(/'([^']*)'/g, '"$1"')
  
  // 3. 修复末尾多余的逗号
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1')
  
  return fixed
}

/**
 * 深度清理并解析 JSON
 * 先尝试直接解析，如果失败则尝试修复后解析
 * 
 * @param raw 原始字符串
 * @param fallback 解析失败时的返回值
 * @returns 解析后的对象，或 fallback
 */
export function deepJSONParse<T = any>(raw: string, fallback: T | null = null): T | null {
  // 先尝试直接清理并解析
  const firstAttempt = safeJSONParse<T>(raw, null)
  if (firstAttempt !== null) {
    return firstAttempt
  }
  
  // 如果失败，尝试修复后解析
  try {
    const cleaned = cleanJSONResponse(raw)
    const fixed = tryFixJSON(cleaned)
    return JSON.parse(fixed)
  } catch (error) {
    console.error('[deepJSONParse] 深度解析失败:', error)
    return fallback
  }
}
