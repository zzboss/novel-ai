<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    title="卷内容AI辅助生成"
    width="700px"
    :close-on-click-modal="false"
    :fullscreen="isFullscreen"
    @close="handleClose"
  >
    <!-- 全屏按钮 -->
    <template #header>
      <div class="dialog-header">
        <span class="dialog-title">{{ isModifyMode ? '卷内容AI辅助修改' : '卷内容AI辅助生成' }}</span>
        <div class="flex items-center gap-2">
          <ModelSelector
            v-model="selectedModelId"
            @change="handleModelChange"
          />
          <el-button
            text
            @click="isFullscreen = !isFullscreen"
          >
            {{ isFullscreen ? '退出全屏' : '全屏' }}
          </el-button>
        </div>
      </div>
    </template>

    <!-- 输入区域（始终显示） -->
    <div class="input-section mb-4">
      <div class="flex items-center gap-4 mb-2">
        <label class="input-label">请输入卷的描述或关键词：</label>
        <div class="flex items-center gap-2">
          <el-checkbox v-model="isModifyMode">修改模式</el-checkbox>
          <el-checkbox v-if="isModifyMode" v-model="shouldRegenerateTitle">重新生成卷名</el-checkbox>
        </div>
      </div>
      
      <!-- 修改模式：显示现有内容 -->
      <div v-if="isModifyMode" class="existing-content mb-4">
        <label class="block text-sm font-medium mb-2">现有内容：</label>
        <el-input
          :model-value="existingVolumeContent"
          type="textarea"
          :rows="6"
          readonly
          class="existing-content-editor"
        />
      </div>
      
      <el-input
        v-model="userInput"
        type="textarea"
        :autosize="{ minRows: 6, maxRows: 12 }"
        :placeholder="isModifyMode ? '请输入修改意见...' : '例如：这一卷主要讲述主角团前往魔王城的旅程，途中经历各种磨难，团队成员之间的关系发生微妙变化...'"
        @keydown.ctrl.enter="handleGenerate"
      />
      <div class="input-tips mt-2">
        <el-text type="info" size="small">
          {{ isModifyMode ? '提示：输入修改意见，AI将基于现有内容进行修改' : '提示：按 Ctrl+Enter 快速生成' }}
        </el-text>
      </div>
    </div>

    <!-- 生成按钮 -->
    <div class="action-section mb-4">
      <el-button
        type="primary"
        :loading="isGenerating"
        :disabled="isGenerating || (isModifyMode && !userInput.trim())"
        @click="handleGenerate"
      >
        {{ isGenerating ? '处理中...' : (isModifyMode ? '修改卷内容' : '生成卷内容') }}
      </el-button>
      <el-button
        v-if="generatedContent && !isGenerating"
        size="small"
        @click="handleRegenerate"
      >
        {{ isModifyMode ? '重新修改' : '重新生成' }}
      </el-button>
    </div>

    <!-- 生成中：显示流式输出 -->
    <div v-if="isGenerating" class="streaming-section mb-4">
      <el-input
        :model-value="streamingContent"
        type="textarea"
        :autosize="{ minRows: 8, maxRows: 16 }"
        readonly
        placeholder="正在生成..."
        class="streaming-editor"
      />
      <p class="generating-text mt-2">⏳ 正在生成卷内容...</p>
    </div>

    <!-- 结果区域（有结果时显示） -->
    <div v-if="generatedContent" class="result-section">
      <div class="result-header mb-2">
        <h4 class="m-0">生成结果（可编辑）：</h4>
      </div>
      
      <el-input
        v-model="generatedContent"
        type="textarea"
        :autosize="{ minRows: 8, maxRows: 16 }"
        class="result-editor"
      />
    </div>

    <!-- 提示信息 -->
    <div v-if="!generatedContent && !isGenerating" class="tips-section mt-4">
      <el-alert type="info" :closable="false">
        <template #title>
          💡 提示：
        </template>
        <ul class="tips-list">
          <li>描述越详细，生成结果越精准</li>
          <li>可以包含：卷的核心事件、角色发展、情感基调等信息</li>
          <li>也可以只输入简单关键词，AI会补充细节</li>
          <li>生成的内容可以直接应用到当前卷</li>
        </ul>
      </el-alert>
    </div>
    
    <!-- 底部按钮 -->
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleCancel">
          {{ isGenerating ? '取消' : '关闭' }}
        </el-button>
        <el-button
          v-if="generatedContent && !isGenerating"
          type="primary"
          @click="handleConfirm"
        >
          应用到当前卷
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useAgentStore } from '@/stores/agent'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import type { ModelConfig } from '@/llm/types'
import ModelSelector from './ModelSelector.vue'

