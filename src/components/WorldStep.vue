<template>
  <div class="world-step">
    <h2>世界观设定</h2>
    <p class="step-description">构建您故事发生的世界，包括世界背景、规则、社会结构等。</p>
    
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
        :autosize="{ minRows: 12, maxRows: 20 }"
        placeholder="请描述您故事的世界观设定...&#10;&#10;建议包括：&#10;- 世界背景（时代、地点、环境）&#10;- 核心设定（世界运行规则）&#10;- 社会结构（势力、等级、文化）&#10;- 重要地点&#10;- 历史渊源"
      />
    </div>
    
    <!-- AI 生成模式 -->
    <div v-if="currentMode === 'ai'" class="mode-content">
      <div class="ai-input-section">
        <el-input
          v-model="aiPrompt"
          type="textarea"
          :autosize="{ minRows: 4, maxRows: 8 }"
          placeholder="请输入世界观设定的关键词或描述（可选，如留空则基于灵感描述自动生成）...&#10;&#10;例如：&#10;- 修仙世界，五大宗门割据，灵气衰退&#10;- 末日废土，人类聚居地下的巨城&#10;- 赛博朋克，脑机接口普及的近未来"
        />
        <el-button
          type="primary"
          :loading="isGenerating"
          @click="generateWithAI"
        >
          🤖 AI 生成世界观
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
        <h3>世界观引导问题：</h3>
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
        
        <!-- AI 建议弹框 -->
        <SuggestionDialog
          v-model:visible="dialogVisible"
          :question="currentQuestion"
          :context="formatAnswersForContext()"
          :projectType="projectStore.session?.projectType || ProjectType.NOVEL"
          @confirm="handleSuggestionConfirm"
        />
        
        <el-button
          type="primary"
          :disabled="!isGuidedComplete || isGenerating"
          :loading="isGenerating"
          @click="generateWithAssist"
        >
          ✨ 生成世界观
        </el-button>
      </div>
      
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
import { ref, h, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'
import { useProjectStore } from '@/stores/project'
import { useAgentStore } from '@/stores/agent'
import { StepInputMode, StepStatus, ProjectType } from '@/stores/project'
import { ElMessage } from 'element-plus'

const projectStore = useProjectStore()
const agentStore = useAgentStore()

const currentMode = ref<StepInputMode>(StepInputMode.MANUAL)
const manualInput = ref('')
const aiPrompt = ref('')  // AI 模式下的用户输入提示词
const generatedContent = ref('')
const finalContent = ref('')

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
    text: '时代背景',
    type: 'single',
    options: [
      { label: '古代', value: '古代' },
      { label: '现代', value: '现代' },
      { label: '未来', value: '未来' },
      { label: '架空', value: '架空' },
      { label: '其他', value: '其他', isOther: true }
    ],
    answer: '',
    otherValue: '',
    placeholder: '选择时代背景（单选）'
  },
  {
    id: 2,
    text: '核心设定',
    type: 'multiple',
    options: [
      { label: '魔法体系', value: '魔法体系' },
      { label: '修炼等级', value: '修炼等级' },
      { label: '科技水平', value: '科技水平' },
      { label: '异能觉醒', value: '异能觉醒' },
      { label: '系统金手指', value: '系统金手指' },
      { label: '其他', value: '其他', isOther: true }
    ],
    answer: [],
    otherValue: '',
    placeholder: '选择核心设定（可多选）'
  },
  {
    id: 3,
    text: '势力分布',
    type: 'multiple',
    options: [
      { label: '宗门', value: '宗门' },
      { label: '国家', value: '国家' },
      { label: '公司', value: '公司' },
      { label: '秘密组织', value: '秘密组织' },
      { label: '家族', value: '家族' },
      { label: '其他', value: '其他', isOther: true }
    ],
    answer: [],
    otherValue: '',
    placeholder: '选择势力分布（可多选）'
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
const suggestionsLoading = ref<number | null>(null)  // 用于控制 AI 建议按钮的加载状态

// 显示建议弹框
function showSuggestionDialog(question: GuidedQuestion) {
  currentQuestion.value = question
  suggestionsLoading.value = question.id
  dialogVisible.value = true

  // 模拟加载 AI 建议（实际应该调用 API）
  // 这里只是示例，实际应该在 SuggestionDialog 组件内部处理加载状态
  setTimeout(() => {
    suggestionsLoading.value = null
  }, 1000)
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

onMounted(() => {
  // 如果之前已经完成过此步骤，恢复内容
  const stepState = projectStore.session?.steps['world']
  if (stepState && stepState.status === StepStatus.COMPLETED) {
    finalContent.value = stepState.content
    if (stepState.mode) {
      currentMode.value = stepState.mode as StepInputMode
    }
    if (stepState.mode === StepInputMode.MANUAL) {
      manualInput.value = stepState.content
    }
    // 恢复引导问题的答案
    if (stepState.guidedAnswers) {
      guidedQuestions.value = stepState.guidedAnswers
    }
  }
})

async function generateWithAI() {
  const idea = projectStore.session?.steps['idea']?.content || ''
  if (!idea) {
    ElMessage.warning('请先完成灵感描述步骤')
    return
  }
  
  isGenerating.value = true
  generatedContent.value = ''
  startStreamingWatch()
  try {
    // 如果用户输入了提示词，将其作为上下文传入
    const context = aiPrompt.value.trim() || undefined
    const result = await agentStore.generateWorld(idea, projectStore.session?.projectType || ProjectType.NOVEL, context)
    generatedContent.value = result
  } catch (error) {
    console.error('AI 生成失败：', error)
    // 显示详细的错误信息，帮助用户在解决问题
    const errorMsg = error instanceof Error ? error.message : '生成失败'
    ElMessage.error({
      message: h('div', {}, [
        h('div', { style: 'font-weight: bold; margin-bottom: 8px;' }, '生成失败'),
        h('div', { style: 'font-size: 12px; white-space: pre-line;' }, errorMsg)
      ]),
      duration: 8000,  // 显示 8 秒，让用户有足够时间阅读
      showClose: true
    })
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
    const idea = projectStore.session?.steps['idea']?.content || ''
    
    // 调用生成函数，传入灵感描述和用户回答作为上下文
    const result = await agentStore.generateWorld(idea, projectStore.session?.projectType || ProjectType.NOVEL, answers)
    generatedContent.value = result
    ElMessage.success('辅助生成成功！请点击"应用此内容"按钮使用生成的内容')
  } catch (error) {
    console.error('辅助生成失败：', error)
    // 显示详细的错误信息
    const errorMsg = error instanceof Error ? error.message : '生成失败'
    ElMessage.error({
      message: h('div', {}, [
        h('div', { style: 'font-weight: bold; margin-bottom: 8px;' }, '辅助生成失败'),
        h('div', { style: 'font-size: 12px; white-space: pre-line;' }, errorMsg)
      ]),
      duration: 8000,
      showClose: true
    })
  } finally {
    stopStreamingWatch()
    isGenerating.value = false
  }
}

// 计算属性：判断是否可以进入下一步
const canProceed = computed(() => {
  if (currentMode.value === StepInputMode.MANUAL) {
    return manualInput.value.trim() !== ''
  } else {
    return generatedContent.value.trim() !== ''
  }
})

function handlePrev() {
  projectStore.goToPrevStep()
}

function handleSkip() {
  projectStore.skipCurrentStep()
}

// 应用生成的内容到最终内容
async function applyGeneratedContent() {
  if (!generatedContent.value) return
  
  finalContent.value = generatedContent.value
  
  // 保存步骤状态（包括引导问题的答案）
  projectStore.updateStepState('world', {
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

function handleNext() {
  // 如果没有最终内容，先应用生成的内容（如果有）
  if (!finalContent.value && generatedContent.value) {
    applyGeneratedContent()
  }
  
  // 如果是手动模式，使用手动输入的内容
  if (currentMode.value === StepInputMode.MANUAL && manualInput.value) {
    finalContent.value = manualInput.value
    projectStore.updateStepState('world', {
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
.world-step {
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

.ai-hint {
  color: var(--el-text-color-secondary);
  font-size: 14px;
  text-align: center;
}

.generated-content {
  margin-top: 20px;
  
  h3 {
    margin-bottom: 12px;
    color: var(--el-text-color-primary);
  }
}

.content-preview {
  white-space: pre-wrap;
  line-height: 1.6;
  color: var(--el-text-color-regular);
  padding: 12px;
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

.step-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid var(--el-border-color);
}

/* 响应式设计：在小屏幕上调整 */
@media (max-width: 768px) {
  .world-step {
    padding: 20px 10px;
  }
  
  .content-preview,
  .final-content {
    padding: 8px;
  }
}
</style>
