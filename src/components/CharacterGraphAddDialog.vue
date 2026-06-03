<template>
  <el-dialog
    v-model="visible"
    title="添加角色"
    width="750px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <div class="add-character-dialog-body">
      <!-- 顶部：头像 + 姓名 + AI生成按钮 -->
      <div class="dialog-header">
        <span class="avatar-large">{{ form.name.charAt(0) || '?' }}</span>
        <el-input
          v-model="form.name"
          class="name-input"
          size="large"
          placeholder="角色名称"
        />
        <el-button
          type="primary"
          plain
          :loading="false"
          @click="generateDialogVisible = true"
        >
          <el-icon><MagicStick /></el-icon>
          AI 辅助生成
        </el-button>
      </div>

      <div class="dialog-body">
        <!-- 左侧：基本信息 + 综合描述 -->
        <div class="dialog-left">
          <div class="card-section">
            <h3 class="section-title">基本信息</h3>
            <div class="basic-info-grid">
              <div class="info-field">
                <label>性别</label>
                <el-select v-model="form.gender" placeholder="请选择" style="width: 100%">
                  <el-option label="男" value="male" />
                  <el-option label="女" value="female" />
                  <el-option label="其他" value="other" />
                </el-select>
              </div>
              <div class="info-field">
                <label>年龄</label>
                <el-input-number v-model="form.age" :min="0" :max="999" style="width: 100%" />
              </div>
              <div class="info-field">
                <label>角色定位</label>
                <el-select v-model="form.role" style="width: 100%">
                  <el-option label="主角" value="protagonist" />
                  <el-option label="反派" value="antagonist" />
                  <el-option label="配角" value="supporting" />
                  <el-option label="龙套" value="minor" />
                </el-select>
              </div>
            </div>
          </div>

          <div class="card-section">
            <h3 class="section-title">综合描述</h3>
            <p class="section-desc">角色的综合描述，将显示在角色列表卡片中</p>
            <el-input
              v-model="form.description"
              type="textarea"
              :autosize="{ minRows: 3, maxRows: 8 }"
              placeholder="输入角色的综合描述..."
            />
          </div>
        </div>

        <!-- 右侧：外貌、性格等 -->
        <div class="dialog-right">
          <!-- 外貌特征 -->
          <div class="card-section">
            <div class="section-header">
              <h3 class="section-title">外貌特征</h3>
              <el-button
                type="primary"
                plain
                size="small"
                :loading="generatingField === 'appearance'"
                @click="handleGenerateField({ key: 'appearance', label: '外貌特征' })"
              >
                <el-icon><MagicStick /></el-icon>
                AI 生成
              </el-button>
            </div>
            <el-input
              v-model="form.appearance"
              type="textarea"
              :autosize="{ minRows: 3, maxRows: 10 }"
              placeholder="描述角色的外貌特征..."
            />
          </div>

          <!-- 性格特点 -->
          <div class="card-section">
            <div class="section-header">
              <h3 class="section-title">性格特点</h3>
              <el-button
                type="primary"
                plain
                size="small"
                :loading="generatingField === 'personality'"
                @click="handleGenerateField({ key: 'personality', label: '性格特点' })"
              >
                <el-icon><MagicStick /></el-icon>
                AI 生成
              </el-button>
            </div>
            <el-input
              v-model="form.personality"
              type="textarea"
              :autosize="{ minRows: 3, maxRows: 10 }"
              placeholder="描述角色的性格特点..."
            />
          </div>

          <!-- 背景故事 -->
          <div class="card-section">
            <div class="section-header">
              <h3 class="section-title">
                <span class="title-icon">📖</span>
                背景故事
              </h3>
              <el-button
                type="primary"
                plain
                size="small"
                :loading="generatingField === 'background'"
                @click="handleGenerateField({ key: 'background', label: '背景故事' })"
              >
                <el-icon><MagicStick /></el-icon>
                AI 生成
              </el-button>
            </div>
            <el-input
              v-model="form.background"
              type="textarea"
              :autosize="{ minRows: 3, maxRows: 10 }"
              placeholder="角色的成长经历、重要事件..."
            />
          </div>

          <!-- 能力/技能 -->
          <div class="card-section">
            <div class="section-header">
              <h3 class="section-title">
                <span class="title-icon">⚡</span>
                能力/技能
              </h3>
              <el-button
                type="primary"
                plain
                size="small"
                :loading="generatingField === 'abilities'"
                @click="handleGenerateField({ key: 'abilities', label: '能力/技能' })"
              >
                <el-icon><MagicStick /></el-icon>
                AI 生成
              </el-button>
            </div>
            <el-input
              v-model="form.abilities"
              type="textarea"
              :autosize="{ minRows: 3, maxRows: 10 }"
              placeholder="角色的特殊能力、技能..."
            />
          </div>

          <!-- 核心动机 -->
          <div class="card-section">
            <div class="section-header">
              <h3 class="section-title">
                <span class="title-icon">🎯</span>
                核心动机
              </h3>
              <el-button
                type="primary"
                plain
                size="small"
                :loading="generatingField === 'motivation'"
                @click="handleGenerateField({ key: 'motivation', label: '核心动机' })"
              >
                <el-icon><MagicStick /></el-icon>
                AI 生成
              </el-button>
            </div>
            <el-input
              v-model="form.motivation"
              type="textarea"
              :autosize="{ minRows: 3, maxRows: 10 }"
              placeholder="角色的目标、欲望、驱动力..."
            />
          </div>

          <!-- 成长弧线 -->
          <div class="card-section">
            <div class="section-header">
              <h3 class="section-title">
                <span class="title-icon">📈</span>
                成长弧线
              </h3>
              <el-button
                type="primary"
                plain
                size="small"
                :loading="generatingField === 'arc'"
                @click="handleGenerateField({ key: 'arc', label: '成长弧线' })"
              >
                <el-icon><MagicStick /></el-icon>
                AI 生成
              </el-button>
            </div>
            <el-input
              v-model="form.arc"
              type="textarea"
              :autosize="{ minRows: 3, maxRows: 10 }"
              placeholder="角色在故事中的成长变化轨迹..."
            />
          </div>

          <!-- 对话风格 -->
          <div class="card-section">
            <div class="section-header">
              <h3 class="section-title">
                <span class="title-icon">💬</span>
                对话风格
              </h3>
              <el-button
                type="primary"
                plain
                size="small"
                :loading="generatingField === 'dialogueStyle'"
                @click="handleGenerateField({ key: 'dialogueStyle', label: '对话风格' })"
              >
                <el-icon><MagicStick /></el-icon>
                AI 生成
              </el-button>
            </div>
            <el-input
              v-model="form.dialogueStyle"
              type="textarea"
              :autosize="{ minRows: 3, maxRows: 10 }"
              placeholder="角色的说话方式、口头禅、语气特点..."
            />
          </div>

          <!-- 人物关系 -->
          <div class="card-section">
            <div class="section-header">
              <h3 class="section-title">
                <span class="title-icon">👥</span>
                人物关系
              </h3>
            </div>
            <el-input
              v-model="form.relationships"
              type="textarea"
              :autosize="{ minRows: 3, maxRows: 10 }"
              placeholder="与其他角色的关系描述..."
            />
          </div>
        </div>
      </div>
    </div>

    <!-- AI 建议对话框 -->
    <el-dialog
      v-model="suggestionDialogVisible"
      :title="`AI 建议 - ${currentSuggestionField.label}`"
      width="800px"
      :close-on-click-modal="false"
      append-to-body
    >
      <div class="suggestions-container">
        <p class="suggestion-hint">可多选，选中项将追加到当前属性值末尾</p>
        <el-checkbox-group v-model="selectedSuggestionIndices">
          <div
            v-for="(suggestion, idx) in currentSuggestions"
            :key="idx"
            class="suggestion-item"
          >
            <el-checkbox :label="idx">
              <span class="suggestion-text">{{ suggestion }}</span>
            </el-checkbox>
          </div>
        </el-checkbox-group>
        <el-empty
          v-if="currentSuggestions.length === 0"
          description="未生成建议"
          :image-size="60"
        />
      </div>
      <template #footer>
        <el-button @click="suggestionDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="applySuggestions">应用选中建议</el-button>
      </template>
    </el-dialog>

    <!-- AI 辅助生成对话框 -->
    <CharacterGenerateDialog
      v-model:visible="generateDialogVisible"
      :project-type="projectType"
      :project-context="projectContext"
      @success="handleGenerateSuccess"
    />

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { MagicStick } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useAgentStore } from '@/stores/agent'
import { useProjectStore } from '@/stores/project'
import type { Character } from '@/stores/project'
import CharacterGenerateDialog from './CharacterGenerateDialog.vue'

