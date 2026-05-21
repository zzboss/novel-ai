<template>
  <div class="idea-step">
    <h2>灵感描述</h2>
    <p class="step-description">描述您的创作灵感，可以是一个想法、一个场景、或者一个"如果……"的假设。</p>
    
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
        placeholder="请输入您的创作灵感...&#10;&#10;例如：&#10;- 如果 AI 获得了情感，会怎样？&#10;- 一个关于时间旅行的爱情故事&#10;- 在修仙世界中，科学家的逆袭"
      />
    </div>
    
    <!-- AI 生成模式 -->
    <div v-if="currentMode === 'ai'" class="mode-content">
      <div class="ai-input-section">
        <el-input
          v-model="aiPrompt"
          type="textarea"
          :autosize="{ minRows: 4, maxRows: 8 }"
          placeholder="请输入关键词或简短描述，AI 将为您生成完整的灵感描述..."
        />
        <el-button
          type="primary"
          :disabled="!aiPrompt.trim() || isGenerating"
          :loading="isGenerating"
          @click="generateWithAI"
        >
          🤖 AI 生成
        </el-button>
      </div>
      
      <div v-if="generatedContent" class="generated-content">
        <div class="generated-header">
          <h3>AI 生成结果（可编辑）：</h3>
          <div class="generated-actions">
            <el-button type="success" size="small" @click="applyGeneratedContent">
              ✓ 应用此内容
            </el-button>
            <el-button size="small" @click="regenerateWithAI">
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
        <h3>灵感引导问题：</h3>
        <div v-for="question in guidedQuestions" :key="question.id" class="question-item">
          <div class="question-header">
            <label class="question-label">{{ question.text }}</label>
            <el-button
              size="small"
              :loading="suggestionsLoading === question.id"
              @click="showSuggestionDialog(question)"
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
            
            <!-- 答案摘要 -->
            <div v-if="question.answer.length > 0" class="answer-summary">
              <span class="answer-label">已选：</span>
              <el-tag 
                v-for="(ans, idx) in question.answer" 
                :key="idx"
                size="small"
                class="answer-tag"
                closable
                @close="removeAnswer(question, ans)"
              >
                {{ ans }}
              </el-tag>
            </div>
          </div>
          
          <!-- 单选问题 -->
          <div v-else-if="question.type === 'single'" class="question-options">
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
            
            <!-- 答案摘要 -->
            <div v-if="question.answer" class="answer-summary">
              <span class="answer-label">已选：</span>
              <el-tag 
                size="small"
                class="answer-tag"
                closable
                @close="question.answer = ''"
              >
                {{ question.answer }}
              </el-tag>
            </div>
          </div>
          
          <!-- 文本输入问题 -->
          <div v-else class="question-input">
            <el-input
              v-model="question.answer"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 4 }"
              :placeholder="question.placeholder"
            />
            
            <!-- 答案摘要 -->
            <div v-if="question.answer && typeof question.answer === 'string' && (question.answer as string).trim()" class="answer-summary">
              <span class="answer-label">已输入：</span>
              <el-tag 
                size="small"
                class="answer-tag"
                closable
                @close="question.answer = ''"
              >
                {{ question.answer }}
              </el-tag>
            </div>
          </div>
        </div>
        
        <el-button
          type="primary"
          :disabled="!isGuidedComplete || isGenerating"
          :loading="isGenerating"
          @click="generateWithAssist"
        >
          ✨ 生成灵感描述
        </el-button>
      </div>
      
      <!-- AI 建议弹框 -->
      <SuggestionDialog
        v-model:visible="dialogVisible"
        :question="currentQuestion"
        :context="formatAnswersForContext()"
        :projectType="projectStore.session?.projectType || ProjectType.NOVEL"
        @confirm="handleSuggestionConfirm"
      />
      
      <div v-if="generatedContent" class="generated-content">
        <div class="generated-header">
          <h3>生成结果（可编辑）：</h3>
          <div class="generated-actions">
            <el-button type="success" size="small" @click="applyGeneratedContent">
              ✓ 应用此内容
            </el-button>
            <el-button size="small" @click="generateWithAssist">
              ✨ 重新生成
            </el-button>
          </div>
        </div>
        <el-input
          v-model="generatedContent"
          type="textarea"
          :autosize="{ minRows: 12, maxRows: 20 }"
          placeholder="生成的内容将显示在这里，您可以直接编辑..."
          class="editable-content"
        />
      </div>
    </div>
    
    <!-- 步骤操作 -->
    <div class="step-actions">
      <el-button @click="handlePrev">上一步</el-button>
      <el-button type="warning" plain @click="handleSkip">跳过此步骤</el-button>
      <el-button 
        type="primary" 
        :disabled="!canProceed" 
        @click="handleNext"
      >
        下一步
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, reactive, watch } from 'vue'
import { useProjectStore } from '@/stores/project'
import { useAgentStore } from '@/stores/agent'
import { StepInputMode, StepStatus, ProjectType } from '@/stores/project'
import { ElMessage } from 'element-plus'

