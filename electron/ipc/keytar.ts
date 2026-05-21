import { ipcMain } from 'electron'
import keytar from 'keytar'

/** 密钥存储的服务名称 */
const SERVICE_NAME = 'ai-novel-writing'

/**
 * 获取 API 密钥
 * @param _event - IPC 事件对象
 * @param provider - 提供商名称（如 'openai', 'claude' 等）
 * @returns 密钥字符串，不存在时返回 null
 */
ipcMain.handle('keytar:get', async (_event, provider: string) => {
  try {
    const key = await keytar.getPassword(SERVICE_NAME, provider)
    return key || null
  } catch (error) {
    console.error('获取密钥失败:', error)
    return null
  }
})

/**
 * 设置 API 密钥
 * @param _event - IPC 事件对象
 * @param provider - 提供商名称
 * @param key - 要保存的密钥字符串
 * @returns 是否保存成功
 */
ipcMain.handle('keytar:set', async (_event, provider: string, key: string) => {
  try {
    await keytar.setPassword(SERVICE_NAME, provider, key)
    return true
  } catch (error) {
    console.error('保存密钥失败:', error)
    throw error
  }
})

/**
 * 删除 API 密钥
 * @param _event - IPC 事件对象
 * @param provider - 提供商名称
 * @returns 是否删除成功
 */
ipcMain.handle('keytar:delete', async (_event, provider: string) => {
  try {
    const result = await keytar.deletePassword(SERVICE_NAME, provider)
    return result
  } catch (error) {
    console.error('删除密钥失败:', error)
    throw error
  }
})
