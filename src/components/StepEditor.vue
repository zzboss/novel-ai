<template>
  <div class="step-editor">
    <h2>{{ title }}</h2>
    <p class="step-description">{{ description }}</p>
    
    <!-- 模式选择 -->
    <div class="mode-selector">
      <el-radio-group v-model="currentMode" size="large">
        <el-radio-button value="manual">✍️ 手动输入</el-radio-button>
        <el-radio-button value="ai">🤖 AI 生成</el-radio-button>
        <el-radio-button value="assisted">🤝 辅助模式</el-radio-button>
      </el-radio-group>
    </div>
    
    <!-- 手动输入模式 -->
    <div v-if="currentMode === 'manual'" class="mode-content">
      <el-input
        v-model="manualInput"
        type="textarea"
        :autosize="{ minRows: 10, maxRows: 20 }"
        :placeholder="manualPlaceholder"
        @input="handleManualInput"
      />
    </div>
    
    <!-- AI 生成模式 -->
    <div v-if="currentMode === 'ai'" class="mode-content">
      <div class="ai-input-section">
        <el-input
          v-model="aiPrompt"
          type="textarea"
          :autosize="{ minRows: 4, maxRows: 8 }"
          :placeholder="aiPlaceholder"
        />
        <el-button
          type="primary"
          :loading="isGenerating"
          :disabled="!aiPrompt.trim() && requireAiPrompt"
          @click="handleGenerate"
        >
          🤖 AI 生成
        </el-button>
      </div>
      
      <div v-if="generatedContent" class="generated-content">
        <div class="generated-header">
          <h3>AI 生成结果（可编辑）：</h3>
          <div class="generated-actions">
            <el-button type="success" size="small" @click="handleApply">
              ✓ 应用此内容
            </el-button>
            <el-button size="small" @click="handleRegenerate">
              🤖 重新生成
            </el-button>
          </div>
        </div>
        <el-input
          v-model="generatedContent"
          type="textarea"
          :autosize="{ minRows: 12, maxRows: 20 }"
          placeholder="AI 生成的内容将显示在这里，您可以直接编辑..."
          class="editable-content"
        />
      </div>
    </div>
    
    <!-- 辅助模式 -->
    <div v-if="currentMode === 'assisted'" class="mode-content">
      <div class="assisted-section">
        <h3>{{ assistedTitle }}</h3>
        <div v-for="question in questions" :key="question.id" class="question-item">
          <div class="question-header">
            <label class="question-label">{{ question.text }}</label>
            <el-button
              size="small"
              :loading="suggestionsLoading === question.id"
              @click="handleSuggestion(question)"
            >
              🤖 AI 建议
            </el-button>
          </div>
          
          <!-- 多选问题 -->
          <div v-if="question.type === 'multiple'" class="question-options">
            <el-checkbox-group v-model="question.answer">
              <el-checkbox 
                v-for="option in question.options" 
                :key="option.value" 
                :value="option.value"
                class="option-item"
              >
                {{ option.label }}
              </el-checkbox>
            </el-checkbox-group>
            
            <!-- "其他"选项输入框 -->
            <div v-if="question.answer.includes('其他')" class="other-input">
              <el-input
                v-model="question.otherValue"
                placeholder="请输入自定义内容，多个选项用逗号分隔"
                size="small"
                clearable
              />
            </div>
          </div>
          
          <!-- 单选问题 -->
          <div v-if="question.type === 'single'" class="question-options">
            <el-radio-group v-model="question.answer">
              <el-radio 
                v-for="option in question.options" 
                :key="option.value" 
                :value="option.value"
                class="option-item"
              >
                {{ option.label }}
              </el-radio>
            </el-radio-group>
          </div>
          
          <!-- 文本输入问题 -->
          <div v-if="question.type === 'text'" class="question-options">
            <el-input
              v-model="question.answer"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 6 }"
              :placeholder="question.placeholder || '请输入...'"
            />
          </div>
        </div>
      </div>
    </div>
    
    <!-- 操作按钮 -->
    <div class="step-actions">
      <el-button @click="$emit('prev')">上一步</el-button>
      <el-button type="warning" plain @click="$emit('skip')">跳过此步骤</el-button>
      <el-button
        type="primary"
        :disabled="!canProceed"
        @click="$emit('next')"
      >
        下一步
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { StepInputMode } from '@/stores/project'

