import type { SkillManifest } from './types'

/**
 * Skill 加载错误类
 * 
 * 功能说明：
 * - 自定义错误类型，便于错误分类和处理
 * - 包含错误代码和详细信息
 */
export class SkillLoadError extends Error {
  constructor(
    public code: 'FILE_NOT_FOUND' | 'INVALID_JSON' | 'VALIDATION_FAILED' | 'FETCH_FAILED' | 'UNKNOWN',
    message: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'SkillLoadError'
  }
}

/**
 * Skill 加载器配置接口
 */
interface SkillLoaderConfig {
  /** 缓存超时时间（毫秒），默认 5 分钟 */
  cacheTimeout: number
  /** 是否启用缓存，默认 true */
  enableCache: boolean
  /** 是否启用详细日志，默认 false */
  verbose: boolean
}

/**
 * 缓存项接口
 */
interface CacheEntry {
  manifest: SkillManifest
  timestamp: number
  directory: string
}

/**
 * Skill 加载器
 * 
 * 功能说明：
 * - 从文件系统加载 Skill 包（读取 manifest.json）
 * - 验证 Skill 清单的必填字段
 * - 加载内置 Skill（静态定义）
 * - 提供缓存机制，避免重复加载
 * - 提供详细的错误分类和处理
 * 
 * 设计说明：
 * - 第三方 Skill：从用户指定的本地目录加载
 * - 内置 Skill：在代码中静态定义，无需从文件系统读取
 * - 缓存机制：使用内存缓存，支持超时和手动清除
 * 
 * 使用示例：
 * ```typescript
 * // 从目录加载第三方 Skill
 * const manifest = await SkillLoader.loadFromDirectory('/path/to/skill')
 * 
 * // 加载所有内置 Skill
 * const builtin = SkillLoader.loadBuiltinSkills()
 * 
 * // 清除缓存
 * SkillLoader.clearCache()
 * 
 * // 配置加载器
 * SkillLoader.configure({ cacheTimeout: 10 * 60 * 1000, verbose: true })
 * ```
 */
export class SkillLoader {
  /** 缓存：目录路径 -> 缓存项 */
  private static cache = new Map<string, CacheEntry>()
  
  /** 配置 */
  private static config: SkillLoaderConfig = {
    cacheTimeout: 5 * 60 * 1000, // 5 分钟
    enableCache: true,
    verbose: false
  }

  /**
   * 配置 SkillLoader
   * 
   * @param config - 配置选项
   */
  static configure(config: Partial<SkillLoaderConfig>): void {
    this.config = { ...this.config, ...config }
    this.log('SkillLoader 配置已更新:', this.config)
  }

