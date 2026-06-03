<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑关系' : '添加关系'"
    width="500px"
    @close="handleClose"
  >
    <el-form :model="form" label-width="80px" size="default">
      <el-form-item label="源地点" required>
        <el-select v-model="form.sourceId" placeholder="请选择源地点">
          <el-option
            v-for="loc in locationOptions"
            :key="loc.id"
            :label="loc.name"
            :value="loc.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="目标地点" required>
        <el-select v-model="form.targetId" placeholder="请选择目标地点">
          <el-option
            v-for="loc in locationOptions"
            :key="loc.id"
            :label="loc.name"
            :value="loc.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="关系类型">
        <el-select v-model="form.relationType">
          <el-option label="连接" value="connection" />
          <el-option label="路径" value="path" />
          <el-option label="边界" value="border" />
          <el-option label="自定义" value="custom" />
        </el-select>
      </el-form-item>
      <el-form-item label="关系标签">
        <el-input v-model="form.relationLabel" placeholder="请输入关系标签" maxlength="50" show-word-limit />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="form.description" type="textarea" :rows="3" placeholder="请输入关系描述" maxlength="500" show-word-limit />
      </el-form-item>
      <el-form-item label="颜色">
        <el-color-picker v-model="form.color" show-alpha />
      </el-form-item>
      <el-form-item label="线宽">
        <el-slider v-model="form.lineWidth" :min="1" :max="10" />
      </el-form-item>
      <el-form-item label="线型">
        <el-select v-model="form.lineStyle">
          <el-option label="实线" value="solid" />
          <el-option label="虚线" value="dashed" />
          <el-option label="点线" value="dotted" />
        </el-select>
      </el-form-item>
    </el-form>

    <template>
      <div class="flex justify-end gap-2">
        <el-button v-if="isEdit" type="danger" @click="handleDelete">删除</el-button>
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" :loading="loading" @click="handleConfirm">保存</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import type { LocationRelationship, LocationRelationType, LineStyle } from '@/types/project'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  modelValue: boolean
  relationship?: LocationRelationship
  locationOptions: Array<{ id: string; name: string }>
  preFillSource?: string
  preFillTarget?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', relationship: LocationRelationship): void
  (e: 'delete'): void
}>()

const visible = ref(props.modelValue)
const loading = ref(false)
const isEdit = ref(!!props.relationship)

const form = reactive({
  sourceId: props.relationship?.sourceId || props.preFillSource || '',
  targetId: props.relationship?.targetId || props.preFillTarget || '',
  relationType: (props.relationship?.relationType || 'connection') as LocationRelationType,
  relationLabel: props.relationship?.relationLabel || '',
  description: props.relationship?.description || '',
  color: props.relationship?.color || '',
  lineWidth: props.relationship?.lineWidth || 2,
  lineStyle: (props.relationship?.lineStyle || 'solid') as LineStyle
})

watch(() => props.modelValue, (val) => { visible.value = val })
watch(() => props.relationship, (rel) => {
  if (rel) {
    form.sourceId = rel.sourceId
    form.targetId = rel.targetId
    form.relationType = rel.relationType
    form.relationLabel = rel.relationLabel || ''
    form.description = rel.description || ''
    form.color = rel.color || ''
    form.lineWidth = rel.lineWidth || 2
    form.lineStyle = rel.lineStyle || 'solid'
    isEdit.value = true
  } else {
    resetForm()
    isEdit.value = false
  }
})

watch(() => props.preFillSource, (val) => {
  if (val) form.sourceId = val
})
watch(() => props.preFillTarget, (val) => {
  if (val) form.targetId = val
})

function resetForm(): void {
  form.sourceId = ''
  form.targetId = ''
  form.relationType = 'connection'
  form.relationLabel = ''
  form.description = ''
  form.color = ''
  form.lineWidth = 2
  form.lineStyle = 'solid'
}

function handleClose(): void {
  visible.value = false
  emit('update:modelValue', false)
}

function handleConfirm(): void {
  if (!form.sourceId || !form.targetId) {
    ElMessage.warning('请选择源地点和目标地点')
    return
  }
  loading.value = true
  try {
    emit('confirm', {
      ...props.relationship,
      sourceId: form.sourceId,
      targetId: form.targetId,
      relationType: form.relationType,
      relationLabel: form.relationLabel,
      description: form.description,
      color: form.color || undefined,
      lineWidth: form.lineWidth,
      lineStyle: form.lineStyle
    } as LocationRelationship)
    handleClose()
  } finally {
    loading.value = false
  }
}

function handleDelete(): void {
  emit('delete')
}
</script>
