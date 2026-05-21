<template>
  <div class="chat-history min-h-screen flex flex-col bg-[var(--el-bg-color-page)] relative overflow-hidden">
    <!-- 背景装饰 -->
    <div class="absolute inset-0 pointer-events-none">
      <div class="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-20 blur-[120px]" style="background: linear-gradient(135deg, #7C3AED, #3B82F6);"></div>
      <div class="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full opacity-15 blur-[100px]" style="background: linear-gradient(135deg, #6D28D9, #1E293B);"></div>
    </div>

    <!-- 顶部导航 -->
    <header class="h-16 flex items-center justify-between px-8 relative z-10 border-b" style="border-color: var(--el-border-color); background: var(--el-bg-color); backdrop-filter: blur(12px);">
      <div class="flex items-center gap-3">
        <el-button text @click="goBack" class="!p-2">
          <el-icon><ArrowLeft /></el-icon>
        </el-button>
        <div class="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--el-color-primary)]">
          <span class="text-white text-sm">📝</span>
        </div>
        <span class="text-lg font-semibold tracking-tight text-[var(--el-text-color-primary)]">对话历史</span>
      </div>
      <div class="flex items-center gap-2">
        <el-button
          v-if="selectedDate"
          type="danger"
          plain
          size="default"
          @click="confirmDeleteByDate"
        >
          <el-icon class="mr-1"><Delete /></el-icon>
          删除 {{ selectedDate }} 的所有记录
        </el-button>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="flex-1 flex relative z-10 overflow-hidden">
      <!-- 左侧日期列表 -->
      <div class="w-[280px] border-r flex flex-col" style="border-color: var(--el-border-color); background: var(--el-bg-color);">
        <div class="p-4 border-b" style="border-color: var(--el-border-color);">
          <h3 class="text-sm font-semibold text-[var(--el-text-color-primary)]">日期列表</h3>
        </div>
        <div class="flex-1 overflow-y-auto">
          <!-- 加载中 -->
          <div v-if="loadingDates" class="text-center py-8">
            <el-icon class="is-loading text-xl text-[var(--el-color-primary)]"><Loading /></el-icon>
            <p class="mt-2 text-xs text-[var(--el-text-color-secondary)]">加载中...</p>
          </div>

          <!-- 日期列表 -->
          <div v-else-if="dateList.length > 0" class="py-2">
            <div
              v-for="item in dateList"
              :key="item.date"
              class="px-4 py-3 cursor-pointer transition-colors duration-200 hover:bg-[var(--el-fill-color-light)]"
              :class="{ 'bg-[var(--el-fill-color-light)]': selectedDate === item.date }"
              @click="selectDate(item.date)"
            >
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-[var(--el-text-color-primary)]">{{ item.date }}</span>
                <el-tag size="small" type="info">{{ item.count }} 条</el-tag>
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-else class="text-center py-12 px-4">
            <el-empty description="暂无对话历史" :image-size="60" />
          </div>
        </div>
      </div>

      <!-- 右侧对话内容 -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- 日期标题 -->
        <div v-if="selectedDate" class="p-4 border-b flex items-center justify-between" style="border-color: var(--el-border-color); background: var(--el-bg-color);">
          <h3 class="text-base font-semibold text-[var(--el-text-color-primary)]">{{ selectedDate }} 的对话</h3>
          <el-tag type="info">{{ messages.length }} 条消息</el-tag>
        </div>
        <div v-else class="p-4 border-b" style="border-color: var(--el-border-color); background: var(--el-bg-color);">
          <h3 class="text-base font-semibold text-[var(--el-text-color-placeholder)]">请选择日期查看对话</h3>
        </div>

        <!-- 对话内容区 -->
        <div class="flex-1 overflow-y-auto p-6">
          <!-- 加载中 -->
          <div v-if="loadingMessages" class="text-center py-12">
            <el-icon class="is-loading text-3xl text-[var(--el-color-primary)]"><Loading /></el-icon>
            <p class="mt-2 text-[var(--el-text-color-secondary)]">加载中...</p>
          </div>

          <!-- 对话列表 -->
          <div v-else-if="messages.length > 0" class="max-w-3xl mx-auto space-y-4">
            <div
              v-for="msg in messages"
              :key="msg.id"
              class="flex gap-3 group"
              :class="{ 'flex-row-reverse': msg.role === 'user' }"
            >
              <!-- 头像 -->
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs shrink-0"
                :class="msg.role === 'user' ? 'bg-[var(--el-color-primary)]' : 'bg-[var(--el-color-success)]'"
              >
                {{ msg.role === 'user' ? '我' : 'AI' }}
              </div>

              <!-- 消息内容 -->
              <div class="flex-1 max-w-[70%]">
                <div
                  class="rounded-lg p-3 text-sm relative"
                  :class="msg.role === 'user' ? 'bg-[var(--el-color-primary-light-9)] text-[var(--el-text-color-primary)]' : 'bg-[var(--el-fill-color-light)] text-[var(--el-text-color-regular)]'"
                >
                  {{ msg.content }}
                  
                  <!-- 删除按钮 -->
                  <el-button
                    class="!p-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-1 right-1"
                    text
                    size="small"
                    type="danger"
                    @click="confirmDeleteMessage(msg)"
                  >
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </div>
                <div class="text-xs text-[var(--el-text-color-placeholder)] mt-1" :class="{ 'text-right': msg.role === 'user' }">
                  {{ formatTime(msg.timestamp) }}
                </div>
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-else-if="selectedDate" class="text-center py-12">
            <el-empty description="该日期暂无对话记录" :image-size="60" />
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Delete, Loading } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useProjectStore } from '@/stores/project'
import * as chatHistoryService from '@/services/chatHistoryService'

