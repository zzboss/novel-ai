<template>
  <div class="character-list-view h-full flex flex-col">
    <!-- 头部 -->
    <div class="p-4 border-b flex items-center justify-between" style="border-color: var(--el-border-color)">
      <h3 class="text-sm font-medium m-0">角色管理</h3>
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

    <!-- 角色列表 -->
    <div class="flex-1 overflow-y-auto p-4">
      <el-empty v-if="characters.length === 0" description="暂无角色，点击上方按钮添加" />

      <div v-else class="grid grid-cols-1 gap-3">
        <div
          v-for="char in characters"
          :key="char.id"
          class="character-card p-4 border rounded-lg cursor-pointer hover:border-[var(--el-color-primary)] transition-colors"
          style="border-color: var(--el-border-color)"
          @click="selectCharacter(char.id)"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-2">
                <el-icon :size="20"><Avatar /></el-icon>
                <span class="text-base font-medium">{{ char.name }}</span>
                <el-tag v-if="getRoleType(char.role)" size="small" :type="getRoleType(char.role)">
                  {{ getRoleLabel(char.role) }}
                </el-tag>
                <el-tag v-if="char.gender" size="small" type="info">
                  {{ getGenderLabel(char.gender) }}
                </el-tag>
              </div>
              <p v-if="char.description" class="text-sm text-[var(--el-text-color-secondary)] line-clamp-2 mt-1">
                {{ char.description }}
              </p>
              <p v-else class="text-sm text-[var(--el-text-color-placeholder)] mt-1">
                暂无描述
              </p>
            </div>

            <div class="flex items-center gap-1 ml-2">
              <el-button
                size="small"
                :icon="EditPen"
                circle
                @click.stop="selectCharacter(char.id)"
              />
              <el-button
                size="small"
                :icon="Delete"
                circle
                type="danger"
                @click.stop="deleteCharacter(char.id, char.name)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- AI辅助生成对话框 -->
    <CharacterGenerateDialog
      v-model:visible="generateDialogVisible"
      :project-type="projectStore.project?.projectType || 'novel'"
      :project-context="getProjectContext()"
      @success="handleGenerateSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Plus, Delete, ArrowDown, EditPen, MagicStick, Avatar } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useProjectStore } from '@/stores/project'
import CharacterGenerateDialog from './CharacterGenerateDialog.vue'

const emit = defineEmits<{
  'select': [characterId: string]
}>()

const projectStore = useProjectStore()
const generateDialogVisible = ref(false)
const generatedCharacterId = ref('')

const characters = computed(() => {
  return projectStore.project?.characters || []
})

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    protagonist: '主角',
    antagonist: '反派',
    supporting: '配角',
    minor: '龙套'
  }
  return labels[role] || '未知'
}

function getRoleType(role: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' | undefined {
  const typeMap: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'danger' | ''> = {
    protagonist: 'danger',
    antagonist: 'warning',
    supporting: '',
    minor: 'info'
  }
  const result = typeMap[role]
  return result === '' ? undefined : result
}

function getGenderLabel(gender: string): string {
  const map: Record<string, string> = {
    male: '男',
    female: '女',
    other: '其他'
  }
  return map[gender] || gender
}

function getProjectContext() {
  const project = projectStore.project
  if (!project) return undefined

  return {
    idea: project.idea || '',
    worldSettings: project.worldSettings || undefined,
    characters: project.characters?.filter(c => c.id !== generatedCharacterId.value) || []
  }
}

function selectCharacter(id: string): void {
  emit('select', id)
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

  projectStore.markDirty()
  ElMessage.success('角色已添加')
  emit('select', id)
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
  generatedCharacterId.value = character.id
  projectStore.markDirty()
  ElMessage.success(`角色「${character.name}」已添加`)
  emit('select', character.id)
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
          console.warn('[CharacterListView] 同步删除关系图节点失败:', e)
        }
      }
    }
  } catch {
    // 用户取消
  }
}
</script>

<style scoped>
.character-card {
  transition: all 0.2s;
}

.character-card:hover {
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}
</style>
