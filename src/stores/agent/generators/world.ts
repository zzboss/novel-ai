import type { ProjectType } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import { LLMClient, type LLMLoggingConfig } from '@/llm/LLMClient'
import type { LLMMessage, ModelConfig } from '@/llm/types'
import { WORLD_PROMPT_TEMPLATE, WORLD_MODIFY_PROMPT_TEMPLATE } from '../prompts'
import {
  setCurrentStep,
  setProgressMessage,
  setError,
  clearStreaming,
  setAiProcessing,
  setCurrentStreaming
} from '../state'

/**
 * 生成世界观设定
 * @param idea - 灵感描述
 * @param projectType - 项目类型
 * @param context - 可选，用户回答或之前步骤的内容（作为上下文）
 * @param selectedModelConfig - 可选，用户选择的模型配置
 * @returns 生成的内容
 */
export async function generateWorld(
  idea: string,
  projectType: ProjectType,
  context?: string,
  selectedModelConfig?: ModelConfig
): Promise<string> {
  setCurrentStep('world')
  setProgressMessage('正在生成世界观设定...')
  setError(null)
  clearStreaming()
  setAiProcessing(true, '正在生成世界观设定...')

  try {
    // 获取设置 store
    const settingsStore = useSettingsStore()
    
    // 优先使用用户选择的模型配置，否则使用默认模型
    const modelConfig = selectedModelConfig || settingsStore.activeModel
    if (!modelConfig) {
      throw new Error('未配置默认模型，请在设置中配置AI模型')
    }

    // 生成提示词（传入上下文）
    const prompt = WORLD_PROMPT_TEMPLATE(idea, projectType, context)
    
    // 构建消息数组
    const messages: LLMMessage[] = [
      { role: 'user', content: prompt }
    ]
    
    // 使用流式输出（实时显示生成的内容）
    let fullContent = ''
    
    // 构建日志记录配置
    const loggingConfig: LLMLoggingConfig = {
      operationType: 'generateWorld',
      promptTemplateName: 'WORLD_PROMPT_TEMPLATE',
      inputParameters: { idea, projectType, context }
    }
    
    await LLMClient.streamWithCallbacks(modelConfig, messages, {
      onToken: (token: string) => {
        fullContent += token
        // 实时更新流式内容
        setCurrentStreaming(fullContent)
      },
      onDone: () => {
        setProgressMessage('世界观设定生成完成')
      },
      onError: (error: Error) => {
        throw error
      }
    }, 'world', loggingConfig)
    
    return fullContent
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : '生成世界观设定失败'
    setError(errorMsg)
    throw err
  } finally {
    setAiProcessing(false)
    setCurrentStep(null)
  }
}

/**
 * 修改世界观设定
 * @param currentContent - 当前世界观内容
 * @param userInput - 用户修改要求
 * @param projectType - 项目类型
 * @param selectedModelConfig - 可选，用户选择的模型配置
 * @returns 修改后的内容
 */
export async function modifyWorld(
  currentContent: string,
  userInput: string,
  projectType: ProjectType,
  selectedModelConfig?: ModelConfig
): Promise<string> {
  setCurrentStep('world')
  setProgressMessage('正在修改世界观设定...')
  setError(null)
  clearStreaming()
  setAiProcessing(true, '正在修改世界观设定...')

  try {
    const settingsStore = useSettingsStore()
    // 优先使用用户选择的模型配置，否则使用默认模型
    const modelConfig = selectedModelConfig || settingsStore.activeModel
    if (!modelConfig) {
      throw new Error('未配置默认模型，请在设置中配置AI模型')
    }

    const prompt = WORLD_MODIFY_PROMPT_TEMPLATE(currentContent, userInput, projectType)
    
    const messages: LLMMessage[] = [
      { role: 'user', content: prompt }
    ]
    
    // 使用流式输出（实时显示生成的内容）
    let fullContent = ''
    
    // 构建日志记录配置
    const loggingConfig: LLMLoggingConfig = {
      operationType: 'modifyWorld',
      promptTemplateName: 'WORLD_MODIFY_PROMPT_TEMPLATE',
      inputParameters: { currentContent, userInput, projectType }
    }
    
    await LLMClient.streamWithCallbacks(modelConfig, messages, {
      onToken: (token: string) => {
        fullContent += token
        setCurrentStreaming(fullContent)
      },
      onDone: () => {
        setProgressMessage('世界观设定修改完成')
      },
      onError: (error: Error) => {
        throw error
      }
    }, 'world', loggingConfig)
    
    return fullContent
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : '修改世界观设定失败'
    setError(errorMsg)
    throw err
  } finally {
    setAiProcessing(false)
    setCurrentStep(null)
  }
}
