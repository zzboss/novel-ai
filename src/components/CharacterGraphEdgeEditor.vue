<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑关系边' : '添加关系边'"
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
      <!-- 源角色（仅新增时） -->
      <el-form-item v-if="!isEdit" label="源角色" prop="source">
        <el-select
          v-model="form.source"
          placeholder="选择源角色"
          class="w-full"
        >
          <el-option
            v-for="node in nodeOptions"
            :key="node.id"
            :label="node.name"
            :value="node.id"
          >
            <div class="flex items-center gap-2">
              <div
                class="w-5 h-5 rounded-full"
                :style="{ backgroundColor: getColorByRole(node.role) }"
              />
              <span>{{ node.name }}</span>
            </div>
          </el-option>
        </el-select>
      </el-form-item>

      <!-- 目标角色（仅新增时） -->
      <el-form-item v-if="!isEdit" label="目标角色" prop="target">
        <el-select
          v-model="form.target"
          placeholder="选择目标角色"
          class="w-full"
        >
          <el-option
            v-for="node in nodeOptions"
            :key="node.id"
            :label="node.name"
            :value="node.id"
          >
            <div class="flex items-center gap-2">
              <div
                class="w-5 h-5 rounded-full"
                :style="{ backgroundColor: getColorByRole(node.role) }"
              />
              <span>{{ node.name }}</span>
            </div>
          </el-option>
        </el-select>
      </el-form-item>

      <!-- 关系类型 -->
      <el-form-item label="关系类型" prop="relationType">
        <el-select v-model="form.relationType" class="w-full">
          <el-option label="亲属" value="family" />
          <el-option label="朋友" value="friend" />
          <el-option label="对手" value="rival" />
          <el-option label="恋人" value="lover" />
          <el-option label="导师" value="mentor" />
          <el-option label="学生" value="student" />
          <el-option label="敌人" value="enemy" />
          <el-option label="盟友" value="ally" />
          <el-option label="下属" value="subordinate" />
          <el-option label="领导" value="leader" />
          <el-option label="自定义" value="custom" />
        </el-select>
      </el-form-item>

      <!-- 关系描述 -->
      <el-form-item label="关系描述" prop="relationLabel">
        <el-input
          v-model="form.relationLabel"
          placeholder="输入关系描述"
          maxlength="50"
          show-word-limit
          @input="userEditedLabel = true"
        />
      </el-form-item>

      <!-- 关系属性（无向图，不需要方向设置） -->
      <el-divider content-position="left">关系属性</el-divider>

      <el-form-item label="关系类型">
        <el-tag size="small" type="info">无向关系</el-tag>
        <span class="text-xs text-[var(--el-text-color-secondary)] ml-2">
          关系对双方都有效
        </span>
      </el-form-item>

      <!-- 边样式 -->
      <el-divider content-position="left">边样式</el-divider>

      <el-form-item label="边颜色">
        <el-color-picker v-model="form.color" show-alpha />
      </el-form-item>

      <el-form-item label="线宽">
        <el-slider
          v-model="form.lineWidth"
          :min="1"
          :max="10"
          :step="0.5"
          show-input
        />
      </el-form-item>

      <el-form-item label="线型">
        <el-radio-group v-model="form.lineStyle">
          <el-radio value="solid">实线</el-radio>
          <el-radio value="dashed">虚线</el-radio>
          <el-radio value="dotted">点线</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="关系强度">
        <el-slider
          v-model="form.weight"
          :min="1"
          :max="10"
          :step="1"
          show-input
        />
        <span class="text-xs text-[var(--el-text-color-secondary)] ml-2">
          影响力导向布局中的吸引力
        </span>
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="flex justify-between items-center">
        <div>
          <!-- 编辑模式下显示删除按钮 -->
          <el-button v-if="isEdit" type="danger" @click="handleDelete" :loading="loading">
            删除
          </el-button>
        </div>
        <div class="flex gap-2">
          <el-button @click="handleClose">取消</el-button>
          <el-button type="primary" @click="handleConfirm" :loading="loading">
            {{ isEdit ? '保存' : '添加' }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessageBox } from 'element-plus'
import type { CharacterEdge, CharacterRelationType } from '@/types/character-graph'