const projectStore = useProjectStore()
const agentStore = useAgentStore()

const currentMode = ref<StepInputMode>(StepInputMode.MANUAL)
const manualInput = ref('')
const aiPrompt = ref('')
const generatedContent = ref('')
const finalContent = ref('')

// 组件挂载时，从store恢复状态
onMounted(() => {
  const savedState = projectStore.session?.steps['idea']
  if (savedState) {
    // 恢复输入模式
    if (savedState.mode) {
      currentMode.value = savedState.mode as StepInputMode
    }
    // 恢复内容
    if (savedState.content) {
      finalContent.value = savedState.content
      generatedContent.value = savedState.content
      // 如果是手动模式，也恢复到manualInput
      if (savedState.mode === StepInputMode.MANUAL) {
        manualInput.value = savedState.content
      }
    }
    // 恢复引导问题的答案
    if (savedState.guidedAnswers) {
      guidedQuestions.value = savedState.guidedAnswers
    }
  }
})

// 问题类型定义
interface QuestionOption {
  label: string
  value: string
  isOther?: boolean  // 是否为"其他"选项
}

interface GuidedQuestion {
  id: number
  text: string
  type: 'single' | 'multiple' | 'text'  // 单选、多选、文本输入
  options?: QuestionOption[]  // 选项列表（对于单选和多选）
  answer: any  // 使用 any 以兼容单选(string)、多选(string[])、文本输入(string)
  otherValue: string  // "其他"选项的自定义输入
  placeholder: string
}

// 优化后的引导问题（支持多选和"其他"选项）
const guidedQuestions = ref<GuidedQuestion[]>([
  {
    id: 1,
    text: '题材类型',
    type: 'multiple',
    options: [
      { label: '修仙', value: '修仙' },
      { label: '都市', value: '都市' },
      { label: '系统', value: '系统' },
      { label: '科幻', value: '科幻' },
      { label: '武侠', value: '武侠' },
      { label: '历史', value: '历史' },
      { label: '悬疑', value: '悬疑' },
      { label: '言情', value: '言情' },
      { label: '其他', value: '其他', isOther: true }
    ],
    answer: [],
    otherValue: '',
    placeholder: '选择题材类型（可多选）'
  },
  {
    id: 2,
    text: '核心冲突',
    type: 'multiple',
    options: [
      { label: '正邪对抗', value: '正邪对抗' },
      { label: '爱恨情仇', value: '爱恨情仇' },
      { label: '生存挑战', value: '生存挑战' },
      { label: '自我救赎', value: '自我救赎' },
      { label: '其他', value: '其他', isOther: true }
    ],
    answer: [],
    otherValue: '',
    placeholder: '选择核心冲突（可多选）'
  },
  {
    id: 3,
    text: '主题表达',
    type: 'multiple',
    options: [
      { label: '成长', value: '成长' },
      { label: '复仇', value: '复仇' },
      { label: '救赎', value: '救赎' },
      { label: '爱情', value: '爱情' },
      { label: '自由', value: '自由' },
      { label: '权力', value: '权力' },
      { label: '其他', value: '其他', isOther: true }
    ],
    answer: [],
    otherValue: '',
    placeholder: '选择主题表达（可多选）'
  },
  {
    id: 4,
    text: '风格基调',
    type: 'single',
    options: [
      { label: '轻松搞笑', value: '轻松搞笑' },
      { label: '严肃深沉', value: '严肃深沉' },
      { label: '悬疑紧凑', value: '悬疑紧凑' },
      { label: '热血激昂', value: '热血激昂' },
      { label: '治愈温暖', value: '治愈温暖' }
    ],
    answer: '',
    otherValue: '',
    placeholder: '选择风格基调（单选）'
  }
])

