<template>
  <div class="step-navigator">
    <el-steps
      :active="activeStepIndex"
      finish-status="success"
      align-center
      class="steps-container"
    >
      <el-step
        v-for="(step, index) in steps"
        :key="step.value"
        :title="step.label"
        :status="getStepStatus(step.value)"
        @click="handleStepClick(step.value, index)"
      />
    </el-steps>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useProjectStore } from '@/stores/project'
import type { CreationStep, StepStatus } from '@/stores/project'

const projectStore = useProjectStore()

const steps = [
  { value: 'type-select', label: '选择类型' },
  { value: 'idea', label: '灵感描述' },
  { value: 'world', label: '世界观' },
  { value: 'character', label: '角色' },
  { value: 'outline-1', label: '大纲' },
  { value: 'complete', label: '完成' }
]

const currentStep = computed(() => projectStore.session?.currentStep || 'type-select')

const activeStepIndex = computed(() => {
  const index = steps.findIndex(s => s.value === currentStep.value)
  return index >= 0 ? index : 0
})

function getStepStatus(stepValue: string): 'wait' | 'process' | 'finish' | 'error' | 'success' {
  const stepState = projectStore.session?.steps[stepValue as CreationStep]
  if (stepState?.status === StepStatus.COMPLETED) return 'success'
  if (stepState?.status === StepStatus.SKIPPED) return 'error' // 使用 error 状态表示跳过
  const index = steps.findIndex(s => s.value === stepValue)
  if (index === activeStepIndex.value) return 'process'
  return 'wait'
}

function canNavigateTo(step: string): boolean {
  // 可以导航到已完成的步骤，或者当前步骤之前的步骤
  const stepIndex = steps.findIndex(s => s.value === step)
  const currentIndex = steps.findIndex(s => s.value === currentStep.value)
  return stepIndex <= currentIndex || isStepCompleted(step)
}

function isStepCompleted(step: string): boolean {
  const stepState = projectStore.session?.steps[step as CreationStep]
  return stepState?.status === StepStatus.COMPLETED
}

function handleStepClick(step: string, index: number): void {
  if (canNavigateTo(step)) {
    projectStore.goToStep(step as CreationStep)
  }
}
</script>

<style scoped>
.step-navigator {
  width: 100%;
  padding: 20px 0;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color);
}

.steps-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 20px;
}

/* 确保步骤可点击 */
:deep(.el-step__head) {
  cursor: pointer;
}
</style>
