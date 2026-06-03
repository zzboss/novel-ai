/**
 * 提示词加载器（渲染进程版本）
 *
 * 通过 IPC 调用主进程读取 `prompts/` 目录下的模板文件，
 * 避免渲染进程中无法使用 Node.js fs 模块的问题。
 *
 * 分工：
 * - 主进程（prompt.ts）：只负责读取文件并返回原始模板字符串（含 {{variable}} 占位符）
 * - 渲染进程（promptLoader.ts）：负责变量替换，避免 IPC 传输不必要的变量数据
 *
 * 支持：
 * - 加载系统提示词和用户提示词模板
 * - 变量替换（{{variable}}）
 * - 缓存已加载的模板（渲染进程内存缓存）
 */

// ============================================================
// 类型定义
// ============================================================

/** 提示词分类 */
export type Category = 'a_精密构造' | 'b_精准指令' | 'c_快速执行' | 'd_分析推理'

/** Agent 名称 */
export type AgentName =
  | 'chapter_outline_agent'
  | 'chapter_agent'
  | 'chapter_content_with_input_agent'
  | 'chapter_outline_modify_agent'
  | 'chapter_content_modify_agent'
  | 'location_agent'
  | string

/** 提示词类型 */
export type PromptType = 'system' | 'user'

// ============================================================
// 缓存
// ============================================================

/** 内存缓存：键 = "category/agent/type"，值 = 原始模板字符串 */
const templateCache = new Map<string, string>()

/** 生成缓存键 */
function makeCacheKey(category: string, agent: string, type: string): string {
  return `${category}/${agent}/${type}`
}

// ============================================================
// 核心函数
// ============================================================

/**
 * 加载提示词模板（通过 IPC 调用主进程）
 *
 * 主进程只返回原始模板，变量替换在渲染进程完成。
 *
 * @param category  - 提示词分类（a_精密构造、b_精准指令、c_快速执行、d_分析推理）
 * @param agent     - Agent 名称（chapter_outline_agent、chapter_agent 等）
 * @param type      - 提示词类型（system 或 user）
 * @param variables - 变量替换映射（{{variable}} → 实际值）
 * @returns 渲染后的提示词
 */
export async function loadPrompt(
  category: Category,
  agent: AgentName,
  type: PromptType,
  variables: Record<string, string> = {}
): Promise<string> {
  const key = makeCacheKey(category, agent, type)

  // 尝试从缓存获取原始模板
  let template = templateCache.get(key)

  // 缓存未命中，通过 IPC 从主进程加载（只获取原始模板，不含变量替换）
  if (!template) {
    template = await window.electronAPI.prompt.load(category, agent, type)
    templateCache.set(key, template)
  }

  // 变量替换（使用缓存的原始模板 + 当前变量）
  return renderTemplate(template, variables)
}

/**
 * 批量加载提示词模板（一次 IPC 往返）
 *
 * @param requests - 请求数组，每项包含 { category, agent, type, variables }
 * @returns 渲染后的提示词字符串数组，与输入顺序一致
 */
export async function loadPrompts(
  requests: Array<{
    category: Category
    agent: AgentName
    type: PromptType
    variables?: Record<string, string>
  }>
): Promise<string[]> {
  // 先检查缓存，只向主进程请求未缓存的项
  const unresolved: Array<{
    index: number
    category: Category
    agent: AgentName
    type: PromptType
    variables: Record<string, string>
  }> = []

  const results = new Array<string>(requests.length)

  for (let i = 0; i < requests.length; i++) {
    const req = requests[i]
    const key = makeCacheKey(req.category, req.agent, req.type)
    const cached = templateCache.get(key)

    if (cached) {
      results[i] = renderTemplate(cached, req.variables ?? {})
    } else {
      unresolved.push({ index: i, ...req, variables: req.variables ?? {} })
    }
  }

  // 批量向主进程请求未缓存的模板（不含 variables）
  if (unresolved.length > 0) {
    const ipcRequests = unresolved.map(r => ({
      category: r.category,
      agent: r.agent,
      type: r.type
    }))

    const templates = await window.electronAPI.prompt.loadMany(ipcRequests)

    for (let i = 0; i < unresolved.length; i++) {
      const { index, category, agent, type, variables } = unresolved[i]
      const key = makeCacheKey(category, agent, type)
      templateCache.set(key, templates[i])
      results[index] = renderTemplate(templates[i], variables)
    }
  }

  return results
}

// ============================================================
// 变量替换辅助函数
// ============================================================

/**
 * 替换模板中的变量占位符 {{variable}}
 * 正确匹配 {{key}}（两个 { 两个 }）
 */
function renderTemplate(template: string, variables: Record<string, string>): string {
  if (!variables) return template

  let result = template

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g')
    result = result.replace(regex, value ?? '')
  }

  // 清除未替换的占位符
  result = result.replace(/{{[^{}]+}}/g, '')

  return result
}

// ============================================================
// 缓存管理
// ============================================================

/**
 * 清除提示词缓存
 *
 * 修改提示词模板文件后调用，下次加载会重新从主进程读取。
 */
export function clearPromptCache(): void {
  templateCache.clear()
  // 同时通知主进程清除服务端缓存
  window.electronAPI.prompt.clearCache().catch(() => {})
}

/**
 * 预加载提示词（应用启动时调用）
 *
 * 通过 IPC 批量加载常用模板，减少首次生成时的延迟。
 *
 * @param presets - 预设的提示词列表
 */
export async function preloadPrompts(
  presets: Array<{
    category: Category
    agent: AgentName
    type: PromptType
  }>
): Promise<void> {
  const requests = presets.map(p => ({
    category: p.category,
    agent: p.agent,
    type: p.type,
    variables: {}
  }))

  try {
    await loadPrompts(requests)
  } catch (error) {
    console.warn('[PromptLoader] 预加载提示词失败：', error)
  }
}
