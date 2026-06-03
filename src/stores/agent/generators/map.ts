import { useSettingsStore } from '@/stores/settings'
import { LLMClient, type LLMLoggingConfig } from '@/llm/LLMClient'
import type { LLMMessage } from '@/llm/types'
import { MAP_PROMPT_TEMPLATE } from '../prompts'
import {
  setCurrentStep,
  setProgressMessage,
  setError,
  clearStreaming,
  setAiProcessing,
  setCurrentStreaming
} from '../state'

export interface GeneratedLocation {
  name: string
  description: string
  color?: string
  size?: number
}

export interface GeneratedRelationship {
  sourceIndex: number
  targetIndex: number
  relationType: string
  relationLabel: string
  description?: string
  color?: string
  lineStyle?: string
}

export interface GeneratedMapData {
  locations: GeneratedLocation[]
  relationships: GeneratedRelationship[]
}

/**
 * 生成地图数据（地点 + 地点关系）
 * @param mapName - 地图名称
 * @param projectContext - 项目背景（灵感、世界观等）
 * @returns 生成的地图数据
 */
export async function generateMap(
  mapName: string,
  projectContext?: string
): Promise<GeneratedMapData> {
  setCurrentStep('map')
  setProgressMessage('正在生成地图数据...')
  setError(null)
  clearStreaming()
  setAiProcessing(true, '正在生成地图数据...')

  try {
    const settingsStore = useSettingsStore()
    const modelConfig = settingsStore.activeModel
    if (!modelConfig) {
      throw new Error('未配置默认模型，请在设置中配置AI模型')
    }

    const prompt = MAP_PROMPT_TEMPLATE(mapName, projectContext)

    const messages: LLMMessage[] = [
      { role: 'user', content: prompt }
    ]

    let fullContent = ''

    const loggingConfig: LLMLoggingConfig = {
      operationType: 'generateMap',
      promptTemplateName: 'MAP_PROMPT_TEMPLATE',
      inputParameters: { mapName, projectContext }
    }

    await LLMClient.streamWithCallbacks(modelConfig, messages, {
      onToken: (token: string) => {
        fullContent += token
        setCurrentStreaming(fullContent)
      },
      onDone: () => {
        setProgressMessage('地图数据生成完成')
      },
      onError: (error: Error) => {
        throw error
      }
    }, 'map', loggingConfig)

    // 解析 JSON 响应
    const parsed = parseMapResponse(fullContent)
    return parsed
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : '生成地图数据失败'
    setError(errorMsg)
    throw err
  } finally {
    setAiProcessing(false)
    setCurrentStep(null)
  }
}

/**
 * 从 AI 响应中解析地图数据
 */
function parseMapResponse(content: string): GeneratedMapData {
  // 记录原始响应（用于调试）
  console.log('[MapEditor] AI 原始响应:', content)

  // 尝试提取 JSON（可能包含在 markdown 代码块中）
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ||
                   content.match(/(\{[\s\S]*\})/)

  let jsonStr = jsonMatch ? jsonMatch[1] : content

  // 清理可能的非 JSON 前缀/后缀
  const startIdx = jsonStr.indexOf('{')
  const endIdx = jsonStr.lastIndexOf('}')
  if (startIdx === -1 || endIdx === -1) {
    console.error('[MapEditor] 未找到 JSON 边界，原始内容:', content)
    throw new Error('AI 响应中未找到有效的 JSON 数据')
  }
  jsonStr = jsonStr.substring(startIdx, endIdx + 1)

  // 清理常见的 JSON 格式问题
  jsonStr = jsonStr
    .replace(/[\u2018\u2019]/g, "'")  // 替换弯引号
    .replace(/[\u201C\u201D]/g, '"')  // 替换弯双引号
    .replace(/,\s*\}/g, '}')  // 去掉对象末尾多余的逗号
    .replace(/,\s*\]/g, ']')  // 去掉数组末尾多余的逗号
    .replace(/\n/g, '\\n')  // 转义换行符
    .replace(/\r/g, '\\r')  // 转义回车符
    .replace(/\t/g, '\\t')  // 转义制表符

  console.log('[MapEditor] 清理后的 JSON 字符串:', jsonStr)

  try {
    const parsed = JSON.parse(jsonStr)
    if (!parsed.locations || !Array.isArray(parsed.locations)) {
      throw new Error('AI 响应缺少 locations 数组')
    }
    return {
      locations: parsed.locations.filter((l: any) => l.name && l.description),
      relationships: parsed.relationships || []
    }
  } catch (e) {
    // 输出详细的错误信息
    const errorMsg = e instanceof Error ? e.message : 'JSON 格式错误'
    console.error('[MapEditor] JSON 解析失败:', errorMsg)
    console.error('[MapEditor] 失败的 JSON 字符串:', jsonStr)
    throw new Error(`解析 AI 响应失败：${errorMsg}`)
  }
}
