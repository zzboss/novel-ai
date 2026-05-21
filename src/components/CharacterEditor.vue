<template>
  <div class="character-editor h-full flex flex-col">
    <!-- 头部 -->
    <div class="p-4 border-b flex items-center justify-between" style="border-color: var(--el-border-color)">
      <h3 class="text-sm font-medium m-0">角色管理</h3>
      <div class="flex items-center gap-2">
        <span v-if="isSaving" class="text-xs text-[var(--el-color-primary)] flex items-center gap-1">
          <el-icon class="is-loading"><Loading /></el-icon>保存中...
        </span>
        <span v-else-if="lastSaved" class="text-xs text-[var(--el-text-color-placeholder)]">已保存 {{ lastSavedText }}</span>
        <el-button
          v-if="selectedCharacter"
          size="small"
          :icon="Delete"
          type="danger"
          plain
          @click="deleteCharacter(selectedCharacter.id, selectedCharacter.name)"
        >删除</el-button>
        <el-button
          type="primary"
          size="small"
          :loading="isSaving"
          :disabled="!projectStore.isDirty"
          @click="manualSave"
        >保存</el-button>
        <el-dropdown @command="handleAddCommand" trigger="click">
          <el-button type="primary" size="small" :icon="Plus">
            添加角色<el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="manual">
                <el-icon><EditPen /></el-icon>
                手动创建
              </el-dropdown-item>
              <el-dropdown-item command="assisted">
                <el-icon><MagicStick /></el-icon>
                AI辅助生成
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- 角色编辑区 -->
    <div class="flex-1 overflow-y-auto p-4">
      <el-empty v-if="!selectedCharacter" description="请选择角色" />
      
      <el-form v-else label-width="80px" size="small">
        <el-form-item label="角色名称">
          <el-input v-model="selectedCharacter.name" @input="onCharacterChange" />
        </el-form-item>
        <el-form-item label="性别">
          <el-select v-model="selectedCharacter.gender" @change="onCharacterChange" placeholder="请选择">
            <el-option label="男" value="male" />
            <el-option label="女" value="female" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="年龄">
          <el-input-number v-model="selectedCharacter.age" :min="0" :max="999" @change="onCharacterChange" />
        </el-form-item>
        <el-form-item label="角色定位">
          <el-select v-model="selectedCharacter.role" @change="onCharacterChange">
            <el-option label="主角" value="protagonist" />
            <el-option label="反派" value="antagonist" />
            <el-option label="配角" value="supporting" />
            <el-option label="龙套" value="minor" />
          </el-select>
        </el-form-item>
        <el-form-item label="外貌特征">
          <el-input
            v-model="selectedCharacter.appearance"
            type="textarea"
            :rows="2"
            @input="onCharacterChange"
          />
        </el-form-item>
        <el-form-item label="性格">
          <el-input
            v-model="selectedCharacter.personality"
            type="textarea"
            :rows="2"
            @input="onCharacterChange"
          />
        </el-form-item>
        <el-form-item label="背景故事">
          <el-input
            v-model="selectedCharacter.background"
            type="textarea"
            :rows="3"
            @input="onCharacterChange"
          />
        </el-form-item>
        <el-form-item label="能力/技能">
          <el-input
            v-model="selectedCharacter.abilities"
            type="textarea"
            :rows="2"
            @input="onCharacterChange"
          />
        </el-form-item>
        <el-form-item label="核心动机">
          <el-input
            v-model="selectedCharacter.motivation"
            type="textarea"
            :rows="2"
            @input="onCharacterChange"
          />
        </el-form-item>
        <el-form-item label="成长弧线">
          <el-input
            v-model="selectedCharacter.arc"
            type="textarea"
            :rows="2"
            @input="onCharacterChange"
          />
        </el-form-item>
        <el-form-item label="对话风格">
          <el-input
            v-model="selectedCharacter.dialogueStyle"
            type="textarea"
            :rows="2"
            @input="onCharacterChange"
          />
        </el-form-item>
        <el-form-item label="综合描述">
          <el-input
            v-model="selectedCharacter.description"
            type="textarea"
            :rows="3"
            @input="onCharacterChange"
            placeholder="角色的综合描述"
          />
        </el-form-item>
      </el-form>
    </div>

    <!-- AI辅助生成对话框 -->
    <CharacterGenerateDialog
      v-model:visible="generateDialogVisible"
      :project-type="projectStore.project?.projectType || 'novel'"
      :project-context="{
        idea: projectStore.project?.idea || '',
        worldSettings: projectStore.project?.worldSettings || {},
        characters: projectStore.project?.characters?.filter(c => c.id !== props.characterId) || []
      }"
      @success="handleGenerateSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Plus, Delete, ArrowDown, EditPen, MagicStick, Loading } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useProjectStore } from '@/stores/project'
import CharacterGenerateDialog from './CharacterGenerateDialog.vue'

const props = defineProps<{
  characterId: string
}>()

const emit = defineEmits<{
  'update:characterId': [value: string]
}>()

const projectStore = useProjectStore()
const generateDialogVisible = ref(false)
const isSaving = ref(false)
const lastSaved = ref(false)
const lastSavedText = ref('')

const roleLabels: Record<string, string> = {
  protagonist: '主角',
  antagonist: '反派',
  supporting: '配角',
  minor: '龙套'
}

const selectedCharacter = computed(() => {
  if (!projectStore.project || !props.characterId) return null
  return projectStore.project.characters.find(c => c.id === props.characterId) || null
})

function addCharacter(): void {
  if (!projectStore.project) {
    ElMessage.warning('请先创建或打开项目')
    return
  }

  const id = `char-${Date.now()}`
  projectStore.project.characters.push({
    id,
    name: '新角色',
    role: 'supporting',
    description: ''
  })

  emit('update:characterId', id)
  projectStore.markDirty()
  ElMessage.success('角色已添加')
}

function handleAddCommand(command: string): void {
  if (command === 'manual') {
    addCharacter()
  } else if (command === 'assisted') {
    generateDialogVisible.value = true
  }
}

function handleGenerateSuccess(character: any): void {
  if (!projectStore.project) return
  
  projectStore.project.characters.push(character)
  emit('update:characterId', character.id)
  projectStore.markDirty()
  ElMessage.success(`角色「${character.name}」已添加`)
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

    if (projectStore.project) {
      const index = projectStore.project.characters.findIndex(c => c.id === id)
      if (index !== -1) {
        projectStore.project.characters.splice(index, 1)
        projectStore.markDirty()

        if (props.characterId === id) {
          emit('update:characterId', '')
        }

        ElMessage.success('角色已删除')
      }
    }
  } catch {
    // 用户取消
  }
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
    console.error('[CharacterEditor] 保存失败:', error)
    ElMessage.error('保存失败，请重试')
  } finally {
    isSaving.value = false
  }
}

function onCharacterChange(): void {
  projectStore.markDirty()
}
</script>
