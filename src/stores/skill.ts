import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SkillManifest } from '@/skills/types'
import { SkillRegistry } from '@/skills/SkillRegistry'

/**
 * Skill Store
 *
 * 功能说明：
 * - 管理 Skill 的 UI 状态
 * - 与 SkillRegistry 同步
 * - 提供 Skill 的启用/禁用、配置等功能
 * - 提供 Skill 执行接口
 */
export const useSkillStore = defineStore('skill', () => {
  /** 已注册的 Skill 列表 */
  const registeredSkills = ref<SkillManifest[]>([])

  /** 已启用的 Skill ID 列表 */
  const enabledSkillIds = ref<Set<string>>(new Set())

  /** 是否正在加载 */
  const isLoading = ref(false)

  /** 错误信息 */
  const error = ref<string | null>(null)

  /** Skill 执行结果缓存（Skill ID -> 执行结果） */
  const executionResults = ref<Map<string, { output: string; timestamp: number }>>(new Map())

  /** 计算属性：已启用的 Skill 列表 */
  const enabledSkills = computed(() =>
    registeredSkills.value.filter(skill => enabledSkillIds.value.has(skill.id))
  )

  /** 计算属性：已禁用的 Skill 列表 */
  const disabledSkills = computed(() =>
    registeredSkills.value.filter(skill => !enabledSkillIds.value.has(skill.id))
  )

  /**
   * 添加 Skill
   * @param manifest - Skill 清单
   */
  function addSkill(manifest: SkillManifest): void {
    const existing = registeredSkills.value.findIndex(s => s.id === manifest.id)
    if (existing >= 0) {
      // 更新已存在的 Skill
      registeredSkills.value[existing] = manifest
    } else {
      // 添加新 Skill
      registeredSkills.value.push(manifest)
    }

    // 默认启用
    if (!enabledSkillIds.value.has(manifest.id)) {
      enabledSkillIds.value.add(manifest.id)
    }
  }

  /**
   * 移除 Skill
   * @param skillId - Skill ID
   */
  function removeSkill(skillId: string): void {
    const index = registeredSkills.value.findIndex(s => s.id === skillId)
    if (index >= 0) {
      registeredSkills.value.splice(index, 1)
    }
    enabledSkillIds.value.delete(skillId)
    executionResults.value.delete(skillId)
  }

  /**
   * 启用 Skill
   * @param skillId - Skill ID
   */
  function enableSkill(skillId: string): void {
    enabledSkillIds.value.add(skillId)
  }

  /**
   * 禁用 Skill
   * @param skillId - Skill ID
   */
  function disableSkill(skillId: string): void {
    enabledSkillIds.value.delete(skillId)
  }

  /**
   * 切换 Skill 启用状态
   * @param skillId - Skill ID
   */
  function toggleSkill(skillId: string): void {
    if (enabledSkillIds.value.has(skillId)) {
      disableSkill(skillId)
    } else {
      enableSkill(skillId)
    }
  }

  /**
   * 加载内置 Skill
   * 
   * 注意：实际加载逻辑在 SkillManager.vue 中触发
   * 此函数用于触发加载过程
   */
  function loadBuiltinSkills(): void {
    isLoading.value = true
    error.value = null

    try {
      // 实际加载逻辑在 SkillManager.vue 的 handleLoadBuiltin() 中
      // 这里只是触发加载过程
      console.log('[SkillStore] 开始加载内置 Skill...')
      
      // 可以通过事件总线或直接与 SkillRegistry 交互
      const registry = SkillRegistry.getInstance()
      const builtin = registry.getRegistered().filter(s => 
        ['web-search', 'reference-lookup', 'style-transfer', 'genre-rules', 'translation'].includes(s.id)
      )
      
      // 添加到 Store
      builtin.forEach(manifest => {
        addSkill(manifest)
      })
      
      console.log(`[SkillStore] 已加载 ${builtin.length} 个内置 Skill`)
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      console.error('[SkillStore] 加载内置 Skill 失败:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 执行 Skill
   * @param skillId - Skill ID
   * @param context - 执行上下文
   * @returns 执行结果
   */
  async function executeSkill(skillId: string, context: any): Promise<string> {
    isLoading.value = true
    error.value = null

    try {
      console.log(`[SkillStore] 执行 Skill: ${skillId}`)

      // 获取 Registry 实例
      const registry = SkillRegistry.getInstance()

      // 执行 Skill
      const result = await registry.execute(skillId, context)

      // 缓存执行结果
      executionResults.value.set(skillId, {
        output: result.output,
        timestamp: Date.now()
      })

      // 返回输出
      if (result.error) {
        throw new Error(result.error)
      }

      return result.output
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      console.error(`[SkillStore] 执行 Skill ${skillId} 失败:`, err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 获取 Skill 执行结果
   * @param skillId - Skill ID
   * @returns 执行结果（如果有）
   */
  function getExecutionResult(skillId: string): string | null {
    const result = executionResults.value.get(skillId)
    return result ? result.output : null
  }

  /**
   * 清除 Skill 执行结果
   * @param skillId - Skill ID（可选，不提供则清除所有）
   */
  function clearExecutionResult(skillId?: string): void {
    if (skillId) {
      executionResults.value.delete(skillId)
    } else {
      executionResults.value.clear()
    }
  }

  /**
   * 重置状态
   */
  function reset(): void {
    registeredSkills.value = []
    enabledSkillIds.value.clear()
    isLoading.value = false
    error.value = null
    executionResults.value.clear()
  }

  return {
    // 状态
    registeredSkills,
    enabledSkillIds,
    isLoading,
    error,
    executionResults,

    // 计算属性
    enabledSkills,
    disabledSkills,

    // 方法
    addSkill,
    removeSkill,
    enableSkill,
    disableSkill,
    toggleSkill,
    loadBuiltinSkills,
    executeSkill,
    getExecutionResult,
    clearExecutionResult,
    reset
  }
})
