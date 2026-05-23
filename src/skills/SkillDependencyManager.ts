/**
 * Skill 依赖管理器
 * 
 * 功能说明：
 * - 解析 Skill 之间的依赖关系
 * - 检测循环依赖
 * - 按依赖顺序排序（拓扑排序）
 * - 验证依赖版本兼容性
 * 
 * 使用示例：
 * ```typescript
 * const manager = new SkillDependencyManager()
 * 
 * // 添加 Skill 依赖关系
 * manager.addSkill(manifest1)
 * manager.addSkill(manifest2) // manifest2 依赖 manifest1
 * 
 * // 检测循环依赖
 * const hasCycle = manager.detectCycle()
 * 
 * // 获取加载顺序
 * const order = manager.getLoadOrder()
 * ```
 */

import type { SkillManifest, SkillDependency } from './types'

/** 循环依赖错误 */
export class CircularDependencyError extends Error {
  constructor(public cycle: string[]) {
    super(`检测到循环依赖: ${cycle.join(' -> ')}`)
    this.name = 'CircularDependencyError'
  }
}

/** 版本不兼容错误 */
export class VersionIncompatibleError extends Error {
  constructor(
    public skillId: string,
    public requiredVersion: string,
    public actualVersion: string
  ) {
    super(`Skill ${skillId} 版本不兼容: 需要 ${requiredVersion}, 实际 ${actualVersion}`)
    this.name = 'VersionIncompatibleError'
  }
}

export class SkillDependencyManager {
  /** Skill 列表（ID -> Manifest） */
  private skills: Map<string, SkillManifest> = new Map()

  /** 依赖关系图（Skill ID -> 依赖列表） */
  private dependencyGraph: Map<string, SkillDependency[]> = new Map()

  /**
   * 添加 Skill 到依赖管理器
   * 
   * @param manifest - Skill 清单
   */
  addSkill(manifest: SkillManifest): void {
    this.skills.set(manifest.id, manifest)

    // 添加依赖关系
    if (manifest.dependencies && manifest.dependencies.length > 0) {
      this.dependencyGraph.set(manifest.id, manifest.dependencies)
    } else {
      this.dependencyGraph.set(manifest.id, [])
    }
  }

  /**
   * 移除 Skill
   * 
   * @param skillId - Skill ID
   */
  removeSkill(skillId: string): void {
    this.skills.delete(skillId)
    this.dependencyGraph.delete(skillId)

    // 移除其他 Skill 对此 Skill 的依赖
    for (const [id, deps] of this.dependencyGraph.entries()) {
      const filteredDeps = deps.filter(dep => dep.skillId !== skillId)
      this.dependencyGraph.set(id, filteredDeps)
    }
  }

  /**
   * 检测循环依赖
   * 
   * 使用 DFS（深度优先搜索）检测有向图中的循环
   * 
   * @returns 是否存在循环依赖
   */
  detectCycle(): boolean {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    for (const skillId of this.dependencyGraph.keys()) {
      if (this.hasCycleDFS(skillId, visited, recursionStack)) {
        return true
      }
    }

    return false
  }

  /**
   * 获取循环依赖路径
   * 
   * @returns 循环依赖路径（如果有），否则返回 null
   */
  getCyclePath(): string[] | null {
    const visited = new Set<string>()
    const path: string[] = []

    for (const skillId of this.dependencyGraph.keys()) {
      if (!visited.has(skillId)) {
        const cycle = this.findCycleDFS(skillId, visited, new Set<string>(), path)
        if (cycle) {
          return cycle
        }
      }
    }

    return null
  }

