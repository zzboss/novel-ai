<template>
  <div class="character-step">
    <!-- 模式一：角色列表概览 -->
    <div v-if="!editingCharacterId" class="list-mode">
      <h2>角色设定</h2>
      <p class="step-description">
        使用 AI 辅助生成角色，点击角色卡片进入详细编辑。
      </p>

      <!-- 角色列表 -->
      <div v-if="createdCharacters.length > 0" class="character-list">
        <h3>已创建的角色 ({{ createdCharacters.length }})</h3>
        <div class="character-cards">
          <div
            v-for="character in createdCharacters"
            :key="character.id"
            class="character-card"
            @click="openEditor(character.id)"
          >
            <div class="card-header">
              <div class="character-avatar" :style="getAvatarStyle(character.role)">
                {{ character.name.charAt(0) }}
              </div>
              <div class="character-info">
                <div class="character-name">{{ character.name }}</div>
                <div class="character-meta">
                  <span class="character-role">{{ roleLabels[character.role] || character.role }}</span>
                  <span v-if="character.gender" class="character-gender">{{ genderLabels[character.gender] }}</span>
                  <span v-if="character.age" class="character-age">{{ character.age }}岁</span>
                </div>
              </div>
              <div class="card-actions" @click.stop>
                <el-button
                  type="primary"
                  plain
                  size="small"
                  @click.stop="openEditor(character.id)"
                >
                  <el-icon><Edit /></el-icon>
                  编辑
                </el-button>
                <el-button
                  type="danger"
                  :icon="Delete"
                  circle
                  size="small"
                  @click.stop="deleteCharacter(character.id, character.name)"
                />
              </div>
            </div>
            <!-- 角色属性预览 -->
            <div class="card-props">
              <div v-if="character.appearance" class="prop-tag">
                <span class="prop-label">外貌</span>
                <span class="prop-value">{{ truncate(character.appearance, 60) }}</span>
              </div>
              <div v-if="character.personality" class="prop-tag">
                <span class="prop-label">性格</span>
                <span class="prop-value">{{ truncate(character.personality, 60) }}</span>
              </div>
              <div v-if="character.background" class="prop-tag">
                <span class="prop-label">背景</span>
                <span class="prop-value">{{ truncate(character.background, 60) }}</span>
              </div>
              <div v-if="character.abilities" class="prop-tag">
                <span class="prop-label">能力</span>
                <span class="prop-value">{{ truncate(character.abilities, 60) }}</span>
              </div>
              <div v-if="character.motivation" class="prop-tag">
                <span class="prop-label">动机</span>
                <span class="prop-value">{{ truncate(character.motivation, 60) }}</span>
              </div>
              <div v-if="character.arc" class="prop-tag">
                <span class="prop-label">弧线</span>
                <span class="prop-value">{{ truncate(character.arc, 60) }}</span>
              </div>
              <div v-if="character.dialogueStyle" class="prop-tag">
                <span class="prop-label">对话</span>
                <span class="prop-value">{{ truncate(character.dialogueStyle, 60) }}</span>
              </div>
            </div>
            <p v-if="character.description" class="character-desc">{{ character.description }}</p>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <el-empty
        v-if="createdCharacters.length === 0"
        description="暂无角色，请添加角色"
        :image-size="100"
      />

      <!-- 添加角色按钮 -->
      <div class="add-character-section">
        <el-button
          type="primary"
          size="large"
          @click="generateDialogVisible = true"
        >
          <el-icon><Plus /></el-icon>
          AI 生成角色
        </el-button>
      </div>

      <!-- AI 辅助生成对话框 -->
      <CharacterGenerateDialog
        v-model:visible="generateDialogVisible"
        :project-type="projectStore.session?.projectType || ProjectType.NOVEL"
        :project-context="{
          idea: projectStore.session?.steps['idea']?.content || '',
          worldSettings: projectStore.session?.steps['world']?.content
            ? { summary: projectStore.session.steps['world'].content }
            : {},
          characters: projectStore.session?.createdCharacters || []
        }"
        @success="handleGenerateSuccess"
      />

      <!-- 步骤操作 -->
      <div class="step-actions">
        <el-button @click="handlePrev">上一步</el-button>
        <el-button type="warning" plain @click="handleSkip">跳过此步骤</el-button>
        <el-button
          type="primary"
          :disabled="createdCharacters.length === 0"
          @click="handleNext"
        >
          下一步
        </el-button>
      </div>
    </div>

    <!-- 模式二：角色编辑视图 -->
    <CharacterEditorView
      v-else
      :character-id="editingCharacterId"
      @back="editingCharacterId = ''"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Plus, Delete, Edit } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useProjectStore } from '@/stores/project'
