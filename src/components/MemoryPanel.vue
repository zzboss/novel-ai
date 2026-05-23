<template>
  <div class="memory-panel flex-1 flex flex-col">
    <div class="p-3 border-b flex items-center justify-between" style="border-color: var(--el-border-color)">
      <span class="text-sm font-medium">记忆管理</span>
      <el-button size="small" :icon="Refresh" circle @click="loadMemories" />
    </div>

    <div class="p-3 border-b" style="border-color: var(--el-border-color)">
      <el-input
        v-model="searchQuery"
        placeholder="搜索记忆..."
        clearable
        size="small"
        @input="onSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>

      <div class="mt-2 flex gap-2">
        <el-select v-model="filterType" placeholder="记忆类型" size="small" clearable @change="loadMemories">
          <el-option label="全部" value="" />
          <el-option label="短期记忆" value="short" />
          <el-option label="中期记忆" value="medium" />
          <el-option label="长期记忆" value="long" />
          <el-option label="元记忆" value="meta" />
        </el-select>

        <el-select v-model="sortBy" placeholder="排序" size="small" @change="loadMemories">
          <el-option label="按时间" value="time" />
          <el-option label="按重要性" value="importance" />
        </el-select>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-3">
      <el-empty v-if="memories.length === 0" description="暂无记忆" :image-size="60" />

      <div v-for="memory in memories" :key="memory.id" class="memory-item p-2 mb-2 rounded border cursor-pointer hover:bg-[var(--el-fill-color-light)]" style="border-color: var(--el-border-color)" @click="viewMemory(memory)">
        <div class="flex items-center justify-between mb-1">
          <el-tag size="small" :type="getMemoryTypeTag(memory.memoryType)">
            {{ getMemoryTypeLabel(memory.memoryType) }}
          </el-tag>
          <span class="text-xs text-[var(--el-text-color-placeholder)]">
            {{ formatTime(memory.createdAt) }}
          </span>
        </div>
        <div class="text-sm line-clamp-2">{{ memory.content }}</div>
        <div class="mt-1 flex items-center gap-2">
          <el-tag size="small" type="warning">重要性: {{ memory.importance }}</el-tag>
          <el-tag v-if="memory.chapterId" size="small">{{ memory.chapterId }}</el-tag>
        </div>
      </div>
    </div>

    <!-- 记忆详情对话框 -->
    <el-dialog
      v-model="detailVisible"
      title="记忆详情"
      width="600px"
    >
      <div v-if="selectedMemory">
        <div class="mb-3">
          <strong>类型：</strong>
          <el-tag :type="getMemoryTypeTag(selectedMemory.memoryType)">
            {{ getMemoryTypeLabel(selectedMemory.memoryType) }}
          </el-tag>
        </div>
        <div class="mb-3">
          <strong>内容：</strong>
          <div class="mt-1 p-2 bg-[var(--el-fill-color-light)] rounded">
            {{ selectedMemory.content }}
          </div>
        </div>
        <div class="mb-3">
          <strong>重要性：</strong>
          <el-rate :model-value="selectedMemory.importance" disabled show-score />
        </div>
        <div class="mb-3">
          <strong>创建时间：</strong>
          {{ formatTime(selectedMemory.createdAt, true) }}
        </div>
        <div v-if="selectedMemory.metadata">
          <strong>元数据：</strong>
          <pre class="mt-1 p-2 bg-[var(--el-fill-color-light)] rounded text-xs">{{ JSON.stringify(selectedMemory.metadata, null, 2) }}</pre>
        </div>
      </div>

      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button type="danger" @click="deleteMemory(selectedMemory?.id)">删除</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Search, Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useProjectStore } from '@/stores/project'

const projectStore = useProjectStore()

const memories = ref<any[]>([])
const searchQuery = ref('')
const filterType = ref('')
const sortBy = ref('time')
const detailVisible = ref(false)
const selectedMemory = ref<any>(null)

// 加载记忆
async function loadMemories() {
  try {
    if (!projectStore.project?.id) {
      ElMessage.warning('请先打开项目')
      return
    }

    const options: any = {
      projectId: projectStore.project.id,
      maxResults: 100,
    }

    if (filterType.value) {
      options.memoryType = filterType.value
    }

    const result = await projectStore.searchMemories(options)
    memories.value = result || []

    // 排序
    if (sortBy.value === 'importance') {
      memories.value.sort((a, b) => b.importance - a.importance)
    } else {
      memories.value.sort((a, b) => b.createdAt - a.createdAt)
    }
  } catch (error) {
    console.error('[MemoryPanel] Failed to load memories:', error)
    ElMessage.error('加载记忆失败')
  }
}

// 搜索
function onSearch() {
  if (!searchQuery.value.trim()) {
    loadMemories()
    return
  }

  // 前端过滤（简单实现）
  const query = searchQuery.value.toLowerCase()
  memories.value = memories.value.filter(m => 
    m.content.toLowerCase().includes(query)
  )
}

// 查看记忆详情
function viewMemory(memory: any) {
  selectedMemory.value = memory
  detailVisible.value = true
}

// 删除记忆
async function deleteMemory(id?: string) {
  if (!id) return

  try {
    await ElMessageBox.confirm('确定要删除这条记忆吗？', '确认删除', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })

    await projectStore.deleteMemory(id)
    ElMessage.success('删除成功')
    detailVisible.value = false
    loadMemories()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('[MemoryPanel] Failed to delete memory:', error)
      ElMessage.error('删除失败')
    }
  }
}

// 获取记忆类型标签样式
function getMemoryTypeTag(type: string) {
  const map: Record<string, string> = {
    'short': '',
    'medium': 'success',
    'long': 'warning',
    'meta': 'danger',
  }
  return map[type] || ''
}

// 获取记忆类型标签文本
function getMemoryTypeLabel(type: string) {
  const map: Record<string, string> = {
    'short': '短期',
    'medium': '中期',
    'long': '长期',
    'meta': '元记忆',
  }
  return map[type] || type
}

// 格式化时间
function formatTime(timestamp: number, detailed: boolean = false) {
  const date = new Date(timestamp)
  if (detailed) {
    return date.toLocaleString('zh-CN')
  }
  return date.toLocaleDateString('zh-CN')
}

onMounted(() => {
  loadMemories()
})
</script>

<style scoped>
.memory-panel {
  background: var(--el-bg-color);
}

.memory-item {
  transition: all 0.2s;
}

.memory-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