export interface Question {
  id: string
  text: string
  type: 'multiple' | 'single' | 'text'
  options?: Array<{ label: string; value: string }>
  answer: any
  placeholder?: string
  otherValue?: string
}

interface Props {
  title: string
  description: string
  manualPlaceholder?: string
  aiPlaceholder?: string
  assistedTitle?: string
  questions?: Question[]
  requireAiPrompt?: boolean
  modelValue?: string
}

const props = withDefaults(defineProps<Props>(), {
  manualPlaceholder: '请输入内容...',
  aiPlaceholder: '请输入关键词或描述，AI 将为您生成内容...',
  assistedTitle: '引导问题：',
  questions: () => [],
  requireAiPrompt: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'generate', prompt: string): void
  (e: 'apply', content: string): void
  (e: 'regenerate'): void
  (e: 'suggestion', question: Question): void
  (e: 'prev'): void
  (e: 'skip'): void
  (e: 'next'): void
}>()

// 当前模式
const currentMode = ref<StepInputMode>('manual')

// 手动输入
const manualInput = ref('')

// AI 生成
const aiPrompt = ref('')
const generatedContent = ref('')
const isGenerating = ref(false)

// 辅助模式
const suggestionsLoading = ref('')

// 计算属性：是否可以继续
const canProceed = computed(() => {
  if (currentMode.value === 'manual') {
    return manualInput.value.trim().length > 0
  } else if (currentMode.value === 'ai') {
    return generatedContent.value.trim().length > 0
  } else if (currentMode.value === 'assisted') {
    return props.questions.every(q => {
      if (q.type === 'multiple') return q.answer.length > 0
      if (q.type === 'single' || q.type === 'text') return q.answer
      return false
    })
  }
  return false
})

// 处理手动输入
const handleManualInput = () => {
  emit('update:modelValue', manualInput.value)
}

// 处理AI生成
const handleGenerate = () => {
  emit('generate', aiPrompt.value)
}

// 处理应用生成内容
const handleApply = () => {
  emit('apply', generatedContent.value)
}

// 处理重新生成
const handleRegenerate = () => {
  emit('regenerate')
}

// 处理AI建议
const handleSuggestion = (question: Question) => {
  suggestionsLoading.value = question.id
  emit('suggestion', question)
}

// 暴露给父组件的方法
defineExpose({
  setGeneratedContent: (content: string) => {
    generatedContent.value = content
    isGenerating.value = false
  },
  setGenerating: (loading: boolean) => {
    isGenerating.value = loading
  },
  setSuggestionsLoading: (questionId: string, loading: boolean) => {
    suggestionsLoading.value = loading ? questionId : ''
  },
  getManualInput: () => manualInput.value,
  getAiPrompt: () => aiPrompt.value,
  getGeneratedContent: () => generatedContent.value,
  getCurrentMode: () => currentMode.value
})
</script>

<style scoped>
.step-editor {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.step-description {
  color: #666;
  margin-bottom: 20px;
}

.mode-selector {
  margin-bottom: 20px;
  text-align: center;
}

.mode-content {
  margin-bottom: 20px;
}

.ai-input-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}

.generated-content {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 15px;
}

.generated-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.generated-header h3 {
  margin: 0;
}

.generated-actions {
  display: flex;
  gap: 10px;
}

.editable-content {
  width: 100%;
}

.assisted-section {
  margin-bottom: 20px;
}

.question-item {
  margin-bottom: 20px;
  padding: 15px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
}

.question-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.question-label {
  font-weight: 500;
}

.question-options {
  margin-left: 10px;
}

.option-item {
  display: block;
  margin-bottom: 8px;
}

.other-input {
  margin-top: 10px;
}

.step-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #e4e7ed;
}
</style>
