<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    :title="isModifyMode ? 'AI 修改世界观' : 'AI 生成世界观'"
    width="700px"
    :close-on-click-modal="false"
    :fullscreen="isFullscreen"
    @close="handleClose"
  >
    <!-- 全屏按钮 -->
    <template #header>
      <div class="dialog-header">
        <span class="dialog-title">{{ isModifyMode ? 'AI 修改世界观' : 'AI 生成世界观' }}</span>
        <el-button
          text
          @click="isFullscreen = !isFullscreen"
        >
          {{ isFullscreen ? '退出全屏' : '全屏' }}
        </el-button>
      </div>
    </template>

    <!-- 模式切换 -->
    <div class="mode-switch mb-4">
      <el-radio-group v-model="mode" size="small">
        <el-radio-button value="generate">生成</el-radio-button>
        <el-radio-button value="modify" :disabled="!hasCurrentContent">修改</el-radio-button>
      </el-radio-group>
      <el-text v-if="!hasCurrentContent && mode === 'modify'" type="warning" size="small" class="ml-2">
        当前无内容可修改
      </el-text>
    </div>

    <!-- 输入区域（始终显示） -->
    <div class="input-section mb-4">
      <label class="input-label">
        {{ isModifyMode ? '请输入修改要求：' : '请输入世界观描述或关键词：' }}
      </label>
      <el-input
        v-model="userInput"
        type="textarea"
        :autosize="{ minRows: 6, maxRows: 12 }"
        :placeholder="isModifyMode ? '例如：增加魔法系统的详细设定，添加更多地点...' : '例如：一个修炼等级分明的玄幻世界，有灵根设定...'"
        @keydown.ctrl.enter="handleGenerate"
      />
      <div class="input-tips mt-2">
        <el-text type="info" size="small">
          提示：按 Ctrl+Enter 快速{{ isModifyMode ? '修改' : '生成' }}
        </el-text>
      </div>
    </div>

    <!-- 模型选择 -->
    <div class="model-section mb-4">
      <ModelSelector v-model="selectedModelId" @change="onModelChange" />
    </div>

    <!-- 生成按钮 -->
    <div class="action-section mb-4">
      <el-button
        type="primary"
        :loading="isGenerating"
        :disabled="!userInput.trim() || !selectedModelConfig"
        @click="handleGenerate"
      >
        {{ isGenerating ? '生成中...' : (isModifyMode ? '修改世界观' : '生成世界观') }}
      </el-button>
      <el-button
        v-if="generatedContent && !isGenerating"
        size="small"
        @click="handleRegenerate"
      >
        重新生成
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
      <p class="generating-text mt-2">⏳ {{ isModifyMode ? '正在修改世界观...' : '正在生成世界观...' }}</p>
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
          <li v-if="!isModifyMode">描述越详细，生成结果越精准</li>
          <li v-if="!isModifyMode">可以包含：世界背景、规则体系、重要地点等</li>
          <li v-if="!isModifyMode">也可以只输入简单关键词，AI会补充细节</li>
          <li v-if="isModifyMode">描述你希望如何修改当前设定</li>
          <li v-if="isModifyMode">可以指定修改特定部分，或整体调整</li>
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
          使用此结果
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useAgentStore } from '@/stores/agent'
import { useProjectStore } from '@/stores/project'
import { useSettingsStore } from '@/stores/settings'
import ModelSelector from '@/components/ModelSelector.vue'
import type { ModelConfig } from '@/llm/types'

const props = defineProps<{
  visible: boolean
  /** 当前世界观内容（用于修改模式） */
  currentContent?: string
  /** 项目类型 */
  projectType?: string
  /** 灵感描述（用于生成模式） */
  idea?: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  success: [content: string]
}>()

const agentStore = useAgentStore()
const projectStore = useProjectStore()
const settingsStore = useSettingsStore()

// 状态
const mode = ref<'generate' | 'modify'>('generate')
const userInput = ref('')
const generatedContent = ref('')
const isGenerating = ref(false)
const isFullscreen = ref(false)
const streamingContent = ref('')
const selectedModelId = ref('')
const selectedModelConfig = ref<ModelConfig | null>(null)

// 初始化settings store和默认模型
onMounted(async () => {
  if (!settingsStore.isReady) {
    await settingsStore.initialize()
  }
  if (settingsStore.settings.activeModelId) {
    selectedModelId.value = settingsStore.settings.activeModelId
    selectedModelConfig.value = settingsStore.settings.models.find(m => m.id === selectedModelId.value) || null
  }
})

// 模型切换处理
function onModelChange(modelConfig: ModelConfig): void {
  selectedModelConfig.value = modelConfig
  selectedModelId.value = modelConfig.id
}

// 是否为修改模式
const isModifyMode = computed(() => mode.value === 'modify')

// 是否有当前内容可修改
const hasCurrentContent = computed(() => {
  return props.currentContent && props.currentContent.trim().length > 0
})

// 监听模式变化，清空输入
watch(mode, () => {
  userInput.value = ''
  generatedContent.value = ''
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

// 生成/修改世界观
async function handleGenerate(): Promise<void> {
  if (!userInput.value.trim()) {
    ElMessage.warning(isModifyMode.value ? '请输入修改要求' : '请输入世界观描述')
    return
  }
  
  if (!selectedModelConfig.value) {
    ElMessage.warning('请先选择AI模型')
    return
  }
  
  isGenerating.value = true
  streamingContent.value = ''
  generatedContent.value = ''
  
  try {
    let result = ''
    
    if (isModifyMode.value) {
      // 修改模式
      result = await agentStore.modifyWorld(
        props.currentContent || '',
        userInput.value,
        (props.projectType as any) || 'novel',
        selectedModelConfig.value
      )
    } else {
      // 生成模式
      const idea = props.idea || projectStore.project?.idea || ''
      result = await agentStore.generateWorld(
        idea,
        (props.projectType as any) || 'novel',
        userInput.value,
        selectedModelConfig.value
      )
    }
    
    generatedContent.value = result
    ElMessage.success(isModifyMode.value ? '世界观修改成功！' : '世界观生成成功！')
    
  } catch (error: any) {
    ElMessage.error((isModifyMode.value ? '修改' : '生成') + '失败：' + (error.message || '未知错误'))
    console.error((isModifyMode.value ? '修改' : '生成') + '世界观失败：', error)
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
    ElMessage.warning('请先生成内容')
    return
  }
  
  // 触发成功事件
  emit('success', generatedContent.value)
  
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

.mode-switch {
  display: flex;
  align-items: center;
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

.streaming-section {
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

.ml-2 {
  margin-left: 8px;
}

.mb-4 {
  margin-bottom: 16px;
}
</style>
