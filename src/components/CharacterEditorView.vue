<template>
  <div class="character-editor">
    <!-- 顶部导航栏 -->
    <div class="editor-header">
      <el-button text @click="handleBack">
        <el-icon><ArrowLeft /></el-icon>
        返回角色列表
      </el-button>
      <div class="header-title">
        <span class="avatar-large">{{ characterName.charAt(0) }}</span>
        <el-input
          v-model="characterName"
          class="name-input"
          size="large"
          placeholder="角色名称"
          @input="onFieldChange"
        />
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="handleSave">
          <el-icon><Check /></el-icon>
          完成
        </el-button>
      </div>
    </div>

    <div class="editor-body">
      <!-- 左侧：基本信息卡片 -->
      <div class="editor-left">
        <div class="card-section">
          <h3 class="section-title">基本信息</h3>
          <div class="basic-info-grid">
            <div class="info-field">
              <label>性别</label>
              <el-select v-model="editForm.gender" @change="onFieldChange" placeholder="请选择" style="width: 100%">
                <el-option label="男" value="male" />
                <el-option label="女" value="female" />
                <el-option label="其他" value="other" />
              </el-select>
            </div>
            <div class="info-field">
              <label>年龄</label>
              <el-input-number v-model="editForm.age" :min="0" :max="999" @change="onFieldChange" style="width: 100%" />
            </div>
            <div class="info-field">
              <label>角色定位</label>
              <el-select v-model="editForm.role" @change="onFieldChange" style="width: 100%">
                <el-option label="主角" value="protagonist" />
                <el-option label="反派" value="antagonist" />
                <el-option label="配角" value="supporting" />
                <el-option label="龙套" value="minor" />
              </el-select>
            </div>
          </div>
        </div>

        <!-- 综合描述 -->
        <div class="card-section">
          <h3 class="section-title">综合描述</h3>
          <p class="section-desc">角色的综合描述，将显示在角色列表卡片中</p>
          <el-input
            v-model="editForm.description"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 12 }"
            @input="onFieldChange"
            placeholder="输入角色的综合描述..."
          />
        </div>

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
              AI 补充
            </el-button>
          </div>
          <el-input
            v-model="editForm.appearance"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 15 }"
            @input="onFieldChange"
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
              AI 补充
            </el-button>
          </div>
          <el-input
            v-model="editForm.personality"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 15 }"
            @input="onFieldChange"
            placeholder="描述角色的性格特点..."
          />
        </div>
      </div>

      <!-- 右侧：深度属性 -->
      <div class="editor-right">
        <!-- 背景故事 -->
        <div class="card-section">
          <div class="section-header">
            <h3 class="section-title">
              <span class="title-icon">&#128214;</span>
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
            v-model="editForm.background"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 20 }"
            @input="onFieldChange"
            placeholder="角色的成长经历、重要事件..."
          />
        </div>

        <!-- 能力/技能 -->
        <div class="card-section">
          <div class="section-header">
            <h3 class="section-title">
              <span class="title-icon">&#9889;</span>
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
            v-model="editForm.abilities"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 15 }"
            @input="onFieldChange"
            placeholder="角色的特殊能力、技能..."
          />
        </div>

        <!-- 核心动机 -->
        <div class="card-section">
          <div class="section-header">
            <h3 class="section-title">
              <span class="title-icon">&#127919;</span>
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
            v-model="editForm.motivation"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 15 }"
            @input="onFieldChange"
            placeholder="角色的目标、欲望、驱动力..."
          />
        </div>

        <!-- 成长弧线 -->
        <div class="card-section">
          <div class="section-header">
            <h3 class="section-title">
              <span class="title-icon">&#128200;</span>
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
            v-model="editForm.arc"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 15 }"
            @input="onFieldChange"
            placeholder="角色在故事中的成长变化轨迹..."
          />
        </div>

        <!-- 对话风格 -->
        <div class="card-section">
          <div class="section-header">
            <h3 class="section-title">
              <span class="title-icon">&#128172;</span>
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
            v-model="editForm.dialogueStyle"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 15 }"
            @input="onFieldChange"
            placeholder="角色的说话方式、口头禅、语气特点..."
          />
        </div>

        <!-- 人物关系 -->
        <div class="card-section">
          <div class="section-header">
            <h3 class="section-title">
              <span class="title-icon">&#128101;</span>
              人物关系
            </h3>
          </div>
          <el-input
            v-model="editForm.relationships"
            type="textarea"
            :autosize="{ minRows: 3, maxRows: 15 }"
            @input="onFieldChange"
            placeholder="与其他角色的关系描述..."
          />
        </div>
      </div>
    </div>

    <!-- 单字段 AI 建议对话框 -->
    <el-dialog
      v-model="suggestionDialogVisible"
      :title="`AI 建议 - ${currentSuggestionField.label}`"
      width="800px"
      :close-on-click-modal="false"
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ArrowLeft, Check, MagicStick } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useProjectStore } from '@/stores/project'
import { useAgentStore } from '@/stores/agent'
import type { Character } from '@/stores/project'

const emit = defineEmits<{
  back: []
}>()

const projectStore = useProjectStore()
const agentStore = useAgentStore()

const props = defineProps<{
  characterId: string
}>()

