<template>
  <el-dialog 
    v-model="visible"
    title="导出项目"
    width="500px"
    :append-to-body="true"
  >
    <!-- 导出格式选择 -->
    <div class="mb-4">
      <div class="text-sm mb-2 text-[var(--el-text-color-secondary)]">导出格式</div>
      <el-radio-group v-model="exportFormat">
        <el-radio-button value="txt">TXT</el-radio-button>
        <el-radio-button value="md">Markdown</el-radio-button>
        <el-radio-button value="json">JSON</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 导出选项 -->
    <div class="mb-4" v-if="exportFormat === 'txt' || exportFormat === 'md'">
      <div class="text-sm mb-2 text-[var(--el-text-color-secondary)]">导出范围</div>
      <el-radio-group v-model="exportScope">
        <el-radio value="all">全书</el-radio>
        <el-radio value="current">当前章节</el-radio>
        <el-radio value="selected">选中章节</el-radio>
      </el-radio-group>
    </div>

    <!-- 文件名 -->
    <div class="mb-4">
      <div class="text-sm mb-2 text-[var(--el-text-color-secondary)]">文件名</div>
      <el-input v-model="filename" placeholder="请输入文件名" />
    </div>

    <!-- 导出进度 -->
    <div v-if="exporting" class="mb-4">
      <el-progress :percentage="exportProgress" />
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="exporting" @click="doExport">
        导出
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useProjectStore } from '@/stores/project'

const projectStore = useProjectStore()

const visible = ref(false)
const exporting = ref(false)
const exportProgress = ref(0)
const exportFormat = ref<'txt' | 'md' | 'json'>('txt')
const exportScope = ref<'all' | 'current' | 'selected'>('all')
const filename = ref('')

/**
 * 显示导出对话框
 */
function show(): void {
  visible.value = true
  exporting.value = false
  exportProgress.value = 0
  filename.value = projectStore.project?.name || '未命名项目'
}

/**
 * 执行导出
 */
async function doExport(): Promise<void> {
  if (!filename.value) {
    ElMessage.warning('请输入文件名')
    return
  }
  
  exporting.value = true
  exportProgress.value = 0
  
  try {
    const projectPath = projectStore.projectPath
    if (!projectPath) {
      throw new Error('项目路径未设置')
    }
    
    let result: any = { success: false }
    
    if (exportFormat.value === 'txt') {
      // 导出为 TXT
      const content = buildTextContent()
      result = await window.electronAPI?.exportTxt(projectPath, content, filename.value)
    } else if (exportFormat.value === 'md') {
      // 导出为 Markdown
      const chapters = getChaptersToExport()
      result = await window.electronAPI?.exportMarkdown(projectPath, chapters, filename.value)
    } else if (exportFormat.value === 'json') {
      // 导出为 JSON
      const data = projectStore.project
      result = await window.electronAPI?.exportJson(projectPath, data, filename.value)
    }
    
    exportProgress.value = 100
    
    if (result?.success) {
      ElMessage.success('导出成功')
      visible.value = false
    } else {
      throw new Error(result?.error || '导出失败')
    }
  } catch (error: any) {
    console.error('导出失败:', error)
    ElMessage.error(`导出失败: ${error.message}`)
  } finally {
    exporting.value = false
  }
}

/**
 * 构建文本内容
 */
function buildTextContent(): string {
  const project = projectStore.project
  if (!project) return ''
  
  let content = `${project.name || '未命名项目'}\n\n`
  
  const chapters = getChaptersToExport()
  for (const chapter of chapters) {
    content += `【${chapter.title || '未命名章节'}】\n\n`
    content += `${chapter.content || ''}\n\n`
  }
  
  return content
}

/**
 * 获取要导出的章节
 */
function getChaptersToExport(): any[] {
  const project = projectStore.project
  if (!project) return []
  
  const chapters = project.chapters || []
  
  if (exportScope.value === 'all') {
    return chapters
  } else if (exportScope.value === 'current') {
    const currentId = projectStore.currentChapterId
    return currentId ? chapters.filter((c: any) => c.id === currentId) : []
  } else {
    // 选中章节（需要实现选中功能）
    return chapters
  }
}

defineExpose({
  show
})
</script>
