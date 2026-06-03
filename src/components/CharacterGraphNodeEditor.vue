<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑角色节点' : '添加角色节点'"
    width="500px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="100px"
      size="default"
    >
      <!-- 角色选择（仅新增时） -->
      <el-form-item v-if="!isEdit" label="角色" prop="characterId">
        <el-select
          v-model="form.characterId"
          placeholder="选择角色"
          class="w-full"
          filterable
        >
          <el-option
            v-for="char in characterOptions"
            :key="char.id"
            :label="char.name"
            :value="char.id"
          >
            <div class="flex items-center gap-2">
              <div
                class="w-5 h-5 rounded-full"
                :style="{ backgroundColor: getColorByRole(char.role) }"
              />
              <span>{{ char.name }}</span>
              <el-tag size="small" class="ml-auto">{{ getRoleLabel(char.role) }}</el-tag>
            </div>
          </el-option>
        </el-select>
      </el-form-item>

      <!-- 节点样式 -->
      <el-divider content-position="left">节点样式</el-divider>

      <el-form-item label="节点颜色">
        <el-color-picker v-model="form.color" show-alpha />
      </el-form-item>

      <el-form-item label="节点大小">
        <el-slider
          v-model="form.size"
          :min="30"
          :max="120"
          :step="5"
          show-input
        />
      </el-form-item>

      <el-form-item label="固定位置">
        <el-switch v-model="form.fixed" />
        <span class="text-xs text-[var(--el-text-color-secondary)] ml-2">
          固定后节点不会力导向布局影响
        </span>
      </el-form-item>

      <el-form-item label="图标">
        <el-input v-model="form.icon" placeholder="输入 emoji 或图标 URL" clearable>
          <template #prefix>
            <span v-if="form.icon">{{ form.icon }}</span>
          </template>
        </el-input>
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="flex justify-end gap-2">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="handleConfirm" :loading="loading">
          {{ isEdit ? '保存' : '添加' }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import type { CharacterNode } from '@/types/character-graph'

const props = defineProps<{
  modelValue: boolean
  node?: CharacterNode
  characterOptions: Array<{ id: string; name: string; role: string }>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', data: any): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const isEdit = computed(() => !!props.node)
const loading = ref(false)
const formRef = ref<FormInstance>()

const form = reactive({
  characterId: '',
  color: '',
  size: 60,
  fixed: false,
  icon: '',
  x: undefined as number | undefined,
  y: undefined as number | undefined
})

const rules: FormRules = {
  characterId: [
    { required: true, message: '请选择角色', trigger: 'change' }
  ]
}

// 初始化表单
function initForm() {
  if (props.node) {
    form.characterId = props.node.characterId || ''
    form.color = props.node.color || ''
    form.size = props.node.size || 60
    form.fixed = props.node.fixed || false
    form.icon = props.node.icon || ''
    form.x = props.node.x
    form.y = props.node.y
  } else {
    form.characterId = ''
    form.color = ''
    form.size = 60
    form.fixed = false
    form.icon = ''
    form.x = undefined
    form.y = undefined
  }
}

// 确认
async function handleConfirm() {
  if (!formRef.value) return

  try {
    loading.value = true
    await formRef.value.validate()

    emit('confirm', {
      characterId: form.characterId,
      color: form.color || undefined,
      size: form.size,
      fixed: form.fixed,
      icon: form.icon || undefined,
      x: form.x,
      y: form.y
    })

    handleClose()
  } catch {
    // 验证失败
  } finally {
    loading.value = false
  }
}

// 关闭
function handleClose() {
  visible.value = false
  formRef.value?.resetFields()
}

// 根据角色类型获取颜色
function getColorByRole(role: string): string {
  const colorMap: Record<string, string> = {
    'protagonist': '#FFD700',
    'antagonist': '#DC143C',
    'supporting': '#4169E1',
    'minor': '#808080'
  }
  return colorMap[role] || '#409EFF'
}

// 获取角色类型标签
function getRoleLabel(role: string): string {
  const labelMap: Record<string, string> = {
    'protagonist': '主角',
    'antagonist': '反派',
    'supporting': '配角',
    'minor': '次要角色'
  }
  return labelMap[role] || '未知'
}

// 监听节点变化
watch(() => props.node, initForm, { immediate: true })
watch(() => props.modelValue, (val) => {
  if (val) initForm()
})
</script>
