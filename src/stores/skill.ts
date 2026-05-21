import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SkillManifest } from '@/skills/types'

/**
 * Skill 状态管理 Store
 * 
 * 功能说明：
 * - 管理已注册的 Skill 清单
 * - 管理已启用的 Skill（通过 enabledSkillIds 集合跟踪）
 * - 提供 Skill 的增删改查和启用/禁用切换
 * 
 * 设计说明：
 * - skills: 存储所有已注册的 Skill 清单（包括内置和第三方）
 * - enabledSkillIds: 存储已启用的 Skill ID 集合（用于快速查找）
 * - enabledSkills: 计算属性，根据 enabledSkillIds 过滤出已启用的 Skill 列表
 * 
 * 使用示例：
 * ```typescript
 * const skillStore = useSkillStore()
 * 
 * // 注册 Skill
 * skillStore.addSkill(manifest)
 * 
 * // 启用/禁用 Skill
 * skillStore.toggleSkill('web-search')
 * 
 * // 检查 Skill 是否启用
 * if (skillStore.isEnabled('web-search')) {
 *   // 执行 Skill 逻辑
 * }
 * ```
 */
export const useSkillStore = defineStore('skill', () => {
  /** 已注册的 Skill 清单 */
  const skills = ref<SkillManifest[]>([])
  
  /** 已启用的 Skill ID 集合 */
  const enabledSkillIds = ref<Set<string>>(new Set())

  /**
   * 注册 Skill
   * @param manifest - Skill 清单对象
   */
  function addSkill(manifest: SkillManifest) {
    if (!skills.value.find(s => s.id === manifest.id)) {
      skills.value.push(manifest)
    }
  }

  /**
   * 卸载 Skill
   * @param skillId - 要卸载的 Skill ID
   */
  function removeSkill(skillId: string) {
    skills.value = skills.value.filter(s => s.id !== skillId)
    enabledSkillIds.value.delete(skillId)
  }

  /**
   * 切换 Skill 启用/禁用状态
   * @param skillId - 要切换的 Skill ID
   */
  function toggleSkill(skillId: string) {
    if (enabledSkillIds.value.has(skillId)) {
      enabledSkillIds.value.delete(skillId)
    } else {
      enabledSkillIds.value.add(skillId)
    }
  }

  /**
   * 检查 Skill 是否启用
   * @param skillId - 要检查的 Skill ID
   * @returns 是否启用
   */
  function isEnabled(skillId: string): boolean {
    return enabledSkillIds.value.has(skillId)
  }

  /**
   * 获取已启用的 Skill 列表
   * 计算属性，随 skills 和 enabledSkillIds 自动更新
   */
  const enabledSkills = computed(() =>
    skills.value.filter(s => enabledSkillIds.value.has(s.id))
  )

  return {
    skills,
    enabledSkillIds,
    enabledSkills,
    addSkill,
    removeSkill,
    toggleSkill,
    isEnabled
  }
})