import { type ProjectType } from '@/stores/project'
import CharacterGenerateDialog from './CharacterGenerateDialog.vue'
import CharacterEditorView from './CharacterEditorView.vue'
import type { Character } from '@/stores/project'

const projectStore = useProjectStore()

const editingCharacterId = ref('')
const generateDialogVisible = ref(false)

const roleLabels: Record<string, string> = {
  protagonist: '主角',
  antagonist: '反派',
  supporting: '配角',
  minor: '龙套'
}

const genderLabels: Record<string, string> = {
  male: '男',
  female: '女',
  other: '其他'
}

// 从 session 中读取角色列表
const createdCharacters = computed(() => {
  return projectStore.session?.createdCharacters || []
})

// 根据角色定位返回头像渐变色
function getAvatarStyle(role?: string): Record<string, string> {
  const gradients: Record<string, string> = {
    protagonist: 'linear-gradient(135deg, #F59E0B, #D97706)',
    antagonist: 'linear-gradient(135deg, #EF4444, #DC2626)',
    supporting: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
    minor: 'linear-gradient(135deg, #6B7280, #4B5563)'
  }
  return {
    background: gradients[role || 'supporting'] || gradients.supporting
  }
}

// 截断文本
function truncate(text: string, maxLen: number): string {
  if (!text || text.length <= maxLen) return text || ''
  return text.slice(0, maxLen) + '...'
}

function openEditor(id: string): void {
  editingCharacterId.value = id
}

async function deleteCharacter(id: string, name: string): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定要删除角色「${name}」吗？`,
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    if (projectStore.session) {
      const index = projectStore.session.createdCharacters.findIndex(c => c.id === id)
      if (index !== -1) {
        projectStore.session.createdCharacters.splice(index, 1)
        saveToSession()
        ElMessage.success('角色已删除')
      }
    }
  } catch {
    // 用户取消
  }
}

function saveToSession(): void {
  if (!projectStore.session) return
  projectStore.session.updatedAt = Date.now()
  projectStore.saveSession()
}

function handleGenerateSuccess(character: Character): void {
  if (!projectStore.session) return

  projectStore.session.createdCharacters.push(character)
  saveToSession()
  generateDialogVisible.value = false

  // 生成后自动进入编辑页面
  editingCharacterId.value = character.id
  ElMessage.success(`角色「${character.name}」已添加，可继续编辑`)
}

function handlePrev(): void {
  projectStore.goToPrevStep()
}

function handleSkip(): void {
  projectStore.skipCurrentStep()
}

function handleNext(): void {
  if (projectStore.session) {
    const characterContent = createdCharacters.value.map(c =>
      `【${c.name}】(${c.role})\n${c.description || ''}`
    ).join('\n\n')

    projectStore.updateStepState('character', {
      mode: 'manual',
      content: characterContent,
      status: 'completed'
    })
  }

  projectStore.completeCurrentStep()
}

onMounted(() => {
  if (createdCharacters.value.length > 0 && !editingCharacterId.value) {
    // 不再自动选中第一个角色，保持在列表模式
  }
})
</script>

<style scoped>
.character-step {
  max-width: 1100px;
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

.character-list {
  margin-bottom: 30px;
}

.character-list h3 {
  margin-bottom: 16px;
  color: var(--el-text-color-primary);
}

.character-cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.character-card {
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--el-bg-color);
}

.character-card:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 12px;
}

.character-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: bold;
  flex-shrink: 0;
}

.character-info {
  flex: 1;
}

.character-name {
  font-weight: 600;
  font-size: 16px;
  color: var(--el-text-color-primary);
}

.character-meta {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.character-role {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 4px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
}

.character-gender,
.character-age {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}

.card-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

/* 角色属性预览标签 */
.card-props {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.prop-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  font-size: 12px;
  max-width: 320px;
}

.prop-label {
  color: var(--el-text-color-secondary);
  white-space: nowrap;
  font-weight: 500;
}

.prop-value {
  color: var(--el-text-color-regular);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.character-desc {
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
  padding-top: 10px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.add-character-section {
  display: flex;
  justify-content: center;
  margin: 30px 0;
}

.step-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid var(--el-border-color);
}
</style>