const props = defineProps<{
  projectPath: string
  graphId: string
}>()

const emit = defineEmits<{
  (e: 'success', character: Character, nodeData: any): void
}>()

const visible = defineModel<boolean>('visible', { default: false })
const agentStore = useAgentStore()
const projectStore = useProjectStore()

const saving = ref(false)

// AI 生成对话框
const generateDialogVisible = ref(false)

// 项目类型和上下文（用于 AI 生成）
const projectType = computed(() => projectStore.project?.projectType || 'novel')
const projectContext = computed(() => {
  const project = projectStore.project
  if (!project) return undefined
  return {
    idea: project.idea || '',
    worldSettings: project.worldSettings || undefined,
    characters: project.characters?.filter(c => c.id !== (form as any).id) || []
  }
})

// AI 生成相关状态
const generatingField = ref('')
const suggestionDialogVisible = ref(false)
const currentSuggestionField = ref<{ key: string; label: string }>({ key: '', label: '' })
const currentSuggestions = ref<string[]>([])
const selectedSuggestionIndices = ref<number[]>([])

const form = reactive({
  name: '',
  gender: undefined as 'male' | 'female' | 'other' | undefined,
  age: undefined as number | undefined,
  role: 'supporting' as 'protagonist' | 'antagonist' | 'supporting' | 'minor',
  description: '',
  appearance: '',
  personality: '',
  background: '',
  abilities: '',
  motivation: '',
  arc: '',
  dialogueStyle: '',
  relationships: ''
})