  /**
   * 从本地目录加载 Skill
   * 
   * 功能说明：
   * - 读取指定目录下的 manifest.json 文件
   * - 解析并验证清单内容
   * - 返回 SkillManifest 对象
   * - 支持缓存机制，避免重复读取
   * 
   * 注意事项：
   * - 在 Electron 主进程中通过 IPC 调用此方法
   * - 渲染进程无文件系统权限，需通过 IPC 桥接
   * - 缓存的文件修改时间未检查，如需检测文件变化请调用 invalidateCache()
   * 
   * 错误处理：
   * - FILE_NOT_FOUND: manifest.json 文件不存在或无法访问
   * - FETCH_FAILED: 网络请求失败（fetch 错误）
   * - INVALID_JSON: JSON 解析失败
   * - VALIDATION_FAILED: 必填字段缺失或格式错误
   * 
   * @param skillDir - Skill 目录路径（绝对路径）
   * @param options - 加载选项
   * @returns SkillManifest 对象，加载失败时抛出 SkillLoadError
   */
  static async loadFromDirectory(
    skillDir: string, 
    options: { useCache?: boolean; throwOnError?: boolean } = {}
  ): Promise<SkillManifest> {
    const { useCache = true, throwOnError = false } = options

    // 检查缓存
    if (this.config.enableCache && useCache) {
      const cached = this.getFromCache(skillDir)
      if (cached) {
        this.log(`从缓存加载 Skill: ${skillDir}`)
        return cached
      }
    }

    try {
      // 构建 manifest.json 文件路径
      const manifestPath = `${skillDir}/manifest.json`
      
      this.log(`正在加载 Skill: ${manifestPath}`)

      // 读取并解析 manifest.json
      let response: Response
      try {
        response = await fetch(`file://${manifestPath}`)
      } catch (fetchError) {
        throw new SkillLoadError(
          'FETCH_FAILED',
          `无法访问 manifest.json: ${manifestPath}`,
          fetchError
        )
      }

      if (!response.ok) {
        throw new SkillLoadError(
          'FILE_NOT_FOUND',
          `manifest.json 不存在或无法读取: ${manifestPath} (HTTP ${response.status})`,
          { status: response.status, statusText: response.statusText }
        )
      }

      // 解析 JSON
      let manifest: SkillManifest
      try {
        manifest = await response.json()
      } catch (jsonError) {
        throw new SkillLoadError(
          'INVALID_JSON',
          'manifest.json 格式错误，无法解析为 JSON',
          jsonError
        )
      }

      // 验证必填字段
      const requiredFields = ['id', 'name', 'version', 'entry']
      const missingFields = requiredFields.filter(field => !(field in manifest) || !manifest[field as keyof SkillManifest])
      
      if (missingFields.length > 0) {
        throw new SkillLoadError(
          'VALIDATION_FAILED',
          `manifest.json 缺少必填字段: ${missingFields.join(', ')}`,
          { missingFields, manifest }
        )
      }

      // 验证字段类型
      if (typeof manifest.id !== 'string' || !manifest.id.trim()) {
        throw new SkillLoadError(
          'VALIDATION_FAILED',
          'manifest.json 字段 "id" 必须是非空字符串',
          { id: manifest.id }
        )
      }

      if (typeof manifest.version !== 'string' || !manifest.version.trim()) {
        throw new SkillLoadError(
          'VALIDATION_FAILED',
          'manifest.json 字段 "version" 必须是非空字符串',
          { version: manifest.version }
        )
      }

      // 添加到缓存
      if (this.config.enableCache && useCache) {
        this.addToCache(skillDir, manifest)
      }

      this.log(`Skill 加载成功: ${manifest.id} (${manifest.name})`)
      return manifest

    } catch (error) {
      // 记录详细错误日志
      console.error('[SkillLoader] 加载 Skill 失败:', error)
      
      // 如果是自定义错误，直接重新抛出
      if (error instanceof SkillLoadError) {
        if (throwOnError) throw error
        throw error
      }

      // 包装未知错误
      const wrappedError = new SkillLoadError(
        'UNKNOWN',
        `加载 Skill 时发生未知错误: ${error instanceof Error ? error.message : String(error)}`,
        error
      )

      if (throwOnError) throw wrappedError
      throw wrappedError
    }
  }

  /**
   * 批量加载多个 Skill 目录
   * 
   * @param skillDirs - Skill 目录路径数组
   * @param options - 加载选项
   * @returns 加载结果数组（成功返回 manifest，失败返回 null）
   */
  static async loadMultiple(
    skillDirs: string[],
    options: { continueOnError?: boolean } = {}
  ): Promise<(SkillManifest | null)[]> {
    const { continueOnError = true } = options
    const results: (SkillManifest | null)[] = []

    for (const dir of skillDirs) {
      try {
        const manifest = await this.loadFromDirectory(dir)
        results.push(manifest)
      } catch (error) {
        console.error(`批量加载失败: ${dir}`, error)
        results.push(null)
        
        if (!continueOnError) {
          throw error
        }
      }
    }

    return results
  }

