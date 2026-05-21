import type { ProjectType } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import { useProjectStore } from '@/stores/project'
import { LLMClient, type LLMLoggingConfig } from '@/llm/LLMClient'
import type { LLMMessage, ModelConfig } from '@/llm/types'
import { IDEA_PROMPT_TEMPLATE, IDEA_MODIFY_PROMPT_TEMPLATE } from '../prompts'
import {
  setCurrentStep,
  setProgressMessage,
  setError,
  clearStreaming,
  setAiProcessing,
  setCurrentStreaming
} from '../state'

/**
 * 生成灵感描述
 * @param userInput - 用户输入
 * @param projectType - 项目类型
 * @param context - 可选，之前步骤的内容（作为上下文）
 * @param selectedModelConfig - 可选，用户选择的模型配置
 * @returns 生成的内容
 */
export async function generateIdea(
  userInput: string,
  projectType: ProjectType,
  context?: string,
  selectedModelConfig?: ModelConfig
): Promise<string> {
  setCurrentStep('idea')
  setProgressMessage('正在生成灵感描述...')
  setError(null)
  clearStreaming()
  setAiProcessing(true, '正在生成灵感描述...')

  try {
    // 获取设置 store
    const settingsStore = useSettingsStore()
    
    // 优先使用用户选择的模型配置，否则使用默认模型
    const modelConfig = selectedModelConfig || settingsStore.activeModel
    if (!modelConfig) {
      throw new Error('未配置默认模型，请在设置中配置AI模型')
    }

    // 生成提示词（传入上下文）
    const prompt = IDEA_PROMPT_TEMPLATE(userInput, projectType, context)
    
    // 构建消息数组
    const messages: LLMMessage[] = [
      { role: 'user', content: prompt }
    ]
    
    // 使用流式输出（实时显示生成的内容）
    let fullContent = ''
    
    // 构建日志记录配置
    const projectStore = useProjectStore()
    const loggingConfig: LLMLoggingConfig = {
      operationType: 'generateIdea',
      promptTemplateName: 'IDEA_PROMPT_TEMPLATE',
      inputParameters: { userInput, projectType, context },
      projectPath: projectStore.project?.path || ''
    }
    
    await LLMClient.streamWithCallbacks(modelConfig, messages, {
      onToken: (token: string) => {
        fullContent += token
        // 实时更新流式内容
        setCurrentStreaming(fullContent)
      },
      onDone: () => {
        setProgressMessage('灵感描述生成完成')
      },
      onError: (error: Error) => {
        throw error
      }
    }, 'idea', loggingConfig)
    
    return fullContent
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : '生成灵感描述失败'
    setError(errorMsg)
    throw err
  } finally {
    setAiProcessing(false)
    setCurrentStep(null)
  }
}

/**
 * 修改灵感描述
 * @param currentContent - 当前灵感内容
 * @param userInput - 用户修改要求
 * @param projectType - 项目类型
 * @param selectedModelConfig - 可选，用户选择的模型配置
 * @returns 修改后的内容
 */
export async function modifyIdea(
  currentContent: string,
  userInput: string,
  projectType: ProjectType,
  selectedModelConfig?: ModelConfig
): Promise<string> {
  setCurrentStep('idea')
  setProgressMessage('正在修改灵感描述...')
  setError(null)
  clearStreaming()
  setAiProcessing(true, '正在修改灵感描述...')

  try {
    const settingsStore = useSettingsStore()
    // 优先使用用户选择的模型配置，否则使用默认模型
    const modelConfig = selectedModelConfig || settingsStore.activeModel
    if (!modelConfig) {
      throw new Error('未配置默认模型，请在设置中配置AI模型')
    }

    const prompt = IDEA_MODIFY_PROMPT_TEMPLATE(currentContent, userInput, projectType)
    
    const messages: LLMMessage[] = [
      { role: 'user', content: prompt }
    ]
    
    // 使用流式输出（实时显示生成的内容）
    let fullContent = ''
    
    // 构建日志记录配置
    const projectStore = useProjectStore()
    const loggingConfig: LLMLoggingConfig = {
      operationType: 'modifyIdea',
      promptTemplateName: 'IDEA_MODIFY_PROMPT_TEMPLATE',
      inputParameters: { currentContent, userInput, projectType },
      projectPath: projectStore.project?.path || ''
    }
    
    await LLMClient.streamWithCallbacks(modelConfig, messages, {
      onToken: (token: string) => {
        fullContent += token
        setCurrentStreaming(fullContent)
      },
      onDone: () => {
        setProgressMessage('灵感描述修改完成')
      },
      onError: (error: Error) => {
        throw error
      }
    }, 'idea', loggingConfig)
    
    return fullContent
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : '修改灵感描述失败'
    setError(errorMsg)
    throw err
  } finally {
    setAiProcessing(false)
    setCurrentStep(null)
  }
}
