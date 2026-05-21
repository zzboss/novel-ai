import { ref, onMounted, onBeforeUnmount } from 'vue'

export interface UsePanelResizeReturn {
  leftPanelWidth: typeof leftPanelWidth
  rightPanelWidth: typeof rightPanelWidth
  leftPanelRef: typeof leftPanelRef
  rightPanelRef: typeof rightPanelRef
  startLeftResize: typeof startLeftResize
  startRightResize: typeof startRightResize
}

const leftPanelWidth = ref(280)
const rightPanelWidth = ref(300)
const leftPanelRef = ref<HTMLElement | null>(null)
const rightPanelRef = ref<HTMLElement | null>(null)

let isDragging = false
let dragType: 'left' | 'right' | null = null
let startX = 0
let startWidth = 0

function startLeftResize(e: MouseEvent): void {
  isDragging = true
  dragType = 'left'
  startX = e.clientX
  startWidth = leftPanelWidth.value
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function startRightResize(e: MouseEvent): void {
  isDragging = true
  dragType = 'right'
  startX = e.clientX
  startWidth = rightPanelWidth.value
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onMouseMove(e: MouseEvent): void {
  if (!isDragging || !dragType) return

  if (dragType === 'left') {
    const diff = e.clientX - startX
    const newWidth = Math.max(200, Math.min(500, startWidth + diff))
    leftPanelWidth.value = newWidth
  } else if (dragType === 'right') {
    const diff = startX - e.clientX
    const newWidth = Math.max(250, Math.min(500, startWidth + diff))
    rightPanelWidth.value = newWidth
  }
}

function onMouseUp(): void {
  isDragging = false
  dragType = null
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

export function usePanelResize(): UsePanelResizeReturn {
  onMounted(() => {
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  })

  return {
    leftPanelWidth,
    rightPanelWidth,
    leftPanelRef,
    rightPanelRef,
    startLeftResize,
    startRightResize,
  }
}
