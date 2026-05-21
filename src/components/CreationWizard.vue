<template>
  <div class="creation-wizard">
    <!-- 步骤导航 -->
    <StepNavigator v-if="showNavigator" />
    
    <!-- 步骤内容 -->
    <div class="step-content">
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
      <div v-else-if="currentStep === 'complete'" class="completion-step">
        <div class="success-icon">🎉</div>
        <h2>创建完成！</h2>
        <p class="completion-message">您的项目已准备就绪，即将进入编辑器。</p>
        
        <el-card class="project-summary" shadow="hover">
          <template #header>
            <div class="card-header">
              <h3>项目概要：</h3>
              <el-button type="primary" size="small" @click="showEditNameDialog = true">
                ✏️ 修改名称
              </el-button>
            </div>
          </template>
          
          <el-descriptions :column="1" border>
            <el-descriptions-item label="项目名称">{{ projectName }}</el-descriptions-item>
            <el-descriptions-item label="项目类型">{{ projectTypeLabel }}</el-descriptions-item>
            <el-descriptions-item label="灵感描述">{{ ideaSummary }}</el-descriptions-item>
            <el-descriptions-item label="世界观设定">{{ worldSummary }}</el-descriptions-item>
            <el-descriptions-item label="角色设定">{{ characterSummary }}</el-descriptions-item>
            <el-descriptions-item label="大纲">{{ outline1Summary }}</el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 修改项目名称对话框 -->
        <el-dialog
          v-model="showEditNameDialog"
          title="修改项目名称"
          width="400px"
        >
          <el-input
            v-model="editingProjectName"
            placeholder="请输入新的项目名称"
            maxlength="50"
            show-word-limit
          />
          <template #footer>
            <el-button @click="showEditNameDialog = false">取消</el-button>
            <el-button type="primary" @click="handleSaveProjectName">保存</el-button>
          </template>
        </el-dialog>
        
        <div class="completion-actions">
          <el-button @click="handleEdit">继续编辑</el-button>
          <el-button type="primary" @click="handleConfirm">进入编辑器</el-button>
        </div>
      </div>
    </div>
    
    <!-- AI 处理进度 -->
    <el-dialog
      v-model="isAiProcessing"
      title=""
      width="300px"
      :show-close="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
    >
      <div class="ai-progress">
        <el-icon class="is-loading" :size="40">
          <Loading />
        </el-icon>
        <p class="progress-message">{{ aiProgressMessage }}</p>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useProjectStore } from '@/stores/project'
import { useAgentStore } from '@/stores/agent'
import { ProjectType } from '@/stores/project'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import StepNavigator from './StepNavigator.vue'
import TypeSelectStep from './TypeSelectStep.vue'
import IdeaStep from './IdeaStep.vue'
import WorldStep from './WorldStep.vue'
import CharacterStep from './CharacterStep.vue'
import Outline1Step from './Outline1Step.vue'

const projectStore = useProjectStore()
const agentStore = useAgentStore()
const router = useRouter()

const currentStep = computed(() => projectStore.session?.currentStep || 'type-select')
const isAiProcessing = computed(() => agentStore.isAiProcessing)
const aiProgressMessage = computed(() => agentStore.aiProgressMessage)

const showNavigator = computed(() => {
  return currentStep.value !== 'type-select' && currentStep.value !== null
})

// 完成步骤的计算属性
const projectName = computed(() => projectStore.session?.projectName || '')
const projectTypeLabel = computed(() => {
  const type = projectStore.session?.projectType || ProjectType.NOVEL
  const labels: Record<ProjectType, string> = {
    [ProjectType.NOVEL]: '长篇小说',
    [ProjectType.SHORT_STORY]: '短篇故事',
    [ProjectType.SCRIPT]: '短剧剧本'
  }
  return labels[type] || type
})

const ideaSummary = computed(() => {
  const content = projectStore.session?.steps['idea']?.content || ''
  return content ? content.substring(0, 100) + (content.length > 100 ? '...' : '') : '未设置'
})

const worldSummary = computed(() => {
  const content = projectStore.session?.steps['world']?.content || ''
  return content ? content.substring(0, 100) + (content.length > 100 ? '...' : '') : '未设置'
})

const characterSummary = computed(() => {
  const content = projectStore.session?.steps['character']?.content || ''
  return content ? content.substring(0, 100) + (content.length > 100 ? '...' : '') : '未设置'
})

