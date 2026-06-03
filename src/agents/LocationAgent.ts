/**
 * LocationAgent — 地点生成 Agent
 *
 * 调用 LLM 生成地点数据，支持：
 * - 生成单个地点
 * - 生成多个地点
 * - 生成地点及关系
 * - 修改现有地点
 */
import { LLMClient, type LLMLoggingConfig } from '@/llm/LLMClient'
import { loadPrompt } from '@/utils/promptLoader'
import { useSettingsStore } from '@/stores/settings'
import { useProjectStore } from '@/stores/project'
import type { Location, LocationRelationship, LocationRelationType, LineStyle } from '@/types/project'
import { callJSON } from '@/llm/utils'

// ============================================================
// 类型定义
// ============================================================

interface LocationGenerateOptions {
  userInput: string
  existingLocations?: Location[]
  worldSettings?: string
  taskType?: 'generate_single' | 'generate_multiple' | 'generate_with_relationships' | 'modify_location'
  targetLocation?: Location // 修改地点时需要
}

interface SingleLocationResult {
  name: string
  description: string
  x: number
  y: number
  color?: string
  size?: number
  icon?: string
}

interface MultiLocationResult {
  locations: Array<{
    name: string
    description: string
    x: number
    y: number
    color?: string
    size?: number
    icon?: string
  }>
  relationships?: Array<{
    sourceId: string
    targetId: string
    relationType: LocationRelationType
    relationLabel: string
    description?: string
    color?: string
    lineWidth?: number
    lineStyle?: LineStyle
  }>
}

// ============================================================
// LocationAgent 类
// ============================================================

export class LocationAgent {
  private modelConfig: any

  constructor(modelConfig?: any) {
    const settingsStore = useSettingsStore()
    this.modelConfig = modelConfig || settingsStore.activeModel

    if (!this.modelConfig) {
      throw new Error('未配置默认模型，请在设置中配置AI模型')
    }
  }

