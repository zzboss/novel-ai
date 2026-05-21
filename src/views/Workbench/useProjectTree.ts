import { ref, computed, type Ref, type ComputedRef } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { Volume, Chapter } from '@/types/project'

interface UseProjectTreeOptions {
  projectStore: any
  editorContent: Ref<string>
}

export interface UseProjectTreeReturn {
  treeData: ComputedRef<any[]>
  treeProps: { children: string; label: string }
  selectedNodeType: Ref<string>
  selectedNodeId: Ref<string>
  editingChapterId: Ref<string>
  editingTitle: Ref<string>
  editInputRefs: Ref<Record<string, any>>
  focusModeVisible: Ref<boolean>
  globalSearchVisible: Ref<boolean>
  setEditInputRef: typeof setEditInputRef
  startTitleEdit: typeof startTitleEdit
  confirmTitleEdit: typeof confirmTitleEdit
  handleNodeClick: typeof handleNodeClick
  onNodeContextMenu: typeof onNodeContextMenu
  openCreationWizard: typeof openCreationWizard
  goHome: typeof goHome
  goToChatHistory: typeof goToChatHistory
  toggleFocusMode: typeof toggleFocusMode
  toggleSearch: typeof toggleSearch
}

const editingChapterId = ref('')
const editingTitle = ref('')
const editInputRefs = ref<Record<string, any>>({})
const focusModeVisible = ref(false)
const globalSearchVisible = ref(false)
const selectedNodeType = ref('')  // 当前选中的节点类型：idea/world/character/volume/chapter/chat-history/current-state
const selectedNodeId = ref('')    // 当前选中的节点 ID

let _projectStore: any
let _editorContent: Ref<string>
let _router: any

function setEditInputRef(chapterId: string, el: any): void {
  if (el) {
    editInputRefs.value[chapterId] = el
    setTimeout(() => el.focus(), 50)
  }
}

function startTitleEdit(data: any): void {
  editingChapterId.value = data.id
  editingTitle.value = data.label
}

function confirmTitleEdit(chapterId: string): void {
  const newTitle = editingTitle.value.trim()
  if (newTitle && newTitle !== '') {
    _projectStore.updateChapterTitle(chapterId, newTitle)
    ElMessage.success('标题已更新')
  }
  editingChapterId.value = ''
  editingTitle.value = ''
}

function handleNodeClick(data: any): void {
  // 忽略父节点（outline-root 只是容器，没有具体内容）
  if (data.type === 'outline-root') {
    return
  }

  // 点击"角色"根节点，显示角色列表
  if (data.type === 'characters-root') {
    selectedNodeType.value = 'characters'
    selectedNodeId.value = ''
    return
  }

  // 重置选中状态
  selectedNodeType.value = data.type || ''
  selectedNodeId.value = data.id || ''

  // 根据节点类型处理
  if (data.type === 'chapter') {
    // 找到章节所属卷，设置为选中卷
    const proj = _projectStore.project
    if (proj) {
      for (const vol of proj.volumes) {
        if (vol.chapters.some((ch: any) => ch.id === data.id)) {
          _projectStore.setSelectedVolume(vol.id)
          break
        }
      }
    }
    // 触发自定义事件，让父组件加载章节内容
    window.dispatchEvent(new CustomEvent('chapter-select', { detail: { chapterId: data.id } }))
  }

  if (data.type === 'volume' && data.id) {
    _projectStore.setSelectedVolume(data.id)
    // 设置选中类型为 volume，让父组件渲染卷编辑面板
    selectedNodeType.value = 'volume'
    selectedNodeId.value = data.id
  }

  // 其他节点类型（idea/world/character/chapter/chat-history/current-state）已在 selectedNodeType 中记录
  // 父组件会根据 selectedNodeType 渲染对应的右侧面板
}

function onNodeContextMenu(
  evt: Event,
  _data: any,
  _node: any,
  _nodeInstance: any
): void {
  evt.preventDefault()
}

function openCreationWizard(): void {
  if (!_projectStore.project) {
    ElMessage.warning('请先打开项目')
    return
  }
  _projectStore.startEditSession(_projectStore.project)
  _router.push('/creation-wizard')
  ElMessage.success('已进入编辑模式，可以完善项目设定')
}

function goHome(): void {
  _router.push('/home')
}

function goToChatHistory(): void {
  _router.push('/chat-history')
}

function toggleFocusMode(): void {
  focusModeVisible.value = true
}

function toggleSearch(): void {
  globalSearchVisible.value = true
}

export function useProjectTree(options: UseProjectTreeOptions): UseProjectTreeReturn {
  _projectStore = options.projectStore
  _editorContent = options.editorContent
  _router = useRouter()

  const volumes = computed(() => _projectStore.project?.volumes || [])
  const characters = computed(() => _projectStore.project?.characters || [])

  const treeData = computed(() => {
    const project = _projectStore.project
    if (!project) return []

    const ideaNode = {
      id: 'idea',
      label: '💡 灵感',
      type: 'idea',
      children: []
    }

    const worldNode = {
      id: 'world',
      label: '🌍 世界观',
      type: 'world',
      children: []
    }

    const charactersNode = {
      id: 'characters',
      label: '👤 角色',
      type: 'characters-root',
      children: characters.value.map((char: any) => ({
        id: char.id,
        label: char.name,
        type: 'character',
        role: char.role
      }))
    }

    const outlineNode = {
      id: 'outline',
      label: '📖 大纲与章节',
      type: 'outline-root',
      children: volumes.value.map((vol: Volume, volIndex: number) => ({
        id: vol.id,
        label: `第${volIndex + 1}卷：${vol.title}`,
        type: 'volume',
        children: vol.chapters.map((ch: Chapter, chIndex: number) => ({
          label: `第${ch.chapterNumber || chIndex + 1}章：${ch.title}`,
          type: 'chapter',
          id: ch.id,
          status: ch.status
        }))
      }))
    }

    const chatHistoryNode = {
      id: 'chat-history',
      label: '💬 模型记录',
      type: 'chat-history',
      children: []
    }

    // LLM 交互记录节点（独立功能，记录完整的大模型交互过程）
    const llmInteractionNode = {
      id: 'llm-interaction',
      label: '🤖 LLM 交互记录',
      type: 'llm-interaction',
      children: []
    }

    const currentStateNode = {
      id: 'current-state',
      label: '📊 当前状态',
      type: 'current-state',
      children: []
    }

    return [ideaNode, worldNode, charactersNode, outlineNode, chatHistoryNode, llmInteractionNode, currentStateNode]
  })

  const treeProps = {
    children: 'children',
    label: 'label'
  }

  return {
    treeData,
    treeProps,
    selectedNodeType,
    selectedNodeId,
    editingChapterId,
    editingTitle,
    editInputRefs,
    focusModeVisible,
    globalSearchVisible,
    setEditInputRef,
    startTitleEdit,
    confirmTitleEdit,
    handleNodeClick,
    onNodeContextMenu,
    openCreationWizard,
    goHome,
    goToChatHistory,
    toggleFocusMode,
    toggleSearch,
  }
}
