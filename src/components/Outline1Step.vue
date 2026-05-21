<template>
  <div class="outline1-step">
    <h2>大纲创建</h2>
    <p class="step-description">按{{ unitName }}生成大纲，逐步构建故事结构。</p>

    <!-- 已生成的卷列表 -->
    <div v-if="volumes.length > 0" class="volumes-list">
      <div v-for="(vol, idx) in volumes" :key="idx" class="volume-card">
        <div class="volume-header">
          <h3>第{{ idx + 1 }}{{ unitName }}<template v-if="vol.title">：{{ vol.title }}</template></h3>
          <div class="volume-actions">
            <el-button size="small" @click="editVolume(idx)">✏️ 编辑</el-button>
            <el-button
          v-if="idx === volumes.length - 1"
          size="small"
          type="danger"
          plain
          @click="removeVolume(idx)"
        >🗑️ 删除</el-button>
          </div>
        </div>
        <div class="volume-content" v-html="renderMarkdown(vol.content)"></div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="volumes.length === 0 && !isGenerating" class="empty-state">
      <p>还没有创建任何{{ unitName }}，点击下方按钮开始生成。</p>
    </div>

    <!-- 生成中状态 -->
    <div v-if="isGenerating" class="generating-section">
      <div class="generating-header">
        <el-icon class="is-loading" :size="20"><Loading /></el-icon>
        <span>正在生成第{{ currentVolumeIndex }}{{ unitName }}大纲...</span>
      </div>
      <div v-if="streamingContent" class="streaming-content">
        <el-input
          v-model="streamingContent"
          type="textarea"
          :autosize="{ minRows: 8, maxRows: 20 }"
          readonly
          class="streaming-textarea"
        />
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="outline-actions">
      <el-button
        type="primary"
        :disabled="isGenerating"
        @click="openVolumeDialog"
      >
        ➕ 生成下一{{ unitName }}
      </el-button>
      <el-button
        :disabled="isGenerating"
        @click="openManualDialog"
      >
        ✍️ 手动添加{{ unitName }}
      </el-button>
    </div>

    <!-- 生成下一卷弹框 -->
    <el-dialog
      v-model="volumeDialogVisible"
      :title="`生成第${currentVolumeIndex}${unitName}`"
      width="560px"
      :close-on-click-modal="false"
      @opened="focusInput"
    >
      <div class="dialog-body">
        <p class="dialog-hint">
          描述您对第{{ currentVolumeIndex }}{{ unitName }}的设想，AI 将优化您的想法并生成大纲。
          <br />留空则由 AI 自主生成。
        </p>
        <el-input
          ref="dialogInputRef"
          v-model="volumeUserInput"
          type="textarea"
          :autosize="{ minRows: 4, maxRows: 10 }"
          :placeholder="`例如：第${currentVolumeIndex}${unitName}是故事的开端，主角发现了一个秘密...`"
        />
      </div>
      <template #footer>
        <el-button @click="volumeDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="isGenerating" @click="handleGenerateVolume">
          🤖 生成大纲
        </el-button>
      </template>
    </el-dialog>

    <!-- 手动添加弹框 -->
    <el-dialog
      v-model="manualDialogVisible"
      :title="`手动添加第${currentVolumeIndex}${unitName}`"
      width="560px"
      :close-on-click-modal="false"
      @opened="focusManualInput"
    >
      <div class="dialog-body">
        <p class="dialog-hint">输入第{{ currentVolumeIndex }}{{ unitName }}的标题和大纲内容。</p>
        <el-input
          v-model="manualVolumeTitle"
          placeholder="请输入标题（可选，例如：破晓、风起云涌）"
          :maxlength="30"
          show-word-limit
          clearable
          class="volume-title-input"
        />
        <el-input
          ref="manualInputRef"
          v-model="manualVolumeContent"
          type="textarea"
          :autosize="{ minRows: 6, maxRows: 15 }"
          :placeholder="`第${currentVolumeIndex}${unitName}的大纲内容...`"
        />
      </div>
      <template #footer>
        <el-button @click="manualDialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!manualVolumeContent.trim()" @click="handleManualAdd">
          确认添加
        </el-button>
      </template>
    </el-dialog>

    <!-- 编辑弹框 -->
    <el-dialog
      v-model="editDialogVisible"
      :title="`编辑第${editingIndex + 1}${unitName}`"
      width="560px"
      :close-on-click-modal="false"
    >
      <div class="dialog-body">
        <p class="dialog-hint">修改第{{ editingIndex + 1 }}{{ unitName }}的标题和大纲内容。</p>
        <el-input
          v-model="editingTitle"
          placeholder="请输入标题（可选）"
          :maxlength="30"
          show-word-limit
          clearable
        />
        <el-input
          v-model="editingContent"
          type="textarea"
          :autosize="{ minRows: 8, maxRows: 20 }"
        />
      </div>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleEditSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 步骤操作 -->
    <div class="step-actions">
      <el-button @click="handlePrev">上一步</el-button>
      <el-button type="warning" plain @click="handleSkip">跳过此步骤</el-button>
      <el-button
        type="primary"
        :disabled="volumes.length === 0"
        @click="handleNext"
      >
        下一步
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useProjectStore } from '@/stores/project'
import { useAgentStore } from '@/stores/agent'
import { StepInputMode, StepStatus, ProjectType, ChapterStatus } from '@/stores/project'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'

