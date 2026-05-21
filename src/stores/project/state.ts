import { ref, computed } from 'vue'
import type { ProjectState} from '@/types/project'

/**
 * ============================================================
 * 项目状态管理
 * 管理当前项目状态、当前章节、创建向导状态等
 * ============================================================
 */

// ==================== 项目状态 ====================

/** 当前打开的项目状态对象 */
export const project = ref<ProjectState | null>(null)

/** 当前正在编辑的章节 ID */
export const currentChapterId = ref<string>('')

/** 项目是否有未保存的修改 */
export const isDirty = ref(false)

/** 当前选中的卷 ID（用于新增章节时默认选中） */
export const selectedVolumeId = ref<string>('')

// ==================== 创建向导状态 ====================

/** 创建向导会话 */
export const session = ref<any | null>(null)

/** 是否正在执行AI操作 */
export const isAiProcessing = ref(false)

/** AI处理进度消息 */
export const aiProgressMessage = ref('')

// ==================== 自动保存状态 ====================

/** 自动保存定时器 */
export let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

/** 自动保存防抖延迟（毫秒） */
export const AUTO_SAVE_DELAY = 3000

/** 上次自动保存时间 */
export const lastAutoSaveTime = ref(0)

/** 是否正在自动保存 */
export const isAutoSaving = ref(false)

// ==================== 计算属性 ====================

/**
 * 获取当前章节所在的卷
 */
export const currentVolume = computed(() => {
  if (!project.value) return null
  for (const vol of project.value.volumes) {
    const ch = vol.chapters.find(c => c.id === currentChapterId.value)
    if (ch) return vol
  }
  return null
})

/**
 * 获取当前章节对象
 */
export const currentChapter = computed(() => {
  if (!project.value) return null
  for (const vol of project.value.volumes) {
    const ch = vol.chapters.find(c => c.id === currentChapterId.value)
    if (ch) return ch
  }
  return null
})

// ==================== 项目基础操作方法 ====================

/**
 * 标记项目为已修改状态
 */
export function markDirty() {
  isDirty.value = true
  if (project.value) {
    project.value.updatedAt = Date.now()
  }
  triggerAutoSave()
}

/**
 * 标记项目为已保存状态
 */
export function markSaved() {
  isDirty.value = false
}

/**
 * 触发自动保存（防抖）
 */
export function triggerAutoSave(): void {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
  }
  autoSaveTimer = setTimeout(async () => {
    await performAutoSave()
  }, AUTO_SAVE_DELAY)
}

/**
 * 停止自动保存定时器
 */
export function stopAutoSave(): void {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }
}

/**
 * 执行自动保存
 */
export async function performAutoSave(): Promise<void> {
  if (!project.value || !isDirty.value || isAutoSaving.value) return
  try {
    isAutoSaving.value = true
    await saveProject()
    lastAutoSaveTime.value = Date.now()
  } catch (error) {
    console.error('[AutoSave] 自动保存失败:', error)
  } finally {
    isAutoSaving.value = false
  }
}

/**
 * 保存项目到文件
 */
export async function saveProject(): Promise<void> {
  if (!project.value) return

  try {
    project.value.updatedAt = Date.now()
    await window.electronAPI.writeProject(project.value.path, JSON.parse(JSON.stringify(project.value)))
    isDirty.value = false
  } catch (error) {
    console.error('保存项目失败:', error)
    throw error
  }
}
