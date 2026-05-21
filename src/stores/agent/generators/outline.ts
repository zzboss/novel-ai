import type { ProjectType } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import { LLMClient, type LLMLoggingConfig } from '@/llm/LLMClient'
import type { LLMMessage } from '@/llm/types'
import { OUTLINE1_PROMPT_TEMPLATE } from '../prompts'
import {
  setCurrentStep,
  setProgressMessage,
  setError,
  clearStreaming,
  setAiProcessing,
  setCurrentStreaming
} from '../state'

/**
 * 生成一级大纲（卷/部分）
 * @param idea - 灵感描述
 * @param worldSettings - 世界观设定
 * @param characters - 角色设定
 * @param projectType - 项目类型
 * @param context - 可选，用户回答或之前步骤的内容（作为上下文）
 * @returns 生成的内容
 */
export async function generateOutline1(
  idea: string,
  worldSettings: string,
  characters: string,
  projectType: ProjectType,
  context?: string
): Promise<string> {
  setCurrentStep('outline-1')
  setProgressMessage('正在生成一级大纲...')
  setError(null)
  clearStreaming()
  setAiProcessing(true, '正在生成一级大纲...')

  try {
    // 获取设置 store
    const settingsStore = useSettingsStore()
    
    // 获取默认模型配置
    const modelConfig = settingsStore.activeModel
    if (!modelConfig) {
      throw new Error('未配置默认模型，请在设置中配置AI模型')
    }

    // 生成提示词（传入上下文）
    const prompt = OUTLINE1_PROMPT_TEMPLATE(idea, worldSettings, characters, projectType, context)
    
    // 构建消息数组
    const messages: LLMMessage[] = [
      { role: 'user', content: prompt }
    ]
    
    // 使用流式输出（实时显示生成的内容）
    let fullContent = ''
    
    // 构建日志记录配置
    const loggingConfig: LLMLoggingConfig = {
      operationType: 'generateOutline',
      promptTemplateName: 'OUTLINE1_PROMPT_TEMPLATE',
      inputParameters: { idea, worldSettings, characters, projectType, context }
    }
    
    await LLMClient.streamWithCallbacks(modelConfig, messages, {
      onToken: (token: string) => {
        fullContent += token
        // 实时更新流式内容
        setCurrentStreaming(fullContent)
      },
      onDone: () => {
        setProgressMessage('一级大纲生成完成')
      },
      onError: (error: Error) => {
        throw error
      }
    }, 'outline-1', loggingConfig)
    
    return fullContent
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : '生成一级大纲失败'
    setError(errorMsg)
    throw err
  } finally {
    setAiProcessing(false)
    setCurrentStep(null)
  }
}

/**
 * 按卷生成一级大纲（单卷）
 * @param idea - 灵感描述
 * @param worldSettings - 世界观设定
 * @param characters - 角色设定
 * @param projectType - 项目类型
 * @param volumeIndex - 当前卷序号（从1开始）
 * @param userInput - 用户输入的该卷要求/想法
 * @param existingVolumes - 已生成的卷列表（用于连贯性）
 */
export async function generateOutline1Volume(
  idea: string,
  worldSettings: string,
  characters: string,
  projectType: ProjectType,
  volumeIndex: number,
  userInput?: string,
  existingVolumes?: string[]
): Promise<string> {
  setCurrentStep('outline-1')
  setProgressMessage(`正在生成第${volumeIndex}卷大纲...`)
  setError(null)
  clearStreaming()
  setAiProcessing(true, `正在生成第${volumeIndex}卷大纲...`)

  try {
    const settingsStore = useSettingsStore()
    const modelConfig = settingsStore.activeModel
    if (!modelConfig) {
      throw new Error('未配置默认模型，请在设置中配置AI模型')
    }

    const typeMap = {
      'novel': '长篇小说',
      'short-story': '短篇故事',
      'script': '短剧剧本'
    }
    const unitMap = {
      'novel': '卷',
      'short-story': '部分',
      'script': '集'
    }

    const unit = unitMap[projectType]

    let prompt = `你是一位资深${typeMap[projectType]}结构设计师。请根据以下信息，设计${typeMap[projectType]}第${volumeIndex}${unit}的大纲。

=== 创作灵感 ===
${idea}

=== 世界观设定 ===
${worldSettings}

=== 角色设定 ===
${characters}
`

    // 已有卷信息，保证连贯性
    if (existingVolumes && existingVolumes.length > 0) {
      prompt += `
=== 前面已生成的${unit}大纲 ===
${existingVolumes.map((v, i) => `--- 第${i + 1}${unit} ---\n${v}`).join('\n\n')}

注意：必须与前文保持连贯，承接前文情节发展。
`
    }

    // 用户输入的内容
    if (userInput && userInput.trim()) {
      prompt += `
=== 用户对第${volumeIndex}${unit}的要求 ===
${userInput.trim()}

请根据用户的要求来设计第${volumeIndex}${unit}的大纲，同时优化和补充用户提出的想法。
`
    } else {
      prompt += `
注意：用户未提供具体要求，请根据灵感、世界观、角色设定${existingVolumes?.length ? '和前文发展' : ''}自主设计第${volumeIndex}${unit}的大纲。
`
    }

    prompt += `
=== 输出要求 ===
请设计第${volumeIndex}${unit}的大纲，包含：
1. ${unit}标题
2. 核心事件：这一${unit}的主要情节
3. 角色发展：主要角色在这一${unit}中的成长和变化
4. 情感基调：这一${unit}的整体氛围

重要：
- 只输出第${volumeIndex}${unit}的大纲，不要输出其他${unit}
- 确保与前文（如有）连贯
- 内容具体但不过于细节，保持框架性
- 使用清晰的标题和编号
- 第一行必须是格式：# 第${volumeIndex}${unit}：[${unit}标题]，例如"# 第1卷：破晓"
`

    const messages: LLMMessage[] = [
      { role: 'user', content: prompt }
    ]

    let fullContent = ''
    
    // 构建日志记录配置
    const loggingConfig: LLMLoggingConfig = {
      operationType: 'generateOutline',
      promptTemplateName: 'generateOutline1Volume',
      inputParameters: { idea, worldSettings, characters, projectType, volumeIndex, userInput, existingVolumes }
    }
    
    await LLMClient.streamWithCallbacks(modelConfig, messages, {
      onToken: (token: string) => {
        fullContent += token
        setCurrentStreaming(fullContent)
      },
      onDone: () => {
        setProgressMessage(`第${volumeIndex}${unit}大纲生成完成`)
      },
      onError: (error: Error) => {
        throw error
      }
    }, 'outline-1', loggingConfig)

    return fullContent
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : `生成第${volumeIndex}卷大纲失败`
    setError(errorMsg)
    throw err
  } finally {
    setAiProcessing(false)
    setCurrentStep(null)
  }
}