const router = useRouter()
const projectStore = useProjectStore()

const loadingDates = ref(false)
const loadingMessages = ref(false)
const dateList = ref<Array<{ date: string; count: number }>>([])
const selectedDate = ref<string>('')
const messages = ref<Array<any>>([])

onMounted(async () => {
  await loadDates()
})

/**
 * 返回上一页
 */
function goBack(): void {
  router.back()
}

/**
 * 加载日期列表
 */
async function loadDates(): Promise<void> {
  loadingDates.value = true
  try {
    const path = projectStore.project?.path
    if (!path) {
      ElMessage.warning('请先打开项目')
      return
    }
    dateList.value = await chatHistoryService.getDistinctDatesWithCount(path)
  } catch (error) {
    console.error('加载日期列表失败:', error)
    ElMessage.error('加载日期列表失败')
  } finally {
    loadingDates.value = false
  }
}

/**
 * 选择日期
 */
async function selectDate(date: string): Promise<void> {
  selectedDate.value = date
  await loadMessages(date)
}

/**
 * 加载消息
 */
async function loadMessages(date: string): Promise<void> {
  loadingMessages.value = true
  try {
    const path = projectStore.project?.path
    if (!path) return
    messages.value = await chatHistoryService.getMessagesByDate(path, date)
  } catch (error) {
    console.error('加载消息失败:', error)
    ElMessage.error('加载消息失败')
  } finally {
    loadingMessages.value = false
  }
}

/**
 * 确认删除单条消息
 */
async function confirmDeleteMessage(msg: any): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '确定要删除这条消息吗？',
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await deleteMessage(msg.id)
  } catch (error) {
    // 用户取消删除
  }
}

/**
 * 删除单条消息
 */
async function deleteMessage(id: number): Promise<void> {
  try {
    const path = projectStore.project?.path
    if (!path) return
    await chatHistoryService.deleteMessageById(path, id)
    ElMessage.success('删除成功')
    // 重新加载当前日期的消息
    if (selectedDate.value) {
      await loadMessages(selectedDate.value)
    }
    // 重新加载日期列表（更新计数）
    await loadDates()
  } catch (error) {
    console.error('删除消息失败:', error)
    ElMessage.error('删除失败')
  }
}

/**
 * 确认按日期批量删除
 */
async function confirmDeleteByDate(): Promise<void> {
  if (!selectedDate.value) return
  try {
    await ElMessageBox.confirm(
      `确定要删除 ${selectedDate.value} 的所有对话记录吗？`,
      '批量删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    await deleteByDate(selectedDate.value)
  } catch (error) {
    // 用户取消删除
  }
}

/**
 * 按日期批量删除
 */
async function deleteByDate(date: string): Promise<void> {
  try {
    const path = projectStore.project?.path
    if (!path) return
    await chatHistoryService.deleteByDate(path, date)
    ElMessage.success('删除成功')
    selectedDate.value = ''
    messages.value = []
    // 重新加载日期列表
    await loadDates()
  } catch (error) {
    console.error('批量删除失败:', error)
    ElMessage.error('删除失败')
  }
}

/**
 * 格式化时间
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
</script>