// 编辑表单（本地副本，保存时写回 session）
const editForm = ref<{
  name: string
  gender?: 'male' | 'female' | 'other'
  age?: number
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor'
  appearance?: string
  personality?: string
  background?: string
  abilities?: string
  motivation?: string
  arc?: string
  dialogueStyle?: string
  relationships?: string
  description: string
}>({
  name: '',
  role: 'supporting',
  description: ''
})

// 单字段AI建议状态
const generatingField = ref('')
const suggestionDialogVisible = ref(false)
const currentSuggestionField = ref<{ key: string; label: string }>({ key: '', label: '' })
const currentSuggestions = ref<string[]>([])
const selectedSuggestionIndices = ref<number[]>([])

// 角色名称（双向绑定到 editForm）
const characterName = computed({
  get: () => editForm.value.name,
  set: (val: string) => { editForm.value.name = val }
})

// 从 session 中获取角色数据
const character = computed(() => {
  if (!projectStore.session) return null
  return projectStore.session.createdCharacters.find(c => c.id === props.characterId) || null
})

// 加载角色数据到编辑表单
onMounted(() => {
  if (character.value) {
    const c = character.value
    editForm.value = {
      name: c.name,
      gender: c.gender,
      age: c.age,
      role: c.role,
      appearance: c.appearance || '',
      personality: c.personality || '',
      background: c.background || '',
      abilities: c.abilities || '',
      motivation: c.motivation || '',
      arc: c.arc || '',
      dialogueStyle: c.dialogueStyle || '',
      relationships: (c as any).relationships || '',
      description: c.description || ''
    }
  }
})

// 字段变化时自动保存到 session
function onFieldChange(): void {
  if (!character.value) return
  const c = character.value
  c.name = editForm.value.name
  c.gender = editForm.value.gender
  c.age = editForm.value.age
  c.role = editForm.value.role
  c.appearance = editForm.value.appearance
  c.personality = editForm.value.personality
  c.background = editForm.value.background
  c.abilities = editForm.value.abilities
  c.motivation = editForm.value.motivation
  c.arc = editForm.value.arc
  c.dialogueStyle = editForm.value.dialogueStyle
  ;(c as any).relationships = editForm.value.relationships
  c.description = editForm.value.description
  projectStore.saveSession()
}

// 单字段 AI 生成建议
async function handleGenerateField(field: { key: string; label: string }): Promise<void> {
  if (!character.value) return
  const c = character.value
  generatingField.value = field.key

  try {
    const currentValue = (editForm.value as any)[field.key] || undefined
    const suggestions = await agentStore.generateFieldSuggestions(
      {
        name: editForm.value.name,
        appearance: editForm.value.appearance,
        personality: editForm.value.personality,
        background: editForm.value.background,
        description: editForm.value.description,
        role: editForm.value.role
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
  // 先关闭弹窗
  suggestionDialogVisible.value = false

  if (!character.value) return
  const fieldKey = currentSuggestionField.value.key

  const texts = selectedSuggestionIndices.value
    .map(idx => currentSuggestions.value[idx])
    .filter(Boolean)

  if (texts.length > 0) {
    ;(editForm.value as any)[fieldKey] = texts.join('\n')
    onFieldChange()
    ElMessage.success(`${currentSuggestionField.value.label}建议已应用`)
  }
}

// 保存并返回
function handleSave(): void {
  onFieldChange()
  ElMessage.success(`角色「${editForm.value.name}」已保存`)
  emit('back')
}

// 返回
function handleBack(): void {
  emit('back')
}
</script>

<style scoped>
.character-editor {
  min-height: 100%;
  background: var(--el-bg-color-page);
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  justify-content: center;
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

.name-input :deep(.el-input__inner) {
  font-size: 20px;
  font-weight: 600;
  text-align: center;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.editor-body {
  display: flex;
  gap: 24px;
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.editor-left {
  flex: 0 0 420px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.editor-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card-section {
  background: var(--el-bg-color);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--el-border-color-lighter);
  transition: box-shadow 0.2s;
}

.card-section:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-title {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.section-header .section-title {
  margin-bottom: 0;
}

.section-desc {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin: 0 0 12px 0;
}

.title-icon {
  font-size: 18px;
}

.basic-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
}

.info-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-field label {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-regular);
}

/* 建议弹窗样式 */
.suggestions-container {
  max-height: 450px;
  overflow-y: auto;
}

.suggestion-hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.suggestion-item {
  padding: 10px 12px;
  margin-bottom: 6px;
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  transition: background 0.2s;
  line-height: 1.6;
}

.suggestion-item:hover {
  background: var(--el-fill-color-light);
}

.suggestion-text {
  word-break: break-word;
  white-space: pre-wrap;
}

/* 响应式布局 */
@media (max-width: 1024px) {
  .editor-body {
    flex-direction: column;
  }

  .editor-left {
    flex: none;
    width: 100%;
  }

  .basic-info-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .editor-header {
    flex-wrap: wrap;
    gap: 12px;
  }

  .header-title {
    order: -1;
    flex-basis: 100%;
    flex-direction: column;
  }

  .name-input {
    max-width: 100%;
    width: 100%;
  }

  .editor-body {
    padding: 16px;
  }
}
</style>