function handleClose() {
  visible.value = false
}

// AI 生成字段建议
async function handleGenerateField(field: { key: string; label: string }): Promise<void> {
  generatingField.value = field.key

  try {
    const currentValue = (form as any)[field.key] || undefined
    const suggestions = await agentStore.generateFieldSuggestions(
      {
        name: form.name,
        appearance: form.appearance,
        personality: form.personality,
        background: form.background,
        description: form.description,
        role: form.role
      },
      field.key,
      field.label,
      currentValue
    )

    currentSuggestionField.value = field
    currentSuggestions.value = suggestions
    selectedSuggestionIndices.value = suggestions.length > 0 ? [0] : []
    suggestionDialogVisible.value = true
  } catch (error) {
    console.error(`生成${field.label}建议失败：`, error)
    ElMessage.error(`生成${field.label}建议失败，请重试`)
  } finally {
    generatingField.value = ''
  }
}

// 应用选中的建议
function applySuggestions(): void {
  suggestionDialogVisible.value = false

  const fieldKey = currentSuggestionField.value.key
  const texts = selectedSuggestionIndices.value
    .map(idx => currentSuggestions.value[idx])
    .filter(Boolean)

  if (texts.length > 0) {
    ;(form as any)[fieldKey] = texts.join('\n')
    ElMessage.success(`${currentSuggestionField.value.label}建议已应用`)
  }
}

async function handleSave() {
  if (!form.name.trim()) {
    ElMessage.warning('请输入角色名称')
    return
  }

  saving.value = true
  try {
    const character: Character = {
      id: `char-${Date.now()}`,
      name: form.name.trim(),
      gender: form.gender,
      age: form.age,
      role: form.role,
      appearance: form.appearance || undefined,
      personality: form.personality || undefined,
      background: form.background || undefined,
      abilities: form.abilities || undefined,
      motivation: form.motivation || undefined,
      arc: form.arc || undefined,
      dialogueStyle: form.dialogueStyle || undefined,
      relationships: (form.relationships as any) || undefined,
      description: form.description || ''
    }

    emit('success', character, {
      characterId: character.id,
      name: character.name,
      role: character.role,
      color: getColorByRole(character.role)
    })
    visible.value = false
  } finally {
    saving.value = false
  }
}

function getColorByRole(role: string): string {
  const colorMap: Record<string, string> = {
    'protagonist': '#FFD700',
    'antagonist': '#DC143C',
    'supporting': '#4169E1',
    'minor': '#808080'
  }
  return colorMap[role] || '#409EFF'
}

// AI 生成成功回调
function handleGenerateSuccess(character: any): void {
  if (!character) return
  
  // 填充表单
  form.name = character.name || ''
  form.gender = character.gender
  form.role = character.role || 'supporting'
  form.age = character.age
  form.appearance = character.appearance || ''
  form.personality = character.personality || ''
  form.background = character.background || ''
  form.abilities = character.abilities || ''
  form.motivation = character.motivation || ''
  form.arc = character.arc || ''
  form.dialogueStyle = character.dialogueStyle || ''
  form.relationships = character.relationships || ''
  form.description = character.description || ''
  
  ElMessage.success('AI 生成内容已填充到表单，可继续编辑')
}
</script>

<style scoped>
.add-character-dialog-body {
  max-height: 60vh;
  overflow-y: auto;
}

.dialog-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.avatar-large {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7C3AED, #6D28D9);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: bold;
  flex-shrink: 0;
}

.name-input {
  max-width: 300px;
}

.dialog-body {
  display: flex;
  gap: 16px;
}

.dialog-left {
  flex: 0 0 320px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dialog-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-section {
  background: var(--el-bg-color);
  border-radius: 8px;
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.section-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.title-icon {
  margin-right: 4px;
}

.section-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin: 0 0 8px 0;
}

.basic-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
}

.info-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-field label {
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-regular);
}

/* AI 建议对话框样式 */
.suggestions-container {
  max-height: 50vh;
  overflow-y: auto;
}

.suggestion-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin: 0 0 12px 0;
}

.suggestion-item {
  padding: 8px;
  border-radius: 6px;
  margin-bottom: 4px;
  border: 1px solid var(--el-border-color-lighter);
  transition: background-color 0.2s;
}

.suggestion-item:hover {
  background-color: var(--el-fill-color-light);
}

.suggestion-text {
  white-space: pre-wrap;
  line-height: 1.6;
}

@media (max-width: 700px) {
  .dialog-body {
    flex-direction: column;
  }
  .dialog-left {
    flex: none;
    width: 100%;
  }
}
</style>
