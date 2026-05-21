<template>
  <div class="llm-interaction-panel h-full flex flex-col">
    <!-- 顶部工具栏 -->
    <div class="p-4 border-b flex items-center justify-between" style="border-color: var(--el-border-color)">
      <h3 class="text-base font-medium m-0">🤖 LLM 交互记录</h3>
      <div class="flex items-center gap-2">
        <!-- 操作类型筛选 -->
        <el-select
          v-model="selectedOperationType"
          placeholder="全部操作"
          clearable
          size="small"
          style="width: 140px"
        >
          <el-option label="全部操作" value="" />
          <el-option label="生成灵感" value="generateIdea" />
          <el-option label="修改灵感" value="modifyIdea" />
          <el-option label="生成世界观" value="generateWorld" />
          <el-option label="修改世界观" value="modifyWorld" />
          <el-option label="生成大纲" value="generateOutline" />
          <el-option label="修改大纲" value="modifyOutline" />
          <el-option label="生成角色" value="generateCharacter" />
          <el-option label="修改角色" value="modifyCharacter" />
          <el-option label="生成卷" value="generateVolume" />
          <el-option label="修改卷" value="modifyVolume" />
        </el-select>

        <!-- 删除按钮 -->
        <el-button v-if="selectedDate" size="small" type="danger" plain @click="confirmDeleteByDate">
          删除 {{ selectedDate }} 记录
        </el-button>
      </div>
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

      <!-- 右侧交互记录列表 -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <div v-if="selectedDate" class="p-4 border-b flex items-center" style="border-color: var(--el-border-color)">
          <h4 class="text-sm font-medium m-0">{{ formatDate(selectedDate) }} 的交互记录</h4>
          <el-tag size="small" class="ml-2">{{ interactions.length }} 条记录</el-tag>
        </div>

        <div v-if="selectedDate" class="flex-1 overflow-y-auto p-4 space-y-4">
          <div
            v-for="item in filteredInteractions"
            :key="item.id"
            class="border rounded-lg overflow-hidden"
            style="border-color: var(--el-border-color);"
          >
            <!-- 头部：操作类型 + 模型信息 + 状态 -->
            <div class="px-4 py-3 bg-[var(--el-fill-color-light)] flex items-center justify-between">
              <div class="flex items-center gap-2">
                <el-tag size="small" :type="getOperationTypeColor(item.operation_type)">
                  {{ getOperationTypeLabel(item.operation_type) }}
                </el-tag>
                <el-tag size="small" type="info">
                  {{ item.model_provider }} / {{ item.model_name }}
                </el-tag>
                <el-tag size="small" :type="item.status === 'success' ? 'success' : item.status === 'error' ? 'danger' : 'warning'">
                  {{ item.status === 'success' ? '成功' : item.status === 'error' ? '失败' : '已取消' }}
                </el-tag>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-xs" style="color: var(--el-text-color-placeholder)">
                  {{ formatTime(item.timestamp) }}
                </span>
                <el-button
                  size="small"
                  type="danger"
                  text
                  @click="confirmDeleteItem(item)"
                >
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </div>

            <!-- 主体：输入 Prompt + 输出 Response -->
            <div class="p-4 space-y-3">
              <!-- 输入 Prompt -->
              <div>
                <div class="text-xs font-medium mb-1" style="color: var(--el-text-color-secondary)">
                  📥 输入 Prompt
                  <el-button
                    size="small"
                    text
                    class="!p-0 !ml-1"
                    @click="copyToClipboard(item.input_prompt)"
                  >
                    <el-icon><CopyDocument /></el-icon>
                  </el-button>
                </div>
                <div
                  class="text-xs p-2 rounded bg-[var(--el-fill-color-lighter)] max-h-[200px] overflow-y-auto"
                  style="color: var(--el-text-color-regular); white-space: pre-wrap; font-family: monospace;"
                >
                  {{ item.input_prompt }}
                </div>
              </div>

              <!-- 输出 Response -->
              <div>
                <div class="text-xs font-medium mb-1" style="color: var(--el-text-color-secondary)">
                  📤 输出 Response
                  <el-button
                    size="small"
                    text
                    class="!p-0 !ml-1"
                    @click="copyToClipboard(item.output_response)"
                  >
                    <el-icon><CopyDocument /></el-icon>
                  </el-button>
                </div>
                <div
                  class="text-xs p-2 rounded bg-[var(--el-fill-color-lighter)] max-h-[300px] overflow-y-auto"
                  style="color: var(--el-text-color-regular); white-space: pre-wrap;"
                >
                  {{ item.output_response }}
                </div>
              </div>

              <!-- 元数据 -->
              <div v-if="hasMetadata(item)" class="pt-2 border-t" style="border-color: var(--el-border-color-lighter)">
                <div class="text-xs font-medium mb-1" style="color: var(--el-text-color-secondary)">📊 元数据</div>
                <div class="flex flex-wrap gap-2">
                  <el-tag v-if="item.duration_ms" size="small" type="info">
                    耗时: {{ formatDuration(item.duration_ms) }}
                  </el-tag>
                  <el-tag v-if="item.tokens_input" size="small" type="info">
                    输入 Token: {{ item.tokens_input }}
                  </el-tag>
                  <el-tag v-if="item.tokens_output" size="small" type="info">
                    输出 Token: {{ item.tokens_output }}
                  </el-tag>
                  <el-tag v-if="item.prompt_template_name" size="small" type="warning">
                    模板: {{ item.prompt_template_name }}
                  </el-tag>
                </div>

                <!-- 错误信息 -->
                <div v-if="item.error_message" class="mt-2 text-xs text-red-500">
                  ❌ {{ item.error_message }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="flex-1 flex items-center justify-center">
          <el-empty description="请选择日期查看交互记录" :image-size="80" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Loading, Delete, CopyDocument } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useProjectStore } from '@/stores/project'
