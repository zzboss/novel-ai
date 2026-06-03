<template>
  <div class="outline-panel h-full flex flex-col">
    <!-- 头部 -->
    <div class="panel-header shrink-0 flex items-center justify-between px-4 py-2 border-b"
         style="border-color: var(--el-border-color); background: var(--el-bg-color-page)">
      <div class="flex items-center gap-2">
        <el-icon><EditPen /></el-icon>
        <span class="font-semibold text-sm">章节细纲</span>
      </div>
      <div class="flex items-center gap-1">
        <el-tooltip content="AI 生成细纲" placement="top">
          <el-button size="small" type="primary" :loading="generating" @click="onGenerate">
            <el-icon><MagicStick /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="AI 修改细纲" placement="top">
          <el-button size="small" :disabled="!hasContent" @click="onModify">
            <el-icon><Edit /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="清空细纲" placement="top">
          <el-button size="small" :disabled="!hasContent" @click="onClear">
            <el-icon><Delete /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>

    <!-- 结构化表单 -->
    <div class="flex-1 overflow-hidden">
      <ChapterOutlineForm
        :model-value="formData"
        @update:model-value="onFormUpdate"
      />
    </div>

    <!-- AI 生成对话框 -->
    <el-dialog v-model="aiDialogVisible" title="AI 生成章节细纲" width="600px" :close-on-click-modal="false">
      <div class="flex flex-col gap-4">
        <!-- 模型选择 -->
        <div class="flex flex-col gap-2">
          <span class="text-sm font-medium" style="color: var(--el-text-color-regular)">选择模型：</span>
          <ModelSelector v-model="selectedModelId" />
        </div>

        <!-- 章节要求输入 -->
        <div class="flex flex-col gap-2">
          <span class="text-sm font-medium" style="color: var(--el-text-color-regular)">请输入章节要求（可选）：</span>
          <el-input v-model="aiUserInput" type="textarea" :rows="4"
                    placeholder="例如：本章重点描写主角与反派的第一次正面交锋，节奏要紧张..." />
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <el-button @click="aiDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="generating" @click="onConfirmGenerate">生成</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { EditPen, MagicStick, Delete, Edit } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useProjectStore } from '@/stores/project'
import { generateChapterOutlineWithInput, type ChapterOutlineJSON } from '@/stores/agent/generators/chapter'
import { getChapterOutline, upsertChapterOutline } from '@/api/chapterOutline'
import ChapterOutlineForm from './ChapterOutlineForm.vue'
import ModelSelector from './ModelSelector.vue'
import { useSettingsStore } from '@/stores/settings'

const props = defineProps<{
  chapterId: string
  chapterTitle: string
  volumeOutline: string
}>()

const emit = defineEmits<{
  (e: 'update:outline', outline: ChapterOutlineJSON): void
}>()

const projectStore = useProjectStore()
const settingsStore = useSettingsStore()
const generating = ref(false)
const aiDialogVisible = ref(false)
const aiUserInput = ref('')
const selectedModelId = ref('') // 用户选择的模型 ID
const saving = ref(false) // 防止递归保存

// 初始化默认模型
if (settingsStore.activeModel) {
  selectedModelId.value = settingsStore.activeModel.id || ''
}

// 表单数据
const formData = ref<ChapterOutlineJSON>({
  chapterTitle: props.chapterTitle || '',
  chapterNumber: 0,
  coreGoal: '',
  scenes: [],
  plotProgression: '',
  characterDevelopment: '',
  overallForeshadowing: '',
  overallTwists: '',
  nextChapterHook: ''
})

// 是否有内容
const hasContent = computed(() => {
  const d = formData.value
  return d.coreGoal || d.plotProgression || d.characterDevelopment ||
         d.nextChapterHook || d.scenes.length > 0 ||
         d.overallForeshadowing || d.overallTwists
})

// 表单更新
const onFormUpdate = (value: ChapterOutlineJSON) => {
  formData.value = value
  emit('update:outline', value)
  saveToStore()
}

