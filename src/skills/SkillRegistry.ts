import type { SkillManifest, SkillContext, SkillResult } from './types'
import { useSkillStore } from '@/stores/skill'
import { SkillLoadError } from './SkillLoader'

/**
 * Skill 依赖接口
 */
interface SkillDependency {
  /** 依赖的 Skill ID */
  skillId: string
  /** 版本要求（语义化版本范围） */
  versionRange?: string
}

/**
 * Skill 注册中心
 *
 * 功能说明：
 * - 负责 Skill 的注册、卸载和生命周期管理
 * - 维护已注册 Skill 的清单（Manifest）缓存
 * - 维护已注册 Skill 的模块引用
 * - 提供按 Agent 类型查找适用 Skill 的方法
 * - 管理 Skill 的依赖检查和执行
 * - 管理 Skill 的执行（在主线程或 Web Worker 中执行）
 *
 * 设计模式：
 * - 单例模式：确保全局唯一的注册中心
 * - 与 Pinia Store 同步：注册/卸载时自动更新 UI 状态
 *
 * 使用示例：
 * ```typescript
 * const registry = SkillRegistry.getInstance()
 *
 * // 注册 Skill（带模块）
 * registry.register(manifest, { module: skillModule })
 *
 * // 检查依赖
 * const missing = registry.checkDependencies(manifest)
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

  /** Skill 模块缓存（ID -> 模块导出） */
  private modules: Map<string, { manifest: SkillManifest; execute: Function }> = new Map()

  /** Skill 依赖关系缓存（Skill ID -> 依赖列表） */
  private dependencies: Map<string, SkillDependency[]> = new Map()

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
   * - 可选：存储 Skill 模块引用
   * - 检查依赖关系
   * - 同步到 Pinia Store（更新 UI，如果可用）
   *
   * @param manifest - Skill 清单对象
   * @param options - 注册选项
   * @returns 注册结果
   */
  register(
    manifest: SkillManifest,
    options: {
      checkDependencies?: boolean
      module?: { manifest: SkillManifest; execute: Function }
    } = {}
  ): { success: boolean; errors?: string[] } {
    const { checkDependencies = true, module } = options
    const errors: string[] = []

    // 检查依赖
    if (checkDependencies && manifest.dependencies) {
      const missing = this.checkDependencies(manifest)
      if (missing.length > 0) {
        errors.push(`缺少依赖: ${missing.join(', ')}`)
      }
    }

    // 检查版本冲突
    if (this.manifests.has(manifest.id)) {
      const existing = this.manifests.get(manifest.id)!
      if (existing.version !== manifest.version) {
        console.warn(`[SkillRegistry] Skill ${manifest.id} 版本冲突: ${existing.version} -> ${manifest.version}`)
      }
    }

    if (errors.length > 0) {
      console.error(`[SkillRegistry] 注册 Skill ${manifest.id} 失败:`, errors)
      return { success: false, errors }
    }

    // 注册 Skill
    this.manifests.set(manifest.id, manifest)

    // 存储模块引用（如果提供）
    if (module) {
      this.modules.set(manifest.id, module)
    }

    // 缓存依赖关系
    if (manifest.dependencies) {
      this.dependencies.set(manifest.id, manifest.dependencies)
    }

    // 同步到 Pinia Store（如果可用）
    try {
      const store = useSkillStore()
      store.addSkill(manifest)
    } catch (error) {
      // Pinia 未激活，跳过 UI 同步
      console.warn('[SkillRegistry] Pinia 未激活，跳过 UI 同步')
    }

    console.log(`[SkillRegistry] 成功注册 Skill: ${manifest.id} (${manifest.name})`)
    return { success: true }
  }

  /**
   * 卸载 Skill
   *
   * 功能说明：
   * - 从缓存中删除 Skill 清单
   * - 删除依赖关系
   * - 检查是否有其他 Skill 依赖此 Skill
   * - 同步到 Pinia Store（更新 UI，如果可用）
   *
   * @param skillId - 要卸载的 Skill ID
   * @param options - 卸载选项
   * @returns 卸载结果
   */
  unregister(skillId: string, options: { force?: boolean } = {}): { success: boolean; warnings?: string[] } {
    const { force = false } = options
    const warnings: string[] = []

    // 检查是否有其他 Skill 依赖此 Skill
    if (!force) {
      const dependents = this.getDependents(skillId)
      if (dependents.length > 0) {
        warnings.push(`以下 Skill 依赖此 Skill: ${dependents.join(', ')}`)
        console.warn(`[SkillRegistry] 卸载 Skill ${skillId} 可能导致依赖问题:`, dependents)
      }
    }

    // 卸载 Skill
    this.manifests.delete(skillId)
    this.dependencies.delete(skillId)

    // 同步到 Pinia Store（如果可用）
    try {
      const store = useSkillStore()
      store.removeSkill(skillId)
    } catch (error) {
      // Pinia 未激活，跳过 UI 同步
      console.warn('[SkillRegistry] Pinia 未激活，跳过 UI 同步')
    }

    console.log(`[SkillRegistry] 成功卸载 Skill: ${skillId}`)
    return { success: true, warnings: warnings.length > 0 ? warnings : undefined }
  }

  /**
   * 获取已注册的 Skill 列表
   * @returns Skill 清单数组
   */
  getRegistered(): SkillManifest[] {
    return Array.from(this.manifests.values())
  }

  /**
   * 根据 ID 获取 Skill 清单
   *
   * @param skillId - Skill ID
   * @returns Skill 清单，未找到时返回 undefined
   */
  getById(skillId: string): SkillManifest | undefined {
    return this.manifests.get(skillId)
  }

  /**
   * 检查 Skill 是否已注册
   *
   * @param skillId - Skill ID
   * @returns 是否已注册
   */
  isRegistered(skillId: string): boolean {
    return this.manifests.has(skillId)
  }

  /**
   * 根据 Agent 类型获取适用的 Skill 列表
   *
   * 筛选逻辑：
   * - applicableAgents 为空数组时，表示该 Skill 适用于所有 Agent
   * - 如果 agentType 为 'all'，返回所有已注册的 Skill
   * - 否则只返回 applicableAgents 中包含指定类型的 Skill
   *
   * @param agentType - Agent 类型（使用 'all' 获取所有 Skill）
   * @returns 适用的 Skill 清单数组
   */
  getApplicable(agentType: string): SkillManifest[] {
    // 特殊类型 'all'：返回所有 Skill
    if (agentType === 'all') {
      return Array.from(this.manifests.values())
    }

    return Array.from(this.manifests.values()).filter(
      s => s.applicableAgents.length === 0 || s.applicableAgents.includes(agentType)
    )
  }

  /**
   * 检查 Skill 的依赖是否满足
   *
   * 功能说明：
   * - 检查 manifest 中声明的依赖是否已注册
   * - 检查版本要求是否满足（未来实现）
   *
   * @param manifest - Skill 清单
   * @returns 缺少的依赖 ID 列表
   */
  checkDependencies(manifest: SkillManifest): string[] {
    if (!manifest.dependencies || manifest.dependencies.length === 0) {
      return []
    }

    const missing: string[] = []

    for (const dep of manifest.dependencies) {
      if (!this.manifests.has(dep.skillId)) {
        missing.push(dep.skillId)
      }
      // TODO: 检查版本范围（需要语义化版本解析库）
    }

    return missing
  }

  /**
   * 获取依赖指定 Skill 的其他 Skill 列表
   *
   * @param skillId - Skill ID
   * @returns 依赖该 Skill 的其他 Skill ID 列表
   */
  getDependents(skillId: string): string[] {
    const dependents: string[] = []

    for (const [id, deps] of this.dependencies.entries()) {
      if (deps.some(dep => dep.skillId === skillId)) {
        dependents.push(id)
      }
    }

    return dependents
  }

  /**
   * 获取 Skill 的依赖树（递归）
   *
   * @param skillId - Skill ID
   * @returns 依赖树（扁平化列表）
   */
  getDependencyTree(skillId: string): string[] {
    const visited = new Set<string>()
    const tree: string[] = []

    const traverse = (id: string) => {
      if (visited.has(id)) return
      visited.add(id)

      const deps = this.dependencies.get(id)
      if (!deps) return

      for (const dep of deps) {
        if (!visited.has(dep.skillId)) {
          tree.push(dep.skillId)
          traverse(dep.skillId)
        }
      }
    }

    traverse(skillId)
    return tree
  }

  /**
   * 执行 Skill
   *
   * 功能说明：
   * - 如果已注册模块，则调用模块的 execute 函数
   * - 否则返回错误
   * - 未来可在 Web Worker 沙箱中运行 Skill 代码
   *
   * 安全设计：
   * - 内置 Skill 在主线程执行（受信任）
   * - 第三方 Skill 应在 Web Worker 沙箱中执行
   * - tool-call 权限需用户显式授权
   *
   * @param skillId - 要执行的 Skill ID
   * @param context - Skill 执行上下文
   * @returns Promise<SkillResult> - Skill 执行结果
   */
  async execute(skillId: string, context: SkillContext): Promise<SkillResult> {
    const manifest = this.manifests.get(skillId)
    if (!manifest) {
      throw new SkillLoadError('VALIDATION_FAILED', `Skill ${skillId} 未注册`)
    }

    // 检查依赖
    const missing = this.checkDependencies(manifest)
    if (missing.length > 0) {
      throw new SkillLoadError('VALIDATION_FAILED', `Skill ${skillId} 缺少依赖: ${missing.join(', ')}`)
    }

    // 检查是否有模块引用
    const module = this.modules.get(skillId)
    if (!module) {
      console.warn(`[SkillRegistry] Skill ${skillId} 没有注册模块，无法执行`)
      return {
        output: `Skill ${manifest.name} 未加载模块，无法执行`,
        error: 'MODULE_NOT_FOUND'
      }
    }

    try {
      console.log(`[SkillRegistry] 执行 Skill: ${manifest.name}`)

      // 调用模块的 execute 函数
      // 注意：当前内置 Skill 的 execute 函数签名可能不同
      // 需要根据实际情况调整参数传递
      const result = await module.execute(context)

      return {
        output: typeof result === 'string' ? result : JSON.stringify(result),
        usage: { promptTokens: 0, completionTokens: 0 } // TODO: 实际统计 Token 使用
      }
    } catch (error) {
      console.error(`[SkillRegistry] 执行 Skill ${skillId} 失败:`, error)
      return {
        output: '',
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 批量执行 Skill
   *
   * @param skillIds - Skill ID 数组
   * @param context - Skill 执行上下文
   * @returns 执行结果数组
   */
  async executeMultiple(skillIds: string[], _context: SkillContext): Promise<SkillResult[]> {
    const results: SkillResult[] = []

    for (const skillId of skillIds) {
      try {
        const result = await this.execute(skillId, _context)
        results.push(result)
      } catch (error) {
        console.error(`[SkillRegistry] 执行 Skill ${skillId} 失败:`, error)
        results.push({
          output: '',
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    return results
  }

  /**
   * 清除所有注册
   */
  clear(): void {
    this.manifests.clear()
    this.dependencies.clear()
    console.log('[SkillRegistry] 已清除所有注册')
  }
}
