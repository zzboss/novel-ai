<template>
  <!-- 添加/编辑地点对话框 -->
  <el-dialog
    v-model="localShowAddLocation"
    :title="editingLocation ? '编辑地点' : '添加地点'"
    width="500px"
    @close="handleCloseLocationDialog"
  >
    <el-form :model="locationForm" label-width="80px" size="default">
      <el-form-item label="名称" required>
        <el-input v-model="locationForm.name" placeholder="请输入地点名称" maxlength="50" show-word-limit />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="locationForm.description" type="textarea" :rows="3" placeholder="请输入地点描述" maxlength="500" show-word-limit />
      </el-form-item>
      <el-form-item label="X坐标">
        <el-input-number v-model="locationForm.x" :precision="6" />
      </el-form-item>
      <el-form-item label="Y坐标">
        <el-input-number v-model="locationForm.y" :precision="6" />
      </el-form-item>
      <el-form-item label="颜色">
        <el-color-picker v-model="locationForm.color" show-alpha />
      </el-form-item>
      <el-form-item label="大小">
        <el-slider v-model="locationForm.size" :min="10" :max="100" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="localShowAddLocation = false">取消</el-button>
      <el-button type="primary" :loading="isSaving" @click="handleSaveLocation">保存</el-button>
    </template>
  </el-dialog>

  <!-- 添加/编辑关系对话框 -->
  <el-dialog
    v-model="localShowAddRelationship"
    :title="editingRelationship ? '编辑关系' : '添加关系'"
    width="500px"
    @close="handleCloseRelationshipDialog"
  >
    <el-form :model="relationshipForm" label-width="80px" size="default">
      <el-form-item label="源地点" required>
        <el-select v-model="relationshipForm.sourceId" placeholder="请选择源地点">
          <el-option
            v-for="loc in locations"
            :key="loc.id"
            :label="loc.name"
            :value="loc.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="目标地点" required>
        <el-select v-model="relationshipForm.targetId" placeholder="请选择目标地点">
          <el-option
            v-for="loc in locations"
            :key="loc.id"
            :label="loc.name"
            :value="loc.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="关系类型">
        <el-select v-model="relationshipForm.relationType">
          <el-option label="连接" value="connection" />
          <el-option label="路径" value="path" />
          <el-option label="边界" value="border" />
          <el-option label="自定义" value="custom" />
        </el-select>
      </el-form-item>
      <el-form-item label="关系标签">
        <el-input v-model="relationshipForm.relationLabel" placeholder="请输入关系标签" maxlength="50" show-word-limit />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="relationshipForm.description" type="textarea" :rows="3" placeholder="请输入关系描述" maxlength="500" show-word-limit />
      </el-form-item>
      <el-form-item label="颜色">
        <el-color-picker v-model="relationshipForm.color" show-alpha />
      </el-form-item>
      <el-form-item label="线宽">
        <el-slider v-model="relationshipForm.lineWidth" :min="1" :max="10" />
      </el-form-item>
      <el-form-item label="线型">
        <el-select v-model="relationshipForm.lineStyle">
          <el-option label="实线" value="solid" />
          <el-option label="虚线" value="dashed" />
          <el-option label="点线" value="dotted" />
        </el-select>
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="flex justify-between items-center">
        <el-button
          v-if="editingRelationship"
          type="danger"
          @click="handleDeleteRelationship"
        >
          删除
        </el-button>
        <div v-else />
        <div class="flex gap-2">
          <el-button @click="localShowAddRelationship = false">取消</el-button>
          <el-button type="primary" :loading="isSaving" @click="handleSaveRelationship">保存</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Location, LocationRelationship, LocationRelationType, LineStyle } from '@/types/project'

const props = defineProps<{
  showAddLocationDialog: boolean
  showAddRelationshipDialog: boolean
  editingLocation: Location | null
  editingRelationship: LocationRelationship | null
  locationForm: {
    name: string
    description: string
    x: number
    y: number
    color: string
    size: number
  }
  relationshipForm: {
    sourceId: string
    targetId: string
    relationType: LocationRelationType
    relationLabel: string
    description: string
    color: string
    lineWidth: number
    lineStyle: LineStyle
  }
  locations: Location[]
  isSaving: boolean
}>()

const emit = defineEmits<{
  (e: 'update:showAddLocationDialog', value: boolean): void
  (e: 'update:showAddRelationshipDialog', value: boolean): void
  (e: 'save-location'): void
  (e: 'save-relationship'): void
  (e: 'delete-relationship'): void
  (e: 'reset-location-form'): void
  (e: 'reset-relationship-form'): void
}>()

function handleDeleteRelationship(): void {
  emit('delete-relationship')
}

// 本地副本用于双向绑定
const localShowAddLocation = ref(props.showAddLocationDialog)
const localShowAddRelationship = ref(props.showAddRelationshipDialog)

// 监听props变化
watch(() => props.showAddLocationDialog, (val) => {
  localShowAddLocation.value = val
})
watch(() => props.showAddRelationshipDialog, (val) => {
  localShowAddRelationship.value = val
})

// 监听本地值变化，向上发射事件
watch(localShowAddLocation, (val) => {
  emit('update:showAddLocationDialog', val)
})
watch(localShowAddRelationship, (val) => {
  emit('update:showAddRelationshipDialog', val)
})

function handleCloseLocationDialog() {
  emit('reset-location-form')
}

function handleCloseRelationshipDialog() {
  emit('reset-relationship-form')
}

function handleSaveLocation() {
  emit('save-location')
}

function handleSaveRelationship() {
  emit('save-relationship')
}
</script>