// 保存到数据库（防递归）
const saveToStore = async () => {
  if (!props.chapterId || saving.value) return
  
  saving.value = true
  try {
    // formData.value 是 Vue Proxy，IPC 无法克隆，需先脱敏
    const plainData = JSON.parse(JSON.stringify(formData.value))
    await upsertChapterOutline(props.chapterId, plainData)
  } catch (err) {
    console.error('保存细纲失败:', err)
  } finally {
    saving.value = false
  }
}

// AI 生成
const onGenerate = () => {
  aiUserInput.value = ''
  aiDialogVisible.value = true
}

const onConfirmGenerate = async (): Promise<void> => {
  generating.value = true
  try {
    const project = projectStore.project
    if (!project) throw new Error('项目未加载')

    const characters = project.characters?.map((ch: any) => {
      const parts = [`姓名：${ch.name || '未命名'}`]
      if (ch.role) parts.push(`角色定位：${ch.role}`)
      return parts.join('；')
    }).join('\n') || ''

    const worldSettings = project.worldSettings ? JSON.stringify(project.worldSettings) : ''
    const projectType = project.projectType || 'novel'

    // 使用用户选择的模型，如果没有选择则使用默认模型
    let modelConfig = null
    if (selectedModelId.value) {
      modelConfig = settingsStore.getModelById(selectedModelId.value)
    }
    if (!modelConfig) {
      modelConfig = settingsStore.activeModel
    }
    if (!modelConfig) throw new Error('未配置模型')

    const result = await generateChapterOutlineWithInput(
      props.chapterTitle,
      getChapterNumber(),
      props.volumeOutline,
      [],
      characters,
      worldSettings,
      projectType as any,
      aiUserInput.value || undefined,
      modelConfig
    )

    // 解析 AI 返回的 JSON 字符串
    let parsed: ChapterOutlineJSON
    try {
      parsed = typeof result === 'string' ? JSON.parse(result) : result
    } catch {
      throw new Error('AI 返回的数据格式不正确')
    }

    // 填充表单
    formData.value = {
      ...parsed,
      chapterTitle: props.chapterTitle || parsed.chapterTitle,
      chapterNumber: getChapterNumber()
    }
    emit('update:outline', formData.value)
    saveToStore()

    ElMessage.success('细纲已生成')
    aiDialogVisible.value = false
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : '生成失败'
    ElMessage.error(msg)
  } finally {
    generating.value = false
  }
}

// AI 修改（待实现）
const onModify = () => {
  ElMessage.info('AI 修改功能开发中')
}

// 清空
const onClear = async (): Promise<void> => {
  try {
    await ElMessageBox.confirm('确定要清空章节细纲吗？', '确认', { type: 'warning' })
    formData.value = {
      chapterTitle: props.chapterTitle || '',
      chapterNumber: getChapterNumber(),
      coreGoal: '',
      scenes: [],
      plotProgression: '',
      characterDevelopment: '',
      overallForeshadowing: '',
      overallTwists: '',
      nextChapterHook: ''
    }
    emit('update:outline', formData.value)
    await saveToStore()
    ElMessage.success('已清空')
  } catch {
    // 用户取消
  }
}

// 获取章节号
const getChapterNumber = (): number => {
  const chapter = projectStore.project?.volumes
    ?.flatMap((v: any) => v.chapters)
    ?.find((ch: any) => ch.id === props.chapterId)
  return chapter?.chapterNumber || 1
}

// 加载已保存的细纲
const loadOutline = async () => {
  if (!props.chapterId) return
  try {
    const outline = await getChapterOutline(props.chapterId)
    if (outline) {
      formData.value = {
        ...outline,
        chapterTitle: props.chapterTitle || outline.chapterTitle,
        chapterNumber: outline.chapterNumber || getChapterNumber()
      }
    }
  } catch (err) {
    console.error('加载细纲失败:', err)
  }
}

// 监听 chapterId 变化
watch(() => props.chapterId, () => {
  loadOutline()
})

onMounted(() => {
  loadOutline()
})
</script>

<style scoped>
.outline-panel {
  background: var(--el-bg-color);
  width: 100%;
  min-width: 0;
  overflow: hidden;
}
</style>
