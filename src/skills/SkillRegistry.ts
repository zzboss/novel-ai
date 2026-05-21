import type { SkillManifest, SkillContext, SkillResult } from './types'
import { useSkillStore } from '@/stores/skill'

/**
 * Skill 注册中心
 * 
 * 功能说明：
 * - 负责 Skill 的注册、卸载和生命周期管理
 * - 维护已注册 Skill 的清单（Manifest）缓存
 * - 提供按 Agent 类型查找适用 Skill 的方法
 * - 管理 Skill 的执行（当前为占位实现，未来在 Web Worker 沙箱中执行）
 * 
 * 设计模式：
 * - 单例模式：确保全局唯一的注册中心
 * - 与 Pinia Store 同步：注册/卸载时自动更新 UI 状态
 * 
 * 使用示例：
 * ```typescript
 * const registry = SkillRegistry.getInstance()
 * 
 * // 注册 Skill
 * registry.register(manifest)
 * 
 * // 获取适用于某 Agent 的 Skill 列表
 * const skills = registry.getApplicable('chapter')
 * 
 * // 执行 Skill
 * const result = await registry.execute('web-search', context)
 * ```
 */
export class SkillRegistry {
  /** 单例实例 */
  private static instance: SkillRegistry | null = null
  
  /** Skill 清单缓存（ID -> Manifest） */
  private manifests: Map<string, SkillManifest> = new Map()

  /**
   * 获取单例实例
   * @returns SkillRegistry 单例
   */
  static getInstance(): SkillRegistry {
    if (!this.instance) {
      this.instance = new SkillRegistry()
    }
    return this.instance
  }

  /**
   * 注册 Skill
   * 
   * 功能说明：
   * - 将 Skill 清单存入缓存
   * - 同步到 Pinia Store（更新 UI）
   * 
   * @param manifest - Skill 清单对象
   */
  register(manifest: SkillManifest): void {
    this.manifests.set(manifest.id, manifest)
    const store = useSkillStore()
    store.addSkill(manifest)
  }

  /**
   * 卸载 Skill
   * 
   * 功能说明：
   * - 从缓存中删除 Skill 清单
   * - 同步到 Pinia Store（更新 UI）
   * 
   * @param skillId - 要卸载的 Skill ID
   */
  unregister(skillId: string): void {
    this.manifests.delete(skillId)
    const store = useSkillStore()
    store.removeSkill(skillId)
  }

  /**
   * 获取已注册的 Skill 列表
   * @returns Skill 清单数组
   */
  getRegistered(): SkillManifest[] {
    return Array.from(this.manifests.values())
  }

  /**
   * 根据 Agent 类型获取适用的 Skill 列表
   * 
   * 筛选逻辑：
   * - applicableAgents 为空数组时，表示该 Skill 适用于所有 Agent
   * - 否则只返回 applicableAgents 中包含指定类型的 Skill
   * 
   * @param agentType - Agent 类型
   * @returns 适用的 Skill 清单数组
   */
  getApplicable(agentType: string): SkillManifest[] {
    return Array.from(this.manifests.values()).filter(
      s => s.applicableAgents.length === 0 || s.applicableAgents.includes(agentType)
    )
  }

  /**
   * 执行 Skill
   * 
   * 功能说明：
   * - 当前为占位实现
   * - 未来应在 Web Worker 沙箱中运行 Skill 代码
   * - 沙箱环境限制：无 DOM 访问、无 BroadcastChannel 权限
   * 
   * 安全设计：
   * - Skill 代码在独立线程中执行，不影响主线程
   * - 通过 postMessage 与主线程通信
   * - tool-call 权限需用户显式授权
   * 
   * @param skillId - 要执行的 Skill ID
   * @param context - Skill 执行上下文
   * @returns Promise<SkillResult> - Skill 执行结果
   */
  async execute(skillId: string, _context: SkillContext): Promise<SkillResult> {
    const manifest = this.manifests.get(skillId)
    if (!manifest) throw new Error(`Skill ${skillId} 未注册`)

    // TODO: 实际执行应在 Web Worker 沙箱中运行
    // 当前为占位实现
    return {
      output: `[Skill ${manifest.name}] 执行结果占位`,
      usage: { promptTokens: 0, completionTokens: 0 }
    }
  }
}
