<template>
  <div 
    class="execution-status" 
    :class="{ 
      'is-running': status === 'running',
      'is-completed': status === 'completed',
      'is-failed': status === 'failed'
    }"
    @click="toggleExpand"
  >
    <!-- Agent 信息 -->
    <div class="agent-info">
      <div class="agent-avatar" :class="status">
        <el-icon :size="18"><Monitor /></el-icon>
      </div>
      
      <div class="agent-details">
        <div class="agent-name">{{ formatAgentName(agentType) }}</div>
        <div class="agent-status">
          <el-tag 
            :type="getStatusTagType()" 
            size="small" 
            effect="dark"
            round
          >
            <div class="status-dot-inline" :class="status"></div>
            {{ statusText }}
          </el-tag>
        </div>
      </div>

      <div class="agent-actions">
        <el-button 
          v-if="status === 'failed'"
          type="warning"
          size="small"
          @click.stop="handleRetry"
          plain
          :icon="RefreshRight"
        >
          重试
        </el-button>
        <div v-if="status === 'running'" class="spinner-wrapper">
          <el-icon class="is-loading" :size="16"><Loading /></el-icon>
        </div>
        <el-icon v-if="executionLog" class="expand-icon" :class="{ 'is-expanded': isExpanded }">
          <ArrowDown />
        </el-icon>
      </div>
    </div>

    <!-- 执行进度 -->
    <div v-if="status === 'running' && showProgress" class="progress-section">
      <el-progress 
        :percentage="progress" 
        :stroke-width="6"
        :show-text="false"
        :color="progressColor"
        class="progress-bar"
      />
      <span class="progress-text">{{ progress }}%</span>
    </div>

    <!-- 执行结果预览 -->
    <div v-if="status === 'completed' && resultPreview" class="result-preview">
      <el-icon><InfoFilled /></el-icon>
      <span>{{ resultPreview }}</span>
    </div>

    <!-- 展开详情 -->
    <div v-if="isExpanded && executionLog" class="execution-detail">
      <el-divider content-position="left">
        <el-text size="small" type="info">
          <el-icon><Document /></el-icon>
          执行日志
        </el-text>
      </el-divider>
      
      <div class="log-content-wrapper">
        <pre class="log-content">{{ executionLog }}</pre>
      </div>
      
      <div v-if="executionTime" class="execution-time">
        <el-icon><Timer /></el-icon>
        <span>执行耗时: {{ formatDuration(executionTime) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Monitor, RefreshRight, Loading, ArrowDown, InfoFilled, Document, Timer } from '@element-plus/icons-vue'

// 定义 Props
const props = withDefaults(defineProps<{
  agentType: string
  status: 'idle' | 'running' | 'completed' | 'failed'
  progress?: number
  result?: string
  executionLog?: string
  executionTime?: number
  showProgress?: boolean
}>(), {
  progress: 0,
  result: '',
  executionLog: '',
  executionTime: 0,
  showProgress: true
})

// 定义事件
const emit = defineEmits<{
  (e: 'retry', agentType: string): void
}>()

// 本地状态
const isExpanded = ref(false)

// 计算属性
const statusText = computed(() => {
  switch (props.status) {
    case 'idle': return '空闲'
    case 'running': return '执行中...'
    case 'completed': return '已完成'
    case 'failed': return '执行失败'
    default: return '未知'
  }
})

const resultPreview = computed(() => {
  if (!props.result) return ''
  const maxLength = 100
  if (props.result.length <= maxLength) {
    return props.result
  }
  return props.result.substring(0, maxLength) + '...'
})

const progressColor = computed(() => {
  if (props.progress < 30) return '#909399'
  if (props.progress < 70) return '#409EFF'
  return '#67C23A'
})

// 方法
function formatAgentName(agentType: string): string {
  const nameMap: Record<string, string> = {
    'chapter': '章节生成器',
    'character': '角色生成器',
    'outline': '大纲生成器',
    'idea': '灵感生成器',
    'worldview': '世界观生成器',
    'plot': '情节生成器'
  }
  return nameMap[agentType] || agentType
}

function getStatusTagType(): 'primary' | 'success' | 'danger' | 'info' {
  switch (props.status) {
    case 'running': return 'primary'
    case 'completed': return 'success'
    case 'failed': return 'danger'
    default: return 'info'
  }
}

function toggleExpand(): void {
  if (props.executionLog) {
    isExpanded.value = !isExpanded.value
  }
}

function handleRetry(): void {
  emit('retry', props.agentType)
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}秒`
  } else {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}分${seconds}秒`
  }
}

