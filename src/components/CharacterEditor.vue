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

    <!-- 主内容区：角色详情/关系图 -->
    <div class="flex-1 overflow-y-auto p-4">
        <el-empty v-if="!selectedCharacter" description="请选择角色" />
        
        <template v-else>
          <!-- 角色基本信息表单 -->
          <el-form label-width="80px" size="small" class="mb-6">
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
        </template>
      </div>

    <!-- 关系编辑器对话框 -->
    <CharacterGraphEdgeEditor
      v-model="edgeEditorVisible"
      :edge="editingEdge"
      :node-options="nodeOptions"
      @confirm="handleEdgeEditorConfirm"
    />

    <!-- AI辅助生成对话框 -->
    <CharacterGenerateDialog
      v-model:visible="generateDialogVisible"
      :project-type="projectStore.project?.projectType || 'novel'"
      :project-context="{
        idea: projectStore.project?.idea || '',
        worldSettings: projectStore.project?.worldSettings,
        characters: projectStore.project?.characters?.filter(c => c.id !== selectedCharacterId) || []
      }"
      @success="handleGenerateSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Plus, Delete, ArrowDown, EditPen, MagicStick, Loading } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useProjectStore } from '@/stores/project'
import { useCharacterGraphStore } from '@/stores/characterGraphStore'
import CharacterGenerateDialog from './CharacterGenerateDialog.vue'
import CharacterGraphEdgeEditor from './CharacterGraphEdgeEditor.vue'
import type { CharacterEdge } from '@/types/character-graph'

const props = defineProps<{
  characterId: string
}>()

const emit = defineEmits<{
  'update:characterId': [value: string]
}>()

const projectStore = useProjectStore()
const graphStore = useCharacterGraphStore()
const generateDialogVisible = ref(false)
const isSaving = ref(false)
const lastSaved = ref(false)
const lastSavedText = ref('')

// 关系编辑器
const edgeEditorVisible = ref(false)
const editingEdge = ref<CharacterEdge | undefined>(undefined)
const selectedCharacterId = computed(() => props.characterId)

// 当前选中的角色
const selectedCharacter = computed(() => {
  if (!projectStore.project || !selectedCharacterId.value) return null
  return projectStore.project.characters.find((c: import('@/types/project').Character) => c.id === selectedCharacterId.value) || null
})

// 角色关系图节点选项（用于添加关系时选择）
const nodeOptions = computed(() => {
  if (!projectStore.project) return []
  return projectStore.project.characters.map(c => ({
    id: c.id,
    name: c.name || '未命名',
    role: c.role || 'supporting'
  }))
})

// 加载角色关系图
onMounted(async () => {
  if (projectStore.project?.path && projectStore.project?.id) {
    try {
      await graphStore.loadGraph(projectStore.project.path, projectStore.project.id)
    } catch (error) {
      console.warn('[CharacterEditor] 加载角色关系图失败:', error)
    }
  }
})

// 关系编辑器确认
async function handleEdgeEditorConfirm(data: any) {
  if (!projectStore.project?.path || !graphStore.currentGraph || !selectedCharacterId.value) return
  
  try {
    if (editingEdge.value) {
      // 更新关系
      await graphStore.updateEdge(
        projectStore.project.path,
        editingEdge.value.id,
        graphStore.currentGraph.id,
        data
      )
      ElMessage.success('关系已更新')
    } else {
      // 添加关系（默认以当前角色为源）
      await graphStore.addEdge(
        projectStore.project.path,
        graphStore.currentGraph.id,
        {
          ...data,
          source: selectedCharacterId.value // 当前角色作为源
        }
      )
      ElMessage.success('关系已添加')
    }
    edgeEditorVisible.value = false
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

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

        if (selectedCharacterId.value === id) {
          emit('update:characterId', '')
        }

        ElMessage.success('角色已删除')

        // 同步删除关系图中的对应节点
        try {
          const graphsResult = await window.electronAPI.characterGraph.getGraphs(
            projectStore.project.path,
            projectStore.project.path
          )
          if (graphsResult.success && graphsResult.data.length > 0) {
            const graphId = graphsResult.data[0].id
            await window.electronAPI.characterGraph.deleteNodeByCharacterId(
              projectStore.project.path,
              graphId,
              id
            )
          }
        } catch (e) {
          console.warn('[CharacterEditor] 同步删除关系图节点失败:', e)
        }
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

<style scoped>
.character-editor {
  --graph-bg: #f5f7fa;
}

.relation-graph-container {
  background: var(--graph-bg);
  border-radius: 8px;
}

.relation-card {
  background: white;
  border: 2px solid #409EFF;
  border-radius: 12px;
  padding: 16px;
  min-width: 150px;
  max-width: 200px;
  transition: all 0.3s ease;
  cursor: pointer;
}

.relation-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.relation-card-center {
  border-width: 3px;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.2);
}

.relation-card-related {
  border-width: 2px;
}

.relation-tag {
  font-size: 11px;
}

:deep(.el-table) {
  font-size: 12px;
}

:deep(.el-table th) {
  background-color: var(--el-fill-color-light) !important;
}
</style>