// 判断问题是否已回答
function isQuestionAnswered(question: GuidedQuestion): boolean {
  if (question.type === 'multiple') {
    const answer = question.answer as string[]
    // 多选：至少选择了一个选项，或者"其他"选项有输入
    if (answer.includes('其他')) {
      return question.otherValue.trim() !== ''
    }
    return answer.length > 0
  } else if (question.type === 'single') {
    return (question.answer as string).trim() !== ''
  } else {
    return (question.answer as string).trim() !== ''
  }
}

const isGuidedComplete = computed(() => {
  return guidedQuestions.value.some(q => isQuestionAnswered(q))
})

const isGenerating = ref(false)

// 实时流式输出：监听 agentStore.currentStreaming 更新生成内容
let streamingWatchStop: (() => void) | null = null

function startStreamingWatch() {
  // 清除之前的监听
  stopStreamingWatch()
  streamingWatchStop = watch(
    () => agentStore.currentStreaming,
    (newVal) => {
      if (isGenerating.value && newVal) {
        generatedContent.value = newVal
      }
    }
  )
}

function stopStreamingWatch() {
  if (streamingWatchStop) {
    streamingWatchStop()
    streamingWatchStop = null
  }
}

onUnmounted(() => {
  stopStreamingWatch()
})

// 弹框相关状态
const dialogVisible = ref(false)
const currentQuestion = ref<GuidedQuestion | null>(null)

// AI 建议相关状态（兼容旧代码）
const suggestionsLoading = ref<number | null>(null)  // 当前正在加载建议的问题ID
const suggestionsList = ref<string[]>([])
const showSuggestionsFor = ref<number | null>(null)

// 为指定问题生成 AI 建议
async function generateSuggestions(question: GuidedQuestion) {
  suggestionsLoading.value = question.id
  showSuggestionsFor.value = question.id
  suggestionsList.value = []

  try {
    const projectType = projectStore.session?.projectType || ProjectType.NOVEL
    const context = formatAnswersForContext()
    
    const suggestions = await agentStore.generateQuestionSuggestions(question.text, context, projectType)
    suggestionsList.value = suggestions
  } catch (error) {
    console.error('生成建议失败：', error)
    ElMessage.error('生成建议失败，请手动输入')
    showSuggestionsFor.value = null
  } finally {
    suggestionsLoading.value = null
  }
}

// 选择建议，填入答案
function selectSuggestion(question: GuidedQuestion, suggestion: string) {
  if (question.type === 'multiple') {
    // 多选：切换选择状态
    const answer = question.answer as string[]
    const index = answer.indexOf(suggestion)
    if (index > -1) {
      answer.splice(index, 1)
    } else {
      answer.push(suggestion)
    }
  } else {
    // 单选或文本：直接设置
    question.answer = suggestion
  }
  // 不自动关闭建议列表，让用户可以继续选择
}

