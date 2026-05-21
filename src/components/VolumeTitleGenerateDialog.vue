<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    title="AI 生成卷名"
    width="520px"
    :close-on-click-modal="false"
    :fullscreen="isFullscreen"
    @close="handleClose"
  >
    <!-- 全屏按钮 -->
    <template #header>
      <div class="dialog-header">
        <span class="dialog-title">AI 生成卷名</span>
        <div class="flex items-center gap-2">
          <ModelSelector
            v-model="selectedModelId"
            @change="handleModelChange"
          />
          <el-button text @click="isFullscreen = !isFullscreen">
            {{ isFullscreen ? '退出全屏' : '全屏' }}
          </el-button>
        </div>
      </div>
    </template>

    <!-- 生成按钮 -->
    <div class="mb-4">
      <el-button
        type="primary"
        :loading="isGenerating"
        :disabled="isGenerating"
        @click="handleGenerate"
      >
        {{ isGenerating ? '生成中...' : '生成卷名' }}
      </el-button>
      <el-text type="info" size="small" class="ml-2" v-if="!isGenerating && !candidates.length">
        点击按钮，AI 将生成多个候选卷名供选择
      </el-text>
    </div>

    <!-- 生成中 -->
    <div v-if="isGenerating" class="generating-section mb-4 text-center py-8">
      <el-icon :size="32" class="is-loading"><Loading /></el-icon>
      <p class="mt-2 text-sm" style="color: var(--el-text-color-secondary)">AI 正在生成候选卷名，请稍候...</p>
    </div>

    <!-- 候选列表 -->
    <div v-if="candidates.length > 0 && !isGenerating" class="candidates-section">
      <p class="text-sm font-medium mb-2" style="color: var(--el-text-color-primary)">
        ✨ 请从以下候选卷名中选择一个：
      </p>
      <div class="candidates-list space-y-2">
        <div
          v-for="(name, idx) in candidates"
          :key="idx"
          class="candidate-item p-3 border rounded-lg cursor-pointer transition-colors hover:bg-[var(--el-fill-color-light)]"
          style="border-color: var(--el-border-color)"
          :class="{ 'border-[var(--el-color-primary)] bg-[var(--el-color-primary-light-9)]': selectedIndex === idx }"
          @click="selectedIndex = idx"
        >
          <div class="flex items-center gap-2">
            <el-radio :model-value="selectedIndex" :label="idx" @click.stop="selectedIndex = idx" />
            <span class="text-base font-medium">{{ name }}</span>
            <el-tag v-if="idx === 0" size="small" type="success">推荐</el-tag>
          </div>
        </div>
      </div>
    </div>

    <p v-if="candidates.length === 0 && !isGenerating" class="text-center text-sm py-8" style="color: var(--el-text-color-placeholder)">
      暂无候选卷名，请点击"生成卷名"按钮
    </p>

    <!-- 底部按钮 -->
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button
          type="primary"
          :disabled="selectedIndex < 0 || isGenerating"
          @click="handleConfirm"
        >
          使用此卷名
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useProjectStore } from '@/stores/project'
import { useAgentStore } from '@/stores/agent'
import { useSettingsStore } from '@/stores/settings'
import type { ModelConfig } from '@/llm/types'
import ModelSelector from './ModelSelector.vue'

const props = defineProps<{
  visible: boolean
  /** 当前卷 ID */
  volumeId?: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  success: [title: string]
}>()

const projectStore = useProjectStore()
const agentStore = useAgentStore()
const settingsStore = useSettingsStore()

const isGenerating = ref(false)
const isFullscreen = ref(false)
const candidates = ref<string[]>([])
const selectedIndex = ref(-1)
const selectedModelId = ref('')
const selectedModelConfig = ref<ModelConfig | null>(null)

// 监听模型选择变化
function handleModelChange(modelConfig: ModelConfig): void {
  selectedModelConfig.value = modelConfig
  selectedModelId.value = modelConfig.id
}

async function handleGenerate(): Promise<void> {
  const project = projectStore.project
  if (!project) {
    ElMessage.warning('请先打开项目')
    return
  }

  const volume = props.volumeId
    ? project.volumes.find(v => v.id === props.volumeId)
    : project.volumes.find(v => v.id === projectStore.selectedVolumeId)

  if (!volume) {
    ElMessage.warning('请先选择卷')
    return
  }

  isGenerating.value = true
  candidates.value = []
  selectedIndex.value = -1

  try {
    const volumeIndex = project.volumes.findIndex(v => v.id === volume.id) + 1

    const worldSettings = project.worldSettings
      ? `类型：${project.worldSettings.genre}，基调：${project.worldSettings.tone}，规则：${project.worldSettings.rules}`
      : ''
    const characters = (project.characters || []).map(c => `${c.name} (${c.role})`).join('、')
    const existingTitles = project.volumes.map(v => v.title)

    const result = await agentStore.generateVolumeTitle(
      project.idea || '',
      worldSettings,
      characters,
      project.projectType || 'novel',
      volumeIndex,
      volume.content || '',
      existingTitles,
      {
        operationType: 'generateVolumeTitle',
        projectPath: project.path || '',
        promptTemplateName: 'volume-title-generate',
        inputParameters: { volumeIndex, volumeId: volume.id }
      },
      selectedModelConfig.value || undefined // 传递选中的模型配置
    )

    candidates.value = result
    if (candidates.value.length > 0) {
      selectedIndex.value = 0
      ElMessage.success(`生成了 ${candidates.value.length} 个候选卷名`)
    } else {
      ElMessage.warning('AI 未返回有效卷名，请重试')
    }
  } catch (error: any) {
    ElMessage.error('生成失败：' + (error.message || '未知错误'))
    console.error('[VolumeTitleGenerateDialog] 生成卷名失败：', error)
  } finally {
    isGenerating.value = false
  }
}

function handleConfirm(): void {
  if (selectedIndex.value < 0 || selectedIndex.value >= candidates.value.length) {
    ElMessage.warning('请先选择一个卷名')
    return
  }
  emit('success', candidates.value[selectedIndex.value])
  handleClose()
}

function handleClose(): void {
  emit('update:visible', false)
  isGenerating.value = false
  isFullscreen.value = false
  candidates.value = []
  selectedIndex.value = -1
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
.candidates-list .candidate-item {
  transition: all 0.15s;
}
</style>
