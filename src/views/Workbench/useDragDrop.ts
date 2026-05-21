import type { Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Editor } from '@tiptap/vue-3'

interface UseDragDropOptions {
  projectStore: any
  tipTapEditor: Ref<Editor | null>
}

export interface UseDragDropReturn {
  onDragStart: typeof onDragStart
  onDragEnd: typeof onDragEnd
  onDragOver: typeof onDragOver
  onDrop: typeof onDrop
}

function onDragStart(node: any, event: DragEvent): void {
  if (event.dataTransfer && node.data) {
    event.dataTransfer.setData('application/json', JSON.stringify(node.data))
    event.dataTransfer.effectAllowed = 'copy'
  }
}

function onDragEnd(_draggingNode: any, _dropNode: any, _dropType: any, _event: DragEvent): void {
  // 拖拽结束处理
}

function onDragOver(event: DragEvent): void {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

function onDrop(event: DragEvent): void {
  event.preventDefault()
  if (!event.dataTransfer) return
  
  const dataStr = event.dataTransfer.getData('application/json')
  if (!dataStr) return
  
  try {
    const data = JSON.parse(dataStr)
    let insertText = ''
    
    if (data.type === 'character') {
      const character = options.projectStore.project?.characters?.find((c: any) => c.id === data.id)
      if (character) {
        insertText = `【角色：${character.name}】\n${character.description || ''}`
      }
    } else if (data.type === 'world') {
      const worldSummary = options.projectStore.project?.worldSummary || ''
      insertText = `【世界观】\n${worldSummary}`
    }

    const tipTapEditor = options.tipTapEditor?.value
    if (insertText && tipTapEditor) {
      tipTapEditor.commands.focus()
      tipTapEditor.commands.insertContent(insertText)
      ElMessage.success('已注入上下文')
    }
  } catch (error) {
    console.error('拖放处理失败:', error)
  }
}

let options: UseDragDropOptions

export function useDragDrop(opts: UseDragDropOptions): UseDragDropReturn {
  options = opts
  
  return {
    onDragStart,
    onDragEnd,
    onDragOver,
    onDrop,
  }
}
