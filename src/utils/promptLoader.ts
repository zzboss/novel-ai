/**
 * 提示词加载器
 * 
 * 从 `prompts/` 目录加载 Agent 的 system prompt、user prompt template、
 * few-shot 示例等文件，支持运行时动态加载和缓存。
 * 
 * 实现方式：
 * - 使用 Vite 的 `import.meta.glob` 静态导入 Markdown 文件（?raw）
 * - 构建时自动打包，无需运行时 fetch
 * - 支持缓存，避免重复导入
 * 
 * 文件命名约定：
 * - system_prompt.md   → Agent 的 system prompt
 * - user_prompt_template.md → Agent 的 user prompt 模板（支持 {{变量}} 替换）
 * - fewshot_examples.md → Agent 的 few-shot 示例
 * 
 * 目录结构：
 * prompts/
 *   ├── a_精密构造/
 *   │   ├── chapter_agent/
 *   │   │   ├── system_prompt.md
 *   │   │   ├── user_prompt_template.md
 *   │   │   └── fewshot_examples.md
 *   │   └── outline_agent/
 *   │       ├── system_prompt.md
 *   │       └── user_prompt_template.md
 *   ├── b_精准指令/
 *   └── ...
 */

/**
 * 提示词文件类型
 */
export type PromptFileType = 'system' | 'user_template' | 'fewshot'

/**
 * 文件名映射
 */
const fileNameMap: Record<PromptFileType, string> = {
  system: 'system_prompt.md',
  user_template: 'user_prompt_template.md',
  fewshot: 'fewshot_examples.md'
}

/**
 * 使用 Vite 的 import.meta.glob 静态导入所有提示词文件
 * 构建时会自动打包到最终产物中
 * 
 * 注意：glob 的 key 是文件的相对路径（相对于项目根目录）
 */
const promptGlob = import.meta.glob('/src/prompts/**/*.md', { 
  query: '?raw', 
  import: 'default' 
}) as Record<string, () => Promise<string>>

/**
 * 提示词缓存
 * 避免重复导入
 */
const promptCache = new Map<string, string>()

/**
 * 根据分类、Agent、文件类型获取 glob key
 * @param category - 分类（a_精密构造、b_精准指令、c_快速执行、d_分析推理）
 * @param agent - Agent 名称（chapter_agent、outline_agent 等）
 * @param fileType - 文件类型（system、user_template、fewshot）
 * @returns glob key（文件路径）
 */
function getPromptGlobKey(
  category: string,
  agent: string,
  fileType: PromptFileType
): string {
  return `/src/prompts/${category}/${agent}/${fileNameMap[fileType]}`
}

/**
 * 从 glob 加载提示词（浏览器/Node 通用）
 * @param category - 分类
 * @param agent - Agent 名称
 * @param fileType - 文件类型
 * @returns 提示词内容
 */
async function loadPromptFromGlob(
  category: string,
  agent: string,
  fileType: PromptFileType
): Promise<string> {
  const cacheKey = `${category}/${agent}/${fileType}`
  
  // 检查缓存
  if (promptCache.has(cacheKey)) {
    return promptCache.get(cacheKey)!
  }
  
  const globKey = getPromptGlobKey(category, agent, fileType)
  const loader = promptGlob[globKey]
  
  if (!loader) {
    console.warn(`[PromptLoader] Prompt file not found: ${globKey}`)
    return ''
  }
  
  try {
    const content = await loader()
    
    // 存入缓存
    promptCache.set(cacheKey, content)
    
    return content
  } catch (error) {
    console.warn(`[PromptLoader] Failed to load prompt file: ${cacheKey}`, error)
    return ''
  }
}

/**
 * 提示词加载器类
 */
export class PromptLoader {
  /**
   * 加载 System Prompt
   * @param category - 分类（a_精密构造、b_精准指令 等）
   * @param agent - Agent 名称（chapter_agent、outline_agent 等）
   * @returns System Prompt 内容
   */
  static async loadSystemPrompt(category: string, agent: string): Promise<string> {
    return loadPromptFromGlob(category, agent, 'system')
  }
  
  /**
   * 加载 User Prompt 模板
   * @param category - 分类
   * @param agent - Agent 名称
   * @returns User Prompt 模板内容（包含 {{变量}} 占位符）
   */
  static async loadUserPromptTemplate(category: string, agent: string): Promise<string> {
    return loadPromptFromGlob(category, agent, 'user_template')
  }
  
  /**
   * 加载 Few-shot 示例
   * @param category - 分类
   * @param agent - Agent 名称
   * @returns Few-shot 示例内容
   */
  static async loadFewShotExamples(category: string, agent: string): Promise<string> {
    return loadPromptFromGlob(category, agent, 'fewshot')
  }
  
  /**
   * 填充 User Prompt 模板中的变量
   * @param template - 模板字符串（包含 {{变量名}} 占位符）
   * @param variables - 变量键值对
   * @returns 填充后的字符串
   * 
   * @example
   * fillTemplate('Hello {{name}}', { name: 'World' }) // => 'Hello World'
   */
  static fillTemplate(template: string, variables: Record<string, string>): string {
    let result = template
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
      result = result.replace(regex, value || '')
    }
    
    // 移除未填充的变量（可选）
    result = result.replace(/\{\{[^}]+\}\}/g, '')
    
    return result
  }
  
  /**
   * 清空缓存
   */
  static clearCache(): void {
    promptCache.clear()
  }
}

/**
 * Agent 提示词分类映射
 * 每个 Agent 对应的提示词分类
 */
export const AGENT_CATEGORY_MAP: Record<string, string> = {
  chapter: 'a_精密构造',
  outline: 'a_精密构造',
  character: 'b_精准指令',
  world: 'b_精准指令',
  idea: 'b_精准指令',
  scene: 'b_精准指令',
  consistency: 'd_分析推理',
  polish: 'c_快速执行',
  continue: 'a_精密构造',
  reviser: 'c_快速执行',  // 定点修复，需要快速执行
  state_extractor: 'd_分析推理'  // 状态提取，需要复杂推理
}

/**
 * Agent 提示词名称映射
 * 每个 Agent 对应的提示词目录名称
 */
export const AGENT_PROMPT_NAME_MAP: Record<string, string> = {
  chapter: 'chapter_agent',
  outline: 'outline_agent',
  character: 'character_agent',
  world: 'world_agent',
  idea: 'idea_agent',
  scene: 'scene_agent',
  consistency: 'consistency_agent',
  polish: 'polish_agent',
  continue: 'continue_agent',
  reviser: 'revision_agent',
  state_extractor: 'state_extractor_agent'
}
