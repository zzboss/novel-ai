import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ModelConfig } from '@/llm/types'
import type { AgentType } from '@/agents/types'

/**
 * 设置状态（SettingsState）接口
 * 存储用户的全局配置信息
 */
export interface SettingsState {
  /** 模型配置列表（支持配置多个模型） */
  models: ModelConfig[]
  /** 当前全局活跃的模型 ID（兜底用） */
  activeModelId: string
  /**
   * 按 Agent 类型指定模型
   * 未配置的 Agent 类型自动回退到 activeModelId
   */
  agentModelMapping: Partial<Record<AgentType, string>>
  /** 主题：暗色/亮色/护眼 */
  theme: 'dark' | 'light' | 'eye-care'
  /** 自动保存间隔（秒） */
  autoSaveInterval: number
  /** 每个章节最多保留的快照数量 */
  maxSnapshotsPerChapter: number
  /** 编辑器字体大小（像素） */
  fontSize: number
  /** 编辑器字体族 */
  fontFamily: string
  /** 项目目录（用于首页项目列表） */
  projectsDirectory: string
}

/** 默认设置 */
const defaultSettings: SettingsState = {
  models: [],
  activeModelId: '',
  agentModelMapping: {},
  theme: 'dark',
  autoSaveInterval: 3,
  maxSnapshotsPerChapter: 20,
  fontSize: 16,
  fontFamily: 'PingFang SC',
  projectsDirectory: ''
}

/** 持久化存储键名 */
const STORAGE_KEY = 'app-settings'

/** 初始化标记 */
let initialized = false
/** 初始化 Promise */
let initPromise: Promise<void> | null = null

/**
 * 异步初始化设置（从持久化存储加载）
 */
async function initSettings(): Promise<SettingsState> {
  try {
    if (window.electronAPI?.store) {
      const stored = await window.electronAPI.store.get(STORAGE_KEY) as Partial<SettingsState> | undefined
      if (stored) {
        return { ...defaultSettings, ...stored }
      }
    } else {
      console.warn('[Settings] window.electronAPI.store 不存在')
    }
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e))
    console.error('[Settings] 加载设置失败:', err)
  }
  return { ...defaultSettings }
}

/**
 * 保存设置到持久化存储
 * 注意：Electron IPC 通信要求数据必须是可克隆的（不能包含函数、循环引用等）
 */
async function persistSettings(settings: SettingsState): Promise<void> {
  try {
    if (!window.electronAPI?.store) {
      console.error('[Settings] 错误：window.electronAPI.store 不存在，无法保存！')
      return  // 提前返回，不执行保存
    }
    
    // 创建纯数据对象（确保可克隆）
    const dataToSave = JSON.parse(JSON.stringify(settings))

    await window.electronAPI.store.set(STORAGE_KEY, dataToSave)
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e))
    console.error('[Settings] 保存设置失败:', err)
    console.error('[Settings] 错误详情:', err.message)
    console.error('[Settings] 错误堆栈:', err.stack)
  }
}

/**
 * 设置状态管理 Store
 * 
 * 功能说明：
 * - 管理模型配置（支持多个模型，可切换活跃模型）
 * - 管理应用主题、字体、自动保存等设置
 * - 提供模型增删改查方法
 * - 通过 electron-store 实现持久化存储
 */
export const useSettingsStore = defineStore('settings', () => {
  /** 设置状态对象 */
  const settings = ref<SettingsState>({ ...defaultSettings })
  
  /** 是否已初始化 */
  const isReady = ref(false)

  /**
   * 初始化 store（从持久化存储加载）
   */
  async function initialize(): Promise<void> {
    if (initialized) return
    
    if (!initPromise) {
      initPromise = initSettings().then(loaded => {
        settings.value = loaded
        initialized = true
        isReady.value = true
      })
    }
    
    return initPromise
  }

  /**
   * 获取当前活跃的模型配置
   */
  const activeModel = computed(() => {
    return settings.value.models.find(m => m.id === settings.value.activeModelId) || null
  })

  /**
   * 为指定 Agent 类型获取应使用的模型配置
   */
  function getAgentModel(agentType: AgentType): ModelConfig | null {
    const modelId =
      settings.value.agentModelMapping[agentType] || settings.value.activeModelId
    return settings.value.models.find(m => m.id === modelId) || null
  }

  /**
   * 设置指定 Agent 使用的模型
   */
  function setAgentModel(agentType: AgentType, modelId: string): void {
    if (!modelId) {
      delete settings.value.agentModelMapping[agentType]
    } else {
      settings.value.agentModelMapping[agentType] = modelId
    }
    // 触发保存
    persistSettings(settings.value)
  }

  /**
   * 添加模型配置
   */
  function addModel(config: ModelConfig): void {
    settings.value.models.push(config)
    // 如果是第一个添加的模型，自动设为活跃模型
    if (settings.value.models.length === 1) {
      settings.value.activeModelId = config.id
    }
    // 触发保存
    persistSettings(settings.value)
  }

  /**
   * 删除模型配置
   */
  function removeModel(id: string): void {
    settings.value.models = settings.value.models.filter(m => m.id !== id)
    // 如果删除的是当前活跃模型，自动切换到第一个模型
    if (settings.value.activeModelId === id && settings.value.models.length > 0) {
      settings.value.activeModelId = settings.value.models[0].id
    }
    // 同步清理 agentModelMapping 中引用已删除模型的条目
    for (const agentType of Object.keys(settings.value.agentModelMapping)) {
      if (settings.value.agentModelMapping[agentType as AgentType] === id) {
        delete settings.value.agentModelMapping[agentType as AgentType]
      }
    }
    // 触发保存
    persistSettings(settings.value)
  }

  /**
   * 设置全局活跃模型
   */
  function setActiveModel(id: string): void {
    settings.value.activeModelId = id
    // 触发保存
    persistSettings(settings.value)
  }

  /**
   * 根据 ID 获取模型配置
   */
  function getModelById(id: string): ModelConfig | null {
    return settings.value.models.find(m => m.id === id) || null
  }

  /**
   * 部分更新设置
   */
  function updateSettings(partial: Partial<SettingsState>): void {
    Object.assign(settings.value, partial)
    // 触发保存
    persistSettings(settings.value)
  }

  /** 当前主题 */
  const theme = computed(() => settings.value.theme)

  return {
    settings,
    theme,
    isReady,
    initialize,
    activeModel,
    getAgentModel,
    getModelById,
    setAgentModel,
    addModel,
    removeModel,
    setActiveModel,
    updateSettings
  }
})
