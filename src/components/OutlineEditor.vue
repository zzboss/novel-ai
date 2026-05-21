<template>
  <div class="outline-editor h-full flex flex-col">
    <!-- 头部 -->
    <div class="p-4 border-b" style="border-color: var(--el-border-color)">
      <h3 class="text-sm font-medium">大纲规划</h3>
    </div>

    <!-- 大纲编辑区 -->
    <div v-if="projectStore.project" class="flex-1 overflow-y-auto p-4">
      <el-empty v-if="!outlineContent" description="暂无大纲，请使用大纲规划Agent生成" />

      <div v-else>
        <el-input
          v-model="outlineContent"
          type="textarea"
          :rows="20"
          placeholder="大纲内容..."
          @input="onOutlineChange"
        />
      </div>
    </div>

    <div v-else class="flex-1 flex items-center justify-center">
      <el-empty description="请先创建或打开项目" />
    </div>

    <!-- 操作栏 -->
    <div v-if="projectStore.project" class="p-3 border-t flex justify-end gap-2" style="border-color: var(--el-border-color)">
      <el-button size="small" :disabled="!outlineContent" @click="generateOutline">
        <el-icon class="mr-1"><MagicStick /></el-icon>
        使用AI生成
      </el-button>
      <el-button size="small" type="primary" :disabled="!outlineContent" @click="saveOutline">
        保存大纲
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { MagicStick } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useProjectStore } from '@/stores/project'

const projectStore = useProjectStore()
const outlineContent = ref('')

// 加载大纲内容
function loadOutline(): void {
  if (!projectStore.project) return

  // 从项目的第一个卷的第一个章节获取大纲（约定：大纲存储在特定位置）
  // 实际实现中，大纲可能存储在项目元数据中或单独的文件中
  // 这里使用一个简单的实现
  try {
    const outlineData = localStorage.getItem(`outline_${projectStore.project.path}`)
    if (outlineData) {
      outlineContent.value = outlineData
    }
  } catch (error) {
    console.error('加载大纲失败:', error)
  }
}

function onOutlineChange(): void {
  projectStore.markDirty()
}

async function generateOutline(): Promise<void> {
  ElMessage.info('正在启动大纲规划Agent...')
  // TODO: 调用 OutlineAgent
}

function saveOutline(): void {
  if (!projectStore.project) return

  try {
    localStorage.setItem(`outline_${projectStore.project.path}`, outlineContent.value)
    projectStore.markSaved()
    ElMessage.success('大纲已保存')
  } catch (error) {
    console.error('保存大纲失败:', error)
    ElMessage.error('保存失败')
  }
}

onMounted(() => {
  loadOutline()
})
</script>
