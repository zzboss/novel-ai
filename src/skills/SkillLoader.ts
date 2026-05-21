import type { SkillManifest } from './types'

/**
 * Skill 加载器
 * 
 * 功能说明：
 * - 从文件系统加载 Skill 包（读取 manifest.json）
 * - 验证 Skill 清单的必填字段
 * - 加载内置 Skill（静态定义）
 * 
 * 设计说明：
 * - 第三方 Skill：从用户指定的本地目录加载
 * - 内置 Skill：在代码中静态定义，无需从文件系统读取
 * 
 * 使用示例：
 * ```typescript
 * // 从目录加载第三方 Skill
 * const manifest = await SkillLoader.loadFromDirectory('/path/to/skill')
 * 
 * // 加载所有内置 Skill
 * const builtin = SkillLoader.loadBuiltinSkills()
 * ```
 */
export class SkillLoader {
  /**
   * 从本地目录加载 Skill
   * 
   * 功能说明：
   * - 读取指定目录下的 manifest.json 文件
   * - 解析并验证清单内容
   * - 返回 SkillManifest 对象
   * 
   * 注意事项：
   * - 在 Electron 主进程中通过 IPC 调用此方法
   * - 渲染进程无文件系统权限，需通过 IPC 桥接
   * 
   * @param skillDir - Skill 目录路径（绝对路径）
   * @returns SkillManifest 对象，加载失败时返回 null
   */
  static async loadFromDirectory(skillDir: string): Promise<SkillManifest | null> {
    try {
      // 构建 manifest.json 文件路径
      const manifestPath = `${skillDir}/manifest.json`
      
      // 读取并解析 manifest.json
      const response = await fetch(`file://${manifestPath}`)
      if (!response.ok) throw new Error('无法读取 manifest.json')

      const manifest: SkillManifest = await response.json()

      // 基本验证：检查必填字段
      if (!manifest.id || !manifest.name || !manifest.version || !manifest.entry) {
        throw new Error('manifest.json 缺少必填字段（id, name, version, entry）')
      }

      return manifest
    } catch (error) {
      console.error('加载 Skill 失败:', error)
      return null
    }
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

    return builtin
  }
}
