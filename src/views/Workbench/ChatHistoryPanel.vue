<template>
  <div class="chat-history-panel h-full flex flex-col">
    <div class="p-4 border-b flex items-center justify-between" style="border-color: var(--el-border-color)">
      <h3 class="text-base font-medium m-0">💬 模型交互记录</h3>
      <el-button v-if="selectedDate" size="small" type="danger" plain @click="confirmDeleteByDate">
        删除 {{ selectedDate }} 记录
      </el-button>
    </div>

    <div class="flex-1 flex overflow-hidden">
      <!-- 左侧日期列表 -->
      <div class="w-[250px] border-r overflow-y-auto" style="border-color: var(--el-border-color)">
        <div v-if="loadingDates" class="text-center py-8">
          <el-icon class="is-loading"><Loading /></el-icon>
        </div>
        <div v-else-if="dateList.length > 0" class="py-2">
          <div
            v-for="item in dateList"
            :key="item.date"
            class="px-4 py-3 cursor-pointer transition-colors duration-200 hover:bg-[var(--el-fill-color-light)]"
            :class="{ 'bg-[var(--el-fill-color-light)]': selectedDate === item.date }"
            @click="selectDate(item.date)"
          >
            <div class="flex items-center justify-between">
              <span class="text-sm">{{ formatDate(item.date) }}</span>
              <el-tag size="small" type="info">{{ item.count }}</el-tag>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-12">
          <el-empty description="暂无记录" :image-size="60" />
        </div>
      </div>

      <!-- 右侧消息内容 -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <div v-if="selectedDate" class="p-4 border-b flex items-center" style="border-color: var(--el-border-color)">
          <h4 class="text-sm font-medium m-0">{{ formatDate(selectedDate) }} 的对话</h4>
          <el-tag size="small" class="ml-2">{{ messages.length }} 条消息</el-tag>
        </div>

        <div v-if="selectedDate" class="flex-1 overflow-y-auto p-4 space-y-4">
          <div v-for="msg in messages" :key="msg.id" class="p-4 rounded-lg" :class="msg.role === 'user' ? 'bg-[var(--el-color-primary-light-9)]' : 'bg-[var(--el-fill-color-light)]'">
            <div class="flex items-center gap-2 mb-2">
              <el-tag size="small" :type="msg.role === 'user' ? 'primary' : msg.role === 'assistant' ? 'success' : 'info'">
                {{ roleLabels[msg.role] || msg.role }}
              </el-tag>
              <span class="text-xs" style="color: var(--el-text-color-placeholder)">{{ formatTime(msg.timestamp) }}</span>
            </div>
            <div class="text-sm whitespace-pre-wrap" style="color: var(--el-text-color-regular)">
              {{ msg.content }}
            </div>
          </div>
        </div>

        <div v-else class="flex-1 flex items-center justify-center">
          <el-empty description="请选择日期查看对话" :image-size="80" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useProjectStore } from '@/stores/project'
import {
  getDistinctDatesWithCount,
  getMessagesByDate,
  deleteByDate
} from '@/services/chatHistoryService'

const projectStore = useProjectStore()

const loadingDates = ref(false)
const dateList = ref<Array<{ date: string; count: number }>>([])
const selectedDate = ref('')
const messages = ref<Array<any>>([])

const roleLabels: Record<string, string> = {
  user: '用户',
  assistant: '助手',
  system: '系统'
}

// 加载日期列表
async function loadDates(): Promise<void> {
  if (!projectStore.project) return

  loadingDates.value = true
  try {
    const result = await getDistinctDatesWithCount(projectStore.project.path || '')
    dateList.value = result || []
  } catch (error) {
    ElMessage.error('加载日期列表失败')
    console.error(error)
  } finally {
    loadingDates.value = false
  }
}

// 选择日期
async function selectDate(date: string): Promise<void> {
  selectedDate.value = date
  await loadMessages(date)
}

// 加载消息
async function loadMessages(date: string): Promise<void> {
  if (!projectStore.project) return

  try {
    const result = await getMessagesByDate(projectStore.project.path || '', date)
    messages.value = result || []
  } catch (error) {
    ElMessage.error('加载消息失败')
    console.error(error)
  }
}

// 确认删除
async function confirmDeleteByDate(): Promise<void> {
  if (!projectStore.project || !selectedDate.value) return

  try {
    await ElMessageBox.confirm(
      `确定要删除 ${selectedDate.value} 的所有记录吗？此操作不可撤销。`,
      '删除确认',
      { confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'warning' }
    )
    await deleteByDate(projectStore.project.path || '', selectedDate.value)
    ElMessage.success('记录已删除')
    selectedDate.value = ''
    messages.value = []
    await loadDates()
  } catch {
    // 用户取消
  }
}

// 格式化日期
function formatDate(dateStr: string): string {
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  if (dateStr === today) return '今天'
  if (dateStr === yesterday) return '昨天'
  return dateStr
}

// 格式化时间
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  loadDates()
})
</script>

<style scoped>
.chat-history-panel {
  background: var(--el-bg-color-page);
}
</style>
