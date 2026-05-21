<template>
  <teleport to="body">
    <div
      v-if="visible"
      class="fixed z-50 bg-[var(--el-bg-color-overlay)] border border-[var(--el-border-color)] rounded shadow-lg py-1 min-w-[160px]"
      :style="{ left: x + 'px', top: y + 'px' }"
      @contextmenu.prevent
    >
      <div
        v-for="item in items"
        :key="item.id"
        class="px-3 py-1.5 text-sm cursor-pointer hover:bg-[var(--el-fill-color-light)] flex items-center gap-2"
        :class="{ 'opacity-50 cursor-not-allowed': item.disabled }"
        @click="handleClick(item)"
      >
        <el-icon v-if="item.icon" :size="16">
          <component :is="item.icon" />
        </el-icon>
        <span>{{ item.label }}</span>
        <span v-if="item.shortcut" class="ml-auto text-xs text-[var(--el-text-color-placeholder)]">
          {{ item.shortcut }}
        </span>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'

export interface ContextMenuItem {
  id: string
  label: string
  icon?: any
  shortcut?: string
  disabled?: boolean
  divider?: boolean
  children?: ContextMenuItem[]
}

const props = defineProps<{
  items: ContextMenuItem[]
}>()

const emit = defineEmits<{
  select: [item: ContextMenuItem]
}>()

const visible = ref(false)
const x = ref(0)
const y = ref(0)

/**
 * 显示右键菜单
 */
function show(event: MouseEvent): void {
  event.preventDefault()
  x.value = event.clientX
  y.value = event.clientY
  visible.value = true
  
  // 防止菜单超出窗口
  nextTick(() => {
    const menu = document.querySelector('.context-menu')
    if (menu) {
      const rect = menu.getBoundingClientRect()
      if (rect.right > window.innerWidth) {
        x.value = window.innerWidth - rect.width - 10
      }
      if (rect.bottom > window.innerHeight) {
        y.value = window.innerHeight - rect.height - 10
      }
    }
  })
}

/**
 * 隐藏右键菜单
 */
function hide(): void {
  visible.value = false
}

/**
 * 处理菜单项点击
 */
function handleClick(item: ContextMenuItem): void {
  if (item.disabled) return
  emit('select', item)
  hide()
}

// 点击其他地方时隐藏菜单
document.addEventListener('click', hide)
document.addEventListener('contextmenu', (e) => {
  // 如果不是当前菜单的触发事件，则隐藏
  if (!e.target?.closest('.context-menu-trigger')) {
    hide()
  }
})

defineExpose({
  show,
  hide
})
</script>
