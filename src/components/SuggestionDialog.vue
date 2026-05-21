<template>
  <el-dialog
    :model-value="visible"
    :title="`💡 AI 建议 - ${question?.text || ''}`"
    width="500px"
    :close-on-click-modal="false"
    @update:model-value="(val: boolean) => !val && handleClose()"
  >
    <!-- 模型选择 -->
    <div v-if="!loading" class="model-section mb-4">
      <ModelSelector v-model="selectedModelId" @change="onModelChange" />
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="dialog-loading">
      <el-icon class="is-loading" :size="24">
        <Loading />
      </el-icon>
      <span>正在生成建议...</span>
    </div>

    <!-- 建议列表 -->
    <div v-else class="dialog-content">
      <div class="dialog-tip">📝 请选择一个或多个符合您想法的选项：</div>

      <!-- 全选/清空按钮 -->
      <div class="dialog-actions">
        <el-button text size="small" @click="selectAll">全选</el-button>
        <el-button text size="small" @click="clearAll">清空</el-button>
      </div>

      <!-- 选项列表 -->
      <div class="options-list">
        <el-checkbox-group v-model="selectedValues">
          <div v-for="(option, idx) in options" :key="idx" class="option-item">
            <el-checkbox :value="option" class="option-checkbox">
              {{ option }}
            </el-checkbox>
          </div>
        </el-checkbox-group>
      </div>

      <!-- "其他"选项输入框 -->
      <div v-if="showOtherInput" class="other-input-section">
        <div class="other-input-label">✨ 请输入自定义内容：</div>
        <el-input
          v-model="otherValue"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 4 }"
          placeholder="请输入自定义内容，多个选项用逗号分隔"
        />
      </div>

      <!-- 自定义输入 -->
      <div class="custom-input-section">
        <div class="custom-input-label">✨ 或者，您也可以直接输入：</div>
        <el-input
          v-model="customInput"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 4 }"
          placeholder="自定义输入（可替代上述选择）..."
        />
      </div>
    </div>

    <!-- 底部按钮 -->
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" :disabled="!canConfirm" @click="handleConfirm">
          确认选择
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import { useAgentStore } from '@/stores/agent'
import { useSettingsStore } from '@/stores/settings'
import ModelSelector from '@/components/ModelSelector.vue'
import type { ProjectType } from '@/stores/project'
import type { ModelConfig } from '@/llm/types'

interface Props {
  visible: boolean
  question: {
    id: number
    text: string
    type: 'single' | 'multiple' | 'text'
    options?: { label: string; value: string; isOther?: boolean }[]
  } | null
  context: string
  projectType: ProjectType
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm', selected: string[]): void
}>()

const agentStore = useAgentStore()
const settingsStore = useSettingsStore()

// 状态
const loading = ref(false)
const options = ref<string[]>([])
const selectedValues = ref<string[]>([])
const otherValue = ref('')
const customInput = ref('')
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

// 计算属性
const showOtherInput = computed(() => {
  return selectedValues.value.includes('其他')
})

const canConfirm = computed(() => {
  // 如果有自定义输入，可以确认
  if (customInput.value.trim()) return true
  // 如果选择了选项（且不是只有"其他"），可以确认
  if (selectedValues.value.length > 0) {
    // 如果只有"其他"，需要检查 otherValue 是否有输入
    if (selectedValues.value.length === 1 && selectedValues.value[0] === '其他') {
      return otherValue.value.trim() !== ''
    }
    return true
  }
  return false
})

// 方法
async function generateSuggestions() {
  if (!props.question) return

  if (!selectedModelConfig.value) {
    ElMessage.warning('请先选择AI模型')
    return
  }

  loading.value = true
  options.value = []

  try {
    const suggestions = await agentStore.generateQuestionSuggestions(
      props.question.text,
      props.context,
      props.projectType,
      selectedModelConfig.value
    )
    options.value = suggestions
  } catch (error) {
    console.error('生成建议失败：', error)
    ElMessage.error('生成建议失败，请手动输入')
  } finally {
    loading.value = false
  }
}

function selectAll() {
  selectedValues.value = [...options.value]
}

function clearAll() {
  selectedValues.value = []
  otherValue.value = ''
}

function handleConfirm() {
  // 构建结果数组
  const result: string[] = []

  // 添加选中的选项（排除"其他"）
  selectedValues.value.forEach(value => {
    if (value !== '其他') {
      result.push(value)
    }
  })

  // 添加"其他"选项的自定义输入
  if (selectedValues.value.includes('其他') && otherValue.value.trim()) {
    result.push(`其他：${otherValue.value.trim()}`)
  }

  // 如果有自定义输入，替换所有选择
  if (customInput.value.trim()) {
    result.length = 0
    result.push(customInput.value.trim())
  }

  // 发送结果，让父组件负责关闭弹框
  emit('confirm', result)
}

function handleClose() {
  // 重置弹框状态
  selectedValues.value = []
  otherValue.value = ''
  customInput.value = ''
  options.value = []
  emit('update:visible', false)
}

// 监听 visible 变化
watch(
  () => props.visible,
  (newVal) => {
    if (newVal && props.question) {
      // 重置状态
      selectedValues.value = []
      otherValue.value = ''
      customInput.value = ''
      // 生成建议
      generateSuggestions()
    }
  }
)
</script>

<style scoped>
.dialog-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 0;
  color: var(--el-text-color-secondary);
}

.dialog-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dialog-tip {
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.dialog-actions {
  display: flex;
  gap: 8px;
}

.options-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  padding: 12px;
}

.option-item {
  margin-bottom: 8px;
}

.option-item:last-child {
  margin-bottom: 0;
}

.option-checkbox {
  width: 100%;
}

.other-input-section,
.custom-input-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.other-input-label,
.custom-input-label {
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
