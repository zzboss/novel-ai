<template>
  <el-dialog
    v-model="visible"
    title="新建章节"
    width="440px"
    :close-on-click-modal="false"
    @closed="onClosed"
  >
    <!-- 卷选择 -->
    <div class="mb-4" v-if="volumes.length > 1">
      <div class="text-xs mb-1.5" style="color: var(--el-text-color-secondary)">所属卷</div>
      <el-select v-model="selectedVolumeId" class="w-full" size="default" placeholder="选择所属卷">
        <el-option
          v-for="vol in volumes"
          :key="vol.id"
          :label="vol.title"
          :value="vol.id"
        />
      </el-select>
    </div>

    <!-- 章节名输入 -->
    <div class="mb-4">
      <div class="text-xs mb-1.5" style="color: var(--el-text-color-secondary)">章节标题（可选）</div>
      <div class="flex gap-2">
        <el-input
          ref="inputRef"
          v-model="title"
          placeholder="留空则 AI 生成内容后自动起标题"
          size="default"
          clearable
          @keyup.enter="onConfirm"
        />
        <el-button
          type="primary"
          :loading="isGenerating"
          :disabled="!selectedModelConfig"
          @click="onGenerateTitle"
        >
          AI 生成
        </el-button>
      </div>
      <!-- 模型选择 -->
      <div class="mt-2">
        <ModelSelector v-model="selectedModelId" @change="onModelChange" />
      </div>
    </div>

    <!-- AI 候选章节名 -->
    <div v-if="candidates.length > 0" class="mb-4">
      <div class="text-xs mb-1.5" style="color: var(--el-text-color-secondary)">AI 候选标题（点击选用）</div>
      <div class="flex flex-wrap gap-2">
        <el-tag
          v-for="(cand, idx) in candidates"
          :key="idx"
          class="cursor-pointer"
          :type="title === cand ? 'primary' : 'info'"
          :effect="title === cand ? 'dark' : 'plain'"
          size="default"
          @click="title = cand"
        >
          {{ cand }}
        </el-tag>
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :disabled="!title.trim()" @click="onConfirm">
        创建章节
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { useProjectStore } from '@/stores/project'
import { useAgentStore } from '@/stores/agent'
import { useSettingsStore } from '@/stores/settings'
import ModelSelector from '@/components/ModelSelector.vue'
import type { Volume } from '@/stores/project'
import type { ModelConfig } from '@/llm/types'

interface VolumeInfo {
  id: string
  title: string
  chapterCount: number
}

const props = defineProps<{
  modelValue: boolean
  volumes: VolumeInfo[]
  defaultVolumeId?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'confirm', data: { volumeId: string; title: string }): void
}>()

const projectStore = useProjectStore()
const agentStore = useAgentStore()
const settingsStore = useSettingsStore()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const inputRef = ref<any>(null)
const title = ref('')
const candidates = ref<string[]>([])
const isGenerating = ref(false)
const selectedVolumeId = ref(props.defaultVolumeId || props.volumes[0]?.id || '')
const selectedModelId = ref('')
const selectedModelConfig = ref<ModelConfig | null>(null)

// 初始化时设置默认模型
if (settingsStore.settings.activeModelId) {
  selectedModelId.value = settingsStore.settings.activeModelId
  selectedModelConfig.value = settingsStore.settings.models.find(m => m.id === selectedModelId.value) || null
}

const hasModel = computed(() => !!projectStore.project)

// 模型切换处理
function onModelChange(modelConfig: ModelConfig): void {
  selectedModelConfig.value = modelConfig
  selectedModelId.value = modelConfig.id
}

// 弹窗打开时自动聚焦输入框
watch(() => props.modelValue, async (val) => {
  if (val) {
    title.value = ''
    candidates.value = []
    selectedVolumeId.value = props.defaultVolumeId || props.volumes[0]?.id || ''
    await nextTick()
    inputRef.value?.focus()
  }
})

async function onGenerateTitle(): Promise<void> {
  if (isGenerating.value) return

  const project = projectStore.project
  if (!project) {
    ElMessage.warning('请先打开项目')
    return
  }

  if (!selectedModelConfig.value) {
    ElMessage.warning('请先选择AI模型')
    return
  }

  isGenerating.value = true
  candidates.value = []

  try {
    const result = await agentStore.generateChapterTitle(selectedModelConfig.value)
    // 解析 AI 返回的候选标题
    candidates.value = parseCandidateTitles(result)
    if (candidates.value.length > 0) {
      title.value = candidates.value[0]
    }
  } catch (err) {
    console.error('生成章节标题失败:', err)
    ElMessage.error('AI 生成标题失败，请手动输入')
  } finally {
    isGenerating.value = false
  }
}

function parseCandidateTitles(aiResult: string): string[] {
  // 尝试按换行或序号分割提取候选标题
  const lines = aiResult.split('\n').map(l => l.trim()).filter(Boolean)
  const titles: string[] = []

  for (const line of lines) {
    // 去掉序号前缀：1. 2. 3. 或 ①②③ 或 1、2、 或 1) 2)
    const cleaned = line
      .replace(/^\d+[\.\、\s\)）]+/, '') // 去除 "1. "、"2、"、"3) " 等前缀
      .replace(/^[①②③④⑤⑥⑦⑧⑨⑩]+\s*/, '') // 去除圆圈数字
      .replace(/^[-*]\s*/, '') // 去除 "-" 或 "*" 前缀
      .replace(/^[""「『]|[""」』]$/g, '') // 去除引号
      .trim()

    // 字数限制：4-15字
    if (cleaned.length >= 4 && cleaned.length <= 15) {
      titles.push(cleaned)
    }
    if (titles.length >= 5) break
  }

  return titles
}

function onConfirm(): void {
  if (!selectedVolumeId.value) {
    ElMessage.warning('请选择所属卷')
    return
  }
  const trimmedTitle = title.value.trim()
  // 允许标题为空，由调用方处理默认标题
  emit('confirm', { volumeId: selectedVolumeId.value, title: trimmedTitle })
  visible.value = false
}

function onClosed(): void {
  title.value = ''
  candidates.value = []
}
</script>
