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

const props = defineProps<{
  visible: boolean
  /** 项目类型，用于 AI 生成时选择合适的提示词 */
  projectType?: string
  /** 项目上下文（用于项目创建流程中传递项目信息） */
  projectContext?: {
    idea?: string
    worldSettings?: { summary?: string }
    characters?: any[]
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

// 解析生成的内容为角色对象（适配新格式：角色姓名：）
function parseCharacterFromGeneration(content: string): any {
  // 提取角色名称（适配 "角色姓名：xxx" 格式）
  const nameMatch = content.match(/角色姓名[：:]\s*(.+)/)
  const name = nameMatch ? nameMatch[1].trim() : '新角色'
  
  // 提取性别
  let gender: 'male' | 'female' | 'other' | undefined
  const genderMatch = content.match(/性别[：:]\s*(.+)/)
  if (genderMatch) {
    const g = genderMatch[1].trim()
    if (g === '男') gender = 'male'
    else if (g === '女') gender = 'female'
    else gender = 'other'
  }
  
  // 提取年龄
  let age: number | undefined
  const ageMatch = content.match(/年龄[：:]\s*(\d+)/)
  if (ageMatch) {
    age = parseInt(ageMatch[1], 10)
  }
  
  // 提取角色定位
  let role: 'protagonist' | 'antagonist' | 'supporting' | 'minor' = 'supporting'
  const roleMatch = content.match(/角色定位[：:]\s*(.+)/)
  if (roleMatch) {
    const r = roleMatch[1].trim()
    if (r.includes('主角')) role = 'protagonist'
    else if (r.includes('反派')) role = 'antagonist'
    else if (r.includes('龙套') || r.includes('路人')) role = 'minor'
    else role = 'supporting'
  }
  
  // 提取外貌（不在空行处截断，只在下一个字段标题或 --- 处停止）
  let appearance = ''
  const appearanceMatch = content.match(/外貌[：:]\s*\n?([\s\S]*?)(?=\n[^\s\-：:]+\s*[：:]|---|$)/)
  if (appearanceMatch) {
    appearance = appearanceMatch[1].trim()
  }
  
  // 提取性格特点
  let personality = ''
  const personalityMatch = content.match(/性格特点[：:]\s*\n?([\s\S]*?)(?=\n[^\s\-：:]+\s*[：:]|---|$)/)
  if (personalityMatch) {
    personality = personalityMatch[1].trim()
  }
  
  // 提取背景故事
  let background = ''
  const backgroundMatch = content.match(/背景故事[：:]\s*\n?([\s\S]*?)(?=\n[^\s\-：:]+\s*[：:]|---|$)/)
  if (backgroundMatch) {
    background = backgroundMatch[1].trim()
  }
  
  // 提取能力/技能
  let abilities = ''
  const abilitiesMatch = content.match(/能力[：:]\s*\n?([\s\S]*?)(?=\n[^\s\-：:]+\s*[：:]|---|$)/)
  if (abilitiesMatch) {
    abilities = abilitiesMatch[1].trim()
  }
  
  // 提取核心动机
  let motivation = ''
  const motivationMatch = content.match(/核心动机[：:]\s*\n?([\s\S]*?)(?=\n[^\s\-：:]+\s*[：:]|---|$)/)
  if (motivationMatch) {
    motivation = motivationMatch[1].trim()
  }
  
  // 提取成长弧线
  let arc = ''
  const arcMatch = content.match(/成长弧线[：:]\s*\n?([\s\S]*?)(?=\n[^\s\-：:]+\s*[：:]|---|$)/)
  if (arcMatch) {
    arc = arcMatch[1].trim()
  }
  
  // 提取对话风格
  let dialogueStyle = ''
  const dialogueStyleMatch = content.match(/对话风格[：:]\s*\n?([\s\S]*?)(?=\n[^\s\-：:]+\s*[：:]|---|$)/)
  if (dialogueStyleMatch) {
    dialogueStyle = dialogueStyleMatch[1].trim()
  }
  
  // 提取和主角的关系
  let relationships = ''
  const relationMatch = content.match(/和主角的关系[：:]\s*\n?([\s\S]*?)(?=\n[^\s\-：:]+\s*[：:]|---|$)/)
  if (relationMatch) {
    relationships = relationMatch[1].trim()
  }
  
  // 构建综合描述
  const description = [
    appearance ? `外貌：${appearance}` : '',
    personality ? `性格：${personality}` : '',
    background ? `背景：${background}` : '',
    abilities ? `能力：${abilities}` : '',
    relationships ? `与主角关系：${relationships}` : ''
  ].filter(Boolean).join('\n')
  
  return {
    id: `char-${Date.now()}`,
    name,
    role,
    gender,
    age,
    appearance,
    personality,
    background: background || undefined,
    abilities: abilities || undefined,
    motivation: motivation || undefined,
    arc: arc || undefined,
    dialogueStyle: dialogueStyle || undefined,
    relationships,
    description: description || content
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
