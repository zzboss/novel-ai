/**
 * 系统指令层构建器
 */

import type { AgentInput, AgentContext } from '@/agents/types'
import type { ProjectState } from '@/stores/project'
import { estimateTokensChinese, type TokenBudget } from '@/utils/tokenCounter'
import { trimToTokenBudget } from '../helpers'

/**
 * 构建系统指令层
 */
export function buildSystemPromptLayer(
  input: AgentInput,
  project: ProjectState,
  budget: TokenBudget,
  agentContext?: AgentContext
): string {
  const maxTokens = budget.systemPrompt
  let content = ''

  content += `# 项目信息\n`
  content += `书名：${project.name}\n`
  content += `类型：${project.worldSettings.genre}\n`
  content += `基调：${project.worldSettings.tone}\n`

  if (project.globalStyle) {
    content += `写作风格：${project.globalStyle}\n`
  }

  // Agent 类型特定指令
  if (agentContext) {
    switch (input.type) {
      case 'chapter':
        content += `\n你正在撰写本章正文。直接输出正文内容，不要输出标题、摘要、大纲或任何辅助说明。`
        break
      case 'continue':
        content += `\n你正在续写当前内容。请紧接上文继续写作，保持语气、风格和人物一致。只输出续写部分。`
        break
      case 'polish':
        content += `\n你正在润色给定的文本。请保持原意和情节不变，提升文笔质量。只输出润色后的全文。`
        break
      case 'dialogue':
        content += `\n你正在优化对话。让每个角色的说话方式更有个性和辨识度。只输出优化后的全文。`
        break
      case 'consistency':
        content += `\n你正在执行一致性审计。请检查文本中的逻辑矛盾。`
        break
      default:
        break
    }
  } else {
    // 降级：不使用 agentContext
    switch (input.type) {
      case 'chapter':
        content += `\n你正在撰写本章正文。直接输出正文内容，不要输出标题、摘要、大纲或任何辅助说明。`
        break
      case 'continue':
        content += `\n你正在续写当前内容。请紧接上文继续写作，保持语气、风格和人物一致。只输出续写部分。`
        break
      case 'polish':
        content += `\n你正在润色给定的文本。请保持原意和情节不变，提升文笔质量。只输出润色后的全文。`
        break
      default:
        break
    }
  }

  // 裁剪到预算
  return trimToTokenBudget(content, maxTokens)
}
