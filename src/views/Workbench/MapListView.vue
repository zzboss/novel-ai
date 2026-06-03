<template>
  <div class="map-list h-full flex flex-col bg-[var(--el-bg-color-page)]">
    <!-- 顶部工具栏 -->
    <header class="h-14 flex items-center justify-between px-6 border-b border-[var(--el-border-color)] bg-[var(--el-bg-color)]/80 backdrop-blur-xl z-10">
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2">
          <h1 class="text-lg font-semibold text-[var(--el-text-color-primary)]">地图管理</h1>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <el-button type="primary" size="default" @click="handleCreateMap">
          <el-icon class="mr-1"><Plus /></el-icon>
          新建地图
        </el-button>
      </div>
    </header>

    <!-- 地图列表 -->
    <main class="flex-1 overflow-y-auto p-6">
      <div v-if="maps.length === 0" class="flex items-center justify-center h-full">
        <el-empty description="暂无地图，点击上方按钮创建" />
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="map in maps"
          :key="map.id"
          class="map-card p-4 border border-[var(--el-border-color)] rounded-lg bg-[var(--el-bg-color)] hover:shadow-lg transition-shadow cursor-pointer"
          @click="handleEditMap(map)"
        >
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-md font-medium text-[var(--el-text-color-primary)]">{{ map.name }}</h3>
            <div class="flex items-center gap-1">
              <el-button
                type="primary"
                link
                size="small"
                @click.stop="handleEditMap(map)"
              >
                编辑
              </el-button>
              <el-button
                type="danger"
                link
                size="small"
                @click.stop="handleDeleteMap(map)"
              >
                删除
              </el-button>
            </div>
          </div>
          <p v-if="map.description" class="text-sm text-[var(--el-text-color-secondary)] mb-2">
            {{ map.description }}
          </p>
          <p class="text-xs text-[var(--el-text-color-placeholder)]">
            更新于: {{ formatDate(map.updated_at) }}
          </p>
        </div>
      </div>
    </main>

    <!-- 创建/编辑地图对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEditMode ? '编辑地图' : '新建地图'"
      width="500px"
      @close="handleDialogClose"
    >
      <el-form :model="formData" label-width="80px" size="default">
        <el-form-item label="地图名称" required>
          <el-input
            v-model="formData.name"
            placeholder="请输入地图名称"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="地图描述">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="3"
            placeholder="请输入地图描述（可选）"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="isSaving" @click="handleSaveMap">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useProjectStore } from '@/stores/project'
import { useMapStore } from '@/stores/mapStore'
import type { Map } from '@/types/project'

const router = useRouter()
const projectStore = useProjectStore()
const mapStore = useMapStore()

// 状态
const maps = ref<Array<{ id: string; name: string; description: string | null; updated_at: number }>>([])
const dialogVisible = ref(false)
const isEditMode = ref(false)
const isSaving = ref(false)
const editingMapId = ref('')

// 表单数据
const formData = ref({
  name: '',
  description: ''
})

/**
 * 加载地图列表
 */
async function loadMaps(): Promise<void> {
  if (!projectStore.project?.path) return

  try {
    const result = await window.electronAPI.map.getMaps(projectStore.project.path, projectStore.project.path)
    if (result.success) {
      maps.value = result.data || []
    } else {
      throw new Error(result.error || '加载地图列表失败')
    }
  } catch (error: any) {
    console.error('[MapList] 加载地图列表失败:', error)
    ElMessage.error(`加载失败: ${error.message}`)
  }
}

/**
 * 创建地图
 */
function handleCreateMap(): void {
  isEditMode.value = false
  editingMapId.value = ''
  formData.value = {
    name: '',
    description: ''
  }
  dialogVisible.value = true
}

/**
 * 编辑地图
 */
function handleEditMap(map: Map): void {
  router.push(`/maps/${map.id}`)
}

/**
 * 删除地图
 */
async function handleDeleteMap(map: Map): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定要删除地图"${map.name}"吗？此操作不可恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    if (!projectStore.project?.path) return

    const result = await window.electronAPI.map.deleteMap(projectStore.project.path, map.id)
    if (result.success) {
      ElMessage.success('删除成功')
      await loadMaps()
    } else {
      throw new Error(result.error || '删除失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('[MapList] 删除地图失败:', error)
      ElMessage.error(`删除失败: ${error.message}`)
    }
  }
}

/**
 * 保存地图
 */
async function handleSaveMap(): Promise<void> {
  if (!formData.value.name.trim()) {
    ElMessage.warning('请输入地图名称')
    return
  }

  if (!projectStore.project?.path) return

  isSaving.value = true
  try {
    if (isEditMode.value && editingMapId.value) {
      // 编辑模式
      const result = await window.electronAPI.map.updateMap(
        projectStore.project.path,
        editingMapId.value,
        formData.value.name.trim(),
        formData.value.description.trim() || undefined
      )
      if (result.success) {
        ElMessage.success('更新成功')
        dialogVisible.value = false
        await loadMaps()
      } else {
        throw new Error(result.error || '更新失败')
      }
    } else {
      // 创建模式
      const result = await window.electronAPI.map.createMap(
        projectStore.project.path,
        projectStore.project.path,
        formData.value.name.trim(),
        formData.value.description.trim()
      )
      if (result.success) {
        ElMessage.success('创建成功')
        dialogVisible.value = false
        await loadMaps()
      } else {
        throw new Error(result.error || '创建失败')
      }
    }
  } catch (error: any) {
    console.error('[MapList] 保存地图失败:', error)
    ElMessage.error(`保存失败: ${error.message}`)
  } finally {
    isSaving.value = false
  }
}

/**
 * 对话框关闭回调
 */
function handleDialogClose(): void {
  formData.value = {
    name: '',
    description: ''
  }
  editingMapId.value = ''
  isEditMode.value = false
}

/**
 * 格式化日期
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

onMounted(() => {
  loadMaps()
})
</script>

<style scoped>
.map-list {
  /* 自定义样式 */
}

.map-card {
  transition: all 0.3s ease;
}

.map-card:hover {
  transform: translateY(-2px);
}
</style>