  /**
   * 获取按依赖顺序排序的加载列表（拓扑排序）
   * 
   * 使用 Kahn 算法（基于入度的拓扑排序）
   * 
   * @returns 按依赖顺序排列的 Skill ID 列表
   * @throws CircularDependencyError 当存在循环依赖时
   */
  getLoadOrder(): string[] {
    // 检查循环依赖
    const cyclePath = this.getCyclePath()
    if (cyclePath) {
      throw new CircularDependencyError(cyclePath)
    }

    // 计算入度
    const inDegree = new Map<string, number>()
    for (const skillId of this.dependencyGraph.keys()) {
      inDegree.set(skillId, 0)
    }

    for (const [skillId, deps] of this.dependencyGraph.entries()) {
      for (const dep of deps) {
        inDegree.set(dep.skillId, (inDegree.get(dep.skillId) || 0) + 1)
      }
    }

    // Kahn 算法
    const queue: string[] = []
    const result: string[] = []

    // 添加入度为 0 的节点
    for (const [skillId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(skillId)
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!
      result.push(current)

      // 减少依赖此节点的其他节点的入度
      for (const [skillId, deps] of this.dependencyGraph.entries()) {
        for (const dep of deps) {
          if (dep.skillId === current) {
            const newDegree = inDegree.get(skillId)! - 1
            inDegree.set(skillId, newDegree)

            if (newDegree === 0) {
              queue.push(skillId)
            }
          }
        }
      }
    }

    // 检查是否有未处理的节点（存在循环依赖）
    if (result.length !== this.dependencyGraph.size) {
      throw new CircularDependencyError([])
    }

    return result
  }

  /**
   * 验证依赖版本兼容性
   * 
   * @returns 版本不兼容的 Skill 列表
   */
  validateVersions(): Array<{ skillId: string; dependency: SkillDependency; actualVersion: string }> {
    const incompatible: Array<{ skillId: string; dependency: SkillDependency; actualVersion: string }> = []

    for (const [skillId, deps] of this.dependencyGraph.entries()) {
      for (const dep of deps) {
        const depManifest = this.skills.get(dep.skillId)
        if (!depManifest) continue

        // 检查版本范围（简化版：只检查主版本号）
        if (dep.versionRange) {
          const actualVersion = depManifest.version
          if (!this.isVersionCompatible(dep.versionRange, actualVersion)) {
            incompatible.push({ skillId, dependency: dep, actualVersion })
          }
        }
      }
    }

    return incompatible
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

      const deps = this.dependencyGraph.get(id)
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
   * 获取依赖于指定 Skill 的其他 Skill 列表
   * 
   * @param skillId - Skill ID
   * @returns 依赖于此 Skill 的其他 Skill ID 列表
   */
  getDependents(skillId: string): string[] {
    const dependents: string[] = []

    for (const [id, deps] of this.dependencyGraph.entries()) {
      if (deps.some(dep => dep.skillId === skillId)) {
        dependents.push(id)
      }
    }

    return dependents
  }

  /**
   * 清除所有数据
   */
  clear(): void {
    this.skills.clear()
    this.dependencyGraph.clear()
  }

  /**
   * DFS 检测循环依赖（辅助方法）
   */
  private hasCycleDFS(
    skillId: string,
    visited: Set<string>,
    recursionStack: Set<string>
  ): boolean {
    if (recursionStack.has(skillId)) {
      return true // 检测到循环
    }

    if (visited.has(skillId)) {
      return false
    }

    visited.add(skillId)
    recursionStack.add(skillId)

    const deps = this.dependencyGraph.get(skillId) || []
    for (const dep of deps) {
      if (this.hasCycleDFS(dep.skillId, visited, recursionStack)) {
        return true
      }
    }

    recursionStack.delete(skillId)
    return false
  }

  /**
   * DFS 查找循环依赖路径（辅助方法）
   */
  private findCycleDFS(
    skillId: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    path: string[]
  ): string[] | null {
    if (recursionStack.has(skillId)) {
      // 找到循环
      const cycleStart = path.indexOf(skillId)
      return path.slice(cycleStart).concat(skillId)
    }

    if (visited.has(skillId)) {
      return null
    }

    visited.add(skillId)
    recursionStack.add(skillId)
    path.push(skillId)

    const deps = this.dependencyGraph.get(skillId) || []
    for (const dep of deps) {
      const cycle = this.findCycleDFS(dep.skillId, visited, recursionStack, path)
      if (cycle) {
        return cycle
      }
    }

    recursionStack.delete(skillId)
    path.pop()

    return null
  }

  /**
   * 检查版本兼容性（简化版）
   * 
   * 支持的符号：>=, <=, =, >, <
   * 示例：">=1.0.0", "<=2.0.0", "=1.5.0"
   */
  private isVersionCompatible(range: string, version: string): boolean {
    // 简化版：只检查主版本号
    const rangeMatch = range.match(/^(>=|<=|=|>|<)?\s*(\d+)\.(\d+)\.(\d+)$/)
    const versionMatch = version.match(/^(\d+)\.(\d+)\.(\d+)$/)

    if (!rangeMatch || !versionMatch) {
      return true // 无法解析，假设兼容
    }

    const operator = rangeMatch[1] || '>='
    const rangeMajor = parseInt(rangeMatch[2])
    const rangeMinor = parseInt(rangeMatch[3])
    const rangePatch = parseInt(rangeMatch[4])

    const versionMajor = parseInt(versionMatch[1])
    const versionMinor = parseInt(versionMatch[2])
    const versionPatch = parseInt(versionMatch[3])

    const versionNum = versionMajor * 1000000 + versionMinor * 1000 + versionPatch
    const rangeNum = rangeMajor * 1000000 + rangeMinor * 1000 + rangePatch

    switch (operator) {
      case '>=':
        return versionNum >= rangeNum
      case '<=':
        return versionNum <= rangeNum
      case '=':
        return versionNum === rangeNum
      case '>':
        return versionNum > rangeNum
      case '<':
        return versionNum < rangeNum
      default:
        return true
    }
  }
}
