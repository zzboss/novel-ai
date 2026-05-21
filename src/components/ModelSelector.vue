<template>
  <div class="model-selector flex items-center gap-2">
    <el-select
      :model-value="selectedModelId"
      @update:model-value="handleModelChange"
      placeholder="选择AI模型"
      size="small"
      style="width: 200px"
    >
      <el-option
        v-for="model in availableModels"
        :key="model.id"
        :label="model.name"
        :value="model.id"
      >
        <div class="flex items-center justify-between">
          <span>{{ model.name }}</span>
          <el-tag v-if="model.isDefault" size="small" type="success">默认</el-tag>
        </div>
      </el-option>
    </el-select>
    <el-text type="info" size="small" v-if="selectedModel">
      {{ getProviderName(selectedModel.provider) }}
    </el-text>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import type { ModelConfig } from '@/llm/types'

const props = defineProps<{
  modelValue?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'change': [modelConfig: ModelConfig]
}>()

const settingsStore = useSettingsStore()

// 初始化settings store
onMounted(async () => {
  if (!settingsStore.isReady) {
    await settingsStore.initialize()
  }
})

const availableModels = computed(() => settingsStore.settings.models || [])

const selectedModelId = computed(() => {
  return props.modelValue || settingsStore.activeModelId || ''
})

const selectedModel = computed(() => {
  if (!selectedModelId.value) return null
  return availableModels.value.find(m => m.id === selectedModelId.value) || null
})

function handleModelChange(modelId: string): void {
  const model = availableModels.value.find(m => m.id === modelId)
  if (model) {
    emit('update:modelValue', modelId)
    emit('change', model)
  }
}

function getProviderName(provider: string): string {
  const providerMap: Record<string, string> = {
    'openai': 'OpenAI',
    'claude': 'Claude',
    'qwen': '通义千问',
    'deepseek': 'DeepSeek',
    'doubao': '豆包',
    'glm': 'GLM',
    'gemini': 'Gemini',
    'ollama': 'Ollama',
    'lmstudio': 'LM Studio',
    'custom': '自定义'
  }
  return providerMap[provider] || provider
}
</script>

<style scoped>
.model-selector {
  display: flex;
  align-items: center;
}
</style>