  /**
   * 加载内置 Skill
   * 
   * 功能说明：
   * - 返回预定义的内置 Skill 清单数组
   * - 内置 Skill 包括：联网搜索、参考资料查找、文风迁移、类型规则注入、翻译
   * - 这些 Skill 随应用打包，无需用户额外安装
   * 
   * 内置 Skill 列表：
   * 1. web-search（联网搜索）：互联网搜索，需 tool-call 权限
   * 2. reference-lookup（参考资料查找）：检索参考资料，适用于 chapter/continue/polish
   * 3. style-transfer（文风迁移）：改写文风，适用于 polish
   * 4. genre-rules（类型规则注入）：注入类型规则，适用于 outline/chapter/continue
   * 5. translation（翻译）：文本翻译，适用于 polish
   * 
   * @returns 内置 Skill 清单数组
   */
  static loadBuiltinSkills(): SkillManifest[] {
    // 内置 Skill 列表（静态导入）
    const builtin: SkillManifest[] = [
      {
        id: 'web-search',
        name: '联网搜索',
        version: '1.0.0',
        description: '通过互联网搜索获取实时信息',
        author: 'AIWT Team',
        applicableAgents: [], // 适用于所有 Agent
        entry: '@/skills/builtin/web-search.skill.ts',
        requiresToolCall: true // 需要网络权限，需用户授权
      },
      {
        id: 'reference-lookup',
        name: '参考资料查找',
        version: '1.0.0',
        description: '在指定参考资料中检索相关内容',
        author: 'AIWT Team',
        applicableAgents: ['chapter', 'continue', 'polish'],
        entry: '@/skills/builtin/reference-lookup.skill.ts',
        requiresToolCall: false
      },
      {
        id: 'style-transfer',
        name: '文风迁移',
        version: '1.0.0',
        description: '将文本改写为指定作者的文风',
        author: 'AIWT Team',
        applicableAgents: ['polish'],
        entry: '@/skills/builtin/style-transfer.skill.ts',
        requiresToolCall: false
      },
      {
        id: 'genre-rules',
        name: '类型规则注入',
        version: '1.0.0',
        description: '注入特定类型的写作规则和套路',
        author: 'AIWT Team',
        applicableAgents: ['outline', 'chapter', 'continue'],
        entry: '@/skills/builtin/genre-rules.skill.ts',
        requiresToolCall: false
      },
      {
        id: 'translation',
        name: '翻译',
        version: '1.0.0',
        description: '将文本翻译为指定语言',
        author: 'AIWT Team',
        applicableAgents: ['polish'],
        entry: '@/skills/builtin/translation.skill.ts',
        requiresToolCall: false
      }
    ]

    this.log(`加载了 ${builtin.length} 个内置 Skill`)
    return builtin
  }

  /**
   * 重新加载指定目录的 Skill（热重载）
   * 
   * 功能说明：
   * - 使缓存失效
   * - 重新从文件系统加载
   * - 返回新的 manifest
   * 
   * 使用场景：
   * - 文件变化时自动重新加载
   * - 手动刷新 Skill
   * 
   * @param skillDir - Skill 目录路径
   * @returns 重新加载后的 SkillManifest
   */
  static async reloadFromDirectory(skillDir: string): Promise<SkillManifest> {
    this.log(`正在重新加载 Skill: ${skillDir}`)
    
    // 使缓存失效
    this.invalidateCache(skillDir)
    
    // 重新加载
    return await this.loadFromDirectory(skillDir, { useCache: false })
  }

  /**
   * 清除所有缓存
   */
  static clearCache(): void {
    const size = this.cache.size
    this.cache.clear()
    this.log(`已清除所有缓存 (${size} 项)`)
  }

  /**
   * 使指定目录的缓存失效
   * 
   * @param skillDir - Skill 目录路径
   * @returns 是否成功移除
   */
  static invalidateCache(skillDir: string): boolean {
    const deleted = this.cache.delete(skillDir)
    if (deleted) {
      this.log(`已清除缓存: ${skillDir}`)
    }
    return deleted
  }

  /**
   * 获取缓存统计信息
   * 
   * @returns 缓存统计
   */
  static getCacheStats(): { size: number; entries: Array<{ directory: string; age: number; manifestId: string }> } {
    const entries = Array.from(this.cache.entries()).map(([directory, entry]) => ({
      directory,
      age: Date.now() - entry.timestamp,
      manifestId: entry.manifest.id
    }))

    return {
      size: this.cache.size,
      entries
    }
  }

  /**
   * 从缓存获取 manifest
   */
  private static getFromCache(skillDir: string): SkillManifest | null {
    const entry = this.cache.get(skillDir)
    if (!entry) return null

    // 检查是否过期
    const age = Date.now() - entry.timestamp
    if (age > this.config.cacheTimeout) {
      this.log(`缓存已过期: ${skillDir} (${age}ms)`)
      this.cache.delete(skillDir)
      return null
    }

    return entry.manifest
  }

  /**
   * 添加到缓存
   */
  private static addToCache(skillDir: string, manifest: SkillManifest): void {
    this.cache.set(skillDir, {
      manifest,
      timestamp: Date.now(),
      directory: skillDir
    })
    this.log(`已添加到缓存: ${manifest.id} (${skillDir})`)
  }

  /**
   * 日志输出（根据配置）
   */
  private static log(...args: unknown[]): void {
    if (this.config.verbose) {
      console.log('[SkillLoader]', ...args)
    }
  }
}
