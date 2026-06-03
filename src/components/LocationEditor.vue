<template>
  <div class="location-editor">
    <div class="editor-header">
      <span class="editor-title">地点编辑</span>
      <el-button type="text" size="small" @click="$emit('delete', location.id)">
        <el-icon><Delete /></el-icon>
      </el-button>
    </div>

    <el-form :model="formData" label-width="80px" size="small">
      <el-form-item label="名称" required>
        <el-input v-model="formData.name" @change="onUpdate" />
      </el-form-item>

      <el-form-item label="描述">
        <el-input
          v-model="formData.description"
          type="textarea"
          :rows="3"
          @change="onUpdate"
        />
      </el-form-item>

      <el-form-item label="颜色">
        <el-color-picker v-model="formData.color" show-alpha @change="onUpdate" />
      </el-form-item>

      <el-form-item label="大小">
        <el-slider
          v-model="formData.size"
          :min="10"
          :max="100"
          @change="onUpdate"
        />
      </el-form-item>

      <el-form-item label="图标">
        <el-input v-model="formData.icon" placeholder="图标名称" @change="onUpdate" />
      </el-form-item>

      <el-form-item label="坐标">
        <div class="coordinate-inputs">
          <el-input-number
            v-model="formData.x"
            :step="0.1"
            controls-position="right"
            size="small"
            @change="onUpdate"
          />
          <span class="coordinate-separator">,</span>
          <el-input-number
            v-model="formData.y"
            :step="0.1"
            controls-position="right"
            size="small"
            @change="onUpdate"
          />
        </div>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
/**
 * 地点编辑器组件
 *
 * 编辑地点的属性：名称、描述、颜色、大小、图标、坐标
 */
import { ref, watch } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import type { Location } from '@/types/project'

// Props
const props = defineProps<{
  location: Location
}>()

// Emits
const emit = defineEmits<{
  'update:location': [location: Location]
  delete: [locationId: string]
}>()

// 表单数据
const formData = ref({
  name: '',
  description: '',
  color: '#409EFF',
  size: 30,
  icon: '',
  x: 0,
  y: 0
})

// 监听 props 变化
watch(
  () => props.location,
  (newLocation) => {
    if (newLocation) {
      formData.value = {
        name: newLocation.name,
        description: newLocation.description || '',
        color: newLocation.color || '#409EFF',
        size: newLocation.size || 30,
        icon: newLocation.icon || '',
        x: newLocation.x,
        y: newLocation.y
      }
    }
  },
  { immediate: true }
)

// 更新地点
function onUpdate(): void {
  const updatedLocation: Location = {
    ...props.location,
    name: formData.value.name,
    description: formData.value.description || undefined,
    color: formData.value.color || undefined,
    size: formData.value.size,
    icon: formData.value.icon || undefined,
    x: formData.value.x,
    y: formData.value.y,
    updatedAt: Date.now()
  }

  emit('update:location', updatedLocation)
}
</script>

<style scoped>
.location-editor {
  padding: 16px;
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e4e7ed;
}

.editor-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.coordinate-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.coordinate-separator {
  color: #909399;
}
</style>
