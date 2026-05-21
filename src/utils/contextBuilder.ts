/**
 * 上下文构建器（ContextBuilder）— 分层裁剪架构
 * 
 * 重构说明：
 * 本文件已重构为模块化架构，原始实现已备份至 contextBuilder.ts.bak
 * 新架构位于 context-builder/ 目录，本文件仅作为重新导出入口，确保向后兼容
 * 
 * 新架构优势：
 * - 按责任分离：每层独立文件（systemPrompt、worldConstraints、characterProfiles 等）
 * - 便于维护：每层逻辑清晰，易于理解和修改
 * - 便于测试：可独立测试每层构建函数
 * - 便于扩展：新增层只需在 layers/ 下添加文件并在 index.ts 中注册
 */

// 重新导出所有公共 API，确保向后兼容
import { buildContextPackage } from './context-builder'
import type { AgentInput } from '@/agents/types'
import type { ProjectState } from '@/stores/project'

export {
  buildContextPackage,
  contextPackageToMessages,
  type ContextPackage,
  type RuleStack,
  type ContextBuildOptions
} from './context-builder'

/**
 * 构建上下文字符串（向后兼容包装器）
 *
 * 桥接旧的 buildContext(project, input) → 字符串 调用模式至新的
 * buildContextPackage 分层架构。用于 BaseAgent.buildContext() 方法。
 *
 * @param project - 项目状态
 * @param input - Agent 输入
 * @returns 组装后的上下文字符串（所有 system 层拼合）
 */
export function buildContext(project: ProjectState, input: AgentInput): string {
  const pkg = buildContextPackage(input, project, null)
  // 组装所有 system 层内容为单一字符串
  const parts: string[] = []
  if (pkg.systemPrompt) parts.push(pkg.systemPrompt)
  if (pkg.worldConstraints) parts.push(pkg.worldConstraints)
  if (pkg.characterProfiles) parts.push(pkg.characterProfiles)
  if (pkg.foreshadowState) parts.push(pkg.foreshadowState)
  if (pkg.skillContext) parts.push(pkg.skillContext)
  // 前文摘要和章节上下文作为上下文的一部分输出
  if (pkg.previousSummaries) parts.push(pkg.previousSummaries)
  if (pkg.chapterContext) parts.push(pkg.chapterContext)
  if (pkg.userInjections) parts.push(pkg.userInjections)
  return parts.filter(Boolean).join('\n\n')
}