// 生命周期
onMounted(() => {
  console.log(`AgentExecutionStatus mounted: ${props.agentType}`)
})
</script>

<style scoped>
.execution-status {
  padding: 16px;
  background: var(--el-bg-color);
  border: 2px solid var(--el-border-color-lighter);
  border-radius: 12px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.execution-status:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.execution-status:active {
  transform: translateY(0);
}

/* 状态样式 */
.execution-status.is-running {
  border-color: var(--el-color-primary);
  background: linear-gradient(to right, var(--el-color-primary-light-9), var(--el-bg-color));
  box-shadow: 0 4px 16px rgba(var(--el-color-primary-rgb), 0.15);
}

.execution-status.is-completed {
  border-color: var(--el-color-success);
  background: linear-gradient(to right, var(--el-color-success-light-9), var(--el-bg-color));
}

.execution-status.is-failed {
  border-color: var(--el-color-danger);
  background: linear-gradient(to right, var(--el-color-danger-light-9), var(--el-bg-color));
}

/* Agent 信息 */
.agent-info {
  display: flex;
  align-items: center;
  gap: 14px;
}

.agent-avatar {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  transition: all 0.3s;
  flex-shrink: 0;
}

.agent-avatar.is-running {
  background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-light-3));
  color: #fff;
  box-shadow: 0 4px 12px rgba(var(--el-color-primary-rgb), 0.4);
  animation: pulse-avatar 2s ease-in-out infinite;
}

.agent-avatar.is-completed {
  background: linear-gradient(135deg, var(--el-color-success), var(--el-color-success-light-3));
  color: #fff;
}

.agent-avatar.is-failed {
  background: linear-gradient(135deg, var(--el-color-danger), var(--el-color-danger-light-3));
  color: #fff;
}

@keyframes pulse-avatar {
  0%, 100% { box-shadow: 0 4px 12px rgba(var(--el-color-primary-rgb), 0.4); }
  50% { box-shadow: 0 4px 20px rgba(var(--el-color-primary-rgb), 0.6); }
}

.agent-details {
  flex: 1;
  min-width: 0;
}

.agent-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 6px;
}

.agent-status {
  display: flex;
  align-items: center;
}

.status-dot-inline {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-right: 4px;
}

.status-dot-inline.is-running {
  background: #fff;
  animation: pulse-dot 1.5s ease-in-out infinite;
}

.status-dot-inline.is-completed {
  background: #fff;
}

.status-dot-inline.is-failed {
  background: #fff;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.agent-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.spinner-wrapper {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--el-color-primary);
}

.expand-icon {
  transition: transform 0.3s;
  color: var(--el-text-color-placeholder);
}

.expand-icon.is-expanded {
  transform: rotate(180deg);
}

/* 进度条 */
.progress-section {
  margin-top: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-bar {
  flex: 1;
}

.progress-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-color-primary);
  min-width: 45px;
  text-align: right;
}

/* 结果预览 */
.result-preview {
  margin-top: 12px;
  padding: 10px 14px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  display: flex;
  align-items: flex-start;
  gap: 8px;
  line-height: 1.6;
  max-height: 60px;
  overflow: hidden;
}

.result-preview .el-icon {
  color: var(--el-color-success);
  margin-top: 2px;
  flex-shrink: 0;
}

/* 执行详情 */
.execution-detail {
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

.log-content-wrapper {
  margin-top: 8px;
}

.log-content {
  font-size: 12px;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-light);
  padding: 12px;
  border-radius: 8px;
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  font-family: 'SF Mono', Monaco, 'Courier New', monospace;
  line-height: 1.6;
}

.execution-time {
  margin-top: 12px;
  padding: 8px 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-end;
}

.execution-time .el-icon {
  color: var(--el-color-info);
}
</style>
