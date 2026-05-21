<template>
  <div class="complete-step">
    <!-- 成功图标 -->
    <div class="success-icon">
      <el-icon :size="64" color="#67C23A"><CircleCheckFilled /></el-icon>
    </div>

    <h2 class="success-title">项目创建完成！</h2>
    <p class="success-description">您的项目已成功创建，现在可以开始创作了。</p>

    <!-- 项目信息 -->
    <el-card class="project-info-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span>📋 项目信息</span>
        </div>
      </template>

      <el-descriptions :column="1" border>
        <el-descriptions-item label="项目名称">
          {{ projectStore.session?.projectName || '未命名' }}
        </el-descriptions-item>
        <el-descriptions-item label="项目类型">
          {{ getProjectTypeLabel(projectStore.session?.projectType) }}
        </el-descriptions-item>
        <el-descriptions-item label="灵感描述">
          <el-tag v-if="ideaStatus === StepStatus.COMPLETED" type="success" size="small">已完成</el-tag>
          <el-tag v-else-if="ideaStatus === StepStatus.SKIPPED" type="info" size="small">已跳过</el-tag>
          <span v-else class="text-muted">未完成</span>
        </el-descriptions-item>
        <el-descriptions-item label="世界观">
          <el-tag v-if="worldStatus === StepStatus.COMPLETED" type="success" size="small">已完成</el-tag>
          <el-tag v-else-if="worldStatus === StepStatus.SKIPPED" type="info" size="small">已跳过</el-tag>
          <span v-else class="text-muted">未完成</span>
        </el-descriptions-item>
        <el-descriptions-item label="角色">
          <el-tag v-if="characterStatus === StepStatus.COMPLETED" type="success" size="small">已完成</el-tag>
          <el-tag v-else-if="characterStatus === StepStatus.SKIPPED" type="info" size="small">已跳过</el-tag>
          <span v-else class="text-muted">未完成</span>
        </el-descriptions-item>
        <el-descriptions-item label="大纲">
          <el-tag v-if="outline1Status === StepStatus.COMPLETED" type="success" size="small">已完成</el-tag>
          <el-tag v-else-if="outline1Status === StepStatus.SKIPPED" type="info" size="small">已跳过</el-tag>
          <span v-else class="text-muted">未完成</span>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- 提示信息 -->
    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="info-alert"
    >
      <template #title>提示</template>
      <template #default>
        <p>首章创作请在创作台完成。</p>
        <p>您可以稍后在创作台中继续完善世界观、角色和大纲。</p>
      </template>
    </el-alert>

    <!-- 操作按钮 -->
    <div class="step-actions">
      <el-button
        type="primary"
        size="large"
        @click="enterWorkbench"
      >
        <el-icon class="mr-1"><EditPen /></el-icon>
        进入创作台
      </el-button>
      <el-button
        size="large"
        @click="finishLater"
      >
        稍后再说
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { CircleCheckFilled, EditPen } from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import type { CreationStep, StepState } from '@/stores/project'
import { StepStatus, ProjectType } from '@/stores/project'

const router = useRouter()
const projectStore = useProjectStore()

// 获取步骤状态
function getStepStatus(step: CreationStep): StepStatus {
  const stepState: StepState | undefined = projectStore.session?.steps[step]
  return stepState?.status || StepStatus.PENDING
}

const ideaStatus = computed(() => getStepStatus('idea' as CreationStep))
const worldStatus = computed(() => getStepStatus('world' as CreationStep))
const characterStatus = computed(() => getStepStatus('character' as CreationStep))
const outline1Status = computed(() => getStepStatus('outline-1' as CreationStep))

// 获取项目类型标签
function getProjectTypeLabel(type?: ProjectType): string {
  const labels: Record<ProjectType, string> = {
    [ProjectType.NOVEL]: '长篇小说',
    [ProjectType.SHORT_STORY]: '短篇故事',
    [ProjectType.SCRIPT]: '短剧剧本'
  }
  return type ? labels[type] || type : '未知'
}

// 进入创作台
async function enterWorkbench(): Promise<void> {
  try {
    // 从创建会话生成项目状态
    const projectState = projectStore.generateProjectState()
    if (!projectState) {
      ElMessage.error('生成项目状态失败')
      return
    }

    // 保存项目到文件（深拷贝以剥离 Vue 响应式代理，否则 IPC 无法克隆）
    await window.electronAPI.createProject(projectState.path, JSON.parse(JSON.stringify(projectState)))

    // 打开项目（加载到 store）
    await projectStore.openProject(projectState.path)

    // 保存世界观内容到文件
    const worldStep = projectStore.session?.steps['world']
    if (worldStep?.content) {
      // TODO: 将世界观内容保存到 world.md 文件
    }

    // 保存角色内容到文件
    const characterStep = projectStore.session?.steps['character']
    if (characterStep?.content) {
      // TODO: 将角色内容保存到 characters.md 文件
    }

    // 保存大纲内容到文件
    const outline1Step = projectStore.session?.steps['outline-1']
    if (outline1Step?.content) {
      // TODO: 将大纲内容保存到 outline.md 文件
    }

    // 清除创建会话
    projectStore.clearSession()

    ElMessage.success('项目创建成功！')
    router.push('/workbench')
  } catch (error) {
    console.error('创建项目失败:', error)
    ElMessage.error(`创建项目失败: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// 稍后再说
function finishLater(): void {
  // 清除创建会话
  projectStore.clearSession()
  router.push('/home')
}
</script>

<style scoped>
.complete-step {
  max-width: 800px;
  margin: 0 auto;
  padding: 40px 20px;
  text-align: center;
}

.success-icon {
  margin-bottom: 24px;
}

.success-title {
  text-align: center;
  margin-bottom: 10px;
  color: var(--el-text-color-primary);
  font-size: 28px;
}

.success-description {
  text-align: center;
  color: var(--el-text-color-secondary);
  margin-bottom: 40px;
  font-size: 14px;
}

.project-info-card {
  margin-bottom: 24px;
  text-align: left;
}

.card-header {
  display: flex;
  align-items: center;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.text-muted {
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}

.info-alert {
  margin-bottom: 32px;
  text-align: left;
}

.info-alert p {
  margin: 4px 0;
  font-size: 13px;
}

.step-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
}

.mr-1 {
  margin-right: 4px;
}
</style>