// 格式化答案为文本（用于生成上下文）
function formatAnswer(question: GuidedQuestion): string {
  if (question.type === 'multiple') {
    const answer = question.answer as string[]
    if (answer.length === 0) return ''
    
    let result = answer.filter(a => a !== '其他').join('、')
    if (answer.includes('其他') && question.otherValue.trim()) {
      result += (result ? '、' : '') + '其他：' + question.otherValue.trim()
    }
    return question.text + '：' + result
  } else {
    return question.text + '：' + question.answer
  }
}

// 格式化所有答案为上下文（用于AI生成）
function formatAnswersForContext(): string {
  return guidedQuestions.value
    .filter(q => isQuestionAnswered(q))
    .map(q => formatAnswer(q))
    .join('\n')
}

// 格式化所有答案为最终输入（用于传递给AI生成函数）
function formatAnswersForGeneration(): string {
  return guidedQuestions.value
    .filter(q => isQuestionAnswered(q))
    .map(q => formatAnswer(q))
    .join('\n')
}

// 显示建议弹框
function showSuggestionDialog(question: GuidedQuestion) {
  currentQuestion.value = question
  dialogVisible.value = true
}

// 处理建议确认
function handleSuggestionConfirm(selected: string[]) {
  if (!currentQuestion.value) return

  // 将选择的建议填入答案
  if (currentQuestion.value.type === 'multiple') {
    currentQuestion.value.answer = [...selected]
  } else {
    currentQuestion.value.answer = selected.join('、')
  }

  // 关闭弹框
  dialogVisible.value = false
  currentQuestion.value = null
}

// 删除已选答案
function removeAnswer(question: GuidedQuestion, answer: string) {
  if (question.type === 'multiple') {
    const idx = (question.answer as string[]).indexOf(answer)
    if (idx > -1) {
      (question.answer as string[]).splice(idx, 1)
    }
  }
}

// 计算属性：判断是否可以进入下一步
const canProceed = computed(() => {
  if (currentMode.value === StepInputMode.MANUAL) {
    return manualInput.value.trim() !== ''
  } else {
    // AI生成或辅助模式：只要有生成的内容即可
    return generatedContent.value.trim() !== ''
  }
})

async function generateWithAI() {
  if (!aiPrompt.value.trim()) return
  
  isGenerating.value = true
  generatedContent.value = ''
  startStreamingWatch()
  try {
    const result = await agentStore.generateIdea(aiPrompt.value, projectStore.session?.projectType || ProjectType.NOVEL)
    // 流式 watch 已实时更新 generatedContent，此处确保最终结果一致
    generatedContent.value = result
    ElMessage.success('AI生成成功！请点击"应用此内容"按钮使用生成的内容')
  } catch (error) {
    console.error('AI 生成失败：', error)
    ElMessage.error('生成失败，请重试')
  } finally {
    stopStreamingWatch()
    isGenerating.value = false
  }
}

async function regenerateWithAI() {
  await generateWithAI()
}

async function generateWithAssist() {
  const answers = formatAnswersForGeneration()
  
  if (!answers) return
  
  isGenerating.value = true
  generatedContent.value = ''
  startStreamingWatch()
  try {
    // 收集上下文：项目类型信息
    const projectType = projectStore.session?.projectType || ProjectType.NOVEL
    const typeMap: Record<ProjectType, string> = {
      [ProjectType.NOVEL]: '长篇小说',
      [ProjectType.SHORT_STORY]: '短篇故事',
      [ProjectType.SCRIPT]: '短剧剧本'
    }
    const context = `项目类型：${typeMap[projectType] || projectType}\n\n用户选择：\n${answers}`
    
    // 调用生成函数，传入上下文
    const result = await agentStore.generateIdea(answers, projectType, context)
    generatedContent.value = result
    ElMessage.success('辅助生成成功！请点击"应用此内容"按钮使用生成的内容')
  } catch (error) {
    console.error('辅助生成失败：', error)
    ElMessage.error('生成失败，请重试')
  } finally {
    stopStreamingWatch()
    isGenerating.value = false
  }
}