const props = defineProps<{
  visible: boolean
  /** 当前卷ID */
  volumeId?: string
  /** 项目类型，用于 AI 生成时选择合适的提示词 */
  projectType?: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  success: [volumeData: any]
}>()

const agentStore = useAgentStore()
const projectStore = useProjectStore()
const settingsStore = useSettingsStore()

// 状态
const userInput = ref('')
const generatedContent = ref('')
const isGenerating = ref(false)
const isFullscreen = ref(false)
const streamingContent = ref('')  // 实时流式输出内容
const isModifyMode = ref(false)  // 是否修改模式
const shouldRegenerateTitle = ref(false)  // 是否重新生成卷名（修改模式下）
const selectedModelId = ref('')  // 选中的模型ID
const selectedModelConfig = ref<ModelConfig | null>(null)  // 选中的模型配置

// 监听模型选择变化
function handleModelChange(modelConfig: ModelConfig): void {
  selectedModelConfig.value = modelConfig
  selectedModelId.value = modelConfig.id
}

// 获取现有卷内容（用于修改模式）
const existingVolumeContent = computed(() => {
  if (!props.volumeId) return ''
  const project = projectStore.project
  if (!project) return ''
  const volume = project.volumes.find(v => v.id === props.volumeId)
  return volume?.content || ''
})

// 监听 agentStore.currentStreaming，实时更新流式输出
watch(
  () => agentStore.currentStreaming,
  (newContent) => {
    if (isGenerating.value) {
      streamingContent.value = newContent
    }
  }
)

// 生成/修改卷内容
async function handleGenerate(): Promise<void> {
  // 修改模式下需要输入修改意见
  if (isModifyMode.value && !userInput.value.trim()) {
    ElMessage.warning('请输入修改意见')
    return
  }
  
  isGenerating.value = true
  streamingContent.value = ''
  generatedContent.value = ''
  
  try {
    // 获取当前卷序号
    const project = projectStore.project
    let volumeIndex = 1
    if (props.volumeId && project?.volumes) {
      const volumeIdx = project.volumes.findIndex(v => v.id === props.volumeId)
      if (volumeIdx !== -1) {
        volumeIndex = volumeIdx + 1
      }
    }
    
    // 调用 Agent 生成/修改卷内容
    const result = await agentStore.generateVolumeByDescription(
      (props.projectType as any) || 'novel',
      userInput.value,
      volumeIndex,
      isModifyMode.value ? existingVolumeContent.value : undefined,
      undefined, // loggingConfig 可选，函数内部会自动创建默认配置
      selectedModelConfig.value || undefined // 传递选中的模型配置
    )
    
    generatedContent.value = result
    ElMessage.success(isModifyMode.value ? '卷内容修改成功！' : '卷内容生成成功！')
    
  } catch (error: any) {
    ElMessage.error((isModifyMode.value ? '修改' : '生成') + '失败：' + (error.message || '未知错误'))
    console.error('生成卷内容失败：', error)
  } finally {
    isGenerating.value = false
    streamingContent.value = ''
  }
}

// 重新生成
function handleRegenerate(): void {
  generatedContent.value = ''
  streamingContent.value = ''
}

