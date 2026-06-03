<template>
  <div class="relationship-editor">
    <div class="editor-header">
      <span class="editor-title">关系编辑</span>
      <el-button type="text" size="small" @click="$emit('delete', relationship.id)">
        <el-icon><Delete /></el-icon>
      </el-button>
    </div>

    <el-form :model="formData" label-width="80px" size="small">
      <el-form-item label="源地点" required>
        <el-select v-model="formData.sourceId" @change="onUpdate" placeholder="请选择源地点">
          <el-option
            v-for="loc in locations"
            :key="loc.id"
            :label="loc.name"
            :value="loc.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="目标地点" required>
        <el-select v-model="formData.targetId" @change="onUpdate" placeholder="请选择目标地点">
          <el-option
            v-for="loc in locations"
            :key="loc.id"
            :label="loc.name"
            :value="loc.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="关系类型">
        <el-select v-model="formData.relationType" @change="onUpdate">
          <el-option label="连接" value="connection" />
          <el-option label="路径" value="path" />
          <el-option label="边界" value="border" />
          <el-option label="自定义" value="custom" />
        </el-select>
      </el-form-item>

      <el-form-item label="关系标签">
        <el-input v-model="formData.relationLabel" @change="onUpdate" placeholder="请输入关系标签" />
      </el-form-item>

      <el-form-item label="描述">
        <el-input
          v-model="formData.description"
          type="textarea"
          :rows="3"
          @change="onUpdate"
          placeholder="请输入关系描述"
        />
      </el-form-item>

      <el-form-item label="线条颜色">
        <el-color-picker v-model="formData.color" show-alpha @change="onUpdate" />
      </el-form-item>

      <el-form-item label="线条宽度">
        <el-slider
          v-model="formData.lineWidth"
          :min="1"
          :max="10"
          @change="onUpdate"
        />
      </el-form-item>

      <el-form-item label="线条样式">
        <el-radio-group v-model="formData.lineStyle" @change="onUpdate">
          <el-radio value="solid">实线</el-radio>
          <el-radio value="dashed">虚线</el-radio>
          <el-radio value="dotted">点线</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
/**
 * 关系编辑器组件
 *
 * 编辑地点关系的属性：源地点、目标地点、关系类型、标签、描述、线条样式
 */
import { ref, watch } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import type { LocationRelationship, LocationRelationType, LineStyle } from '@/types/project'

// Props
const props = defineProps<{
  relationship: LocationRelationship
  locations: Array<{ id: string; name: string }>
}>()

// Emits
const emit = defineEmits<{
  'update:relationship': [relationship: LocationRelationship]
  'delete': [relationshipId: string]
}>()

// 表单数据
const formData = ref({
  sourceId: '',
  targetId: '',
  relationType: 'connection' as LocationRelationType,
  relationLabel: '',
  description: '',
  color: '#409EFF',
  lineWidth: 2,
  lineStyle: 'solid' as LineStyle
})

// 监听 props 变化
watch(
  () => props.relationship,
  (newRelationship) => {
    if (newRelationship) {
      formData.value = {
        sourceId: newRelationship.sourceId,
        targetId: newRelationship.targetId,
        relationType: newRelationship.relationType,
        relationLabel: newRelationship.relationLabel || '',
        description: newRelationship.description || '',
        color: newRelationship.color || '#409EFF',
        lineWidth: newRelationship.lineWidth || 2,
        lineStyle: newRelationship.lineStyle || 'solid'
      }
    }
  },
  { immediate: true }
)

// 更新关系
function onUpdate(): void {
  const updatedRelationship: LocationRelationship = {
    ...props.relationship,
    sourceId: formData.value.sourceId,
    targetId: formData.value.targetId,
    relationType: formData.value.relationType,
    relationLabel: formData.value.relationLabel || '',
    description: formData.value.description || undefined,
    color: formData.value.color || undefined,
    lineWidth: formData.value.lineWidth,
    lineStyle: formData.value.lineStyle,
    updatedAt: Date.now()
  }

  emit('update:relationship', updatedRelationship)
}
</script>

<style scoped>
.relationship-editor {
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
</style>
