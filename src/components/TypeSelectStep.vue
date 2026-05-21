<template>
  <div class="type-select-step">
    <h2>选择项目类型</h2>
    <p class="step-description">请选择您要创建的项目类型，不同类型将使用不同的创建流程和优化策略。</p>
    
    <div class="type-options">
      <el-card
        v-for="option in typeOptions"
        :key="option.value"
        class="type-card"
        :class="{ 'selected': selectedType === option.value }"
        shadow="hover"
        @click="selectedType = option.value"
      >
        <div class="type-icon">{{ option.icon }}</div>
        <h3 class="type-title">{{ option.label }}</h3>
        <p class="type-description">{{ option.description }}</p>
        <ul class="type-features">
          <li v-for="feature in option.features" :key="feature">
            <el-icon class="feature-check"><Check /></el-icon>
            {{ feature }}
          </li>
        </ul>
      </el-card>
    </div>
    
    <div class="step-actions">
      <el-button
        type="primary"
        size="large"
        :disabled="!selectedType"
        @click="handleNext"
      >
        下一步
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useProjectStore } from '@/stores/project'
import { ProjectType } from '@/stores/project'
import { Check } from '@element-plus/icons-vue'

const projectStore = useProjectStore()

const selectedType = ref<ProjectType | null>(null)

const typeOptions = [
  {
    value: ProjectType.NOVEL,
    icon: '📚',
    label: '长篇小说',
    description: '传统长篇小说，适合复杂剧情和多角色展开',
    features: ['分卷结构', '详细大纲', '多角色发展', '章节管理']
  },
  {
    value: ProjectType.SHORT_STORY,
    icon: '📝',
    label: '短篇故事',
    description: '短篇故事，适合快速创作和单一主题表达',
    features: ['简洁结构', '快速创作', '单一主题', '场景管理']
  },
  {
    value: ProjectType.SCRIPT,
    icon: '🎬',
    label: '短剧剧本',
    description: '短剧剧本，适合视频平台的分集剧本创作',
    features: ['分集结构', '场景描述', '对话为主', '集数管理']
  }
]

function handleNext() {
  if (!selectedType.value) return
  
  projectStore.setProjectType(selectedType.value)
  projectStore.completeCurrentStep()
}
</script>

<style scoped>
.type-select-step {
  max-width: 900px;
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
  margin-bottom: 40px;
  font-size: 14px;
}

.type-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 40px;
}

.type-card {
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.type-card:hover {
  border-color: var(--el-color-primary-light-5);
}

.type-card.selected {
  border-color: var(--el-color-primary);
}

.type-icon {
  font-size: 48px;
  text-align: center;
  margin-bottom: 16px;
}

.type-title {
  text-align: center;
  margin-bottom: 12px;
  color: var(--el-text-color-primary);
}

.type-description {
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 14px;
  margin-bottom: 16px;
}

.type-features {
  list-style: none;
  padding: 0;
  margin: 0;
}

.type-features li {
  padding: 6px 0;
  color: var(--el-text-color-regular);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.feature-check {
  color: var(--el-color-success);
  font-size: 12px;
}

.step-actions {
  display: flex;
  justify-content: center;
}
</style>
