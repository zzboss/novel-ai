/**
 * Skill 热重载器
 * 
 * 功能说明：
 * - 监听 Skill 文件变化（新增、修改、删除）
 * - 自动重新加载变化的 Skill
 * - 防抖处理（避免频繁重载）
 * - 支持手动触发重载
 * 
 * 技术实现：
 * - 使用 Node.js 的 fs.watch()（Electron 渲染进程可访问 Node.js API）
 * - 防抖机制：300ms 内多次变化只触发一次重载
 * - 支持监听单个文件或整个目录
 * 
 * 使用示例：
 * ```typescript
 * const reloader = new SkillHotReloader()
 * 
 * // 开始监听
 * reloader.watch('/path/to/skills')
 * 
 * // 监听变化事件
 * reloader.onChange((skillId, eventType) => {
 *   console.log(`Skill ${skillId} ${eventType}`)
 * })
 * 
 * // 停止监听
 * reloader.stop()
 * ```
 */

import { SkillLoader } from './SkillLoader'
import { SkillRegistry } from './SkillRegistry'
import type { SkillManifest } from './types'

/** 变化事件类型 */
export type SkillChangeEvent = 'added' | 'changed' | 'removed'

/** 变化事件监听器 */
export type SkillChangeCallback = (skillId: string, eventType: SkillChangeEvent) => void

/** Skill 热重载器配置 */
interface SkillHotReloaderConfig {
  /** 防抖延迟（毫秒），默认 300ms */
  debounceMs: number
  /** 是否启用详细日志，默认 false */
  verbose: boolean
}

export class SkillHotReloader {
  /** 配置 */
  private config: SkillHotReloaderConfig = {
    debounceMs: 300,
    verbose: false
  }

  /** 监听的目录列表 */
  private watchedDirs: Set<string> = new Set()

  /** 文件系统监听器列表 */
  private watchers: fs.FSWatcher[] = []

  /** 防抖定时器 */
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map()

  /** 变化事件监听器 */
  private changeCallbacks: SkillChangeCallback[] = []

  /** 是否已启动 */
  private isRunning: boolean = false

  /**
   * 配置热重载器
   * 
   * @param config - 配置选项
   */
  configure(config: Partial<SkillHotReloaderConfig>): void {
    this.config = { ...this.config, ...config }
    this.log('SkillHotReloader 配置已更新:', this.config)
  }

  /**
   * 开始监听目录
   * 
   * @param dirPath - 要监听的目录路径
   */
  watch(dirPath: string): void {
    if (this.watchedDirs.has(dirPath)) {
      this.log(`目录已在监听中: ${dirPath}`)
      return
    }

    try {
      // 使用 Node.js 的 fs.watch()
      const watcher = fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
        if (!filename) return

        // 只处理 .skill.ts 文件
        if (!filename.endsWith('.skill.ts')) return

        this.log(`检测到文件变化: ${filename} (${eventType})`)

        // 防抖处理
        const key = `${dirPath}/${filename}`
        const existingTimer = this.debounceTimers.get(key)
        if (existingTimer) {
          clearTimeout(existingTimer)
        }

        const timer = setTimeout(() => {
          this.handleFileChange(dirPath, filename, eventType as SkillChangeEvent)
          this.debounceTimers.delete(key)
        }, this.config.debounceMs)

        this.debounceTimers.set(key, timer)
      })

      this.watchers.push(watcher)
      this.watchedDirs.add(dirPath)

      this.log(`开始监听目录: ${dirPath}`)
      this.isRunning = true
    } catch (error) {
      console.error('[SkillHotReloader] 监听目录失败:', error)
    }
  }

  /**
   * 停止所有监听
   */
  stop(): void {
    // 清除所有定时器
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer)
    }
    this.debounceTimers.clear()

    // 关闭所有监听器
    for (const watcher of this.watchers) {
      watcher.close()
    }
    this.watchers = []
    this.watchedDirs.clear()

    this.isRunning = false
    this.log('已停止所有监听')
  }

  /**
   * 注册变化事件监听器
   * 
   * @param callback - 回调函数
   */
  onChange(callback: SkillChangeCallback): void {
    this.changeCallbacks.push(callback)
  }

  /**
   * 移除变化事件监听器
   * 
   * @param callback - 回调函数（可选，不提供则移除所有）
   */
  offChange(callback?: SkillChangeCallback): void {
    if (callback) {
      const index = this.changeCallbacks.indexOf(callback)
      if (index >= 0) {
        this.changeCallbacks.splice(index, 1)
      }
    } else {
      this.changeCallbacks = []
    }
  }

  /**
   * 手动触发重新加载
   * 
   * @param skillDir - Skill 目录路径
   */
  async reload(skillDir: string): Promise<void> {
    try {
      this.log(`手动重新加载: ${skillDir}`)

      // 使用 SkillLoader 重新加载
      const manifest = await SkillLoader.reloadFromDirectory(skillDir)

      // 更新注册中心
      const registry = SkillRegistry.getInstance()
      registry.register(manifest, { checkDependencies: false })

      // 触发事件
      this.emitChange(manifest.id, 'changed')

      this.log(`重新加载成功: ${manifest.id}`)
    } catch (error) {
      console.error('[SkillHotReloader] 重新加载失败:', error)
    }
  }

  /**
   * 获取监听状态
   */
  getStatus(): { isRunning: boolean; watchedDirs: string[] } {
    return {
      isRunning: this.isRunning,
      watchedDirs: Array.from(this.watchedDirs)
    }
  }

  /**
   * 处理文件变化
   */
  private async handleFileChange(
    dirPath: string,
    filename: string,
    _eventType: string
  ): Promise<void> {
    const skillDir = `${dirPath}/${filename.replace(/\.skill\.ts$/, '')}`
    const manifestPath = `${skillDir}/manifest.json`

    try {
      // 检查文件是否存在
      const exists = await this.fileExists(manifestPath)

      if (exists) {
        // 文件存在：重新加载
        await this.reload(skillDir)
      } else {
        // 文件不存在：可能是删除操作
        const skillId = filename.replace(/\.skill\.ts$/, '')
        this.emitChange(skillId, 'removed')

        // 从注册中心卸载
        const registry = SkillRegistry.getInstance()
        registry.unregister(skillId, { force: true })

        this.log(`Skill 已删除: ${skillId}`)
      }
    } catch (error) {
      console.error('[SkillHotReloader] 处理文件变化失败:', error)
    }
  }

  /**
   * 触发变化事件
   */
  private emitChange(skillId: string, eventType: SkillChangeEvent): void {
    for (const callback of this.changeCallbacks) {
      try {
        callback(skillId, eventType)
      } catch (error) {
        console.error('[SkillHotReloader] 事件监听器错误:', error)
      }
    }
  }

  /**
   * 检查文件是否存在
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK)
      return true
    } catch {
      return false
    }
  }

  /**
   * 日志输出
   */
  private log(...args: unknown[]): void {
    if (this.config.verbose) {
      console.log('[SkillHotReloader]', ...args)
    }
  }
}

/** 导入 Node.js fs 模块（Electron 环境） */
const fs = require('fs') as typeof import('fs')
const { watch } = fs
