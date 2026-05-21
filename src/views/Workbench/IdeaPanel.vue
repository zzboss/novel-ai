<template>
  <div class="idea-panel h-full flex flex-col">
      <div class="p-4 border-b flex items-center justify-between" style="border-color: var(--el-border-color)">
        <h3 class="text-base font-medium m-0">💡 灵感管理</h3>
        <div class="flex gap-2">
          <el-button size="small" type="primary" :icon="MagicStick" @click="showGenerateDialog = true">AI 生成</el-button>
          <el-button v-if="!isEditing" size="small" :icon="EditPen" @click="startEditing">编辑</el-button>
          <el-button v-if="!isEditing && hasContent" size="small" :icon="Delete" @click="confirmClear">清空</el-button>
          <el-button v-if="!isEditing && hasContent" size="small" :icon="Download" @click="exportIdea">导出</el-button>
          <el-button v-if="isEditing" size="small" type="success" @click="saveAndExit" :disabled="!hasContent">保存并退出</el-button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-4">
        <!-- 空状态 -->
        <el-empty v-if="!hasContent && !isEditing" description="暂无灵感描述">
          <el-button type="primary" @click="startEditing">开始撰写</el-button>
        </el-empty>

        <!-- 查看模式 -->
        <div v-else-if="!isEditing" class="idea-content whitespace-pre-wrap text-sm leading-relaxed">
          {{ ideaContent }}
        </div>

        <!-- 编辑模式 -->
        <el-input
          v-else
          v-model="editContent"
          type="textarea"
          :autosize="{ minRows: 20, maxRows: 30 }"
          placeholder="在这里写下您的灵感描述..."
          maxlength="10000"
          show-word-limit
          class="idea-textarea"
        />
      </div>

      <!-- 自动保存提示 -->
      <div v-if="isEditing" class="px-4 py-2 text-xs border-t flex items-center" style="border-color: var(--el-border-color); color: var(--el-text-color-placeholder)">
        <el-icon v-if="isSaving" class="is-loading mr-1"><Loading /></el-icon>
        <span v-if="isSaving">正在保存...</span>
        <span v-else-if="lastSaved">已自动保存 {{ lastSavedText }}</span>
        <span v-else>编辑后 3 秒自动保存</span>
        <span class="ml-auto">{{ editContent.length }} / 10000 字</span>
      </div>

      <!-- AI 生成对话框 -->
      <IdeaGenerateDialog
        v-model:visible="showGenerateDialog"
        :current-content="ideaContent"
        :project-type="projectStore.project?.projectType || 'novel'"
        @success="handleGenerateSuccess"
      />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { EditPen, Delete, Download, Loading, MagicStick } from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import IdeaGenerateDialog from '@/components/IdeaGenerateDialog.vue'

const projectStore = useProjectStore()

// 状态
const showGenerateDialog = ref(false)
const isEditing = ref(false)
const editContent = ref('')
const isSaving = ref(false)
const lastSaved = ref(false)
const lastSavedText = ref('')

// 计算属性
const ideaContent = computed(() => projectStore.project?.idea || '')
const hasContent = computed(() => ideaContent.value.trim().length > 0)

// 防抖定时器
let saveTimer: number | null = null

// 开始编辑
function startEditing(): void {
  editContent.value = ideaContent.value
  isEditing.value = true
  lastSaved.value = false
}

// 保存内容
async function saveContent(): Promise<void> {
  if (!projectStore.project) return

  isSaving.value = true
  try {
    projectStore.updateIdea(editContent.value)
    lastSaved.value = true
    lastSavedText.value = '刚刚'
    setTimeout(() => {
      lastSaved.value = false
    }, 3000)
  } catch (error) {
    console.error('[IdeaPanel] 保存失败:', error)
    ElMessage.error('保存失败，请重试')
  } finally {
    isSaving.value = false
  }
}

// 触发自动保存（防抖）
function triggerAutoSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveContent()
  }, 3000)
}

// 保存并退出编辑模式
function saveAndExit(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveContent().then(() => {
    isEditing.value = false
  })
}

// 确认清空
async function confirmClear(): Promise<void> {
  try {
    await ElMessageBox.confirm('确定要清空灵感内容吗？此操作不可撤销。', '清空确认', {
      confirmButtonText: '确定清空',
      cancelButtonText: '取消',
      type: 'warning'
    })
    projectStore.updateIdea('')
    ElMessage.success('灵感内容已清空')
  } catch {
    // 用户取消
  }
}

// 导出为 .txt 文件
function exportIdea(): void {
  const content = ideaContent.value
  if (!content) {
    ElMessage.warning('没有内容可导出')
    return
  }

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(projectStore.project?.name || '灵感')}.txt`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('灵感已导出')
}

// 监听编辑内容变化，触发自动保存
watch(editContent, () => {
  if (isEditing.value) {
    triggerAutoSave()
  }
})

// 组件销毁前保存
onBeforeUnmount(() => {
  if (saveTimer) clearTimeout(saveTimer)
  if (isEditing.value && editContent.value !== ideaContent.value) {
    // 同步保存（不防抖）
    projectStore.updateIdea(editContent.value)
  }
})

// 处理 AI 生成/修改成功
function handleGenerateSuccess(content: string): void {
  // 如果当前在编辑模式，直接更新编辑内容
  if (isEditing.value) {
    editContent.value = content
  } else {
    // 否则切换到编辑模式并更新内容
    editContent.value = content
    isEditing.value = true
  }
  // 触发自动保存
  triggerAutoSave()
}
</script>

<style scoped>
.idea-panel {
  background: var(--el-bg-color-page);
}

.idea-content {
  white-space: pre-wrap;
  word-break: break-word;
}

.idea-textarea :deep(.el-textarea__inner) {
  font-family: inherit;
  font-size: 14px;
  line-height: 1.6;
}
</style>