import {
  getLLMInteractionDistinctDatesWithCount,
  getLLMInteractionsByDate,
  deleteLLMInteractionById,
  deleteLLMInteractionsByDate
} from '@/services/llmInteractionService'

const projectStore = useProjectStore()

const loadingDates = ref(false)
const dateList = ref<Array<{ date: string; count: number }>>([])
const selectedDate = ref('')
const interactions = ref<Array<any>>([])
const selectedOperationType = ref('')

// 根据操作类型筛选
const filteredInteractions = computed(() => {
  if (!selectedOperationType.value) return interactions.value
  return interactions.value.filter(item => item.operation_type === selectedOperationType.value)
})

// 加载日期列表
async function loadDates(): Promise<void> {
  if (!projectStore.project) return

  loadingDates.value = true
  try {
    const result = await getLLMInteractionDistinctDatesWithCount(projectStore.project.path || '')
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
  await loadInteractions(date)
}

// 加载交互记录
async function loadInteractions(date: string): Promise<void> {
  if (!projectStore.project) return

  try {
    const result = await getLLMInteractionsByDate(projectStore.project.path || '', date)
    interactions.value = result || []
  } catch (error) {
    ElMessage.error('加载交互记录失败')
    console.error(error)
  }
}

// 确认删除单条记录
async function confirmDeleteItem(item: any): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '确定要删除这条交互记录吗？',
      '删除确认',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    )
    await deleteLLMInteractionById(projectStore.project?.path || '', item.id)
    ElMessage.success('删除成功')
    await loadInteractions(selectedDate.value)
    await loadDates()
  } catch {
    // 用户取消
  }
}

// 确认按日期批量删除
async function confirmDeleteByDate(): Promise<void> {
  if (!projectStore.project || !selectedDate.value) return

  try {
    await ElMessageBox.confirm(
      `确定要删除 ${selectedDate.value} 的所有交互记录吗？此操作不可撤销。`,
      '批量删除确认',
      { confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'warning' }
    )
    await deleteLLMInteractionsByDate(projectStore.project.path || '', selectedDate.value)
    ElMessage.success('记录已删除')
    selectedDate.value = ''
    interactions.value = []
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

// 格式化耗时
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

// 获取操作类型标签
function getOperationTypeLabel(type: string): string {
  const labelMap: Record<string, string> = {
    generateIdea: '生成灵感',
    modifyIdea: '修改灵感',
    generateWorld: '生成世界观',
    modifyWorld: '修改世界观',
    generateOutline: '生成大纲',
    modifyOutline: '修改大纲',
    generateCharacter: '生成角色',
    modifyCharacter: '修改角色',
    generateVolume: '生成卷',
    modifyVolume: '修改卷',
    generateChapter: '生成章节',
    polishChapter: '润色章节',
    continueChapter: '续写章节',
    dialogue: '对话'
  }
  return labelMap[type] || type
}

// 获取操作类型颜色
function getOperationTypeColor(type: string): string {
  if (type.startsWith('generate')) return 'primary'
  if (type.startsWith('modify')) return 'warning'
  return 'info'
}

// 判断是否有元数据
function hasMetadata(item: any): boolean {
  return !!(item.duration_ms || item.tokens_input || item.tokens_output || item.prompt_template_name || item.error_message)
}

// 复制到剪贴板
async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败')
  }
}

onMounted(() => {
  loadDates()
})
</script>

<style scoped>
.llm-interaction-panel {
  background: var(--el-bg-color-page);
}
</style>