const outline1Summary = computed(() => {
  const volumes = (projectStore.session?.steps['outline-1'] as any)?.volumes || []
  if (volumes.length === 0) return '未设置'
  
  // 从 volumes 生成摘要
  const summary = volumes
    .map((v: any, i: number) => {
      const title = v.title ? `${i + 1}. ${v.title}` : `第${i + 1}卷`
      const contentPreview = v.content ? v.content.substring(0, 30) + (v.content.length > 30 ? '...' : '') : ''
      return contentPreview ? `${title}：${contentPreview}` : title
    })
    .join('\n')
  
  return summary.length > 100 ? summary.substring(0, 100) + '...' : summary
})

// 项目名称编辑相关
const showEditNameDialog = ref(false)
const editingProjectName = ref('')

function handleEdit() {
  projectStore.goToStep('idea')
}

function handleSaveProjectName() {
  if (!editingProjectName.value.trim()) {
    ElMessage.warning('项目名称不能为空')
    return
  }
  
  projectStore.updateProjectName(editingProjectName.value.trim())
  showEditNameDialog.value = false
  ElMessage.success('项目名称已更新')
}

async function handleConfirm() {
  // 检查是否为编辑模式
  const isEditMode = projectStore.session?.isEditMode || false
  
  try {
    if (isEditMode) {
      // 编辑模式：更新现有项目
      if (!projectStore.project) {
        ElMessage.error('项目未加载')
        return
      }
      
      // 从session.steps中获取更新后的数据
      const ideaStep = projectStore.session?.steps['idea']
      const worldStep = projectStore.session?.steps['world']
      const characterStep = projectStore.session?.steps['character']
      const outline1Step = projectStore.session?.steps['outline-1']
      
      // 更新灵感描述
      if (ideaStep?.content) {
        projectStore.project.idea = ideaStep.content
      }
      
      // 更新世界观设定（这里需要解析worldStep.content，或者直接使用）
      if (worldStep?.content) {
        // 简单处理：直接保存到worldSettings.rules
        projectStore.project.worldSettings.rules = worldStep.content
      }

      // 更新大纲/卷结构
      if (outline1Step) {
        const now = Date.now()
        const newVolumes: Array<{ id: string; title: string; chapters: any[] }> = []

        // 优先从 outline1Step.volumes 获取（Outline1Step.vue 保存的完整数据，含 id 和 chapters）
        const stepVolumes = (outline1Step as any).volumes
        // 原始项目卷数据（作为匹配兜底）
        const originalProjectVolumes = projectStore.project.volumes || []
        
        console.log('[handleConfirm] outline1Step:', {
          hasContent: !!outline1Step.content,
          stepVolumesLength: stepVolumes?.length || 0,
          stepVolumes: stepVolumes?.map((v: any) => ({
            id: v.id,
            title: v.title,
            hasContent: !!v.content,
            chaptersCount: v.chapters?.length || 0
          }))
        })
        console.log('[handleConfirm] originalProjectVolumes:', originalProjectVolumes.map((v: any) => ({
          id: v.id,
          title: v.title,
          chaptersCount: v.chapters?.length || 0
        })))

        if (stepVolumes && stepVolumes.length > 0) {
          // 直接使用 Outline1Step 保存的卷数据，章节信息已在其中
          for (let i = 0; i < stepVolumes.length; i++) {
            const sv = stepVolumes[i]
            // 构造完整的卷标题（如 "第一卷：破晓" 或 "第一卷"）
            const subtitle = (sv.title || '').replace(/^第\d+[卷部分集]\s*[：:]\s*/, '').trim()
            const unitLabel = projectStore.project.projectType === ProjectType.SCRIPT ? '集' : projectStore.project.projectType === ProjectType.SHORT_STORY ? '部分' : '卷'
            const fullTitle = subtitle ? `第${i + 1}${unitLabel}：${subtitle}` : `第${i + 1}${unitLabel}`

            // 如果 sv.chapters 为空，尝试从原始项目卷中恢复
            let chapters = sv.chapters || []
            if (chapters.length === 0) {
              // 尝试通过 id 匹配
              let matchedVol = originalProjectVolumes.find((v: any) => v.id === sv.id)
              // 尝试通过标题匹配
              if (!matchedVol) {
                matchedVol = originalProjectVolumes.find((v: any) => v.title === fullTitle)
              }
              // 尝试通过索引匹配
              if (!matchedVol && i < originalProjectVolumes.length) {
                matchedVol = originalProjectVolumes[i]
              }
              if (matchedVol) {
                chapters = matchedVol.chapters || []
                console.log(`[handleConfirm] 从原始项目恢复卷 ${i + 1} 的 chapters:`, chapters.length)
              }
            }

            newVolumes.push({
              id: sv.id || `vol-${now}-${i}`,
              title: fullTitle,
              chapters
            })
          }
        } else if (outline1Step.content) {
          // 兜底：从文本解析卷，并尝试匹配原始项目卷以保留章节
          const volumeParts = outline1Step.content.split(/\n\n---\n\n/)
          for (let i = 0; i < volumeParts.length; i++) {
            const part = volumeParts[i]
            const lines = part.split('\n').filter((line: string) => line.trim())
            let fullHeader = ''
            for (const line of lines) {
              const cleaned = line.replace(/^#+\s*/, '').trim()
              if (cleaned) {
                fullHeader = cleaned
                break
              }
            }
            if (fullHeader) {
              // 尝试从原始项目卷中匹配（通过标题或索引）
              let matchedVol = null
              const volNumMatch = fullHeader.match(/第(\d+)/)
              const volNum = volNumMatch ? parseInt(volNumMatch[1]) : 0

              // 1. 标题完全匹配
              matchedVol = originalProjectVolumes.find(v => v.title === fullHeader)
              // 2. 卷号匹配
              if (!matchedVol && volNum > 0 && volNum <= originalProjectVolumes.length) {
                matchedVol = originalProjectVolumes[volNum - 1]
              }
              // 3. 索引匹配
              if (!matchedVol && i < originalProjectVolumes.length) {
                matchedVol = originalProjectVolumes[i]
              }

              newVolumes.push({
                id: matchedVol?.id || `vol-${now}-${i}`,
                title: fullHeader,
                chapters: matchedVol?.chapters || []
              })
            }
          }
        }

        if (newVolumes.length > 0) {
          projectStore.project.volumes = newVolumes
        }
      }
      
      // 标记已修改并保存
      projectStore.markDirty()
      await projectStore.saveProject()
      
      ElMessage.success('项目设定已更新！')
    } else {
      // 创建模式：生成新项目
      const projectState = projectStore.generateProjectState()
      if (!projectState) {
        ElMessage.error('生成项目失败')
        return
      }
      
      // 保存项目
      const path = projectStore.session?.projectPath || ''
      
      // 创建项目目录并保存
      await window.electronAPI.saveProject(path, JSON.parse(JSON.stringify(projectState)))
      
      ElMessage.success('项目创建成功！')
    }
    
    // 清除创建会话
    projectStore.clearSession()
    
    // 导航到工作台
    router.push('/workbench')
  } catch (error) {
    console.error('保存项目失败：', error)
    ElMessage.error(`保存项目失败: ${error instanceof Error ? error.message : String(error)}`)
  }
}

onMounted(async () => {
  // 如果session为空，尝试从缓存恢复
  if (!projectStore.session) {
    const restored = await projectStore.loadSession()
    if (restored) {
      ElMessage.success('已恢复上次的创建进度')
    }
  }
})
</script>

<style scoped>
.creation-wizard {
  width: 100%;
  height: 100vh;
  overflow-y: auto;
  background: var(--el-bg-color);
}

.step-content {
  padding: 20px;
  min-height: calc(100vh - 40px); /* 确保内容区有足够高度 */
}

/* AI 处理进度 */
.ai-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 40px;
}

.progress-message {
  font-size: 16px;
  color: var(--el-text-color-primary);
  margin: 0;
}

/* 完成步骤样式 */
.completion-step {
  max-width: 800px;
  margin: 0 auto;
  padding: 60px 20px;
  text-align: center;
}

.success-icon {
  font-size: 80px;
  margin-bottom: 20px;
}

.completion-step h2 {
  margin-bottom: 10px;
  color: var(--el-text-color-primary);
}

.completion-message {
  color: var(--el-text-color-secondary);
  margin-bottom: 40px;
  font-size: 16px;
}

.project-summary {
  margin-bottom: 40px;
  text-align: left;
  
  h3 {
    margin-bottom: 16px;
    color: var(--el-text-color-primary);
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  h3 {
    margin-bottom: 0;
  }
}

.completion-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
}
</style>
