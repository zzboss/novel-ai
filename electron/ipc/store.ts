import { ipcMain, app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

/** 默认配置 */
const defaultSettings = {
  models: [],
  activeModelId: '',
  agentModelMapping: {},
  theme: 'dark',
  autoSaveInterval: 3,
  maxSnapshotsPerChapter: 20,
  fontSize: 16,
  fontFamily: 'PingFang SC'
}

/** 获取配置文件路径 */
function getStorePath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

/** 加载存储数据 */
function loadData(): Record<string, unknown> {
  const filePath = getStorePath()
  try {
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, 'utf-8')
      return JSON.parse(content)
    }
  } catch (e) {
    console.error('[Store] 加载配置失败:', e)
  }
  return {}
}

/** 保存存储数据 */
function saveData(data: Record<string, unknown>): void {
  const filePath = getStorePath()
  try {
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
  } catch (e) {
    console.error('[Store] 保存配置失败:', e)
  }
}

/** 内存中的数据缓存 */
let cache: Record<string, unknown> = {}

/** 初始化：加载已有数据 */
function init(): void {
  cache = loadData()
}

// 启动时初始化
init()

/**
 * 从 store 读取数据
 * @param _event - IPC 事件对象
 * @param key - 存储键名
 * @returns 存储的值
 */
ipcMain.handle('store:get', (_event, key: string) => {
  // 每次都从文件重新加载，确保数据最新
  cache = loadData()
  
  // 如果 key 不存在，返回默认值
  if (!(key in cache)) {
    return { ...defaultSettings }
  }
  
  return cache[key]
})

/**
 * 向 store 写入数据
 * @param _event - IPC 事件对象
 * @param key - 存储键名
 * @param value - 要存储的值
 */
ipcMain.handle('store:set', (_event, key: string, value: unknown) => {
  cache[key] = value
  saveData(cache)
})

/**
 * 删除 store 中的数据
 * @param _event - IPC 事件对象
 * @param key - 存储键名
 */
ipcMain.handle('store:delete', (_event, key: string) => {
  delete cache[key]
  saveData(cache)
})

/**
 * 检查 store 中是否有指定的键
 * @param _event - IPC 事件对象
 * @param key - 存储键名
 */
ipcMain.handle('store:has', (_event, key: string) => {
  return key in cache
})