const props = defineProps<{
  modelValue: boolean
  edge?: CharacterEdge
  nodeOptions: Array<{ id: string; name: string; role: string }>
  preFillSource?: string
  preFillTarget?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'confirm', data: any): void
  (e: 'delete', edgeId: string): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const isEdit = computed(() => !!props.edge)
const loading = ref(false)
const formRef = ref<FormInstance>()
// 标记用户是否主动编辑过关系描述
const userEditedLabel = ref(false)

// 关系类型中文映射
const relationTypeLabels: Record<string, string> = {
  family: '亲属',
  friend: '朋友',
  rival: '对手',
  lover: '恋人',
  mentor: '导师',
  student: '学生',
  enemy: '敌人',
  ally: '盟友',
  subordinate: '下属',
  leader: '领导',
  custom: '自定义'
}

const form = reactive({
  source: '',
  target: '',
  relationType: 'friend' as CharacterRelationType,
  relationLabel: '',
  directed: true,
  bidirectional: false,
  color: '',
  lineWidth: 2,
  lineStyle: 'solid' as 'solid' | 'dashed' | 'dotted',
  weight: 5
})

const rules: FormRules = {
  source: [
    { required: true, message: '请选择源角色', trigger: 'change' }
  ],
  target: [
    { required: true, message: '请选择目标角色', trigger: 'change' }
  ],
  relationType: [
    { required: true, message: '请选择关系类型', trigger: 'change' }
  ],
  relationLabel: [
    { required: false, message: '请输入关系描述', trigger: 'blur' }
  ]
}

// 初始化表单
function initForm() {
  // 重置用户编辑标记
  userEditedLabel.value = false

  if (props.edge) {
    // 编辑模式：从 edge 填充
    form.source = props.edge.source || ''
    form.target = props.edge.target || ''
    form.relationType = props.edge.relationType || 'custom'
    form.relationLabel = props.edge.relationLabel || ''
    form.directed = props.edge.directed !== false
    form.bidirectional = props.edge.bidirectional || false
    form.color = props.edge.color || ''
    form.lineWidth = props.edge.lineWidth || 2
    form.lineStyle = props.edge.lineStyle || 'solid'
    form.weight = props.edge.weight || 5
  } else {
    // 新增模式：支持预填 source/target（拖拽创建连线时）
    form.source = props.preFillSource || ''
    form.target = props.preFillTarget || ''
    form.relationType = 'friend'
    // 主动设置默认描述值为关系类型的中文标签
    form.relationLabel = relationTypeLabels[form.relationType] || form.relationType
    form.directed = true
    form.bidirectional = false
    form.color = ''
    form.lineWidth = 2
    form.lineStyle = 'solid'
    form.weight = 5
  }
}

// 确认
async function handleConfirm() {
  if (!formRef.value) return

  try {
    loading.value = true
    await formRef.value.validate()

    emit('confirm', {
      source: form.source,
      target: form.target,
      relationType: form.relationType,
      relationLabel: form.relationLabel,
      directed: form.directed,
      bidirectional: form.bidirectional,
      color: form.color || undefined,
      lineWidth: form.lineWidth,
      lineStyle: form.lineStyle,
      weight: form.weight
    })

    handleClose()
  } catch {
    // 验证失败
  } finally {
    loading.value = false
  }
}

// 删除
async function handleDelete() {
  if (!props.edge) return
  
  try {
    await ElMessageBox.confirm(
      '确定要删除这条关系吗？此操作不可恢复。',
      '删除确认',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    emit('delete', props.edge.id)
    handleClose()
  } catch {
    // 用户取消
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

// 监听关系类型变化，自动设置默认描述
watch(() => form.relationType, (newType) => {
  // 如果用户没有主动编辑过描述，则自动更新为关系类型的中文标签
  if (!userEditedLabel.value) {
    form.relationLabel = relationTypeLabels[newType] || newType
  }
})

// 监听关系描述变化，如果用户清空了描述，重置编辑标记
watch(() => form.relationLabel, (newLabel) => {
  if (!newLabel) {
    // 描述被清空，重置标记，允许切换关系类型时自动填充
    userEditedLabel.value = false
  }
})

// 监听边变化
watch(() => props.edge, initForm, { immediate: true })
watch(() => props.modelValue, (val) => {
  if (val) initForm()
})
</script>
