<template>
  <div class="memory-viewer">
    <!-- 标题栏 -->
    <div class="viewer-header">
      <div class="header-left">
        <el-icon class="header-icon" :size="20"><DataBoard /></el-icon>
        <h3 class="viewer-title">Agent 记忆中心</h3>
        <el-tag size="small" type="primary" effect="plain">
          {{ filteredMemories.length }} 条记忆
        </el-tag>
      </div>
      <div class="header-actions">
        <el-button 
          text 
          size="small" 
          @click="handleRefresh"
          :icon="Refresh"
          class="action-btn"
        >
          刷新
        </el-button>
        <el-button 
          text 
          size="small" 
          @click="handleClearAll"
          :icon="Delete"
          class="action-btn danger"
        >
          清除全部
        </el-button>
      </div>
    </div>

    <!-- 筛选和搜索 -->
    <div class="filter-section">
      <div class="filter-row">
        <div class="filter-item">
          <el-icon><Filter /></el-icon>
          <el-select 
            v-model="selectedAgentType" 
            placeholder="按 Agent 筛选"
            clearable
            class="filter-select"
            size="default"
          >
            <el-option 
              v-for="agentType in agentTypes" 
              :key="agentType"
              :label="formatAgentName(agentType)"
              :value="agentType"
            />
          </el-select>
        </div>
        <div class="filter-item search-item">
          <el-icon><Search /></el-icon>
          <el-input
            v-model="searchQuery"
            placeholder="搜索记忆内容..."
            clearable
            class="search-input"
            size="default"
            :prefix-icon="Search"
          />
        </div>
      </div>
    </div>

    <!-- 记忆列表 -->
    <div class="memories-list">
      <el-empty 
        v-if="filteredMemories.length === 0" 
        :description="searchQuery ? '没有找到匹配的记忆' : '暂无 Agent 记忆'" 
        :image-size="80"
      />

      <div 
        v-else
        v-for="memory in filteredMemories" 
        :key="memory.id"
        class="memory-card"
        :class="{ 'is-expanded': expandedMemoryId === memory.id }"
        @click="toggleMemory(memory.id)"
      >
        <!-- 记忆头部 -->
        <div class="memory-header">
          <div class="memory-source">
            <div class="source-avatar">
              <el-icon :size="14"><Monitor /></el-icon>
            </div>
            <span class="source-agent">{{ formatAgentName(memory.sourceAgent || '未知') }}</span>
          </div>
          <el-text size="small" type="info" class="memory-time">
            {{ formatTime(memory.createdAt) }}
          </el-text>
        </div>

        <!-- 记忆预览 -->
        <div class="memory-preview">{{ getPreview(memory.content) }}</div>
        
        <!-- 展开的详情 -->
        <div v-if="expandedMemoryId === memory.id" class="memory-detail" @click.stop>
          <el-divider content-position="left">
            <el-text size="small" type="info">
              <el-icon><Document /></el-icon>
              详细内容
            </el-text>
          </el-divider>
          
          <div class="detail-content">
            <pre class="content-text">{{ memory.content }}</pre>
          </div>

          <div v-if="memory.metadata" class="detail-metadata">
            <el-divider content-position="left">
              <el-text size="small" type="info">
                <el-icon><InfoFilled /></el-icon>
                元数据
              </el-text>
            </el-divider>
            <pre class="metadata-text">{{ JSON.stringify(memory.metadata, null, 2) }}</pre>
          </div>

          <div class="detail-actions">
            <el-button 
              type="danger"
              size="small"
              :icon="Delete"
              @click.stop="handleDelete(memory.id)"
              plain
            >
              删除此记忆
            </el-button>
          </div>
        </div>

        <!-- 展开指示器 -->
        <div class="expand-indicator">
          <el-icon :class="{ 'is-expanded': expandedMemoryId === memory.id }">
            <ArrowDown />
          </el-icon>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  DataBoard,
  Refresh, 
  Delete, 
  Filter, 
  Search, 
  Monitor, 
  Document, 
  InfoFilled, 
  ArrowDown 
} from '@element-plus/icons-vue'
import { useAgentOrchestratorStore } from '@/stores/agent/orchestrator'

// 使用 Store
const orchestratorStore = useAgentOrchestratorStore()

// 本地状态
const selectedAgentType = ref('')
const searchQuery = ref('')
const expandedMemoryId = ref('')
const memories = ref<Array<{
  id: string
  sourceAgent: string
  content: string
  metadata?: Record<string, unknown>
  createdAt: number
}>>([])

// 计算属性
const agentTypes = computed(() => {
  return orchestratorStore.registeredAgentTypes
})

const filteredMemories = computed(() => {
  let result = memories.value
  
  // 按 Agent 筛选
  if (selectedAgentType.value) {
    result = result.filter(m => m.sourceAgent === selectedAgentType.value)
  }
  
  // 按搜索词筛选
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(m => 
      m.content.toLowerCase().includes(query) ||
      (m.sourceAgent && m.sourceAgent.toLowerCase().includes(query))
    )
  }
  
  // 按时间倒序
  result = [...result].sort((a, b) => b.createdAt - a.createdAt)
  
  return result
})

