<template>
  <div class="map-list-container">
    <!-- 顶部工具栏 -->
    <div class="map-toolbar">
      <el-button type="primary" size="small" @click="showCreateDialog = true">
        <el-icon><Plus /></el-icon>
        新建地图
      </el-button>

      <el-input
        v-model="searchKeyword"
        placeholder="搜索地图..."
        size="small"
        clearable
        class="search-input"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
    </div>

    <!-- 地图列表 -->
    <div class="map-list" v-if="filteredMaps.length > 0">
      <div
        v-for="map in filteredMaps"
        :key="map.id"
        class="map-item"
        :class="{ active: currentMapId === map.id }"
        @click="selectMap(map.id)"
      >
        <div class="map-item-content">
          <el-icon class="map-icon"><Location /></el-icon>
          <div class="map-info">
            <div class="map-name">{{ map.name }}</div>
            <div class="map-update-time">{{ formatTime(map.updated_at) }}</div>
          </div>
        </div>

        <div class="map-item-actions">
          <el-button
            type="primary"
            link
            size="small"
            @click.stop="editMap(map)"
          >
            <el-icon><Edit /></el-icon>
          </el-button>
          <el-button
            type="danger"
            link
            size="small"
            @click.stop="confirmDeleteMap(map)"
          >
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div class="empty-state" v-else>
      <el-icon class="empty-icon"><Location /></el-icon>
      <div class="empty-text">暂无地图</div>
      <el-button type="primary" size="small" @click="showCreateDialog = true">
        创建第一个地图
      </el-button>
    </div>

    <!-- 创建/编辑地图对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      :title="editingMap ? '编辑地图' : '新建地图'"
      width="400px"
      @close="resetForm"
    >
      <el-form :model="mapForm" label-width="80px">
        <el-form-item label="地图名称" required>
          <el-input
            v-model="mapForm.name"
            placeholder="请输入地图名称"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="地图描述">
          <el-input
            v-model="mapForm.description"
            type="textarea"
            placeholder="请输入地图描述（可选）"
            :rows="3"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="saveMap" :loading="saving">
          {{ editingMap ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 地图列表组件
 *
 * 显示项目的所有地图，支持创建、编辑、删除地图
 */
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Location, Edit, Delete } from '@element-plus/icons-vue'
import { useMapStore } from '@/stores/mapStore'
import type { Map } from '@/types/project'

// 使用地图 Store
const mapStore = useMapStore()

// 搜索关键词
const searchKeyword = ref('')

// 过滤后的地图列表
const filteredMaps = computed(() => {
  const maps = mapStore.maps || []
  if (!searchKeyword.value) return maps
  return maps.filter(map =>
    map.name.toLowerCase().includes(searchKeyword.value.toLowerCase())
  )
})

// 当前选中的地图 ID
const currentMapId = computed(() => mapStore.currentMap?.id || '')

// 显示创建对话框
const showCreateDialog = ref(false)

// 正在编辑的地图（null 表示创建新地图）
const editingMap = ref<Map | null>(null)

// 表单数据
const mapForm = ref({
  name: '',
  description: ''
})

// 保存中
const saving = ref(false)

// 选择地图
async function selectMap(mapId: string): Promise<void> {
  try {
    await mapStore.loadMap(mapId)
  } catch (error: any) {
    ElMessage.error(`加载地图失败：${error.message}`)
  }
}

// 编辑地图
function editMap(map: Map): void {
  editingMap.value = map
  mapForm.value = {
    name: map.name,
    description: map.description || ''
  }
  showCreateDialog.value = true
}

// 确认删除地图
async function confirmDeleteMap(map: Map): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定要删除地图「${map.name}」吗？此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await mapStore.deleteMap(map.id)
    ElMessage.success('删除成功')
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(`删除失败：${error.message}`)
    }
  }
}

// 保存地图
async function saveMap(): Promise<void> {
  if (!mapForm.value.name.trim()) {
    ElMessage.warning('请输入地图名称')
    return
  }

  saving.value = true
  try {
    if (editingMap.value) {
      // 编辑地图
      await mapStore.updateMap(editingMap.value.id, {
        name: mapForm.value.name,
        description: mapForm.value.description
      })
      ElMessage.success('保存成功')
    } else {
      // 创建新地图
      await mapStore.createMap(mapForm.value.name, mapForm.value.description)
      ElMessage.success('创建成功')
    }

    showCreateDialog.value = false
    resetForm()
  } catch (error: any) {
    ElMessage.error(`保存失败：${error.message}`)
  } finally {
    saving.value = false
  }
}

// 重置表单
function resetForm(): void {
  editingMap.value = null
  mapForm.value = {
    name: '',
    description: ''
  }
}

// 格式化时间
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 组件挂载时加载地图列表
onMounted(async () => {
  try {
    await mapStore.loadMaps()
  } catch (error: any) {
    ElMessage.error(`加载地图列表失败：${error.message}`)
  }
})
</script>

<style scoped>
.map-list-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
  border-right: 1px solid #e4e7ed;
}

.map-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 15px;
  border-bottom: 1px solid #e4e7ed;
}

.search-input {
  flex: 1;
}

.map-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.map-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  margin-bottom: 8px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.map-item:hover {
  background: #f5f7fa;
  border-color: #c0c4cc;
}

.map-item.active {
  background: #ecf5ff;
  border-color: #409eff;
}

.map-item-content {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.map-icon {
  font-size: 20px;
  color: #409eff;
}

.map-info {
  flex: 1;
  min-width: 0;
}

.map-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-update-time {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.map-item-actions {
  display: flex;
  gap: 5px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 40px;
  color: #909399;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 14px;
  margin-bottom: 16px;
}
</style>
