import { ref, computed, onBeforeUnmount, nextTick, type Ref, type ComputedRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { Volume, Chapter } from '@/types/project'

interface UseChapterManagerOptions {
  projectStore: any
  chapterEditorRef: any
  editorContent: Ref<string>
  editorWordCount: Ref<number>
  currentChapterId: any
}

export interface UseChapterManagerReturn {
  volumes: ComputedRef<Volume[]>
  volumeInfos: ComputedRef<{id: string, title: string, chapterCount: number}[]>
  defaultVolumeId: ComputedRef<string>
  addChapterDialogVisible: Ref<boolean>
  selectChapter: typeof selectChapter
  saveCurrentChapterContent: typeof saveCurrentChapterContent
  loadChapterContent: typeof loadChapterContent
  loadChapterOutline: typeof loadChapterOutline
  addChapter: typeof addChapter
  deleteChapter: typeof deleteChapter
  onAddChapterConfirm: typeof onAddChapterConfirm
  saveProject: typeof saveProject
}

const addChapterDialogVisible = ref(false)
let chapterSaveTimer: ReturnType<typeof setTimeout> | null = null

let _projectStore: any
let _chapterEditorRef: any
let _editorContent: Ref<string>
let _editorWordCount: Ref<number>
let _currentChapterId: any

function countWords(text: string): number {
  return text.replace(/\s/g, '').length
}

export function selectChapter(id: string): void {
  saveCurrentChapterContent()
  _projectStore.setCurrentChapter(id)
  // 等待 DOM 更新（ChapterEditorWithOutline 组件重建完成）后再加载内容
  nextTick(() => {
    loadChapterContent(id)
    loadChapterOutline(id)
  })
}

export function saveCurrentChapterContent(chapterId?: string): void {
  const id = chapterId || _currentChapterId.value
  if (!id || !_projectStore.project) return

  // 关键修复：editor ref 为 null 说明组件已销毁，此时不能保存（会覆盖为空字符串）
  // 组件销毁前的保存已在 ChapterEditorWithOutline.onBeforeUnmount 中处理
  if (!_chapterEditorRef.value) {
    console.warn('[saveCurrentChapterContent] editor ref 为 null，跳过保存（避免覆盖为空）')
    return
  }

  // 保存正文（通过 electronAPI 写入文件）
  const html = _chapterEditorRef.value?.getContent?.() || _chapterEditorRef.value?.getHTML?.() || ''
  const text = _chapterEditorRef.value?.getText?.() || ''
  const wc = countWords(text)

  // 如果是新的 ChapterEditorWithOutline 组件
  if (_chapterEditorRef.value?.getContent) {
    window.electronAPI.writeChapter(_projectStore.project.path, id, html).catch((err: unknown) => {
      console.error('保存章节内容失败:', err)
    })
  } else if (_chapterEditorRef.value?.getHTML) {
    // 旧的 ChapterEditor 组件
    window.electronAPI.writeChapter(_projectStore.project.path, id, html).catch((err: unknown) => {
      console.error('保存章节内容失败:', err)
    })
  }

  _projectStore.updateChapterWordCount(id, wc)
  // 注意：细纲保存已移至 OutlinePanel 组件，通过 chapterOutline API 独立保存
}

export async function loadChapterContent(chapterId: string): Promise<void> {
  if (!_projectStore.project || !_chapterEditorRef.value) return

  try {
    const content = await window.electronAPI.readChapter(_projectStore.project.path, chapterId)
    if (content) {
      if (content.startsWith('<')) {
        _chapterEditorRef.value.setContent?.(content) || _chapterEditorRef.value?.setContent?.(content)
      } else {
        const html = content
          .split(/\n\n/)
          .map((para: string) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
          .join('')
        _chapterEditorRef.value.setContent?.(html) || _chapterEditorRef.value?.setContent?.(html)
      }
      _editorContent.value = _chapterEditorRef.value.getHTML?.() || ''
      _editorWordCount.value = countWords(_chapterEditorRef.value.getText?.() || '')
    } else {
      _chapterEditorRef.value.clearContent?.()
      _editorContent.value = ''
      _editorWordCount.value = 0
    }
  } catch (error) {
    console.error('加载章节内容失败:', error)
    _chapterEditorRef.value?.clearContent?.()
    _editorContent.value = ''
    _editorWordCount.value = 0
  }
}

/** 加载章节细纲 */
export function loadChapterOutline(chapterId: string): void {
  // 注意：细纲加载已移至 OutlinePanel 组件，通过 chapterOutline API 独立加载
  // 此函数保留用于向后兼容，但不再执行任何操作
  console.log('[loadChapterOutline] 细纲加载已移至 OutlinePanel 组件')
}

function addChapter(): void {
  if (!_projectStore.project) {
    ElMessage.warning('请先创建或打开项目')
    return
  }
  const vols = _projectStore.project?.volumes || []
  if (vols.length === 0) {
    ElMessage.warning('请先创建卷')
    return
  }
  addChapterDialogVisible.value = true
}

function onAddChapterConfirm(data: { volumeId: string; title: string }): void {
  saveCurrentChapterContent()

  let title = data.title.trim()
  if (!title) {
    const project = _projectStore.project
    if (project) {
      const chapterCount = project.volumes.reduce((sum: number, v: Volume) => sum + v.chapters.length,0) + 1
      title = `第${chapterCount}章`
    } else {
      title = '新章节'
    }
  }

  const chapterId = _projectStore.addChapter(data.volumeId, title)
  _projectStore.setCurrentChapter(chapterId)
  ElMessage.success('章节已创建（标题可在左侧树中修改）')

  _chapterEditorRef.value?.clearContent()
  _editorContent.value = ''
  _editorWordCount.value = 0
}

async function deleteChapter(id: string, title: string): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定要删除章节「${title}」吗？此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    _projectStore.removeChapter(id)

    if (_currentChapterId.value === id) {
      _projectStore.setCurrentChapter('')
      _chapterEditorRef.value?.clearContent()
      _editorContent.value = ''
      _editorWordCount.value = 0
    }

    ElMessage.success('章节已删除')
  } catch (error: unknown) {
    if (error === 'cancel' || error === 'close') {
      return
    }
    const message = error instanceof Error ? error.message : String(error)
    ElMessage.error(message || '删除章节失败')
  }
}