  /**
   * 生成单个地点
   */
  async generateSingleLocation(options: LocationGenerateOptions): Promise<Location> {
    const { userInput, existingLocations, worldSettings } = options

    // 加载提示词
    const systemPrompt = loadPrompt(
      'b_精准指令',
      'location_agent',
      'system',
      {}
    )

    const userPrompt = loadPrompt(
      'b_精准指令',
      'location_agent',
      'user',
      {
        taskType: '生成单个地点',
        userInput,
        existingLocations: existingLocations
          ? existingLocations.map(loc => `${loc.name} (x: ${loc.x}, y: ${loc.y})\n  描述：${loc.description || '无'}`).join('\n\n')
          : '（无）',
        worldSettings: worldSettings || '（无）',
        outputRequirements: '输出单个地点 JSON，包含 name, description, x, y, color, size, icon 字段'
      }
    )

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt }
    ]

    const loggingConfig: LLMLoggingConfig = {
      operationType: 'generateSingleLocation',
      promptTemplateName: 'LOCATION_AGENT_SINGLE',
      inputParameters: {
        userInput,
        existingLocationsCount: existingLocations?.length || 0,
        taskType: 'generate_single'
      }
    }

    // 调用 LLM
    const jsonString = await LLMClient.chat(
      this.modelConfig,
      messages,
      'location-generate',
      loggingConfig
    )

    // 解析 JSON
    const result = await callJSON<SingleLocationResult>(jsonString, '生成单个地点')

    // 转换为 Location 对象
    return {
      id: this.generateId(),
      mapId: '', // 由调用方填充
      name: result.name,
      description: result.description,
      x: result.x,
      y: result.y,
      color: result.color,
      size: result.size,
      icon: result.icon,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  }

  /**
   * 生成多个地点
   */
  async generateMultipleLocations(options: LocationGenerateOptions): Promise<{ locations: Location[]; relationships: LocationRelationship[] }> {
    const { userInput, existingLocations, worldSettings } = options

    // 加载提示词
    const systemPrompt = loadPrompt(
      'b_精准指令',
      'location_agent',
      'system',
      {}
    )

    const userPrompt = loadPrompt(
      'b_精准指令',
      'location_agent',
      'user',
      {
        taskType: '生成多个地点及关系',
        userInput,
        existingLocations: existingLocations
          ? existingLocations.map(loc => `${loc.name} (x: ${loc.x}, y: ${loc.y})\n  描述：${loc.description || '无'}`).join('\n\n')
          : '（无）',
        worldSettings: worldSettings || '（无）',
        outputRequirements: '输出 JSON，包含 locations 数组和 relationships 数组。locations 包含 name, description, x, y, color, size, icon 字段；relationships 包含 sourceId, targetId, relationType, relationLabel, description, color, lineWidth, lineStyle 字段'
      }
    )

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt }
    ]

    const loggingConfig: LLMLoggingConfig = {
      operationType: 'generateMultipleLocations',
      promptTemplateName: 'LOCATION_AGENT_MULTIPLE',
      inputParameters: {
        userInput,
        existingLocationsCount: existingLocations?.length || 0,
        taskType: 'generate_multiple'
      }
    }

    // 调用 LLM
    const jsonString = await LLMClient.chat(
      this.modelConfig,
      messages,
      'location-generate-multiple',
      loggingConfig
    )

    // 解析 JSON
    const result = await callJSON<MultiLocationResult>(jsonString, '生成多个地点')

    // 转换为 Location 和 LocationRelationship 对象
    const locations: Location[] = result.locations.map((loc, index) => ({
      id: this.generateId(),
      mapId: '', // 由调用方填充
      name: loc.name,
      description: loc.description,
      x: loc.x,
      y: loc.y,
      color: loc.color,
      size: loc.size,
      icon: loc.icon,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }))

    const relationships: LocationRelationship[] = (result.relationships || []).map(rel => ({
      id: this.generateId(),
      mapId: '', // 由调用方填充
      sourceId: rel.sourceId,
      targetId: rel.targetId,
      relationType: rel.relationType,
      relationLabel: rel.relationLabel,
      description: rel.description,
      color: rel.color,
      lineWidth: rel.lineWidth,
      lineStyle: rel.lineStyle,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }))

    return { locations, relationships }
  }

  /**
   * 修改现有地点
   */
  async modifyLocation(options: LocationGenerateOptions): Promise<Location> {
    const { userInput, targetLocation, existingLocations, worldSettings } = options

    if (!targetLocation) {
      throw new Error('修改地点时必须提供 targetLocation')
    }

    // 加载提示词
    const systemPrompt = loadPrompt(
      'b_精准指令',
      'location_agent',
      'system',
      {}
    )

    const userPrompt = loadPrompt(
      'b_精准指令',
      'location_agent',
      'user',
      {
        taskType: '修改现有地点',
        userInput,
        existingLocations: existingLocations
          ? existingLocations.map(loc => `${loc.name} (x: ${loc.x}, y: ${loc.y})\n  描述：${loc.description || '无'}`).join('\n\n')
          : '（无）',
        worldSettings: worldSettings || '（无）',
        outputRequirements: `输出修改后的完整地点 JSON，包含 name, description, x, y, color, size, icon 字段。\n\n当前地点：\n${JSON.stringify(targetLocation, null, 2)}`
      }
    )

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt }
    ]

    const loggingConfig: LLMLoggingConfig = {
      operationType: 'modifyLocation',
      promptTemplateName: 'LOCATION_AGENT_MODIFY',
      inputParameters: {
        userInput,
        targetLocationId: targetLocation.id,
        targetLocationName: targetLocation.name,
        existingLocationsCount: existingLocations?.length || 0,
        taskType: 'modify_location'
      }
    }

    // 调用 LLM
    const jsonString = await LLMClient.chat(
      this.modelConfig,
      messages,
      'location-modify',
      loggingConfig
    )

    // 解析 JSON
    const result = await callJSON<SingleLocationResult>(jsonString, '修改地点')

    // 返回修改后的 Location 对象
    return {
      ...targetLocation,
      name: result.name,
      description: result.description,
      x: result.x,
      y: result.y,
      color: result.color,
      size: result.size,
      icon: result.icon,
      updatedAt: Date.now()
    }
  }

  /**
   * 生成 UUID
   */
  private generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }
}

/**
 * 快捷函数：生成单个地点
 */
export async function generateSingleLocation(
  userInput: string,
  existingLocations?: Location[],
  worldSettings?: string,
  modelConfig?: any
): Promise<Location> {
  const agent = new LocationAgent(modelConfig)
  return agent.generateSingleLocation({
    userInput,
    existingLocations,
    worldSettings,
    taskType: 'generate_single'
  })
}

/**
 * 快捷函数：生成多个地点
 */
export async function generateMultipleLocations(
  userInput: string,
  existingLocations?: Location[],
  worldSettings?: string,
  modelConfig?: any
): Promise<{ locations: Location[]; relationships: LocationRelationship[] }> {
  const agent = new LocationAgent(modelConfig)
  return agent.generateMultipleLocations({
    userInput,
    existingLocations,
    worldSettings,
    taskType: 'generate_multiple'
  })
}

/**
 * 快捷函数：修改现有地点
 */
export async function modifyLocation(
  userInput: string,
  targetLocation: Location,
  existingLocations?: Location[],
  worldSettings?: string,
  modelConfig?: any
): Promise<Location> {
  const agent = new LocationAgent(modelConfig)
  return agent.modifyLocation({
    userInput,
    targetLocation,
    existingLocations,
    worldSettings,
    taskType: 'modify_location'
  })
}
