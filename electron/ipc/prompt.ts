/**
 * 提示词模板 IPC 处理器
 *
 * 渲染进程通过 IPC 调用主进程读取 prompts/ 目录下的模板文件，
 * 避免渲染进程中无法使用 Node.js fs 模块的问题。
 *
 * 注意：主进程只负责读取并返回原始模板字符串，
 * 变量替换（{{variable}}）由渲染进程的 promptLoader.ts 负责。
 *
 * IPC 通道：
 *   prompt:load     → 读取单个提示词模板（原始文本）
 *   prompt:loadMany → 批量读取（减少往返开销）
 *   prompt:list     → 列出某个 agent 下所有可用模板
 *   prompt:clearCache → 清除缓存（开发时使用）
 */
import { ipcMain } from 'electron'
import { readFileSync, existsSync } from 'fs'
import { join, resolve, normalize } from 'path'
import { app } from 'electron'

// ============================================================
// 常量
// ============================================================

/**
 * prompts 目录的绝对路径
 *
 * 开发环境：app.getAppPath() 返回 novel-ai 目录，prompts 在上一级
 * 生产环境：prompts 应放在 resources/prompts 目录（需在 build 时拷贝）
 */
const PROMPTS_DIR = app.isPackaged
  ? resolve(process.resourcesPath, 'prompts')
  : resolve(app.getAppPath(), '../prompts')

/** 路径白名单：只允许访问 prompts 目录下的文件 */
const ALLOWED_ROOT = normalize(PROMPTS_DIR)

// ============================================================
// 缓存
// ============================================================

const promptCache = new Map<string, string>()

/** 生成缓存键 */
function cacheKey(category: string, agent: string, type: string): string {
  return `${category}/${agent}/${type}`
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 安全路径解析：确保目标路径在允许的根目录内
 * @throws 如果路径试图跳出允许范围
 */
function safeResolve(category: string, agent: string, fileName: string): string {
  const target = resolve(ALLOWED_ROOT, category, agent, fileName)
  const normalized = normalize(target)

  if (!normalized.startsWith(ALLOWED_ROOT)) {
    throw new Error('路径越界：不允许访问 prompts 目录之外的文件')
  }

  return normalized
}

// ============================================================
// IPC 处理器
// ============================================================

/**
 * prompt:load
 *
 * 加载提示词模板原始文本（不做变量替换，由渲染进程负责替换）。
 *
 * 参数：
 *   category - 提示词分类（a_精密构造、b_精准指令 等）
 *   agent    - Agent 名称（chapter_outline_agent、location_agent 等）
 *   type     - 提示词类型（system / user）
 *
 * 返回：原始模板字符串（含 {{variable}} 占位符）
 */
ipcMain.handle(
  'prompt:load',
  async (_event, category: string, agent: string, type: string) => {
    const key = cacheKey(category, agent, type)

    // 尝试从缓存获取
    let template = promptCache.get(key)

    // 缓存未命中，从文件系统加载
    if (!template) {
      const fileName = type === 'system' ? 'system_prompt.md' : 'user_prompt_template.md'
      const filePath = safeResolve(category, agent, fileName)

      if (!existsSync(filePath)) {
        throw new Error(`提示词模板不存在：${category}/${agent}/${fileName}`)
      }

      template = readFileSync(filePath, 'utf-8')
      promptCache.set(key, template)
    }

    return template
  }
)

/**
 * prompt:loadMany
 *
 * 一次 IPC 调用加载多个提示词模板，减少往返开销。
 * 返回原始模板文本，不做变量替换。
 *
 * 参数：
 *   requests - 数组，每项包含 { category, agent, type }
 *
 * 返回：原始模板字符串数组，与输入顺序一致
 */
ipcMain.handle(
  'prompt:loadMany',
  async (_event, requests: Array<{
    category: string
    agent: string
    type: string
  }>) => {
    return requests.map(req => {
      const key = cacheKey(req.category, req.agent, req.type)

      let template = promptCache.get(key)

      if (!template) {
        const fileName = req.type === 'system' ? 'system_prompt.md' : 'user_prompt_template.md'
        const filePath = safeResolve(req.category, req.agent, fileName)

        if (!existsSync(filePath)) {
          throw new Error(`提示词模板不存在：${req.category}/${req.agent}/${fileName}`)
        }

        template = readFileSync(filePath, 'utf-8')
        promptCache.set(key, template)
      }

      return template
    })
  }
)

/**
 * prompt:list
 *
 * 列出某个 agent 目录下可用的模板文件。
 *
 * 参数：
 *   category - 提示词分类
 *   agent    - Agent 名称
 *
 * 返回：可用模板类型数组，如 ['system', 'user']
 */
ipcMain.handle(
  'prompt:list',
  async (_event, category: string, agent: string) => {
    const dir = resolve(ALLOWED_ROOT, category, agent)
    const types: string[] = []

    if (existsSync(join(dir, 'system_prompt.md'))) {
      types.push('system')
    }
    if (existsSync(join(dir, 'user_prompt_template.md'))) {
      types.push('user')
    }

    return types
  }
)

/**
 * prompt:clearCache
 *
 * 清除提示词缓存。修改模板文件后调用，无需重启应用。
 */
ipcMain.handle(
  'prompt:clearCache',
  async () => {
    promptCache.clear()
    return true
  }
)
