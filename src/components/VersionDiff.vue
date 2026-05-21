<template>
  <div class="version-difff h-full flex flex-col">
    <!-- 顶部标题和版本选择 -->
    <div class="p-4 border-b border-[var(--el-border-color)]">
      <h3 class="text-sm font-medium mb-3 text-[var(--el-text-color-primary)]">版本对比</h3>
      
      <div class="flex items-center gap-2">
        <el-select 
          v-model="oldVersionId" 
          placeholder="选择旧版本"
          class="flex-1"
          size="small"
        >
          <el-option 
            v-for="s in snapshots" 
            :key="s.id"
            :label="formatTime(s.timestamp)"
            :value="s.id"
          />
        </el-select>
        
        <span class="text-[var(--el-text-color-secondary)]">vs</span>
        
        <el-select 
          v-model="newVersionId" 
          placeholder="选择新版本"
          class="flex-1"
          size="small"
        >
          <el-option 
            v-for="s in snapshots" 
            :key="s.id"
            :label="formatTime(s.timestamp)"
            :value="s.id"
          />
        </el-select>
      </div>
    </div>

    <!-- 对比内容 -->
    <div class="flex-1 overflow-hidden flex">
      <!-- 旧版本 -->
      <div class="w-1/2 border-r border-[var(--el-border-color)] overflow-y-auto">
        <div class="p-2 bg-[var(--el-fill-color-light)] text-xs text-[var(--el-text-color-secondary)]">
          旧版本：{{ oldVersionId ? formatTime(getSnapshotById(oldVersionId)?.timestamp) : '...' }}
        </div>
        <div class="p-3 text-sm whitespace-pre-wrap font-mono">
          {{ oldContent }}
        </div>
      </div>
      
      <!-- 新版本 -->
      <div class="w-1/2 overflow-y-auto">
        <div class="p-2 bg-[var(--el-color-success-light-9)] text-xs text-[var(--el-text-color-secondary)]">
          新版本：{{ newVersionId ? formatTime(getSnapshotById(newVersionId)?.timestamp) : '...' }}
        </div>
        <div class="p-3 text-sm whitespace-pre-wrap font-mono">
          {{ newContent }}
        </div>
      </div>
    </div>

    <!-- 底部统计 -->
    <div class="p-2 border-t border-[var(--el-border-color)] flex items-center justify-between text-xs text-[var(--el-text-color-secondary)]">
      <span>新增：{{ addedLines }} 行</span>
      <span>删除：{{ deletedLines }} 行</span>
      <span>修改：{{ modifiedLines }} 行</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  snapshots: any[]
}>()

const emit = defineEmits<{
  select: [oldId: string, newId: string]
}>()

const oldVersionId = ref<string>('')
const newVersionId = ref<string>('')
const oldContent = ref<string>('')
const newContent = ref<string>('')
const addedLines = ref<number>(0)
const deletedLines = ref<number>(0)
const modifiedLines = ref<number>(0)

/**
 * 根据 ID 获取快照
 */
function getSnapshotById(id: string): any {
  return props.snapshots.find(s => s.id === id)
}

/**
 * 加载快照内容
 */
async function loadSnapshotContent(snapshotId: string): Promise<string> {
  // 这里需要调用 IPC 来获取快照内容
  // 暂时返回空字符串
  return ''
}

/**
 * 计算差异统计
 */
function calculateStats(): void {
  // 简单的行数统计
  const oldLines = oldContent.value.split('\n').length
  const newLines = newContent.value.split('\n').length
  addedLines.value = Math.max(0, newLines - oldLines)
  deletedLines.value = Math.max(0, oldLines - newLines)
  modifiedLines.value = Math.min(oldLines, newLines)
}

/**
 * 格式化时间
 */
function formatTime(timestamp: number): string {
  if (!timestamp) return '...'
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', { 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit', 
    minute: '2-digit'
  })
}

// 监听版本选择变化
watch([oldVersionId, newVersionId], async () => {
  if (oldVersionId.value && newVersionId.value) {
    // 加载内容
    oldContent.value = await loadSnapshotContent(oldVersionId.value)
    newContent.value = await loadSnapshotContent(newVersionId.value)
    calculateStats()
    emit('select', oldVersionId.value, newVersionId.value)
  }
})

defineExpose({
  oldVersionId,
  newVersionId
})
</script>
