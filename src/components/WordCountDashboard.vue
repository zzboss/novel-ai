<template>
  <el-dialog 
    v-model="visible" 
    title="字数统计"
    width="600px"
    :append-to-body="true"
  >
    <!-- 总字数 -->
    <div class="text-center mb-6">
      <div class="text-4xl font-bold text-[var(--el-color-primary)]">{{ totalWords }}</div>
      <div class="text-sm text-[var(--el-text-color-secondary)] mt-1">总字数</div>
    </div>

    <!-- 进度条 -->
    <div class="mb-6">
      <div class="flex justify-between text-sm mb-1">
        <span>写作进度</span>
        <span>{{ progress }}%</span>
      </div>
      <el-progress 
        :percentage="progress" 
        :stroke-width="8"
        :color="progress >= 100 ? '#67C23A' : undefined"
      />
      <div class="text-xs text-[var(--el-text-color-secondary)] mt-1">
        目标：{{ targetWords }} 字
      </div>
    </div>

    <!-- 章节字数分布 -->
    <div class="mb-6">
      <div class="text-sm font-medium mb-2">章节字数分布</div>
      <div class="max-h-48 overflow-y-auto">
        <div 
          v-for="chapter in chapters" 
          :key="chapter.id"
          class="flex items-center gap-2 mb-2"
        >
          <span class="text-xs w-20 truncate">{{ chapter.title || '未命名' }}</span>
          <el-progress 
            :percentage="getChapterProgress(chapter)" 
            :stroke-width="6"
            class="flex-1"
          />
          <span class="text-xs w-16 text-right">{{ chapter.wordCount || 0 }} 字</span>
        </div>
      </div>
    </div>

    <!-- 统计信息 -->
    <div class="grid grid-cols-2 gap-4">
      <div class="p-3 bg-[var(--el-fill-color-light)] rounded">
        <div class="text-sm text-[var(--el-text-color-secondary)]">章节数</div>
        <div class="text-xl font-bold mt-1">{{ chapters.length }}</div>
      </div>
      <div class="p-3 bg-[var(--el-fill-color-light)] rounded">
        <div class="text-sm text-[var(--el-text-color-secondary)]">平均每章</div>
        <div class="text-xl font-bold mt-1">{{ averageWords }} 字</div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useProjectStore } from '@/stores/project'

const projectStore = useProjectStore()

const visible = ref(false)

/**
 * 显示统计看板
 */
function show(): void {
  visible.value = true
}

/**
 * 总字数
 */
const totalWords = computed(() => {
  const volumes = projectStore.project?.volumes || []
  const allChapters = volumes.flatMap(v => v.chapters || [])
  return allChapters.reduce((sum: number, ch: any) => sum + (ch.wordCount || 0), 0)
})

/**
 * 目标字数
 */
const targetWords = computed(() => {
  return (projectStore as any).project?.targetWords || 1000000
})

/**
 * 进度
 */
const progress = computed(() => {
  if (targetWords.value === 0) return 0
  return Math.min(100, Math.round((totalWords.value / targetWords.value) * 100))
})

/**
 * 章节列表
 */
const chapters = computed(() => {
  return (projectStore as any).project?.chapters || []
})

/**
 * 平均每章字数
 */
const averageWords = computed(() => {
  if (chapters.value.length === 0) return 0
  return Math.round(totalWords.value / chapters.value.length)
})

/**
 * 获取章节进度（相对于目标）
 */
function getChapterProgress(chapter: any): number {
  if (targetWords.value === 0) return 0
  const chapterTarget = targetWords.value / (chapters.value.length || 1)
  return Math.min(100, Math.round(((chapter.wordCount || 0) / chapterTarget) * 100))
}

defineExpose({
  show
})
</script>
