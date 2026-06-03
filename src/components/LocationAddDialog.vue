<template>
  <el-dialog
    v-model="visible"
    title="添加地点"
    width="500px"
    @close="handleClose"
  >
    <el-form :model="form" label-width="80px" size="default">
      <el-form-item label="名称" required>
        <el-input v-model="form.name" placeholder="请输入地点名称" maxlength="50" show-word-limit />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="form.description" type="textarea" :rows="3" placeholder="请输入地点描述" maxlength="500" show-word-limit />
      </el-form-item>
      <el-form-item label="X坐标">
        <el-input-number v-model="form.x" :precision="6" />
      </el-form-item>
      <el-form-item label="Y坐标">
        <el-input-number v-model="form.y" :precision="6" />
      </el-form-item>
      <el-form-item label="颜色">
        <el-color-picker v-model="form.color" show-alpha />
      </el-form-item>
      <el-form-item label="大小">
        <el-slider v-model="form.size" :min="10" :max="100" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleConfirm">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import type { Location } from '@/types/project'

const props = defineProps<{
  modelValue: boolean
  projectPath: string
  mapId: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'success', location: Location): void
}>()

const visible = ref(props.modelValue)
const loading = ref(false)

const form = reactive({
  name: '',
  description: '',
  x: 0,
  y: 0,
  color: '',
  size: 30
})

function handleClose(): void {
  visible.value = false
  emit('update:modelValue', false)
}

async function handleConfirm(): Promise<void> {
  if (!form.name.trim()) {
    ElMessage.warning('请输入地点名称')
    return
  }

  loading.value = true
  try {
    const result = await window.electronAPI.map.addLocation(
      props.projectPath,
      props.mapId,
      form.name,
      form.x,
      form.y,
      form.description,
      form.color || undefined,
      form.size,
      undefined as any
    )
    if (result.success && result.data) {
      ElMessage.success('添加成功')
      emit('success', result.data)
      handleClose()
    } else {
      throw new Error(result.error || '添加失败')
    }
  } catch (error: any) {
    console.error('[LocationAddDialog] 添加地点失败:', error)
    ElMessage.error(`保存失败: ${error.message}`)
  } finally {
    loading.value = false
  }
}
</script>
