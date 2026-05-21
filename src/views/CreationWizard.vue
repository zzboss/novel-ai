<template>
  <div class="creation-wizard h-screen flex flex-col bg-[var(--el-bg-color)] overflow-y-auto">
    <!-- 顶部进度指示器 -->
    <header class="wizard-header border-b border-[var(--el-border-color)] bg-[var(--el-bg-color)] sticky top-0 z-50">
      <div class="max-w-4xl mx-auto px-6 py-4">
        <!-- 标题和关闭按钮 -->
        <div class="flex items-center justify-between mb-4">
          <h1 class="text-lg font-semibold text-[var(--el-text-color-primary)]">
            📝 新建项目 - 第{{ currentStepIndex }}/{{ totalSteps }}步
          </h1>
          <el-button text bg size="small" @click="handleClose">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>

        <!-- 步骤进度条 -->
        <el-steps
          :active="currentStepIndex - 1"
          finish-status="success"
          align-center
        >
          <el-step
            v-for="step in steps"
            :key="step"
            :title="getStepLabel(step)"
          />
        </el-steps>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="flex-1">
      <div class="max-w-4xl mx-auto px-6 py-8">
        <!-- 类型选择步骤 -->
        <TypeSelectStep v-if="currentStep === 'type-select'" />

        <!-- 灵感描述步骤 -->
        <IdeaStep v-else-if="currentStep === 'idea'" />

        <!-- 世界观创建步骤 -->
        <WorldStep v-else-if="currentStep === 'world'" />

        <!-- 角色创建步骤 -->
        <CharacterStep v-else-if="currentStep === 'character'" />

        <!-- 大纲步骤 -->
        <Outline1Step v-else-if="currentStep === 'outline-1'" />

        <!-- 完成步骤 -->
        <CompleteStep v-else-if="currentStep === 'complete'" />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Close } from '@element-plus/icons-vue'
import { useProjectStore } from '@/stores/project'
import { useAgentStore } from '@/stores/agent'
import type { CreationStep } from '@/stores/project'

// 导入步骤组件
import TypeSelectStep from '@/components/TypeSelectStep.vue'
import IdeaStep from '@/components/IdeaStep.vue'
import WorldStep from '@/components/WorldStep.vue'
import CharacterStep from '@/components/CharacterStep.vue'
import Outline1Step from '@/components/Outline1Step.vue'

// 导入完成步骤组件
import CompleteStep from '@/components/CompleteStep.vue'

const router = useRouter()
const projectStore = useProjectStore()
const agentStore = useAgentStore()

// 所有步骤
const steps: CreationStep[] = [
  'type-select',
  'idea',
  'world',
  'character',
  'outline-1',
  'complete'
]

// 当前步骤
const currentStep = computed(() => projectStore.session?.currentStep || 'type-select')

// 当前步骤索引（从1开始）
const currentStepIndex = computed(() => {
  const index = steps.indexOf(currentStep.value as CreationStep)
  return index >= 0 ? index + 1 : 1
})

// 总步骤数（不包括'complete'）
const totalSteps = computed(() => steps.length - 1)

// 获取步骤标签
function getStepLabel(step: CreationStep): string {
  const labels: Record<CreationStep, string> = {
    'type-select': '选择类型',
    'idea': '灵感描述',
    'world': '世界观',
    'character': '角色',
    'outline-1': '大纲',
    'complete': '完成'
  }
  return labels[step] || step
}

// 关闭向导
async function handleClose(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '确定要退出创建向导吗？已填写的内容会保存到本地，下次可以继续。',
      '提示',
      {
        confirmButtonText: '确定退出',
        cancelButtonText: '继续创建',
        type: 'warning'
      }
    )

    // 用户确定退出，清除会话并返回首页
    projectStore.clearSession()
    router.push('/home')
  } catch {
    // 用户取消，继续创建
  }
}

// 监听步骤变化，自动保存会话
onMounted(() => {
  // 检查是否有未完成的会话
  if (!projectStore.session) {
    ElMessage.warning('创建会话已丢失，请重新开始')
    router.push('/home')
  }
})
</script>

<style scoped>
.creation-wizard {
  background: var(--el-bg-color);
}

.wizard-header {
  backdrop-filter: blur(12px);
}

/* 进度条样式覆盖 */
:deep(.el-steps) {
  .el-step__title {
    font-size: 13px;
  }

  .el-step__icon {
    font-size: 14px;
  }
}
</style>