const projectStore = useProjectStore()
const agentStore = useAgentStore()

/** 卷数据（增加 id 和 chapters 字段，保留章节信息） */
interface VolumeData {
  id: string
  title: string
  content: string
  chapters: Array<{ id: string; title: string; wordCount: number; status: ChapterStatus }>
}

const volumes = ref<VolumeData[]>([])
const isGenerating = ref(false)
const streamingContent = ref('')

// 弹框状态
const volumeDialogVisible = ref(false)
const volumeUserInput = ref('')
const manualDialogVisible = ref(false)
const manualVolumeTitle = ref('')
const manualVolumeContent = ref('')
const editDialogVisible = ref(false)
const editingIndex = ref(-1)
const editingTitle = ref('')
const editingContent = ref('')

// ref
const dialogInputRef = ref()
const manualInputRef = ref()

const unitName = computed(() => {
  const type = projectStore.session?.projectType || ProjectType.NOVEL
  return type === ProjectType.NOVEL ? '卷' : type === ProjectType.SHORT_STORY ? '部分' : '集'
})

/** 当前卷序号 */
const currentVolumeIndex = computed(() => volumes.value.length + 1)

/** 简易 markdown 渲染（仅处理标题和加粗） */
function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}

// === 弹框操作 ===

function openVolumeDialog() {
  volumeUserInput.value = ''
  volumeDialogVisible.value = true
}

function openManualDialog() {
  manualVolumeTitle.value = ''
  manualVolumeContent.value = ''
  manualDialogVisible.value = true
}

function focusInput() {
  dialogInputRef.value?.focus()
}

function focusManualInput() {
  manualInputRef.value?.focus()
}

function editVolume(idx: number) {
  editingIndex.value = idx
  editingTitle.value = volumes.value[idx].title
  editingContent.value = volumes.value[idx].content
  editDialogVisible.value = true
}

async function handleEditSave() {
  if (editingIndex.value >= 0 && editingContent.value.trim()) {
    volumes.value[editingIndex.value].title = editingTitle.value.trim()
    volumes.value[editingIndex.value].content = editingContent.value.trim()
    saveToStore()
    // 等待保存到数据库完成
    await projectStore.saveProjectToFile()
    editDialogVisible.value = false
    ElMessage.success('已更新并保存')
  }
}

async function removeVolume(idx: number) {
  volumes.value.splice(idx, 1)
  saveToStore()
  // 保存到数据库
  await projectStore.saveProjectToFile()
  ElMessage.success('已删除')
}

// === 生成逻辑 ===

async function handleGenerateVolume() {
  volumeDialogVisible.value = false

  const idea = projectStore.session?.steps['idea']?.content || ''
  const worldSettings = projectStore.session?.steps['world']?.content || ''
  const characters = projectStore.session?.steps['character']?.content || ''

  isGenerating.value = true
  streamingContent.value = ''

  try {
    const existingContents = volumes.value.map(v => v.content)
    const result = await agentStore.generateOutline1Volume(
      idea,
      worldSettings,
      characters,
      projectStore.session?.projectType || ProjectType.NOVEL,
      currentVolumeIndex.value,
      volumeUserInput.value || undefined,
      existingContents.length > 0 ? existingContents : undefined
    )

    // 直接创建 VolumeData，标题使用简单格式（如"第一卷"），用户可后续编辑
    volumes.value.push({
      id: `vol-${Date.now()}`,
      title: `${currentVolumeIndex.value}${unitName.value}`, // 如"第一卷"
      content: result.trim(),
      chapters: []
    })
    saveToStore()
    // 保存到数据库
    await projectStore.saveProjectToFile()
    ElMessage.success(`第${volumes.value.length}${unitName.value}大纲已生成`)
  } catch (error) {
    ElMessage.error('生成失败，请重试')
  } finally {
    isGenerating.value = false
    streamingContent.value = ''
  }
}

