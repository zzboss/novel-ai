import { session } from '../state'
import type { CreationSession } from '@/types/project'

/** 本地缓存键名 */
const STORAGE_KEY = 'aiwt-creation-session'

/**
 * 保存会话到本地缓存（使用 electron-store 持久化）
 */
export async function saveSession(): Promise<void> {
  if (!session.value) return
  try {
    const data = JSON.stringify(session.value)
    // 使用 electron-store 持久化存储，确保应用重启后数据不丢失
    window.electronAPI.store.set(STORAGE_KEY, JSON.parse(data)).catch((err: unknown) => {
      console.error('[Creation] electron-store 保存失败，回退到 localStorage:', err)
      try {
        localStorage.setItem(STORAGE_KEY, data)
      } catch (e) {
        console.error('[Creation] localStorage 回退也失败:', e)
      }
    })
  } catch (error) {
    console.error('[Creation] 保存会话失败:', error)
  }
}

/**
 * 从本地缓存加载会话（优先从 electron-store，回退到 localStorage）
 */
export async function loadSession(): Promise<boolean> {
  try {
    // 优先从 electron-store 读取
    let data: string | null = null

    if (window?.electronAPI?.store) {
      const stored = await window.electronAPI.store.get(STORAGE_KEY)
      if (stored && typeof stored === 'object') {
        data = JSON.stringify(stored)
      } else if (typeof stored === 'string') {
        data = stored
      }
    }

    // 回退到 localStorage
    if (!data) {
      data = localStorage.getItem(STORAGE_KEY)
    }

    if (!data) return false

    const parsed = JSON.parse(data) as CreationSession
    // 验证数据结构
    if (!parsed.id || !parsed.projectName || !parsed.currentStep) {
      console.debug('[Creation] 缓存数据格式无效，已忽略')
      await clearSavedSession()
      return false
    }

    session.value = parsed
    return true
  } catch (error) {
    console.error('[Creation] 加载会话失败:', error)
    await clearSavedSession()
    return false
  }
}

/**
 * 清除本地缓存的会话
 */
export async function clearSavedSession(): Promise<void> {
  try {
    if (window?.electronAPI?.store) {
      await window.electronAPI.store.delete(STORAGE_KEY)
    }
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('[Creation] 清除缓存失败:', error)
  }
}
