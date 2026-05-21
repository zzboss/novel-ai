import type { ProjectType } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import { LLMClient } from '@/llm/LLMClient'
import type { LLMMessage, ModelConfig } from '@/llm/types'
import { setError } from '../state'

/**
 * 为辅助模式的问题生成 AI 建议选项
 * @param question - 问题文本
 * @param context - 上下文信息（之前的回答、项目类型等）
 * @param projectType - 项目类型
 * @param selectedModelConfig - 可选，用户选择的模型配置
 * @returns 生成的建议选项（每行一个选项）
 */
export async function generateQuestionSuggestions(
  question: string,
  context: string,
  projectType: ProjectType,
  selectedModelConfig?: ModelConfig
): Promise<string[]> {
  setError(null)

  try {
    // 获取设置 store
    const settingsStore = useSettingsStore()
    
    // 优先使用用户选择的模型配置，否则使用默认模型
    const modelConfig = selectedModelConfig || settingsStore.activeModel
    if (!modelConfig) {
      throw new Error('未配置默认模型，请在设置中配置AI模型')
    }

    const typeMap = {
      'novel': '长篇小说',
      'short-story': '短篇故事',
      'script': '短剧剧本'
    }

    // 构建提示词（按照需求文档 5.3 节优化）
    const prompt = `你是一位资深${typeMap[projectType]}创作顾问。用户正在创作一部${typeMap[projectType]}。

=== 上下文信息 ===
${context || '无'}

=== 当前问题 ===
"${question}"

=== 任务 ===
请针对这个问题，生成 5-8 个具体、有创意、多样化的参考回答选项。

要求：
1. 每个选项应该是简洁的短语或词语，不要是完整的句子
2. 选项之间要有明显差异，覆盖不同角度
3. 选项要符合${typeMap[projectType]}的创作特点
4. 每个选项控制在 2-10 个字以内
5. 如果是多选类型的问题（如题材、特征、关系），每个选项应该是一个独立的可选值（如"勇敢正直"、"师徒"）
6. 选项要具有可操作性，用户可以直接选择使用

输出格式：直接输出选项，每行一个，不要加编号、前缀或解释。`

    // 构建消息数组
    const messages: LLMMessage[] = [
      { role: 'user', content: prompt }
    ]
    
    // 调用 AI 模型
    const generated = await LLMClient.chat(modelConfig, messages, 'suggestion')
    
    // 解析返回的结果，按行分割成选项
    const suggestions = generated
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .slice(0, 8)  // 最多取前8个
    
    return suggestions.length > 0 ? suggestions : ['暂无建议，请手动输入']
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : '生成建议失败'
    setError(errorMsg)
    throw err
  }
}