async function handleManualAdd() {
  if (!manualVolumeContent.value.trim()) {
    ElMessage.warning('请输入内容')
    return
  }
  // 新增卷时补全 id 和空 chapters 数组
  volumes.value.push({
    id: `vol-${Date.now()}`,
    title: manualVolumeTitle.value.trim(),
    content: manualVolumeContent.value.trim(),
    chapters: []
  })
  saveToStore()
  // 保存到数据库
  await projectStore.saveProjectToFile()
  manualDialogVisible.value = false
  manualVolumeTitle.value = ''
  ElMessage.success(`第${volumes.value.length}${unitName.value}已添加`)
}

// === 存储 ===

function saveToStore() {
  // 保存完整卷数据（含 id 和章节）到 stepState
  const fullVolumes: VolumeData[] = volumes.value.map(v => ({
    id: v.id,
    title: v.title,
    content: v.content,
    chapters: v.chapters ? [...v.chapters] : []
  }))

  // 更新步骤状态（会自动保存到缓存）
  // 注意：不存储 content 合并文本，每卷内容已存储在 volumes[*].content 中
  projectStore.updateStepState('outline-1', {
    mode: StepInputMode.AI,
    status: volumes.value.length > 0 ? StepStatus.COMPLETED : StepStatus.PENDING,
    volumes: fullVolumes
  })
}

// === 恢复状态 ===

onMounted(() => {
  const stepState = projectStore.session?.steps['outline-1']
  const savedVols = stepState?.volumes || []
  volumes.value = savedVols.map((v: any) => ({
    id: v.id ,
    title: v.title || '',
    content: v.content || '',
    chapters: v.chapters || []
  }))
})

// === 步骤导航 ===

function handlePrev() {
  projectStore.goToPrevStep()
}

function handleSkip() {
  projectStore.skipCurrentStep()
}

function handleNext() {
  if (volumes.value.length === 0) return
  saveToStore()
  projectStore.completeCurrentStep()
}
</script>

<style scoped>
.outline1-step {
  max-width: 800px;
  margin: 0 auto;
  padding: 40px 20px;
}

h2 {
  text-align: center;
  margin-bottom: 10px;
  color: var(--el-text-color-primary);
}

.step-description {
  text-align: center;
  color: var(--el-text-color-secondary);
  margin-bottom: 30px;
  font-size: 14px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border-radius: 8px;
  margin-bottom: 20px;
}

.volumes-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

.volume-card {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 16px 20px;
  background: var(--el-bg-color);
}

.volume-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.volume-header h3 {
  margin: 0;
  color: var(--el-text-color-primary);
  font-size: 16px;
}

.volume-actions {
  display: flex;
  gap: 8px;
}

.volume-content {
  line-height: 1.7;
  color: var(--el-text-color-regular);
  font-size: 14px;
  max-height: 300px;
  overflow-y: auto;
  padding-right: 4px;
}

.volume-content :deep(h2),
.volume-content :deep(h3),
.volume-content :deep(h4) {
  margin: 8px 0 4px;
  color: var(--el-text-color-primary);
}

.generating-section {
  margin-bottom: 24px;
}

.generating-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: var(--el-color-primary);
  font-size: 14px;
}

.streaming-content {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 12px;
  background: var(--el-fill-color-lighter);
}

.streaming-textarea :deep(.el-textarea__inner) {
  background: transparent;
  box-shadow: none;
  font-size: 14px;
  line-height: 1.6;
}

.outline-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 30px;
}

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dialog-hint {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.volume-title-input {
  margin-bottom: 12px;
}

.step-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid var(--el-border-color);
}

@media (max-width: 768px) {
  .outline1-step {
    padding: 20px 10px;
  }

  .volume-card {
    padding: 12px;
  }

  .outline-actions {
    flex-direction: column;
  }
}
</style>
