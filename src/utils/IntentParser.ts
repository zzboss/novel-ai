/**
 * IntentParser - 向后兼容的重新导出文件
 * 
 * 新的模块结构：
 * - intent-parser/types.ts - 类型定义
 * - intent-parser/llmParser.ts - LLM 语义理解
 * - intent-parser/keywordMatcher.ts - 关键词匹配降级
 * - intent-parser/contextExtractor.ts - 编辑器上下文提取
 * - intent-parser/index.ts - 主入口
 */

// 重新导出主函数
export { parseIntent } from './intent-parser'

// 重新导出类型和接口
export type { 
  IntentType, 
  ParsedIntent, 
  EditorContext 
} from './intent-parser'

// 重新导出上下文提取函数
export { extractEditorContext } from './intent-parser'
