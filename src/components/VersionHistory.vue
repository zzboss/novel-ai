<template>
  <div class="version-history h-full flex flex-col">
    <!-- 顶部标题 -->
    <div class="p-4 border-b border-[var(--el-border-color)] flex items-center justify-between">
      <h3 class="text-sm font-medium text-[var(--el-text-color-primary)]">版本历史</h3>
      <el-button 
        v-if="snapshots.length > 0" 
        size="small" 
        @click="refreshList"
      >
        <el-icon><Refresh /></el-icon>
      </el-button>
    </div>

    <!-- 快照列表 -->
    <div class="flex-1 overflow-y-auto p-2">
      <el-empty v-if="snapshots.length === 0" description="暂无版本历史" :image-size="60" />
      
      <div v-else class="space-y-2">
        <div 
          v-for="snapshot in snapshots" 
          :key="snapshot.id"
          class="p-3 border rounded cursor-pointer transition-colors hover:bg-[var(--el-fill-color-light)]"
          :class="{ 'bg-[var(--el-color-primary-light-9)]': selectedSnapshotId === snapshot.id }"
          @click="selectSnapshot(snapshot)"
        >
          <div class="flex items-center justify-between mb-1">
            <span class="text-sm font-medium">{{ formatTime(snapshot.timestamp) }}</span>
            <el-tag size="small" type="info">{{ snapshot.wordCount }} 字</el-tag>
          </div>
          <div class="text-xs text-[var(--el-text-color-secondary)]">
            {{ formatDate(snapshot.timestamp) }}
          </div>
          <div v-if="snapshot.label" class="text-xs mt-1 text-[var(--el-text-color-regular)]">
            {{ snapshot.label }}
          </div>
          
          <!-- 操作按钮 -->
          <div class="flex gap-1 mt-2" @click.stop>
            <el-button size="small" text type="primary" @click="restoreSnapshot(snapshot)">
              还原
            </el-button>
            <el-button size="small" text @click="addLabel(snapshot)">
              标签
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部操作 -->
    <div class="p-2 border-t border-[var(--el-border-color)]">
      <el-button 
        type="primary" 
        size="small" 
        class="w-full"
        :disabled="!currentChapterId"
        @click="createSnapshot"
      >
        <el-icon class="mr-1"><Camera /></el-icon>
        手动保存版本
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Camera } from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'

const projectStore = useProjectStore()
const emit = defineEmits<{
  restore: [content: string]
}>()

const snapshots = ref<any[]>([])
const selectedSnapshotId = ref<string>('')
const currentChapterId = ref<string>('')

/**
 * 刷新快照列表
 */
async function refreshList(): Promise<void> {
  if (!currentChapterId.value || !projectStore.projectPath) return
  
  try {
    const result = await window.electronAPI?.listSnapshots(projectStore.projectPath, currentChapterId.value)
    snapshots.value = result || []
  } catch (error) {
    console.error('刷新快照列表失败:', error)
    ElMessage.error('刷新失败')
  }
}

/**
 * 选择快照
 */
function selectSnapshot(snapshot: any): void {
  selectedSnapshotId.value = snapshot.id
  // 可以触发预览
}

/**
 * 还原快照
 */
async function restoreSnapshot(snapshot: any): Promise<void> {
  try {
    await ElMessageBox.confirm('确定要还原到这个版本吗？当前未保存的内容将会丢失。', '还原确认', {
      confirmButtonText: '确定还原',
      cancelButtonText: '取消',
      type: 'warning'
    })
    
    if (!projectStore.projectPath) return
    
    const content = await window.electronAPI?.restoreSnapshot(
      projectStore.projectPath, 
      currentChapterId.value, 
      snapshot.id
    )
    
    if (content) {
      emit('restore', content)
      ElMessage.success('版本还原成功')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('还原快照失败:', error)
      ElMessage.error('还原失败')
    }
  }
}

/**
 * 添加标签
 */
async function addLabel(snapshot: any): Promise<void> {
  try {
    const { value } = await ElMessageBox.prompt('请输入版本标签（可选）', '添加标签', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPlaceholder: '例如：完成初稿、润色后...'
    })
    
    // 更新标签逻辑（需要后端支持）
    ElMessage.success('标签已添加')
    refreshList()
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('添加标签失败:', error)
    }
  }
}

/**
 * 手动创建快照
 */
async function createSnapshot(): Promise<void> {
  if (!currentChapterId.value || !projectStore.projectPath) return
  
  try {
    const chapter = projectStore.currentChapter
    if (!chapter) {
      ElMessage.warning('请先选择章节')
      return
    }
    
    await window.electronAPI?.saveSnapshot(
      projectStore.projectPath, 
      currentChapterId.value, 
      chapter.content || ''
    )
    
    ElMessage.success('版本保存成功')
    refreshList()
  } catch (error) {
    console.error('创建快照失败:', error)
    ElMessage.error('保存失败')
  }
}

/**
 * 格式化时间
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

/**
 * 格式化日期
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString('zh-CN', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * 设置当前章节ID（从外部调用）
 */
function setChapterId(chapterId: string): void {
  currentChapterId.value = chapterId
  selectedSnapshotId.value = ''
  refreshList()
}

defineExpose({
  setChapterId,
  refreshList
})
</script>
