<template>
  <div class="world-editor h-full flex flex-col">
    <!-- 头部 -->
    <div class="p-4 border-b flex items-center justify-between" style="border-color: var(--el-border-color)">
      <h3 class="text-sm font-medium m-0">世界观设定</h3>
      <div class="flex items-center gap-2">
        <el-button
          size="small"
          type="primary"
          @click="showGenerateDialog = true"
        >AI 生成</el-button>
        <span v-if="isSaving" class="text-xs text-[var(--el-color-primary)] flex items-center gap-1">
          <el-icon class="is-loading"><Loading /></el-icon>保存中...
        </span>
        <span v-else-if="lastSaved" class="text-xs text-[var(--el-text-color-placeholder)]">已保存 {{ lastSavedText }}</span>
        <el-button
          type="primary"
          size="small"
          :loading="isSaving"
          :disabled="!projectStore.isDirty"
          @click="manualSave"
        >保存</el-button>
      </div>
    </div>

    <!-- 编辑区 -->
    <div v-if="worldSettingsReady" class="flex-1 overflow-y-auto p-4">
      <el-form label-width="100px" size="small">
        <el-form-item label="小说类型">
          <el-input
            :model-value="worldSettingsReady ? projectStore.project!.worldSettings.genre : ''"
            placeholder="例如：奇幻、都市、科幻"
            @input="onFieldChange('genre', $event)"
          />
        </el-form-item>

        <el-form-item label="故事基调">
          <el-input
            :model-value="projectStore.project!.worldSettings.tone"
            placeholder="例如：轻松、严肃、黑暗"
            @input="onFieldChange('tone', $event)"
          />
        </el-form-item>

        <el-form-item label="世界观规则">
          <el-input
            :model-value="projectStore.project!.worldSettings.rules"
            type="textarea"
            :rows="15"
            placeholder="描述世界观的基本规则，如修炼体系、魔法系统等"
            @input="onFieldChange('rules', $event)"
          />
        </el-form-item>

        <el-form-item label="重要地点">
          <div class="space-y-2">
            <div
              v-for="(loc, idx) in projectStore.project!.worldSettings.locations"
              :key="idx"
              class="flex items-center gap-2"
            >
              <el-input
                :model-value="loc"
                placeholder="地点名称"
                class="flex-1"
                @input="(val: string) => updateLocation(idx, val)"
              />
              <el-button
                type="danger"
                :icon="Delete"
                circle
                size="small"
                @click="removeLocation(idx)"
              />
            </div>

            <el-button
              size="small"
              :icon="Plus"
              @click="addLocation"
            >
              添加地点
            </el-button>
          </div>
        </el-form-item>
      </el-form>
    </div>

    <div v-else class="flex-1 flex items-center justify-center">
      <el-empty description="请先创建或打开项目" />
    </div>

    <!-- AI 生成对话框 -->
    <WorldGenerateDialog
      v-model:visible="showGenerateDialog"
      :current-content="worldSettingsContent"
      :project-type="projectStore.project?.projectType || 'novel'"
      :idea="projectStore.project?.idea || ''"
      @success="handleGenerateSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Plus, Delete, Loading } from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import { ElMessage } from 'element-plus'
import type { WorldSettings } from '@/types/project'
import WorldGenerateDialog from './WorldGenerateDialog.vue'

const projectStore = useProjectStore()

// 状态
const showGenerateDialog = ref(false)
const isSaving = ref(false)
const lastSaved = ref(false)
const lastSavedText = ref('')

/** 安全的 worldSettings 访问，若为 null/undefined 则初始化 */
const worldSettingsReady = computed(() => {
  return !!projectStore.project?.worldSettings
})

/** 确保 worldSettings 已初始化 */
function ensureWorldSettings(): WorldSettings {
  if (!projectStore.project) throw new Error('项目未加载')
  if (!projectStore.project.worldSettings) {
    projectStore.project.worldSettings = {
      genre: '',
      tone: '',
      rules: '',
      locations: []
    }
    projectStore.markDirty()
  }
  return projectStore.project.worldSettings
}

async function manualSave(): Promise<void> {
  isSaving.value = true
  try {
    await projectStore.saveProject()
    lastSaved.value = true
    lastSavedText.value = '刚刚'
    setTimeout(() => { lastSaved.value = false }, 3000)
    ElMessage.success('保存成功')
  } catch (error) {
    console.error('[WorldEditor] 保存失败:', error)
    ElMessage.error('保存失败，请重试')
  } finally {
    isSaving.value = false
  }
}

/** 将世界观设定转换为字符串（用于 AI 修改） */
const worldSettingsContent = computed(() => {
  if (!projectStore.project?.worldSettings) return ''
  const ws = projectStore.project.worldSettings
  return [
    `世界类型：${ws.genre || '未设置'}`,
    `故事基调：${ws.tone || '未设置'}`,
    `世界观规则：${ws.rules || '未设置'}`,
    `重要地点：${ws.locations?.filter(Boolean).join('、') || '未设置'}`
  ].join('\n')
})

/** 处理 AI 生成/修改成功 */
function handleGenerateSuccess(content: string): void {
  const ws = ensureWorldSettings()
  // 将生成的内容更新到 rules 字段（AI 生成的完整世界观内容）
  ws.rules = content
  projectStore.markDirty()
  ElMessage.success('世界观已更新')
}

/** 通用字段更新（避免 v-model 直接绑定深层属性） */
function onFieldChange(field: keyof WorldSettings, val: string): void {
  const ws = ensureWorldSettings()
  ;(ws as any)[field] = val
  projectStore.markDirty()
}

function addLocation(): void {
  const ws = ensureWorldSettings()
  ws.locations.push('')
  projectStore.markDirty()
}

function updateLocation(idx: number, val: string): void {
  const ws = ensureWorldSettings()
  ws.locations[idx] = val
  projectStore.markDirty()
}

function removeLocation(idx: number): void {
  const ws = ensureWorldSettings()
  ws.locations.splice(idx, 1)
  projectStore.markDirty()
}

onMounted(() => {
  // 如果项目已加载但 worldSettings 未初始化，则自动初始化
  if (projectStore.project && !projectStore.project.worldSettings) {
    projectStore.project.worldSettings = {
      genre: '',
      tone: '',
      rules: '',
      locations: []
    }
    projectStore.markDirty()
  }
})
</script>
