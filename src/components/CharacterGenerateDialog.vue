<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    title="角色AI辅助生成"
    width="700px"
    :close-on-click-modal="false"
    :fullscreen="isFullscreen"
    @close="handleClose"
  >
    <!-- 全屏按钮 -->
    <template #header>
      <div class="dialog-header">
        <span class="dialog-title">角色AI辅助生成</span>
        <el-button
          text
          @click="isFullscreen = !isFullscreen"
        >
          {{ isFullscreen ? '退出全屏' : '全屏' }}
        </el-button>
      </div>
    </template>

    <!-- 输入区域（始终显示） -->
    <div class="input-section mb-4">
      <label class="input-label">请输入角色描述或关键词：</label>
      <el-input
        v-model="userInput"
        type="textarea"
        :autosize="{ minRows: 6, maxRows: 12 }"
        placeholder="例如：一个勇敢的年轻女剑士，性格冷酷但内心善良，拥有火系魔法能力，背景神秘..."
        @keydown.ctrl.enter="handleGenerate"
      />
      <div class="input-tips mt-2">
        <el-text type="info" size="small">
          提示：按 Ctrl+Enter 快速生成
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
        {{ isGenerating ? '生成中...' : '生成角色' }}
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
      <p class="generating-text mt-2">⏳ 正在生成角色...</p>
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
          <li>可以包含：性别、年龄、性格、背景、能力、目标等信息</li>
          <li>也可以只输入简单关键词，AI会补充细节</li>
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
import { ref, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useAgentStore } from '@/stores/agent'
import { useSettingsStore } from '@/stores/settings'
import ModelSelector from '@/components/ModelSelector.vue'
import type { ModelConfig } from '@/llm/types'
import type { WorldSettings } from '@/types/project'

const props = defineProps<{
  visible: boolean
  /** 项目类型，用于 AI 生成时选择合适的提示词 */
  projectType?: string
  /** 项目上下文（用于项目创建流程中传递项目信息） */
  projectContext?: {
    idea?: string
    worldSettings?: WorldSettings
    characters?: Array<{ id: string; name: string; role: string }>
  }
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  success: [character: any]
}>()

const agentStore = useAgentStore()
const settingsStore = useSettingsStore()

// 状态
const userInput = ref('')
const generatedContent = ref('')
const isGenerating = ref(false)
const isFullscreen = ref(false)
const streamingContent = ref('')  // 实时流式输出内容
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

// 监听 agentStore.currentStreaming，实时更新流式输出
watch(
  () => agentStore.currentStreaming,
  (newContent) => {
    if (isGenerating.value) {
      streamingContent.value = newContent
    }
  }
)

// 生成角色
async function handleGenerate(): Promise<void> {
  if (!userInput.value.trim()) {
    ElMessage.warning('请输入角色描述')
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
    // 调用Agent生成角色
    const result = await agentStore.generateCharacterByDescription(
      (props.projectType as any) || 'novel',
      userInput.value,
      undefined,
      selectedModelConfig.value
    )
    
    generatedContent.value = result
    ElMessage.success('角色生成成功！')
    
  } catch (error: any) {
    ElMessage.error('生成失败：' + (error.message || '未知错误'))
    console.error('生成角色失败：', error)
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
    ElMessage.warning('请先生成角色')
    return
  }
  
  // 解析生成的内容为角色对象
  const character = parseCharacterFromGeneration(generatedContent.value)
  
  // 触发成功事件
  emit('success', character)
  
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

// 解析生成的内容为角色对象（使用 JSON 解析）
function parseCharacterFromGeneration(content: string): Record<string, any> {
  try {
    // 尝试提取 JSON（AI 可能在 JSON 前后添加额外文本）
    let jsonStr = content.trim()
    
    // 如果内容被 markdown 代码块包裹，提取其中的 JSON
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim()
    }
    
    // 尝试找到 JSON 对象的边界
    const jsonStart = jsonStr.indexOf('{')
    const jsonEnd = jsonStr.lastIndexOf('}')
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1)
    }
    
    // 解析 JSON
    const parsed = JSON.parse(jsonStr)
    
    // 验证必需字段
    if (!parsed.name) {
      console.warn('[CharacterGenerateDialog] AI 返回的 JSON 缺少 name 字段')
    }
    
    // 构建角色对象
    const roleMap: Record<string, 'protagonist' | 'antagonist' | 'supporting' | 'minor'> = {
      'protagonist': 'protagonist',
      'antagonist': 'antagonist',
      'supporting': 'supporting',
      'minor': 'minor',
      '主角': 'protagonist',
      '反派': 'antagonist',
      '配角': 'supporting',
      '龙套': 'minor'
    }
    
    const genderMap: Record<string, 'male' | 'female' | 'other'> = {
      'male': 'male',
      'female': 'female',
      'other': 'other',
      '男': 'male',
      '女': 'female',
      '其他': 'other'
    }
    
    const role = roleMap[parsed.role] || 'supporting'
    const gender = genderMap[parsed.gender] || undefined
    
    // 构建综合描述
    const descriptionParts = []
    if (parsed.appearance) descriptionParts.push(`外貌：${parsed.appearance}`)
    if (parsed.personality) descriptionParts.push(`性格：${parsed.personality}`)
    if (parsed.background) descriptionParts.push(`背景：${parsed.background}`)
    if (parsed.abilities) descriptionParts.push(`能力：${parsed.abilities}`)
    if (parsed.relationships) descriptionParts.push(`与主角关系：${parsed.relationships}`)
    const description = descriptionParts.join('\n')
    
    return {
      id: `char-${Date.now()}`,
      name: parsed.name || '新角色',
      role,
      gender,
      age: typeof parsed.age === 'number' ? parsed.age : undefined,
      appearance: parsed.appearance || '',
      personality: parsed.personality || '',
      background: parsed.background || undefined,
      abilities: parsed.abilities || undefined,
      motivation: parsed.motivation || undefined,
      arc: parsed.arc || undefined,
      dialogueStyle: parsed.dialogueStyle || undefined,
      relationships: parsed.relationships || '',
      description: description || content
    }
  } catch (error) {
    console.error('[CharacterGenerateDialog] 解析角色 JSON 失败：', error)
    console.error('[CharacterGenerateDialog] 原始内容：', content)
    
    // 解析失败时，返回基本内容
    ElMessage.warning('AI 返回的格式有误，已尝试解析基本信息')
    return {
      id: `char-${Date.now()}`,
      name: '新角色',
      role: 'supporting' as const,
      description: content
    }
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
