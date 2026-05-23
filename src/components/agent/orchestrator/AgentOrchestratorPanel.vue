<template>
  <div class="orchestrator-panel">
    <!-- 面板标题栏 -->
    <div class="panel-header">
      <div class="header-left">
        <span class="header-icon">💬</span>
        <h3 class="panel-title">Agent 协作中心</h3>
        <el-tag size="small" type="primary" effect="plain">
          {{ registeredAgentTypes.length }} 个 Agent
        </el-tag>
      </div>
      <el-button text @click="$emit('close')" class="close-btn">
        ✕
      </el-button>
    </div>

    <!-- Agent 状态列表 -->
    <div class="agent-section">
      <div class="section-header">
        <h4 class="section-title">
          👤 Agent 状态
          <el-tag v-if="executingCount > 0" size="small" type="success" effect="dark" round>
            {{ executingCount }} 运行中
          </el-tag>
        </h4>
          <el-button 
            v-if="isExecuting" 
            size="small" 
            type="danger" 
            @click="handleStop"
            plain
          >
            ⏸ 停止所有
          </el-button>
      </div>

      <!-- 空状态 -->
      <el-empty v-if="registeredAgentTypes.length === 0" description="暂无已注册的 Agent" :image-size="80">
        <el-button type="primary" @click="$emit('close')">去注册 Agent</el-button>
      </el-empty>

      <!-- Agent 卡片列表 -->
      <div v-else class="agent-cards">
        <div 
          v-for="agentType in registeredAgentTypes" 
          :key="agentType"
          class="agent-card"
          :class="{ 
            'is-executing': currentExecutingAgent === agentType,
            'is-idle': currentExecutingAgent !== agentType && !isExecuting
          }"
        >
          <!-- 执行动画背景 -->
          <div v-if="currentExecutingAgent === agentType" class="executing-bg"></div>
          
          <div class="agent-avatar">
            <div class="avatar-icon">
              🤖
            </div>
            <div 
              class="status-dot" 
              :class="getStatusClass(agentType)"
            ></div>
          </div>

          <div class="agent-content">
            <div class="agent-header">
              <div class="agent-name">{{ formatAgentName(agentType) }}</div>
              <el-tag 
                :type="getStatusType(agentType)" 
                size="small" 
                effect="dark"
                round
              >
                {{ getStatusText(agentType) }}
              </el-tag>
            </div>
            
            <div class="agent-meta">
              <el-text size="small" type="info">
                ⏱️ {{ getStatusDescription(agentType) }}
              </el-text>
            </div>
          </div>

          <!-- 执行进度 -->
          <div v-if="currentExecutingAgent === agentType && showProgress" class="progress-wrapper">
            <el-progress 
              type="circle" 
              :percentage="progress" 
              :width="40"
              :stroke-width="4"
              :show-text="false"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 执行控制区 -->
    <div class="control-section">
      <div class="section-header">
        <h4 class="section-title">
          🔧 执行控制
        </h4>
      </div>

      <!-- 流水线选择器 -->
      <div class="pipeline-selector">
        <div class="selector-label">
          📊 选择执行流水线
        </div>
        <el-select 
          v-model="selectedPipelineId" 
          :disabled="isExecuting"
          class="pipeline-select"
          placeholder="请选择流水线"
          size="large"
        >
          <el-option 
            v-for="pipeline in availablePipelines" 
            :key="pipeline.id"
            :label="pipeline.name"
            :value="pipeline.id"
          >
            <div class="pipeline-option">
              <span class="pipeline-name">{{ pipeline.name }}</span>
              <span class="pipeline-desc">{{ getPipelineDescription(pipeline.id) }}</span>
            </div>
          </el-option>
        </el-select>
      </div>

      <!-- 控制按钮 -->
      <div class="control-buttons">
        <el-button 
          type="primary"
          size="large"
          :disabled="isExecuting || registeredAgentTypes.length === 0"
          @click="handleStart"
          class="start-btn"
        >
          ▶ 开始执行
        </el-button>
        <el-button 
          type="danger"
          size="large"
          :disabled="!isExecuting"
          @click="handleStop"
        >
          停止执行
        </el-button>
      </div>

      <!-- 并行执行开关 -->
      <div class="parallel-toggle">
        <el-switch
          v-model="enableParallel"
          active-text="并行执行"
          inactive-text="顺序执行"
        />
        <el-tooltip placement="top">
          <template #content>
            <div style="max-width: 200px;">
              并行执行：多个 Agent 同时工作，速度更快<br/>
              顺序执行：Agent 按顺序执行，结果更准确
            </div>
          </template>
          <span class="help-icon">❓</span>
        </el-tooltip>
      </div>
    </div>

    <!-- Agent 记忆区 -->
    <div class="memory-section">
      <div class="section-header">
        <h4 class="section-title">
          🧠 Agent 记忆
          <el-tag v-if="memoryCount > 0" size="small" type="info" effect="plain">
            {{ memoryCount }} 条
          </el-tag>
        </h4>
      </div>

      <el-empty v-if="memoryCount === 0" description="暂无 Agent 记忆" :image-size="60" />

      <div v-else class="memory-list">
        <div 
          v-for="(memories, agentType) in orchestratorStore.agentMemories" 
          :key="agentType"
          class="memory-group"
        >
          <div class="memory-agent-type">{{ formatAgentName(agentType) }}</div>
          <div 
            v-for="memory in memories.slice(-5)" 
            :key="memory.id"
            class="memory-item"
          >
            <div class="memory-content">{{ memory.content.substring(0, 100) }}...</div>
            <div class="memory-time">{{ formatTime(memory.createdAt) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 执行日志区 -->
    <div class="logs-section">
      <div class="section-header">
        <h4 class="section-title">
          📓 执行日志
          <el-tag v-if="executionLogs.length > 0" size="small" type="info" effect="plain">
            {{ executionLogs.length }} 条
          </el-tag>
        </h4>
          <el-button 
            v-if="executionLogs.length > 0"
            text 
            size="small" 
            type="danger"
            @click="handleClearLogs"
          >
            🗑️ 清除
          </el-button>
      </div>

      <el-empty v-if="executionLogs.length === 0" description="暂无执行日志" :image-size="60" />

      <div v-else class="logs-list">
        <div 
          v-for="(log, index) in executionLogs" 
          :key="index"
          class="log-item"
          :class="{ 'log-system': !log.agentType }"
        >
          <div class="log-icon">
            <span v-if="log.agentType" class="log-icon-emoji">🤖</span>
            <span v-else class="log-icon-emoji">ℹ️</span>
          </div>
          <div class="log-content">
            <div class="log-header">
              <el-text size="small" class="log-agent" v-if="log.agentType">
                {{ formatAgentName(log.agentType) }}
              </el-text>
              <el-text size="small" class="log-time">{{ formatTime(log.timestamp) }}</el-text>
            </div>
            <div class="log-body">
              <el-tag 
                v-if="log.action" 
                :type="getActionType(log.action)" 
                size="small" 
                effect="plain"
                class="log-action-tag"
              >
                {{ log.action }}
              </el-tag>
              <span class="log-detail">{{ log.detail }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
// Element Plus 图标已移除，使用文本按钮
import { useAgentOrchestratorStore } from '@/stores/agent/orchestrator'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import { useSkillStore } from '@/stores/skill'
import { getAllPipelines, getPipelineById } from '@/agents/orchestrator/pipelines'
import type { AgentPipeline } from '@/agents/orchestrator/types'
import type { AgentInput, AgentContext } from '@/agents/types'
import type { SkillManifest } from '@/skills/types'
import type { AgentMemoryRecord } from '@/agents/orchestrator/types'
import { BaseAgent } from '@/agents/base'

// 静态导入所有 Agent 类（更可靠）
import { ChapterAgent } from '@/agents/ChapterAgent'
import { CharacterAgent } from '@/agents/CharacterAgent'
import { OutlineAgent } from '@/agents/OutlineAgent'
import { IdeaAgent } from '@/agents/IdeaAgent'
import { WorldAgent } from '@/agents/WorldAgent'

// 定义事件
defineEmits<{
  (e: 'close'): void
}>()

// 使用 Store
const orchestratorStore = useAgentOrchestratorStore()
const projectStore = useProjectStore()
const settingsStore = useSettingsStore()
const skillStore = useSkillStore()

// 本地状态
const enableParallel = ref(true)
const selectedPipelineId = ref<string>('outline-to-chapter')
const isExecutingLocal = ref(false)
const progress = ref(0)
const showProgress = ref(true)

// 进度跟踪
const currentPipelineSteps = ref(0)
const initialRecordCount = ref(0)

// 监听执行记录变化，更新进度
watch(
  () => orchestratorStore.executionRecords,
  (newRecords) => {
    if (!orchestratorStore.isExecuting && !isExecutingLocal.value) {
      return
    }
    
    if (currentPipelineSteps.value === 0) {
      return
    }
    
    // 计算新增的已完成记录数
    const newRecordsCount = newRecords.length - initialRecordCount.value
    if (newRecordsCount <= 0) {
      return
    }
    
    // 计算进度（基于已完成的步骤数）
    const completedCount = Math.min(newRecordsCount, currentPipelineSteps.value)
    const newProgress = Math.round((completedCount / currentPipelineSteps.value) * 100)
    
    // 更新进度（不超过 100）
    if (newProgress > progress.value) {
      progress.value = Math.min(100, newProgress)
    }
  },
  { deep: true }
)

// 初始化：确保设置已加载
onMounted(async () => {
  if (!settingsStore.isReady) {
    console.log('[AgentOrchestratorPanel] 初始化设置...')
    await settingsStore.initialize()
    console.log('[AgentOrchestratorPanel] 设置初始化完成:', {
      models: settingsStore.settings.models.length,
      activeModelId: settingsStore.settings.activeModelId
    })
  }
})

// 获取所有预定义的流水线
const availablePipelines = computed(() => {
  return getAllPipelines()
})

// 计算属性
const registeredAgentTypes = computed(() => {
  return orchestratorStore.registeredAgentTypes
})

const isExecuting = computed(() => {
  return orchestratorStore.isExecuting || isExecutingLocal.value
})

const currentExecutingAgent = computed(() => {
  return orchestratorStore.currentExecutingAgent
})

const executionLogs = computed(() => {
  return orchestratorStore.executionLogs
})

const executingCount = computed(() => {
  return currentExecutingAgent.value ? 1 : 0
})

// 记忆数量
const memoryCount = computed(() => {
  const memories = orchestratorStore.agentMemories
  return Object.values(memories).reduce((sum: number, arr: AgentMemoryRecord[]) => sum + arr.length, 0)
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

function getStatusClass(agentType: string): string {
  if (currentExecutingAgent.value === agentType) {
    return 'status-running'
  }
  return 'status-idle'
}

function getStatusType(agentType: string): 'primary' | 'success' | 'info' | 'warning' | 'danger' | undefined {
  if (currentExecutingAgent.value === agentType) {
    return 'primary'
  }
  return 'success'
}

function getStatusText(agentType: string): string {
  if (currentExecutingAgent.value === agentType) {
    return '运行中'
  }
  return '空闲'
}

function getStatusDescription(agentType: string): string {
  if (currentExecutingAgent.value === agentType) {
    return '正在执行任务...'
  }
  return '等待任务分配'
}

function getPipelineDescription(pipelineId: string): string {
  const descMap: Record<string, string> = {
    'outline-to-chapter': '大纲驱动章节生成：先生成大纲，再根据大纲生成章节内容',
    'chapter-to-consistency': '章节生成后自动进行一致性检查，确保内容连贯',
    'chapter-to-anti-ai': '章节生成后自动降 AI 味，让内容更自然',
    'full-quality-check': '完整质量检查：一致性、AI 味、情感曲线、节奏等多维度检查'
  }
  return descMap[pipelineId] || '自定义执行流程'
}

function getActionType(action: string): 'primary' | 'success' | 'info' | 'warning' | 'danger' | undefined {
  const typeMap: Record<string, 'primary' | 'success' | 'info' | 'warning' | 'danger'> = {
    'start': 'primary',
    'complete': 'success',
    'error': 'danger',
    'warning': 'warning',
    'info': 'info',
    'stop': 'danger',
    'register': 'info',
    'unregister': 'info',
    'clearRecords': 'info',
    'clearLogs': 'info',
    'clearMemories': 'info',
    'setMemoryManager': 'info',
    'setEmbeddingClient': 'info',
    'setCurrentProject': 'info',
    'destroy': 'warning'
  }
  return typeMap[action] || 'info'
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  })
}

async function handleStart(): Promise<void> {
  if (isExecuting.value) {
    console.warn('已有 Agent 正在执行')
    return
  }
  
  // 获取选中的流水线
  const pipeline = getPipelineById(selectedPipelineId.value)
  if (!pipeline) {
    console.error('未找到选中的流水线:', selectedPipelineId.value)
    ElMessage.error('未找到选中的流水线')
    return
  }
  
  // 构建 AgentContext（使用实际的项目和设置数据）
  // 重要：必须先检查 project 是否存在，否则 Agent 执行时访问 project.volumes 会报错
  if (!projectStore.project) {
    ElMessage.error('当前没有打开的项目，请先创建或打开一个项目')
    return
  }
  
  // 确保设置已初始化
  if (!settingsStore.isReady) {
    ElMessage.warning('设置正在加载中，请稍后再试')
    return
  }
  
  // 调试：输出设置信息
  console.log('[AgentOrchestratorPanel] 当前设置:', {
    models: settingsStore.settings.models,
    activeModelId: settingsStore.settings.activeModelId,
    agentModelMapping: settingsStore.settings.agentModelMapping
  })
  
  // 检查是否有模型配置
  if (!settingsStore.settings.models || settingsStore.settings.models.length === 0) {
    ElMessage.error('未配置任何模型，请在设置中添加模型')
    return
  }
  
  if (!settingsStore.settings.activeModelId) {
    ElMessage.error('未设置活跃模型，请在设置中设置一个活跃模型')
    return
  }
  
  const context: AgentContext = {
    project: projectStore.project as any,
    config: settingsStore.settings as any,
    mountedSkills: (skillStore as any).mountedSkills || []
  }
  
  // 构建 AgentInput（根据选中的流水线类型）
  let input: AgentInput
  
  try {
    // 根据流水线 ID 构建不同的输入
    switch (selectedPipelineId.value) {
      case 'outline-to-chapter':
        // 大纲驱动章节生成：需要大纲提示词
        input = {
          type: 'outline' as any,
          prompt: (projectStore.project as any)?.description || '请生成小说大纲'
        }
        break
        
      case 'chapter-to-outline':
        // 章节生成 + 大纲优化：需要章节 ID 和大纲
        if (!projectStore.currentChapterId) {
          ElMessage.warning('请先选择章节')
          return
        }
        // 使用 currentChapter 获取当前章节
        const chapter1 = projectStore.currentChapter
        input = {
          type: 'chapter' as any,
          chapterId: projectStore.currentChapterId,
          outline: (chapter1 as any)?.content || (chapter1 as any)?.outline || (projectStore.project as any)?.description || ''
        }
        break
        
      case 'chapter-to-character':
        // 章节生成 + 角色优化：需要章节 ID 和内容
        if (!projectStore.currentChapterId) {
          ElMessage.warning('请先选择章节')
          return
        }
        // 使用 currentChapter 获取当前章节
        const chapter2 = projectStore.currentChapter
        input = {
          type: 'chapter' as any,
          chapterId: projectStore.currentChapterId,
          outline: (chapter2 as any)?.content || (chapter2 as any)?.outline || ''
        }
        break
        
      case 'idea-to-world-to-outline':
        // 灵感 -> 世界观 -> 大纲：需要灵感提示词
        input = {
          type: 'idea' as any,
          prompt: '请生成小说灵感'
        }
        break
        
      default:
        // 默认输入
        input = {
          type: 'outline' as any,
          prompt: '测试输入'
        }
    }
  } catch (error) {
    console.error('构建输入失败:', error)
    ElMessage.error('构建输入失败')
    return
  }
  
  try {
    isExecutingLocal.value = true
    progress.value = 0
    showProgress.value = true
    
    // 记录开始前的状态（用于计算进度）
    initialRecordCount.value = orchestratorStore.executionRecords.length
    currentPipelineSteps.value = pipeline.steps.length
    
    console.log('开始执行流水线:', pipeline.name)
    ElMessage.success(`开始执行: ${pipeline.name}`)
    
    // 调用 Store 的执行方法（真实执行，不再模拟进度）
    const results = await orchestratorStore.executePipeline(pipeline, context, input)
    
    // 进度会在 watch 中自动更新为 100%
    
    console.log('流水线执行完成，结果:', results)
    ElMessage.success('流水线执行完成')
  } catch (error) {
    console.error('流水线执行失败:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    ElMessage.error(`流水线执行失败: ${errorMessage}`)
  } finally {
    isExecutingLocal.value = false
    // 延迟重置进度，让用户看到 100%
    setTimeout(() => {
      progress.value = 0
    }, 2000)
  }
}

function handleStop(): void {
  try {
    // 调用 Store 的停止方法
    orchestratorStore.stopExecution()
    
    // 重置本地状态
    isExecutingLocal.value = false
    progress.value = 0
    
    ElMessage.info('已停止执行')
    
    console.log('已停止执行')
  } catch (error) {
    console.error('停止执行失败:', error)
    ElMessage.error('停止执行失败')
  }
}

function handleClearLogs(): void {
  orchestratorStore.clearExecutionLogs()
  ElMessage.success('日志已清除')
}

// 生命周期
onMounted(() => {
  console.log('[AgentOrchestratorPanel] mounted, registered agents:', orchestratorStore.registeredAgentTypes)
  
  // 自动注册所有可用的 Agent
  if (!orchestratorStore.hasRegisteredAgents) {
    console.log('[AgentOrchestratorPanel] Registering all agents...')
    registerAllAgents()
  } else {
    console.log('[AgentOrchestratorPanel] Agents already registered, skipping registration')
  }
})

// 监听已注册 Agent 类型的变化
watch(
  () => orchestratorStore.registeredAgentTypes,
  (newTypes) => {
    console.log('[AgentOrchestratorPanel] 已注册 Agent 类型变化:', newTypes)
  },
  { immediate: true }
)

/**
 * 注册所有可用的 Agent
 * 
 * 功能说明：
 * - 使用静态导入的 Agent 类
 * - 创建实例并注册到 AgentOrchestrator
 * - 避免重复注册
 */
function registerAllAgents(): void {
  try {
    console.log('[AgentOrchestratorPanel] 开始注册所有 Agent')
    
    // 使用静态导入的 Agent 类
    const agentClasses = [
      { type: 'chapter' as const, AgentClass: ChapterAgent },
      { type: 'character' as const, AgentClass: CharacterAgent },
      { type: 'outline' as const, AgentClass: OutlineAgent },
      { type: 'idea' as const, AgentClass: IdeaAgent },
      { type: 'world' as const, AgentClass: WorldAgent }
    ]
    
    // 创建实例并注册
    const agents: BaseAgent[] = []
    for (const { AgentClass } of agentClasses) {
      try {
        const agent = new AgentClass()
        agents.push(agent)
        console.log(`[AgentOrchestratorPanel] 创建 Agent 实例成功: ${agent.agentType}`)
      } catch (error) {
        console.warn(`[AgentOrchestratorPanel] 创建 Agent 实例失败:`, error)
      }
    }
    
    // 批量注册
    if (agents.length > 0) {
      orchestratorStore.registerAgents(agents)
      ElMessage.success(`已注册 ${agents.length} 个 Agent`)
      console.log(`[AgentOrchestratorPanel] 成功注册 ${agents.length} 个 Agent:`, agents.map(a => a.agentType))
    } else {
      console.error('[AgentOrchestratorPanel] 没有成功创建任何 Agent 实例')
      ElMessage.error('Agent 注册失败：没有成功创建任何 Agent 实例')
    }
  } catch (error) {
    console.error('[AgentOrchestratorPanel] 注册 Agent 失败:', error)
    ElMessage.warning('部分 Agent 注册失败，功能可能受限')
  }
}
</script>

<style scoped>
.orchestrator-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: linear-gradient(to bottom, var(--el-bg-color-page), var(--el-fill-color-light));
  overflow-y: auto;
}

/* 自定义滚动条 */
.orchestrator-panel::-webkit-scrollbar {
  width: 6px;
}

.orchestrator-panel::-webkit-scrollbar-thumb {
  background-color: var(--el-border-color-darker);
  border-radius: 3px;
}

.orchestrator-panel::-webkit-scrollbar-track {
  background-color: transparent;
}

/* 面板标题栏 */
.panel-header {
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

.panel-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin: 0;
  letter-spacing: -0.5px;
}

.close-btn {
  border-radius: 8px;
  transition: all 0.3s;
}

.close-btn:hover {
  background-color: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

/* 区块样式 */
.agent-section,
.control-section,
.logs-section {
  padding: 24px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title .el-icon {
  color: var(--el-color-primary);
}

/* Agent 卡片 */
.agent-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.agent-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--el-bg-color);
  border: 2px solid var(--el-border-color-lighter);
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.agent-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.agent-card.is-executing {
  border-color: var(--el-color-primary);
  background: linear-gradient(to right, var(--el-color-primary-light-9), var(--el-bg-color));
  box-shadow: 0 4px 16px rgba(var(--el-color-primary-rgb), 0.2);
}

.executing-bg {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, var(--el-color-primary-light-8) 0%, transparent 70%);
  animation: pulse-bg 3s ease-in-out infinite;
  pointer-events: none;
}

@keyframes pulse-bg {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.1); }
}

/* Agent 头像 */
.agent-avatar {
  position: relative;
  flex-shrink: 0;
}

.avatar-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--el-color-primary-light-8), var(--el-color-primary-light-9));
  border-radius: 12px;
  color: var(--el-color-primary);
  transition: all 0.3s;
}

