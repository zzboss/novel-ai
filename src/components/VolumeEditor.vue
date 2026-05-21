<template>
  <div class="volume-editor h-full flex flex-col">
    <!-- 头部 -->
    <div class="p-4 border-b flex items-center justify-between" style="border-color: var(--el-border-color)">
      <h3 class="text-sm font-medium">卷信息</h3>
      <div class="flex gap-2">
        <el-button size="small" type="primary" @click="showGenerateDialog = true">
          <el-icon><MagicStick /></el-icon>
          AI 生成
        </el-button>
        <el-button size="small" @click="handleAddVolume">
          <el-icon><Plus /></el-icon>
          新增卷
        </el-button>
      </div>
    </div>

    <!-- AI 生成对话框 -->
    <VolumeGenerateDialog
      :visible="showGenerateDialog"
      :volume-id="volume?.id"
      @update:visible="showGenerateDialog = $event"
      @success="handleGenerateSuccess"
    />

    <div v-if="volume" class="flex-1 overflow-y-auto p-4">
      <!-- 卷名称 -->
      <div class="mb-4">
        <label class="block text-sm font-medium mb-2">卷名称</label>
        <div class="flex gap-2">
          <el-input
            v-model="volumeTitle"
            size="small"
            placeholder="请输入卷名称"
            @blur="saveVolumeTitle"
            @keyup.enter="saveVolumeTitle"
            class="flex-1"
          />
          <el-button
            size="small"
            :icon="MagicStick"
            @click="showTitleDialog = true"
            title="AI 生成卷名称"
          >
            AI 生成
          </el-button>
        </div>

        <!-- 卷名 AI 生成弹框 -->
        <VolumeTitleGenerateDialog
          :visible="showTitleDialog"
          :volume-id="volume?.id"
          @update:visible="showTitleDialog = $event"
          @success="onTitleGenerated"
        />
      </div>

      <!-- 卷内容 -->
      <div class="mb-4">
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-medium">卷内容</label>
          <el-button size="small" @click="isEditing = !isEditing">
            {{ isEditing ? '完成' : '修改' }}
          </el-button>
        </div>
        <!-- 查看模式 -->
        <div v-if="!isEditing" class="p-3 bg-gray-50 rounded min-h-[100px] whitespace-pre-wrap text-sm">
          {{ volume.content || '暂无内容，点击"修改"按钮编辑' }}
        </div>
        <!-- 编辑模式 -->
        <el-input
          v-else
          v-model="volumeContent"
          type="textarea"
          :autosize="{ minRows: 8, maxRows: 32 }"
          placeholder="请输入卷内容..."
          @blur="saveVolumeContent"
        />
      </div>

    </div>

    <div v-else class="flex-1 flex items-center justify-center">
      <el-empty description="请先选择卷" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Plus, MagicStick } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useProjectStore } from '@/stores/project'
import VolumeGenerateDialog from './VolumeGenerateDialog.vue'
import VolumeTitleGenerateDialog from './VolumeTitleGenerateDialog.vue'

const projectStore = useProjectStore()

const volumeTitle = ref('')
const volumeContent = ref('')
const showGenerateDialog = ref(false)
const showTitleDialog = ref(false)
const isEditing = ref(false)

// 获取当前选中的卷
const volume = computed(() => {
  const project = projectStore.project
  if (!project) return null
  return project.volumes.find(v => v.id === projectStore.selectedVolumeId) || null
})

// 监听卷变化，更新表单
watch(volume, (newVolume) => {
  if (newVolume) {
    volumeTitle.value = newVolume.title || ''
    volumeContent.value = newVolume.content || ''
  }
}, { immediate: true })

// 保存卷名称
function saveVolumeTitle(): void {
  if (!volume.value) return
  const newTitle = volumeTitle.value.trim()
  if (!newTitle) {
    ElMessage.warning('卷名称不能为空')
    volumeTitle.value = volume.value.title || ''
    return
  }
  projectStore.updateVolumeTitle(volume.value.id, newTitle)
  ElMessage.success('卷名称已更新')
}

// 保存卷内容
function saveVolumeContent(): void {
  if (!volume.value) return
  projectStore.updateVolumeContent(volume.value.id, volumeContent.value)
  ElMessage.success('卷内容已更新')
}

// 卷名 AI 生成弹框回调
function onTitleGenerated(title: string): void {
  volumeTitle.value = title
  saveVolumeTitle()
  ElMessage.success('卷名称已更新')
}

// 处理 AI 生成成功（卷内容）
function handleGenerateSuccess(volumeData: any): void {
  if (!volume.value) return

  if (volumeData.title) {
    volumeTitle.value = volumeData.title
    projectStore.updateVolumeTitle(volume.value.id, volumeData.title)
  }

  if (volumeData.content) {
    volumeContent.value = volumeData.content
    projectStore.updateVolumeContent(volume.value.id, volumeData.content)
  }

  isEditing.value = false
  ElMessage.success('AI 生成内容已应用到当前卷')
}

// 新增卷
function handleAddVolume(): void {
  const project = projectStore.project
  if (!project) {
    ElMessage.warning('请先打开项目')
    return
  }

  const volumeCount = project.volumes.length + 1
  const defaultTitle = `第${volumeCount}卷`

  try {
    const newVolumeId = projectStore.addVolume(defaultTitle)
    projectStore.setSelectedVolume(newVolumeId)
    ElMessage.success('已新增卷')
  } catch (error: any) {
    ElMessage.error('新增卷失败：' + (error.message || '未知错误'))
  }
}
</script>