// 方法
function formatAgentName(agentType: string): string {
  const nameMap: Record<string, string> = {
    'chapter': '章节生成器',
    'character': '角色生成器',
    'outline': '大纲生成器',
    'idea': '灵感生成器',
    'worldview': '世界观生成器',
    'plot': '情节生成器',
    'unknown': '未知 Agent'
  }
  return nameMap[agentType] || agentType
}

function getPreview(content: string, maxLength: number = 100): string {
  if (content.length <= maxLength) {
    return content
  }
  return content.substring(0, maxLength) + '...'
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  
  if (isToday) {
    return '今天 ' + date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit'
    })
  }
  
  return date.toLocaleString('zh-CN', { 
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit', 
    minute: '2-digit'
  })
}

function toggleMemory(id: string): void {
  if (expandedMemoryId.value === id) {
    expandedMemoryId.value = ''
  } else {
    expandedMemoryId.value = id
  }
}

async function handleRefresh(): Promise<void> {
  try {
    // 从 Store 重新加载记忆
    const storeMemories = orchestratorStore.getAgentMemories()
    memories.value = storeMemories.map(m => ({
      id: m.id,
      sourceAgent: m.sourceAgent || 'unknown',
      content: m.content,
      metadata: m.metadata as Record<string, unknown> | undefined,
      createdAt: m.createdAt
    }))
    ElMessage.success('记忆已刷新')
  } catch (error) {
    console.error('刷新记忆失败:', error)
    ElMessage.error('刷新失败')
  }
}

async function handleClearAll(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '确定要清除所有 Agent 记忆吗？此操作不可恢复。',
      '确认清除',
      {
        confirmButtonText: '确定清除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )
    
    orchestratorStore.clearAgentMemories()
    memories.value = []
    ElMessage.success('所有记忆已清除')
  } catch (error) {
    if (error !== 'cancel') {
      console.error('清除记忆失败:', error)
      ElMessage.error('清除失败')
    }
  }
}

async function handleDelete(id: string): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '确定要删除这条记忆吗？',
      '确认删除',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    // TODO: 实现删除单条记忆的功能
    console.log('删除记忆:', id)
    
    // 临时方案：从本地列表中移除
    memories.value = memories.value.filter(m => m.id !== id)
    ElMessage.success('记忆已删除')
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除记忆失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

// 生命周期
onMounted(() => {
  handleRefresh()
})
</script>

<style scoped>
.memory-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(to bottom, var(--el-bg-color-page), var(--el-fill-color-light));
  overflow-y: auto;
}

/* 自定义滚动条 */
.memory-viewer::-webkit-scrollbar {
  width: 6px;
}

.memory-viewer::-webkit-scrollbar-thumb {
  background-color: var(--el-border-color-darker);
  border-radius: 3px;
}

.memory-viewer::-webkit-scrollbar-track {
  background-color: transparent;
}

/* 标题栏 */
.viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  background: linear-gradient(135deg, var(--el-color-primary-light-9), var(--el-bg-color));
  border-bottom: 1px solid var(--el-border-color-light);
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(10px);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  color: var(--el-color-primary);
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.viewer-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin: 0;
  letter-spacing: -0.5px;
}

.header-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  border-radius: 8px;
  transition: all 0.3s;
}

.action-btn.danger:hover {
  background-color: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

/* 筛选区域 */
.filter-section {
  padding: 16px 24px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.filter-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-item .el-icon {
  color: var(--el-text-color-placeholder);
  font-size: 16px;
}

.filter-select {
  width: 180px;
}

.search-item {
  flex: 1;
}

.search-input {
  width: 100%;
}

/* 记忆列表 */
.memories-list {
  flex: 1;
  padding: 20px 24px;
  overflow-y: auto;
}

/* 记忆卡片 */
.memory-card {
  background: var(--el-bg-color);
  border: 2px solid var(--el-border-color-lighter);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.memory-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.memory-card.is-expanded {
  border-color: var(--el-color-primary);
  box-shadow: 0 4px 16px rgba(var(--el-color-primary-rgb), 0.15);
}

/* 记忆头部 */
.memory-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.memory-source {
  display: flex;
  align-items: center;
  gap: 8px;
}

.source-avatar {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-color-primary-light-9);
  border-radius: 6px;
  color: var(--el-color-primary);
}

.source-agent {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-color-primary);
}

.memory-time {
  font-size: 12px !important;
  white-space: nowrap;
}

/* 记忆预览 */
.memory-preview {
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.6;
  max-height: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

/* 展开的详情 */
.memory-detail {
  margin-top: 16px;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.detail-content,
.detail-metadata {
  margin-bottom: 16px;
}

.content-text,
.metadata-text {
  font-size: 12px;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-light);
  padding: 12px;
  border-radius: 8px;
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 8px 0 0 0;
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
  line-height: 1.6;
  border: 1px solid var(--el-border-color-lighter);
}

.detail-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}

/* 展开指示器 */
.expand-indicator {
  display: flex;
  justify-content: center;
  margin-top: 8px;
  color: var(--el-text-color-placeholder);
}

.expand-indicator .el-icon {
  transition: transform 0.3s;
}

.expand-indicator .el-icon.is-expanded {
  transform: rotate(180deg);
  color: var(--el-color-primary);
}
</style>
