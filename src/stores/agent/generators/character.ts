import type { ProjectType } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import { LLMClient, type LLMLoggingConfig } from '@/llm/LLMClient'
import type { LLMMessage } from '@/llm/types'
import { CHARACTER_PROMPT_TEMPLATE } from '../prompts'
import {
  setCurrentStep,
  setProgressMessage,
  setError,
  clearStreaming,
  setAiProcessing,
  setCurrentStreaming
} from '../state'

/**
 * 生成角色设定
 * @param idea - 灵感描述
 * @param worldSettings - 世界观设定
 * @param projectType - 项目类型
 * @param context - 可选，用户回答或之前步骤的内容（作为上下文）
 * @returns 生成的内容
 */
export async function generateCharacters(
  idea: string,
  worldSettings: string,
  projectType: ProjectType,
  context?: string
): Promise<string> {
  setCurrentStep('character')
  setProgressMessage('正在生成角色设定...')
  setError(null)
  clearStreaming()
  setAiProcessing(true, '正在生成角色设定...')

  try {
    // 获取设置 store
    const settingsStore = useSettingsStore()
    
    // 获取默认模型配置
    const modelConfig = settingsStore.activeModel
    if (!modelConfig) {
      throw new Error('未配置默认模型，请在设置中配置AI模型')
    }

    // 生成提示词（传入上下文）
    const prompt = CHARACTER_PROMPT_TEMPLATE(idea, worldSettings, projectType, context)
    
    // 构建消息数组
    const messages: LLMMessage[] = [
      { role: 'user', content: prompt }
    ]
    // 使用流式输出（实时显示生成的内容）
    let fullContent = ''
    
    // 构建日志记录配置
    const loggingConfig: LLMLoggingConfig = {
      operationType: 'generateCharacter',
      promptTemplateName: 'CHARACTER_PROMPT_TEMPLATE',
      inputParameters: { idea, worldSettings, projectType, context }
    }
    
    await LLMClient.streamWithCallbacks(modelConfig, messages, {
      onToken: (token: string) => {
        fullContent += token
        // 实时更新流式内容
        setCurrentStreaming(fullContent)
      },
      onDone: () => {
        setProgressMessage('角色设定生成完成')
      },
      onError: (error: Error) => {
        throw error
      }
    }, 'character', loggingConfig)
    
    return fullContent
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : '生成角色设定失败'
    setError(errorMsg)
    throw err
  } finally {
    setAiProcessing(false)
    setCurrentStep(null)
  }
}