.agent-card.is-executing .avatar-icon {
  background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-light-3));
  color: #fff;
  box-shadow: 0 4px 12px rgba(var(--el-color-primary-rgb), 0.4);
}

.status-dot {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 3px solid var(--el-bg-color);
}

.status-dot.status-running {
  background: var(--el-color-primary);
  animation: pulse-dot 1.5s ease-in-out infinite;
  box-shadow: 0 0 8px var(--el-color-primary);
}

.status-dot.status-idle {
  background: var(--el-color-success);
}

@keyframes pulse-dot {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.7; }
}

/* Agent 内容 */
.agent-content {
  flex: 1;
  min-width: 0;
}

.agent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.agent-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.agent-meta {
  display: flex;
  align-items: center;
  gap: 4px;
}

.agent-meta .el-icon {
  font-size: 12px;
}

/* 进度环 */
.progress-wrapper {
  flex-shrink: 0;
}

/* 控制区域 */
.pipeline-selector {
  margin-bottom: 16px;
}

.selector-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.pipeline-select {
  width: 100%;
}

.pipeline-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pipeline-name {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.pipeline-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.control-buttons {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.control-buttons .el-button {
  flex: 1;
  height: 44px;
  font-size: 15px;
  font-weight: 600;
  border-radius: 10px;
}

.start-btn {
  box-shadow: 0 4px 12px rgba(var(--el-color-primary-rgb), 0.3);
}

.parallel-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--el-fill-color-light);
  border-radius: 10px;
}