// 应用生成的内容到最终内容
async function applyGeneratedContent() {
  if (!generatedContent.value) return
  
  finalContent.value = generatedContent.value
  
  // 保存步骤状态（包括引导问题的答案）
  projectStore.updateStepState('idea', {
    mode: currentMode.value,
    content: finalContent.value,
    status: StepStatus.COMPLETED,
    guidedAnswers: guidedQuestions.value  // 保存引导问题的答案
  })
  
  ElMessage.success('已应用生成内容，可以进入下一步了')
  
  // 等待DOM更新后滚动到下一步按钮
  await nextTick()
  const stepActions = document.querySelector('.step-actions')
  if (stepActions) {
    stepActions.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
}

function handlePrev() {
  projectStore.goToPrevStep()
}

function handleSkip() {
  projectStore.skipCurrentStep()
}

function handleNext() {
  // 如果没有最终内容，先应用生成的内容（如果有）
  if (!finalContent.value && generatedContent.value) {
    applyGeneratedContent()
  }
  
  // 如果是手动模式，使用手动输入的内容
  if (currentMode.value === StepInputMode.MANUAL && manualInput.value) {
    finalContent.value = manualInput.value
    projectStore.updateStepState('idea', {
      mode: currentMode.value,
      content: finalContent.value,
      status: StepStatus.COMPLETED,
      guidedAnswers: guidedQuestions.value  // 保存引导问题的答案
    })
  }
  
  projectStore.completeCurrentStep()
}
</script>

<style scoped>
.idea-step {
  max-width: 800px;
  margin: 0 auto;
  padding: 40px 20px;
}

h2 {
  text-align: center;
  margin-bottom: 10px;
  color: var(--el-text-color-primary);
}

.step-description {
  text-align: center;
  color: var(--el-text-color-secondary);
  margin-bottom: 30px;
  font-size: 14px;
}

.mode-selector {
  display: flex;
  justify-content: center;
  margin-bottom: 30px;
}

.mode-content {
  margin-bottom: 30px;
}

.ai-input-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.generated-content {
  margin-top: 20px;
  
  h3 {
    margin-bottom: 12px;
    color: var(--el-text-color-primary);
  }
}

.generated-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  
  h3 {
    margin-bottom: 0;
  }
}

.content-preview {
  white-space: pre-wrap;
  line-height: 1.6;
  color: var(--el-text-color-regular);
  padding: 12px 12px 24px 12px;
  margin-bottom: 20px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  background-color: var(--el-fill-color-light);
}

.assisted-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.question-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.question-label {
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.question-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.suggestions-container {
  margin-top: 8px;
  margin-bottom: 16px;
  padding: 12px;
  background-color: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
}

.suggestions-title {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.suggestions-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.suggestion-item {
  text-align: left;
  white-space: normal;
  height: auto;
  padding: 8px 12px;
  line-height: 1.5;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  background-color: var(--el-bg-color);
  transition: all 0.2s;
}

.suggestion-item:hover {
  background-color: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary);
}

.content-confirmation {
  margin-top: 30px;
  
  h3 {
    margin-bottom: 12px;
    color: var(--el-color-primary);
  }
}

.final-content {
  white-space: pre-wrap;
  line-height: 1.6;
  color: var(--el-text-color-regular);
  margin-bottom: 16px;
  /* 移除固定高度和滚动，让内容自然展开，使整个页面可以滚动 */
  padding: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  background-color: var(--el-fill-color-light);
}

.confirmation-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.step-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid var(--el-border-color);
}

/* 响应式设计：在小屏幕上调整内边距 */
@media (max-width: 768px) {
  .idea-step {
    padding: 20px 10px;
  }
  
  .content-preview,
  .final-content {
    padding: 8px;
  }
}
</style>