// 确认使用生成结果
function handleConfirm(): void {
  if (!generatedContent.value) {
    ElMessage.warning('请先生成卷内容')
    return
  }
  
  // 解析生成的内容为卷数据对象
  const volumeData = parseVolumeFromGeneration(generatedContent.value)
  
  // 修改模式：根据是否勾选"重新生成卷名"来决定是否更新标题
  if (isModifyMode.value && props.volumeId && !shouldRegenerateTitle.value) {
    const project = projectStore.project
    if (project) {
      const volume = project.volumes.find((v: any) => v.id === props.volumeId)
      if (volume) {
        volumeData.title = volume.title  // 使用原有标题
      }
    }
  }
  
  // 触发成功事件
  emit('success', volumeData)
  
  // 重置状态
  handleClose()
}

// 取消
function handleCancel(): void {
  if (isGenerating.value) {
    isGenerating.value = false
  }
  handleClose()
}

// 关闭对话框
function handleClose(): void {
  emit('update:visible', false)
  userInput.value = ''
  generatedContent.value = ''
  streamingContent.value = ''
  isGenerating.value = false
  isFullscreen.value = false
  isModifyMode.value = false  // 重置修改模式
  shouldRegenerateTitle.value = false  // 重置重新生成卷名选项
}

// 解析生成的内容为卷数据对象
function parseVolumeFromGeneration(content: string): any {
  // 提取卷标题（适配 "卷标题：xxx" 或 "# 第X卷：xxx" 格式）
  let title = ''
  const titleMatch = content.match(/(?:卷标题|#\s*第\d+[卷集部分][：:]\s*)(.+)/)
  if (titleMatch) {
    title = titleMatch[1].trim()
  } else {
    // 尝试从第一行提取
    const firstLineMatch = content.match(/^#?\s*(.+)/)
    if (firstLineMatch) {
      title = firstLineMatch[1].trim().replace(/^第\d+[卷集部分][：:]\s*/, '')
    }
  }
  
  if (!title) {
    title = '新卷'
  }
  
  // 提取核心事件
  let coreEvents = ''
  const eventsMatch = content.match(/(?:核心事件|主要情节)[：:]\s*\n?([\s\S]*?)(?=\n[^\s\-：:]+\s*[：:]|---|$)/)
  if (eventsMatch) {
    coreEvents = eventsMatch[1].trim()
  }
  
  // 提取角色发展
  let characterDevelopment = ''
  const charMatch = content.match(/(?:角色发展|人物成长)[：:]\s*\n?([\s\S]*?)(?=\n[^\s\-：:]+\s*[：:]|---|$)/)
  if (charMatch) {
    characterDevelopment = charMatch[1].trim()
  }
  
  // 提取情感基调
  let emotionalTone = ''
  const toneMatch = content.match(/(?:情感基调|整体氛围)[：:]\s*\n?([\s\S]*?)(?=\n[^\s\-：:]+\s*[：:]|---|$)/)
  if (toneMatch) {
    emotionalTone = toneMatch[1].trim()
  }
  
  // 构建内容（将各部分组合）
  const fullContent = [
    coreEvents ? `核心事件：${coreEvents}` : '',
    characterDevelopment ? `角色发展：${characterDevelopment}` : '',
    emotionalTone ? `情感基调：${emotionalTone}` : ''
  ].filter(Boolean).join('\n\n')
  
  return {
    title,
    content: fullContent || content,
    coreEvents: coreEvents || undefined,
    characterDevelopment: characterDevelopment || undefined,
    emotionalTone: emotionalTone || undefined
  }
}
</script>

<style scoped>
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.dialog-title {
  font-size: 16px;
  font-weight: 600;
}

.generate-step {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.input-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-label {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.input-tips {
  display: flex;
  justify-content: flex-end;
}

.tips-list {
  margin: 0;
  padding-left: 20px;
}

.tips-list li {
  margin: 4px 0;
}

.generating-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.generating-text {
  color: var(--el-text-color-secondary);
  margin: 0;
}

.result-step {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.result-header h4 {
  margin: 0;
  font-size: 14px;
}

.result-editor {
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