.help-icon {
  color: var(--el-text-color-placeholder);
  cursor: pointer;
  transition: color 0.3s;
}

.help-icon:hover {
  color: var(--el-color-primary);
}

/* 日志区域 */
.logs-section {
  flex: 1;
  overflow-y: auto;
}

.logs-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.log-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  transition: all 0.3s;
}

.log-item:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.log-item.log-system {
  background: var(--el-fill-color-light);
}

.log-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-color-primary-light-9);
  border-radius: 6px;
  color: var(--el-color-primary);
  flex-shrink: 0;
}

.log-system .log-icon {
  background: var(--el-color-info-light-9);
  color: var(--el-color-info);
}

.log-content {
  flex: 1;
  min-width: 0;
}

.log-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.log-agent {
  font-weight: 600;
  color: var(--el-color-primary);
}

.log-time {
  color: var(--el-text-color-placeholder);
  margin-left: auto;
}

.log-body {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.log-action-tag {
  flex-shrink: 0;
}

.log-detail {
  font-size: 13px;
  color: var(--el-text-color-regular);
  word-break: break-all;
}

/* Agent 记忆区域 */
.memory-section {
  padding: 24px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.memory-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.memory-group {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 12px;
  background: var(--el-fill-color-light);
}

.memory-agent-type {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.memory-item {
  padding: 8px 12px;
  background: var(--el-bg-color);
  border-radius: 8px;
  margin-bottom: 6px;
  border: 1px solid var(--el-border-color-lighter);
}

.memory-item:last-child {
  margin-bottom: 0;
}

.memory-content {
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.5;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.memory-time {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
