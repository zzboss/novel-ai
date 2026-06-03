import { ref, computed, watch, onBeforeUnmount, nextTick, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Editor } from '@tiptap/vue-3'
import type { Chapter } from '@/types/project'

interface UseEditorManagerOptions {
  projectStore: any
  agentStore: any
  currentChapterId: any
}

export interface UseEditorManagerReturn {
  chapterEditorRef: Ref<InstanceType<typeof import('@/components/ChapterEditor.vue')['default']> | null>
  tipTapEditor: typeof tipTapEditor
  editorContent: typeof editorContent
  editorWordCount: typeof editorWordCount
  onEditorReady: typeof onEditorReady
  onEditorUpdate: typeof onEditorUpdate
  onFocusModeSave: typeof onFocusModeSave
  loadChapterContent: typeof loadChapterContent
}

const chapterEditorRef = ref<InstanceType<typeof import('@/components/ChapterEditor.vue')['default']> | null>(null)
const tipTapEditor = ref<Editor | null>(null)
const editorContent = ref('')
const editorWordCount = ref(0)
let chapterSaveTimer: ReturnType<typeof setTimeout> | null = null

let _projectStore: any
let _agentStore: any
let _currentChapterId: any

function countWords(text: string): number {
  return text.replace(/\s/g, '').length
}

export function onEditorReady(editor: Editor): void {
  if (!editor || typeof editor !== 'object') {
    console.error('onEditorReady: editor is not a valid instance', editor)
    return
  }
  ;(window as any).__chapterEditor = editor
  tipTapEditor.value = editor
  if (_currentChapterId.value) {
    loadChapterContent(_currentChapterId.value)
  }
}

export function onEditorUpdate(html: string, _text: string, wc: number): void {
  editorContent.value = html
  editorWordCount.value = wc
  _projectStore.markDirty()

  if (chapterSaveTimer) {
    clearTimeout(chapterSaveTimer)
  }
  chapterSaveTimer = setTimeout(() => {
    saveCurrentChapterContent()
  }, 2000)
}

export function saveCurrentChapterContent(chapterId?: string): void {
  const id = chapterId || _currentChapterId.value
  if (!id || !_projectStore.project) return

  // 关键修复：editor ref 为 null 说明组件已销毁，不能保存（会覆盖为空字符串）
  if (!chapterEditorRef.value) {
    console.warn('[saveCurrentChapterContent] editor ref 为 null，跳过保存')
    return
  }

  const html = chapterEditorRef.value.getHTML()
  const text = chapterEditorRef.value.getText()
  const wc = countWords(text)

  window.electronAPI.writeChapter(_projectStore.project.path, id, html).catch((err: unknown) => {
    console.error('保存章节内容失败:', err)
  })

  _projectStore.updateChapterWordCount(id, wc)
}

export async function loadChapterContent(chapterId: string): Promise<void> {
  if (!_projectStore.project || !chapterEditorRef.value) return

  try {
    const content = await window.electronAPI.readChapter(_projectStore.project.path, chapterId)
    if (content) {
      if (content.startsWith('<')) {
        chapterEditorRef.value.setContent(content)
      } else {
        const html = content
          .split(/\n\n/)
          .map((para: string) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
          .join('')
        chapterEditorRef.value.setContent(html)
      }
      editorContent.value = chapterEditorRef.value.getHTML()
      editorWordCount.value = countWords(chapterEditorRef.value.getText())
    } else {
      chapterEditorRef.value.clearContent()
      editorContent.value = ''
      editorWordCount.value = 0
    }
  } catch (error) {
    console.error('加载章节内容失败:', error)
    chapterEditorRef.value?.clearContent()
    editorContent.value = ''
    editorWordCount.value = 0
  }
}

export async function onFocusModeSave(content: string, isAuto = false, done?: () => void): Promise<void> {
  if (!_currentChapterId.value || !_projectStore.project) {
    if (!isAuto) ElMessage.warning('没有选中的章节或项目')
    done?.()
    return
  }

  try {
    editorContent.value = content
    _projectStore.markDirty()

    // 等待数据库写入完成
    await window.electronAPI.writeChapter(_projectStore.project.path, _currentChapterId.value, content)

    // 更新字数统计
    const text = content.replace(/<[^>]*>/g, '')
    const wc = countWords(text)
    _projectStore.updateChapterWordCount(_currentChapterId.value, wc)

    // 专注模式退出后，ChapterEditorWithOutline 需要刷新内容
    // 用 nextTick 确保 activePanel 已更新、组件已显示、ref 已绑定
    nextTick(() => {
      if (chapterEditorRef.value) {
        try { chapterEditorRef.value.setContent(content) } catch (e) { console.warn('onFocusModeSave setContent 失败:', e) }
      }
    })

    // 仅手动保存时提示成功，自动保存静默完成
    if (!isAuto) {
      ElMessage.success('已保存章节内容')
    }
  } catch (err: unknown) {
    console.error('专注模式保存章节内容失败:', err)
    ElMessage.error(`保存失败: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    // 无论成功失败，都调用 done callback，通知 FocusMode 可以安全退出
    done?.()
  }
}

export function useEditorManager(options: UseEditorManagerOptions): UseEditorManagerReturn {
  _projectStore = options.projectStore
  _agentStore = options.agentStore
  _currentChapterId = options.currentChapterId

  // 监听管线完成，自动为默认标题的章节生成标题
  watch(() => _agentStore.pipelineRunning, async (running: boolean, prevRunning: boolean | undefined) => {
    if (!running && prevRunning !== undefined) {
      const chapterId = _currentChapterId.value
      if (!chapterId) return

      const project = _projectStore.project
      if (!project) return

      const vol = project.volumes.find((v: any) => v.chapters.some((ch: Chapter) => ch.id === chapterId))
      if (vol) {
        const ch = vol.chapters.find((c: Chapter) => c.id === chapterId)
        if (ch && /^第\d+章$/.test(ch.title)) {
          try {
            ElMessage.info('正在根据内容生成章节标题...')
            const content = chapterEditorRef.value?.getText() || ''
            if (content.length > 50) {
              const newTitle = await _agentStore.generateTitleFromContent(content)
              if (newTitle) {
                _projectStore.updateChapterTitle(chapterId, newTitle)
                ElMessage.success(`标题已更新为：${newTitle}`)
              }
            }
          } catch (err: any) {
            console.error('自动生成标题失败:', err)
          }
        }
      }
    }
  })

  onBeforeUnmount(() => {
    tipTapEditor.value = null
  })

  return {
    chapterEditorRef,
    tipTapEditor,
    editorContent,
    editorWordCount,
    onEditorReady,
    onEditorUpdate,
    onFocusModeSave,
    loadChapterContent,
  }
}