function saveProject(): void {
  saveCurrentChapterContent()
  _projectStore.saveProject()
  ElMessage.success('保存成功')
}

export function useChapterManager(options: UseChapterManagerOptions): UseChapterManagerReturn {
  _projectStore = options.projectStore
  _chapterEditorRef = options.chapterEditorRef
  _editorContent = options.editorContent
  _editorWordCount = options.editorWordCount
  _currentChapterId = options.currentChapterId

  const volumes = computed(() => _projectStore.project?.volumes || [])

  const volumeInfos = computed(() =>
    volumes.value.map((v: Volume) => ({
      id: v.id,
      title: v.title,
      chapterCount: v.chapters.length
    }))
  )

  const defaultVolumeId = computed(() => {
    const selected = _projectStore.selectedVolumeId
    if (selected && _projectStore.project?.volumes.some((v: Volume) => v.id === selected)) {
      return selected
    }
    const proj = _projectStore.project
    if (!proj) return ''
    const curChapId = _currentChapterId.value
    if (curChapId) {
      const vol = proj.volumes.find((v: Volume) => v.chapters.some((ch: Chapter) => ch.id === curChapId))
      if (vol) return vol.id
    }
    return proj.volumes[0]?.id || ''
  })

  onBeforeUnmount(() => {
    saveCurrentChapterContent()
    if (chapterSaveTimer) {
      clearTimeout(chapterSaveTimer)
      chapterSaveTimer = null
    }
  })

  return {
    volumes,
    volumeInfos,
    defaultVolumeId,
    addChapterDialogVisible,
    selectChapter,
    saveCurrentChapterContent,
    loadChapterContent,
    loadChapterOutline,
    addChapter,
    deleteChapter,
    onAddChapterConfirm,
    saveProject,
  }
}
